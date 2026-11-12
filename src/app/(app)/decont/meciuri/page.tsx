import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Chips } from "@/components/game-list";
import { Badge, Card, Empty, PageTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { APP_HOME } from "@/lib/brand";
import { DECONT_CITY, decontAccess, getDecont, lei, type DecontGame } from "@/lib/decont";
import { formatDate, formatDateTime, isoToBucharest } from "@/lib/format";
import { setTeamPaid } from "../actions";

/** Games played in Oradea: what each team owes for the officials and whether it paid. */
export default async function DecontGamesPage({ searchParams }: PageProps<"/decont/meciuri">) {
  const user = await requireUser();
  if (decontAccess(user) !== "all") redirect(APP_HOME);
  const { arata = "neincasate" } = (await searchParams) as Record<string, string | undefined>;

  const { games } = await getDecont();
  const relevant = games.filter((g) => g.fees.length > 0);
  const list = arata === "toate" ? relevant : relevant.filter((g) => g.total > 0 && g.coveredFraction < 1);
  const owed = relevant.reduce(
    (s, g) => s + (g.homePaidOn ? 0 : g.homeAmount) + (g.payer === "both" && !g.awayPaidOn ? g.awayAmount : 0),
    0,
  );

  return (
    <>
      <PageTitle back="/decont" sub={`Meciuri jucate în ${DECONT_CITY} · de încasat de la echipe: ${lei(Math.round(owed * 100) / 100)}`}>
        Meciuri și plăți echipe
      </PageTitle>
      <Chips
        items={[
          { key: "neincasate", label: "De încasat" },
          { key: "toate", label: "Toate" },
        ]}
        active={arata}
        href={(k) => (k === "neincasate" ? "/decont/meciuri" : `/decont/meciuri?arata=${k}`)}
      />
      {list.length === 0 ? (
        <Empty>{arata === "toate" ? "Niciun meci jucat cu oficiali confirmați." : "Toate meciurile sunt încasate. 🎉"}</Empty>
      ) : (
        <div className="space-y-3">
          {list.map((g) => (
            <GameCard key={g.id} g={g} canEdit={user.isMaster} />
          ))}
        </div>
      )}
    </>
  );
}

function GameCard({ g, canEdit }: { g: DecontGame; canEdit: boolean }) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-xs text-slate-500">
            {formatDateTime(g.startsAt)} · {g.competition === "national" ? "Național" : "Regional"} · {g.categoryName}
          </div>
          <div className="font-medium">
            {g.home} – {g.away}
          </div>
          <div className="text-xs text-slate-500">
            {g.fees.filter((f) => !f.selfInvoiced).length} oficiali · total {lei(g.total)}
            {g.fees.some((f) => f.selfInvoiced) && ` · ${g.fees.filter((f) => f.selfInvoiced).length} facturează singuri`}
            {g.fees.some((f) => f.missingRate) && <span className="text-amber-700"> · ⚠️ poziții fără tarif</span>}
          </div>
        </div>
        {canEdit && (
          <Link href={`/decont/meci/${g.id}`} className="shrink-0 py-1 text-sm text-orange-700">
            Modifică ›
          </Link>
        )}
      </div>
      <div className="mt-2 text-xs text-slate-500">
        {g.payer === "home" ? "Plătește doar gazda" : "Plătesc ambele echipe"}
        {g.payerIsDefault && " (implicit)"}
      </div>
      <div className="mt-2 space-y-2">
        <TeamLine g={g} side="home" canEdit={canEdit} />
        {g.payer === "both" && <TeamLine g={g} side="away" canEdit={canEdit} />}
      </div>
    </Card>
  );
}

function TeamLine({ g, side, canEdit }: { g: DecontGame; side: "home" | "away"; canEdit: boolean }) {
  const name = side === "home" ? g.home : g.away;
  const amount = side === "home" ? g.homeAmount : g.awayAmount;
  const paidOn = side === "home" ? g.homePaidOn : g.awayPaidOn;
  const note = side === "home" ? g.homePaidNote : g.awayPaidNote;
  const today = isoToBucharest(new Date().toISOString()).date;
  return (
    <div className={`rounded-lg p-2 ${paidOn ? "bg-emerald-50" : "bg-slate-50"}`}>
      <div className="flex items-center justify-between gap-2 text-sm">
        <span>
          {name} <span className="text-slate-400">({side === "home" ? "gazdă" : "oaspete"})</span>
        </span>
        <span className="flex items-center gap-2">
          <strong className="tabular-nums">{lei(amount)}</strong>
          {paidOn ? <Badge tone="green">plătit</Badge> : <Badge tone="amber">neplătit</Badge>}
        </span>
      </div>
      {paidOn && (
        <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-slate-600">
          <span>
            <span className="capitalize">{formatDate(paidOn)}</span>
            {note && ` · ${note}`}
          </span>
          {canEdit && (
            <ActionForm action={setTeamPaid} className="" confirm="Anulați plata înregistrată?">
              <input type="hidden" name="game_id" value={g.id} />
              <input type="hidden" name="side" value={side} />
              <input type="hidden" name="undo" value="1" />
              <button className="py-1 text-red-700 underline">Anulează</button>
            </ActionForm>
          )}
        </div>
      )}
      {!paidOn && canEdit && amount > 0 && (
        <details className="mt-1">
          <summary className="cursor-pointer py-1 text-xs font-medium text-orange-700">Marchează plătit</summary>
          <ActionForm action={setTeamPaid} className="mt-1 space-y-2">
            <input type="hidden" name="game_id" value={g.id} />
            <input type="hidden" name="side" value={side} />
            <div className="grid grid-cols-2 gap-2">
              <input name="paid_on" type="date" defaultValue={today} aria-label="Data plății" className={inputClass} />
              <input name="note" placeholder="factură / transfer / numerar" aria-label="Observații" className={inputClass} />
            </div>
            <SubmitButton variant="success">Plătit</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}
