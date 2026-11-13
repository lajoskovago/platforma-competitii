"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isNominator, requireUser } from "@/lib/auth";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { dbError, str, type ActionState } from "@/lib/action-state";
import { POSITION_LABEL, bucharestToISO, type OfficialPosition } from "@/lib/format";
import {
  notifyGameChanges,
  notifyNominated,
  notifyNominationCancelled,
  prepareGameCancellation,
  snapshotGames,
} from "@/lib/push";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// ---------------------------------------------------------------------------
// Nominations (admins of the game's region; enforced by RLS)
// ---------------------------------------------------------------------------
/**
 * All positions of a game (and the scoresheet type) in one save.
 * Form fields: `user_id__<position>` for every position (empty = free).
 * Changed positions are cleared first and then filled, so people can be swapped between positions.
 */
export async function saveNominations(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (!isNominator(me)) return { error: "Nu aveți drept de nominalizare." }; // per-region check: RLS
  const gameId = str(fd, "game_id");
  const supabase = await createSupabaseServer();

  const [{ data: game }, { data: existingRows }] = await Promise.all([
    supabase.from("games").select("scoresheet").eq("id", gameId).maybeSingle(),
    supabase.from("game_officials").select("id, position, user_id, status").eq("game_id", gameId),
  ]);
  if (!game) return { error: "Meciul nu a fost găsit." };
  const existing = existingRows ?? [];

  // scoresheet type
  let scoresheetChanged = false;
  if (fd.has("scoresheet")) {
    const v = str(fd, "scoresheet");
    const next = v === "manual" || v === "dss" ? v : null;
    if (next !== game.scoresheet) {
      const { error } = await supabase.rpc("set_game_scoresheet", { p_game_id: gameId, p_scoresheet: next ?? undefined });
      if (error) return dbError(error);
      scoresheetChanged = true;
    }
  }

  const chosen = (Object.keys(POSITION_LABEL) as OfficialPosition[])
    .filter((p) => fd.has(`user_id__${p}`))
    .map((p) => ({ position: p, userId: str(fd, `user_id__${p}`), current: existing.find((e) => e.position === p) }));
  const changes = chosen.filter((c) => (c.current?.user_id ?? "") !== c.userId);

  // one person, one active position: check before touching anything
  const active = new Map<string, string>();
  for (const c of chosen) {
    if (!c.userId) continue;
    if (c.current?.user_id === c.userId && c.current.status === "rejected") continue; // refused, kept as history
    const other = active.get(c.userId);
    if (other) {
      return {
        error: `Aceeași persoană este aleasă la ${POSITION_LABEL[other as OfficialPosition]} și la ${POSITION_LABEL[c.position]}.`,
      };
    }
    active.set(c.userId, c.position);
  }

  if (!changes.length) {
    if (scoresheetChanged) refresh();
    return { ok: scoresheetChanged ? "Tipul foii de joc a fost salvat." : "Fără modificări." };
  }

  const removed = changes.filter((c) => c.current).map((c) => c.current!);
  if (removed.length) {
    const { error } = await supabase
      .from("game_officials")
      .delete()
      .in(
        "id",
        removed.map((r) => r.id),
      );
    if (error) return dbError(error);
  }
  const added = changes.filter((c) => c.userId);
  if (added.length) {
    const { error } = await supabase
      .from("game_officials")
      .insert(added.map((c) => ({ game_id: gameId, position: c.position, user_id: c.userId })));
    if (error) {
      refresh();
      if (error.code === "23505") return { error: "O persoană este deja nominalizată la acest meci." };
      return dbError(error);
    }
  }

  // push: new nominations; people who lost their place (and had not refused) and are no longer on the game
  const stillOn = new Set(chosen.map((c) => c.userId).filter(Boolean));
  await Promise.all([
    ...added.map((c) => notifyNominated(c.userId, gameId, c.position)),
    ...removed
      .filter((r) => r.status !== "rejected" && !stillOn.has(r.user_id))
      .map((r) => notifyNominationCancelled(r.user_id, gameId, r.position as OfficialPosition)),
  ]);
  refresh();
  return {
    ok: `Nominalizările au fost salvate (${changes.length} ${changes.length === 1 ? "modificare" : "modificări"}).`,
  };
}

export async function respondNomination(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const response = str(fd, "response");
  const reason = str(fd, "reason");
  if (response !== "accepted" && response !== "rejected") return { error: "Răspuns invalid." };
  if (response === "rejected" && !reason) return { error: "Motivul refuzului este obligatoriu." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("respond_to_nomination", {
    p_nomination_id: str(fd, "nomination_id"),
    p_response: response,
    p_reason: reason || undefined,
  });
  if (error) return dbError(error);
  refresh();
  return { ok: response === "accepted" ? "Ați confirmat nominalizarea." : "Ați refuzat nominalizarea." };
}

// ---------------------------------------------------------------------------
// National games
// ---------------------------------------------------------------------------
async function rememberExternal(name: string, userId: string) {
  if (!name) return;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("external_clubs").select("id").ilike("name", name).maybeSingle();
  if (!data) await supabase.from("external_clubs").insert({ name, created_by: userId });
}

type Standalone = "national" | "friendly";
const listPath = (c: Standalone) => (c === "friendly" ? "/amicale" : "/national");

/**
 * One side of a standalone game, from the form value:
 *   "team:<id>"  an existing team
 *   "club:<id>"  a club of the region -> its team in this category (created if missing)
 *   "external"   free-text opponent (from outside the region)
 */
async function resolveSide(
  value: string,
  externalName: string,
  categoryId: string,
): Promise<{ team: string | null; ext: string | null; error?: string }> {
  if (value.startsWith("team:")) return { team: value.slice(5), ext: null };
  if (value.startsWith("club:")) {
    const clubId = value.slice(5);
    const admin = createSupabaseAdmin();
    const { data: existing } = await admin
      .from("teams")
      .select("id")
      .eq("club_id", clubId)
      .eq("category_id", categoryId)
      .order("created_at")
      .limit(1)
      .maybeSingle();
    if (existing) return { team: existing.id, ext: null };
    const { data: club } = await admin.from("clubs").select("name").eq("id", clubId).maybeSingle();
    if (!club) return { team: null, ext: null, error: "Clubul ales nu există." };
    const { data: created, error } = await admin
      .from("teams")
      .insert({ club_id: clubId, category_id: categoryId, name: club.name })
      .select("id")
      .single();
    if (error) return { team: null, ext: null, error: dbError(error).error };
    return { team: created.id, ext: null };
  }
  return { team: null, ext: externalName || null };
}

/** National championship and friendly games share this form. */
export async function saveStandaloneGame(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const competition: Standalone = str(fd, "competition") === "friendly" ? "friendly" : "national";
  const gameId = str(fd, "game_id");
  const categoryId = str(fd, "category_id");
  const date = str(fd, "date");
  const time = str(fd, "time");
  const gymId = str(fd, "gym_id");
  const regionIn = str(fd, "region");
  if (!categoryId) return { error: "Alegeți categoria." };
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return { error: "Completați data și ora." };
  // regional admins work in their own region; everyone else chooses it
  const region = user.isRegionalAdmin ? user.region : regionIn === "SR5" || regionIn === "SR6" ? regionIn : null;
  if (!region) return { error: "Alegeți regiunea meciului." };

  const homeValue = str(fd, "home_side");
  const awayValue = str(fd, "away_side");
  if (!homeValue) return { error: "Alegeți echipa gazdă." };
  if (!awayValue) return { error: "Alegeți echipa oaspete." };
  if (homeValue === awayValue && homeValue !== "external") return { error: "O echipă nu poate juca cu ea însăși." };

  const supabase = await createSupabaseServer();

  // Non-admins: one side must be their own team, before anything gets created
  if (!user.isAdmin) {
    const sideTeamIds: string[] = [];
    for (const v of [homeValue, awayValue]) {
      if (v.startsWith("team:")) sideTeamIds.push(v.slice(5));
      if (v.startsWith("club:")) {
        const { data: t } = await supabase.from("teams").select("id").eq("club_id", v.slice(5)).eq("category_id", categoryId);
        sideTeamIds.push(...(t ?? []).map((x) => x.id));
        if (user.managedClubIds.includes(v.slice(5))) sideTeamIds.push("own-club");
      }
    }
    if (!sideTeamIds.some((id) => id === "own-club" || user.teamIds.has(id))) {
      return { error: "Una dintre echipe trebuie să fie echipa dvs." };
    }
  }

  const home = await resolveSide(homeValue, str(fd, "home_external"), categoryId);
  if (home.error) return { error: home.error };
  const away = await resolveSide(awayValue, str(fd, "away_external"), categoryId);
  if (away.error) return { error: away.error };
  if (!home.team && !home.ext) return { error: "Scrieți numele echipei gazdă." };
  if (!away.team && !away.ext) return { error: "Scrieți numele echipei oaspete." };
  if (home.team && home.team === away.team) return { error: "O echipă nu poate juca cu ea însăși." };

  // Gym: existing or new
  let gym = gymId && gymId !== "new" ? gymId : null;
  if (gymId === "new") {
    const name = str(fd, "gym_name");
    const city = str(fd, "gym_city");
    if (!name || !city) return { error: "Completați numele și orașul sălii noi." };
    const { data: g, error } = await supabase
      .from("gyms")
      .insert({ name, city, address: str(fd, "gym_address") || null, maps_url: str(fd, "gym_maps_url") || null, created_by: user.id })
      .select("id")
      .single();
    if (error) return dbError(error);
    gym = g.id;
  }

  const row = {
    competition,
    category_id: categoryId,
    region,
    label: str(fd, "label") || null,
    home_team_id: home.team,
    away_team_id: away.team,
    home_external: home.ext,
    away_external: away.ext,
    starts_at: bucharestToISO(date, time),
    gym_id: gym,
  };

  const before = gameId ? await snapshotGames({ gameIds: [gameId] }) : [];
  const { data, error } = gameId
    ? await supabase.from("games").update(row).eq("id", gameId).select("id")
    : await supabase.from("games").insert(row).select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest meci." };
  await notifyGameChanges(before);

  await Promise.all([rememberExternal(home.ext ?? "", user.id), rememberExternal(away.ext ?? "", user.id)]);
  redirect(`/meci/${data[0].id}`);
}

export async function deleteStandaloneGame(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServer();
  const sendCancellation = await prepareGameCancellation([str(fd, "game_id")]);
  const { data, error } = await supabase
    .from("games")
    .delete()
    .eq("id", str(fd, "game_id"))
    .neq("competition", "regional")
    .select("id, competition");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest meci." };
  await sendCancellation(); // deleted: tell the nominated officials
  redirect(listPath(data[0].competition as Standalone));
}

// ---------------------------------------------------------------------------
// Unavailability (officials)
// ---------------------------------------------------------------------------
export async function addUnavailability(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!user.isOfficial) return { error: "Doar arbitrii și oficialii pot adăuga indisponibilități." };
  const start = str(fd, "start_date");
  const end = str(fd, "end_date") || start;
  const startTime = str(fd, "start_time");
  const endTime = str(fd, "end_time");
  if (!DATE_RE.test(start) || !DATE_RE.test(end)) return { error: "Alegeți data." };
  if (end < start) return { error: "Data de final este înaintea datei de început." };
  const singleDay = start === end;
  if (!singleDay && (startTime || endTime)) return { error: "Orele se pot completa doar pentru o singură zi." };
  if (startTime && endTime && endTime <= startTime) return { error: "Ora de final trebuie să fie după ora de început." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("official_unavailability").insert({
    user_id: user.id,
    start_date: start,
    end_date: end,
    start_time: singleDay && startTime ? startTime : null,
    end_time: singleDay && endTime ? endTime : null,
    note: str(fd, "note") || null,
  });
  if (error) return dbError(error);
  refresh();
  return { ok: "Indisponibilitatea a fost adăugată." };
}

export async function deleteUnavailability(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("official_unavailability").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return {};
}
