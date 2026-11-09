import Link from "next/link";
import { Badge, Card, PageTitle } from "@/components/ui";
import { GROUP_STATUS, formatDateRange } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { inputClass } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { formatUntilDay, isoToBucharest } from "@/lib/format";
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
  const { status = "", categorie = "" } = (await searchParams) as Record<string, string | undefined>;
  const me = await requireAdmin();
  const autoUntil = await getAutoConfirmUntil();
  const supabase = await createSupabaseServer();

  const [{ data: overview }, { data: hosts }, { data: categories }] = await Promise.all([
    supabase.from("group_overview").select("*").order("category_sort").order("sort_order"),
    supabase
      .from("hosting_proposals")
      .select("group_id, start_date, end_date, team:teams!hosting_proposals_team_id_fkey(name), gym:gyms(name, city)")
      .eq("status", "confirmed"),
    supabase.from("categories").select("id, code").eq("scope", "regional").order("sort_order"),
  ]);

  const all = overview ?? [];
  const counts = all.reduce<Record<string, number>>((acc, g) => {
    acc[g.status ?? ""] = (acc[g.status ?? ""] ?? 0) + 1;
    return acc;
  }, {});
  const rows = all.filter((g) => (!status || g.status === status) && (!categorie || g.category_code === categorie));

  const byCategory = rows.reduce<Record<string, typeof rows>>((acc, g) => {
    (acc[g.category_name ?? ""] ??= []).push(g);
    return acc;
  }, {});

  const href = (s: string, c: string) => {
    const p = new URLSearchParams();
    if (s) p.set("status", s);
    if (c) p.set("categorie", c);
    const q = p.toString();
    return q ? `/admin?${q}` : "/admin";
  };

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
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={href(f.key, categorie)}
            className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
              status === f.key ? "border-orange-600 bg-orange-600 text-white" : "border-slate-300 bg-white"
            }`}
          >
            {f.label}
            {f.key && counts[f.key] ? ` (${counts[f.key]})` : ""}
          </Link>
        ))}
      </div>
      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        <Link
          href={href(status, "")}
          className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${!categorie ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white"}`}
        >
          Toate categoriile
        </Link>
        {(categories ?? []).map((c) => (
          <Link
            key={c.id}
            href={href(status, c.code)}
            className={`whitespace-nowrap rounded-full border px-3 py-1 text-xs ${categorie === c.code ? "border-slate-800 bg-slate-800 text-white" : "border-slate-300 bg-white"}`}
          >
            {c.code}
          </Link>
        ))}
      </div>

      {rows.length === 0 && <p className="text-sm text-slate-500">Nicio grupă pentru filtrul ales.</p>}

      {Object.entries(byCategory).map(([cat, groups]) => (
        <section key={cat} className="mb-6">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{cat}</h2>
          <div className="space-y-2">
            {groups.map((g) => {
              const st = GROUP_STATUS[g.status ?? "no_proposal"];
              const host = (hosts ?? []).find((h) => h.group_id === g.group_id);
              return (
                <Link key={g.group_id} href={`/grupa/${g.group_id}`} className="block">
                  <Card className="active:bg-slate-50">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{g.group_name}</span>
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
