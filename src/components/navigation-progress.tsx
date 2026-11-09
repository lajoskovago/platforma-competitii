"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin progress bar at the top of the page, shown as soon as an internal link is
 * clicked and hidden when the new route has rendered. Gives immediate feedback
 * that the tap was registered while the server renders the next page.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentKey = `${pathname}?${searchParams.toString()}`;

  // the route we were on when the click happened; visible until the route changes
  const [startedOn, setStartedOn] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  // when the route changes, the pending navigation is over (React's "adjust state on prop change" pattern)
  const [lastKey, setLastKey] = useState(currentKey);
  if (lastKey !== currentKey) {
    setLastKey(currentKey);
    setStartedOn(null);
  }
  const visible = startedOn !== null && startedOn === currentKey;

  // stop the creeping animation once the new page is shown
  useEffect(() => {
    if (!visible && timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
  }, [visible]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      // capture phase: runs before Next's <Link> handler (which calls preventDefault)
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element | null)?.closest?.("a");
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const href = a.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("tel:") || href.startsWith("mailto:")) return;
      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname && url.search === window.location.search) return;

      if (timer.current) clearInterval(timer.current);
      // same format as currentKey (pathname?search)
      setStartedOn(`${window.location.pathname}?${new URLSearchParams(window.location.search).toString()}`);
      setProgress(15);
      // creep towards 90% until the route changes
      timer.current = setInterval(() => setProgress((p) => (p < 90 ? p + (90 - p) * 0.12 : p)), 200);
    }
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (timer.current) clearInterval(timer.current);
    };
  }, []);

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1"
      style={{ opacity: visible ? 1 : 0, transition: "opacity 250ms" }}
    >
      <div
        className="h-full bg-orange-500 shadow-[0_0_8px_rgba(234,88,12,0.7)]"
        style={{ width: `${visible ? progress : 100}%`, transition: "width 200ms ease-out" }}
      />
    </div>
  );
}
