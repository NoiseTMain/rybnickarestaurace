"use client";
import { Bell, Bot, Crown, Gift, Plane, X } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { markPromoSeen } from "@/lib/actions/prefs";
import { PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";

const WAIT = 10;

/** Nabídka Premium hned po registraci – zavřít lze až po 10 vteřinách. */
export function PremiumPromo() {
  const [open, setOpen] = useState(true);
  const [left, setLeft] = useState(WAIT);
  useEffect(() => {
    if (!open || left <= 0) return;
    const t = setTimeout(() => setLeft((x) => x - 1), 1000);
    return () => clearTimeout(t);
  }, [open, left]);
  if (!open) return null;
  const close = () => { if (left > 0) return; setOpen(false); void markPromoSeen(); };
  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center" role="dialog" aria-modal="true" aria-labelledby="promo-title">
      <div className="glass-strong relative w-full max-w-lg rounded-[28px] p-6">
        <button type="button" onClick={close} disabled={left > 0} aria-label={left > 0 ? `Zavřít za ${left} s` : "Zavřít"} className="absolute right-4 top-4 flex h-9 min-w-9 items-center justify-center rounded-full bg-white/10 px-2 text-xs text-ink-2 disabled:cursor-not-allowed">
          {left > 0 ? `${left} s` : <X className="h-4 w-4" />}
        </button>
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-gold/20 text-gold"><Crown className="h-6 w-6" /></span>
        <h2 id="promo-title" className="mt-3 font-[family-name:var(--font-display)] text-2xl font-semibold">Vítejte! Vyzkoušejte Premium</h2>
        <p className="mt-1 text-sm text-ink-2">Odemkněte celé HomeOS – první 3 dny zdarma.</p>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex gap-2"><Bot className="h-4 w-4 shrink-0 text-gold" />AI asistent, který odpoví na cokoli z vašich financí</li>
          <li className="flex gap-2"><Plane className="h-4 w-4 shrink-0 text-gold" />Cestování, 500+ fitness receptů, účtenky z fotky</li>
          <li className="flex gap-2"><Bell className="h-4 w-4 shrink-0 text-gold" />Připomínky plateb a měsíční uzávěrka na telefon</li>
        </ul>
        <Link href="/premium" onClick={() => { setOpen(false); void markPromoSeen(); }} className="mt-5 flex h-12 items-center justify-center gap-2 rounded-full bg-gold font-medium text-[#1b1407]">
          <Gift className="h-4 w-4" />Vyzkoušet 3 dny zdarma
        </Link>
        <p className="mt-2 text-center text-xs text-ink-3">pak {formatMoney(PRICES.monthly, { decimals: "never" })} měsíčně · zrušit kdykoli</p>
        <button type="button" onClick={close} disabled={left > 0} className="mt-2 w-full text-center text-sm text-ink-3 disabled:opacity-50">{left > 0 ? `Pokračovat zdarma (za ${left} s)` : "Pokračovat zdarma"}</button>
      </div>
    </div>
  );
}
