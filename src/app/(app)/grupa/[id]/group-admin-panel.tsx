import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, inputClass } from "@/components/ui";
import type { CurrentUser } from "@/lib/auth";
import type { GroupDetail } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";
import { addTeamToGroup, deleteGroup, removeTeamFromGroup, updateGroup } from "../admin-actions";

/** Admin tools for one group: edit, teams in / out, delete. */
export async function GroupAdminPanel({ detail, user }: { detail: GroupDetail; user: CurrentUser }) {
  const { overview } = detail;
  const groupId = overview.group_id!;
  const supabase = await createSupabaseServer();
  const [{ data: group }, { data: categoryTeams }] = await Promise.all([
    supabase.from("groups").select("name, region, notes").eq("id", groupId).single(),
    supabase
      .from("teams")
      .select("id, name, group_teams(group_id, groups(name, tournament_id))")
      .eq("category_id", overview.category_id!)
      .order("name"),
  ]);

  const inGroup = new Set(detail.teams.map((t) => t.id));
  const candidates = (categoryTeams ?? [])
    .filter((t) => !inGroup.has(t.id))
    .map((t) => {
      const other = t.group_teams.find((m) => m.groups?.tournament_id === overview.tournament_id);
      return { id: t.id, label: other ? `${t.name} (acum în ${other.groups?.name})` : `${t.name} (fără grupă)` };
    });

  return (
    <details className="mt-6 rounded-xl border border-slate-300 bg-white">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 font-semibold text-slate-700">
        ⚙️ Administrare grupă (admin)
      </summary>
      <div className="space-y-4 border-t border-slate-200 p-4">
        <Card>
          <ActionForm action={updateGroup}>
            <input type="hidden" name="group_id" value={groupId} />
            <Field label="Nume grupă">
              <input name="name" required defaultValue={group?.name} className={inputClass} />
            </Field>
            {user.isMaster && (
              <Field label="Regiune" hint="Decide ce administrator regional și ce arbitri se ocupă de grupă">
                <select name="region" defaultValue={group?.region ?? ""} className={inputClass}>
                  <option value="">SR5 + SR6 (mixt)</option>
                  <option value="SR5">SR5</option>
                  <option value="SR6">SR6</option>
                </select>
              </Field>
            )}
            <Field label="Observații">
              <input name="notes" defaultValue={group?.notes ?? ""} placeholder="ex. Fiecare cu fiecare" className={inputClass} />
            </Field>
            <SubmitButton variant="secondary">Salvează grupa</SubmitButton>
          </ActionForm>
        </Card>

        <Card>
          <h3 className="mb-2 text-sm font-semibold">Echipe în grupă ({detail.teams.length})</h3>
          <div className="divide-y divide-slate-100">
            {detail.teams.map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 py-2">
                <span className="text-sm">{t.name}</span>
                <ActionForm action={removeTeamFromGroup} className="" confirm={`Scoateți ${t.name} din grupă?`}>
                  <input type="hidden" name="group_id" value={groupId} />
                  <input type="hidden" name="team_id" value={t.id} />
                  <SubmitButton variant="danger" full={false}>
                    Scoate
                  </SubmitButton>
                </ActionForm>
              </div>
            ))}
          </div>
          <ActionForm action={addTeamToGroup} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <input type="hidden" name="group_id" value={groupId} />
            <select name="team_id" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Adaugă / mută o echipă din {overview.category_code}…
              </option>
              {candidates.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <SubmitButton variant="secondary">+ Adaugă în grupă</SubmitButton>
            <p className="text-xs text-slate-500">
              O echipă din altă grupă este mutată aici. Echipele noi se creează din pagina Echipe.
            </p>
          </ActionForm>
        </Card>

        <ActionForm action={deleteGroup} confirm={`Ștergeți definitiv ${overview.group_name}?`}>
          <input type="hidden" name="group_id" value={groupId} />
          <SubmitButton variant="danger">Șterge grupa</SubmitButton>
          <p className="text-xs text-slate-500">Posibil doar dacă grupa nu are propuneri de organizare sau meciuri.</p>
        </ActionForm>
      </div>
    </details>
  );
}
