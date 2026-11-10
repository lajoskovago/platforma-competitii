import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Empty, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import {
  COMPETITION_LABEL,
  NOMINATION_STATUS,
  POSITION_LABEL,
  type Competition,
  formatDateTime,
  mapsLink,
  upcomingCutoff,
  type OfficialPosition,
} from "@/lib/format";
import { sideName } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";
import { respondNomination } from "../meci/actions";

export default async function MyNominationsPage() {
  const user = await requireUser();
  if (!user.isOfficial) redirect("/");
  const supabase = await createSupabaseServer();
  const { data } = await supabase
    .from("game_officials")
    .select(
      "*, game:games(id, starts_at, competition, status, home_external, away_external, home_label, away_label, label, gym:gyms(name, city, address, maps_url), category:categories(code, name), home:teams!games_home_team_id_fkey(name), away:teams!games_away_team_id_fkey(name))",
    )
    .eq("user_id", user.id);

  const now = upcomingCutoff();
  const rows = (data ?? [])
    .filter((n) => n.game)
    .sort((a, b) => a.game!.starts_at.localeCompare(b.game!.starts_at));
  const upcoming = rows.filter((n) => new Date(n.game!.starts_at).getTime() >= now);
  const past = rows.filter((n) => new Date(n.game!.starts_at).getTime() < now).reverse();
  const toConfirm = upcoming.filter((n) => n.status === "pending");
  const confirmed = upcoming.filter((n) => n.status === "accepted");
  const refused = upcoming.filter((n) => n.status === "rejected");

  return (
    <>
      <PageTitle
        sub={`${user.fullName} · ${[user.isReferee && "arbitru", user.isTableOfficial && "oficial de masă"].filter(Boolean).join(", ")} · ${user.region}`}
      >
        Nominalizările mele
      </PageTitle>

      {/* ------------------------------------------------ to confirm */}
      <SectionTitle>
        De confirmat {toConfirm.length > 0 && <Badge tone="amber">{toConfirm.length}</Badge>}
      </SectionTitle>
      {toConfirm.length === 0 ? (
        <Empty>Nu aveți nominalizări care așteaptă răspuns.</Empty>
      ) : (
        <div className="space-y-3">
          {toConfirm.map((n) => (
            <GameCard key={n.id} n={n} highlight>
              <div className="mt-3 space-y-2">
                <ActionForm action={respondNomination}>
                  <input type="hidden" name="nomination_id" value={n.id} />
                  <input type="hidden" name="response" value="accepted" />
                  <SubmitButton variant="success">✅ Confirm prezența</SubmitButton>
                </ActionForm>
                <details>
                  <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-red-300 bg-white text-sm font-semibold text-red-700">
                    ❌ Refuz
                  </summary>
                  <ActionForm action={respondNomination} className="mt-2 space-y-2">
                    <input type="hidden" name="nomination_id" value={n.id} />
                    <input type="hidden" name="response" value="rejected" />
                    <textarea
                      name="reason"
                      required
                      rows={2}
                      placeholder="Motivul refuzului (obligatoriu)"
                      className={inputClass}
                    />
                    <SubmitButton variant="danger">Trimite refuzul</SubmitButton>
                  </ActionForm>
                </details>
              </div>
            </GameCard>
          ))}
        </div>
      )}

      {/* ------------------------------------------------ games to attend */}
      <SectionTitle>Meciurile mele ({confirmed.length})</SectionTitle>
      {confirmed.length === 0 ? (
        <Empty>Nu aveți încă meciuri confirmate.</Empty>
      ) : (
        <div className="space-y-3">
          {confirmed.map((n) => (
            <GameCard key={n.id} n={n}>
              <details className="mt-2">
                <summary className="cursor-pointer py-1 text-xs text-slate-500">Nu mai puteți ajunge?</summary>
                <ActionForm action={respondNomination} className="mt-2 space-y-2">
                  <input type="hidden" name="nomination_id" value={n.id} />
                  <input type="hidden" name="response" value="rejected" />
                  <textarea name="reason" required rows={2} placeholder="Motivul (obligatoriu)" className={inputClass} />
                  <SubmitButton variant="danger">Anunț că nu pot ajunge</SubmitButton>
                </ActionForm>
              </details>
            </GameCard>
          ))}
        </div>
      )}

      {/* ------------------------------------------------ refused / past */}
      {refused.length > 0 && (
        <>
          <SectionTitle>Refuzate ({refused.length})</SectionTitle>
          <div className="space-y-2 opacity-80">
            {refused.map((n) => (
              <GameCard key={n.id} n={n} compact />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <details className="mt-6">
          <summary className="cursor-pointer py-2 text-sm text-slate-500">Meciuri trecute ({past.length})</summary>
          <div className="mt-2 space-y-2 opacity-80">
            {past.slice(0, 50).map((n) => (
              <GameCard key={n.id} n={n} compact />
            ))}
          </div>
        </details>
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
    label: string | null;
    home_external: string | null;
    away_external: string | null;
    home_label: string | null;
    away_label: string | null;
    gym: { name: string; city: string; address: string | null; maps_url: string | null } | null;
    category: { code: string; name: string } | null;
    home: { name: string } | null;
    away: { name: string } | null;
  } | null;
};

function GameCard({
  n,
  highlight,
  compact,
  children,
}: {
  n: N;
  highlight?: boolean;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const g = n.game!;
  const st = NOMINATION_STATUS[n.status];
  return (
    <Card className={highlight ? "border-amber-300" : ""}>
      <div className="flex items-start justify-between gap-2">
        <div className="text-sm font-semibold text-slate-800">📅 {formatDateTime(g.starts_at)}</div>
        <Badge tone={st.tone}>{st.label}</Badge>
      </div>
      <div className="mt-1 text-xs text-slate-500">
        {COMPETITION_LABEL[g.competition as Competition].long} · {g.category?.name}
        {g.label && ` · ${g.label}`}
      </div>
      <div className="mt-1 font-medium">
        {sideName(g, "home", g.home)} – {sideName(g, "away", g.away)}
      </div>
      {!compact && g.gym && (
        <div className="mt-1 text-sm">
          📍{" "}
          <a href={mapsLink(g.gym)} target="_blank" rel="noreferrer" className="underline">
            {g.gym.name}, {g.gym.city}
          </a>
        </div>
      )}
      <div className="mt-1 text-sm">
        Poziție: <strong>{POSITION_LABEL[n.position as OfficialPosition]}</strong>
      </div>
      {n.status === "rejected" && n.reason && <div className="mt-1 text-xs text-red-700">Motiv: {n.reason}</div>}
      {children}
      <Link href={`/meci/${g.id}`} className="mt-2 inline-block py-1 text-sm text-orange-700">
        Detalii meci ›
      </Link>
    </Card>
  );
}
