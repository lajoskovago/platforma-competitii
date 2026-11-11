"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { dbError, str, type ActionState } from "@/lib/action-state";
import { POSITION_LABEL, isoToBucharest, type OfficialPosition } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** "12,5" / "12.5" / "" -> number | null */
function money(v: string): number | null | "invalid" {
  const t = v.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : "invalid";
}

async function master() {
  const user = await requireUser();
  if (!user.isMaster) return null;
  return { user, supabase: await createSupabaseServer() };
}

export async function saveRates(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await master();
  if (!ctx) return { error: "Doar administratorul principal modifică tarifele." };
  const categoryIds = fd.getAll("category_id").map(String).filter(Boolean);
  if (!categoryIds.length) return { error: "Alegeți categoria." };
  const upserts: { category_id: string; position: OfficialPosition; amount: number }[] = [];
  const deletes: OfficialPosition[] = [];
  for (const pos of Object.keys(POSITION_LABEL) as OfficialPosition[]) {
    const m = money(str(fd, `rate_${pos}`));
    if (m === "invalid") return { error: `Suma pentru ${POSITION_LABEL[pos]} nu este validă.` };
    if (m === null) deletes.push(pos);
    else upserts.push(...categoryIds.map((category_id) => ({ category_id, position: pos, amount: m })));
  }
  if (upserts.length) {
    const { error } = await ctx.supabase.from("fee_rates").upsert(upserts.map((u) => ({ ...u, updated_at: new Date().toISOString() })));
    if (error) return dbError(error);
  }
  if (deletes.length) {
    const { error } = await ctx.supabase.from("fee_rates").delete().in("category_id", categoryIds).in("position", deletes);
    if (error) return dbError(error);
  }
  refresh();
  return { ok: categoryIds.length > 1 ? `Tarifele au fost salvate pentru ${categoryIds.length} categorii.` : "Tarifele au fost salvate." };
}

export async function saveGameCharge(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await master();
  if (!ctx) return { error: "Doar administratorul principal." };
  const gameId = str(fd, "game_id");
  const payerIn = str(fd, "payer");
  const payer = payerIn === "home" || payerIn === "both" ? payerIn : null;
  const home = money(str(fd, "home_amount"));
  const away = money(str(fd, "away_amount"));
  if (home === "invalid" || away === "invalid") return { error: "Suma nu este validă." };
  const { error } = await ctx.supabase.from("game_charges").upsert({
    game_id: gameId,
    payer,
    home_amount: home,
    away_amount: payer === "home" ? null : away,
    updated_at: new Date().toISOString(),
  });
  if (error) return dbError(error);
  // officials' individual amounts
  for (const [k, v] of fd.entries()) {
    if (!k.startsWith("fee_")) continue;
    const m = money(String(v));
    if (m === "invalid") return { error: "O sumă pentru un oficial nu este validă." };
    const { error: fErr } = await ctx.supabase.from("game_officials").update({ fee_override: m }).eq("id", k.slice(4));
    if (fErr) return dbError(fErr);
  }
  refresh();
  return { ok: "Salvat." };
}

/** Team paid (or undo) its share for a game. */
export async function setTeamPaid(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await master();
  if (!ctx) return { error: "Doar administratorul principal." };
  const gameId = str(fd, "game_id");
  const side = str(fd, "side") === "away" ? "away" : "home";
  const undo = str(fd, "undo") === "1";
  const date = str(fd, "paid_on") || isoToBucharest(new Date().toISOString()).date;
  if (!undo && !DATE.test(date)) return { error: "Data nu este validă." };
  const values =
    side === "home"
      ? { home_paid_on: undo ? null : date, home_paid_note: undo ? null : str(fd, "note") || null }
      : { away_paid_on: undo ? null : date, away_paid_note: undo ? null : str(fd, "note") || null };
  const { data: existing } = await ctx.supabase.from("game_charges").select("game_id").eq("game_id", gameId).maybeSingle();
  const { error } = existing
    ? await ctx.supabase.from("game_charges").update({ ...values, updated_at: new Date().toISOString() }).eq("game_id", gameId)
    : await ctx.supabase.from("game_charges").insert({ game_id: gameId, ...values });
  if (error) return dbError(error);
  refresh();
  return { ok: undo ? "Plata a fost anulată." : "Plata a fost înregistrată." };
}

export async function addPayout(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await master();
  if (!ctx) return { error: "Doar administratorul principal." };
  const amount = money(str(fd, "amount"));
  if (amount === null || amount === "invalid" || amount <= 0) return { error: "Completați suma." };
  const date = str(fd, "paid_on") || isoToBucharest(new Date().toISOString()).date;
  if (!DATE.test(date)) return { error: "Data nu este validă." };
  const { error } = await ctx.supabase.from("official_payouts").insert({
    user_id: str(fd, "user_id"),
    amount,
    paid_on: date,
    note: str(fd, "note") || null,
  });
  if (error) return dbError(error);
  refresh();
  return { ok: "Suma dată a fost înregistrată." };
}

export async function deletePayout(_: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await master();
  if (!ctx) return { error: "Doar administratorul principal." };
  const { error } = await ctx.supabase.from("official_payouts").delete().eq("id", str(fd, "id"));
  if (error) return dbError(error);
  refresh();
  return {};
}
