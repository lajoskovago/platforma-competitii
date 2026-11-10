import Link from "next/link";
import { AutoFilterForm } from "@/components/auto-filter-form";
import { PublicGameList, type PublicGame } from "@/components/public-game-list";
import { SectionTitle, inputClass } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { daysAgoISO, upcomingCutoff } from "@/lib/format";
import { createSupabasePublic } from "@/lib/supabase/public";

export const metadata = {
  title: `Program meciuri baschet SR5 & SR6 – ${APP_NAME}`,
  description: "Programul meciurilor de baschet din Regiunile 5 și 6: campionate regionale și Campionatul Național.",
};

/** Public schedule (no login): upcoming and recently played games, with filters. */
export default async function PublicHomePage({ searchParams }: PageProps<"/">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const tip = sp.tip === "regional" || sp.tip === "national" ? sp.tip : "";
  const cat = sp.cat ?? ""; // "regional:U12M" / "national:U16M"
  const club = sp.club ?? "";
  const oras = sp.oras ?? "";

  const supabase = createSupabasePublic();
  const cutoff = new Date(upcomingCutoff()).toISOString();
  const twoWeeksAgo = daysAgoISO(14);

  /** public_games query with the visitor's filters applied */
  const base = () => {
    let q = supabase.from("public_games").select("*");
    if (tip) q = q.eq("competition", tip);
    if (cat.includes(":")) {
      const [scope, code] = cat.split(":");
      q = q.eq("category_scope", scope === "national" ? "national" : "regional").eq("category_code", code);
    }
    if (club) q = q.or(`home_club_id.eq.${club},away_club_id.eq.${club}`);
    if (oras) q = q.eq("gym_city", oras);
    return q;
  };

  const [upcomingRes, recentRes, optionsRes, clubsRes, champsRes] = await Promise.all([
    base().gte("starts_at", cutoff).order("starts_at").limit(200),
    base().lt("starts_at", cutoff).gte("starts_at", twoWeeksAgo).order("starts_at", { ascending: false }).limit(60),
    supabase.from("public_games").select("category_code, category_name, category_scope, category_sort, gym_city").limit(2000),
    supabase.from("public_clubs").select("id, name, city").order("name"),
    supabase.from("public_groups").select("category_code, category_name, category_sort").limit(500),
  ]);

  const upcoming = (upcomingRes.data ?? []) as PublicGame[];
  const recent = (recentRes.data ?? []) as PublicGame[];
  const options = optionsRes.data ?? [];
  const categories = [
    ...new Map(
      options.map((o) => [`${o.category_scope}:${o.category_code}`, o] as const),
    ).values(),
  ].sort((a, b) => (a.category_sort ?? 0) - (b.category_sort ?? 0));
  const cities = [...new Set(options.map((o) => o.gym_city).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, "ro"));
  const championships = [...new Map((champsRes.data ?? []).map((c) => [c.category_code, c] as const)).values()].sort(
    (a, b) => (a.category_sort ?? 0) - (b.category_sort ?? 0),
  );
  const anyFilter = !!(tip || cat || club || oras);

  return (
    <>
      <h1 className="text-xl font-bold leading-tight text-slate-900">Programul meciurilor</h1>
      <p className="mb-4 text-sm text-slate-500">Campionatele regionale (SR5 și SR6) și Campionatul Național.</p>

      <AutoFilterForm className="mb-2 space-y-2 rounded-xl border border-slate-200 bg-white p-3" showClear={anyFilter}>
        <div className="grid grid-cols-2 gap-2">
          <select name="tip" defaultValue={tip} aria-label="Competiția" className={inputClass}>
            <option value="">Competiția</option>
            <option value="regional">Campionate regionale</option>
            <option value="national">Campionatul Național</option>
          </select>
          <select name="cat" defaultValue={cat} aria-label="Categoria" className={inputClass}>
            <option value="">Categoria</option>
            {categories.map((c) => (
              <option key={`${c.category_scope}:${c.category_code}`} value={`${c.category_scope}:${c.category_code}`}>
                {c.category_scope === "national" ? "Național" : "Regional"} {c.category_code}
              </option>
            ))}
          </select>
          <select name="club" defaultValue={club} aria-label="Club" className={inputClass}>
            <option value="">Clubul</option>
            {(clubsRes.data ?? []).map((c) => (
              <option key={c.id!} value={c.id!}>
                {c.name}
              </option>
            ))}
          </select>
          <select name="oras" defaultValue={oras} aria-label="Oraș" className={inputClass}>
            <option value="">Orașul</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </AutoFilterForm>

      <SectionTitle>Următoarele meciuri ({upcoming.length})</SectionTitle>
      <PublicGameList
        games={upcoming}
        empty={anyFilter ? "Niciun meci programat pentru filtrele alese." : "Nu sunt meciuri programate încă."}
      />

      {recent.length > 0 && (
        <>
          <SectionTitle>Jucate recent</SectionTitle>
          <PublicGameList games={recent} empty="" />
        </>
      )}

      {championships.length > 0 && (
        <>
          <SectionTitle>Campionate regionale – grupe</SectionTitle>
          <div className="flex flex-wrap gap-2">
            {championships.map((c) => (
              <Link
                key={c.category_code}
                href={`/campionat/${c.category_code}`}
                className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm hover:border-orange-500"
              >
                {c.category_name}
              </Link>
            ))}
          </div>
        </>
      )}
    </>
  );
}
