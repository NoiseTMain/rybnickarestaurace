import type { ReactNode } from "react";
import { cn } from "./cn";

const tones = {
  neutral: "bg-white/[0.06] text-ink-2 border-white/10",
  gold: "bg-gold/15 text-gold-bright border-gold/30",
  positive: "bg-pos/10 text-pos border-pos/25",
  warning: "bg-warn/10 text-warn border-warn/25",
  danger: "bg-neg/10 text-neg border-neg/25",
  info: "bg-info/10 text-info border-info/25",
  dark: "bg-black/60 text-ink border-white/10",
} as const;

export type Tone = keyof typeof tones;

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium", tones[tone], className)}>
      {children}
    </span>
  );
}
