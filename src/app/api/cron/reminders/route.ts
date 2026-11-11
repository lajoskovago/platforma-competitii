import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { POSITION_LABEL, bucharestToISO, isoToBucharest, type OfficialPosition } from "@/lib/format";
import { gameInfo, sendPush } from "@/lib/push";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const runtime = "nodejs";

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const given = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || !given || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

/**
 * Day-before reminder for confirmed referees / table officials.
 * Called once a day by the scheduled GitHub Action (Authorization: Bearer CRON_SECRET).
 * Each nomination is reminded once (game_officials.reminder_sent_at).
 */
export async function POST(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  // "tomorrow" in Romania
  const today = isoToBucharest(new Date().toISOString()).date;
  const [y, m, d] = today.split("-").map(Number);
  const tomorrow = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  const admin = createSupabaseAdmin();
  const { data: games } = await admin
    .from("games")
    .select("id")
    .gte("starts_at", bucharestToISO(tomorrow, "00:00"))
    .lte("starts_at", bucharestToISO(tomorrow, "23:59"));
  const gameIds = (games ?? []).map((g) => g.id);
  if (!gameIds.length) return NextResponse.json({ date: tomorrow, games: 0, sent: 0 });

  const { data: noms } = await admin
    .from("game_officials")
    .select("id, game_id, user_id, position")
    .in("game_id", gameIds)
    .eq("status", "accepted")
    .is("reminder_sent_at", null);

  let sent = 0;
  for (const n of noms ?? []) {
    const g = await gameInfo(n.game_id);
    if (!g) continue;
    await sendPush([n.user_id], {
      title: "Mâine aveți meci",
      body: `${POSITION_LABEL[n.position as OfficialPosition]} · ${g.home} – ${g.away} · ora ${isoToBucharest(g.starts_at).time}${g.gym ? ` · ${g.gym}` : ""}`,
      url: `/meci/${n.game_id}`,
      tag: `reminder-${n.game_id}`,
    });
    await admin.from("game_officials").update({ reminder_sent_at: new Date().toISOString() }).eq("id", n.id);
    sent++;
  }
  return NextResponse.json({ date: tomorrow, games: gameIds.length, sent });
}
