export type ActionState = { error?: string; ok?: string };

/** Turn a Supabase/Postgres error into a message for the user. */
export function dbError(error: { message: string; code?: string } | null | undefined): ActionState {
  if (!error) return {};
  if (error.code === "23505") return { error: "Există deja o înregistrare cu aceste date." };
  if (error.code === "42501") return { error: "Nu aveți drepturi pentru această acțiune." };
  return { error: error.message };
}

export function str(fd: FormData, key: string) {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}

/** Message for Supabase Auth errors when sending invitation / reset emails. */
export function authEmailError(error: { message: string; status?: number; code?: string }) {
  const m = error.message.toLowerCase();
  if (error.code === "over_email_send_rate_limit" || error.status === 429 || m.includes("rate limit")) {
    return "S-au trimis prea multe emailuri într-un timp scurt. Încercați din nou peste câteva minute.";
  }
  if (m.includes("already")) return "Există deja un cont cu acest email.";
  if (m.includes("smtp") || m.includes("sending") || m.includes("email")) {
    return "Emailul nu a putut fi trimis. Verificați adresa sau contactați administratorul.";
  }
  return error.message;
}
