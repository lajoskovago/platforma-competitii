"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin, createSupabaseMailer, createSupabaseServer } from "@/lib/supabase/server";
import { authEmailError, dbError, str, type ActionState } from "@/lib/action-state";
import { bucharestToISO } from "@/lib/format";

const region = (v: string) => (v === "SR5" || v === "SR6" ? v : null);

// ---------------------------------------------------------------------------
// Clubs, teams, groups (RLS: admin only)
// ---------------------------------------------------------------------------
export async function createClub(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = str(fd, "name");
  if (!name) return { error: "Completați numele clubului." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("clubs")
    .insert({ name, city: str(fd, "city") || null, region: region(str(fd, "region")) });
  if (error) return dbError(error);
  refresh();
  return { ok: `Clubul „${name}” a fost adăugat.` };
}

export async function updateClub(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = str(fd, "name");
  if (!name) return { error: "Completați numele clubului." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("clubs")
    .update({ name, city: str(fd, "city") || null, region: region(str(fd, "region")) })
    .eq("id", str(fd, "club_id"));
  if (error) return dbError(error);
  refresh();
  return { ok: "Salvat." };
}

export async function createTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = str(fd, "name");
  const clubId = str(fd, "club_id");
  const categoryId = str(fd, "category_id");
  const groupId = str(fd, "group_id");
  if (!name || !clubId || !categoryId) return { error: "Completați clubul, categoria și numele echipei." };

  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("teams")
    .insert({ name, club_id: clubId, category_id: categoryId })
    .select("id")
    .single();
  if (error) return dbError(error);

  if (groupId) {
    const { error: gErr } = await supabase.from("group_teams").insert({ group_id: groupId, team_id: data.id });
    if (gErr) return dbError(gErr);
  }
  refresh();
  return { ok: `Echipa „${name}” a fost adăugată.` };
}

export async function updateTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const teamId = str(fd, "team_id");
  const name = str(fd, "name");
  const newGroup = str(fd, "group_id");
  const oldGroup = str(fd, "old_group_id");
  if (!name) return { error: "Numele echipei este obligatoriu." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("teams")
    .update({ name, club_id: str(fd, "club_id") })
    .eq("id", teamId);
  if (error) return dbError(error);

  if (newGroup !== oldGroup) {
    if (oldGroup) {
      const { error: dErr } = await supabase.from("group_teams").delete().eq("group_id", oldGroup).eq("team_id", teamId);
      if (dErr) return dbError(dErr);
    }
    if (newGroup) {
      const { error: iErr } = await supabase.from("group_teams").insert({ group_id: newGroup, team_id: teamId });
      if (iErr) return dbError(iErr);
    }
  }
  refresh();
  return { ok: "Echipa a fost salvată." };
}

export async function deleteTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createSupabaseServer();
  const teamId = str(fd, "team_id");
  const { count } = await supabase
    .from("hosting_proposals")
    .select("id", { count: "exact", head: true })
    .eq("team_id", teamId);
  if (count) return { error: "Echipa are propuneri de organizare și nu poate fi ștearsă. Mutați-o în altă grupă." };
  const { error } = await supabase.from("teams").delete().eq("id", teamId);
  if (error) return dbError(error);
  refresh();
  return { ok: "Echipa a fost ștearsă." };
}

export async function createGroup(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const name = str(fd, "name");
  const categoryId = str(fd, "category_id");
  if (!name || !categoryId) return { error: "Alegeți categoria și numele grupei." };
  const supabase = await createSupabaseServer();
  let { data: tournament } = await supabase
    .from("tournaments")
    .select("id")
    .eq("category_id", categoryId)
    .eq("number", 1)
    .maybeSingle();
  if (!tournament) {
    const { data, error } = await supabase
      .from("tournaments")
      .insert({ category_id: categoryId, number: 1, name: "Turneul 1" })
      .select("id")
      .single();
    if (error) return dbError(error);
    tournament = data;
  }
  const { error } = await supabase.from("groups").insert({
    tournament_id: tournament.id,
    name,
    region: region(str(fd, "region")),
    notes: str(fd, "notes") || null,
    sort_order: 99,
  });
  if (error) return dbError(error);
  refresh();
  return { ok: `Grupa „${name}” a fost creată.` };
}

export async function createCategory(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const code = str(fd, "code").toUpperCase();
  const name = str(fd, "name");
  if (!code || !name) return { error: "Completați codul (ex. U16F) și numele categoriei." };
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase.from("categories").insert({ code, name, sort_order: 50 }).select("id").single();
  if (error) return dbError(error);
  await supabase.from("tournaments").insert({ category_id: data.id, number: 1, name: "Turneul 1" });
  refresh();
  return { ok: `Categoria ${code} a fost creată.` };
}

// ---------------------------------------------------------------------------
// Users (auth admin API needs the secret key -> server only)
// ---------------------------------------------------------------------------
type Role = "master_admin" | "regional_admin" | "user";

/** Reads role / region / official flags from a user form, applying who may set what. */
function readUserFields(fd: FormData, me: Awaited<ReturnType<typeof requireAdmin>>) {
  const roleIn = str(fd, "role");
  const role: Role = me.isMaster && (roleIn === "master_admin" || roleIn === "regional_admin") ? roleIn : "user";
  const isReferee = fd.get("is_referee") === "on";
  const isTableOfficial = fd.get("is_table_official") === "on";
  const regionIn = region(str(fd, "region"));
  // regional admins create people in their own region
  const reg = me.isMaster ? regionIn : (regionIn ?? me.region);
  if (role === "regional_admin" && !reg) return { error: "Alegeți regiunea administratorului regional." };
  if ((isReferee || isTableOfficial) && !reg) return { error: "Alegeți regiunea arbitrului / oficialului." };
  return {
    fields: {
      role,
      region: role === "regional_admin" || isReferee || isTableOfficial ? reg : null,
      is_referee: isReferee,
      is_table_official: isTableOfficial,
    },
  };
}

export async function inviteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const email = str(fd, "email").toLowerCase();
  const fullName = str(fd, "full_name");
  if (!email || !fullName) return { error: "Completați emailul și numele." };
  const parsed = readUserFields(fd, me);
  if (parsed.error) return { error: parsed.error };

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (error) {
    return { error: authEmailError(error) };
  }
  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: fullName, phone: str(fd, "phone") || null, ...parsed.fields })
    .eq("id", data.user.id);
  if (pErr) return dbError(pErr);

  const clubId = str(fd, "club_id");
  if (clubId) await admin.from("club_managers").insert({ club_id: clubId, user_id: data.user.id });

  redirect(`/admin/utilizatori/${data.user.id}`);
}

export async function resendInvite(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const admin = createSupabaseAdmin();
  const email = str(fd, "email");
  const { data } = await admin.auth.admin.getUserById(str(fd, "user_id"));
  // Invited but never logged in -> re-send invitation; otherwise send password reset.
  const neverSignedIn = !data.user?.last_sign_in_at;
  const { error } = neverSignedIn
    ? await admin.auth.admin.inviteUserByEmail(email)
    : await createSupabaseMailer().auth.resetPasswordForEmail(email);
  if (error) return { error: error.message };
  return { ok: neverSignedIn ? "Invitația a fost retrimisă." : "Emailul de resetare a parolei a fost trimis." };
}

export async function updateUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = str(fd, "user_id");
  const parsed = readUserFields(fd, me);
  if (parsed.error) return { error: parsed.error };
  const fields: Partial<NonNullable<typeof parsed.fields>> = { ...parsed.fields };
  if (!me.isMaster) delete fields.role; // only the master admin changes roles (also enforced in the DB)
  if (userId === me.id && me.isMaster && fields.role !== "master_admin") {
    return { error: "Nu vă puteți retrage singur rolul de administrator principal." };
  }
  const supabase = await createSupabaseServer();
  const { data, error } = await supabase
    .from("profiles")
    .update({ full_name: str(fd, "full_name"), phone: str(fd, "phone") || null, ...fields })
    .eq("id", userId)
    .select("id");
  if (error) return dbError(error);
  if (!data?.length) return { error: "Nu aveți drepturi pentru acest utilizator." };
  refresh();
  return { ok: "Utilizatorul a fost salvat." };
}

export async function deleteUser(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  const userId = str(fd, "user_id");
  if (userId === me.id) return { error: "Nu vă puteți șterge propriul cont." };
  const admin = createSupabaseAdmin();
  const { data: target } = await admin.from("profiles").select("role").eq("id", userId).single();
  if (!me.isMaster && target?.role !== "user") return { error: "Doar administratorul principal poate șterge administratori." };
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { error: error.message };
  redirect("/admin/utilizatori");
}

export async function assignTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const teamId = str(fd, "team_id");
  if (!teamId) return { error: "Alegeți echipa." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("team_coaches").insert({ team_id: teamId, user_id: str(fd, "user_id") });
  if (error) return dbError(error);
  refresh();
  return { ok: "Echipa a fost asociată." };
}

export async function unassignTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("team_coaches")
    .delete()
    .eq("team_id", str(fd, "team_id"))
    .eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
  refresh();
  return {};
}

export async function assignClub(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const clubId = str(fd, "club_id");
  if (!clubId) return { error: "Alegeți clubul." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase.from("club_managers").insert({ club_id: clubId, user_id: str(fd, "user_id") });
  if (error) return dbError(error);
  refresh();
  return { ok: "Clubul a fost asociat." };
}

export async function unassignClub(_: ActionState, fd: FormData): Promise<ActionState> {
  await requireAdmin();
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("club_managers")
    .delete()
    .eq("club_id", str(fd, "club_id"))
    .eq("user_id", str(fd, "user_id"));
  if (error) return dbError(error);
  refresh();
  return {};
}

// ---------------------------------------------------------------------------
// Temporary auto-confirmation of hosting proposals (master admin)
// ---------------------------------------------------------------------------
export async function setAutoConfirm(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireAdmin();
  if (!me.isMaster) return { error: "Doar administratorul principal poate schimba această setare." };
  const lastDay = str(fd, "last_day");
  const stop = fd.get("stop") === "1";
  let until: string | null = null;
  if (!stop) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastDay)) return { error: "Alegeți ultima zi." };
    // period ends at 00:00 (Bucharest) of the day after the last included day
    const [y, m, d] = lastDay.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);
    until = bucharestToISO(next, "00:00");
  }
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("app_settings")
    .update({ auto_confirm_until: until, updated_by: me.id, updated_at: new Date().toISOString() })
    .eq("id", true);
  if (error) return dbError(error);
  refresh();
  return { ok: stop ? "Confirmarea automată a fost oprită." : "Perioada de confirmare automată a fost salvată." };
}
