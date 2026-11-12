import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Badge, Card, Empty, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { APP_HOME } from "@/lib/brand";
import { DECONT_CITY, decontAccess, getDecont, lei } from "@/lib/decont";
import { POSITION_LABEL, formatDate, formatDateTime, isoToBucharest, type OfficialPosition } from "@/lib/format";
import { addPayout, deletePayout } from "../actions";

/** One official: amounts per game (Oradea), payouts, balance. */
export default async function DecontPersonPage({ params }: PageProps<"/decont/[userId]">) {
  const { userId } = await params;
  const user = await requireUser();
  const access = decontAccess(user);
  if (!access || (access === "own" && userId !== user.id)) redirect(APP_HOME);

  const { games, people, payouts } = await getDecont();
  const person = people.find((p) => p.userId === userId);
  if (!person && access === "own") {
    // an Oradea official without games yet
    return (
      <>
        <PageTitle sub={`Meciuri jucate în ${DECONT_CITY}`}>Decontul meu</PageTitle>
        <Empty>Nu aveți încă meciuri jucate cu nominalizare confirmată.</Empty>
      </>
    );
  }
  if (!person) notFound();

  const myGames = games
    .map((g) => ({ g, fees: g.fees.filter((f) => f.userId === userId && !f.selfInvoiced) }))
    .filter((x) => x.fees.length);
  const myPayouts = payouts.filter((p) => p.user_id === userId);
  const today = isoToBucharest(new Date().toISOString()).date;

  return (
    <>
      <PageTitle
        back={access === "all" ? "/decont" : undefined}
        sub={`${person.city ?? ""}${person.city ? " · " : ""}meciuri jucate în ${DECONT_CITY}`}
      >
        {access === "own" ? "Decontul meu" : person.name}
      </PageTitle>

      <div className="grid grid-cols-2 gap-2">
        <Box label="Total de primit" value={person.toReceive} strong />
        <Box label="Poate primi acum" value={person.availableNow} hint="partea plătită deja de echipe" />
        <Box label="Câștigat în total" value={person.earned} hint={`${person.games} meciuri`} />
        <Box label="Primit deja" value={person.paidOut} />
      </div>
      {person.notCollected > 0 && (
        <p className="mt-2 text-xs text-amber-700">
          {lei(person.notCollected)} încă neîncasați de la echipe.
        </p>
      )}

      {user.isMaster && (
        <>
          <SectionTitle>Am dat bani</SectionTitle>
          <Card>
            <ActionForm action={addPayout} resetOnSuccess>
              <input type="hidden" name="user_id" value={userId} />
              <div className="grid grid-cols-2 gap-2">
                <Field label="Suma (lei)">
                  <input name="amount" inputMode="decimal" required placeholder="ex. 300" className={inputClass} />
                </Field>
                <Field label="Data">
                  <input name="paid_on" type="date" defaultValue={today} className={inputClass} />
                </Field>
              </div>
              <Field label="Observații (opțional)">
                <input name="note" placeholder="ex. numerar, transfer" className={inputClass} />
              </Field>
              <SubmitButton>Înregistrează</SubmitButton>
            </ActionForm>
          </Card>
        </>
      )}

      <SectionTitle>Primit ({myPayouts.length})</SectionTitle>
      {myPayouts.length === 0 ? (
        <Empty>Nicio sumă înregistrată.</Empty>
      ) : (
        <Card className="divide-y divide-slate-100 p-0!">
          {myPayouts.map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-2 px-4 py-2 text-sm">
              <span>
                <span className="capitalize">{formatDate(p.paid_on)}</span>
                {p.note && <span className="text-slate-500"> · {p.note}</span>}
              </span>
              <span className="flex items-center gap-2">
                <strong className="tabular-nums">{lei(Number(p.amount))}</strong>
                {user.isMaster && (
                  <ActionForm action={deletePayout} className="" confirm="Ștergeți această înregistrare?">
                    <input type="hidden" name="id" value={p.id} />
                    <button className="min-h-9 rounded px-2 text-xs text-red-700 hover:bg-red-50">Șterge</button>
                  </ActionForm>
                )}
              </span>
            </div>
          ))}
        </Card>
      )}

      <SectionTitle>Meciuri ({myGames.length})</SectionTitle>
      {myGames.length === 0 ? (
        <Empty>Niciun meci.</Empty>
      ) : (
        <Card className="divide-y divide-slate-100 p-0!">
          {myGames.map(({ g, fees }) => (
            <div key={g.id} className="px-4 py-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs text-slate-500">
                    {formatDateTime(g.startsAt)} · {g.competition === "national" ? "Național" : "Regional"} · {g.categoryName}
                  </div>
                  <div className="font-medium">
                    {g.home} – {g.away}
                  </div>
                  <div className="text-xs text-slate-500">
                    {fees.map((f) => POSITION_LABEL[f.position as OfficialPosition]).join(", ")}
                    {fees.some((f) => f.missingRate) && <span className="text-amber-700"> · fără tarif</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold tabular-nums">{lei(fees.reduce((s, f) => s + f.amount, 0))}</div>
                  {g.coveredFraction >= 1 ? (
                    <Badge tone="green">încasat</Badge>
                  ) : g.coveredFraction > 0 ? (
                    <Badge tone="amber">parțial</Badge>
                  ) : (
                    <Badge tone="gray">neîncasat</Badge>
                  )}
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}

function Box({ label, value, hint, strong }: { label: string; value: number; hint?: string; strong?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${strong ? "border-orange-300 bg-orange-50" : "border-slate-200 bg-white"}`}>
      <div className="text-xs text-slate-600">{label}</div>
      <div className={`mt-0.5 text-lg font-bold tabular-nums ${value < 0 ? "text-red-700" : ""}`}>{lei(value)}</div>
      {hint && <div className="text-[11px] text-slate-500">{hint}</div>}
    </div>
  );
}
