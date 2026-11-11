"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { canAdminRegion, requireUser } from "@/lib/auth";
import { dbError, str, type ActionState } from "@/lib/action-state";
import { createSupabaseServer } from "@/lib/supabase/server";
import { notifyGroup } from "@/lib/notify";
import { notifyGameChanges, snapshotGames } from "@/lib/push";

/** The caller must administer the group's region (master: all). */
async function groupAdmin(groupId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const { data: g } = await supabase
    .from("group_overview")
    .select("group_id, region, tournament_id, category_id")
    .eq("group_id", groupId)
    .maybeSingle();
  if (!g || !canAdminRegion(user, g.region)) return null;
  return { user, supabase, group: g };
}

/** A team cannot leave a group where it has games or an active hosting proposal. */
async function teamBusyInGroup(
  supabase: Awaited<ReturnType<typeof createSupabaseServer>>,
  groupId: string,
  teamId: string,
) {
  const [{ count: games }, { count: proposals }] = await Promise.all([
    supabase
      .from("games")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`),
    supabase
      .from("hosting_proposals")
      .select("id", { count: "exact", head: true })
      .eq("group_id", groupId)
      .eq("team_id", teamId)
      .in("status", ["pending", "confirmed"]),
  ]);
  if (games) return "Echipa are meciuri în această grupă. Ștergeți întâi meciurile ei din program.";
  if (proposals) return "Echipa are o propunere de organizare activă în această grupă.";
  return null;
}

export async function updateGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await groupAdmin(str(fd, "group_id"));
  if (!ctx) return { error: "Nu administrați această grupă." };
  const name = str(fd, "name");
  if (!name) return { error: "Completați numele grupei." };
  const regionIn = str(fd, "region");
  const region: "SR5" | "SR6" | null = regionIn === "SR5" || regionIn === "SR6" ? regionIn : null;
  // only the master admin changes the region (a regional admin would lose access to the group)
  const changes = ctx.user.isMaster
    ? { name, notes: str(fd, "notes") || null, region }
    : { name, notes: str(fd, "notes") || null };
  const { error } = await ctx.supabase.from("groups").update(changes).eq("id", ctx.group.group_id!);
  if (error) return dbError(error);
  refresh();
  return { ok: "Grupa a fost salvată." };
}

export async function addTeamToGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  const groupId = str(fd, "group_id");
  const ctx = await groupAdmin(groupId);
  if (!ctx) return { error: "Nu administrați această grupă." };
  const teamId = str(fd, "team_id");
  if (!teamId) return { error: "Alegeți echipa." };

  const { data: team } = await ctx.supabase.from("teams").select("id, category_id").eq("id", teamId).maybeSingle();
  if (!team || team.category_id !== ctx.group.category_id) return { error: "Echipa nu este din această categorie." };

  // move out of another group of the same tournament
  const { data: current } = await ctx.supabase
    .from("group_teams")
    .select("group_id, groups!inner(tournament_id)")
    .eq("team_id", teamId)
    .eq("groups.tournament_id", ctx.group.tournament_id!);
  for (const c of current ?? []) {
    if (c.group_id === groupId) return { error: "Echipa este deja în această grupă." };
    const busy = await teamBusyInGroup(ctx.supabase, c.group_id, teamId);
    if (busy) return { error: `Nu se poate muta din grupa actuală: ${busy}` };
    const { error } = await ctx.supabase.from("group_teams").delete().eq("group_id", c.group_id).eq("team_id", teamId);
    if (error) return dbError(error);
  }

  const { error } = await ctx.supabase.from("group_teams").insert({ group_id: groupId, team_id: teamId });
  if (error) return dbError(error);
  refresh();
  return { ok: current?.length ? "Echipa a fost mutată în această grupă." : "Echipa a fost adăugată în grupă." };
}

export async function removeTeamFromGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  const groupId = str(fd, "group_id");
  const ctx = await groupAdmin(groupId);
  if (!ctx) return { error: "Nu administrați această grupă." };
  const teamId = str(fd, "team_id");
  const busy = await teamBusyInGroup(ctx.supabase, groupId, teamId);
  if (busy) return { error: busy };
  const { error } = await ctx.supabase.from("group_teams").delete().eq("group_id", groupId).eq("team_id", teamId);
  if (error) return dbError(error);
  refresh();
  return { ok: "Echipa a fost scoasă din grupă." };
}

export async function deleteGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  const groupId = str(fd, "group_id");
  const ctx = await groupAdmin(groupId);
  if (!ctx) return { error: "Nu administrați această grupă." };
  const [{ count: games }, { count: proposals }] = await Promise.all([
    ctx.supabase.from("games").select("id", { count: "exact", head: true }).eq("group_id", groupId),
    ctx.supabase.from("hosting_proposals").select("id", { count: "exact", head: true }).eq("group_id", groupId),
  ]);
  if (games || proposals) {
    return { error: "Grupa are propuneri de organizare sau meciuri și nu poate fi ștearsă." };
  }
  const { error } = await ctx.supabase.from("groups").delete().eq("id", groupId);
  if (error) return dbError(error);
  redirect("/admin");
}

/** Admin: change date / gym of a tournament with a confirmed organiser (organiser stays confirmed). */
export async function adminUpdateTournament(_: ActionState, fd: FormData): Promise<ActionState> {
  const groupId = str(fd, "group_id");
  const ctx = await groupAdmin(groupId);
  if (!ctx) return { error: "Nu administrați această grupă." };

  const start = str(fd, "start_date");
  const end = str(fd, "end_date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return { error: "Alegeți data turneului." };
  if (end && end < start) return { error: "Data de final este înaintea datei de început." };

  // gym: existing or a new one
  let gymId = str(fd, "gym_id");
  if (!gymId || gymId === "new") {
    const name = str(fd, "gym_name");
    const city = str(fd, "gym_city");
    if (!name || !city) return { error: "Alegeți o sală din listă sau completați numele și orașul sălii noi." };
    const { data: gym, error } = await ctx.supabase
      .from("gyms")
      .insert({
        name,
        city,
        address: str(fd, "gym_address") || null,
        maps_url: str(fd, "gym_maps_url") || null,
        created_by: ctx.user.id,
      })
      .select("id")
      .single();
    if (error) return dbError(error);
    gymId = gym.id;
  }

  const before = await snapshotGames({ groupId });
  const { error } = await ctx.supabase.rpc("admin_update_tournament", {
    p_group_id: groupId,
    p_gym_id: gymId,
    p_start_date: start,
    p_end_date: end || undefined,
    p_notes: str(fd, "notes") || undefined,
    p_move_games: fd.get("move_games") === "on",
  });
  if (error) return dbError(error);
  await notifyGameChanges(before); // push to officials confirmed on games that moved
  await notifyGroup(groupId, "Turneu modificat", "Administratorul a modificat data sau sala turneului.", ctx.user.id);
  redirect(`/grupa/${groupId}`);
}
