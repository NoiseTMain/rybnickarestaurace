"use client";
import { Check } from "lucide-react";
import { useState } from "react";
import { saveTheme } from "@/lib/actions/theme";
import { ACCENTS, BACKGROUNDS, themeVars, type Accent, type Background } from "@/lib/theme";
import { cn } from "@/components/ui/cn";
import { useToast } from "@/components/ui/Toast";

/** Výběr vzhledu – změna se projeví okamžitě a uloží se na tomto zařízení. */
export function ThemePicker({ initialAccent, initialBg }: { initialAccent: Accent; initialBg: Background }) {
  const [accent, setAccent] = useState(initialAccent);
  const [bg, setBg] = useState(initialBg);
  const toast = useToast();
  const apply = async (a: Accent, b: Background) => {
    setAccent(a);
    setBg(b);
    const root = document.documentElement;
    for (const [k, v] of Object.entries(themeVars(a, b))) root.style.setProperty(k, v);
    root.setAttribute("data-accent", a);
    root.setAttribute("data-bg", b);
    document.querySelector('meta[name="theme-color"]')?.setAttribute("content", BACKGROUNDS[b].base);
    window.dispatchEvent(new Event("homeos-theme"));
    const r = await saveTheme(a, b);
    if (r.ok) toast("Vzhled uložen");
  };
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">Barva zvýraznění</p>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {(Object.keys(ACCENTS) as Accent[]).map((a) => (
            <button key={a} type="button" onClick={() => apply(a, bg)} aria-pressed={accent === a}
              className={cn("flex flex-col items-center gap-2 rounded-2xl border p-3 text-xs transition", accent === a ? "border-ink/60 bg-white/[0.07]" : "border-white/10 hover:bg-white/[0.04]")}>
              <span className="relative flex h-10 w-10 items-center justify-center rounded-full shadow-lg" style={{ background: `linear-gradient(135deg, ${ACCENTS[a].bright}, ${ACCENTS[a].deep})` }}>
                {accent === a && <Check className="h-5 w-5 text-[#1b1407]" />}
              </span>
              <span className="text-center text-ink-2">{ACCENTS[a].label}</span>
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-ink-3">Pozadí</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {(Object.keys(BACKGROUNDS) as Background[]).map((b) => (
            <button key={b} type="button" onClick={() => apply(accent, b)} aria-pressed={bg === b}
              className={cn("overflow-hidden rounded-2xl border text-left text-xs transition", bg === b ? "border-ink/60" : "border-white/10")}>
              <span className="block h-14" style={{ background: `radial-gradient(circle at 20% 0%, ${ACCENTS[accent].gold}40, transparent 70%), ${BACKGROUNDS[b].base}` }} />
              <span className="flex items-center justify-between gap-1 bg-white/[0.04] px-3 py-2 text-ink-2">{BACKGROUNDS[b].label}{bg === b && <Check className="h-3.5 w-3.5 text-gold" />}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
