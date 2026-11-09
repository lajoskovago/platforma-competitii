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

  // New club (e.g. playing only in the national championship) -> the person becomes its admin
  const newClub = clubId === "new";
  const newClubName = str(fd, "new_club_name");
  const newClubCity = str(fd, "new_club_city");
  const newClubRegion = str(fd, "new_club_region");
  if (newClub) {
    if (newClubName.length < 3) return { error: "Completați numele clubului." };
    if (!newClubCity) return { error: "Completați orașul clubului." };
    if (newClubRegion !== "SR5" && newClubRegion !== "SR6") return { error: "Alegeți regiunea clubului." };
    const { data: existing } = await admin.from("clubs").select("id").ilike("name", newClubName).maybeSingle();
    if (existing) return { error: "Clubul există deja în listă – alegeți-l din lista de cluburi." };
  } else if (teamId) {
    // the team must belong to the selected club
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

  let managedClubId = clubId;
  if (newClub) {
    const { data: club, error: cErr } = await admin
      .from("clubs")
      .insert({ name: newClubName, city: newClubCity, region: newClubRegion as "SR5" | "SR6" })
      .select("id")
      .single();
    if (cErr || !club) {
      console.error("[signup-club] club create failed", cErr);
      return { error: "Clubul nu a putut fi creat. Contactați administratorul regiunii." };
    }
    managedClubId = club.id;
  }

  const { error: aErr } =
    teamId && !newClub
      ? await admin.from("team_coaches").insert({ team_id: teamId, user_id: userId })
      : await admin.from("club_managers").insert({ club_id: managedClubId, user_id: userId });
  if (pErr || aErr) {
    console.error("[signup-club] association failed", pErr ?? aErr);
    return { error: "Înregistrarea nu a reușit. Încercați din nou mai târziu." };
  }

  return {
    ok: newClub
      ? "Gata! Clubul a fost creat. Verificați emailul pentru a vă seta parola, apoi adăugați echipele clubului din „Clubul meu”."
      : "Gata! Verificați emailul și apăsați pe link pentru a vă seta parola.",
  };
}
