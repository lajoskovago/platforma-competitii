"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { GymPicker } from "@/components/gym-picker";
import { Field, inputClass } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";

type Team = { id: string; name: string; category_id: string };
type Category = { id: string; code: string; name: string };
type Gym = { id: string; name: string; city: string; address: string | null };

export type NationalGameDefaults = {
  id?: string;
  category_id?: string;
  date?: string;
  time?: string;
  label?: string | null;
  gym_id?: string | null;
  home_team_id?: string | null;
  away_team_id?: string | null;
  home_external?: string | null;
  away_external?: string | null;
  region?: string | null;
};

export function NationalGameForm({
  action,
  categories,
  teams,
  externalClubs,
  gyms,
  askRegion,
  defaults = {},
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  categories: Category[];
  teams: Team[];
  externalClubs: string[];
  gyms: Gym[];
  askRegion: boolean;
  defaults?: NationalGameDefaults;
}) {
  const [category, setCategory] = useState(defaults.category_id ?? "");
  const catTeams = teams.filter((t) => t.category_id === category);

  return (
    <ActionForm action={action}>
      {defaults.id && <input type="hidden" name="game_id" value={defaults.id} />}
      <Field label="Categoria">
        <select name="category_id" required value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          <option value="" disabled>
            Alegeți categoria…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} – {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Data">
          <input name="date" type="date" required defaultValue={defaults.date} className={inputClass} />
        </Field>
        <Field label="Ora">
          <input name="time" type="time" required defaultValue={defaults.time} className={inputClass} />
        </Field>
      </div>

      <Side side="home" label="Gazdă" teams={catTeams} defaults={defaults} />
      <Side side="away" label="Oaspete" teams={catTeams} defaults={defaults} />

      <datalist id="external-clubs">
        {externalClubs.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      <GymPicker gyms={gyms} defaultId={defaults.gym_id ?? undefined} />

      <Field label="Denumire (opțional)">
        <input name="label" defaultValue={defaults.label ?? ""} placeholder="ex. Etapa 3" className={inputClass} />
      </Field>

      {askRegion && (
        <Field label="Regiunea (cine nominalizează arbitrii)" hint="Implicit: regiunea clubului nostru din meci">
          <select name="region" defaultValue={defaults.region ?? ""} className={inputClass}>
            <option value="">— automat —</option>
            <option value="SR5">SR5</option>
            <option value="SR6">SR6</option>
          </select>
        </Field>
      )}

      <SubmitButton>{defaults.id ? "Salvează meciul" : "Adaugă meciul"}</SubmitButton>
    </ActionForm>
  );
}

function Side({
  side,
  label,
  teams,
  defaults,
}: {
  side: "home" | "away";
  label: string;
  teams: Team[];
  defaults: NationalGameDefaults;
}) {
  const initialTeam = side === "home" ? defaults.home_team_id : defaults.away_team_id;
  const initialExt = side === "home" ? defaults.home_external : defaults.away_external;
  const [value, setValue] = useState(initialTeam ?? (initialExt ? "external" : ""));
  const selectedValid = value === "" || value === "external" || teams.some((t) => t.id === value);

  return (
    <Field label={label}>
      <div className="space-y-2">
        <select
          name={`${side}_team_id`}
          value={selectedValid ? value : ""}
          onChange={(e) => setValue(e.target.value)}
          required
          className={inputClass}
        >
          <option value="" disabled>
            Alegeți echipa…
          </option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
          <option value="external">Altă echipă (din afara regiunii)…</option>
        </select>
        {value === "external" && (
          <input
            name={`${side}_external`}
            list="external-clubs"
            required
            defaultValue={initialExt ?? ""}
            placeholder="ex. CSM București"
            autoComplete="off"
            className={inputClass}
          />
        )}
      </div>
    </Field>
  );
}
