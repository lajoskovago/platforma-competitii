import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { OfficialsSummary } from "@/components/officials";
import { Badge, Card, Empty, LinkButton, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { canActForTeam, canAdminRegion, requireUser, type CurrentUser } from "@/lib/auth";
import { GROUP_STATUS, PROPOSAL_STATUS, formatDateRange, formatDateTime, formatUntilDay, mapsLink } from "@/lib/format";
import { getAutoConfirmUntil, getGroupDetail, type GroupDetail } from "@/lib/queries";
import { GroupAdminPanel } from "./group-admin-panel";
import { adminConfirmProposal, adminUnconfirmGroup, respondToProposal, withdrawProposal } from "../actions";

export default async function GroupPage({ params }: PageProps<"/grupa/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const [detail, autoUntil] = await Promise.all([getGroupDetail(id), getAutoConfirmUntil()]);
  if (!detail) notFound();

  const { overview, teams, proposals, games, standings, nominations } = detail;
  const st = GROUP_STATUS[overview.status ?? "no_proposal"];
  const teamName = (tid: string | null) => teams.find((t) => t.id === tid)?.name ?? "";
  const teamById = (tid: string | null) => teams.find((t) => t.id === tid);
  const canAdmin = canAdminRegion(user, overview.region);

  const live = proposals.filter((p) => p.status === "pending" || p.status === "confirmed");
  const past = proposals.filter((p) => p.status === "withdrawn" || p.status === "not_selected");
  const confirmed = proposals.find((p) => p.id === overview.confirmed_proposal_id);

  const myGroupTeams = teams.filter((t) => user.teamIds.has(t.id));
  const canVolunteer = !confirmed && teams.some((t) => canActForTeam(user, t) && !live.some((p) => p.team_id === t.id));
  const isHost = !!confirmed && canActForTeam(user, teamById(confirmed.team_id));

  return (
    <>
      <PageTitle
        back="/"
        sub={
          <>
            {overview.category_name} · {overview.tournament_name}
            {overview.region ? ` · ${overview.region}` : " · SR5 + SR6"}
            {detail.notes && <> · {detail.notes}</>}
          </>
        }
      >
        {overview.group_name}
      </PageTitle>
      <Badge tone={st.tone}>{st.label}</Badge>

      {/* ------------------------------------------------ Organiser */}
      <SectionTitle>Organizare</SectionTitle>

      {confirmed && (
        <Card className="border-emerald-300 bg-emerald-50/50">
          <div className="text-xs font-semibold uppercase text-emerald-700">Organizator confirmat</div>
          <div className="mt-1 text-lg font-semibold">{teamName(confirmed.team_id)}</div>
          <GymAndDate p={confirmed} />
          {confirmed.confirmed_by_admin && <p className="mt-2 text-xs text-slate-500">Decis de administrator.</p>}
          {confirmed.auto_confirmed && <p className="mt-2 text-xs text-slate-500">⚡ Confirmat automat.</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {(isHost || canAdmin) && (
              <LinkButton href={`/grupa/${id}/program`} variant="primary">
                {games.length ? "Program & rezultate" : "Adaugă programul meciurilor"}
              </LinkButton>
            )}
            {isHost && (
              <LinkButton href={`/grupa/${id}/organizeaza?propunere=${confirmed.id}`} variant="secondary">
                Modifică data / sala
              </LinkButton>
            )}
          </div>
          {canAdmin && (
            <div className="mt-3 flex flex-wrap gap-2 border-t border-emerald-200 pt-3">
              <LinkButton href={`/grupa/${id}/desemneaza`} variant="secondary">
                Schimbă organizatorul (admin)
              </LinkButton>
              <ActionForm action={adminUnconfirmGroup} className="" confirm="Anulați confirmarea organizatorului?">
                <input type="hidden" name="group_id" value={id} />
                <SubmitButton variant="danger" full={false}>
                  Anulează confirmarea (admin)
                </SubmitButton>
              </ActionForm>
            </div>
          )}
        </Card>
      )}

      {!confirmed && autoUntil && (
        <p className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-900">
          ⚡ Până {formatUntilDay(autoUntil)} inclusiv, prima echipă care se oferă să organizeze este confirmată automat.
        </p>
      )}

      {!confirmed && live.length === 0 && <Empty>Nicio echipă nu s-a oferit încă să organizeze acest turneu.</Empty>}

      {!confirmed && live.length > 1 && (
        <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">
          Mai multe echipe doresc să organizeze. Un administrator va decide organizatorul.
        </p>
      )}

      <div className="space-y-3">
        {live
          .filter((p) => p.status === "pending")
          .map((p) => (
            <ProposalCard key={p.id} p={p} groupId={id} detail={detail} user={user} canAdmin={canAdmin} teamName={teamName} />
          ))}
      </div>

      {canVolunteer && (
        <div className="mt-3">
          <LinkButton href={`/grupa/${id}/organizeaza`} full>
            🏠 Vreau să organizez
          </LinkButton>
        </div>
      )}

      {canAdmin && !confirmed && (
        <div className="mt-3">
          <LinkButton href={`/grupa/${id}/desemneaza`} variant="secondary" full>
            Desemnează organizatorul (admin)
          </LinkButton>
        </div>
      )}

      {/* ------------------------------------------------ Program */}
      <SectionTitle
        action={
          (isHost || (canAdmin && confirmed)) && games.length > 0 ? (
            <Link href={`/grupa/${id}/program`} className="text-sm font-medium text-orange-700">
              Editează
            </Link>
          ) : null
        }
      >
        Program
      </SectionTitle>
      {games.length === 0 ? (
        <Empty>
          {confirmed
            ? "Organizatorul nu a adăugat încă programul meciurilor."
            : "Programul va fi adăugat de organizator după confirmare."}
        </Empty>
      ) : (
        <Card className="divide-y divide-slate-100 p-0!">
          {games.map((g) => {
            const home = g.home_team_id ? teamName(g.home_team_id) : g.home_label;
            const away = g.away_team_id ? teamName(g.away_team_id) : g.away_label;
            return (
              <Link key={g.id} href={`/meci/${g.id}`} className="block px-4 py-3 active:bg-slate-50">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>
                    {formatDateTime(g.starts_at)} {g.label && `· ${g.label}`}
                  </span>
                  {g.status === "forfeit_home" && <Badge tone="red">Neprezentare gazdă</Badge>}
                  {g.status === "forfeit_away" && <Badge tone="red">Neprezentare oaspete</Badge>}
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className="font-medium">{home}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-center font-mono text-sm tabular-nums">
                    {g.status === "played" ? `${g.home_score} – ${g.away_score}` : "–"}
                  </span>
                  <span className="text-right font-medium">{away}</span>
                </div>
                {g.gym && g.gym_id !== confirmed?.gym_id && (
                  <div className="mt-1 text-xs text-slate-500">
                    📍 {g.gym.name}, {g.gym.city}
                  </div>
                )}
                <OfficialsSummary nominations={nominations.filter((n) => n.game_id === g.id)} />
              </Link>
            );
          })}
        </Card>
      )}

      {/* ------------------------------------------------ Standings */}
      {standings.some((s) => (s.played ?? 0) > 0) && (
        <>
          <SectionTitle>Clasament</SectionTitle>
          <Card className="overflow-x-auto p-0!">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th className="px-3 py-2 text-left">Echipa</th>
                  <th className="px-2 py-2">M</th>
                  <th className="px-2 py-2">V</th>
                  <th className="px-2 py-2">Î</th>
                  <th className="px-2 py-2">+/-</th>
                  <th className="px-3 py-2">Pct</th>
                </tr>
              </thead>
              <tbody>
                {[...standings]
                  .sort(
                    (a, b) =>
                      (b.points ?? 0) - (a.points ?? 0) ||
                      (b.points_for ?? 0) - (b.points_against ?? 0) - ((a.points_for ?? 0) - (a.points_against ?? 0)),
                  )
                  .map((s) => (
                    <tr key={s.team_id} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium">{teamName(s.team_id)}</td>
                      <td className="px-2 py-2 text-center">{s.played}</td>
                      <td className="px-2 py-2 text-center">{s.won}</td>
                      <td className="px-2 py-2 text-center">{s.lost}</td>
                      <td className="px-2 py-2 text-center">{(s.points_for ?? 0) - (s.points_against ?? 0)}</td>
                      <td className="px-3 py-2 text-center font-semibold">{s.points}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
            <p className="px-3 py-2 text-xs text-slate-400">2 pct victorie · 1 pct înfrângere · 0 pct neprezentare</p>
          </Card>
        </>
      )}

      {/* ------------------------------------------------ Teams & contacts */}
      <SectionTitle>Echipe și contacte</SectionTitle>
      <Card className="divide-y divide-slate-100 p-0!">
        {teams.map((t) => (
          <div key={t.id} className="px-4 py-3">
            <div className="font-medium">
              {t.name}
              {myGroupTeams.some((m) => m.id === t.id) && (
                <span className="ml-2 align-middle">
                  <Badge tone="blue">echipa mea</Badge>
                </span>
              )}
            </div>
            <div className="text-xs text-slate-500">{t.club.name}</div>
            {[...t.coaches, ...t.managers.filter((m) => !t.coaches.some((c) => c.id === m.id))].map((p) => (
              <div key={p.id} className="mt-1 flex flex-wrap items-center gap-x-3 text-sm">
                <span>
                  {p.full_name || p.email}
                  {t.managers.some((m) => m.id === p.id) && (
                    <span className="text-xs text-slate-400"> (admin club)</span>
                  )}
                </span>
                {p.phone && (
                  <a href={`tel:${p.phone}`} className="py-1 text-orange-700 underline">
                    {p.phone}
                  </a>
                )}
              </div>
            ))}
          </div>
        ))}
      </Card>

      {canAdmin && <GroupAdminPanel detail={detail} user={user} />}

      {past.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer py-2 text-sm text-slate-500">Istoric propuneri ({past.length})</summary>
          <div className="mt-2 space-y-2">
            {past.map((p) => (
              <Card key={p.id} className="text-sm text-slate-600">
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{teamName(p.team_id)}</span>
                  <Badge tone={PROPOSAL_STATUS[p.status].tone}>{PROPOSAL_STATUS[p.status].label}</Badge>
                </div>
                <GymAndDate p={p} />
                <Responses p={p} detail={detail} teamName={teamName} />
              </Card>
            ))}
          </div>
        </details>
      )}
    </>
  );
}

type P = GroupDetail["proposals"][number];

function GymAndDate({ p }: { p: P }) {
  return (
    <div className="mt-1 space-y-0.5 text-sm text-slate-700">
      <div>📅 {formatDateRange(p.start_date, p.end_date)}</div>
      {p.gym && (
        <div>
          📍{" "}
          <a href={mapsLink(p.gym)} target="_blank" rel="noreferrer" className="underline">
            {p.gym.name}, {p.gym.city}
          </a>
          {p.gym.address && <span className="text-slate-500"> – {p.gym.address}</span>}
        </div>
      )}
      {p.notes && <div className="text-slate-500">💬 {p.notes}</div>}
    </div>
  );
}

function Responses({ p, detail, teamName }: { p: P; detail: GroupDetail; teamName: (id: string) => string }) {
  const others = detail.teams.filter((t) => t.id !== p.team_id);
  return (
    <ul className="mt-3 space-y-1.5 text-sm">
      {others.map((t) => {
        const r = p.proposal_responses.find((x) => x.team_id === t.id);
        return (
          <li key={t.id} className="flex flex-wrap items-baseline gap-x-2">
            <span>{r ? (r.response === "accept" ? "✅" : "❌") : "⏳"}</span>
            <span className="font-medium">{teamName(t.id)}</span>
            <span className="text-slate-500">
              {r ? (r.response === "accept" ? "a acceptat" : "a respins") : "nu a răspuns"}
              {r?.responded_by && ` (${detail.personName(r.responded_by)})`}
            </span>
            {r?.reason && <span className="w-full pl-6 text-red-700">Motiv: {r.reason}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function ProposalCard({
  p,
  groupId,
  detail,
  user,
  canAdmin,
  teamName,
}: {
  p: P;
  groupId: string;
  detail: GroupDetail;
  user: CurrentUser;
  canAdmin: boolean;
  teamName: (id: string) => string;
}) {
  const isMine = canActForTeam(user, detail.teams.find((t) => t.id === p.team_id));
  // Coaches / club admins answer for their own teams; admins decide with the admin button.
  const answerFor = detail.teams.filter((t) => t.id !== p.team_id && user.teamIds.has(t.id));

  return (
    <Card className="border-amber-300">
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase text-amber-700">Propunere de organizare</div>
          <div className="text-lg font-semibold">{teamName(p.team_id)}</div>
          {p.proposed_by && <div className="text-xs text-slate-500">de {detail.personName(p.proposed_by)}</div>}
        </div>
        <Badge tone="amber">În așteptare</Badge>
      </div>
      <GymAndDate p={p} />
      <Responses p={p} detail={detail} teamName={teamName} />

      {answerFor.map((t) => {
        const r = p.proposal_responses.find((x) => x.team_id === t.id);
        return (
          <div key={t.id} className="mt-4 rounded-lg bg-slate-50 p-3">
            <div className="mb-2 text-sm font-medium">
              Răspuns pentru {t.name}
              {r && <span className="font-normal text-slate-500"> (puteți schimba răspunsul)</span>}
            </div>
            <ActionForm action={respondToProposal} className="space-y-2">
              <input type="hidden" name="proposal_id" value={p.id} />
              <input type="hidden" name="team_id" value={t.id} />
              <input type="hidden" name="group_id" value={groupId} />
              <input type="hidden" name="response" value="accept" />
              <SubmitButton variant="success">✅ Accept</SubmitButton>
            </ActionForm>
            <details className="mt-2">
              <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-red-300 bg-white text-sm font-semibold text-red-700">
                ❌ Resping
              </summary>
              <ActionForm action={respondToProposal} className="mt-2 space-y-2">
                <input type="hidden" name="proposal_id" value={p.id} />
                <input type="hidden" name="team_id" value={t.id} />
                <input type="hidden" name="group_id" value={groupId} />
                <input type="hidden" name="response" value="reject" />
                <textarea
                  name="reason"
                  required
                  rows={2}
                  placeholder="Motivul (vizibil pentru toți antrenorii din grupă și administratori)"
                  className={inputClass}
                />
                <SubmitButton variant="danger">Trimite respingerea</SubmitButton>
              </ActionForm>
            </details>
          </div>
        );
      })}

      {isMine && (
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton href={`/grupa/${groupId}/organizeaza?propunere=${p.id}`} variant="secondary">
            Modifică
          </LinkButton>
          <ActionForm action={withdrawProposal} className="" confirm="Retrageți propunerea de organizare?">
            <input type="hidden" name="proposal_id" value={p.id} />
            <SubmitButton variant="danger" full={false}>
              Retrage propunerea
            </SubmitButton>
          </ActionForm>
        </div>
      )}

      {canAdmin && (
        <ActionForm action={adminConfirmProposal} className="mt-4" confirm={`Confirmați ${teamName(p.team_id)} ca organizator?`}>
          <input type="hidden" name="proposal_id" value={p.id} />
          <input type="hidden" name="group_id" value={groupId} />
          <SubmitButton variant="secondary">Admin: alege acest organizator</SubmitButton>
        </ActionForm>
      )}
    </Card>
  );
}
