import Link from "next/link";
import { connection } from "next/server";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, PageTitle, inputClass } from "@/components/ui";
import { createSupabaseAdmin } from "@/lib/supabase/server";
import { signUpClubMember } from "./actions";
import { ClubTeamFields } from "./club-team-fields";

export const metadata = { title: "Înregistrare antrenori și cluburi – Regiunea 5 FRB" };

export default async function ClubSignUpPage() {
  await connection(); // render on every request: the club / team lists change
  // Public page: visitors have no database access, so the lists are read server-side.
  const admin = createSupabaseAdmin();
  const [{ data: clubs }, { data: teams }] = await Promise.all([
    admin.from("clubs").select("id, name, city").order("name"),
    admin.from("teams").select("id, name, club_id, category:categories(code, scope, sort_order)"),
  ]);

  const teamOptions = (teams ?? [])
    .sort(
      (a, b) =>
        (a.category?.sort_order ?? 0) - (b.category?.sort_order ?? 0) || a.name.localeCompare(b.name, "ro"),
    )
    .map((t) => ({
      id: t.id,
      club_id: t.club_id,
      label: `${t.category?.scope === "national" ? "Național " : ""}${t.category?.code} – ${t.name}`,
    }));

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-10">
      <PageTitle sub="Pentru antrenori și administratorii cluburilor din SR5 și SR6. După înregistrare primiți un email pentru a vă seta parola.">
        Înregistrare antrenori și cluburi
      </PageTitle>
      <Card>
        <ActionForm action={signUpClubMember}>
          <Field label="Nume și prenume">
            <input name="full_name" required autoComplete="name" className={inputClass} />
          </Field>
          <Field label="Email">
            <input name="email" type="email" required autoComplete="email" className={inputClass} />
          </Field>
          <Field label="Telefon" hint="Vizibil pentru antrenorii din grupele dvs.">
            <input name="phone" type="tel" required autoComplete="tel" className={inputClass} />
          </Field>
          <ClubTeamFields clubs={clubs ?? []} teams={teamOptions} />
          {/* honeypot */}
          <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <SubmitButton>Înregistrează-mă</SubmitButton>
          <p className="text-xs text-slate-500">
            Înregistrările sunt verificate de administratorii Regiunii 5; conturile asociate greșit vor fi eliminate.
          </p>
        </ActionForm>
      </Card>
      <p className="mt-4 text-center text-sm text-slate-600">
        Echipa lipsește din listă? Echipele din Campionatul Național le adaugă administratorul clubului, din „Clubul meu”.
      </p>
      <Link href="/login" className="mt-2 block py-2 text-center text-sm text-slate-600 underline">
        Am deja cont – intră în cont
      </Link>
    </main>
  );
}
