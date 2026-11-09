"use server";

import { createSupabaseAdmin } from "@/lib/supabase/server";
import { str, type ActionState } from "@/lib/action-state";

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

  if (!fullName || !/^\S+@\S+\.\S+$/.test(email)) return { error: "Completați numele și un email valid." };
  if (!phone) return { error: "Completați numărul de telefon." };
  if (region !== "SR5" && region !== "SR6") return { error: "Alegeți regiunea." };
  if (!isReferee && !isTableOfficial) return { error: "Bifați cel puțin un rol: arbitru sau oficial de masă." };

  const admin = createSupabaseAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { data: { full_name: fullName } });
  if (error) {
    // Do not reveal whether the address already has an account.
    if (error.message.toLowerCase().includes("already")) {
      return { ok: "Dacă adresa nu are deja cont, veți primi un email pentru a vă seta parola." };
    }
    return { error: "Înregistrarea nu a reușit. Încercați din nou mai târziu." };
  }

  const { error: pErr } = await admin
    .from("profiles")
    .update({ full_name: fullName, phone, region, is_referee: isReferee, is_table_official: isTableOfficial })
    .eq("id", data.user.id);
  if (pErr) return { error: "Înregistrarea nu a reușit. Încercați din nou mai târziu." };

  return { ok: "Gata! Verificați emailul și apăsați pe link pentru a vă seta parola." };
}
