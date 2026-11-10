"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { authEmailError, str, type ActionState } from "@/lib/action-state";
import { readSkills } from "@/lib/format";

/**
 * Public sign-up for referees / table officials. The account is active
 * immediately; the email invitation verifies the address and lets them set a
 * password (same flow as invited coaches).
 */
export async function signUpOfficial(_: ActionState, fd: FormData): Promise<ActionState> {
  // honeypot against bots
  if (str(fd, "website")) return { ok: "Verificați emailul pentru a vă seta parola." };

  const email = str(fd, "email").toLowerCase();
  const fullName = str(fd, "full_name");
  const phone = str(fd, "phone");
  const region = str(fd, "region");
  const isReferee = fd.get("is_referee") === "on";
  const isTableOfficial = fd.get("is_table_official") === "on";
  const city = str(fd, "city");
  const skills = isTableOfficial ? readSkills(fd) : [];

  if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Completați numele și un email valid." };
  if (!phone) return { error: "Completați numărul de telefon." };
  if (region !== "SR5" && region !== "SR6") return { error: "Alegeți regiunea." };
  if (!isReferee && !isTableOfficial) return { error: "Bifați cel puțin un rol: arbitru sau oficial de masă." };
  if (!city) return { error: "Completați orașul." };
  if (isTableOfficial && skills.length === 0) return { error: "Bifați ce puteți face ca oficial de masă." };

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (error) {
    // Do not reveal whether the address already has an account.
    if (error.message.toLowerCase().includes("already")) {
      return { ok: "Dacă adresa nu are deja cont, veți primi un email pentru a vă seta parola." };
    }
    console.error("[signup-official] invite failed", error);
    return { error: authEmailError(error) };
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({
      full_name: fullName,
      phone,
      region,
      city,
      table_skills: skills,
      is_referee: isReferee,
      is_table_official: isTableOfficial,
    })
    .eq("id", data.user.id);
  if (pErr) {
    console.error("[signup-official] profile update failed", pErr);
    return { error: "Înregistrarea nu a reușit. Încercați din nou mai târziu." };
  }

  return { ok: "Gata! Verificați emailul și apăsați pe link pentru a vă seta parola." };
}
