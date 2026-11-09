"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { authEmailError, dbError, str, type ActionState } from "@/lib/action-state";

/** The team must belong to a club the current user administers. */
async function ensureClubTeam(teamId: string) {
  const user = await requireUser();
  const supabase = await createSupabaseServer();
  const { data: team } = await supabase.from("teams").select("id, club_id").eq("id", teamId).maybeSingle();
  if (!team || !user.managedClubIds.includes(team.club_id)) return null;
  return { user, supabase, team };
}

/** Club admin: invite a coach (or assign an existing one) to one of the club's teams. */
export async function inviteCoach(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await ensureClubTeam(str(fd, "team_id"));
  if (!ctx) return { error: "Echipa nu aparține clubului dvs." };
  const email = str(fd, "email").toLowerCase();
  const fullName = str(fd, "full_name");
  if (!/^\S+@\S+\.\S+$/.test(email)) return { error: "Completați un email valid." };

  const admin = createSupabaseAdmin();
  const { data: existing } = await admin
    .from("profiles")
    .select("id, role, is_referee, is_table_official")
    .eq("email", email)
    .maybeSingle();

  let userId = existing?.id;
  if (existing) {
    if (existing.is_referee || existing.is_table_official) {
      return { error: "Această adresă aparține unui arbitru / oficial și nu poate fi antrenor." };
    }
  } else {
    if (!fullName) return { error: "Completați numele antrenorului." };
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
    if (error) return { error: authEmailError(error) };
    userId = data.user.id;
    await admin.from("profiles").update({ full_name: fullName, phone: str(fd, "phone") || null }).eq("id", userId);
  }

  // insert as the club admin (RLS: club_admin_insert_coach)
  const { error } = await ctx.supabase.from("team_coaches").insert({ team_id: ctx.team.id, user_id: userId! });
  if (error) {
    if (error.code === "23505") return { error: "Antrenorul este deja asociat acestei echipe." };
    return dbError(error);
  }
  refresh();
  return { ok: existing ? "Antrenorul existent a fost asociat echipei." : "Invitația a fost trimisă și antrenorul a fost asociat." };
}

export async function removeCoach(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await ensureClubTeam(str(fd, "team_id"));
  if (!ctx) return { error: "Echipa nu aparține clubului dvs." };
  const { error } = await ctx.supabase
    .from("team_coaches")
    .delete()
    .eq("team_id", ctx.team.id)
    .eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
  refresh();
  return {};
}

/** Club admin: add a team in the NATIONAL championship (RLS: own club, national category). */
export async function createNationalTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const clubId = str(fd, "club_id");
  const categoryId = str(fd, "category_id");
  const name = str(fd, "name");
  if (!user.managedClubIds.includes(clubId)) return { error: "Nu sunteți administratorul acestui club." };
  if (!categoryId || !name) return { error: "Alegeți categoria și numele echipei." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("teams").insert({ club_id: clubId, category_id: categoryId, name });
  if (error) {
    if (error.code === "23505") return { error: "Există deja o echipă cu acest nume în această categorie." };
    return dbError(error);
  }
  refresh();
  return { ok: `Echipa „${name}” a fost adăugată.` };
}

/** Club admin: delete a national team that has no games yet. */
export async function deleteNationalTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireUser();
  const teamId = str(fd, "team_id");
  const supabase = await createSupabaseServer();
  const { count } = await supabase
    .from("games")
    .select("id", { count: "exact", head: true })
    .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`);
  if (count) return { error: "Echipa are meciuri și nu poate fi ștearsă." };
  const { data, error } = await supabase.from("teams").delete().eq("id", teamId).select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu puteți șterge această echipă." };
  refresh();
  return {};
}
