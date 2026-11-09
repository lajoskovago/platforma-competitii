"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";

type Club = { id: string; name: string; city: string | null };
type Team = { id: string; club_id: string; label: string };

/** Club select, then a team of that club (or none = club admin). */
export function ClubTeamFields({ clubs, teams }: { clubs: Club[]; teams: Team[] }) {
  const [club, setClub] = useState("");
  const [team, setTeam] = useState("");
  const clubTeams = teams.filter((t) => t.club_id === club);

  return (
    <>
      <Field label="Clubul">
        <select
          name="club_id"
          required
          value={club}
          onChange={(e) => {
            setClub(e.target.value);
            setTeam("");
          }}
          className={inputClass}
        >
          <option value="" disabled>
            Alegeți clubul…
          </option>
          {clubs.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
              {c.city ? ` (${c.city})` : ""}
            </option>
          ))}
          <option value="new">+ Clubul meu nu este în listă</option>
        </select>
      </Field>

      {club === "new" && (
        <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs text-slate-500">
            Clubul va fi creat, iar dvs. deveniți administratorul lui. După autentificare adăugați echipele clubului din
            Campionatul Național în pagina „Clubul meu”.
          </p>
          <Field label="Numele clubului">
            <input name="new_club_name" required minLength={3} placeholder="ex. CS Exemplu Oradea" className={inputClass} />
          </Field>
          <Field label="Oraș">
            <input name="new_club_city" required className={inputClass} />
          </Field>
          <Field label="Regiunea">
            <select name="new_club_region" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Alegeți…
              </option>
              <option value="SR5">Regiunea 5 (SR5)</option>
              <option value="SR6">Regiunea 6 (SR6)</option>
            </select>
          </Field>
        </div>
      )}

      {club && club !== "new" && (
        <Field
          label="Echipa pe care o antrenați"
          hint="Dacă nu alegeți o echipă, contul devine administrator al clubului (vede toate echipele și poate adăuga antrenori)."
        >
          <select name="team_id" value={team} onChange={(e) => setTeam(e.target.value)} className={inputClass}>
            <option value="">— Nicio echipă: sunt administratorul clubului —</option>
            {clubTeams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
      )}

      {club && (
        <p className="rounded-lg bg-slate-100 p-3 text-sm text-slate-700">
          Vă înregistrați ca{" "}
          <strong>{team ? `antrenor al echipei ${clubTeams.find((t) => t.id === team)?.label}` : "administrator de club"}</strong>.
        </p>
      )}
    </>
  );
}
