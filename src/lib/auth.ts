import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

export type Region = Database["public"]["Enums"]["region"];
export type Role = Database["public"]["Enums"]["user_role"];

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  phone: string | null;
  role: Role;
  region: Region | null;
  isMaster: boolean;
  isRegionalAdmin: boolean;
  /** master or regional admin */
  isAdmin: boolean;
  isReferee: boolean;
  isTableOfficial: boolean;
  isOfficial: boolean;
  /** delegated by the master admin to nominate referees / officials in their region */
  canNominate: boolean;
  city: string | null;
  /** table official skills (see TABLE_SKILLS) */
  tableSkills: string[];
  /** clubs this user administers */
  managedClubIds: string[];
  /** teams this user coaches or manages through a club */
  teamIds: Set<string>;
};

/** The logged-in user with profile and assignments, or null. Cached per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createSupabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const [{ data: profile }, { data: clubs }, { data: teamIds }] = await Promise.all([
    supabase
      .from("profiles")
      .select("email, full_name, phone, role, region, is_referee, is_table_official, can_nominate, city, table_skills")
      .eq("id", auth.user.id)
      .single(),
    supabase.from("club_managers").select("club_id").eq("user_id", auth.user.id),
    supabase.rpc("my_team_ids"),
  ]);

  const role: Role = profile?.role ?? "user";
  const isReferee = !!profile?.is_referee;
  const isTableOfficial = !!profile?.is_table_official;
  return {
    id: auth.user.id,
    email: profile?.email ?? auth.user.email ?? "",
    fullName: profile?.full_name ?? "",
    phone: profile?.phone ?? null,
    role,
    region: profile?.region ?? null,
    isMaster: role === "master_admin",
    isRegionalAdmin: role === "regional_admin",
    isAdmin: role === "master_admin" || role === "regional_admin",
    isReferee,
    isTableOfficial,
    isOfficial: isReferee || isTableOfficial,
    canNominate: !!profile?.can_nominate,
    city: profile?.city ?? null,
    tableSkills: profile?.table_skills ?? [],
    managedClubIds: (clubs ?? []).map((c) => c.club_id),
    teamIds: new Set((teamIds as unknown as string[] | null) ?? []),
  };
});

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** Master or regional admin */
export async function requireAdmin() {
  const user = await requireUser();
  if (!user.isAdmin) redirect("/");
  return user;
}

export async function requireMaster() {
  const user = await requireUser();
  if (!user.isMaster) redirect("/");
  return user;
}

/** Mirrors public.can_admin_region(): null region = mixed group, both regional admins. */
export function canAdminRegion(user: CurrentUser, region: Region | null | undefined) {
  if (user.isMaster) return true;
  return user.isRegionalAdmin && (region == null || region === user.region);
}

/** Mirrors public.can_nominate_region(): admins of the region, or a nomination delegate of that region. */
export function canNominateRegion(user: CurrentUser, region: Region | null | undefined) {
  if (canAdminRegion(user, region)) return true;
  return user.canNominate && (region == null || region === user.region);
}

/** Anyone who nominates somewhere (admins, delegates). */
export function isNominator(user: CurrentUser) {
  return user.isAdmin || user.canNominate;
}

/**
 * Acting for a team (volunteer to organise, answer proposals, edit own proposal):
 * only as its coach or club admin. Admins choose the organiser instead
 * (confirm a proposal / assign a team), see canAdminRegion().
 */
export function canActForTeam(user: CurrentUser, team: { id: string } | null | undefined) {
  return !!team && user.teamIds.has(team.id);
}

export const ROLE_LABEL: Record<Role, string> = {
  master_admin: "Administrator principal",
  regional_admin: "Administrator regional",
  user: "Utilizator",
};
