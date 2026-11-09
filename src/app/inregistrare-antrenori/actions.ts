"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { authEmailError, str, type ActionState } from "@/lib/action-state";

/**
 * Public sign-up for coaches and club admins (active immediately).
 * - team selected   -> coach of that team
 * - no team         -> admin of the club
 * The invitation email verifies the address and lets them set a password.
 */
export async function signUpClubMember(_: ActionState, fd: FormData): Promise<ActionState> {
  if (str(fd, "website")) return { ok: "Verificați emailul pentru a vă seta parola." }; // honeypot

  const email = str(fd, "email").toLowerCase();
  const fullName = str(fd, "full_name");
  const phone = str(fd, "phone");
  const clubId = str(fd, "club_id");
  const teamId = str(fd, "team_id");

  if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Completați numele și un email valid." };
  if (!phone) return { error: "Completați numărul de telefon." };
  if (!clubId) return { error: "Alegeți clubul." };

  const admin = createSupabaseAdmin();

  // the team must belong to the selected club
  if (teamId) {
    const { data: team } = await admin.from("teams").select("id").eq("id", teamId).eq("club_id", clubId).maybeSingle();
    if (!team) return { error: "Echipa aleasă nu aparține clubului." };
  } else {
    const { data: club } = await admin.from("clubs").select("id").eq("id", clubId).maybeSingle();
    if (!club) return { error: "Clubul ales nu există." };
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (error) {
    // Do not reveal whether the address already has an account.
    if (error.message.toLowerCase().includes("already")) {
      return {
        ok: "Dacă adresa nu are deja cont, veți primi un email pentru a vă seta parola. Dacă aveți deja cont, cereți administratorului clubului să vă asocieze echipei.",
      };
    }
    console.error("[signup-club] invite failed", error);
    return { error: authEmailError(error) };
  }

  const userId = data.user.id;
  const { error: pErr } = await admin.from("profiles").update({ full_name: fullName, phone }).eq("id", userId);
  const { error: aErr } = teamId
    ? await admin.from("team_coaches").insert({ team_id: teamId, user_id: userId })
    : await admin.from("club_managers").insert({ club_id: clubId, user_id: userId });
  if (pErr || aErr) {
    console.error("[signup-club] association failed", pErr ?? aErr);
    return { error: "Înregistrarea nu a reușit. Încercați din nou mai târziu." };
  }

  return { ok: "Gata! Verificați emailul și apăsați pe link pentru a vă seta parola." };
}
