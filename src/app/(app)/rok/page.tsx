import Link from "next/link";
import { requireContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import { formatDate, monthName, todayISO } from "@/lib/dates";
import { formatMoney } from "@/lib/money";
import { yearReview } from "@/lib/finance/year-review";
import { Card, PageHeader } from "@/components/ui/Card";
import { ShareYear } from "@/components/ShareYear";

export const metadata = { title: "Můj rok v číslech" };

const kc = (c: number) => formatMoney(c, { decimals: "never" });
const pct = (x: number) => `${Math.round(x * 100)} %`;

export default async function YearPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const ctx = await requireContext();
  const today = todayISO();
  const sp = await searchParams;
  const year = /^\d{4}$/.test(sp.rok ?? "") ? sp.rok! : today.slice(5, 7) === "01" ? String(Number(today.slice(0, 4)) - 1) : today.slice(0, 4);
  const data = await loadData(ctx);
  const r = yearReview(year, data.transactions, data.categories, data.travel.trips, today);
  const years = [...new Set(data.transactions.map((t) => t.date.slice(0, 4)))].sort().reverse();
  const tiles: { e: string; big: string; small: string; tone?: string }[] = [
    { e: "💰", big: kc(r.income), small: "příjmy celkem" },
    { e: "🛒", big: kc(r.expense), small: "výdaje celkem" },
    { e: r.saved >= 0 ? "🐷" : "⚠️", big: kc(r.saved), small: r.income ? `zůstalo vám ${pct(r.savingsRate)} příjmů` : "rozdíl příjmů a výdajů", tone: r.saved >= 0 ? "text-pos" : "text-neg" },
    { e: "📅", big: `${r.plusMonths}`, small: `měsíců v plusu z ${r.months.length}` },
    { e: "🧘", big: `${r.noSpend}`, small: "dní bez utrácení" },
    { e: "🔥", big: `${r.bestStreak}`, small: "nejdelší série zápisů (dní)" },
    { e: "✍️", big: `${r.count}`, small: "zapsaných pohybů" },
    { e: "🧳", big: `${r.trips.length}`, small: r.trips.length ? r.trips.slice(0, 3).join(", ") : "cest – letos to napravte!" },
  ];
  return (
    <div className="space-y-4">
      <PageHeader title={`Můj rok ${year} v číslech`} subtitle="Shrnutí z vašich skutečných dat" actions={<ShareYear year={year} savingsRate={r.savingsRate} plusMonths={r.plusMonths} noSpend={r.noSpend} streak={r.bestStreak} topCategory={r.topCategories[0]?.name ?? null} />} />
      {years.length > 1 && <nav className="flex flex-wrap gap-2 text-sm">{years.map((y) => <Link key={y} href={`/rok?rok=${y}`} className={`rounded-full px-3 py-1 ${y === year ? "bg-gold text-[#1b1407]" : "bg-white/[0.06]"}`}>{y}</Link>)}</nav>}
      {r.count === 0 ? <Card><p className="text-sm text-ink-3">Za rok {year} zatím nemáte žádné záznamy.</p></Card> : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="year-tiles">
            {tiles.map((t) => (
              <Card key={t.small} className="!p-4">
                <p className="text-2xl" aria-hidden>{t.e}</p>
                <p className={`num mt-1 text-2xl font-semibold ${t.tone ?? ""}`}>{t.big}</p>
                <p className="text-xs text-ink-3">{t.small}</p>
              </Card>
            ))}
          </div>
          <div className="grid gap-4 lg:grid-cols-3">
            <Card title="Kam šly peníze">
              <ol className="space-y-2 text-sm">{r.topCategories.map((c, i) => <li key={c.name} className="flex justify-between gap-2"><span>{["🥇", "🥈", "🥉"][i]} {c.name}</span><span className="num">{kc(c.amount)} <span className="text-ink-3">({pct(c.share)})</span></span></li>)}</ol>
            </Card>
            <Card title="Rekordy">
              <div className="space-y-2 text-sm">
                {r.biggest && <p>Největší výdaj: <b>{r.biggest.description}</b> – {kc(r.biggest.amount)} <span className="text-ink-3">({formatDate(r.biggest.date)})</span></p>}
                {r.best && r.best.net > 0 && <p>Nejlepší měsíc: <b>{monthName(`${r.best.month}-01`)}</b> – zůstalo {kc(r.best.net)}</p>}
                {r.favorite && <p>Nejčastěji u: <b>{r.favorite.name}</b> – {r.favorite.count}× za {kc(r.favorite.amount)}</p>}
              </div>
            </Card>
            <Card title="Do dalšího roku">
              <ul className="space-y-1.5 text-sm text-ink-2">
                {r.savingsRate < 0.1 && <li>🎯 Zkuste odkládat aspoň 10 % příjmů – založte cíl ve Spoření.</li>}
                {r.topCategories[0] && <li>✂️ Výzva: o 15 % méně za {r.topCategories[0].name} – <Link href="/vyzvy" className="text-gold underline">přijmout</Link>.</li>}
                {r.noSpend < 60 && <li>🧘 Dny bez utrácení šetří nejvíc – zkuste 8 měsíčně.</li>}
                <li>🔁 Projděte předplatná v <Link href="/platby" className="text-gold underline">Pravidelných platbách</Link>.</li>
              </ul>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
