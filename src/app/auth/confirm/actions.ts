"use server";

import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { str, type ActionState } from "@/lib/action-state";
import { APP_HOME } from "@/lib/brand";

const TYPES: EmailOtpType[] = ["invite", "recovery", "email", "magiclink", "signup", "email_change"];

/**
 * Verifies the one-time token from an invitation / password-reset email.
 * Runs only when the person presses the button (POST), so email security
 * scanners that open links automatically (GET) do not use up the token.
 */
export async function confirmEmailLink(_: ActionState, fd: FormData): Promise<ActionState> {
  const tokenHash = str(fd, "token_hash");
  const type = str(fd, "type") as EmailOtpType;
  const nextParam = str(fd, "next") || APP_HOME;
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : APP_HOME;
  if (!tokenHash || !TYPES.includes(type)) return { error: "Link invalid." };

  const supabase = await createSupabaseServer();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) {
    console.error("[auth/confirm] verifyOtp failed", type, error.status, error.message);
    return {
      error: "Linkul a expirat sau a fost deja folosit. Cereți un link nou din „Am uitat parola”.",
    };
  }
  redirect(next);
}
