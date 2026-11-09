import { notFound, redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, PageTitle, SectionTitle, inputClass } from "@/components/ui";
import { canActForTeam, canAdminRegion, requireUser } from "@/lib/auth";
import { formatDateRange, formatDateTime, isoToBucharest } from "@/lib/format";
import { getGroupDetail, type GroupDetail } from "@/lib/queries";
import { addGame, deleteGame, generateGames, saveResult, updateGame } from "../../actions";

export default async function ProgramPage({ params }: PageProps<"/grupa/[id]/program">) {
  const { id } = await params;
  const user = await requireUser();
  const detail = await getGroupDetail(id);
  if (!detail) notFound();

  const confirmed = detail.proposals.find((p) => p.id === detail.overview.confirmed_proposal_id);
  const isHost = !!confirmed && canActForTeam(user, detail.teams.find((t) => t.id === confirmed.team_id));
  if (!confirmed || !(isHost || canAdminRegion(user, detail.overview.region))) redirect(`/grupa/${id}`);

  const { teams, games } = detail;
  const teamName = (tid: string | null) => teams.find((t) => t.id === tid)?.name ?? "";
  const defaultDate = confirmed.start_date;

  return (
    <>
      <PageTitle
        back={`/grupa/${id}`}
        sub={
          <>
            {detail.overview.category_name} · {detail.overview.group_name}
            <br />
            {formatDateRange(confirmed.start_date, confirmed.end_date)} · {confirmed.gym?.name}, {confirmed.gym?.city}
          </>
        }
      >
        Program & rezultate
      </PageTitle>

      {games.length === 0 && (teams.length === 3 || teams.length === 4) && (
        <Card className="mb-4 border-orange-200">
          <h2 className="font-semibold">Generează programul automat</h2>
          <p className="mb-3 text-sm text-slate-500">
            Meciurile se creează cu ora de start la interval fix. Le puteți modifica apoi individual.
          </p>
          <ActionForm action={generateGames}>
            <input type="hidden" name="group_id" value={id} />
            {teams.length === 3 ? (
              <input type="hidden" name="format" value="round_robin" />
            ) : (
              <Field label="Format">
                <select name="format" defaultValue="semis" className={inputClass}>
                  <option value="semis">Semifinale + finale (2 meciuri / echipă)</option>
                </select>
              </Field>
            )}
            {teams.length === 4 && (
              <fieldset className="space-y-2">
                <legend className="mb-1 text-sm font-medium text-slate-700">
                  Ordinea echipelor (SF1: 1 vs 4, SF2: 2 vs 3)
                </legend>
                {[0, 1, 2, 3].map((i) => (
                  <select key={i} name="order" defaultValue={teams[i].id} className={inputClass} aria-label={`Locul ${i + 1}`}>
                    {teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {i + 1}. {t.name}
                      </option>
                    ))}
                  </select>
                ))}
              </fieldset>
            )}
            <div className="grid grid-cols-3 gap-2">
              <Field label="Data">
                <input name="date" type="date" required defaultValue={defaultDate} className={inputClass} />
              </Field>
              <Field label="Primul meci">
                <input name="first_time" type="time" required defaultValue="10:00" className={inputClass} />
              </Field>
              <Field label="Interval (min)">
                <input name="step_minutes" type="number" min={30} max={300} step={5} defaultValue={90} className={inputClass} />
              </Field>
            </div>
            <SubmitButton>Generează meciurile</SubmitButton>
          </ActionForm>
        </Card>
      )}

      <SectionTitle>Meciuri ({games.length})</SectionTitle>
      <div className="space-y-3">
        {games.map((g) => (
          <GameCard key={g.id} g={g} teams={teams} teamName={teamName} />
        ))}
      </div>

      <SectionTitle>Adaugă un meci</SectionTitle>
      <Card>
        <ActionForm action={addGame} resetOnSuccess>
          <input type="hidden" name="group_id" value={id} />
          <input type="hidden" name="gym_id" value={confirmed.gym_id} />
          <GameFields teams={teams} date={defaultDate} />
          <SubmitButton>Adaugă meciul</SubmitButton>
        </ActionForm>
      </Card>
    </>
  );
}

type G = GroupDetail["games"][number];
type T = GroupDetail["teams"];

function GameFields({ teams, g, date }: { teams: T; g?: G; date: string }) {
  const local = g ? isoToBucharest(g.starts_at) : { date, time: "" };
  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Data">
          <input name="date" type="date" required defaultValue={local.date} className={inputClass} />
        </Field>
        <Field label="Ora">
          <input name="time" type="time" required defaultValue={local.time} className={inputClass} />
        </Field>
      </div>
      <Field label="Denumire (opțional)">
        <input name="label" defaultValue={g?.label ?? ""} placeholder="ex. Meci 1, Semifinala 1" className={inputClass} />
      </Field>
      <TeamField side="home" label="Gazdă" teams={teams} teamId={g?.home_team_id} text={g?.home_label} />
      <TeamField side="away" label="Oaspete" teams={teams} teamId={g?.away_team_id} text={g?.away_label} />
    </>
  );
}

function TeamField({
  side,
  label,
  teams,
  teamId,
  text,
}: {
  side: "home" | "away";
  label: string;
  teams: T;
  teamId?: string | null;
  text?: string | null;
}) {
  return (
    <Field label={label} hint="Dacă echipa nu se știe încă (ex. finală), lăsați „de stabilit” și scrieți descrierea.">
      <div className="space-y-2">
        <select name={`${side}_team_id`} defaultValue={teamId ?? ""} className={inputClass}>
          <option value="">— de stabilit —</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <input
          name={`${side}_label`}
          defaultValue={text ?? ""}
          placeholder="ex. Câștigătoare SF1"
          className={inputClass}
        />
      </div>
    </Field>
  );
}

function GameCard({ g, teams, teamName }: { g: G; teams: T; teamName: (id: string | null) => string }) {
  const home = g.home_team_id ? teamName(g.home_team_id) : g.home_label;
  const away = g.away_team_id ? teamName(g.away_team_id) : g.away_label;
  const bothKnown = !!g.home_team_id && !!g.away_team_id;

  return (
    <Card>
      <div className="text-xs text-slate-500">
        {formatDateTime(g.starts_at)} {g.label && `· ${g.label}`}
      </div>
      <div className="mt-1 font-medium">
        {home} <span className="text-slate-400">vs</span> {away}
      </div>

      {bothKnown ? (
        <ActionForm action={saveResult} className="mt-3 space-y-2">
          <input type="hidden" name="game_id" value={g.id} />
          <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
            <Field label={teamName(g.home_team_id)}>
              <input
                name="home_score"
                type="number"
                inputMode="numeric"
                min={0}
                max={300}
                defaultValue={g.home_score ?? ""}
                className={`${inputClass} text-center text-lg`}
              />
            </Field>
            <span className="pb-3 text-slate-400">–</span>
            <Field label={teamName(g.away_team_id)}>
              <input
                name="away_score"
                type="number"
                inputMode="numeric"
                min={0}
                max={300}
                defaultValue={g.away_score ?? ""}
                className={`${inputClass} text-center text-lg`}
              />
            </Field>
          </div>
          <select name="status" defaultValue={g.status === "scheduled" ? "played" : g.status} className={inputClass}>
            <option value="played">Meci jucat</option>
            <option value="forfeit_home">Neprezentare {teamName(g.home_team_id)}</option>
            <option value="forfeit_away">Neprezentare {teamName(g.away_team_id)}</option>
            <option value="scheduled">Fără rezultat (programat)</option>
          </select>
          <SubmitButton variant="success">Salvează rezultatul</SubmitButton>
        </ActionForm>
      ) : (
        <p className="mt-2 text-xs text-slate-500">Stabiliți ambele echipe pentru a putea introduce rezultatul.</p>
      )}

      <details className="mt-3">
        <summary className="cursor-pointer py-2 text-sm font-medium text-slate-600">Editează meciul</summary>
        <ActionForm action={updateGame} className="mt-2 space-y-3">
          <input type="hidden" name="game_id" value={g.id} />
          <GameFields teams={teams} g={g} date={g.starts_at.slice(0, 10)} />
          <SubmitButton variant="secondary">Salvează meciul</SubmitButton>
        </ActionForm>
        <ActionForm action={deleteGame} className="mt-2" confirm="Ștergeți acest meci?">
          <input type="hidden" name="game_id" value={g.id} />
          <SubmitButton variant="danger">Șterge meciul</SubmitButton>
        </ActionForm>
      </details>
    </Card>
  );
}
