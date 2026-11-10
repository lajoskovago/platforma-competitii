import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { GymPicker } from "@/components/gym-picker";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { canAdminRegion, requireUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/format";
import { getGroupDetail, getGyms } from "@/lib/queries";
import { adminUpdateTournament } from "../../admin-actions";

/** Admin: change date and/or gym of a tournament whose organiser is confirmed. */
export default async function EditTournamentPage({ params }: PageProps<"/grupa/[id]/modifica-turneu">) {
  const { id } = await params;
  const user = await requireUser();
  const [detail, gyms] = await Promise.all([getGroupDetail(id), getGyms()]);
  if (!detail) notFound();
  if (!canAdminRegion(user, detail.overview.region)) redirect(`/grupa/${id}`);
  const confirmed = detail.proposals.find((p) => p.id === detail.overview.confirmed_proposal_id);
  if (!confirmed) redirect(`/grupa/${id}`);
  const host = detail.teams.find((t) => t.id === confirmed.team_id);

  return (
    <>
      <PageTitle
        back={`/grupa/${id}`}
        sub={`${detail.overview.category_name} · ${detail.overview.tournament_name} · ${detail.overview.group_name}`}
      >
        Modifică data / sala
      </PageTitle>

      <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
        Organizator: <strong>{host?.name}</strong> (rămâne confirmat).
        <br />
        Acum: {formatDateRange(confirmed.start_date, confirmed.end_date)} · {confirmed.gym?.name}, {confirmed.gym?.city}
      </p>

      <Card>
        <ActionForm action={adminUpdateTournament}>
          <input type="hidden" name="group_id" value={id} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Data turneului">
              <input name="start_date" type="date" required defaultValue={confirmed.start_date} className={inputClass} />
            </Field>
            <Field label="Până la (opțional)" hint="Doar dacă turneul durează mai multe zile">
              <input name="end_date" type="date" defaultValue={confirmed.end_date ?? ""} className={inputClass} />
            </Field>
          </div>

          <GymPicker gyms={gyms} defaultId={confirmed.gym_id} />

          <Field label="Observații (opțional)">
            <textarea name="notes" rows={2} defaultValue={confirmed.notes ?? ""} className={inputClass} />
          </Field>

          {detail.games.length > 0 && (
            <label className="flex items-start gap-3 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm">
              <input type="checkbox" name="move_games" defaultChecked className="mt-0.5 h-5 w-5 shrink-0 accent-orange-600" />
              <span>
                <strong>Mută și cele {detail.games.length} meciuri programate</strong>
                <span className="block text-xs text-slate-600">
                  Meciurile se mută cu același număr de zile, la aceleași ore. Cele din sala veche trec în sala nouă.
                </span>
              </span>
            </label>
          )}

          <SubmitButton>Salvează modificările</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
