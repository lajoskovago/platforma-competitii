"use server";

import { redirect } from "next/navigation";
import { createSupabaseMailer, createSupabaseServer } from "@/lib/supabase/server";
import { str, type ActionState } from "@/lib/action-state";

export async function signIn(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  const password = str(fd, "password");
  if (!email || !password) return { error: "Completați emailul și parola." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: "Email sau parolă incorecte." };
  redirect("/");
}

export async function requestPasswordReset(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = str(fd, "email");
  if (!email) return { error: "Completați emailul." };
  // The email template builds the link (see supabase/templates/recovery.html).
  const { error } = await createSupabaseMailer().auth.resetPasswordForEmail(email);
  // Never reveal to the visitor whether the account exists, but log failures for admins (Render logs).
  if (error) console.error("[password-reset] failed", email, error.status, error.message);
  // Same answer whether or not the account exists.
  return { ok: "Dacă adresa are cont, veți primi un email cu linkul de resetare." };
}

export async function signOut() {
  const supabase = await createSupabaseServer();
  await supabase.auth.signOut();
  redirect("/login");
}
