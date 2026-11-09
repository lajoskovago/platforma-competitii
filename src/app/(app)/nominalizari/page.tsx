import Link from "next/link";
import { redirect } from "next/navigation";
import { Badge, Card, Empty, PageTitle, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { NOMINATION_STATUS, POSITION_LABEL, formatDateTime, upcomingCutoff, type OfficialPosition } from "@/lib/format";
import { sideName } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function MyNominationsPage() {
  const user = await requireUser();
  if (!user.isOfficial) redirect("/");
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("game_officials")
    .select(
      "*, game:games(id, starts_at, competition, status, home_external, away_external, home_label, away_label, gym:gyms(name, city), category:categories(code), home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name))",
    )
    .eq("user_id", user.id);

  const now = upcomingCutoff();
  const rows = (data ?? [])
    .filter((n) => n.game)
    .sort((a, b) => a.game!.starts_at.localeCompare(b.game!.starts_at));
  const upcoming = rows.filter((n) => new Date(n.game!.starts_at).getTime() >= now);
  const past = rows.filter((n) => new Date(n.game!.starts_at).getTime() < now).reverse();
  const pending = upcoming.filter((n) => n.status === "pending").length;

  return (
    <>
      <PageTitle sub={`${user.fullName} · ${[user.isReferee && "arbitru", user.isTableOfficial && "oficial de masă"].filter(Boolean).join(", ")} · ${user.region}`}>
        Nominalizările mele
      </PageTitle>

      {pending > 0 && (
        <div className="mb-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <strong>{pending === 1 ? "O nominalizare așteaptă" : `${pending} nominalizări așteaptă`}</strong> confirmarea
          dvs.
        </div>
      )}

      {upcoming.length === 0 ? (
        <Empty>Nu aveți nominalizări viitoare.</Empty>
      ) : (
        <div className="space-y-2">
          {upcoming.map((n) => (
            <Row key={n.id} n={n} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <>
          <SectionTitle>Trecute</SectionTitle>
          <div className="space-y-2 opacity-80">
            {past.slice(0, 30).map((n) => (
              <Row key={n.id} n={n} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

type N = {
  id: string;
  position: string;
  status: string;
  reason: string | null;
  game: {
    id: string;
    starts_at: string;
    competition: string;
    home_external: string | null;
    away_external: string | null;
    home_label: string | null;
    away_label: string | null;
    gym: { name: string; city: string } | null;
    category: { code: string } | null;
    home: { name: string } | null;
    away: { name: string } | null;
  } | null;
};

function Row({ n }: { n: N }) {
  const g = n.game!;
  const st = NOMINATION_STATUS[n.status];
  return (
    <Link href={`/meci/${g.id}`} className="block">
      <Card className={n.status === "pending" ? "border-amber-300" : ""}>
        <div className="flex items-start justify-between gap-2">
          <div className="text-xs text-slate-500">
            {formatDateTime(g.starts_at)} · {g.competition === "national" ? "Național" : "Regional"} {g.category?.code}
          </div>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <div className="mt-1 font-medium">
          {sideName(g, "home", g.home)} – {sideName(g, "away", g.away)}
        </div>
        {g.gym && (
          <div className="text-sm text-slate-600">
            📍 {g.gym.name}, {g.gym.city}
          </div>
        )}
        <div className="mt-1 text-sm">
          Poziție: <strong>{POSITION_LABEL[n.position as OfficialPosition]}</strong>
        </div>
        {n.status === "pending" && <div className="mt-2 text-sm font-medium text-orange-700">Deschide pentru a confirma sau refuza ›</div>}
      </Card>
    </Link>
  );
}
