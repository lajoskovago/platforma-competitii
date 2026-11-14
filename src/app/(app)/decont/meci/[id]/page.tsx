import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { CheckAll } from "@/components/check-all";
import { Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getDecont, lei } from "@/lib/decont";
import { POSITION_LABEL, formatDateTime, type OfficialPosition } from "@/lib/format";
import { saveGameCharge } from "../../actions";

/** Master: who pays for a game's officials, custom team amounts, individual fees. */
export default async function DecontGamePage({ params }: PageProps<"/decont/meci/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  if (!user.isMaster) redirect("/decont/meciuri");
  const { games, people } = await getDecont();
  const g = games.find((x) => x.id === id);
  if (!g) notFound();
  const name = (uid: string) => people.find((p) => p.userId === uid)?.name ?? "";

  return (
    <>
      <PageTitle back="/decont/meciuri" sub={`${formatDateTime(g.startsAt)} · ${g.competition === "national" ? "Național" : "Regional"} · ${g.categoryName}`}>
        {g.home} – {g.away}
      </PageTitle>

      <ActionForm action={saveGameCharge}>
        <input type="hidden" name="game_id" value={g.id} />

        <SectionTitle>Sumele oficialilor</SectionTitle>
        <Card className="space-y-3">
          {g.fees.length > 1 && (
            <div className="border-b border-slate-100 pb-2">
              <CheckAll prefix="self_" label="Toți facturează singuri la acest meci" />
            </div>
          )}
          {g.fees.map((f) => (
            <div key={f.nominationId} className="space-y-1">
              <Field
                label={`${name(f.userId)} · ${POSITION_LABEL[f.position as OfficialPosition]}`}
                hint={f.fromRate ? (f.missingRate ? "Fără tarif pentru această categorie / poziție" : "Din tarif – lăsați gol pentru tarif") : "Sumă modificată – ștergeți pentru tarif"}
              >
                <input
                  name={`fee_${f.nominationId}`}
                  inputMode="decimal"
                  defaultValue={f.fromRate ? "" : String(f.amount)}
                  placeholder={f.fromRate ? String(f.amount) : ""}
                  className={inputClass}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" name={`self_${f.nominationId}`} defaultChecked={f.selfInvoiced} className="h-4 w-4 accent-orange-600" />
                Facturează singur (nu intră în decont, apare în raport)
              </label>
            </div>
          ))}
          <p className="text-sm">
            Total prin decont: <strong>{lei(g.total)}</strong>
          </p>
        </Card>

        <SectionTitle>Cine plătește</SectionTitle>
        <Card className="space-y-3">
          <Field label="Plătitor" hint={`Implicit: ${g.competition === "regional" ? "împărțit în două (turneu)" : "gazda plătește tot"}`}>
            <select name="payer" defaultValue={g.payerIsDefault ? "" : g.payer} className={inputClass}>
              <option value="">Implicit</option>
              <option value="home">Gazda plătește tot</option>
              <option value="away">Oaspetele plătește tot</option>
              <option value="both">Împărțit în două</option>
            </select>
          </Field>
          <div className="space-y-1 rounded-lg bg-slate-50 p-3 text-sm">
            {g.teamFee === null ? (
              <p className="text-amber-700">
                ⚠️ Suma pe echipă nu este stabilită pentru această categorie (Tarife).
              </p>
            ) : (
              <>
                {g.homeAmount > 0 && (
                  <p>
                    {g.home} (gazdă): <strong>{lei(g.homeAmount)}</strong>
                  </p>
                )}
                {g.awayAmount > 0 && (
                  <p>
                    {g.away} (oaspete): <strong>{lei(g.awayAmount)}</strong>
                  </p>
                )}
                <p className="text-xs text-slate-500">
                  {lei(g.teamFee)} pe meci la {g.categoryName}. Oficialii primesc {lei(g.total)} din ce plătesc echipele.
                </p>
              </>
            )}
          </div>
        </Card>

        <div className="mt-4">
          <SubmitButton>Salvează</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
