import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import { getPremium } from "@/lib/premium";
import { monthlyClosing } from "@/lib/finance/closing";
import { addMonths, startOfMonth, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Progress } from "@/components/ui/Progress";
import { PremiumWall } from "@/components/premium/PremiumWall";

export const metadata = { title: "Měsíční uzávěrka" };
const kc = (c: number) => formatMoney(c, { decimals: "never" });

export default async function ClosingPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  if (!(await getPremium(ctx)).household) return <PremiumWall title="Měsíční uzávěrka je součástí Premium" highlight="notify">Na začátku každého měsíce přehled, jak jste dopadli: kam šly peníze, co narostlo, jestli jste dodrželi rozpočet a kolik jste odložili.</PremiumWall>;
  const data = await loadData(ctx);
  const thisMonth = startOfMonth(todayISO());
  const month = /^\d{4}-\d{2}$/.test(sp.mesic ?? "") ? `${sp.mesic}-01` : addMonths(thisMonth, -1);
  const c = monthlyClosing(data, month);
  const link = (m: string) => `/uzaverka?mesic=${m.slice(0, 7)}`;
  return (
    <div className="space-y-4">
      <PageHeader title={`Uzávěrka: ${c.label}`} subtitle="Jak jste v měsíci dopadli" actions={
        <div className="flex gap-1">
          <Link href={link(addMonths(c.start, -1))} className="rounded-full border border-white/10 p-2" aria-label="Předchozí měsíc"><ChevronLeft className="h-4 w-4" /></Link>
          {c.start < thisMonth && <Link href={link(addMonths(c.start, 1))} className="rounded-full border border-white/10 p-2" aria-label="Další měsíc"><ChevronRight className="h-4 w-4" /></Link>}
        </div>
      } />
      <Card variant="light" className="!p-5">
        <p className={`text-xl font-semibold ${c.verdict.tone === "positive" ? "text-pos" : c.verdict.tone === "warning" ? "text-warn" : ""}`}>{c.verdict.text}</p>
        {c.highlights.length > 0 && <ul className="mt-2 space-y-1 text-sm text-ink-2">{c.highlights.map((h) => <li key={h}>• {h}</li>)}</ul>}
      </Card>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Příjmy</p><Money value={c.income} decimals="never" className="text-xl font-semibold text-pos" />{c.prev && <p className="text-xs text-ink-3">předtím {kc(c.prev.income)}</p>}</Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Výdaje</p><Money value={c.expense} decimals="never" className="text-xl font-semibold" />{c.prev && <p className="text-xs text-ink-3">předtím {kc(c.prev.expense)}</p>}</Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Bilance</p><Money value={c.net} sign colored decimals="never" className="text-xl font-semibold" /></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Odloženo na cíle</p><Money value={c.saved} decimals="never" className="gold-text text-xl font-semibold" /></Card>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Kam šly peníze" subtitle="Srovnání s předchozím měsícem">
          {c.categories.length ? (
            <ul className="space-y-2">
              {c.categories.map((k) => (
                <li key={k.name} className="text-sm">
                  <div className="flex justify-between"><span>{k.name}</span><span className="num">{kc(k.amount)} {k.prev > 0 && <span className={`text-xs ${k.diff > 0 ? "text-neg" : "text-pos"}`}>{k.diff > 0 ? "+" : "−"}{kc(Math.abs(k.diff))}</span>}</span></div>
                  <Progress className="mt-1" value={(k.amount / c.categories[0].amount) * 100} label={k.name} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-3">Žádné výdaje.</p>}
        </Card>
        <Card title="Další">
          <div className="space-y-2 text-sm">
            {c.food && <p>Jídlo: <b>{kc(c.food.spent)}</b> z rozpočtu {kc(c.food.budget)}</p>}
            {c.biggest && <p>Největší jednorázový výdaj: <b>{c.biggest.description}</b> {kc(c.biggest.amount)}</p>}
            <p className="text-ink-3">Záznamů v měsíci: {c.txCount}</p>
            <p><Link href={`/transakce?mesic=${c.start.slice(0, 7)}`} className="text-gold underline">Všechny pohyby měsíce</Link></p>
          </div>
        </Card>
      </div>
    </div>
  );
}
