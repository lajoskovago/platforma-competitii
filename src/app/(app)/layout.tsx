import Link from "next/link";
import { AppNav, CurrentSection, type NavItem } from "@/components/app-nav";
import { isNominator, requireUser, type CurrentUser } from "@/lib/auth";
import { APP_NAME, APP_TAGLINE } from "@/lib/brand";
import { isImpersonating } from "@/lib/impersonation";
import { signOut } from "../login/actions";
import { stopImpersonation } from "./impersonare/actions";

/** The pages this user can open, most used first (the phone tab bar shows the first 4–5). */
function navItems(user: CurrentUser): NavItem[] {
  const hasTeams = user.teamIds.size > 0;
  const items: NavItem[] = [];
  const add = (cond: boolean, item: NavItem) => {
    if (cond && !items.some((i) => i.href === item.href)) items.push(item);
  };

  // referees / table officials
  add(user.isOfficial, { href: "/nominalizari", label: "Nominalizările mele", short: "Nominalizări", icon: "clipboard" });
  // coaches / club admins
  add(hasTeams || (!user.isOfficial && !user.isAdmin), {
    href: "/",
    label: "Echipele mele",
    short: "Echipe",
    icon: "users",
    also: user.isAdmin ? [] : ["/grupa"],
  });
  add(user.managedClubIds.length > 0, { href: "/club", label: "Clubul meu", short: "Club", icon: "club" });
  // admins
  add(user.isAdmin, { href: "/admin", label: "Regional", icon: "grid", also: ["/grupa"] });
  add(user.isAdmin || hasTeams, { href: "/national", label: "Național", icon: "trophy" });
  add(user.isAdmin || hasTeams || user.isOfficial || user.canNominate, {
    href: "/amicale",
    label: "Amicale",
    icon: "handshake",
  });
  add(user.isAdmin || user.isOfficial, { href: "/meciuri", label: "Meciuri", icon: "calendar", also: ["/meci"] });
  add(user.isOfficial, { href: "/indisponibilitate", label: "Indisponibilitatea mea", short: "Indisponibil", icon: "calendarOff" });
  add(isNominator(user), { href: "/indisponibilitati", label: "Indisponibilități", icon: "calendarX" });
  add(user.isAdmin, { href: "/admin/echipe", label: "Echipe", icon: "shirt" });
  add(user.isAdmin, { href: "/admin/utilizatori", label: "Utilizatori", icon: "userCog" });
  add(true, { href: "/cont", label: "Contul meu", short: "Cont", icon: "account" });
  return items;
}

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  const impersonating = await isImpersonating();
  const items = navItems(user);

  return (
    <>
      {impersonating && (
        <div className="sticky top-0 z-20 bg-red-600 px-4 py-2 text-sm text-white">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-2">
            <span>
              👤 Sunteți conectat ca <strong>{user.fullName || user.email}</strong> (suport). Acțiunile se fac în numele
              acestui utilizator.
            </span>
            <form action={stopImpersonation}>
              <button className="min-h-9 rounded-lg bg-white px-3 font-semibold text-red-700">Revino la contul meu</button>
            </form>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 px-4 py-2">
          <Link href="/" className="flex min-w-0 items-center gap-2 py-1 font-bold">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-600 text-base">🏀</span>
            <span className="hidden leading-tight sm:block">
              {APP_NAME}
              <span className="block text-[11px] font-normal text-slate-500">{APP_TAGLINE}</span>
            </span>
          </Link>
          {/* phone: name of the current page instead of the app name */}
          <div className="min-w-0 flex-1 sm:hidden">
            <CurrentSection items={items} />
          </div>
          <form action={signOut} className="hidden sm:block">
            <button className="min-h-11 rounded-lg px-3 text-sm text-slate-600 hover:bg-slate-100">Ieșire</button>
          </form>
        </div>
        <AppNav items={items} signOut={signOut} variant="top" />
      </header>
      <AppNav items={items} signOut={signOut} variant="bottom" />
      {/* bottom padding leaves room for the phone tab bar */}
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-4 pb-28 sm:pb-16">{children}</main>
    </>
  );
}
