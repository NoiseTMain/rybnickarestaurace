"use client";
import { useEffect } from "react";

export function reportError(message: string, stack?: string, digest?: string) {
  try {
    const body = JSON.stringify({ message: message.slice(0, 500), stack: stack?.slice(0, 4000), digest, path: location.pathname });
    if (navigator.sendBeacon) navigator.sendBeacon("/api/log-error", new Blob([body], { type: "application/json" }));
    else void fetch("/api/log-error", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true });
  } catch { /* nic */ }
}

/** Posílá nezachycené chyby z prohlížeče do přehledu chyb v administraci. */
export function ErrorReporter() {
  useEffect(() => {
    let count = 0;
    const onError = (e: ErrorEvent) => { if (count++ < 5 && e.message && !/ResizeObserver|Script error/.test(e.message)) reportError(e.message, e.error?.stack); };
    const onRejection = (e: PromiseRejectionEvent) => { if (count++ < 5) { const r = e.reason; reportError(r instanceof Error ? r.message : String(r), r instanceof Error ? r.stack : undefined); } };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => { window.removeEventListener("error", onError); window.removeEventListener("unhandledrejection", onRejection); };
  }, []);
  return null;
}
