import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { Tone } from "@/lib/format";

export function PageTitle({ children, back, sub }: { children: ReactNode; back?: string; sub?: ReactNode }) {
  return (
    <div className="mb-4">
      {back && (
        <Link href={back} className="mb-2 inline-flex items-center gap-1 py-1 text-sm text-slate-500">
          ← Înapoi
        </Link>
      )}
      <h1 className="text-xl font-bold leading-tight text-slate-900">{children}</h1>
      {sub && <div className="mt-1 text-sm text-slate-500">{sub}</div>}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${className}`}>{children}</div>;
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{children}</h2>
      {action}
    </div>
  );
}

const toneClasses: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700",
  amber: "bg-amber-100 text-amber-800",
  red: "bg-red-100 text-red-800",
  blue: "bg-sky-100 text-sky-800",
  green: "bg-emerald-100 text-emerald-800",
};

export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${toneClasses[tone]}`}>
      {children}
    </span>
  );
}

const btn = {
  primary: "bg-orange-600 text-white hover:bg-orange-700 disabled:bg-orange-300",
  secondary: "border border-slate-300 bg-white text-slate-800 hover:bg-slate-50 disabled:opacity-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50 disabled:opacity-50",
  success: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-emerald-300",
};
export type ButtonVariant = keyof typeof btn;

export function buttonClass(variant: ButtonVariant = "primary", full = false) {
  return `inline-flex min-h-11 items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold transition ${btn[variant]} ${full ? "w-full" : ""}`;
}

export function LinkButton({
  variant = "primary",
  full,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant; full?: boolean }) {
  return <Link {...props} className={buttonClass(variant, full)} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "block w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-200";

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">{children}</p>;
}
