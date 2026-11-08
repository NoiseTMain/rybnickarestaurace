"use client";
import { useState, useTransition } from "react";
import { Crown } from "lucide-react";
import { startCheckout } from "@/lib/actions/billing";
import { PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { Button } from "@/components/ui/Button";

export function CheckoutButtons({ enabled }: { enabled: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const go = (plan: "monthly" | "yearly") => start(async () => {
    setError(null);
    const r = await startCheckout(plan);
    if (r.url) window.location.href = r.url;
    else setError(r.error ?? "Nepovedlo se");
  });
  const yearlySave = Math.round((1 - PRICES.yearly / (PRICES.monthly * 12)) * 100);
  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <p className="text-sm text-ink-2">Měsíčně</p>
          <p className="text-3xl font-semibold">{formatMoney(PRICES.monthly, { decimals: "never" })}<span className="text-sm font-normal text-ink-3"> / měsíc</span></p>
          <Button className="mt-3 w-full justify-center" variant="secondary" loading={pending} disabled={!enabled} onClick={() => go("monthly")} icon={<Crown className="h-4 w-4" />}>Předplatit měsíčně</Button>
        </div>
        <div className="relative rounded-2xl border border-gold/50 bg-gold/10 p-4">
          <span className="absolute -top-2.5 right-3 rounded-full bg-gold px-2 py-0.5 text-[11px] font-semibold text-[#1b1407]">ušetříte {yearlySave} %</span>
          <p className="text-sm text-ink-2">Ročně</p>
          <p className="text-3xl font-semibold">{formatMoney(PRICES.yearly, { decimals: "never" })}<span className="text-sm font-normal text-ink-3"> / rok</span></p>
          <Button className="mt-3 w-full justify-center" variant="primary" loading={pending} disabled={!enabled} onClick={() => go("yearly")} icon={<Crown className="h-4 w-4" />}>Předplatit ročně</Button>
        </div>
      </div>
      {!enabled && <p className="mt-3 text-sm text-warn">Online platby zatím nejsou spuštěné. Premium vám zatím může aktivovat správce aplikace.</p>}
      {error && <p className="mt-3 text-sm text-neg">{error}</p>}
    </div>
  );
}
