import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { UserRoleFields } from "@/components/user-role-fields";
import { ROLE_LABEL, requireAdmin } from "@/lib/auth";
import { createSupabaseAdmin, createSupabaseServer } from "@/lib/supabase/server";
import {
  assignClub,
  assignTeam,
  deleteUser,
  resendInvite,
  unassignClub,
  unassignTeam,
  updateUser,
} from "../../actions";

export default async function AdminUserPage({ params }: PageProps<"/admin/utilizatori/[id]">) {
  const { id } = await params;
  const me = await requireAdmin();
  const supabase = await createSupabaseServer();

  const [{ data: profile }, { data: myTeams }, { data: myClubs }, { data: teams }, { data: clubs }, { data: authUser }] =
    await Promise.all([
      supabase.from("profiles").select("*").eq("id", id).maybeSingle(),
      supabase.from("team_coaches").select("team:teams(id, name, category:categories(code, scope))").eq("user_id", id),
      supabase.from("club_managers").select("club:clubs(id, name)").eq("user_id", id),
      supabase
        .from("teams")
        .select("id, name, category:categories(code, name, sort_order, scope)")
        .order("name"),
      supabase.from("clubs").select("id, name").order("name"),
      createSupabaseAdmin().auth.admin.getUserById(id),
    ]);
  if (!profile) notFound();

  const assignedTeamIds = new Set((myTeams ?? []).map((t) => t.team?.id));
  const assignedClubIds = new Set((myClubs ?? []).map((c) => c.club?.id));
  const teamsByCategory = (teams ?? [])
    .filter((t) => !assignedTeamIds.has(t.id))
    .sort((a, b) => (a.category?.sort_order ?? 0) - (b.category?.sort_order ?? 0))
    .reduce<Record<string, { id: string; name: string }[]>>((acc, t) => {
      (acc[`${t.category?.scope === "national" ? "Național" : "Regional"} ${t.category?.name ?? ""}`] ??= []).push(t);
      return acc;
    }, {});
  const active = !!authUser?.user?.last_sign_in_at;
  // regional admins cannot edit other administrators (also enforced in the DB)
  const canEdit = me.isMaster || profile.role === "user";

  return (
    <>
      <PageTitle
        back="/admin/utilizatori"
        sub={
          <span className="flex flex-wrap items-center gap-2">
            {profile.email}
            {profile.role !== "user" && <Badge tone="blue">{ROLE_LABEL[profile.role]}{profile.region ? ` ${profile.region}` : ""}</Badge>}
            {active ? <Badge tone="green">activ</Badge> : <Badge tone="amber">invitat – nu s-a conectat încă</Badge>}
          </span>
        }
      >
        {profile.full_name || profile.email}
      </PageTitle>

      <SectionTitle>Echipe antrenate</SectionTitle>
      <Card className="space-y-3">
        {(myTeams ?? []).length === 0 && <p className="text-sm text-slate-500">Nicio echipă asociată.</p>}
        {(myTeams ?? []).map(({ team }) =>
          team ? (
            <div key={team.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">
                <span className="text-xs font-semibold text-orange-700">
                  {team.category?.scope === "national" ? "Național " : ""}
                  {team.category?.code}
                </span>{" "}
                {team.name}
              </span>
              <ActionForm action={unassignTeam} className="">
                <input type="hidden" name="team_id" value={team.id} />
                <input type="hidden" name="user_id" value={id} />
                <SubmitButton variant="danger" full={false}>
                  Elimină
                </SubmitButton>
              </ActionForm>
            </div>
          ) : null,
        )}
        <ActionForm action={assignTeam} className="space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="user_id" value={id} />
          <select name="team_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Alegeți echipa…
            </option>
            {Object.entries(teamsByCategory).map(([cat, list]) => (
              <optgroup key={cat} label={cat}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
          <SubmitButton variant="secondary">+ Asociază echipa</SubmitButton>
        </ActionForm>
      </Card>

      <SectionTitle>Responsabil de club (vede toate echipele clubului)</SectionTitle>
      <Card className="space-y-3">
        {(myClubs ?? []).length === 0 && <p className="text-sm text-slate-500">Niciun club.</p>}
        {(myClubs ?? []).map(({ club }) =>
          club ? (
            <div key={club.id} className="flex items-center justify-between gap-2">
              <span className="text-sm">🏢 {club.name}</span>
              <ActionForm action={unassignClub} className="">
                <input type="hidden" name="club_id" value={club.id} />
                <input type="hidden" name="user_id" value={id} />
                <SubmitButton variant="danger" full={false}>
                  Elimină
                </SubmitButton>
              </ActionForm>
            </div>
          ) : null,
        )}
        <ActionForm action={assignClub} className="space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="user_id" value={id} />
          <select name="club_id" required defaultValue="" className={inputClass}>
            <option value="" disabled>
              Alegeți clubul…
            </option>
            {(clubs ?? [])
              .filter((c) => !assignedClubIds.has(c.id))
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </select>
          <SubmitButton variant="secondary">+ Asociază clubul</SubmitButton>
        </ActionForm>
      </Card>

      <SectionTitle>Date cont</SectionTitle>
      {canEdit ? (
        <Card>
          <ActionForm action={updateUser}>
            <input type="hidden" name="user_id" value={id} />
            <Field label="Nume și prenume">
              <input name="full_name" defaultValue={profile.full_name} className={inputClass} />
            </Field>
            <Field label="Telefon">
              <input name="phone" type="tel" defaultValue={profile.phone ?? ""} className={inputClass} />
            </Field>
            <UserRoleFields isMaster={me.isMaster} defaults={profile} />
            <SubmitButton>Salvează</SubmitButton>
          </ActionForm>
        </Card>
      ) : (
        <p className="text-sm text-slate-500">Doar administratorul principal poate modifica un administrator.</p>
      )}

      <div className="mt-4 space-y-2">
        <ActionForm action={resendInvite}>
          <input type="hidden" name="user_id" value={id} />
          <input type="hidden" name="email" value={profile.email} />
          <SubmitButton variant="secondary">
            {active ? "Trimite email de resetare a parolei" : "Retrimite invitația"}
          </SubmitButton>
        </ActionForm>
        {canEdit && (
        <ActionForm action={deleteUser} confirm="Ștergeți definitiv acest cont?">
          <input type="hidden" name="user_id" value={id} />
          <SubmitButton variant="danger">Șterge contul</SubmitButton>
        </ActionForm>
        )}
      </div>
    </>
  );
}
