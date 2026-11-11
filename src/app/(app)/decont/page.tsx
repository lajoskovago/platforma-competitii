import Link from "next/link";
import { redirect } from "next/navigation";
import { Card, LinkButton, PageTitle, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { APP_HOME } from "@/lib/brand";
import { DECONT_CITY, decontAccess, getDecont, lei } from "@/lib/decont";

/** Officials' payments overview – games played in Oradea. */
export default async function DecontPage() {
  const user = await requireUser();
  const access = decontAccess(user);
  if (!access) redirect(APP_HOME);
  if (access === "own") redirect(`/decont/${user.id}`);

  const { people, games } = await getDecont();
  const totals = people.reduce(
    (t, p) => ({
      toReceive: t.toReceive + p.toReceive,
      availableNow: t.availableNow + p.availableNow,
      notCollected: t.notCollected + p.notCollected,
    }),
    { toReceive: 0, availableNow: 0, notCollected: 0 },
  );
  const missingRates = games.filter((g) => g.fees.some((f) => f.missingRate)).length;
  const uncollectedGames = games.filter((g) => g.total > 0 && g.coveredFraction < 1).length;

  return (
    <>
      <PageTitle sub={`Meciuri jucate în ${DECONT_CITY} · campionate regionale și naționale`}>Decont arbitri și oficiali</PageTitle>

      <div className="grid grid-cols-3 gap-2">
        <Total label="Total de dat" value={totals.toReceive} tone="slate" />
        <Total label="Poți da acum" value={totals.availableNow} tone="green" />
        <Total label="Neîncasat de la echipe" value={totals.notCollected} tone="amber" />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <LinkButton href="/decont/meciuri" variant="secondary">
          Meciuri și plăți echipe{uncollectedGames ? ` (${uncollectedGames} neîncasate)` : ""}
        </LinkButton>
        {user.isMaster && (
          <LinkButton href="/decont/tarife" variant="secondary">
            Tarife
          </LinkButton>
        )}
      </div>
      {missingRates > 0 && (
        <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          ⚠️ {missingRates} {missingRates === 1 ? "meci are" : "meciuri au"} poziții fără tarif – sumele lor apar ca 0.{" "}
          {user.isMaster && (
            <Link href="/decont/tarife" className="underline">
              Completați tarifele
            </Link>
          )}
        </p>
      )}

      <SectionTitle>Arbitri și oficiali ({people.length})</SectionTitle>
      {people.length === 0 ? (
        <p className="text-sm text-slate-500">Nicio nominalizare confirmată la meciuri jucate în {DECONT_CITY}.</p>
      ) : (
        <Card className="divide-y divide-slate-100 p-0!">
          {people.map((p) => (
            <Link key={p.userId} href={`/decont/${p.userId}`} className="block px-4 py-3 active:bg-slate-50">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{p.name}</span>
                <span className={`font-semibold tabular-nums ${p.toReceive < 0 ? "text-red-700" : ""}`}>{lei(p.toReceive)}</span>
              </div>
              <div className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-slate-500">
                <span>{p.games} meciuri</span>
                <span className="text-emerald-700">poți da acum: {lei(p.availableNow)}</span>
                {p.notCollected > 0 && <span className="text-amber-700">neîncasat: {lei(p.notCollected)}</span>}
              </div>
            </Link>
          ))}
        </Card>
      )}
    </>
  );
}

function Total({ label, value, tone }: { label: string; value: number; tone: "slate" | "green" | "amber" }) {
  const cls = { slate: "border-slate-200 bg-white", green: "border-emerald-200 bg-emerald-50", amber: "border-amber-200 bg-amber-50" }[tone];
  return (
    <div className={`rounded-xl border p-3 ${cls}`}>
      <div className="text-[11px] leading-tight text-slate-600">{label}</div>
      <div className={`mt-1 text-base font-bold tabular-nums ${value < 0 ? "text-red-700" : ""}`}>{lei(Math.round(value * 100) / 100)}</div>
    </div>
  );
}
