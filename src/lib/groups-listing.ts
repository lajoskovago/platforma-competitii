import "server-only";
import { createSupabaseServer } from "@/lib/supabase/server";

export type GroupFilters = {
  status: string;
  categorie: string;
  /** SR5 | SR6 | mixt */
  regiune: string;
  /** gym city of the confirmed organiser */
  oras: string;
  de: string;
  pana: string;
  /** team or club name */
  q: string;
  /** "grupa" (category, group order) | "data" (tournament date) */
  sort: string;
};

export const GROUP_FILTER_KEYS = ["status", "categorie", "regiune", "oras", "de", "pana", "q", "sort"] as const;

export function readGroupFilters(get: (k: string) => string | null | undefined): GroupFilters {
  const f = {} as GroupFilters;
  for (const k of GROUP_FILTER_KEYS) f[k] = (get(k) ?? "").trim();
  return f;
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Regional groups (Turneul 1) with organiser, dates, gym and teams, filtered and sorted. */
export async function getGroupsListing(f: GroupFilters) {
  const supabase = await createSupabaseServer();
  const [{ data: overview }, { data: hosts }, { data: categories }, { data: members }] = await Promise.all([
    supabase.from("group_overview").select("*").order("category_sort").order("sort_order"),
    supabase
      .from("hosting_proposals")
      .select("group_id, start_date, end_date, team:teams!hosting_proposals_team_id_fkey(name), gym:gyms(name, city)")
      .eq("status", "confirmed"),
    supabase.from("categories").select("id, code").eq("scope", "regional").order("sort_order"),
    supabase.from("group_teams").select("group_id, team:teams(name, club:clubs(name))"),
  ]);

  const all = (overview ?? []).map((g) => {
    const host = (hosts ?? []).find((h) => h.group_id === g.group_id) ?? null;
    const teams = (members ?? [])
      .filter((m) => m.group_id === g.group_id && m.team)
      .map((m) => ({ name: m.team!.name, club: m.team!.club?.name ?? "" }))
      .sort((a, b) => a.name.localeCompare(b.name, "ro"));
    return { ...g, host, teams };
  });

  const cities = [...new Set((hosts ?? []).map((h) => h.gym?.city?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, "ro"),
  );

  const needle = norm(f.q);
  const de = DATE.test(f.de) ? f.de : "";
  const pana = DATE.test(f.pana) ? f.pana : "";

  // everything except the status, so the status chips can show counts for the other filters
  const base = all.filter((g) => {
    if (f.categorie && g.category_code !== f.categorie) return false;
    if (f.regiune === "mixt" ? g.region !== null : f.regiune && g.region !== f.regiune) return false;
    if (f.oras && norm(g.host?.gym?.city) !== norm(f.oras)) return false;
    if (de || pana) {
      if (!g.host) return false;
      if (de && (g.host.end_date ?? g.host.start_date) < de) return false;
      if (pana && g.host.start_date > pana) return false;
    }
    if (needle && !g.teams.some((t) => norm(t.name).includes(needle) || norm(t.club).includes(needle))) return false;
    return true;
  });
  const counts = base.reduce<Record<string, number>>((acc, g) => {
    acc[g.status ?? ""] = (acc[g.status ?? ""] ?? 0) + 1;
    return acc;
  }, {});
  const rows = base.filter((g) => !f.status || g.status === f.status);

  if (f.sort === "data") {
    // earliest tournament first, groups without a date at the end
    rows.sort((a, b) => {
      const da = a.host?.start_date ?? "9999";
      const db = b.host?.start_date ?? "9999";
      return (
        da.localeCompare(db) ||
        (a.category_sort ?? 0) - (b.category_sort ?? 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0)
      );
    });
  }

  return { all, rows, counts, cities, categories: categories ?? [] };
}

export type ListedGroup = Awaited<ReturnType<typeof getGroupsListing>>["rows"][number];

export const regionLabel = (r: string | null) => r ?? "Mixt (SR5 + SR6)";
