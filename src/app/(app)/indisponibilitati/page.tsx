import { redirect } from "next/navigation";
import { Chips } from "@/components/game-list";
import { Badge, Card, Empty, PageTitle, inputClass } from "@/components/ui";
import { isNominator, requireUser } from "@/lib/auth";
import { formatDateRange, isoToBucharest } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * All unavailability of referees / table officials.
 * Master admin: everyone. Regional admins and nomination delegates: their region (RLS).
 */
export default async function AllUnavailabilityPage({ searchParams }: PageProps<"/indisponibilitati">) {
  const user = await requireUser();
  if (!isNominator(user)) redirect("/");
  const { cand = "upcoming", regiune = "", q = "" } = (await searchParams) as Record<string, string | undefined>;

  const today = isoToBucharest(new Date().toISOString()).date;
  const supabase = await createSupabaseServer();
  let query = supabase.from("official_unavailability").select("*").order("start_date").order("start_time");
  if (cand === "upcoming") query = query.gte("end_date", today);
  else query = query.lt("end_date", today);
  const { data: rows } = await query.limit(500);

  const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: people } = ids.length
    ? await supabase.from("profile_names").select("id, full_name, region, is_referee, is_table_official").in("id", ids)
    : { data: [] };
  const person = (id: string) => (people ?? []).find((p) => p.id === id);

  const needle = q
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
  const list = (rows ?? []).filter((r) => {
    const p = person(r.user_id);
    if (regiune && p?.region !== regiune) return false;
    if (needle) {
      const n = (p?.full_name ?? "")
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase();
      if (!n.includes(needle)) return false;
    }
    return true;
  });
  if (cand !== "upcoming") list.reverse();

  // group by first day of the period
  const byDay = list.reduce<Record<string, typeof list>>((acc, r) => {
    (acc[r.start_date] ??= []).push(r);
    return acc;
  }, {});

  const href = (c: string, r: string) => {
    const p = new URLSearchParams();
    if (c !== "upcoming") p.set("cand", c);
    if (r) p.set("regiune", r);
    if (q) p.set("q", q);
    const s = p.toString();
    return s ? `/indisponibilitati?${s}` : "/indisponibilitati";
  };

  return (
    <>
      <PageTitle sub={user.isMaster ? "Toți arbitrii și oficialii" : `Arbitrii și oficialii din ${user.region}`}>
        Indisponibilități
      </PageTitle>

      <Chips
        items={[
          { key: "upcoming", label: "Actuale și viitoare" },
          { key: "past", label: "Trecute" },
        ]}
        active={cand}
        href={(k) => href(k, regiune)}
      />
      {user.isMaster && (
        <Chips
          items={[
            { key: "", label: "Toate regiunile" },
            { key: "SR5", label: "SR5" },
            { key: "SR6", label: "SR6" },
          ]}
          active={regiune}
          href={(k) => href(cand, k)}
        />
      )}
      <form className="mb-4">
        {cand !== "upcoming" && <input type="hidden" name="cand" value={cand} />}
        {regiune && <input type="hidden" name="regiune" value={regiune} />}
        <input name="q" defaultValue={q} placeholder="Caută după nume…" className={inputClass} />
      </form>

      {list.length === 0 ? (
        <Empty>Nicio indisponibilitate pentru filtrul ales.</Empty>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-slate-500">{list.length} perioade</p>
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
