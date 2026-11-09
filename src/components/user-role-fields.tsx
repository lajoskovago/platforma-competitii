import { Field, inputClass } from "@/components/ui";

/** Role / region / official fields for user forms (what is offered depends on who edits). */
export function UserRoleFields({
  isMaster,
  defaults,
}: {
  isMaster: boolean;
  defaults?: { role?: string; region?: string | null; is_referee?: boolean; is_table_official?: boolean };
}) {
  return (
    <>
      {isMaster && (
        <Field label="Rol">
          <select name="role" defaultValue={defaults?.role ?? "user"} className={inputClass}>
            <option value="user">Utilizator (club / antrenor / arbitru / oficial)</option>
            <option value="regional_admin">Administrator regional</option>
            <option value="master_admin">Administrator principal</option>
          </select>
        </Field>
      )}
      <Field label="Regiune" hint="Obligatorie pentru administrator regional, arbitri și oficiali">
        <select name="region" defaultValue={defaults?.region ?? ""} className={inputClass}>
          <option value="">—</option>
          <option value="SR5">SR5</option>
          <option value="SR6">SR6</option>
        </select>
      </Field>
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-medium text-slate-700">Arbitraj</legend>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm">
          <input type="checkbox" name="is_referee" defaultChecked={defaults?.is_referee} className="h-5 w-5 accent-orange-600" />
          Arbitru
        </label>
        <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3 text-sm">
          <input
            type="checkbox"
            name="is_table_official"
            defaultChecked={defaults?.is_table_official}
            className="h-5 w-5 accent-orange-600"
          />
          Oficial de masă
        </label>
      </fieldset>
    </>
  );
}
