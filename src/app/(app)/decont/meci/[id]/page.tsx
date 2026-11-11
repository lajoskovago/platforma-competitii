import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
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
          {g.fees.map((f) => (
            <Field
              key={f.nominationId}
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
          ))}
          <p className="text-sm">
            Total: <strong>{lei(g.total)}</strong>
          </p>
        </Card>

        <SectionTitle>Cine plătește</SectionTitle>
        <Card className="space-y-3">
          <Field label="Plătitor" hint={`Implicit: ${g.competition === "regional" ? "ambele echipe (turneu)" : "doar gazda"}`}>
            <select name="payer" defaultValue={g.payerIsDefault ? "" : g.payer} className={inputClass}>
              <option value="">Implicit</option>
              <option value="home">Doar echipa gazdă</option>
              <option value="both">Ambele echipe</option>
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label={`${g.home} (gazdă)`} hint="Gol = calculat automat">
              <input
                name="home_amount"
                inputMode="decimal"
                defaultValue={g.homeAmountIsDefault ? "" : String(g.homeAmount)}
                placeholder={String(g.homeAmount)}
                className={inputClass}
              />
            </Field>
            <Field label={`${g.away} (oaspete)`} hint="Doar dacă plătesc ambele">
              <input
                name="away_amount"
                inputMode="decimal"
                defaultValue={g.awayAmountIsDefault ? "" : String(g.awayAmount)}
                placeholder={String(g.awayAmount)}
                className={inputClass}
              />
            </Field>
          </div>
        </Card>

        <div className="mt-4">
          <SubmitButton>Salvează</SubmitButton>
        </div>
      </ActionForm>
    </>
  );
}
