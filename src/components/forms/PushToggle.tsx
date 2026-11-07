"use client";
import { Bell, BellOff } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { removePushSubscription, savePushSubscription } from "@/lib/actions/push";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

function b64ToUint8(b64: string) {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

/** Zapnutí týdenního souhrnu jako oznámení na telefonu (iPhone: jen z aplikace přidané na plochu). */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<"unsupported" | "off" | "on" | "loading">("loading");
  const [endpoint, setEndpoint] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toast = useToast();
  useEffect(() => {
    (async () => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) return setState("unsupported");
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      setEndpoint(sub?.endpoint ?? null);
      setState(sub ? "on" : "off");
    })().catch(() => setState("unsupported"));
  }, []);
  if (!publicKey) return <p className="text-xs text-ink-3">Oznámení na telefon zatím nejsou na serveru zapnutá (vyžadují nastavení klíčů – viz README).</p>;
  if (state === "unsupported") return <p className="text-xs text-ink-3">Tento prohlížeč oznámení nepodporuje. Na iPhonu nejdřív přidejte HomeOS na plochu (Sdílet → Přidat na plochu) a oznámení zapněte z ní.</p>;
  return state === "on" ? (
    <Button size="sm" icon={<BellOff className="h-4 w-4" />} loading={pending} onClick={() => start(async () => {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      await sub?.unsubscribe();
      if (endpoint) await removePushSubscription(endpoint);
      setState("off");
      toast("Oznámení vypnuta");
    })}>Vypnout týdenní souhrn na telefon</Button>
  ) : (
    <Button size="sm" variant="primary" icon={<Bell className="h-4 w-4" />} loading={pending || state === "loading"} onClick={() => start(async () => {
      try {
        const perm = await Notification.requestPermission();
        if (perm !== "granted") return toast("Oznámení nejsou povolená v nastavení zařízení", "error");
        const reg = await navigator.serviceWorker.register("/sw.js");
        await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToUint8(publicKey) });
        const r = await savePushSubscription(sub.toJSON());
        if (!r.ok) return toast(r.error ?? "Nepovedlo se", "error");
        setEndpoint(sub.endpoint);
        setState("on");
        toast(r.message ?? "Zapnuto");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Nepovedlo se", "error");
      }
    })}>Zapnout týdenní souhrn na telefon</Button>
  );
}
