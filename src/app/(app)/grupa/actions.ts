"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { dbError, str, type ActionState } from "@/lib/action-state";
import { bucharestToISO } from "@/lib/format";
import { notifyGroup } from "@/lib/notify";
import { notifyGameChanges, prepareGameCancellation, snapshotGames } from "@/lib/push";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{2}:\d{2}$/;

/** Returns the chosen gym id, creating a new gym when "new" was selected. */
async function resolveGym(fd: FormData, userId: string): Promise<{ id?: string; error?: string }> {
  const gymId = str(fd, "gym_id");
  if (gymId && gymId !== "new") return { id: gymId };

  const name = str(fd, "gym_name");
  const city = str(fd, "gym_city");
  if (!name || !city) return { error: "Alegeți o sală din listă sau completați numele și orașul sălii noi." };

  const supabase = await createSupabaseServer();
  const { data: existing } = await supabase
    .from("gyms")
    .select("id")
    .ilike("name", name)
    .ilike("city", city)
    .maybeSingle();
  if (existing) return { id: existing.id };

  const { data, error } = await supabase
    .from("gyms")
    .insert({
      name,
      city,
      address: str(fd, "gym_address") || null,
      maps_url: str(fd, "gym_maps_url") || null,
      created_by: userId,
    })
    .select("id")
    .single();
  if (error) return { error: dbError(error).error };
  return { id: data.id };
}

function readDates(fd: FormData) {
  const start = str(fd, "start_date");
  const end = str(fd, "end_date");
  if (!DATE_RE.test(start)) return { error: "Alegeți data turneului." };
  if (end && !DATE_RE.test(end)) return { error: "Data de final nu este validă." };
  if (end && end < start) return { error: "Data de final este înaintea datei de început." };
  return { start, end: end && end !== start ? end : null };
}

export async function saveProposal(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const groupId = str(fd, "group_id");
  const proposalId = str(fd, "proposal_id");
  const teamId = str(fd, "team_id");

  const dates = readDates(fd);
  if ("error" in dates) return { error: dates.error };

  if (!proposalId && fd.get("conditions") !== "on") {
    return { error: "Trebuie să bifați că ați luat la cunoștință condițiile de organizare." };
  }

  const gym = await resolveGym(fd, user.id);
  if (gym.error) return { error: gym.error };

  const supabase = await createSupabaseServer();
  const notes = str(fd, "notes") || undefined;

  if (proposalId) {
    const { error } = await supabase.rpc("update_proposal", {
      p_proposal_id: proposalId,
      p_gym_id: gym.id!,
      p_start_date: dates.start,
      p_end_date: dates.end ?? undefined,
      p_notes: notes,
    });
    if (error) return dbError(error);
    await notifyGroup(groupId, "Propunere de organizare modificată", `Data sau sala au fost modificate. Vă rugăm să răspundeți din nou.`, user.id);
  } else {
    if (!teamId) return { error: "Alegeți echipa organizatoare." };
    const { data: newId, error } = await supabase.rpc("create_proposal", {
      p_group_id: groupId,
      p_team_id: teamId,
      p_gym_id: gym.id!,
      p_start_date: dates.start,
      p_end_date: dates.end ?? undefined,
      p_notes: notes,
      p_conditions_accepted: true,
    });
    if (error) return dbError(error);
    const { data: created } = await supabase.from("hosting_proposals").select("status").eq("id", newId).single();
    if (created?.status === "confirmed") {
      await notifyGroup(groupId, "Organizator confirmat", "O echipă s-a oferit să organizeze turneul și a fost confirmată automat.", user.id);
      redirect(`/grupa/${groupId}/program`);
    }
    await notifyGroup(groupId, "Propunere nouă de organizare", `O echipă dorește să organizeze turneul. Vă rugăm să acceptați sau să respingeți propunerea.`, user.id);
  }

  redirect(`/grupa/${groupId}`);
}

export async function withdrawProposal(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("withdraw_proposal", { p_proposal_id: str(fd, "proposal_id") });
  if (error) return dbError(error);
  refresh();
  return { ok: "Propunerea a fost retrasă." };
}

export async function respondToProposal(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const response = str(fd, "response");
  const reason = str(fd, "reason");
  if (response !== "accept" && response !== "reject") return { error: "Răspuns invalid." };
  if (response === "reject" && !reason) return { error: "Scrieți motivul respingerii." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("respond_to_proposal", {
    p_proposal_id: str(fd, "proposal_id"),
    p_team_id: str(fd, "team_id"),
    p_response: response,
    p_reason: reason || undefined,
  });
  if (error) return dbError(error);

  if (response === "reject") {
    await notifyGroup(str(fd, "group_id"), "Propunere de organizare respinsă", `Motiv: ${reason}`, user.id);
  }
  refresh();
  return { ok: response === "accept" ? "Ați acceptat propunerea." : "Ați respins propunerea." };
}

export async function adminConfirmProposal(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("admin_confirm_proposal", { p_proposal_id: str(fd, "proposal_id") });
  if (error) return dbError(error);
  await notifyGroup(str(fd, "group_id"), "Organizator confirmat", "Administratorul a confirmat organizatorul turneului.");
  refresh();
  return { ok: "Organizatorul a fost confirmat." };
}

export async function adminUnconfirmGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("admin_unconfirm_group", { p_group_id: str(fd, "group_id") });
  if (error) return dbError(error);
  refresh();
  return { ok: "Confirmarea a fost anulată." };
}

// ---------------------------------------------------------------------------
// Games (host or admin; enforced by RLS)
// ---------------------------------------------------------------------------

function readGame(fd: FormData) {
  const date = str(fd, "date");
  const time = str(fd, "time");
  if (!DATE_RE.test(date) || !TIME_RE.test(time)) return { error: "Completați data și ora meciului." };
  const home = str(fd, "home_team_id");
  const away = str(fd, "away_team_id");
  const homeLabel = str(fd, "home_label");
  const awayLabel = str(fd, "away_label");
  if (!home && !homeLabel) return { error: "Alegeți echipa gazdă sau scrieți o descriere (ex. „Învinsă SF1”)." };
  if (!away && !awayLabel) return { error: "Alegeți echipa oaspete sau scrieți o descriere (ex. „Învinsă SF2”)." };
  if (home && home === away) return { error: "O echipă nu poate juca cu ea însăși." };
  return {
    row: {
      label: str(fd, "label") || null,
      home_team_id: home || null,
      away_team_id: away || null,
      home_label: home ? null : homeLabel,
      away_label: away ? null : awayLabel,
      starts_at: bucharestToISO(date, time),
    },
  };
}

export async function addGame(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const g = readGame(fd);
  if (g.error) return { error: g.error };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("games").insert({
    ...g.row!,
    group_id: str(fd, "group_id"),
    gym_id: str(fd, "gym_id") || null,
  });
  if (error) return dbError(error);
  refresh();
  return { ok: "Meciul a fost adăugat." };
}

export async function updateGame(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const g = readGame(fd);
  if (g.error) return { error: g.error };
  const supabase = await createSupabaseServer();
  const before = await snapshotGames({ gameIds: [str(fd, "game_id")] });
  const { data, error } = await supabase.from("games").update(g.row!).eq("id", str(fd, "game_id")).select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest meci." };
  await notifyGameChanges(before);
  refresh();
  return { ok: "Meciul a fost salvat." };
}

export async function deleteGame(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const supabase = await createSupabaseServer();
  const sendCancellation = await prepareGameCancellation([str(fd, "game_id")]);
  const { data, error } = await supabase.from("games").delete().eq("id", str(fd, "game_id")).select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest meci." };
  await sendCancellation();
  refresh();
  return { ok: "Meciul a fost șters." };
}

export async function saveResult(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const status = str(fd, "status") as "scheduled" | "played" | "forfeit_home" | "forfeit_away";
  if (!["scheduled", "played", "forfeit_home", "forfeit_away"].includes(status)) return { error: "Stare invalidă." };

  let home_score: number | null = null;
  let away_score: number | null = null;
  if (status === "played") {
    const h = str(fd, "home_score");
    const a = str(fd, "away_score");
    if (!/^\d{1,3}$/.test(h) || !/^\d{1,3}$/.test(a)) return { error: "Completați scorul ambelor echipe." };
    home_score = Number(h);
    away_score = Number(a);
    if (home_score === away_score) return { error: "În baschet nu există egalitate – verificați scorul." };
  }

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("games")
    .update({ status, home_score, away_score })
    .eq("id", str(fd, "game_id"))
    .select("id");
  if (error) {
    if (error.message.includes("games_played_needs_score")) return { error: "Ambele echipe trebuie stabilite înainte de rezultat." };
    return dbError(error);
  }
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest meci." };
  refresh();
  return { ok: "Rezultatul a fost salvat." };
}

/** Pre-fill the program: round robin (3 teams) or semifinals + finals (4 teams). */
export async function generateGames(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const groupId = str(fd, "group_id");
  const format = str(fd, "format");
  const date = str(fd, "date");
  const first = str(fd, "first_time") || "10:00";
  const step = Number(str(fd, "step_minutes") || "90");
  if (!DATE_RE.test(date) || !TIME_RE.test(first)) return { error: "Completați data și ora primului meci." };

  const supabase = await createSupabaseServer();
  const [{ data: existing }, { data: gt }, { data: grp }] = await Promise.all([
    supabase.from("games").select("id").eq("group_id", groupId).limit(1),
    supabase.from("group_teams").select("team:teams(id, name)").eq("group_id", groupId),
    supabase.from("group_overview").select("confirmed_proposal_id").eq("group_id", groupId).single(),
  ]);
  if (existing?.length) return { error: "Programul are deja meciuri." };

  const { data: prop } = grp?.confirmed_proposal_id
    ? await supabase.from("hosting_proposals").select("gym_id").eq("id", grp.confirmed_proposal_id).single()
    : { data: null };

  const teams = (gt ?? [])
    .map((r) => r.team!)
    .filter(Boolean)
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));

  // Optional custom order from the form (seed order)
  const order = fd.getAll("order").map(String).filter(Boolean);
  if (order.length === teams.length) teams.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));

  const [h, m] = first.split(":").map(Number);
  const at = (i: number) => {
    const total = h * 60 + m + i * step;
    const hh = String(Math.floor(total / 60)).padStart(2, "0");
    const mm = String(total % 60).padStart(2, "0");
    return bucharestToISO(date, `${hh}:${mm}`);
  };

  type Row = { label: string; home_team_id?: string; away_team_id?: string; home_label?: string; away_label?: string };
  let rows: Row[];
  if (format === "round_robin" && teams.length === 3) {
    const [a, b, c] = teams;
    rows = [
      { label: "Meci 1", home_team_id: a.id, away_team_id: b.id },
      { label: "Meci 2", home_team_id: b.id, away_team_id: c.id },
      { label: "Meci 3", home_team_id: c.id, away_team_id: a.id },
    ];
  } else if (format === "semis" && teams.length === 4) {
    const [a, b, c, d] = teams;
    rows = [
      { label: "Semifinala 1", home_team_id: a.id, away_team_id: d.id },
      { label: "Semifinala 2", home_team_id: b.id, away_team_id: c.id },
      { label: "Finala mică (loc 3-4)", home_label: "Învinsă SF1", away_label: "Învinsă SF2" },
      { label: "Finala mare (loc 1-2)", home_label: "Câștigătoare SF1", away_label: "Câștigătoare SF2" },
    ];
  } else {
    return { error: "Formatul ales nu se potrivește cu numărul de echipe din grupă." };
  }

  const { error } = await supabase.from("games").insert(
    rows.map((r, i) => ({ ...r, group_id: groupId, starts_at: at(i), gym_id: prop?.gym_id ?? null })),
  );
  if (error) return dbError(error);
  refresh();
  return { ok: "Programul a fost generat. Verificați orele și echipele." };
}

/** Admin: assign the organiser of a group directly (team + date + gym). */
export async function adminAssignOrganizer(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const groupId = str(fd, "group_id");
  const teamId = str(fd, "team_id");
  if (!teamId) return { error: "Alegeți echipa organizatoare." };
  const dates = readDates(fd);
  if ("error" in dates) return { error: dates.error };
  const gym = await resolveGym(fd, user.id);
  if (gym.error) return { error: gym.error };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.rpc("admin_assign_organizer", {
    p_group_id: groupId,
    p_team_id: teamId,
    p_gym_id: gym.id!,
    p_start_date: dates.start,
    p_end_date: dates.end ?? undefined,
    p_notes: str(fd, "notes") || undefined,
  });
  if (error) return dbError(error);
  await notifyGroup(groupId, "Organizator desemnat", "Administratorul a desemnat organizatorul turneului.", user.id);
  redirect(`/grupa/${groupId}`);
}
