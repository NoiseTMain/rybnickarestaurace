import Link from "next/link";
import { PublicShell } from "@/components/PublicShell";
import { AllCalculators } from "@/components/Calculators";

export const metadata = {
  title: "Finanční kalkulačky zdarma – hypotéka, spoření, auto, důchod",
  description: "Hypoteční kalkulačka, spoření a investice, kdy si můžu dovolit, skutečné náklady na auto, renta k důchodu a inflace. Zdarma a bez registrace.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/kalkulacky" },
};

const LINKS = [["#hypoteka", "Hypotéka"], ["#sporeni", "Spoření"], ["#dovolit", "Kdy si můžu dovolit"], ["#auto", "Auto"], ["#duchod", "Důchod"], ["#inflace", "Inflace"]];

export default function CalculatorsPage() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-3xl space-y-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold">Finanční kalkulačky</h1>
          <p className="text-sm text-ink-2">Zdarma, bez registrace. Všechno se počítá jen ve vašem prohlížeči.</p>
          <nav className="mt-3 flex flex-wrap gap-2 text-sm">{LINKS.map(([h, l]) => <a key={h} href={h} className="rounded-full bg-white/[0.06] px-3 py-1 hover:bg-white/10">{l}</a>)}</nav>
        </div>
        <AllCalculators />
        <div className="glass rounded-3xl p-5 text-sm">
          <p className="font-semibold">Chcete to mít spočítané podle vašich skutečných čísel?</p>
          <p className="text-ink-2">HomeOS hlídá příjmy, výdaje, pravidelné platby a spoření a každý den ukáže, kolik můžete bezpečně utratit.</p>
          <div className="mt-3 flex flex-wrap gap-2"><Link href="/registrace" className="rounded-full bg-gold px-4 py-1.5 font-medium text-[#1b1407]">Začít zdarma</Link><Link href="/clanky" className="rounded-full px-3 py-1.5 text-ink-2 hover:text-ink">Články o penězích →</Link></div>
        </div>
      </div>
    </PublicShell>
  );
}
