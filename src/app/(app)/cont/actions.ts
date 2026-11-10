"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { dbError, str, type ActionState } from "@/lib/action-state";
import { readSkills } from "@/lib/format";

export async function updateMyProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const fullName = str(fd, "full_name");
  if (!fullName) return { error: "Completați numele." };
  const supabase = await createSupabaseServer();
  const city = str(fd, "city");
  if (user.isOfficial && !city) return { error: "Completați orașul." };
  const official: { city?: string; table_skills?: string[] } = user.isOfficial
    ? { city, ...(user.isTableOfficial ? { table_skills: readSkills(fd) } : {}) }
    : {};
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: str(fd, "phone") || null, ...official })
    .eq("id", user.id);
  if (error) return dbError(error);
  refresh();
  return { ok: "Datele au fost salvate." };
}
