import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { requestPasswordReset } from "../login/actions";

export default function ForgotPasswordPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
      <PageTitle back="/login" sub="Veți primi un email cu un link pentru a seta o parolă nouă.">
        Am uitat parola
      </PageTitle>
      <Card>
        <ActionForm action={requestPasswordReset}>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </Field>
          <SubmitButton>Trimite linkul</SubmitButton>
        </ActionForm>
      </Card>
    </main>
  );
}
