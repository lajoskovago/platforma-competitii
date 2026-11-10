"use client";

import { useMemo, useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { GymPicker } from "@/components/gym-picker";
import { Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Club = { id: string; name: string; region: string | null };
type Team = { id: string; name: string; club_id: string; category_id: string };
type Category = { id: string; label: string };
type Gym = { id: string; name: string; city: string; address: string | null };

export type StandaloneDefaults = {
  id?: string;
  category_id?: string | null;
  region?: string | null;
  date?: string;
  time?: string;
  label?: string | null;
  gym_id?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
  home_external?: string | null;
  away_external?: string | null;
};

type Option = { value: string; label: string };

/** Form for national-championship and friendly games. */
export function StandaloneGameForm({
  competition,
  action,
  categories,
  clubs,
  teams,
  externalClubs,
  gyms,
  fixedRegion,
  defaults = {},
}: {
  competition: "national" | "friendly";
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  categories: Category[];
  clubs: Club[];
  teams: Team[];
  externalClubs: string[];
  gyms: Gym[];
  /** regional admins: their own region, not selectable */
  fixedRegion?: string | null;
  defaults?: StandaloneDefaults;
}) {
  const [region, setRegion] = useState(fixedRegion ?? defaults.region ?? "");
  const [category, setCategory] = useState(defaults.category_id ?? "");

  // Each club of the region: its team(s) in this category, or the club itself (team created on save)
  const options = useMemo<Option[]>(() => {
    if (!region || !category) return [];
    const out: Option[] = [];
    for (const c of clubs.filter((x) => x.region === region)) {
      const own = teams.filter((t) => t.club_id === c.id && t.category_id === category);
      if (own.length) for (const t of own) out.push({ value: `team:${t.id}`, label: t.name });
      else out.push({ value: `club:${c.id}`, label: c.name });
    }
    return out.sort((a, b) => a.label.localeCompare(b.label, "ro"));
  }, [region, category, clubs, teams]);

  return (
    <ActionForm action={action}>
      <input type="hidden" name="competition" value={competition} />
      {defaults.id && <input type="hidden" name="game_id" value={defaults.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Regiunea" hint="Decide cine vede meciul și cine nominalizează arbitrii">
          {fixedRegion ? (
            <>
              <input type="hidden" name="region" value={fixedRegion} />
              <div className={`${inputClass} bg-slate-100`}>{fixedRegion}</div>
            </>
          ) : (
            <select name="region" required value={region} onChange={(e) => setRegion(e.target.value)} className={inputClass}>
              <option value="" disabled>
                Alegeți…
              </option>
              <option value="SR5">SR5</option>
              <option value="SR6">SR6</option>
            </select>
          )}
        </Field>
        <Field label="Categoria">
          <select name="category_id" required value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="" disabled>
              Alegeți categoria…
            </option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Data">
          <input name="date" type="date" required defaultValue={defaults.date} className={inputClass} />
        </Field>
        <Field label="Ora">
          <input name="time" type="time" required defaultValue={defaults.time} className={inputClass} />
        </Field>
      </div>

      {!region || !category ? (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-600">Alegeți regiunea și categoria pentru a vedea echipele.</p>
      ) : (
        <>
          <Side side="home" label={competition === "friendly" ? "Echipa A (gazdă)" : "Gazdă"} options={options} defaults={defaults} />
          <Side side="away" label={competition === "friendly" ? "Echipa B (oaspete)" : "Oaspete"} options={options} defaults={defaults} />
          <p className="-mt-2 text-xs text-slate-500">
            Lista conține cluburile din {region}. Dacă un club nu are încă echipă în această categorie, ea se creează automat.
          </p>
        </>
      )}

      <datalist id="external-clubs">
        {externalClubs.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <GymPicker gyms={gyms} defaultId={defaults.gym_id ?? undefined} />

      <Field label="Denumire (opțional)">
        <input
          name="label"
          defaultValue={defaults.label ?? ""}
          placeholder={competition === "friendly" ? "ex. Amical de pregătire" : "ex. Etapa 3"}
          className={inputClass}
        />
      </Field>

      <SubmitButton>{defaults.id ? "Salvează meciul" : "Adaugă meciul"}</SubmitButton>
    </ActionForm>
  );
}

function Side({
  side,
  label,
  options,
  defaults,
}: {
  side: "home" | "away";
  label: string;
  options: Option[];
  defaults: StandaloneDefaults;
}) {
  const teamId = side === "home" ? defaults.home_team_id : defaults.away_team_id;
  const ext = side === "home" ? defaults.home_external : defaults.away_external;
  const initial = teamId ? `team:${teamId}` : ext ? "external" : "";
  const [value, setValue] = useState(initial);
  const known = value === "" || value === "external" || options.some((o) => o.value === value);

  return (
    <Field label={label}>
      <div className="space-y-2">
        <select
          name={`${side}_side`}
          required
          value={known ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          className={inputClass}
        >
          <option value="" disabled>
            Alegeți echipa…
          </option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
          <option value="external">Altă echipă (din afara regiunii)…</option>
        </select>
        {value === "external" && (
          <input
            name={`${side}_external`}
            list="external-clubs"
            required
            defaultValue={ext ?? ""}
            placeholder="ex. CSM București"
            autoComplete="off"
            className={inputClass}
          />
        )}
      </div>
    </Field>
  );
}
