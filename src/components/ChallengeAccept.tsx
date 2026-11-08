"use client";
import { useState, useTransition } from "react";
import { acceptChallenge } from "@/lib/actions/challenges";
import { useToast } from "@/components/ui/Toast";
import { Button } from "@/components/ui/Button";
import { parseMoney, toInputValue } from "@/lib/money";

/** Přijetí navržené výzvy s možností upravit cíl. */
export function ChallengeAccept({ kind, target, categoryId, unit }: { kind: string; target: number; categoryId: string | null; unit: "money" | "days" | "percent" }) {
  const [value, setValue] = useState(unit === "money" ? toInputValue(target) : String(target));
  const [pending, start] = useTransition();
  const toast = useToast();
  const suffix = unit === "money" ? "Kč" : unit === "days" ? "dní" : "%";
  return (
    <div className="mt-2 flex items-center gap-2">
      <label className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/30 px-2 py-1 text-sm">
        <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="decimal" className="w-20 bg-transparent text-right outline-none" aria-label="Cíl výzvy" />
        <span className="text-xs text-ink-3">{suffix}</span>
      </label>
      <Button size="sm" variant="primary" loading={pending} onClick={() => start(async () => {
        const t = unit === "money" ? parseMoney(value) ?? 0 : Math.round(Number(value.replace(",", ".")) || 0);
        const r = await acceptChallenge({ kind, target: t, category_id: categoryId });
        toast(r.ok ? r.message ?? "Hotovo" : r.error ?? "Chyba", r.ok ? undefined : "error");
      })}>Přijmout</Button>
    </div>
  );
}
