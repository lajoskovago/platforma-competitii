import "server-only";
import { isoToBucharest } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";

export type UnavailabilityFilters = {
  cand: string;
  regiune: string;
  q: string;
  oras: string;
  /** period "YYYY-MM-DD": rows overlapping [de, pana]; when set, replaces `cand` */
  de?: string;
  pana?: string;
};
const DATE = /^\d{4}-\d{2}-\d{2}$/;

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/** Unavailability rows visible to the caller (RLS), filtered; shared by the page and the PDF. */
export async function getUnavailabilityList(f: UnavailabilityFilters) {
  const today = isoToBucharest(new Date().toISOString()).date;
  const supabase = await createSupabaseServer();
  let query = supabase.from("official_unavailability").select("*").order("start_date").order("start_time");
  const de = f.de && DATE.test(f.de) ? f.de : "";
  const pana = f.pana && DATE.test(f.pana) ? f.pana : "";
  if (de || pana) {
    if (de) query = query.gte("end_date", de); // still unavailable on/after the start of the period
    if (pana) query = query.lte("start_date", pana); // starts before the end of the period
  } else {
    query = f.cand === "upcoming" ? query.gte("end_date", today) : query.lt("end_date", today);
  }
  const { data: rows } = await query.limit(2000);

  const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: people } = ids.length
    ? await supabase
        .from("profile_names")
        .select("id, full_name, region, is_referee, is_table_official, city")
        .in("id", ids)
    : { data: [] };
  const person = (id: string) => (people ?? []).find((p) => p.id === id);

  const cities = [...new Set((people ?? []).map((p) => p.city?.trim()).filter(Boolean) as string[])].sort((a, b) =>
    a.localeCompare(b, "ro"),
  );
  const needle = norm(f.q);
  const list = (rows ?? [])
    .map((r) => ({ ...r, person: person(r.user_id) }))
    .filter((r) => {
      if (f.regiune && r.person?.region !== f.regiune) return false;
      if (f.oras && norm(r.person?.city ?? "") !== norm(f.oras)) return false;
      if (needle && !norm(r.person?.full_name ?? "").includes(needle)) return false;
      return true;
    });
  if (!de && !pana && f.cand !== "upcoming") list.reverse();
  return { list, cities };
}
