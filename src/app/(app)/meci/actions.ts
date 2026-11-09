"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { isNominator, requireUser } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { dbError, str, type ActionState } from "@/lib/action-state";
import { POSITION_LABEL, bucharestToISO, formatDateTime, type OfficialPosition } from "@/lib/format";
import { notifyUsers } from "@/lib/notify";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

// ---------------------------------------------------------------------------
// Nominations (admins of the game's region; enforced by RLS)
// ---------------------------------------------------------------------------
export async function setNomination(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (!isNominator(me)) return { error: "Nu aveți drept de nominalizare." }; // per-region check: RLS
  const gameId = str(fd, "game_id");
  const position = str(fd, "position") as OfficialPosition;
  const userId = str(fd, "user_id");
  if (!POSITION_LABEL[position]) return { error: "Poziție invalidă." };

  const supabase = await createSupabaseServer();
  const { data: existing } = await supabase
    .from("game_officials")
    .select("id, user_id")
    .eq("game_id", gameId)
    .eq("position", position)
    .maybeSingle();

  if (!userId) {
    if (existing) {
      const { error } = await supabase.from("game_officials").delete().eq("id", existing.id);
      if (error) return dbError(error);
    }
    refresh();
    return { ok: "Poziția a fost eliberată." };
  }
  if (existing?.user_id === userId) return { ok: "Fără modificări." };

  const { error } = existing
    ? await supabase.from("game_officials").update({ user_id: userId }).eq("id", existing.id)
    : await supabase.from("game_officials").insert({ game_id: gameId, position, user_id: userId });
  if (error) {
    if (error.code === "23505") return { error: "Persoana este deja nominalizată la acest meci." };
    return dbError(error);
  }

  const { data: game } = await supabase.from("games").select("starts_at").eq("id", gameId).single();
  await notifyUsers(
    [userId],
    "Nominalizare nouă",
    `Ați fost nominalizat ca ${POSITION_LABEL[position]} la meciul din ${game ? formatDateTime(game.starts_at) : ""}. Vă rugăm să confirmați sau să refuzați.`,
  );
  refresh();
  return { ok: "Nominalizarea a fost salvată." };
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

export async function saveNationalGame(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const gameId = str(fd, "game_id");
  const categoryId = str(fd, "category_id");
  const date = str(fd, "date");
  const time = str(fd, "time");
  const gymId = str(fd, "gym_id");
  if (!categoryId) return { error: "Alegeți categoria." };
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return { error: "Completați data și ora." };

  const side = (s: "home" | "away") => {
    const team = str(fd, `${s}_team_id`);
    const ext = str(fd, `${s}_external`);
    return team && team !== "external" ? { team, ext: null } : { team: null, ext: ext || null };
  };
  const home = side("home");
  const away = side("away");
  if (!home.team && !home.ext) return { error: "Alegeți sau scrieți echipa gazdă." };
  if (!away.team && !away.ext) return { error: "Alegeți sau scrieți echipa oaspete." };
  if (home.team && home.team === away.team) return { error: "O echipă nu poate juca cu ea însăși." };
  if (!user.isAdmin && !(home.team && user.teamIds.has(home.team)) && !(away.team && user.teamIds.has(away.team))) {
    return { error: "Una dintre echipe trebuie să fie echipa dvs." };
  }

  // Gym: existing or new
  let gym = gymId && gymId !== "new" ? gymId : null;
  const supabase = await createSupabaseServer();
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

  // Region: chosen by master admin; regional admin -> own; otherwise from our team's club (DB trigger)
  const regionInput = str(fd, "region");
  const region =
    user.isMaster && (regionInput === "SR5" || regionInput === "SR6")
      ? regionInput
      : user.isRegionalAdmin
        ? user.region
        : null;
  if (user.isMaster && !region && !home.team && !away.team) return { error: "Alegeți regiunea meciului." };

  const row = {
    competition: "national" as const,
    category_id: categoryId,
    label: str(fd, "label") || null,
    home_team_id: home.team,
    away_team_id: away.team,
    home_external: home.ext,
    away_external: away.ext,
    starts_at: bucharestToISO(date, time),
    gym_id: gym,
    ...(region ? { region } : {}),
  };

  const { data, error } = gameId
    ? await supabase.from("games").update(row).eq("id", gameId).select("id")
    : await supabase.from("games").insert(row).select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest meci." };

  await Promise.all([rememberExternal(home.ext ?? "", user.id), rememberExternal(away.ext ?? "", user.id)]);
  redirect(`/meci/${data[0].id}`);
}

export async function deleteNationalGame(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("games")
    .delete()
    .eq("id", str(fd, "game_id"))
    .eq("competition", "national")
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest meci." };
  redirect("/national");
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
