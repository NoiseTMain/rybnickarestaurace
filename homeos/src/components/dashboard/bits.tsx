import Link from "next/link";
import { ArrowUpRight, Info } from "lucide-react";
import type { ReactNode } from "react";
import { formatMoney, type Cents } from "@/lib/money";
import { cn } from "@/components/ui/cn";
import type { Insight } from "@/lib/assistant";

export function Stat({ label, value, hint, tone, big, info }: { label: string; value: Cents; hint?: ReactNode; tone?: "pos" | "neg" | "gold"; big?: boolean; info?: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-ink-3">
        {label}
        {info && <span title={info} className="cursor-help"><Info className="h-3 w-3" /></span>}
      </div>
      <div className={cn("num mt-1 truncate font-semibold", big ? "text-3xl sm:text-4xl" : "text-xl sm:text-2xl", tone === "pos" && "text-pos", tone === "neg" && "text-neg", tone === "gold" && "gold-text")}>
        {formatMoney(value, { decimals: "never" })}
      </div>
      {hint && <div className="mt-0.5 truncate text-xs text-ink-3">{hint}</div>}
    </div>
  );
}

export function CardLink({ href, label = "Detail" }: { href: string; label?: string }) {
  return (
    <Link href={href} aria-label={label} className="flex h-8 w-8 items-center justify-center rounded-full border border-white/15 bg-white/[0.06] text-ink-2 transition hover:bg-white/15 hover:text-ink">
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}

export function KV({ k, v, strong }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1 text-sm">
      <span className="text-ink-2">{k}</span>
      <span className={cn("text-right", strong && "font-semibold")}>{v}</span>
    </div>
  );
}

const toneClass = { positive: "border-pos/20 bg-pos/[0.06]", neutral: "border-white/10 bg-white/[0.03]", warning: "border-warn/25 bg-warn/[0.07]", danger: "border-neg/25 bg-neg/[0.07]" } as const;
const dotClass = { positive: "bg-pos", neutral: "bg-ink-3", warning: "bg-warn", danger: "bg-neg" } as const;

export function InsightItem({ i }: { i: Insight }) {
  const body = (
    <div className={cn("flex gap-3 rounded-2xl border px-3.5 py-3", toneClass[i.tone])}>
      <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dotClass[i.tone])} aria-hidden />
      <div className="min-w-0 text-sm">
        <p className="text-ink">{i.title}</p>
        {i.detail && <p className="mt-0.5 text-xs text-ink-3">{i.detail}</p>}
      </div>
    </div>
  );
  return i.href ? <Link href={i.href} className="block transition hover:brightness-125">{body}</Link> : body;
}
