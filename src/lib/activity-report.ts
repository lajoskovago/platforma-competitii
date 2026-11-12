import "server-only";
import type { CurrentUser } from "@/lib/auth";
import { bucharestToISO, isoToBucharest } from "@/lib/format";
import { createSupabaseAdmin } from "@/lib/supabase/server";

export const BUCKETS = [
  { key: "youth_regional", label: "Tineret regional", short: "Tin. reg." },
  { key: "youth_national", label: "Tineret național", short: "Tin. naț." },
  { key: "l1m", label: "L1M", short: "L1M" },
  { key: "l1f", label: "L1F", short: "L1F" },
  { key: "crb", label: "CRB (M/F)", short: "CRB" },
  { key: "lnb", label: "LNB (M/F)", short: "LNB" },
] as const;
export type BucketKey = (typeof BUCKETS)[number]["key"];

/** Which column a game belongs to, from its category. */
function bucketOf(scope: string, code: string): BucketKey | null {
  if (scope === "regional") return "youth_regional";
  const c = code.toUpperCase();
  if (c.startsWith("U")) return "youth_national";
  if (c === "L1M") return "l1m";
  if (c === "L1F") return "l1f";
  if (c.startsWith("CRB")) return "crb";
  if (c.startsWith("LNB")) return "lnb";
  return null;
}

export type ReportRow = {
  userId: string;
  name: string;
  city: string | null;
  region: string | null;
  roles: string;
  counts: Record<BucketKey, number>;
  total: number;
  earned: number;
  /** part of `earned` the official invoiced to the club directly */
  selfInvoiced: number;
  missingRates: number;
};

export type ReportFilters = { de: string; pana: string; oras: string; regiune: string; q: string };

/** Start of the basketball season (1 September) that contains today. */
export function seasonStart() {
  const today = isoToBucharest(new Date().toISOString()).date;
  const [y, m] = today.split("-").map(Number);
  return `${m >= 9 ? y : y - 1}-09-01`;
}

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();
const DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Games per official (confirmed nominations, played regional + national games)
 * and the amount earned from the rates. Master: everyone; others: their region.
 */
export async function getActivityReport(user: CurrentUser, f: ReportFilters) {
  const admin = createSupabaseAdmin();
  const from = DATE.test(f.de) ? f.de : seasonStart();
  const to = DATE.test(f.pana) ? f.pana : isoToBucharest(new Date().toISOString()).date;
  const nowIso = new Date().toISOString();
  const toIso = bucharestToISO(to, "23:59");

  const { data: games } = await admin
    .from("games")
    .select("id, category_id, category:categories(code, scope)")
    .in("competition", ["regional", "national"])
    .gte("starts_at", bucharestToISO(from, "00:00"))
    .lte("starts_at", toIso < nowIso ? toIso : nowIso)
    .limit(10000);
  const gameById = new Map((games ?? []).map((g) => [g.id, g]));
  const ids = [...gameById.keys()];
  const none = ["00000000-0000-0000-0000-000000000000"];

  const [{ data: noms }, { data: rates }, { data: people }] = await Promise.all([
    admin
      .from("game_officials")
      .select("game_id, user_id, position, fee_override, self_invoiced")
      .in("game_id", ids.length ? ids : none)
      .eq("status", "accepted")
      .limit(50000),
    admin.from("fee_rates").select("*"),
    admin
      .from("profiles")
      .select("id, full_name, city, region, is_referee, is_table_official")
      .or("is_referee.eq.true,is_table_official.eq.true"),
  ]);

  // visibility + filters on the person
  const regionFilter = user.isMaster ? f.regiune : (user.region ?? "__none__");
  const needle = norm(f.q);
  const visible = (people ?? []).filter(
    (p) =>
      (!regionFilter || p.region === regionFilter) &&
      (!f.oras || norm(p.city) === norm(f.oras)) &&
      (!needle || norm(p.full_name).includes(needle)),
  );
  const cities = [
    ...new Set(
      (people ?? [])
        .filter((p) => user.isMaster || p.region === user.region)
        .map((p) => p.city?.trim())
        .filter(Boolean) as string[],
    ),
  ].sort((a, b) => a.localeCompare(b, "ro"));

  const rows: ReportRow[] = visible.map((p) => {
    const counts = Object.fromEntries(BUCKETS.map((b) => [b.key, 0])) as Record<BucketKey, number>;
    let earned = 0;
    let selfInvoiced = 0;
    let missingRates = 0;
    const gamesSeen = new Set<string>();
    for (const n of (noms ?? []).filter((x) => x.user_id === p.id)) {
      const g = gameById.get(n.game_id);
      if (!g?.category) continue;
      const bucket = bucketOf(g.category.scope, g.category.code);
      if (bucket && !gamesSeen.has(g.id)) counts[bucket]++;
      gamesSeen.add(g.id);
      const rate = (rates ?? []).find((r) => r.category_id === g.category_id && r.position === n.position);
      const amount = n.fee_override !== null ? Number(n.fee_override) : rate ? Number(rate.amount) : 0;
      if (n.fee_override === null && !rate) missingRates++;
      earned += amount;
      if (n.self_invoiced) selfInvoiced += amount;
    }
    return {
      userId: p.id,
      name: p.full_name,
      city: p.city,
      region: p.region,
      roles: [p.is_referee && "arbitru", p.is_table_official && "oficial"].filter(Boolean).join(", "),
      counts,
      total: Object.values(counts).reduce((a, b) => a + b, 0),
      earned: Math.round(earned * 100) / 100,
      selfInvoiced: Math.round(selfInvoiced * 100) / 100,
      missingRates,
    };
  });
  rows.sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "ro"));

  return { rows, from, to, cities };
}
