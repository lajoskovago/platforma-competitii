import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { signUpOfficial } from "./actions";

export const metadata = { title: "Înregistrare arbitri și oficiali – Regiunea 5 FRB" };

export default function OfficialSignUpPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
      <PageTitle sub="Pentru arbitri și oficiali de masă din SR5 și SR6. După înregistrare primiți un email pentru a vă seta parola.">
        Înregistrare arbitri și oficiali
      </PageTitle>
      <Card>
        <ActionForm action={signUpOfficial}>
          <Field label="Nume și prenume">
            <input name="full_name" required autoComplete="name" className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </Field>
          <Field label="Telefon">
            <input name="phone" type="tel" required autoComplete="tel" className={inputClass} />
          </Field>
          <Field label="Regiunea">
            <select name="region" required defaultValue="" className={inputClass}>
              <option value="" disabled>
                Alegeți…
              </option>
              <option value="SR5">Regiunea 5 (SR5)</option>
              <option value="SR6">Regiunea 6 (SR6)</option>
            </select>
          </Field>
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium text-slate-700">Rol</legend>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3">
              <input type="checkbox" name="is_referee" className="h-5 w-5 accent-orange-600" /> Arbitru
            </label>
            <label className="flex min-h-11 items-center gap-3 rounded-lg border border-slate-200 px-3">
              <input type="checkbox" name="is_table_official" className="h-5 w-5 accent-orange-600" /> Oficial de masă
            </label>
          </fieldset>
          {/* honeypot */}
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <SubmitButton>Înregistrează-mă</SubmitButton>
        </ActionForm>
      </Card>
      <Link href="/login" className="mt-4 block py-2 text-center text-sm text-slate-600 underline">
        Am deja cont – intră în cont
      </Link>
    </main>
  );
}
