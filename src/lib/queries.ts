import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";
import type { Region } from "@/lib/auth";
import { upcomingCutoff } from "@/lib/format";

type Tables = Database["public"]["Tables"];
export type Gym = Tables["gyms"]["Row"];
export type Game = Tables["games"]["Row"];
export type Proposal = Tables["hosting_proposals"]["Row"];
export type ProposalResponse = Tables["proposal_responses"]["Row"];
export type Nomination = Tables["game_officials"]["Row"];
export type GroupOverview = Database["public"]["Views"]["group_overview"]["Row"];
export type Standing = Database["public"]["Views"]["group_standings"]["Row"];

/** Contact details are only present when RLS lets the viewer see them. */
export type Person = { id: string; full_name: string; email: string | null; phone: string | null };
export type GroupTeam = {
  id: string;
  name: string;
  clubRegion: Region | null;
  club: { id: string; name: string; city: string | null };
  coaches: Person[];
  managers: Person[];
};

const NONE = ["00000000-0000-0000-0000-000000000000"];
const orNone = (ids: string[]) => (ids.length ? ids : NONE);

/** id -> display name, for any users (names are visible to every logged-in user). */
export async function getNames(ids: (string | null | undefined)[]) {
  const unique = [...new Set(ids.filter(Boolean))] as string[];
  const map = new Map<string, string>();
  if (!unique.length) return map;
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("profile_names").select("id, full_name").in("id", unique);
  for (const p of data ?? []) if (p.id) map.set(p.id, p.full_name ?? "");
  return map;
}

/** People with contact details where visible, names otherwise. */
async function getPeople(ids: string[]): Promise<Map<string, Person>> {
  const supabase = await createSupabaseServer();
  const [names, { data: contacts }] = await Promise.all([
    getNames(ids),
    supabase.from("profiles").select("id, email, phone").in("id", orNone(ids)),
  ]);
  const map = new Map<string, Person>();
  for (const id of ids) {
    const c = (contacts ?? []).find((x) => x.id === id);
    map.set(id, { id, full_name: names.get(id) ?? "", email: c?.email ?? null, phone: c?.phone ?? null });
  }
  return map;
}

/** Nominations for a set of games, with official names. */
export async function getNominations(gameIds: string[]) {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("game_officials").select("*").in("game_id", orNone(gameIds));
  const names = await getNames((data ?? []).map((n) => n.user_id));
  return (data ?? []).map((n) => ({ ...n, name: names.get(n.user_id) ?? "" }));
}
export type NominationWithName = Awaited<ReturnType<typeof getNominations>>[number];

/** Regional teams the user coaches or manages (via club), with their groups' status. */
export async function getMyTeamsWithGroups(teamIdSet: Set<string>) {
  const teamIds = [...teamIdSet];
  if (teamIds.length === 0) return [];
  const supabase = await createSupabaseServer();

  const [{ data: teams }, { data: memberships }] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, club:clubs(name), category:categories!inner(code, name, sort_order, scope)")
      .in("id", teamIds)
      .eq("category.scope", "regional"),
    supabase.from("group_teams").select("team_id, group_id").in("team_id", teamIds),
  ]);

  const groupIds = [...new Set((memberships ?? []).map((m) => m.group_id))];
  const [{ data: overview }, { data: confirmed }, { data: pending }] = await Promise.all([
    supabase.from("group_overview").select("*").in("group_id", orNone(groupIds)),
    supabase
      .from("hosting_proposals")
      .select("group_id, start_date, end_date, team:teams!hosting_proposals_team_id_fkey(name), gym:gyms(name, city)")
      .in("group_id", orNone(groupIds))
      .eq("status", "confirmed"),
    supabase
      .from("hosting_proposals")
      .select("id, group_id, team_id, proposal_responses(team_id)")
      .in("group_id", orNone(groupIds))
      .eq("status", "pending"),
  ]);

  return (teams ?? [])
    .map((t) => {
      const groups = (memberships ?? [])
        .filter((m) => m.team_id === t.id)
        .map((m) => {
          const ov = (overview ?? []).find((o) => o.group_id === m.group_id);
          const host = (confirmed ?? []).find((c) => c.group_id === m.group_id);
          // pending proposals of other teams this team has not answered yet
          const needsAnswer = (pending ?? []).filter(
            (p) =>
              p.group_id === m.group_id &&
              p.team_id !== t.id &&
              !p.proposal_responses.some((r) => r.team_id === t.id),
          ).length;
          return { groupId: m.group_id, overview: ov, host, needsAnswer };
        });
      return { ...t, groups };
    })
    .sort(
      (a, b) =>
        (a.category?.sort_order ?? 0) - (b.category?.sort_order ?? 0) || a.name.localeCompare(b.name, "ro"),
    );
}

/** Everything the group page needs. Returns null when the group is not visible. */
export async function getGroupDetail(groupId: string) {
  const supabase = await createSupabaseServer();

  const [{ data: overview }, { data: gt }, { data: proposals }, { data: games }, { data: standings }] =
    await Promise.all([
      supabase.from("group_overview").select("*").eq("group_id", groupId).maybeSingle(),
      supabase
        .from("group_teams")
        .select("team:teams(id, name, club:clubs(id, name, city, region))")
        .eq("group_id", groupId),
      supabase
        .from("hosting_proposals")
        .select("*, gym:gyms(*), proposal_responses(*)")
        .eq("group_id", groupId)
        .order("created_at"),
      supabase.from("games").select("*, gym:gyms(*)").eq("group_id", groupId).order("starts_at"),
      supabase.from("group_standings").select("*").eq("group_id", groupId),
    ]);

  if (!overview) return null;

  const teamsRaw = (gt ?? []).map((r) => r.team).filter((t): t is NonNullable<typeof t> => !!t);
  const teamIds = teamsRaw.map((t) => t.id);
  const clubIds = [...new Set(teamsRaw.map((t) => t.club!.id))];

  const [{ data: coaches }, { data: managers }, { data: notes }, nominations] = await Promise.all([
    supabase.from("team_coaches").select("team_id, user_id").in("team_id", orNone(teamIds)),
    supabase.from("club_managers").select("club_id, user_id").in("club_id", orNone(clubIds)),
    supabase.from("groups").select("notes").eq("id", groupId).single(),
    getNominations((games ?? []).map((g) => g.id)),
  ]);

  const proposalPeople = (proposals ?? []).flatMap((p) => [
    p.proposed_by,
    ...p.proposal_responses.map((r) => r.responded_by),
  ]);
  const people = await getPeople(
    [
      ...(coaches ?? []).map((c) => c.user_id),
      ...(managers ?? []).map((m) => m.user_id),
      ...proposalPeople,
    ].filter(Boolean) as string[],
  );

  const teams: GroupTeam[] = teamsRaw
    .map((t) => ({
      id: t.id,
      name: t.name,
      clubRegion: t.club!.region,
      club: { id: t.club!.id, name: t.club!.name, city: t.club!.city },
      coaches: (coaches ?? []).filter((c) => c.team_id === t.id).map((c) => people.get(c.user_id)!),
      managers: (managers ?? []).filter((m) => m.club_id === t.club!.id).map((m) => people.get(m.user_id)!),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));

  return {
    overview,
    notes: notes?.notes ?? null,
    teams,
    proposals: proposals ?? [],
    games: games ?? [],
    nominations,
    standings: standings ?? [],
    personName: (id: string | null) => (id ? people.get(id)?.full_name || "" : ""),
  };
}

export type GroupDetail = NonNullable<Awaited<ReturnType<typeof getGroupDetail>>>;

/** End of the temporary auto-confirmation period, or null when it is not active. */
export async function getAutoConfirmUntil() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("app_settings").select("auto_confirm_until").maybeSingle();
  const until = data?.auto_confirm_until;
  return until && new Date(until).getTime() > Date.now() ? until : null;
}

export async function getGyms() {
  const supabase = await createSupabaseServer();
  const { data } = await supabase.from("gyms").select("*").order("city").order("name");
  return data ?? [];
}

/** One game (regional or national) with names for both sides. Null if not visible. */
export async function getGame(gameId: string) {
  const supabase = await createSupabaseServer();
  const { data: g } = await supabase
    .from("games")
    .select(
      "*, gym:gyms(*), category:categories(code, name, scope), home:teams!games_home_team_id_fkey(id, name, club:clubs(region)), away:teams!games_away_team_id_fkey(id, name, club:clubs(region))",
    )
    .eq("id", gameId)
    .maybeSingle();
  if (!g) return null;

  let groupInfo: { name: string; region: Region | null; tournament: string } | null = null;
  if (g.group_id) {
    const { data } = await supabase
      .from("group_overview")
      .select("group_name, region, tournament_name")
      .eq("group_id", g.group_id)
      .maybeSingle();
    if (data) groupInfo = { name: data.group_name!, region: data.region, tournament: data.tournament_name! };
  }
  const nominations = await getNominations([g.id]);
  const region = g.competition === "regional" ? (groupInfo?.region ?? null) : g.region;
  return { ...g, groupInfo, nominations, gameRegion: region };
}
export type GameDetail = NonNullable<Awaited<ReturnType<typeof getGame>>>;

/** Visible games (RLS filters by role), with names and nominations. */
export async function listGames(opts: {
  competition?: "regional" | "national" | "friendly";
  categoryCode?: string;
  when?: "upcoming" | "past";
  limit?: number;
}) {
  const supabase = await createSupabaseServer();
  let q = supabase
    .from("games")
    .select(
      "*, gym:gyms(name, city), category:categories!inner(code, name, scope), home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name)",
    );
  if (opts.competition) q = q.eq("competition", opts.competition);
  if (opts.categoryCode) q = q.eq("category.code", opts.categoryCode);
  const now = new Date(upcomingCutoff()).toISOString();
  q = opts.when === "past" ? q.lt("starts_at", now).order("starts_at", { ascending: false }) : q.gte("starts_at", now).order("starts_at");
  const { data } = await q.limit(opts.limit ?? 200);
  const games = data ?? [];
  const nominations = await getNominations(games.map((g) => g.id));
  return games.map((g) => ({ ...g, nominations: nominations.filter((n) => n.game_id === g.id) }));
}
export type ListedGame = Awaited<ReturnType<typeof listGames>>[number];

export function sideName(
  g: { home_external: string | null; away_external: string | null; home_label: string | null; away_label: string | null },
  side: "home" | "away",
  team: { name: string } | null | undefined,
) {
  if (team) return team.name;
  return (side === "home" ? g.home_external ?? g.home_label : g.away_external ?? g.away_label) ?? "?";
}
