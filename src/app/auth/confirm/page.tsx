import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/action-form";
import { Card, PageTitle } from "@/components/ui";
import { confirmEmailLink } from "./actions";
import { APP_NAME } from "@/lib/brand";

export const metadata = { title: `Confirmare – ${APP_NAME}` };

/** Landing page for links in invitation / password reset emails (token is used on button press). */
export default async function ConfirmPage({ searchParams }: PageProps<"/auth/confirm">) {
  const sp = (await searchParams) as Record<string, string | undefined>;
  const tokenHash = sp.token_hash ?? "";
  const type = sp.type ?? "";
  const next = sp.next ?? "/";
  const isInvite = type === "invite";

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-4 py-10">
      <div className="mb-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-2xl">🏀</div>
        <PageTitle>{isInvite ? "Bine ați venit!" : "Resetare parolă"}</PageTitle>
      </div>
      <Card>
        {tokenHash && type ? (
          <ActionForm action={confirmEmailLink}>
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <input type="hidden" name="next" value={next} />
            <p className="text-sm text-slate-600">
              {isInvite
                ? "Apăsați butonul pentru a vă activa contul și a vă seta parola."
                : "Apăsați butonul pentru a seta o parolă nouă."}
            </p>
            <SubmitButton>Continuă</SubmitButton>
          </ActionForm>
        ) : (
          <p className="text-sm text-slate-600">Link invalid.</p>
        )}
      </Card>
      <Link href="/am-uitat-parola" className="mt-4 py-2 text-center text-sm text-slate-600 underline">
        Cereți un link nou
      </Link>
    </main>
  );
}
