import "server-only";
import webpush from "web-push";
import { POSITION_LABEL, formatDateTime, type OfficialPosition } from "@/lib/format";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export type PushPayload = { title: string; body: string; url: string; tag?: string };

/**
 * Tolerates common copy/paste mistakes in the dashboard: surrounding quotes or
 * spaces, the "NAME=" prefix, base64 padding ("="), standard instead of URL-safe base64.
 */
export function cleanKey(raw: string | undefined, name: string) {
  if (!raw) return "";
  let v = raw.trim().replace(/^['"]|['"]$/g, "").trim();
  if (v.startsWith(`${name}=`)) v = v.slice(name.length + 1).trim();
  return v.replace(/\s+/g, "").replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

let configured = false;
function configure() {
  if (configured) return true;
  const pub = cleanKey(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY, "NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  const priv = cleanKey(process.env.VAPID_PRIVATE_KEY, "VAPID_PRIVATE_KEY");
  if (!pub || !priv) return false;
  const subject = (process.env.VAPID_SUBJECT || "").trim().replace(/^['"]|['"]$/g, "").replace(/^VAPID_SUBJECT=/, "");
  try {
    webpush.setVapidDetails(subject.startsWith("mailto:") || subject.startsWith("https://") ? subject : "mailto:admin@example.com", pub, priv);
  } catch (e) {
    console.error("[push] invalid VAPID configuration:", (e as Error).message, `(private key length ${priv.length}, expected 43)`);
    return false;
  }
  configured = true;
  return true;
}

export type PushResult = { configured: boolean; devices: number; delivered: number; failed: string[] };

/**
 * Sends a notification to every device of the given users. Never throws:
 * notifications must not break the action that triggered them.
 * Devices the push service reports as gone (404 / 410) are removed.
 */
export async function sendPush(userIds: string[], payload: PushPayload): Promise<PushResult> {
  const result: PushResult = { configured: false, devices: 0, delivered: 0, failed: [] };
  try {
    const ids = [...new Set(userIds.filter(Boolean))];
    if (!configure()) {
      console.error("[push] VAPID keys missing on the server (NEXT_PUBLIC_VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY)");
      return result;
    }
    result.configured = true;
    if (!ids.length) return result;
    const admin = createSupabaseAdmin();
    const { data: subs } = await admin.from("push_subscriptions").select("*").in("user_id", ids);
    result.devices = subs?.length ?? 0;
    await Promise.all(
      (subs ?? []).map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            JSON.stringify(payload),
            { TTL: 24 * 3600, urgency: "high" },
          );
          result.delivered++;
          await admin.from("push_subscriptions").update({ last_used_at: new Date().toISOString() }).eq("id", s.id);
        } catch (e) {
          const err = e as { statusCode?: number; body?: string; message?: string };
          const host = new URL(s.endpoint).host;
          result.failed.push(`${host}: ${err.statusCode ?? ""} ${(err.body || err.message || "").slice(0, 120)}`.trim());
          if (err.statusCode === 404 || err.statusCode === 410) {
            await admin.from("push_subscriptions").delete().eq("id", s.id);
          } else {
            console.error("[push] send failed", host, err.statusCode, err.body || err.message);
          }
        }
      }),
    );
  } catch (e) {
    console.error("[push] failed", e);
  }
  return result;
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
