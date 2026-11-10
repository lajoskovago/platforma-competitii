"use client";

import { usePathname, useRouter } from "next/navigation";
import { useRef, useTransition, type ReactNode } from "react";

/**
 * Filter form that applies itself: selects / dates / checkboxes immediately,
 * text inputs shortly after the user stops typing. Empty fields are left out of the URL.
 */
export function AutoFilterForm({
  children,
  className = "",
  delay = 600,
  showClear = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  /** show "Șterge filtrele" (pass true when any filter is active) */
  showClear?: boolean;
}) {

  const router = useRouter();
  const pathname = usePathname();
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pending, startTransition] = useTransition();

  function apply() {
    if (timer.current) clearTimeout(timer.current);
    const form = formRef.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) {
      if (typeof v === "string" && v.trim()) params.set(k, v.trim());
    }
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  /** Empties the visible fields (hidden ones, e.g. the selected type, are kept) and re-applies. */
  function clear() {
    const form = formRef.current;
    if (!form) return;
    for (const el of Array.from(form.elements) as HTMLInputElement[]) {
      if (el.type === "hidden" || el.tagName === "BUTTON" || el.tagName === "FIELDSET") continue;
      if (el.type === "checkbox" || el.type === "radio") el.checked = false;
      else el.value = "";
    }
    apply();
  }

  return (
    <form
      ref={formRef}
      className={`relative ${className}`}
      onSubmit={(e) => {
        e.preventDefault();
        apply();
      }}
      onChange={(e) => {
        const el = e.target as unknown as HTMLInputElement;
        const typing = el.tagName === "INPUT" && (el.type === "text" || el.type === "search");
        if (typing) {
          if (timer.current) clearTimeout(timer.current);
          timer.current = setTimeout(apply, delay);
        } else {
          apply();
        }
      }}
    >
      {children}
      <div className="flex min-h-6 items-center justify-between gap-2 text-xs">
        <span aria-live="polite" className="text-orange-700">
          {pending ? "Se filtrează…" : ""}
        </span>
        {showClear && (
          <button type="button" onClick={clear} className="py-1 text-slate-600 underline">
            Șterge filtrele
          </button>
        )}
      </div>
    </form>
  );
}
