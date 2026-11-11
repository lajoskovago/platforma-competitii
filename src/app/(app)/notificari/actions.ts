"use server";

import { requireUser } from "@/lib/auth";
import { sendPush } from "@/lib/push";
import { createSupabaseServer } from "@/lib/supabase/server";

type SubscriptionJSON = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

/** Saves this device's push subscription for the logged-in user. */
export async function savePushSubscription(sub: SubscriptionJSON, userAgent: string) {
  const user = await requireUser();
  if (!user.isOfficial) return { error: "Notificările sunt disponibile doar pentru arbitri și oficiali de masă." };
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) return { error: "Abonare invalidă." };
  const supabase = await createSupabaseServer();
  // same browser re-subscribing (or another account on it): replace
  await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  const { error } = await supabase.from("push_subscriptions").insert({
    user_id: user.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: userAgent.slice(0, 300),
  });
  if (error) return { error: error.message };
  return { ok: true };
}

export async function deletePushSubscription(endpoint: string) {
  await requireUser();
  const supabase = await createSupabaseServer();
  await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint);
  return { ok: true };
}

export async function sendTestPush() {
  const user = await requireUser();
  if (!user.isOfficial) return { error: "Notificările sunt disponibile doar pentru arbitri și oficiali de masă." };
  await sendPush([user.id], {
    title: "Notificările funcționează ✅",
    body: "Veți primi aici nominalizările, modificările de meci și reamintirile.",
    url: "/nominalizari",
    tag: "test",
  });
  return { ok: true };
}
