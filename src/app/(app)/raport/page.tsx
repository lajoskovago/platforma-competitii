import { redirect } from "next/navigation";
import { AutoFilterForm } from "@/components/auto-filter-form";
import { Card, Empty, PageTitle, buttonClass, inputClass } from "@/components/ui";
import { BUCKETS, getActivityReport } from "@/lib/activity-report";
import { isNominator, requireUser } from "@/lib/auth";
import { APP_HOME } from "@/lib/brand";
import { lei } from "@/lib/decont";
import { formatDate } from "@/lib/format";

/** Games per referee / table official by competition, and amounts earned. */
export default async function ReportPage({ searchParams }: PageProps<"/raport">) {
  const user = await requireUser();
  if (!isNominator(user)) redirect(APP_HOME);
  const sp = (await searchParams) as Record<string, string | undefined>;
  const filters = { de: sp.de ?? "", pana: sp.pana ?? "", oras: sp.oras ?? "", regiune: sp.regiune ?? "", q: sp.q ?? "" };
  const { rows, from, to, cities } = await getActivityReport(user, filters);
  const pdfQuery = new URLSearchParams(Object.entries(filters).filter(([, v]) => v)).toString();
  const sum = (k: (typeof BUCKETS)[number]["key"]) => rows.reduce((s, r) => s + r.counts[k], 0);

  return (
    <>
      <PageTitle
        sub={`${formatDate(from)} – ${formatDate(to)} · meciuri jucate, nominalizări confirmate${user.isMaster ? "" : ` · ${user.region}`}`}
      >
        Raport arbitri și oficiali
      </PageTitle>

      <AutoFilterForm
        className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3"
        showClear={!!(filters.de || filters.pana || filters.oras || filters.regiune || filters.q)}
      >
        <input name="q" type="search" defaultValue={filters.q} placeholder="Caută după nume…" className={inputClass} />
        <div className={`grid gap-2 ${user.isMaster ? "grid-cols-2" : "grid-cols-1"}`}>
          <select name="oras" defaultValue={filters.oras} aria-label="Oraș" className={inputClass}>
            <option value="">Toate orașele</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          {user.isMaster && (
            <select name="regiune" defaultValue={filters.regiune} aria-label="Regiune" className={inputClass}>
              <option value="">Toate regiunile</option>
              <option value="SR5">SR5</option>
              <option value="SR6">SR6</option>
            </select>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">
            De la (implicit: începutul sezonului)
            <input type="date" name="de" defaultValue={filters.de} className={`${inputClass} mt-0.5`} />
          </label>
          <label className="text-xs text-slate-600">
            Până la (implicit: azi)
            <input type="date" name="pana" defaultValue={filters.pana} className={`${inputClass} mt-0.5`} />
          </label>
        </div>
      </AutoFilterForm>

      <div className="mb-3 flex items-center justify-between gap-2">
        <span className="text-sm text-slate-500">
          {rows.length} persoane · {rows.reduce((s, r) => s + r.total, 0)} prezențe
        </span>
        {rows.length > 0 && (
          <a href={`/raport/pdf?${pdfQuery}`} download className={buttonClass("secondary")}>
            📄 Descarcă PDF
          </a>
        )}
      </div>

      {rows.length === 0 ? (
        <Empty>Nicio persoană pentru filtrele alese.</Empty>
      ) : (
        <Card className="overflow-x-auto p-0!">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-slate-50 text-xs text-slate-500">
              <tr>
                <th className="sticky left-0 bg-slate-50 px-3 py-2 text-left">Nume</th>
                {BUCKETS.map((b) => (
                  <th key={b.key} className="px-2 py-2 text-center" title={b.label}>
                    {b.short}
                  </th>
                ))}
                <th className="px-2 py-2 text-center">Total</th>
                <th className="px-3 py-2 text-right">Sume</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-t border-slate-100">
                  <td className="sticky left-0 bg-white px-3 py-2">
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500">{[r.city, r.roles].filter(Boolean).join(" · ")}</div>
                  </td>
                  {BUCKETS.map((b) => (
                    <td key={b.key} className={`px-2 py-2 text-center tabular-nums ${r.counts[b.key] ? "" : "text-slate-300"}`}>
                      {r.counts[b.key]}
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center font-semibold tabular-nums">{r.total}</td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <div className="font-semibold">{lei(r.earned)}</div>
                    {r.selfInvoiced > 0 && <div className="text-xs text-slate-500">din care facturat: {lei(r.selfInvoiced)}</div>}
                    {r.missingRates > 0 && <div className="text-xs text-amber-700">⚠️ {r.missingRates} fără tarif</div>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-slate-200 bg-slate-50 text-sm font-semibold">
              <tr>
                <td className="sticky left-0 bg-slate-50 px-3 py-2">Total</td>
                {BUCKETS.map((b) => (
                  <td key={b.key} className="px-2 py-2 text-center tabular-nums">
                    {sum(b.key)}
                  </td>
                ))}
                <td className="px-2 py-2 text-center tabular-nums">{rows.reduce((s, r) => s + r.total, 0)}</td>
                <td className="px-3 py-2 text-right tabular-nums">{lei(Math.round(rows.reduce((s, r) => s + r.earned, 0) * 100) / 100)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
      )}
      <p className="mt-2 text-xs text-slate-500">
        Tin. reg. = campionate regionale de tineret · Tin. naț. = Campionatul Național de tineret (U13–U18) · CRB = Cupa
        României · LNB = Liga Națională. Sumele sunt calculate din tarife (inclusiv meciurile facturate direct).
      </p>
    </>
  );
}
