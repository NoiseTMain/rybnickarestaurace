import Link from "next/link";
import { Check, Crown } from "lucide-react";
import { PREMIUM_FEATURES, PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";

/** Místo funkce, která je součástí Premium. */
export function PremiumWall({ title, children, highlight }: { title: string; children?: React.ReactNode; highlight?: string }) {
  return (
    <Card variant="light" className="mx-auto max-w-2xl !p-6 text-center">
      <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 text-gold"><Crown className="h-6 w-6" /></span>
      <h1 className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-ink-2">{children ?? "Tato funkce je součástí HomeOS Premium."}</p>
      <ul className="mx-auto mt-4 max-w-md space-y-1.5 text-left text-sm">
        {PREMIUM_FEATURES.map((f) => (
          <li key={f.key} className={`flex gap-2 ${highlight === f.key ? "text-ink" : "text-ink-2"}`}><Check className="mt-0.5 h-4 w-4 shrink-0 text-gold" /><span><b className={highlight === f.key ? "text-gold-bright" : "text-ink"}>{f.title}</b> – {f.detail}</span></li>
        ))}
      </ul>
      <Link href="/premium" className="mt-5 inline-flex h-11 items-center gap-2 rounded-full bg-gold px-5 font-medium text-[#1b1407]">
        <Crown className="h-4 w-4" />Premium od {formatMoney(PRICES.monthly, { decimals: "never" })} měsíčně
      </Link>
      <p className="mt-2 text-xs text-ink-3">nebo {formatMoney(PRICES.yearly, { decimals: "never" })} ročně · zrušit lze kdykoli · Premium jednoho člena platí pro celou domácnost</p>
    </Card>
  );
}

/** Malá poznámka u funkce v jinak bezplatné sekci. */
export function PremiumHint({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-ink-3"><Crown className="h-3.5 w-3.5 text-gold" />{children} <Link href="/premium" className="text-gold underline">Premium</Link></p>
  );
}
