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
