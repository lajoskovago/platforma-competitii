"use client";

import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import { deletePushSubscription, savePushSubscription, sendTestPush } from "@/app/(app)/notificari/actions";

type State =
  | "loading"
  | "unsupported" // browser without push
  | "ios-install" // iPhone: must be added to the Home Screen first
  | "denied" // permission blocked in the browser settings
  | "off"
  | "on";

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

function isIos() {
  return /iPhone|iPad|iPod/.test(navigator.userAgent);
}
function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

async function currentState(): Promise<State> {
  if (isIos() && !isStandalone()) return "ios-install";
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
  if (Notification.permission === "denied") return "denied";
  const reg = await navigator.serviceWorker.getRegistration("/sw.js");
  const sub = await reg?.pushManager.getSubscription();
  return sub ? "on" : "off";
}

/** "Notificări pe telefon": turn push notifications on / off for this device. */
export function PushToggle({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<State>("loading");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let cancelled = false;
    currentState().then((s) => {
      if (!cancelled) setState(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  async function enable() {
    setBusy(true);
    setMessage("");
    try {
      const key = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "")
        .trim()
        .replace(/^['"]|['"]$/g, "")
        .replace(/^NEXT_PUBLIC_VAPID_PUBLIC_KEY=/, "")
        .replace(/\s+/g, "")
        .replace(/=+$/, "");
      if (!key) throw new Error("Notificările nu sunt configurate pe server.");
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "off");
        return;
      }
      const sub =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(key) }));
      const res = await savePushSubscription(sub.toJSON(), navigator.userAgent);
      if ("error" in res && res.error) throw new Error(res.error);
      setState("on");
      setMessage("Notificările sunt pornite pe acest dispozitiv.");
    } catch (e) {
      console.error("[push] enable failed", e);
      const msg = (e as Error).message ?? "";
      setMessage(
        msg.includes("configurate")
          ? msg
          : "Nu s-au putut porni notificările în acest browser. Pe Android folosiți Chrome; pe iPhone deschideți aplicația de pe ecranul principal. Verificați și că notificările sunt permise în setările telefonului.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function disable() {
    setBusy(true);
    setMessage("");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await deletePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setState("off");
      setMessage("Notificările sunt oprite pe acest dispozitiv.");
    } finally {
      setBusy(false);
    }
  }

  async function test() {
    setBusy(true);
    const res = await sendTestPush();
    setMessage(res.error ?? res.ok ?? "");
    setBusy(false);
  }

  if (state === "loading") return null;

  // compact (Nominalizările mele): when already on, just a short line with the test button
  if (compact && state === "on") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>🔔 Notificările sunt pornite</span>
          <button type="button" onClick={test} disabled={busy} className="py-1 font-semibold text-emerald-800 underline">
            {busy ? "Se trimite…" : "Trimite o notificare de test"}
          </button>
        </div>
        {message && <p className="mt-1 text-xs text-slate-600">{message}</p>}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border p-4 ${state === "on" ? "border-emerald-200 bg-emerald-50" : "border-orange-200 bg-orange-50"}`}>
      <div className="font-semibold">🔔 Notificări pe telefon</div>
      {state === "on" && (
        <>
          <p className="mt-1 text-sm text-slate-700">
            Pornite pe acest dispozitiv. Primiți nominalizările noi, anulările, modificările de dată / oră / sală și
            reamintirea din ziua dinaintea meciului.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={test} disabled={busy} className={buttonClass("secondary")}>
              Trimite o notificare de test
            </button>
            <button type="button" onClick={disable} disabled={busy} className={buttonClass("danger")}>
              Oprește
            </button>
          </div>
        </>
      )}
      {state === "off" && (
        <>
          <p className="mt-1 text-sm text-slate-700">
            Primiți pe telefon nominalizările noi, anulările, modificările de meci și o reamintire cu o zi înainte.
          </p>
          <button type="button" onClick={enable} disabled={busy} className={`${buttonClass("primary", true)} mt-3`}>
            {busy ? "Se pornește…" : "Activează notificările"}
          </button>
        </>
      )}
      {state === "ios-install" && (
        <div className="mt-1 space-y-1 text-sm text-slate-700">
          <p>Pe iPhone, notificările merg doar din aplicația adăugată pe ecranul principal:</p>
          <ol className="list-decimal space-y-0.5 pl-5">
            <li>
              Apăsați butonul <strong>Partajare</strong> (pătratul cu săgeată) din Safari.
            </li>
            <li>
              Alegeți <strong>„Adaugă pe ecranul principal”</strong> („Add to Home Screen”).
            </li>
            <li>Deschideți aplicația de pe ecranul principal și reveniți aici pentru a activa notificările.</li>
          </ol>
          <p className="text-xs text-slate-500">Necesită iOS 16.4 sau mai nou.</p>
        </div>
      )}
      {state === "denied" && (
        <p className="mt-1 text-sm text-slate-700">
          Notificările sunt blocate pentru acest site. Permiteți-le din setările browserului (iconița de lângă adresă →
          Notificări → Permite), apoi reîncărcați pagina.
        </p>
      )}
      {state === "unsupported" && (
        <p className="mt-1 text-sm text-slate-700">
          Acest browser nu suportă notificări. Pe Android folosiți Chrome; pe iPhone adăugați aplicația pe ecranul principal.
        </p>
      )}
      {message && <p className="mt-2 text-sm text-slate-600">{message}</p>}
    </div>
  );
}
