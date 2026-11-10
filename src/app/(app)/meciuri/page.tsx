import { redirect } from "next/navigation";
import { AutoFilterForm } from "@/components/auto-filter-form";
import { Chips, GameList } from "@/components/game-list";
import { PageTitle, buttonClass, inputClass } from "@/components/ui";
import { isNominator, requireUser } from "@/lib/auth";
import { getGymCities, listGames } from "@/lib/queries";
import { APP_HOME } from "@/lib/brand";

/** All visible games with filters (city, period, type) and PDF export. */
export default async function GamesPage({ searchParams }: PageProps<"/meciuri">) {
  const user = await requireUser();
  if (!user.isOfficial && !isNominator(user)) redirect(APP_HOME);
  const sp = (await searchParams) as Record<string, string | undefined>;
  const tip = sp.tip ?? "";
  const cand = sp.cand ?? "upcoming";
  const oras = sp.oras ?? "";
  const de = sp.de ?? "";
  const pana = sp.pana ?? "";
  const hasDates = !!(de || pana);

  const [games, cities] = await Promise.all([
    listGames({
      competition: tip === "regional" || tip === "national" || tip === "friendly" ? tip : undefined,
      when: cand === "past" ? "past" : "upcoming",
      city: oras || undefined,
      from: de || undefined,
      to: pana || undefined,
    }),
    getGymCities(),
  ]);

  const params = (over: Record<string, string>) => {
    const p = new URLSearchParams();
    const all = { tip, cand: hasDates ? "" : cand, oras, de, pana, ...over };
    for (const [k, v] of Object.entries(all)) if (v && !(k === "cand" && v === "upcoming")) p.set(k, v);
    return p.toString();
  };
  const href = (over: Record<string, string>) => {
    const s = params(over);
    return s ? `/meciuri?${s}` : "/meciuri";
  };
  const pdfHref = `/meciuri/pdf?${params({})}`;

  return (
    <>
      <PageTitle sub="Campionate regionale, Campionatul Național și meciuri amicale">Meciuri</PageTitle>

      <Chips
        items={[
          { key: "", label: "Toate" },
          { key: "regional", label: "Regional" },
          { key: "national", label: "Național" },
          { key: "friendly", label: "Amicale" },
        ]}
        active={tip}
        href={(k) => href({ tip: k })}
      />

      <AutoFilterForm
        className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3"
        showClear={!!(oras || de || pana)}
      >
        {tip && <input type="hidden" name="tip" value={tip} />}
        {!hasDates && cand !== "upcoming" && <input type="hidden" name="cand" value={cand} />}
        <select name="oras" defaultValue={oras} aria-label="Oraș" className={inputClass}>
          <option value="">Toate orașele</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">
            De la
            <input type="date" name="de" defaultValue={de} className={`${inputClass} mt-0.5`} />
          </label>
          <label className="text-xs text-slate-600">
            Până la
            <input type="date" name="pana" defaultValue={pana} className={`${inputClass} mt-0.5`} />
          </label>
        </div>
      </AutoFilterForm>

      {!hasDates && (
        <Chips
          items={[
            { key: "upcoming", label: "Următoare" },
            { key: "past", label: "Trecute" },
          ]}
          active={cand}
          href={(k) => href({ cand: k })}
        />
      )}

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm text-slate-500">
          {games.length} {games.length === 1 ? "meci" : "meciuri"}
          {oras && ` în ${oras}`}
        </span>
        {games.length > 0 && (
          <a href={pdfHref} className={buttonClass("secondary")} download>
            📄 Descarcă PDF
          </a>
        )}
      </div>

      <GameList games={games} empty="Niciun meci pentru filtrele alese." />
    </>
  );
}
