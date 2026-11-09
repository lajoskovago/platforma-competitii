import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, Empty, PageTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { GROUP_STATUS, formatDateRange } from "@/lib/format";
import { getMyTeamsWithGroups } from "@/lib/queries";

export default async function HomePage() {
  const user = await requireUser();
  if (user.teamIds.size === 0) {
    if (user.isOfficial) redirect("/nominalizari");
    if (user.isAdmin) redirect("/admin");
  }
  const teams = await getMyTeamsWithGroups(user.teamIds);
  const toAnswer = teams.reduce((n, t) => n + t.groups.reduce((m, g) => m + g.needsAnswer, 0), 0);

  return (
    <>
      <PageTitle sub={user.fullName || user.email}>Echipele mele</PageTitle>

      {toAnswer > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>
            {toAnswer === 1 ? "O propunere așteaptă" : `${toAnswer} propuneri așteaptă`} răspunsul dvs.
          </strong>{" "}
          Deschideți grupele marcate mai jos.
        </div>
      )}

      {teams.length === 0 ? (
        <Empty>
          Nu aveți încă echipe asociate contului.
          {user.isAdmin ? (
            <>
              {" "}
              Ca administrator, vedeți toate grupele în{" "}
              <Link href="/admin" className="underline">
                Grupe
              </Link>
              .
            </>
          ) : (
            " Contactați administratorul clubului sau al regiunii."
          )}
        </Empty>
      ) : (
        <div className="space-y-3">
          {teams.map((team) => (
            <Card key={team.id}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-orange-700">
                    {team.category?.name}
                  </div>
                  <div className="text-lg font-semibold leading-snug">{team.name}</div>
                  <div className="text-sm text-slate-500">{team.club?.name}</div>
                </div>
              </div>

              {team.groups.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500">Echipa nu este încă repartizată într-o grupă.</p>
              ) : (
                team.groups.map((g) => {
                  const st = GROUP_STATUS[g.overview?.status ?? "no_proposal"];
                  return (
                    <Link
                      key={g.groupId}
                      href={`/grupa/${g.groupId}`}
                      className="mt-3 block rounded-lg border border-slate-200 p-3 active:bg-slate-50"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {g.overview?.tournament_name} · {g.overview?.group_name}
                        </span>
                        <span className="text-slate-400">›</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Badge tone={st.tone}>{st.label}</Badge>
                        {g.needsAnswer > 0 && <Badge tone="red">Răspuns necesar</Badge>}
                      </div>
                      {g.host && (
                        <div className="mt-2 text-sm text-slate-600">
                          📅 {formatDateRange(g.host.start_date, g.host.end_date)}
                          <br />
                          📍 {g.host.gym?.name}, {g.host.gym?.city}
                          <br />
                          🏠 Organizator: {g.host.team?.name}
                        </div>
                      )}
                    </Link>
                  );
                })
              )}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}
