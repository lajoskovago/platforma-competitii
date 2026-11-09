import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { setPassword } from "./actions";

export default async function SetPasswordPage() {
  const user = await requireUser();

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
      <PageTitle sub={user.email}>Setează parola</PageTitle>
      <Card>
        <ActionForm action={setPassword}>
          <Field label="Nume și prenume">
            <input name="full_name" defaultValue={user.fullName} autoComplete="name" required className={inputClass} />
          </Field>
          <Field label="Telefon" hint="Vizibil pentru ceilalți antrenori din grupele dvs.">
            <input name="phone" type="tel" defaultValue={user.phone ?? ""} autoComplete="tel" className={inputClass} />
          </Field>
          <Field label="Parolă nouă" hint="Minim 8 caractere">
            <input name="password" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
          </Field>
          <Field label="Confirmă parola">
            <input name="confirm" type="password" autoComplete="new-password" minLength={8} required className={inputClass} />
          </Field>
          <SubmitButton>Salvează</SubmitButton>
        </ActionForm>
      </Card>
    </main>
  );
}
