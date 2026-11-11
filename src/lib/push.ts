import "server-only";
import webpush from "web-push";
import { POSITION_LABEL, formatDateTime, type OfficialPosition } from "@/lib/format";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

let configured = false;
function configure() {
  if (configured) return true;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", pub, priv);
  configured = true;
  return true;
}

/**
 * Sends a notification to every device of the given users. Never throws:
 * notifications must not break the action that triggered them.
 * Devices the push service reports as gone (404 / 410) are removed.
 */
export async function sendPush(userIds: string[], payload: PushPayload) {
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!ids.length || !configure()) return;
    const admin = createSupabaseAdmin();
    const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", ids);
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 24 * 3600, urgency: "high" },
          );
          await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) await admin.from("push_subscriptions").delete().eq("id", s.id);
          else console.error("[push] send failed", status, (e as Error).message);
        }
      }),
    );
  } catch (e) {
    console.error("[push] failed", e);
  }
}

type GameInfo = {
  id: string;
  starts_at: string;
  home: string;
  away: string;
  gym?: string | null;
};

/** "CSM Oradea – Știința Cluj · sâm. 21 nov., 18:00 · Arena Oradea" */
function describe(g: GameInfo) {
  return [`${g.home} – ${g.away}`, formatDateTime(g.starts_at), g.gym].filter(Boolean).join(" · ");
}

/** Loads what the notification text needs for a game (team names, gym). */
export async function gameInfo(gameId: string): Promise<GameInfo | null> {
  const admin = createSupabaseAdmin();
  const { data: g } = await admin
    .from("games")
    .select(
      "id, starts_at, home_external, away_external, home_label, away_label, gym:gyms(name, city), home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name)",
    )
    .eq("id", gameId)
    .maybeSingle();
  if (!g) return null;
  return {
    id: g.id,
    starts_at: g.starts_at,
    home: g.home?.name ?? g.home_external ?? g.home_label ?? "?",
    away: g.away?.name ?? g.away_external ?? g.away_label ?? "?",
    gym: g.gym ? `${g.gym.name}, ${g.gym.city}` : null,
  };
}

export async function notifyNominated(userId: string, gameId: string, position: string) {
  const g = await gameInfo(gameId);
  if (!g) return;
  await sendPush([userId], {
    title: "Nominalizare nouă",
    body: `${POSITION_LABEL[position as OfficialPosition]} · ${describe(g)}. Confirmați sau refuzați.`,
    url: `/meci/${gameId}`,
    tag: `nomination-${gameId}-${position}`,
  });
}

export async function notifyNominationCancelled(userId: string, gameId: string, position: string) {
  const g = await gameInfo(gameId);
  if (!g) return;
  await sendPush([userId], {
    title: "Nominalizare anulată",
    body: `Nu mai sunteți nominalizat ca ${POSITION_LABEL[position as OfficialPosition]} · ${describe(g)}.`,
    url: "/nominalizari",
    tag: `nomination-${gameId}-${position}`,
  });
}

/** Officials who accepted a nomination for the game. */
export async function confirmedOfficials(gameIds: string[]) {
  if (!gameIds.length) return [];
  const admin = createSupabaseAdmin();
  const { data } = await admin
    .from("game_officials")
    .select("game_id, user_id, position")
    .in("game_id", gameIds)
    .eq("status", "accepted");
  return data ?? [];
}

export type GameSnapshot = { id: string; starts_at: string; gym_id: string | null };

/** Snapshot of games (time + gym), taken before a change, to detect what moved. */
export async function snapshotGames(filter: { gameIds?: string[]; groupId?: string }): Promise<GameSnapshot[]> {
  const admin = createSupabaseAdmin();
  let q = admin.from("games").select("id, starts_at, gym_id");
  if (filter.gameIds) q = q.in("id", filter.gameIds);
  if (filter.groupId) q = q.eq("group_id", filter.groupId);
  const { data } = await q;
  return data ?? [];
}

/** Compares with the snapshot and tells confirmed officials about changed date / time / gym. */
export async function notifyGameChanges(before: GameSnapshot[]) {
  if (!before.length) return;
  const after = await snapshotGames({ gameIds: before.map((b) => b.id) });
  const changed = after.filter((a) => {
    const b = before.find((x) => x.id === a.id);
    return b && (new Date(b.starts_at).getTime() !== new Date(a.starts_at).getTime() || b.gym_id !== a.gym_id);
  });
  if (!changed.length) return;
  const officials = await confirmedOfficials(changed.map((c) => c.id));
  for (const c of changed) {
    const people = officials.filter((o) => o.game_id === c.id).map((o) => o.user_id);
    if (!people.length) continue;
    const g = await gameInfo(c.id);
    if (!g) continue;
    await sendPush(people, {
      title: "Meci modificat",
      body: `S-a schimbat data, ora sau sala: ${describe(g)}.`,
      url: `/meci/${c.id}`,
      tag: `game-change-${c.id}`,
    });
  }
}

/**
 * Before deleting games: prepare the "nomination cancelled" messages for everyone
 * nominated (pending or accepted). Call the returned function only once the delete
 * succeeded – afterwards the game data is gone.
 */
export async function prepareGameCancellation(gameIds: string[]): Promise<() => Promise<void>> {
  if (!gameIds.length) return async () => {};
  const admin = createSupabaseAdmin();
  const { data: noms } = await admin
    .from("game_officials")
    .select("game_id, user_id, position, status")
    .in("game_id", gameIds)
    .neq("status", "rejected");
  const messages: { userId: string; payload: PushPayload }[] = [];
  for (const n of noms ?? []) {
    const g = await gameInfo(n.game_id);
    if (!g) continue;
    messages.push({
      userId: n.user_id,
      payload: {
        title: "Meci anulat",
        body: `Meciul a fost șters, nominalizarea ca ${POSITION_LABEL[n.position as OfficialPosition]} nu mai este valabilă · ${describe(g)}.`,
        url: "/nominalizari",
        tag: `nomination-${n.game_id}-${n.position}`,
      },
    });
  }
  return async () => {
    for (const m of messages) await sendPush([m.userId], m.payload);
  };
}
