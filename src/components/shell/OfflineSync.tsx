"use client";
import { CloudOff, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useSyncExternalStore } from "react";
import { saveTripExpense } from "@/lib/actions/travel";
import { saveTransaction } from "@/lib/actions/transactions";
import { initialResult } from "@/lib/actions/result";
import { OFFLINE_EVENT, readQueue, removeFromQueue } from "@/lib/offline-queue";
import { useToast } from "@/components/ui/Toast";
import { useT } from "@/components/I18n";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  window.addEventListener(OFFLINE_EVENT, cb);
  return () => { window.removeEventListener("online", cb); window.removeEventListener("offline", cb); window.removeEventListener(OFFLINE_EVENT, cb); };
};

/** Registrace offline režimu a odeslání výdajů zapsaných bez připojení. */
export function OfflineSync() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  const pending = useSyncExternalStore(subscribe, () => readQueue().length, () => 0);
  const toast = useToast();
  const { t } = useT();
  const router = useRouter();
  const busy = useRef(false);

  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!online || !pending || busy.current) return;
    busy.current = true;
    (async () => {
      let sent = 0;
      for (const item of readQueue()) {
        const fd = new FormData();
        for (const [k, v] of item.entries) fd.append(k, v);
        try {
          const r = item.kind === "trip_expense" ? await saveTripExpense(initialResult, fd) : await saveTransaction(initialResult, fd);
          if (r.ok) { removeFromQueue(item.id); sent++; }
          else { toast(`Nepodařilo se odeslat „${item.label}“: ${r.error ?? "chyba"}`, "error"); removeFromQueue(item.id); }
        } catch {
          break; // stále bez spojení – zkusí se znovu
        }
      }
      busy.current = false;
      if (sent) { toast(`Odesláno ${sent} ${sent === 1 ? "záznam zapsaný" : "záznamy zapsané"} bez připojení`); router.refresh(); }
    })();
  }, [online, pending, toast, router]);

  if (online && !pending) return null;
  return (
    <div className="fixed inset-x-0 top-[env(safe-area-inset-top)] z-50 mx-auto mt-2 flex w-fit max-w-[92vw] items-center gap-2 rounded-full border border-warn/30 bg-[#1b1407]/95 px-4 py-1.5 text-xs text-warn shadow-lg" role="status">
      {online ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <CloudOff className="h-3.5 w-3.5" />}
      {online ? t("offline.sending", { n: pending }) : `${t("offline.off")}${pending ? ` · ${t("offline.pending", { n: pending })}` : t("offline.canWrite")}`}
    </div>
  );
}
