import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { APP_HOME, APP_NAME, APP_TAGLINE } from "@/lib/brand";

/** Layout of the public pages (no login needed). */
export default async function PublicLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();
  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 py-1 font-bold">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-base">🏀</span>
            <span className="leading-tight">
              {APP_NAME}
              <span className="block text-[11px] font-normal text-slate-500">{APP_TAGLINE}</span>
            </span>
          </Link>
          <Link
            href={user ? APP_HOME : "/login"}
            className="shrink-0 rounded-lg bg-orange-600 px-3 py-2 text-sm font-semibold text-white hover:bg-orange-700"
          >
            {user ? "Aplicația mea" : "Intră în cont"}
          </Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-16">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto max-w-3xl space-y-1 px-4 py-6 text-center text-sm text-slate-500">
          <p>Programul meciurilor de baschet din Regiunile 5 și 6 · campionate regionale și Campionatul Național.</p>
          <p>
            <Link href="/inregistrare-antrenori" className="underline">
              Înregistrare antrenori și cluburi
            </Link>
            {" · "}
            <Link href="/inregistrare-oficiali" className="underline">
              Înregistrare arbitri și oficiali
            </Link>
          </p>
        </div>
      </footer>
    </>
  );
}
