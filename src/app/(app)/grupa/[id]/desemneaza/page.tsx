import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { GymPicker } from "@/components/gym-picker";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { canAdminRegion, requireUser } from "@/lib/auth";
import { getGroupDetail, getGyms } from "@/lib/queries";
import { adminAssignOrganizer } from "../../actions";

/** Admin: choose which team organises the tournament of this group. */
export default async function AssignOrganizerPage({ params }: PageProps<"/grupa/[id]/desemneaza">) {
  const { id } = await params;
  const user = await requireUser();
  const [detail, gyms] = await Promise.all([getGroupDetail(id), getGyms()]);
  if (!detail) notFound();
  if (!canAdminRegion(user, detail.overview.region)) redirect(`/grupa/${id}`);

  const confirmed = detail.proposals.find((p) => p.id === detail.overview.confirmed_proposal_id);
  const live = detail.proposals.filter((p) => p.status === "pending" || p.status === "confirmed");
  // pre-fill from the current organiser, or the only pending proposal
  const base = confirmed ?? (live.length === 1 ? live[0] : undefined);

  return (
    <>
      <PageTitle
        back={`/grupa/${id}`}
        sub={`${detail.overview.category_name} · ${detail.overview.tournament_name} · ${detail.overview.group_name}`}
      >
        Desemnează organizatorul
      </PageTitle>

      <p className="mb-4 rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
        Echipa aleasă devine organizatorul confirmat al turneului.
        {live.length > 0 && " Celelalte propuneri active din grupă vor fi marcate „Neselectat”."}
      </p>

      <Card>
        <ActionForm action={adminAssignOrganizer}>
          <input type="hidden" name="group_id" value={id} />
          <Field label="Echipa organizatoare">
            <select name="team_id" required defaultValue={base?.team_id ?? ""} className={inputClass}>
              <option value="" disabled>
                Alegeți echipa…
              </option>
              {detail.teams.map((t) => {
                const proposed = live.find((p) => p.team_id === t.id);
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {proposed ? (proposed.status === "confirmed" ? " (organizator actual)" : " (s-a oferit)") : ""}
                  </option>
                );
              })}
            </select>
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Data turneului">
              <input name="start_date" type="date" required defaultValue={base?.start_date} className={inputClass} />
            </Field>
            <Field label="Până la (opțional)">
              <input name="end_date" type="date" defaultValue={base?.end_date ?? ""} className={inputClass} />
            </Field>
          </div>

          <GymPicker gyms={gyms} defaultId={base?.gym_id} />

          <Field label="Observații (opțional)">
            <textarea name="notes" rows={2} defaultValue={base?.notes ?? ""} className={inputClass} />
          </Field>

          <SubmitButton>Desemnează organizatorul</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}
