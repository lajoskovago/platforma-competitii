import { redirect } from "next/navigation";
import { AutoFilterForm } from "@/components/auto-filter-form";
import { Chips } from "@/components/game-list";
import { Badge, Card, Empty, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { isNominator, requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { getUnavailabilityList } from "@/lib/unavailability";
import { APP_HOME } from "@/lib/brand";

/**
 * All unavailability of referees / table officials.
 * Master admin: everyone. Regional admins and nomination delegates: their region (RLS).
 */
export default async function AllUnavailabilityPage({ searchParams }: PageProps<"/indisponibilitati">) {
  const user = await requireUser();
  if (!isNominator(user)) redirect(APP_HOME);
  const sp = (await searchParams) as Record<string, string | undefined>;
  const cand = sp.cand ?? "upcoming";
  const regiune = user.isMaster ? (sp.regiune ?? "") : "";
  const q = sp.q ?? "";
  const oras = sp.oras ?? "";
  const de = sp.de ?? "";
  const pana = sp.pana ?? "";
  const hasPeriod = !!(de || pana);

  const { list, cities } = await getUnavailabilityList({ cand, regiune, q, oras, de, pana });
  const person = (id: string) => list.find((r) => r.user_id === id)?.person;

  // group by first day of the period
  const byDay = list.reduce<Record<string, typeof list>>((acc, r) => {
    (acc[r.start_date] ??= []).push(r);
    return acc;
  }, {});

  const pdfQuery = new URLSearchParams(
    Object.entries({ cand: cand === "upcoming" || hasPeriod ? "" : cand, regiune, q, oras, de, pana }).filter(([, v]) => v),
  ).toString();

  const href = (c: string, r: string) => {
    const p = new URLSearchParams();
    if (c !== "upcoming") p.set("cand", c);
    if (r) p.set("regiune", r);
    if (q) p.set("q", q);
    if (oras) p.set("oras", oras);
    if (de) p.set("de", de);
    if (pana) p.set("pana", pana);
    const s = p.toString();
    return s ? `/indisponibilitati?${s}` : "/indisponibilitati";
  };

  return (
    <>
      <PageTitle sub={user.isMaster ? "Toți arbitrii și oficialii" : `Arbitrii și oficialii din ${user.region}`}>
        Indisponibilități
      </PageTitle>

      {!hasPeriod && (
        <Chips
          items={[
            { key: "upcoming", label: "Actuale și viitoare" },
            { key: "past", label: "Trecute" },
          ]}
          active={cand}
          href={(k) => href(k, regiune)}
        />
      )}
      <AutoFilterForm
        className="mb-4 space-y-2 rounded-xl border border-slate-200 bg-white p-3"
        showClear={!!(q || oras || regiune || de || pana)}
      >
        {!hasPeriod && cand !== "upcoming" && <input type="hidden" name="cand" value={cand} />}
        <input name="q" type="search" defaultValue={q} placeholder="Caută după nume…" className={inputClass} />
        <div className={`grid gap-2 ${user.isMaster ? "grid-cols-2" : "grid-cols-1"}`}>
          <select name="oras" defaultValue={oras} aria-label="Oraș" className={inputClass}>
            <option value="">Toate orașele</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {user.isMaster && (
            <select name="regiune" defaultValue={regiune} aria-label="Regiune" className={inputClass}>
              <option value="">Toate regiunile</option>
              <option value="SR5">SR5</option>
              <option value="SR6">SR6</option>
            </select>
          )}
        </div>
        <fieldset className="grid grid-cols-2 gap-2">
          <legend className="mb-1 text-xs text-slate-600">Perioada (opțional)</legend>
          <label className="text-xs text-slate-600">
            De la
            <input type="date" name="de" defaultValue={de} className={`${inputClass} mt-0.5`} />
          </label>
          <label className="text-xs text-slate-600">
            Până la
            <input type="date" name="pana" defaultValue={pana} className={`${inputClass} mt-0.5`} />
          </label>
        </fieldset>
      </AutoFilterForm>

      {list.length === 0 ? (
        <Empty>Nicio indisponibilitate pentru filtrul ales.</Empty>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm text-slate-500">{list.length} perioade</p>
            <a href={`/indisponibilitati/pdf?${pdfQuery}`} download className={buttonClass("secondary")}>
              📄 Descarcă PDF
            </a>
          </div>
          {Object.entries(byDay).map(([day, items]) => (
            <section key={day}>
              <Card className="divide-y divide-slate-100 p-0!">
                {items.map((r) => {
                  const p = person(r.user_id);
                  return (
                    <div key={r.id} className="px-4 py-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-medium">{p?.full_name || "—"}</span>
                        <span className="flex gap-1">
                          {p?.is_referee && <Badge tone="green">arbitru</Badge>}
                          {p?.is_table_official && <Badge tone="blue">oficial</Badge>}
                          {p?.region && <Badge>{p.region}</Badge>}
                          {p?.city && <Badge>📍 {p.city}</Badge>}
                        </span>
                      </div>
                      <div className="mt-1 text-sm capitalize text-slate-700">
                        📅 {formatDateRange(r.start_date, r.end_date)}
                        {(r.start_time || r.end_time) && (
                          <span className="normal-case">
                            {" "}
                            · {r.start_time?.slice(0, 5) ?? "00:00"}–{r.end_time?.slice(0, 5) ?? "24:00"}
                          </span>
                        )}
                      </div>
                      {r.note && <div className="text-sm text-slate-500">💬 {r.note}</div>}
                    </div>
                  );
                })}
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
