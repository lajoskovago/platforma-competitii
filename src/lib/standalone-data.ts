import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { getGyms } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";

export type StandaloneCompetition = "national" | "friendly";

/** Data for the national / friendly game form. */
export async function getStandaloneFormData(user: CurrentUser, competition: StandaloneCompetition) {
  const supabase = await createSupabaseServer();
  let catQuery = supabase.from("categories").select("id, code, name, scope").order("sort_order");
  if (competition === "national") catQuery = catQuery.eq("scope", "national");
  const [{ data: categories }, { data: clubs }, { data: teams }, { data: external }, gyms] = await Promise.all([
    catQuery,
    supabase.from("clubs").select("id, name, region").order("name"),
    supabase.from("teams").select("id, name, club_id, category_id").order("name"),
    supabase.from("external_clubs").select("name").order("name"),
    getGyms(),
  ]);

  return {
    categories: (categories ?? []).map((c) => ({
      id: c.id,
      label:
        competition === "friendly"
          ? `${c.scope === "national" ? "Național" : "Regional"} ${c.code} – ${c.name}`
          : `${c.code} – ${c.name}`,
    })),
    clubs: clubs ?? [],
    teams: teams ?? [],
    externalClubs: (external ?? []).map((e) => e.name as string),
    gyms,
    // coaches / club admins add games only for their own teams
    canAdd: user.isAdmin || user.teamIds.size > 0 || user.managedClubIds.length > 0,
  };
}
