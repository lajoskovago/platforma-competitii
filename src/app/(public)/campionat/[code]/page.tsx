import Link from "next/link";
import { notFound } from "next/navigation";
import { PublicGameList, type PublicGame } from "@/components/public-game-list";
import { Badge, Card } from "@/components/ui";
import { APP_NAME } from "@/lib/brand";
import { formatDateRange, mapsLink } from "@/lib/format";
import { createSupabasePublic } from "@/lib/supabase/public";

export async function generateMetadata({ params }: PageProps<"/campionat/[code]">) {
  const { code } = await params;
  return { title: `${code.toUpperCase()} – grupe și program – ${APP_NAME}` };
}

/** Public page of one regional championship: groups, teams, organiser and program (no scores). */
export default async function ChampionshipPage({ params }: PageProps<"/campionat/[code]">) {
  const { code: raw } = await params;
  const code = decodeURIComponent(raw).toUpperCase();
  const supabase = createSupabasePublic();

  const { data: groups } = await supabase
    .from("public_groups")
    .select("*")
    .eq("category_code", code)
    .order("sort_order");
  if (!groups?.length) notFound();

  const groupIds = groups.map((g) => g.group_id!);
  const [{ data: teams }, { data: games }] = await Promise.all([
    supabase.from("public_group_teams").select("*").in("group_id", groupIds).order("team_name"),
    supabase.from("public_games").select("*").in("group_id", groupIds).order("starts_at"),
  ]);

  return (
    <>
      <Link href="/" className="mb-2 inline-flex items-center gap-1 py-1 text-sm text-slate-500">
        ← Programul meciurilor
      </Link>
      <h1 className="text-xl font-bold leading-tight text-slate-900">{groups[0].category_name}</h1>
      <p className="mb-4 text-sm text-slate-500">Campionat regional · {groups[0].tournament_name}</p>

      <div className="space-y-4">
        {groups.map((g) => {
          const groupTeams = (teams ?? []).filter((t) => t.group_id === g.group_id);
          const groupGames = ((games ?? []) as PublicGame[]).filter((x) => x.group_id === g.group_id);
          return (
            <Card key={g.group_id}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">{g.group_name}</h2>
                <Badge>{g.region ?? "SR5 + SR6"}</Badge>
              </div>
              {g.notes && <p className="text-xs text-slate-500">{g.notes}</p>}

              <div className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">
                {g.host_name ? (
                  <>
                    <div>
                      🏠 Organizator: <strong>{g.host_name}</strong>
                    </div>
                    {g.start_date && <div className="capitalize">📅 {formatDateRange(g.start_date, g.end_date)}</div>}
                    {g.gym_name && (
                      <div>
                        📍{" "}
                        <a
                          href={mapsLink({ name: g.gym_name, city: g.gym_city ?? "", address: g.gym_address, maps_url: g.gym_maps_url })}
                          target="_blank"
                          rel="noreferrer"
                          className="underline"
                        >
                          {g.gym_name}, {g.gym_city}
                        </a>
                      </div>
                    )}
                  </>
                ) : (
                  <span className="text-slate-500">Organizatorul turneului nu este stabilit încă.</span>
                )}
              </div>

              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Echipe</h3>
              <ul className="mt-1 space-y-0.5 text-sm">
                {groupTeams.map((t) => (
                  <li key={t.team_id}>
                    {t.team_name}
                    {t.club_name && t.club_name !== t.team_name && <span className="text-slate-500"> · {t.club_name}</span>}
                  </li>
                ))}
              </ul>

              <h3 className="mt-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Program</h3>
              <div className="mt-1">
                <PublicGameList games={groupGames} empty="Programul nu este publicat încă." showGroupLink={false} />
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
