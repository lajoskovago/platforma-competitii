"use client";

/** Ticks / unticks every checkbox in the same form whose name starts with `prefix`. */
export function CheckAll({ prefix, label }: { prefix: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
      <input
        type="checkbox"
        className="h-4 w-4 accent-orange-600"
        onChange={(e) => {
          const form = e.currentTarget.form;
          if (!form) return;
          for (const el of Array.from(form.elements) as HTMLInputElement[]) {
            if (el.type === "checkbox" && el.name.startsWith(prefix)) el.checked = e.currentTarget.checked;
          }
        }}
      />
      {label}
    </label>
  );
}
