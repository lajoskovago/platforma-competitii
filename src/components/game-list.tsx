import Link from "next/link";
import { OfficialsSummary } from "@/components/officials";
import { Badge, Card, Empty } from "@/components/ui";
import { formatDate, formatTime, isoToBucharest } from "@/lib/format";
import { sideName, type ListedGame } from "@/lib/queries";

/** Games grouped by day, each linking to its game page. */
export function GameList({ games, empty }: { games: ListedGame[]; empty: string }) {
  if (!games.length) return <Empty>{empty}</Empty>;
  const byDay = games.reduce<Record<string, ListedGame[]>>((acc, g) => {
    (acc[isoToBucharest(g.starts_at).date] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {Object.entries(byDay).map(([day, list]) => (
        <section key={day}>
          <h3 className="mb-1 text-sm font-semibold capitalize text-slate-600">{formatDate(day)}</h3>
          <Card className="divide-y divide-slate-100 p-0!">
            {list.map((g) => (
              <Link key={g.id} href={`/meci/${g.id}`} className="block px-4 py-3 active:bg-slate-50">
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-slate-500">
                  <span className="font-semibold text-slate-700">{formatTime(g.starts_at)}</span>
                  <Badge tone={g.competition === "national" ? "blue" : "gray"}>
                    {g.competition === "national" ? "Național" : "Regional"} {g.category?.code}
                  </Badge>
                  {g.gym && (
                    <span>
                      📍 {g.gym.name}, {g.gym.city}
                    </span>
                  )}
                </div>
                <div className="mt-1 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <span className="font-medium">{sideName(g, "home", g.home)}</span>
                  <span className="rounded bg-slate-100 px-2 py-0.5 text-center font-mono text-sm tabular-nums">
                    {g.status === "played" ? `${g.home_score} – ${g.away_score}` : "–"}
                  </span>
                  <span className="text-right font-medium">{sideName(g, "away", g.away)}</span>
                </div>
                <OfficialsSummary nominations={g.nominations} />
              </Link>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

/** Filter chips as links. */
export function Chips({
  items,
  active,
  href,
}: {
  items: { key: string; label: string }[];
  active: string;
  href: (key: string) => string;
}) {
  return (
    <div className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
      {items.map((i) => (
        <Link
          key={i.key}
          href={href(i.key)}
          className={`whitespace-nowrap rounded-full border px-3 py-1.5 text-sm ${
            active === i.key ? "border-orange-600 bg-orange-600 text-white" : "border-slate-300 bg-white"
          }`}
        >
          {i.label}
        </Link>
      ))}
    </div>
  );
}
