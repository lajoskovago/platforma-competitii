"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { str, type ActionState } from "@/lib/action-state";

export async function setPassword(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const password = str(fd, "password");
  const confirm = str(fd, "confirm");
  const fullName = str(fd, "full_name");
  const phone = str(fd, "phone");

  if (password.length < 8) return { error: "Parola trebuie să aibă cel puțin 8 caractere." };
  if (password !== confirm) return { error: "Parolele nu coincid." };
  if (!fullName) return { error: "Completați numele." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: error.message.includes("different") ? "Alegeți o parolă diferită de cea veche." : error.message };

  const { error: pErr } = await supabase
    .from("profiles")
    .update({ full_name: fullName, phone: phone || null })
    .eq("id", user.id);
  if (pErr) return { error: pErr.message };

  redirect("/");
}
