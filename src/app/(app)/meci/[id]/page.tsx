import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { NominationLine } from "@/components/officials";
import { OfficialCombobox } from "@/components/official-combobox";
import { Badge, Card, Field, LinkButton, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { canAdminRegion, canNominateRegion, requireUser } from "@/lib/auth";
import {
  NOMINATION_STATUS,
  POSITION_LABEL,
  REFEREE_POSITIONS,
  SCORESHEET_LABEL,
  TABLE_POSITIONS,
  TABLE_SKILL_LABEL,
  COMPETITION_LABEL,
  bucharestToISO,
  skillForPosition,
  formatDateTime,
  isoToBucharest,
  mapsLink,
  type OfficialPosition,
} from "@/lib/format";
import { getGame, sideName } from "@/lib/queries";
import { createSupabaseServer } from "@/lib/supabase/server";
import { saveResult } from "../../grupa/actions";
import { respondNomination, setNomination, setScoresheet } from "../actions";

export default async function GamePage({ params }: PageProps<"/meci/[id]">) {
  const { id } = await params;
  const user = await requireUser();
  const g = await getGame(id);
  if (!g) notFound();

  const home = sideName(g, "home", g.home);
  const away = sideName(g, "away", g.away);
  // national championship or friendly game (not part of a regional group)
  const standalone = g.competition !== "regional";
  const comp = COMPETITION_LABEL[g.competition];
  const canNominate = canNominateRegion(user, g.gameRegion);
  const canEditNational =
    standalone &&
    (canAdminRegion(user, g.region) ||
      (!!g.home_team_id && user.teamIds.has(g.home_team_id)) ||
      (!!g.away_team_id && user.teamIds.has(g.away_team_id)));
  const myNominations = g.nominations.filter((n) => n.user_id === user.id);
  const bothSidesKnown = (g.home_team_id || g.home_external) && (g.away_team_id || g.away_external);

  return (
    <>
      <PageTitle
        back={standalone ? comp.path : g.group_id ? `/grupa/${g.group_id}` : "/"}
        sub={
          <>
            {comp.long} · {g.category?.name}
            {g.groupInfo && (
              <>
                {" "}
                ·{" "}
                <Link href={`/grupa/${g.group_id}`} className="underline">
                  {g.groupInfo.tournament} · {g.groupInfo.name}
                </Link>
              </>
            )}
            {g.gameRegion && ` · ${g.gameRegion}`}
          </>
        }
      >
        {home} – {away}
      </PageTitle>

      <Card>
        <div className="text-sm text-slate-600">
          📅 {formatDateTime(g.starts_at)} {g.label && `· ${g.label}`}
        </div>
        {g.gym && (
          <div className="mt-1 text-sm">
            📍{" "}
            <a href={mapsLink(g.gym)} target="_blank" rel="noreferrer" className="underline">
              {g.gym.name}, {g.gym.city}
            </a>
          </div>
        )}
        <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-lg">
          <span className="font-semibold">{home}</span>
          <span className="rounded bg-slate-100 px-3 py-1 font-mono tabular-nums">
            {g.status === "played" ? `${g.home_score} – ${g.away_score}` : "–"}
          </span>
          <span className="text-right font-semibold">{away}</span>
        </div>
        {g.status === "forfeit_home" && <p className="mt-2 text-sm text-red-700">Neprezentare {home}</p>}
        {g.status === "forfeit_away" && <p className="mt-2 text-sm text-red-700">Neprezentare {away}</p>}
        {canEditNational && (
          <div className="mt-3">
            <LinkButton href={`${comp.path}/${g.id}/editeaza`} variant="secondary">
              Modifică meciul
            </LinkButton>
          </div>
        )}
      </Card>

      {/* My nominations */}
      {myNominations.map((n) => (
        <Card key={n.id} className="mt-4 border-orange-300">
          <div className="text-xs font-semibold uppercase text-orange-700">Nominalizarea mea</div>
          <div className="mt-1 font-semibold">{POSITION_LABEL[n.position as OfficialPosition]}</div>
          <div className="mt-1">
            <Badge tone={NOMINATION_STATUS[n.status].tone}>{NOMINATION_STATUS[n.status].label}</Badge>
          </div>
          {n.status === "rejected" && n.reason && <p className="mt-1 text-sm text-red-700">Motiv: {n.reason}</p>}
          <NominationAnswer nominationId={n.id} status={n.status} />
        </Card>
      ))}

      {/* Officials */}
      <SectionTitle>Arbitri</SectionTitle>
      <OfficialsGrid positions={[...REFEREE_POSITIONS]} g={g} admin={canNominate} />
      <SectionTitle>Oficiali de masă</SectionTitle>
      <OfficialsGrid positions={[...TABLE_POSITIONS]} g={g} admin={canNominate} />

      {canNominate && <NominationEditor g={g} />}

      {/* Result for national / friendly games (regional results go through the group program page) */}
      {canEditNational && bothSidesKnown && (
        <>
          <SectionTitle>Rezultat</SectionTitle>
          <Card>
            <ActionForm action={saveResult} className="space-y-2">
              <input type="hidden" name="game_id" value={g.id} />
              <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                <Field label={home}>
                  <input name="home_score" type="number" inputMode="numeric" min={0} max={300} defaultValue={g.home_score ?? ""} className={`${inputClass} text-center text-lg`} />
                </Field>
                <span className="pb-3 text-slate-400">–</span>
                <Field label={away}>
                  <input name="away_score" type="number" inputMode="numeric" min={0} max={300} defaultValue={g.away_score ?? ""} className={`${inputClass} text-center text-lg`} />
                </Field>
              </div>
              <select name="status" defaultValue={g.status === "scheduled" ? "played" : g.status} className={inputClass}>
                <option value="played">Meci jucat</option>
                <option value="forfeit_home">Neprezentare {home}</option>
                <option value="forfeit_away">Neprezentare {away}</option>
                <option value="scheduled">Fără rezultat (programat)</option>
              </select>
              <SubmitButton variant="success">Salvează rezultatul</SubmitButton>
            </ActionForm>
          </Card>
        </>
      )}
    </>
  );
}

type G = NonNullable<Awaited<ReturnType<typeof getGame>>>;

function OfficialsGrid({ positions, g, admin }: { positions: OfficialPosition[]; g: G; admin: boolean }) {
  const filled = positions.filter((p) => g.nominations.some((n) => n.position === p));
  if (!filled.length) {
    return (
      <p className="text-sm text-slate-500">
        {admin ? "Nicio nominalizare încă." : "Nicio nominalizare confirmată încă."}
      </p>
    );
  }
  return (
    <Card className="space-y-2">
      {filled.map((p) => {
        const n = g.nominations.find((x) => x.position === p)!;
        return <NominationLine key={p} n={n} />;
      })}
    </Card>
  );
}

function NominationAnswer({ nominationId, status }: { nominationId: string; status: string }) {
  return (
    <div className="mt-3 space-y-2">
      {status !== "accepted" && (
        <ActionForm action={respondNomination}>
          <input type="hidden" name="nomination_id" value={nominationId} />
          <input type="hidden" name="response" value="accepted" />
          <SubmitButton variant="success">✅ Confirm prezența</SubmitButton>
        </ActionForm>
      )}
      {status !== "rejected" && (
        <details>
          <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg border border-red-300 bg-white text-sm font-semibold text-red-700">
            ❌ Refuz
          </summary>
          <ActionForm action={respondNomination} className="mt-2 space-y-2">
            <input type="hidden" name="nomination_id" value={nominationId} />
            <input type="hidden" name="response" value="rejected" />
            <textarea
              name="reason"
              required
              rows={2}
              placeholder="Motivul refuzului (obligatoriu – trebuia trecut ca indisponibilitate?)"
              className={inputClass}
            />
            <SubmitButton variant="danger">Trimite refuzul</SubmitButton>
          </ActionForm>
        </details>
      )}
    </div>
  );
}

/** Admin: pick a person for each position, with availability warnings. */
async function NominationEditor({ g }: { g: G }) {
  const supabase = await createSupabaseServer();
  const { date, time } = isoToBucharest(g.starts_at);

  const [{ data: people }, { data: unavailable }, { data: sameDay }] = await Promise.all([
    supabase.from("profile_names").select("*").or("is_referee.eq.true,is_table_official.eq.true").order("full_name"),
    supabase
      .from("official_unavailability")
      .select("user_id, start_time, end_time, note")
      .lte("start_date", date)
      .gte("end_date", date),
    supabase
      .from("games")
      .select("id, starts_at, game_officials(user_id, status)")
      .gte("starts_at", bucharestToISO(date, "00:00"))
      .lte("starts_at", bucharestToISO(date, "23:59"))
      .neq("id", g.id),
  ]);

  const regionPeople = (people ?? []).filter((p) => !g.gameRegion || p.region === g.gameRegion);
  const warn = (uid: string) => {
    const w: string[] = [];
    for (const u of (unavailable ?? []).filter((x) => x.user_id === uid)) {
      const inHours = !u.start_time || (time >= u.start_time.slice(0, 5) && (!u.end_time || time < u.end_time.slice(0, 5)));
      if (inHours) w.push(`indisponibil${u.note ? `: ${u.note}` : ""}`);
    }
    for (const og of sameDay ?? []) {
      if (og.game_officials.some((o) => o.user_id === uid && o.status !== "rejected")) {
        w.push(`alt meci la ${isoToBucharest(og.starts_at).time}`);
      }
    }
    return w;
  };

  const all: OfficialPosition[] = [...REFEREE_POSITIONS, ...TABLE_POSITIONS];
  return (
    <details className="mt-4">
      <summary className="flex min-h-11 cursor-pointer items-center justify-center rounded-lg bg-orange-600 text-sm font-semibold text-white">
        Nominalizează arbitri și oficiali
      </summary>
      <Card className="mt-2 space-y-4">
        <p className="text-xs text-slate-500">
          Lista conține {g.gameRegion ? `persoanele din ${g.gameRegion}` : "persoanele din ambele regiuni"}. ⚠️ =
          indisponibil sau nominalizat la alt meci în aceeași zi.
        </p>
        <ActionForm action={setScoresheet} className="space-y-1 rounded-lg bg-slate-50 p-3">
          <input type="hidden" name="game_id" value={g.id} />
          <label className="block text-sm font-medium text-slate-700" htmlFor="scoresheet">
            Foaie de joc
          </label>
          <div className="flex gap-2">
            <select id="scoresheet" name="scoresheet" defaultValue={g.scoresheet ?? ""} className={inputClass}>
              <option value="">— nestabilit —</option>
              <option value="manual">{SCORESHEET_LABEL.manual}</option>
              <option value="dss">{SCORESHEET_LABEL.dss}</option>
            </select>
            <SubmitButton variant="secondary" full={false}>
              Salvează
            </SubmitButton>
          </div>
          <p className="text-xs text-slate-500">La foaia digitală, scorerul trebuie să știe DSS.</p>
        </ActionForm>
        {all.map((pos) => {
          const isRef = (REFEREE_POSITIONS as readonly string[]).includes(pos);
          const current = g.nominations.find((n) => n.position === pos);
          const people = regionPeople.filter((p) => (isRef ? p.is_referee : p.is_table_official));
          // keep the current nominee selectable even if no longer in the list (e.g. region changed)
          if (current && !people.some((p) => p.id === current.user_id)) {
            people.push({
              id: current.user_id,
              full_name: current.name,
              region: null,
              is_referee: isRef,
              is_table_official: !isRef,
              city: null,
              table_skills: [],
            });
          }
          const skill = skillForPosition(pos, g.scoresheet);
          const options = people.map((p) => {
            const w = warn(p.id!);
            // only flag missing skills for officials who declared their skills
            const skills = p.table_skills ?? [];
            if (skill && skills.length > 0 && !skills.includes(skill)) w.push(`nu face: ${TABLE_SKILL_LABEL[skill]}`);
            return {
              id: p.id!,
              name: p.full_name ?? "",
              city: p.city ?? "",
              warnings: w,
              skilled: !!skill && skills.includes(skill),
            };
          });
          return (
            <ActionForm key={pos} action={setNomination} className="space-y-1">
              <input type="hidden" name="game_id" value={g.id} />
              <input type="hidden" name="position" value={pos} />
              <div className="text-sm font-medium text-slate-700">
                {POSITION_LABEL[pos]}
                {current && (
                  <span className="ml-2 align-middle">
                    <Badge tone={NOMINATION_STATUS[current.status].tone}>{NOMINATION_STATUS[current.status].label}</Badge>
                  </span>
                )}
              </div>
              <div className="flex items-start gap-2">
                <OfficialCombobox
                  name="user_id"
                  label={POSITION_LABEL[pos]}
                  options={options}
                  defaultId={current?.user_id}
                />
                <SubmitButton variant="secondary" full={false}>
                  Salvează
                </SubmitButton>
              </div>
            </ActionForm>
          );
        })}
      </Card>
    </details>
  );
}
