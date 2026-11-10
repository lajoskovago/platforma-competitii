import { Field, inputClass } from "@/components/ui";
import { TABLE_SKILLS, TABLE_SKILL_LABEL } from "@/lib/format";

/** City + table-official skills (sign-up, own account, admin user page). */
export function OfficialFields({
  city,
  skills = [],
  cityRequired,
  showSkills = true,
}: {
  city?: string | null;
  skills?: string[];
  cityRequired?: boolean;
  showSkills?: boolean;
}) {
  return (
    <>
      <Field label="Oraș" hint="Orașul în care locuiți – ajută la nominalizări">
        <input name="city" defaultValue={city ?? ""} required={cityRequired} className={inputClass} />
      </Field>
      {showSkills && (
        <fieldset>
          <legend className="mb-1 text-sm font-medium text-slate-700">
            Ce puteți face ca oficial de masă <span className="font-normal text-slate-500">(bifați tot ce se aplică)</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {TABLE_SKILLS.map((k) => (
              <label key={k} className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm">
                <input
                  type="checkbox"
                  name={`skill_${k}`}
                  defaultChecked={skills.includes(k)}
                  className="h-5 w-5 accent-orange-600"
                />
                {TABLE_SKILL_LABEL[k]}
              </label>
            ))}
          </div>
        </fieldset>
      )}
    </>
  );
}
