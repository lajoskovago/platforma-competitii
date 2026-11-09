import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { getGyms } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";

/** Data for the national game form, limited to the teams the user may enter games for. */
export async function getNationalFormData(user: CurrentUser) {
  const supabase = await createSupabaseServer();
  const [{ data: categories }, { data: teams }, { data: external }, gyms] = await Promise.all([
    supabase.from("categories").select("id, code, name").eq("scope", "national").order("sort_order"),
    supabase
      .from("teams")
      .select("id, name, category_id, club:clubs!inner(region), category:categories!inner(scope)")
      .eq("category.scope", "national")
      .order("name"),
    supabase.from("external_clubs").select("name").order("name"),
    getGyms(),
  ]);

  // Any of our national teams can be picked; the server (and RLS) require
  // coaches / club admins to have their own team on one side.
  const own = (teams ?? []).filter((t) => user.teamIds.has(t.id));
  return {
    categories: categories ?? [],
    teams: (teams ?? []).map((t) => ({ id: t.id, name: t.name, category_id: t.category_id })),
    externalClubs: (external ?? []).map((e) => e.name as string),
    gyms,
    canAdd: user.isAdmin || own.length > 0,
  };
}
