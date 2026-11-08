import Link from "next/link";
import { BadgeCheck, Bot, CalendarClock, Lock, Plane, ShoppingBasket, Sparkles, Wallet } from "lucide-react";
import { PublicShell } from "@/components/PublicShell";
import { PRICES } from "@/lib/plans";
import { formatMoney } from "@/lib/money";

export const metadata = {
  title: "HomeOS – rodinné finance jednoduše",
  description: "Česká aplikace na rodinné finance: kolik můžete utratit, rozpočet na jídlo, pravidelné platby, spoření a cestování. Základ zdarma.",
  robots: { index: true, follow: true },
};

const FEATURES = [
  { icon: Wallet, title: "Kolik můžete utratit", text: "Jedno jasné číslo: kolik můžete do konce měsíce utratit, aniž byste ohrozili nájem, jídlo nebo spoření." },
  { icon: ShoppingBasket, title: "Rozpočet na jídlo", text: "Měsíční rozpočet rozpočítaný na týdny a dny, nákupní seznamy s cenami a letáky." },
  { icon: CalendarClock, title: "Pravidelné platby", text: "Nájem, energie, předplatné – nic nezapomenete a víte, co vás čeká." },
  { icon: Sparkles, title: "Spoření a plány", text: "Cíle, kolik odkládat měsíčně a zda si můžete dovolit větší nákup." },
  { icon: Plane, title: "Cestování", text: "Trasa, doprava, rozpočet na místě, hotovost v cizí měně a kdo komu dluží.", premium: true },
  { icon: Bot, title: "AI asistent", text: "Zeptejte se na cokoli – odpoví z vašich skutečných dat, nic si nevymýšlí.", premium: true },
];

export default function Landing() {
  return (
    <PublicShell>
      <section className="py-10 text-center sm:py-16">
        <p className="text-sm text-gold">Pro domácnosti, páry i rodiny</p>
        <h1 className="mx-auto mt-2 max-w-3xl font-[family-name:var(--font-display)] text-4xl font-semibold tracking-tight sm:text-5xl">Víte, kolik si můžete dovolit. <span className="gold-text">Každý den.</span></h1>
        <p className="mx-auto mt-4 max-w-2xl text-ink-2">HomeOS spočítá z vašich skutečných příjmů a výdajů, kolik můžete utratit, aby zbylo na všechno důležité. Česky, srozumitelně a bez reklam.</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          <Link href="/registrace" className="inline-flex h-12 items-center rounded-full bg-gold px-6 font-medium text-[#1b1407]">Začít zdarma</Link>
          <Link href="/prihlaseni" className="inline-flex h-12 items-center rounded-full border border-white/15 px-6 text-ink">Mám účet</Link>
        </div>
        <p className="mt-3 text-xs text-ink-3">Bez platební karty · data můžete kdykoli exportovat nebo smazat</p>
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
          <p className="text-sm text-ink-2">Zdarma</p>
          <p className="text-3xl font-semibold">0 Kč</p>
          <ul className="mt-3 space-y-1 text-sm text-ink-2">
            <li className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />Příjmy, výdaje, rozpočty, platby, spoření</li>
            <li className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />Jídlo, nákupy, plánování, dokumenty</li>
            <li className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />1 domácnost, 2 členové</li>
          </ul>
        </div>
        <div className="glass rounded-3xl border border-gold/40 p-6">
          <p className="text-sm text-gold">Premium</p>
          <p className="text-3xl font-semibold">{formatMoney(PRICES.monthly, { decimals: "never" })}<span className="text-sm font-normal text-ink-3"> / měsíc</span></p>
          <p className="text-xs text-ink-3">nebo {formatMoney(PRICES.yearly, { decimals: "never" })} ročně</p>
          <ul className="mt-3 space-y-1 text-sm text-ink-2">
            <li className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />AI asistent a čtení účtenek a faktur</li>
            <li className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />Cestování, upozornění a měsíční uzávěrka</li>
            <li className="flex gap-2"><BadgeCheck className="h-4 w-4 text-gold" />Neomezeně členů a domácností, celý vzhled</li>
          </ul>
        </div>
      </section>
      <section className="mt-12 flex items-start gap-3 rounded-3xl border border-white/10 p-5 text-sm text-ink-2">
        <Lock className="mt-0.5 h-5 w-5 shrink-0 text-gold" />
        <p>Vaše data vidíte jen vy a lidé, které do domácnosti pozvete. Jsou uložena v Evropě (Londýn), přístup chrání zabezpečení na úrovni databáze. Nic neprodáváme a nesledujeme vás reklamou. <Link href="/soukromi" className="text-gold underline">Jak chráníme vaše údaje</Link></p>
      </section>
    </PublicShell>
  );
}
