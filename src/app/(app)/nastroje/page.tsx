import Link from "next/link";
import { requireContext } from "@/lib/context";
import { PageHeader } from "@/components/ui/Card";
import { AllCalculators } from "@/components/Calculators";

export const metadata = { title: "Kalkulačky" };

const LINKS = [["#hypoteka", "Hypotéka"], ["#sporeni", "Spoření"], ["#dovolit", "Kdy si můžu dovolit"], ["#auto", "Auto"], ["#duchod", "Důchod"], ["#inflace", "Inflace"]];

export default async function ToolsPage() {
  await requireContext();
  return (
    <div className="space-y-4">
      <PageHeader title="Kalkulačky" subtitle="Hypotéka, spoření, auto, důchod a inflace – počítá se jen ve vašem zařízení" />
      <nav className="flex flex-wrap gap-2 text-sm">{LINKS.map(([h, l]) => <a key={h} href={h} className="rounded-full bg-white/[0.06] px-3 py-1 hover:bg-white/10">{l}</a>)}<Link href="/clanky" className="rounded-full bg-white/[0.06] px-3 py-1 hover:bg-white/10">Články o penězích</Link></nav>
      <div className="max-w-3xl"><AllCalculators /></div>
    </div>
  );
}
