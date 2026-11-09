"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { str, type ActionState } from "@/lib/action-state";
import { IMP_ADMIN_TOKEN, IMP_LOG_ID, impCookieOptions } from "@/lib/impersonation";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";

/** Master admin: log in as another user for support. */
export async function startImpersonation(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  if (!me.isMaster) return { error: "Doar administratorul principal poate intra în contul altui utilizator." };
  const jar = await cookies();
  if (jar.get(IMP_ADMIN_TOKEN)?.value) return { error: "Sunteți deja conectat în contul altui utilizator." };

  const admin = createSupabaseAdmin();
  const { data: target } = await admin
    .from("profiles")
    .select("id, email, role")
    .eq("id", str(fd, "user_id"))
    .maybeSingle();
  if (!target) return { error: "Utilizator inexistent." };
  if (target.id === me.id) return { error: "Acesta este contul dvs." };
  if (target.role === "master_admin") return { error: "Nu se poate intra în contul unui administrator principal." };

  const supabase = await createSupabaseServer();
  const { data: own } = await supabase.auth.getSession();
  if (!own.session?.refresh_token) return { error: "Sesiunea dvs. a expirat. Autentificați-vă din nou." };

  // One-time login token for the target (no email is sent)
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({ type: "magiclink", email: target.email });
  if (linkErr || !link.properties?.hashed_token) {
    console.error("[impersonation] generateLink failed", linkErr);
    return { error: "Nu s-a putut intra în cont." };
  }

  const { data: log } = await admin
    .from("impersonation_log")
    .insert({ admin_id: me.id, target_id: target.id, admin_email: me.email, target_email: target.email })
    .select("id")
    .single();

  const { error: vErr } = await supabase.auth.verifyOtp({ type: "magiclink", token_hash: link.properties.hashed_token });
  if (vErr) {
    console.error("[impersonation] verifyOtp failed", vErr);
    return { error: "Nu s-a putut intra în cont." };
  }

  jar.set(IMP_ADMIN_TOKEN, own.session.refresh_token, impCookieOptions);
  if (log) jar.set(IMP_LOG_ID, log.id, impCookieOptions);
  redirect("/");
}

/** Leave the impersonated account and restore the admin's own session. */
export async function stopImpersonation() {
  const jar = await cookies();
  const adminToken = jar.get(IMP_ADMIN_TOKEN)?.value;
  const logId = jar.get(IMP_LOG_ID)?.value;
  jar.delete(IMP_ADMIN_TOKEN);
  jar.delete(IMP_LOG_ID);

  if (logId) {
    await createSupabaseAdmin().from("impersonation_log").update({ ended_at: new Date().toISOString() }).eq("id", logId);
  }

  const supabase = await createSupabaseServer();
  await supabase.auth.signOut({ scope: "local" }); // ends only the impersonated session
  if (!adminToken) redirect("/login");

  const { error } = await supabase.auth.refreshSession({ refresh_token: adminToken });
  if (error) {
    console.error("[impersonation] could not restore admin session", error.message);
    redirect("/login");
  }
  redirect("/admin/utilizatori");
}
