import Link from "next/link";
import { redirect } from "next/navigation";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, Field, inputClass } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";
import { signIn } from "./actions";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  if (await getCurrentUser()) redirect("/");
  const { eroare } = await searchParams;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-2xl">
          🏀
        </div>
        <h1 className="text-xl font-bold">Competiții Regiunea 5</h1>
        <p className="text-sm text-slate-500">Federația Română de Baschet</p>
      </div>
      {eroare === "link" && (
        <p role="alert" className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Linkul a expirat sau a fost deja folosit. Cereți un link nou din „Am uitat parola”.
        </p>
      )}
      <Card>
        <ActionForm action={signIn}>
          <Field label="Email">
            <input name="email" type="email" autoComplete="email" required className={inputClass} />
          </Field>
          <Field label="Parolă">
            <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
          </Field>
          <SubmitButton>Intră în cont</SubmitButton>
        </ActionForm>
      </Card>
      <Link href="/am-uitat-parola" className="mt-4 py-2 text-center text-sm text-slate-600 underline">
        Am uitat parola
      </Link>
      <div className="mt-6 space-y-1 border-t border-slate-200 pt-4 text-center text-sm">
        <p className="text-slate-500">Nu aveți cont?</p>
        <Link href="/inregistrare-antrenori" className="block py-2 text-orange-700 underline">
          Antrenor sau administrator de club – înregistrare
        </Link>
        <Link href="/inregistrare-oficiali" className="block py-2 text-orange-700 underline">
          Arbitru sau oficial de masă – înregistrare
        </Link>
      </div>
    </main>
  );
}
