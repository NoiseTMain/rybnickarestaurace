import Link from "next/link";
import { BadgeCheck, Bot, CalendarClock, Lock, Plane, ShoppingBasket, Sparkles, Wallet } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";
import { getT } from "@/lib/i18n/server";

export const metadata = {
  title: "HomeOS – rodinné finance jednoduše",
  description: "Česká aplikace na rodinné finance: kolik můžete utratit, rozpočet na jídlo, pravidelné platby, spoření, cestování a recepty. Základ zdarma.",
  robots: { index: true, follow: true },
};

export default async function Landing() {
  const { t } = await getT();
  const FEATURES = [
    { icon: Wallet, title: t("land.f1t"), text: t("land.f1") },
    { icon: ShoppingBasket, title: t("land.f2t"), text: t("land.f2") },
    { icon: CalendarClock, title: t("land.f3t"), text: t("land.f3") },
    { icon: Sparkles, title: t("land.f4t"), text: t("land.f4") },
    { icon: Plane, title: t("land.f5t"), text: t("land.f5"), premium: true },
    { icon: Bot, title: t("land.f6t"), text: t("land.f6"), premium: true },
  ];
  return (
    <PublicShell>
      <section className="py-10 text-center sm:py-16">
        <p className="text-sm text-gold">{t("land.for")}</p>
        <h1 className="mx-auto mt-2 max-w-3xl font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">{t("land.h1a")} <span className="gold-text">{t("land.h1b")}</span></h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink-2">{t("land.sub")}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/registrace" className="inline-flex h-12 items-center rounded-full bg-gold px-6 font-medium text-[#1b1407]">{t("land.start")}</Link>
          <Link href="/prihlaseni" className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-ink">{t("land.haveAccount")}</Link>
        </div>
        <p className="mt-3 text-xs text-ink-3">{t("land.noCard")}</p>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass rounded-3xl p-5">
            <f.icon className="h-6 w-6 text-gold" />
            <p className="mt-3 font-semibold">{f.title}{f.premium && <span className="ml-2 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] text-gold-bright">Premium</span>}</p>
            <p className="mt-1 text-sm text-ink-2">{f.text}</p>
          </div>
        ))}
      </section>
      <section className="mt-12 grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-3xl p-6">
          <p className="text-sm text-ink-2">{t("land.free")}</p>
          <p className="text-3xl font-semibold">0 Kč</p>
          <ul className="mt-3 space-y-1 text-sm text-ink-2">
            {[t("land.freeL1"), t("land.freeL2"), t("land.freeL3")].map((x) => <li key={x} className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />{x}</li>)}
          </ul>
        </div>
        <div className="glass rounded-3xl border border-gold/40 p-6">
          <p className="text-sm text-gold">Premium</p>
          <p className="text-3xl font-semibold">{formatMoney(PRICES.monthly, { decimals: "never" })}<span className="text-sm font-normal text-ink-3"> {t("land.perMonth")}</span></p>
          <p className="text-xs text-ink-3">{t("land.orYearly", { x: formatMoney(PRICES.yearly, { decimals: "never" }) })}</p>
          <ul className="mt-3 space-y-1 text-sm text-ink-2">
            {[t("land.premL1"), t("land.premL2"), t("land.premL3")].map((x) => <li key={x} className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />{x}</li>)}
          </ul>
        </div>
      </section>
      <section className="mt-12 flex items-start gap-3 rounded-3xl border border-white/10 p-5 text-sm text-ink-2">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <p>{t("land.privacy")} <Link href="/soukromi" className="text-gold underline">{t("land.privacyLink")}</Link></p>
      </section>
    </PublicShell>
  );
}
