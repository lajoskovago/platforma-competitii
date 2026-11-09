import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { GymPicker } from "@/components/gym-picker";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { canActForTeam, requireUser } from "@/lib/auth";
import { getAutoConfirmUntil, getGroupDetail, getGyms } from "@/lib/queries";
import { CONDITIONS_TEXT, formatUntilDay } from "@/lib/format";
import { saveProposal } from "../../actions";

export default async function OrganisePage({ params, searchParams }: PageProps<"/grupa/[id]/organizeaza">) {
  const { id } = await params;
  const { propunere } = await searchParams;
  const user = await requireUser();
  const [detail, gyms, autoUntil] = await Promise.all([getGroupDetail(id), getGyms(), getAutoConfirmUntil()]);
  if (!detail) notFound();

  const editing = typeof propunere === "string" ? detail.proposals.find((p) => p.id === propunere) : undefined;
  if (propunere && (!editing || !canActForTeam(user, detail.teams.find((t) => t.id === editing.team_id)))) redirect(`/grupa/${id}`);

  const live = detail.proposals.filter((p) => p.status === "pending" || p.status === "confirmed");
  const eligible = detail.teams.filter((t) => canActForTeam(user, t) && !live.some((p) => p.team_id === t.id));
  if (!editing && (eligible.length === 0 || detail.overview.confirmed_proposal_id)) redirect(`/grupa/${id}`);

  return (
    <>
      <PageTitle back={`/grupa/${id}`} sub={`${detail.overview.category_name} · ${detail.overview.tournament_name} · ${detail.overview.group_name}`}>
        {editing ? "Modifică propunerea" : "Vreau să organizez"}
      </PageTitle>

      {autoUntil && live.filter((p) => p.id !== editing?.id).length === 0 ? (
        <p className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          ⚡ Până {formatUntilDay(autoUntil)} inclusiv, propunerile sunt <strong>confirmate automat</strong> (fără acceptul
          celorlalte echipe). După trimitere puteți adăuga imediat programul meciurilor.
        </p>
      ) : (
        editing && (
          <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
            După modificare, celelalte echipe trebuie să accepte din nou propunerea.
          </p>
        )
      )}

      <Card>
        <ActionForm action={saveProposal}>
          <input type="hidden" name="group_id" value={id} />
          {editing && <input type="hidden" name="proposal_id" value={editing.id} />}

          {!editing &&
            (eligible.length === 1 ? (
              <>
                <input type="hidden" name="team_id" value={eligible[0].id} />
                <div className="text-sm">
                  Echipa organizatoare: <strong>{eligible[0].name}</strong>
                </div>
              </>
            ) : (
              <Field label="Echipa organizatoare">
                <select name="team_id" required defaultValue="" className={inputClass}>
                  <option value="" disabled>
                    Alegeți echipa…
                  </option>
                  {eligible.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </Field>
            ))}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Data turneului">
              <input name="start_date" type="date" required defaultValue={editing?.start_date} className={inputClass} />
            </Field>
            <Field label="Până la (opțional)" hint="Doar dacă turneul durează mai multe zile">
              <input name="end_date" type="date" defaultValue={editing?.end_date ?? ""} className={inputClass} />
            </Field>
          </div>

          <GymPicker gyms={gyms} defaultId={editing?.gym_id} />

          <Field label="Observații (opțional)">
            <textarea name="notes" rows={2} defaultValue={editing?.notes ?? ""} className={inputClass} />
          </Field>

          {!editing && (
            <label className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
              <input type="checkbox" name="conditions" required className="mt-0.5 h-5 w-5 shrink-0 accent-orange-600" />
              <span>{CONDITIONS_TEXT}</span>
            </label>
          )}

          <SubmitButton>{editing ? "Salvează modificările" : "Trimite propunerea"}</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
