"use client";
import { useState, useTransition } from "react";
import { Crown, Gift } from "lucide-react";
import { startCheckout } from "@/lib/actions/billing";
import { PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";

export function CheckoutButtons({ enabled, trial }: { enabled: boolean; trial: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const go = (plan: "monthly" | "yearly", withTrial = false) => start(async () => {
    setError(null);
    const r = await startCheckout(plan, withTrial);
    if (r.url) window.location.href = r.url;
    else setError(r.error ?? "Nepovedlo se");
  });
  const yearlySave = Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100);
  const perMonth = formatMoney(Math.round(PRICES.yearly / 12), { decimals: "never" });
  return (
    <div className="space-y-3">
      {trial && (
        <div className="rounded-2xl border border-gold/50 bg-gradient-to-br from-gold/20 to-transparent p-4 text-center">
          <Gift className="mx-auto h-7 w-7 text-gold" />
          <p className="mt-1 text-lg font-semibold">3 dny Premium zdarma</p>
          <p className="text-sm text-ink-2">Vyzkoušejte všechno. Po 3 dnech se automaticky začne platit {formatMoney(PRICES.monthly, { decimals: "never" })} měsíčně – když předtím zrušíte, nezaplatíte nic.</p>
          <Button className="mt-3 w-full justify-center sm:w-auto" variant="primary" size="lg" loading={pending} disabled={!enabled} onClick={() => go("monthly", true)} icon={<Gift className="h-4 w-4" />}>Vyzkoušet 3 dny zdarma</Button>
          <p className="mt-2 text-[11px] text-ink-3">Zkušební doba je jen jednou na osobu. Platební kartu zadáte předem, strhne se až po 3 dnech.</p>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-ink-2">Měsíčně</p>
          <p className="text-3xl font-semibold">{formatMoney(PRICES.monthly, { decimals: "never" })}<span className="text-sm font-normal text-ink-3"> / měsíc</span></p>
          <p className="text-xs text-ink-3">méně než jedna káva</p>
          <Button className="mt-3 w-full justify-center" variant="secondary" loading={pending} disabled={!enabled} onClick={() => go("monthly")} icon={<Crown className="h-4 w-4" />}>Předplatit měsíčně</Button>
        </div>
        <div className="relative rounded-2xl border border-gold/50 bg-gold/10 p-4">
          <span className="absolute -top-2.5 right-3 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-[#1b1407]">nejvýhodnější · −{yearlySave} %</span>
          <p className="text-sm text-ink-2">Ročně</p>
          <p className="text-3xl font-semibold">{formatMoney(PRICES.yearly, { decimals: "never" })}<span className="text-sm font-normal text-ink-3"> / rok</span></p>
          <p className="text-xs text-ink-3">vychází na {perMonth} měsíčně</p>
          <Button className="mt-3 w-full justify-center" variant="primary" loading={pending} disabled={!enabled} onClick={() => go("yearly")} icon={<Crown className="h-4 w-4" />}>Předplatit ročně</Button>
        </div>
      </div>
      {!enabled && <p className="text-sm text-warn">Online platby se právě spouštějí. Do té doby vám Premium může aktivovat správce aplikace.</p>}
      {error && <p className="text-sm text-neg">{error}</p>}
    </div>
  );
}
