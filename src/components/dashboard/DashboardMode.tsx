"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/components/ui/cn";
import { setDashboardMode } from "@/lib/actions/dashboard";
import { useT } from "@/components/I18n";

/** Přepínač Jednoduchý / Podrobný přehled (pamatuje se v cookie). */
export function DashboardMode({ mode }: { mode: "simple" | "detailed" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const { t } = useT();
  const set = (m: "simple" | "detailed") => {
    start(async () => {
      await setDashboardMode(m);
      router.refresh();
    });
  };
  return (
    <div className={cn("flex rounded-full border border-white/[0.08] bg-white/[0.05] p-1 text-sm", pending && "opacity-60")} role="radiogroup" aria-label="Zobrazení přehledu">
      {(["simple", "detailed"] as const).map((m) => (
        <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => set(m)} className={cn("rounded-full px-3 py-1", mode === m ? "bg-ink font-medium text-base" : "text-ink-2 hover:text-ink")}>
          {m === "simple" ? t("dash.simple") : t("dash.detailed")}
        </button>
      ))}
    </div>
  );
}
