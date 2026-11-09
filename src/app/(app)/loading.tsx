/** Shown instantly while a page of the app is being rendered on the server. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="animate-pulse">
      <span className="sr-only">Se încarcă…</span>
      <div className="mb-2 h-4 w-20 rounded bg-slate-200" />
      <div className="mb-1 h-6 w-2/3 rounded bg-slate-200" />
      <div className="mb-6 h-4 w-1/2 rounded bg-slate-100" />
      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="mb-2 h-3 w-24 rounded bg-slate-200" />
            <div className="mb-2 h-5 w-3/4 rounded bg-slate-200" />
            <div className="h-4 w-1/2 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-slate-500">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        Se încarcă…
      </div>
    </div>
  );
}
