import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOut } from "../login/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();

  return (
    <>
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/" className="flex items-center gap-2 py-1 font-bold">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-600 text-base">🏀</span>
            <span className="leading-tight">
              Regiunea 5<span className="block text-[11px] font-normal text-slate-500">Competiții FRB</span>
            </span>
          </Link>
          <form action={signOut}>
            <button className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">Ieșire</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-3xl gap-1 overflow-x-auto px-2 pb-2 text-sm">
          {user.isOfficial && (
            <>
              <NavLink href="/nominalizari">Nominalizările mele</NavLink>
              <NavLink href="/meciuri">Meciuri</NavLink>
              <NavLink href="/indisponibilitate">Indisponibilitate</NavLink>
            </>
          )}
          {(user.teamIds.size > 0 || (!user.isOfficial && !user.isAdmin)) && <NavLink href="/">Echipele mele</NavLink>}
          {user.managedClubIds.length > 0 && <NavLink href="/club">Clubul meu</NavLink>}
          {user.isAdmin && <NavLink href="/admin">Regional</NavLink>}
          {(user.isAdmin || user.teamIds.size > 0) && <NavLink href="/national">Național</NavLink>}
          {user.isAdmin && (
            <>
              <NavLink href="/meciuri">Meciuri</NavLink>
              <NavLink href="/admin/echipe">Echipe</NavLink>
              <NavLink href="/admin/utilizatori">Utilizatori</NavLink>
            </>
          )}
          <NavLink href="/cont">Contul meu</NavLink>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-16">{children}</main>
    </>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="whitespace-nowrap rounded-full px-3 py-1.5 text-slate-700 hover:bg-slate-100">
      {children}
    </Link>
  );
}
