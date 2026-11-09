"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { dbError, str, type ActionState } from "@/lib/action-state";

export async function updateMyProfile(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const fullName = str(fd, "full_name");
  if (!fullName) return { error: "Completați numele." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: str(fd, "phone") || null })
    .eq("id", user.id);
  if (error) return dbError(error);
  refresh();
  return { ok: "Datele au fost salvate." };
}
