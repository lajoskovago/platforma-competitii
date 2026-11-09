import "server-only";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/**
 * Email notifications for group events.
 *
 * TODO: the sender account / provider is not decided yet. Until then this only
 * collects the recipients and logs the message on the server. Plug the email
 * provider in `send()` below.
 */
export async function notifyGroup(groupId: string, subject: string, text: string, exceptUserId?: string) {
  try {
    const admin = createSupabaseAdmin();
    const { data: gt } = await admin.from("group_teams").select("team_id, team:teams(club_id)").eq("group_id", groupId);
    const teamIds = (gt ?? []).map((r) => r.team_id);
    const clubIds = [...new Set((gt ?? []).map((r) => r.team?.club_id).filter(Boolean))] as string[];
    if (!teamIds.length) return;

    const [{ data: coaches }, { data: managers }] = await Promise.all([
      admin.from("team_coaches").select("profile:profiles(id, email)").in("team_id", teamIds),
      clubIds.length
        ? admin.from("club_managers").select("profile:profiles(id, email)").in("club_id", clubIds)
        : Promise.resolve({ data: [] }),
    ]);

    const recipients = new Map<string, string>();
    for (const r of [...(coaches ?? []), ...(managers ?? [])]) {
      if (r.profile && r.profile.id !== exceptUserId) recipients.set(r.profile.id, r.profile.email);
    }
    await send([...recipients.values()], subject, text);
  } catch (e) {
    // Notifications must never break the main action.
    console.error("[notify] failed", e);
  }
}

/** Notify specific users (e.g. a referee who was nominated). */
export async function notifyUsers(userIds: string[], subject: string, text: string) {
  try {
    if (!userIds.length) return;
    const admin = createSupabaseAdmin();
    const { data } = await admin.from("profiles").select("email").in("id", userIds);
    await send((data ?? []).map((p) => p.email), subject, text);
  } catch (e) {
    console.error("[notify] failed", e);
  }
}

async function send(to: string[], subject: string, text: string) {
  if (!to.length) return;
  console.info(`[notify] (not sent – no email provider yet) to=${to.join(", ")} subject="${subject}"\n${text}`);
}
