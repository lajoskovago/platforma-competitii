import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { POSITION_LABEL, REFEREE_POSITIONS, TABLE_POSITIONS } from "@/lib/format";
import { createSupabaseServer } from "@/lib/supabase/server";
import { saveRates } from "../actions";

/** Master: officials' fee per category (regional / national) and position. */
export default async function RatesPage({ searchParams }: PageProps<"/decont/tarife">) {
  const user = await requireUser();
  if (!user.isMaster) redirect("/decont");
  const { cat } = (await searchParams) as Record<string, string | undefined>;
  const supabase = await createSupabaseServer();
  const [{ data: categories }, { data: rates }] = await Promise.all([
    supabase.from("categories").select("id, code, name, scope, sort_order").order("sort_order"),
    supabase.from("fee_rates").select("*"),
  ]);
  const cats = categories ?? [];
  const current = cats.find((c) => c.id === cat) ?? cats[0];
  const rateOf = (pos: string) => (rates ?? []).find((r) => r.category_id === current?.id && r.position === pos);
  const countFor = (id: string) => (rates ?? []).filter((r) => r.category_id === id).length;
  const sameScope = cats.filter((c) => c.scope === current?.scope && c.id !== current?.id);

  return (
    <>
      <PageTitle back="/decont" sub="Suma pe meci pentru fiecare poziție. Gol = fără tarif (0).">
        Tarife arbitri și oficiali
      </PageTitle>

      {(["regional", "national"] as const).map((scope) => (
        <div key={scope} className="mb-3">
          <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {scope === "regional" ? "Campionate regionale" : "Campionatul Național"}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cats
              .filter((c) => c.scope === scope)
              .map((c) => (
                <Link
                  key={c.id}
                  href={`/decont/tarife?cat=${c.id}`}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    c.id === current?.id ? "border-orange-600 bg-orange-600 text-white" : "border-slate-300 bg-white"
                  }`}
                >
                  {c.code}
                  {countFor(c.id) > 0 ? " ✓" : ""}
                </Link>
              ))}
          </div>
        </div>
      ))}

      {current && (
        <ActionForm action={saveRates}>
          <input type="hidden" name="category_id" value={current.id} />
          <SectionTitle>
            {current.scope === "national" ? "Național" : "Regional"} · {current.name}
          </SectionTitle>
          <Card className="space-y-3">
            <div className="text-xs font-semibold uppercase text-slate-500">Arbitri</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {REFEREE_POSITIONS.map((pos) => (
                <Field key={pos} label={POSITION_LABEL[pos]}>
                  <input name={`rate_${pos}`} inputMode="decimal" defaultValue={rateOf(pos)?.amount ?? ""} placeholder="lei" className={inputClass} />
                </Field>
              ))}
            </div>
            <div className="pt-2 text-xs font-semibold uppercase text-slate-500">Oficiali de masă</div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {TABLE_POSITIONS.map((pos) => (
                <Field key={pos} label={POSITION_LABEL[pos]}>
                  <input name={`rate_${pos}`} inputMode="decimal" defaultValue={rateOf(pos)?.amount ?? ""} placeholder="lei" className={inputClass} />
                </Field>
              ))}
            </div>
          </Card>

          {sameScope.length > 0 && (
            <details className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
              <summary className="cursor-pointer text-sm font-medium text-slate-700">
                Aplică aceleași tarife și la alte categorii {current.scope === "national" ? "naționale" : "regionale"}
              </summary>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {sameScope.map((c) => (
                  <label key={c.id} className="flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-2 text-sm">
                    <input type="checkbox" name="category_id" value={c.id} className="h-4 w-4 accent-orange-600" />
                    {c.code}
                  </label>
                ))}
              </div>
            </details>
          )}

          <div className="mt-4">
            <SubmitButton>Salvează tarifele</SubmitButton>
          </div>
        </ActionForm>
      )}
    </>
  );
}
