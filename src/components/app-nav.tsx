"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Building2,
  CalendarDays,
  CalendarOff,
  CalendarX2,
  CircleUser,
  ClipboardCheck,
  Handshake,
  LayoutGrid,
  LogOut,
  Menu,
  Shirt,
  Trophy,
  UserCog,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from "lucide-react";

const ICONS = {
  calendar: CalendarDays,
  trophy: Trophy,
  handshake: Handshake,
  grid: LayoutGrid,
  users: Users,
  club: Building2,
  userCog: UserCog,
  account: CircleUser,
  clipboard: ClipboardCheck,
  calendarOff: CalendarOff,
  calendarX: CalendarX2,
  shirt: Shirt,
  wallet: Wallet,
} satisfies Record<string, LucideIcon>;

export type NavItem = {
  href: string;
  label: string;
  /** shorter label for the phone tab bar */
  short?: string;
  icon: keyof typeof ICONS;
  /** extra path prefixes that belong to this section (e.g. "/grupa" under "Echipele mele") */
  also?: string[];
};

/** Which item is the current section: the longest matching prefix wins. */
function activeHref(pathname: string, items: NavItem[]) {
  let best: { href: string; len: number } | null = null;
  for (const item of items) {
    for (const prefix of [item.href, ...(item.also ?? [])]) {
      const match = prefix === "/" ? pathname === "/" : pathname === prefix || pathname.startsWith(prefix + "/");
      if (match && (!best || prefix.length > best.len)) best = { href: item.href, len: prefix.length };
    }
  }
  return best?.href ?? null;
}

/** Top menu on computers, bottom tab bar (+ "Mai mult" sheet) on phones. */
export function AppNav({
  items,
  signOut,
  variant,
}: {
  items: NavItem[];
  signOut: () => Promise<void>;
  /** "top": computer menu inside the header; "bottom": phone tab bar (must be outside the blurred header) */
  variant: "top" | "bottom";
}) {
  const pathname = usePathname();
  const active = activeHref(pathname, items);
  const [moreOpen, setMoreOpen] = useState(false);
  // close the sheet whenever the page changes ("adjust state on prop change" pattern)
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMoreOpen(false);
  }
  useEffect(() => {
    document.body.style.overflow = moreOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [moreOpen]);

  // phone: up to 5 tabs; with more pages, 4 tabs + "Mai mult"
  const tabs = items.length <= 5 ? items : items.slice(0, 4);
  const hasMore = items.length > 5;
  const activeInMore = hasMore && !tabs.some((t) => t.href === active);

  if (variant === "top") {
    return (
      <nav aria-label="Meniu principal" className="mx-auto hidden max-w-3xl flex-wrap gap-1 px-2 pb-2 text-sm sm:flex">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive = item.href === active;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition ${
                isActive ? "bg-orange-600 font-semibold text-white" : "text-slate-700 hover:bg-slate-100"
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    );
  }

  return (
    <>
      {/* ---------------- phone: bottom tab bar */}
      <nav
        aria-label="Meniu principal"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 backdrop-blur sm:hidden"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <div className="flex">
          {tabs.map((item) => (
            <Tab key={item.href} item={item} active={item.href === active} />
          ))}
          {hasMore && (
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              className={`relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-[11px] ${
                activeInMore ? "font-semibold text-orange-600" : "text-slate-500"
              }`}
            >
              {activeInMore && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-orange-600" />}
              <Menu className="h-5 w-5" aria-hidden />
              Mai mult
            </button>
          )}
        </div>
      </nav>

      {/* ---------------- phone: "Mai mult" sheet with every page */}
      {moreOpen && (
        <div className="fixed inset-0 z-40 sm:hidden" role="dialog" aria-modal="true" aria-label="Toate paginile">
          <button
            type="button"
            aria-label="Închide"
            className="absolute inset-0 bg-slate-900/40"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white p-4 shadow-xl"
            style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}
          >
            <div className="mb-3 flex items-center justify-between">
              <span className="font-semibold">Toate paginile</span>
              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
                aria-label="Închide"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {items.map((item) => {
                const Icon = ICONS[item.icon];
                const isActive = item.href === active;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={`flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border p-2 text-center text-xs ${
                      isActive
                        ? "border-orange-500 bg-orange-50 font-semibold text-orange-700"
                        : "border-slate-200 text-slate-700 active:bg-slate-50"
                    }`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                    {item.label}
                  </Link>
                );
              })}
            </div>
            <form action={signOut} className="mt-3">
              <button className="flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-slate-300 text-sm text-slate-700">
                <LogOut className="h-4 w-4" aria-hidden /> Ieșire
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

function Tab({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = ICONS[item.icon];
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      className={`relative flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-[11px] ${
        active ? "font-semibold text-orange-600" : "text-slate-500"
      }`}
    >
      {active && <span className="absolute inset-x-4 top-0 h-0.5 rounded-full bg-orange-600" />}
      <Icon className="h-5 w-5" aria-hidden />
      <span className="w-full truncate text-center">{item.short ?? item.label}</span>
    </Link>
  );
}

/** Name of the current section, for the phone header. */
export function CurrentSection({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const href = activeHref(pathname, items);
  const item = items.find((i) => i.href === href);
  if (!item) return null;
  return <span className="truncate text-sm font-semibold text-slate-700 sm:hidden">{item.label}</span>;
}
