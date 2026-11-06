"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { checkHouseholdAccess } from "@/lib/actions/household";
import { useToast } from "@/components/ui/Toast";

/**
 * Hlídá, zda má uživatel stále přístup k otevřené domácnosti. Když ho vlastník
 * odebere, domácnost do pár vteřin zmizí (bez nutnosti ručně obnovit stránku).
 */
export function AccessWatcher({ householdId }: { householdId: string }) {
  const router = useRouter();
  const toast = useToast();
  const busy = useRef(false);
  useEffect(() => {
    const check = async () => {
      if (busy.current || document.visibilityState !== "visible") return;
      busy.current = true;
      try {
        if (!(await checkHouseholdAccess(householdId))) {
          toast("Přístup k této domácnosti byl odebrán.", "error");
          router.replace("/");
          router.refresh();
        }
      } catch {
        // výpadek sítě – zkusíme příště
      } finally {
        busy.current = false;
      }
    };
    const timer = setInterval(check, 15_000);
    const onVisible = () => void check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [householdId, router, toast]);
  return null;
}
