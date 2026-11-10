import Link from "next/link";
import { Badge, Card, Empty } from "@/components/ui";
import { COMPETITION_LABEL, formatDate, formatTime, isoToBucharest, mapsLink } from "@/lib/format";
import type { Database } from "@/lib/database.types";

export type PublicGame = Database["public"]["Views"]["public_games"]["Row"];

/** Public schedule: grouped by day; teams, time, gym – no scores, no officials. */
export function PublicGameList({ games, empty, showGroupLink = true }: { games: PublicGame[]; empty: string; showGroupLink?: boolean }) {
  if (!games.length) return <Empty>{empty}</Empty>;
  const byDay = games.reduce<Record<string, PublicGame[]>>((acc, g) => {
    (acc[isoToBucharest(g.starts_at!).date] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(byDay).map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-1 text-sm font-semibold capitalize text-slate-600">{formatDate(day)}</h3>
          <Card className="divide-y divide-slate-100 p-0!">
            {list.map((g) => {
              const comp = COMPETITION_LABEL[g.competition ?? "regional"];
              return (
                <div key={g.id} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500">
                    <span className="font-semibold text-slate-700">{formatTime(g.starts_at!)}</span>
                    <Badge tone={comp.tone}>
                      {comp.short} {g.category_code}
                    </Badge>
                    {g.group_name &&
                      (showGroupLink ? (
                        <Link href={`/campionat/${g.category_code}`} className="underline">
                          {g.tournament_name} · {g.group_name}
                        </Link>
                      ) : (
                        <span>
                          {g.tournament_name} · {g.group_name}
                        </span>
                      ))}
                    {g.label && <span>· {g.label}</span>}
                    {g.is_done && <Badge tone="gray">Jucat</Badge>}
                  </div>
                  <div className="mt-1 font-medium">
                    {g.home_name} <span className="text-slate-400">–</span> {g.away_name}
                  </div>
                  {g.gym_name && (
                    <div className="mt-0.5 text-xs text-slate-500">
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
                </div>
              );
            })}
          </Card>
        </section>
      ))}
    </div>
  );
}
