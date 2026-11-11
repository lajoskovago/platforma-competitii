import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, LinkButton, PageTitle, inputClass } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { OfficialFields } from "@/components/official-fields";
import { PushToggle } from "@/components/push-toggle";
import { updateMyProfile } from "./actions";

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageTitle sub={user.email}>Contul meu</PageTitle>
      <Card>
        <ActionForm action={updateMyProfile}>
          <Field label="Nume și prenume">
            <input name="full_name" defaultValue={user.fullName} required className={inputClass} />
          </Field>
          <Field label="Telefon" hint="Vizibil pentru ceilalți antrenori din grupele dvs.">
            <input name="phone" type="tel" defaultValue={user.phone ?? ""} className={inputClass} />
          </Field>
          {user.isOfficial && (
            <OfficialFields city={user.city} skills={user.tableSkills} cityRequired showSkills={user.isTableOfficial} />
          )}
          <SubmitButton>Salvează</SubmitButton>
        </ActionForm>
      </Card>
      {user.isOfficial && (
        <div className="mt-4">
          <PushToggle />
        </div>
      )}
      <div className="mt-4">
        <LinkButton href="/seteaza-parola" variant="secondary" full>
          Schimbă parola
        </LinkButton>
      </div>
    </>
  );
}
