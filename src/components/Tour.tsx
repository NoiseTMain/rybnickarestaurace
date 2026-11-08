"use client";
import { ArrowRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { setTourSeen } from "@/lib/actions/prefs";
import { useT } from "@/components/I18n";

const STEPS = {
  cs: [
    { e: "👋", t: "Vítejte v HomeOS", d: "Za minutu vám ukážeme, jak z aplikace dostat maximum. Kdykoli můžete průvodce přeskočit a spustit znovu v Nastavení." },
    { e: "🟡", t: "Přehled: kolik můžete utratit", d: "Nejdůležitější číslo je „Skutečně volné“ – kolik můžete do konce měsíce utratit, aby vyšly všechny platby, spoření a rezerva.", href: "/" },
    { e: "✍️", t: "Zapisujte výdaje", d: "V Příjmech a výdajích nebo jen napište asistentovi „oběd 180 Kč“. Výpis z banky jde nahrát jako CSV.", href: "/transakce" },
    { e: "📅", t: "Pravidelné platby", d: "Nájem, energie, předplatné – zadejte je jednou a HomeOS s nimi počítá dopředu. Najde i předplatná, o kterých nevíte.", href: "/platby" },
    { e: "🎯", t: "Spoření a cíle", d: "Založte cíl (rezerva, dovolená, auto) – plánovač spočítá, kolik měsíčně odkládat.", href: "/sporeni" },
    { e: "🏦", t: "Majetek, dluhy a termíny", d: "Čisté jmění, nejrychlejší plán splacení dluhů a hlídání STK, záruk či pojištění.", href: "/majetek" },
    { e: "🤖", t: "Zeptejte se asistenta", d: "„Můžeme si dovolit pračku za 9 990?“ – odpoví z vašich skutečných čísel. Funguje i hlasem.", href: "/asistent" },
  ],
  sk: [
    { e: "👋", t: "Vitajte v HomeOS", d: "Za minútu vám ukážeme, ako z aplikácie dostať maximum. Sprievodcu môžete kedykoľvek preskočiť a spustiť znova v Nastaveniach." },
    { e: "🟡", t: "Prehľad: koľko môžete minúť", d: "Najdôležitejšie číslo je „Skutočne voľné“ – koľko môžete do konca mesiaca minúť, aby vyšli všetky platby, sporenie a rezerva.", href: "/" },
    { e: "✍️", t: "Zapisujte výdavky", d: "V Príjmoch a výdavkoch alebo napíšte asistentovi „obed 8 €“. Výpis z banky nahráte ako CSV.", href: "/transakce" },
    { e: "📅", t: "Pravidelné platby", d: "Nájom, energie, predplatné – zadajte ich raz a HomeOS s nimi počíta dopredu.", href: "/platby" },
    { e: "🎯", t: "Sporenie a ciele", d: "Založte cieľ – plánovač spočíta, koľko mesačne odkladať.", href: "/sporeni" },
    { e: "🏦", t: "Majetok, dlhy a termíny", d: "Čisté imanie, plán splatenia dlhov a stráženie STK, záruk či poistenia.", href: "/majetek" },
    { e: "🤖", t: "Opýtajte sa asistenta", d: "Odpovie z vašich skutočných čísel. Funguje aj hlasom.", href: "/asistent" },
  ],
  en: [
    { e: "👋", t: "Welcome to HomeOS", d: "A one-minute tour of the essentials. You can skip it and restart it any time in Settings." },
    { e: "🟡", t: "Overview: what you can spend", d: "The key number is “Truly free” – what you can spend until month end while covering all bills, savings and your buffer.", href: "/" },
    { e: "✍️", t: "Record expenses", d: "In Income & expenses, or just tell the assistant “lunch 180”. Bank statements can be imported as CSV.", href: "/transakce" },
    { e: "📅", t: "Recurring payments", d: "Rent, utilities, subscriptions – enter them once and HomeOS plans ahead.", href: "/platby" },
    { e: "🎯", t: "Savings goals", d: "Create a goal and the planner tells you how much to set aside monthly.", href: "/sporeni" },
    { e: "🏦", t: "Wealth, debts & deadlines", d: "Net worth, the fastest debt payoff plan and reminders for MOT, warranties and insurance.", href: "/majetek" },
    { e: "🤖", t: "Ask the assistant", d: "It answers from your real numbers. Works with voice, too.", href: "/asistent" },
  ],
} as const;

/** Krátký průvodce po prvním přihlášení. */
export function Tour() {
  const { locale } = useT();
  const steps = STEPS[locale] ?? STEPS.cs;
  const [i, setI] = useState(0);
  const [open, setOpen] = useState(true);
  const router = useRouter();
  if (!open) return null;
  const s = steps[i];
  const last = i === steps.length - 1;
  const finish = () => { setOpen(false); void setTourSeen(true); };
  const labels = locale === "en" ? { skip: "Skip", next: "Next", done: "Get started", show: "Show me" } : locale === "sk" ? { skip: "Preskočiť", next: "Ďalej", done: "Začať", show: "Ukázať" } : { skip: "Přeskočit", next: "Další", done: "Pustit se do toho", show: "Ukázat" };
  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tour-title" className="fixed inset-0 z-[55] flex items-end justify-center bg-black/60 p-3 backdrop-blur-[2px] sm:items-center">
      <div className="glass-strong w-full max-w-md rounded-[28px] p-6">
        <div className="flex items-start justify-between gap-3">
          <p className="text-4xl" aria-hidden>{s.e}</p>
          <button onClick={finish} className="rounded-full p-1 text-ink-3 hover:text-ink" aria-label={labels.skip}><X className="h-5 w-5" /></button>
        </div>
        <h2 id="tour-title" className="mt-2 font-[family-name:var(--font-display)] text-xl font-semibold">{s.t}</h2>
        <p className="mt-1 text-sm text-ink-2">{s.d}</p>
        <div className="mt-4 flex items-center gap-1.5" aria-hidden>{steps.map((_, j) => <span key={j} className={`h-1.5 rounded-full transition-all ${j === i ? "w-6 bg-gold" : "w-1.5 bg-white/20"}`} />)}</div>
        <div className="mt-5 flex items-center justify-between gap-2">
          <button onClick={finish} className="text-sm text-ink-3 hover:text-ink">{labels.skip}</button>
          <div className="flex gap-2">
            {"href" in s && s.href !== "/" && <button onClick={() => { router.push(s.href); }} className="rounded-full border border-white/10 px-4 py-2 text-sm">{labels.show}</button>}
            <button onClick={() => (last ? finish() : setI(i + 1))} className="flex items-center gap-1 rounded-full bg-gold px-4 py-2 text-sm font-medium text-[#1b1407]">{last ? labels.done : labels.next}<ArrowRight className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RestartTourButton() {
  const router = useRouter();
  return <button onClick={async () => { await setTourSeen(false); router.push("/"); }} className="text-sm text-gold underline">Spustit průvodce znovu</button>;
}
