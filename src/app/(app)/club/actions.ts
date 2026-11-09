"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import { dbError, str, type ActionState } from "@/lib/action-state";

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
    if (error) return { error: error.message };
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
