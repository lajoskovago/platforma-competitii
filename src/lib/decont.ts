import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/server";

/** Only games played in this city are settled here (gym city, diacritics-insensitive). */
export const DECONT_CITY = "Oradea";

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

export type Payer = "home" | "both";

export type DecontFee = { nominationId: string; userId: string; position: string; amount: number; fromRate: boolean; missingRate: boolean };
export type DecontGame = {
  id: string;
  startsAt: string;
  competition: "regional" | "national";
  categoryId: string;
  categoryName: string;
  label: string | null;
  home: string;
  away: string;
  gym: string;
  fees: DecontFee[];
  total: number;
  payer: Payer;
  payerIsDefault: boolean;
  homeAmount: number;
  awayAmount: number;
  homeAmountIsDefault: boolean;
  awayAmountIsDefault: boolean;
  homePaidOn: string | null;
  homePaidNote: string | null;
  awayPaidOn: string | null;
  awayPaidNote: string | null;
  /** sum of the team amounts already paid */
  collected: number;
  /** share of the officials' fees covered by what the teams paid (0..1) */
  coveredFraction: number;
};
export type DecontPerson = {
  userId: string;
  name: string;
  city: string | null;
  games: number;
  earned: number;
  covered: number;
  paidOut: number;
  /** earned - paidOut (may be negative) */
  toReceive: number;
  /** covered - paidOut: what can be handed over now (may be negative) */
  availableNow: number;
  /** earned - covered: still to be collected from the teams */
  notCollected: number;
};

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * All settlement data. Uses the service role: callers must check permissions
 * (master / nominators see everything, an official only their own lines).
 */
export async function getDecont() {
  const admin = createSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: gamesRaw } = await admin
    .from("games")
    .select(
      "id, starts_at, competition, category_id, label, home_external, away_external, home_label, away_label, gym:gyms!inner(name, city), category:categories(name), home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name)",
    )
    .in("competition", ["regional", "national"])
    .lt("starts_at", now)
    .order("starts_at", { ascending: false });
  const games = (gamesRaw ?? []).filter((g) => norm(g.gym?.city) === norm(DECONT_CITY));
  const gameIds = games.map((g) => g.id);
  const none = ["00000000-0000-0000-0000-000000000000"];

  const [{ data: noms }, { data: rates }, { data: charges }, { data: payouts }] = await Promise.all([
    admin
      .from("game_officials")
      .select("id, game_id, user_id, position, fee_override")
      .in("game_id", gameIds.length ? gameIds : none)
      .eq("status", "accepted"),
    admin.from("fee_rates").select("*"),
    admin.from("game_charges").select("*").in("game_id", gameIds.length ? gameIds : none),
    admin.from("official_payouts").select("*").order("paid_on", { ascending: false }),
  ]);

  const rateOf = (categoryId: string, position: string) =>
    (rates ?? []).find((r) => r.category_id === categoryId && r.position === position);

  const decontGames: DecontGame[] = games.map((g) => {
    const fees: DecontFee[] = (noms ?? [])
      .filter((n) => n.game_id === g.id)
      .map((n) => {
        const rate = rateOf(g.category_id!, n.position);
        const override = n.fee_override !== null ? Number(n.fee_override) : null;
        return {
          nominationId: n.id,
          userId: n.user_id,
          position: n.position,
          amount: override ?? (rate ? Number(rate.amount) : 0),
          fromRate: override === null,
          missingRate: override === null && !rate,
        };
      });
    const total = round2(fees.reduce((s, f) => s + f.amount, 0));
    const c = (charges ?? []).find((x) => x.game_id === g.id);
    const defaultPayer: Payer = g.competition === "regional" ? "both" : "home";
    const payer = (c?.payer as Payer | null) ?? defaultPayer;
    const homeDefault = payer === "both" ? round2(total / 2) : total;
    const awayDefault = payer === "both" ? round2(total - homeDefault) : 0;
    const homeAmount = c?.home_amount !== null && c?.home_amount !== undefined ? Number(c.home_amount) : homeDefault;
    const awayAmount =
      payer === "home" ? 0 : c?.away_amount !== null && c?.away_amount !== undefined ? Number(c.away_amount) : awayDefault;
    const collected = (c?.home_paid_on ? homeAmount : 0) + (payer === "both" && c?.away_paid_on ? awayAmount : 0);
    const due = homeAmount + awayAmount;
    return {
      id: g.id,
      startsAt: g.starts_at,
      competition: g.competition as "regional" | "national",
      categoryId: g.category_id!,
      categoryName: g.category?.name ?? "",
      label: g.label,
      home: g.home?.name ?? g.home_external ?? g.home_label ?? "?",
      away: g.away?.name ?? g.away_external ?? g.away_label ?? "?",
      gym: g.gym ? `${g.gym.name}, ${g.gym.city}` : "",
      fees,
      total,
      payer,
      payerIsDefault: !c?.payer,
      homeAmount,
      awayAmount,
      homeAmountIsDefault: c?.home_amount === null || c?.home_amount === undefined,
      awayAmountIsDefault: c?.away_amount === null || c?.away_amount === undefined,
      homePaidOn: c?.home_paid_on ?? null,
      homePaidNote: c?.home_paid_note ?? null,
      awayPaidOn: c?.away_paid_on ?? null,
      awayPaidNote: c?.away_paid_note ?? null,
      collected: round2(collected),
      coveredFraction: due > 0 ? Math.min(1, collected / due) : 0,
    };
  });

  // per person
  const peopleIds = [
    ...new Set([...decontGames.flatMap((g) => g.fees.map((f) => f.userId)), ...(payouts ?? []).map((p) => p.user_id)]),
  ];
  const { data: names } = await admin
    .from("profiles")
    .select("id, full_name, city")
    .in("id", peopleIds.length ? peopleIds : none);

  const people: DecontPerson[] = peopleIds.map((id) => {
    let earned = 0;
    let covered = 0;
    let games = 0;
    for (const g of decontGames) {
      for (const f of g.fees.filter((x) => x.userId === id)) {
        earned += f.amount;
        covered += f.amount * g.coveredFraction;
        games++;
      }
    }
    const paidOut = (payouts ?? []).filter((p) => p.user_id === id).reduce((s, p) => s + Number(p.amount), 0);
    const p = (names ?? []).find((n) => n.id === id);
    return {
      userId: id,
      name: p?.full_name ?? "",
      city: p?.city ?? null,
      games,
      earned: round2(earned),
      covered: round2(covered),
      paidOut: round2(paidOut),
      toReceive: round2(earned - paidOut),
      availableNow: round2(covered - paidOut),
      notCollected: round2(earned - covered),
    };
  });
  people.sort((a, b) => a.name.localeCompare(b.name, "ro"));

  return { games: decontGames, people, payouts: payouts ?? [] };
}

export function lei(n: number) {
  return `${n.toLocaleString("ro-RO", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} lei`;
}

/** Master and anyone with nomination rights see everyone; Oradea officials see their own. */
export function decontAccess(user: CurrentUser): "all" | "own" | null {
  if (user.isMaster || user.isAdmin || user.canNominate) return "all";
  if (user.isOfficial && norm(user.city) === norm(DECONT_CITY)) return "own";
  return null;
}
