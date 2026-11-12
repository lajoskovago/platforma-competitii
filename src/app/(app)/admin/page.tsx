import Link from "next/link";
import { AutoFilterForm } from "@/components/auto-filter-form";
import { Badge, Card, PageTitle, buttonClass } from "@/components/ui";
import { GROUP_STATUS, formatDateRange } from "@/lib/format";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatUntilDay, isoToBucharest } from "@/lib/format";
import { GROUP_FILTER_KEYS, getGroupsListing, readGroupFilters, type GroupFilters, type ListedGroup } from "@/lib/groups-listing";
import { getAutoConfirmUntil } from "@/lib/queries";
import { setAutoConfirm } from "./actions";

const FILTERS = [
  { key: "", label: "Toate" },
  { key: "conflict", label: "De decis" },
  { key: "no_proposal", label: "Fără organizator" },
  { key: "waiting", label: "În așteptare" },
  { key: "confirmed", label: "Confirmate" },
  { key: "scheduled", label: "Cu program" },
  { key: "finished", label: "Încheiate" },
];

export default async function AdminGroupsPage({ searchParams }: PageProps<"/admin">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const f = readGroupFilters((k) => sp[k]);
  const me = await requireAdmin();
  const autoUntil = await getAutoConfirmUntil();
  const { all, rows, counts, cities, categories } = await getGroupsListing(f);

  const query = (over: Partial<GroupFilters>) => {
    const p = new URLSearchParams();
    for (const k of GROUP_FILTER_KEYS) {
      const v = over[k] ?? f[k];
      if (v) p.set(k, v);
    }
    return p.toString();
  };
  const href = (over: Partial<GroupFilters>) => {
    const q = query(over);
    return q ? `/admin?${q}` : "/admin";
  };
  const byDate = f.sort === "data";
  const sections = rows.reduce<{ heading: string; groups: ListedGroup[] }[]>((acc, g) => {
    const heading = byDate
      ? g.host
        ? formatDateRange(g.host.start_date, g.host.end_date)
        : "Fără dată stabilită"
      : (g.category_name ?? "");
    const last = acc[acc.length - 1];
    if (last?.heading === heading) last.groups.push(g);
    else acc.push({ heading, groups: [g] });
    return acc;
  }, []);
  const anyFilter = !!(f.categorie || f.regiune || f.oras || f.de || f.pana || f.q);

  return (
    <>
      <PageTitle sub={`${all.length} grupe · Turneul 1`}>Toate grupele</PageTitle>

      {(autoUntil || me.isMaster) && (
        <Card className={`mb-4 ${autoUntil ? "border-emerald-300 bg-emerald-50/60" : ""}`}>
          <div className="text-sm">
            {autoUntil ? (
              <>
                ⚡ <strong>Confirmare automată activă</strong> până {formatUntilDay(autoUntil)} inclusiv: prima echipă care
                se oferă să organizeze este confirmată imediat.
              </>
            ) : (
              <>Confirmarea automată a organizatorilor este oprită (fluxul normal: acceptul celorlalte echipe).</>
            )}
          </div>
          {me.isMaster && (
            <details className="mt-2">
              <summary className="cursor-pointer py-1 text-sm font-medium text-orange-700">Modifică</summary>
              <ActionForm action={setAutoConfirm} className="mt-2 space-y-2">
                <label className="block text-sm">
                  Ultima zi cu confirmare automată
                  <input
                    name="last_day"
                    type="date"
                    defaultValue={autoUntil ? isoToBucharest(new Date(new Date(autoUntil).getTime() - 60_000).toISOString()).date : ""}
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <SubmitButton>Salvează perioada</SubmitButton>
                {autoUntil && (
                  <SubmitButton variant="danger" name="stop" value="1">
                    Oprește acum
                  </SubmitButton>
                )}
              </ActionForm>
            </details>
          )}
        </Card>
      )}

      <div className="-mx-4 mb-2 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map((x) => (
          <Link
            key={x.key}
            href={href({ status: x.key })}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
              f.status === x.key ? "border-orange-600 bg-orange-600 text-white" : "border-slate-300 bg-white"
            }`}
          >
            {x.label}
            {x.key && counts[x.key] ? ` (${counts[x.key]})` : ""}
          </Link>
        ))}
      </div>

      <AutoFilterForm
        key={query({})}
        className="mb-3 space-y-2 rounded-xl border border-slate-200 bg-white p-3"
        showClear={anyFilter}
      >
        <input type="hidden" name="status" value={f.status} />
        <input type="hidden" name="sort" value={f.sort} />
        <input
          type="search"
          name="q"
          defaultValue={f.q}
          placeholder="Caută echipă sau club…"
          aria-label="Echipă sau club"
          className={inputClass}
        />
        <div className="grid grid-cols-2 gap-2">
          <select name="categorie" defaultValue={f.categorie} aria-label="Categoria" className={inputClass}>
            <option value="">Toate categoriile</option>
            {categories.map((c) => (
              <option key={c.id} value={c.code}>
                {c.code}
              </option>
            ))}
          </select>
          <select name="regiune" defaultValue={f.regiune} aria-label="Regiunea" className={inputClass}>
            <option value="">Toate regiunile</option>
            <option value="SR5">SR5</option>
            <option value="SR6">SR6</option>
            <option value="mixt">Mixte (SR5 + SR6)</option>
          </select>
        </div>
        <select name="oras" defaultValue={f.oras} aria-label="Orașul sălii" className={inputClass}>
          <option value="">Toate orașele (sala)</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs text-slate-600">
            Turneu de la
            <input type="date" name="de" defaultValue={f.de} className={`${inputClass} mt-0.5`} />
          </label>
          <label className="text-xs text-slate-600">
            până la
            <input type="date" name="pana" defaultValue={f.pana} className={`${inputClass} mt-0.5`} />
          </label>
        </div>
      </AutoFilterForm>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-sm">
          <span className="text-slate-500">Ordonare:</span>
          {[
            { key: "", label: "Categorie / grupă" },
            { key: "data", label: "Data turneului" },
          ].map((o) => (
            <Link
              key={o.key}
              href={href({ sort: o.key })}
              className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${
                f.sort === o.key ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white"
              }`}
            >
              {o.label}
            </Link>
          ))}
        </div>
        <a href={`/admin/pdf?${query({})}`} className={buttonClass("secondary")} download>
          📄 Descarcă PDF
        </a>
      </div>
      <p className="mb-2 text-xs text-slate-500">
        {rows.length} {rows.length === 1 ? "grupă" : "grupe"} afișate
      </p>

      {rows.length === 0 && <p className="text-sm text-slate-500">Nicio grupă pentru filtrul ales.</p>}

      {sections.map(({ heading, groups }) => (
        <section key={heading} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{heading}</h2>
          <div className="space-y-2">
            {groups.map((g) => {
              const st = GROUP_STATUS[g.status ?? "no_proposal"];
              const host = g.host;
              return (
                <Link key={g.group_id} href={`/grupa/${g.group_id}`} className="block">
                  <Card className="active:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {byDate && <span className="text-slate-500">{g.category_code} · </span>}
                        {g.group_name}
                      </span>
                      <Badge tone={st.tone}>{st.label}</Badge>
                    </div>
                    {host ? (
                      <div className="mt-1 text-sm text-slate-600">
                        {formatDateRange(host.start_date, host.end_date)} · {host.gym?.name}, {host.gym?.city}
                        <span className="block text-xs text-slate-500">Organizator: {host.team?.name}</span>
                      </div>
                    ) : (
                      (g.pending_count ?? 0) > 0 && (
                        <div className="mt-1 text-xs text-slate-500">
                          {g.pending_count} {g.pending_count === 1 ? "propunere" : "propuneri"} în așteptare
                        </div>
                      )
                    )}
                    {(g.games_count ?? 0) > 0 && (
                      <div className="mt-1 text-xs text-slate-500">
                        Meciuri: {g.games_done}/{g.games_count} cu rezultat
                      </div>
                    )}
                  </Card>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
