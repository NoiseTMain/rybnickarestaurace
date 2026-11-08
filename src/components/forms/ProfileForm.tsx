"use client";
import { Check } from "lucide-react";
import { useState, useTransition } from "react";
import { saveProfile } from "@/lib/actions/prefs";
import { PROFILES, SECTIONS } from "@/lib/profiles";
import type { LifeProfile } from "@/lib/db/types";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/components/ui/cn";

/** Životní situace a vlastní výběr sekcí v menu. */
export function ProfileForm({ profile, hidden }: { profile: LifeProfile | null; hidden: string[] }) {
  const [p, setP] = useState<LifeProfile | null>(profile);
  const [h, setH] = useState<string[]>(hidden);
  const [pending, start] = useTransition();
  const toast = useToast();
  const save = (np: LifeProfile | null, nh: string[]) => {
    setP(np);
    setH(nh);
    start(async () => {
      const r = await saveProfile(np, nh);
      toast(r.ok ? "Uloženo" : r.error ?? "Nepovedlo se", r.ok ? undefined : "error");
    });
  };
  return (
    <div className={cn("space-y-5", pending && "opacity-80")}>
      <div>
        <p className="mb-2 text-sm text-ink-2">Vaše situace – podle ní nabídneme sekce a tipy</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PROFILES.map((x) => (
            <button key={x.key} type="button" aria-pressed={p === x.key} onClick={() => save(x.key, x.hide)}
              className={cn("rounded-2xl border p-3 text-left text-sm transition", p === x.key ? "border-gold bg-gold/15" : "border-white/10 hover:bg-white/[0.04]")}>
              <span className="text-xl">{x.emoji}</span>
              <span className="mt-1 block font-medium">{x.label}</span>
              <span className="block text-[11px] text-ink-3">{x.detail}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm text-ink-2">Sekce v menu (Přehled, Příjmy a výdaje a Nastavení zůstávají vždy)</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {SECTIONS.map((s) => {
            const on = !h.includes(s.key);
            return (
              <label key={s.key} className="flex cursor-pointer items-center justify-between rounded-xl border border-white/10 px-3 py-2 text-sm">
                {s.label}
                <span className="flex items-center gap-2">
                  <input type="checkbox" className="peer sr-only" checked={on} onChange={() => save(p, on ? [...h, s.key] : h.filter((x) => x !== s.key))} aria-label={`Zobrazit ${s.label}`} />
                  <span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", on ? "border-gold bg-gold text-[#1b1407]" : "border-white/20")}>{on && <Check className="h-3.5 w-3.5" />}</span>
                </span>
              </label>
            );
          })}
        </div>
      </div>
    </div>
  );
}
