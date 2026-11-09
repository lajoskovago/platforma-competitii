"use client";

import { useState } from "react";
import { Field, inputClass } from "@/components/ui";

type Gym = { id: string; name: string; city: string; address: string | null };

/** Pick a gym from the shared list, or add a new one (saved for later use). */
export function GymPicker({ gyms, defaultId }: { gyms: Gym[]; defaultId?: string }) {
  const [value, setValue] = useState(defaultId ?? (gyms.length ? "" : "new"));
  const byCity = gyms.reduce<Record<string, Gym[]>>((acc, g) => {
    (acc[g.city] ??= []).push(g);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <Field label="Sala">
        <select name="gym_id" value={value} onChange={(e) => setValue(e.target.value)} required className={inputClass}>
          <option value="" disabled>
            Alegeți sala…
          </option>
          {Object.entries(byCity).map(([city, list]) => (
            <optgroup key={city} label={city}>
              {list.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </optgroup>
          ))}
          <option value="new">+ Adaugă o sală nouă</option>
        </select>
      </Field>

      {value === "new" && (
        <div className="space-y-3 rounded-lg border border-dashed border-slate-300 p-3">
          <p className="text-xs text-slate-500">Sala va fi salvată în listă pentru turneele următoare.</p>
          <Field label="Numele sălii">
            <input name="gym_name" required placeholder="ex. Sala Sporturilor Transilvania" className={inputClass} />
          </Field>
          <Field label="Oraș">
            <input name="gym_city" required className={inputClass} />
          </Field>
          <Field label="Adresă (opțional)">
            <input name="gym_address" className={inputClass} />
          </Field>
          <Field label="Link Google Maps (opțional)">
            <input name="gym_maps_url" type="url" inputMode="url" placeholder="https://maps.app.goo.gl/…" className={inputClass} />
          </Field>
        </div>
      )}
    </div>
  );
}
