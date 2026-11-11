"use client";

import { useId, useMemo, useRef, useState } from "react";
import { inputClass } from "@/components/ui";

export type OfficialOption = {
  id: string;
  name: string;
  city?: string;
  warnings: string[];
  /** non-blocking info, e.g. another game at the same gym */
  notes?: string[];
  /** has the skill this position needs */
  skilled?: boolean;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .trim();

/**
 * Type-to-search picker for a referee / table official. Submits the chosen
 * person's id in a hidden input named `name` (empty = position left free).
 */
export function OfficialCombobox({
  name,
  options,
  defaultId,
  label,
}: {
  name: string;
  options: OfficialOption[];
  defaultId?: string;
  label: string;
}) {
  const initial = options.find((o) => o.id === defaultId) ?? null;
  const [selected, setSelected] = useState<OfficialOption | null>(initial);
  const [query, setQuery] = useState(initial?.name ?? "");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = norm(query);
    const list =
      selected && query === selected.name
        ? options
        : options.filter((o) => norm(o.name).includes(q) || norm(o.city ?? "").includes(q));
    // available people first, then those with the right skill, then by name
    return [...list]
      .sort(
        (a, b) =>
          a.warnings.length - b.warnings.length ||
          Number(!!b.skilled) - Number(!!a.skilled) ||
          a.name.localeCompare(b.name, "ro"),
      )
      .slice(0, 10);
  }, [query, options, selected]);

  function choose(o: OfficialOption | null) {
    setSelected(o);
    setQuery(o?.name ?? "");
    setOpen(false);
  }

  return (
    <div className="relative flex-1">
      <input type="hidden" name={name} value={selected?.id ?? ""} />
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-label={label}
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          placeholder="Scrieți un nume sau un oraș…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(null);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, matches.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && matches[active]) {
              e.preventDefault();
              choose(matches[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          className={`${inputClass} pr-9 ${selected?.warnings.length ? "border-amber-400" : ""}`}
        />
        {query && (
          <button
            type="button"
            aria-label="Golește poziția"
            onClick={() => {
              choose(null);
              inputRef.current?.focus();
            }}
            className="absolute inset-y-0 right-0 flex w-9 items-center justify-center text-slate-400"
          >
            ✕
          </button>
        )}
      </div>
      {selected && selected.warnings.length > 0 && (
        <p className="mt-1 text-xs text-amber-700">⚠️ {selected.warnings.join("; ")}</p>
      )}
      {selected && selected.warnings.length === 0 && (selected.notes ?? []).length > 0 && (
        <p className="mt-1 text-xs text-slate-500">{selected.notes!.join("; ")}</p>
      )}
      {open && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {matches.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">Niciun rezultat</li>}
          {matches.map((o, i) => (
            <li
              key={o.id}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${i === active ? "bg-orange-50" : ""}`}
            >
              <span className={o.warnings.length ? "text-slate-500" : "font-medium"}>{o.name}</span>
              {o.city && <span className="ml-1 text-xs text-slate-500">· {o.city}</span>}
              {o.skilled && <span className="ml-1 text-xs text-emerald-700">✓</span>}
              {o.warnings.length > 0 && <span className="block text-xs text-amber-700">⚠️ {o.warnings.join("; ")}</span>}
              {(o.notes ?? []).length > 0 && <span className="block text-xs text-slate-500">{o.notes!.join("; ")}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
