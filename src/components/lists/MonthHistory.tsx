import { History } from "lucide-react";
import { addMonths, endOfMonth, monthName, startOfMonth, type ISODate } from "@/lib/dates";
import { formatMoney, percent, sub } from "@/lib/money";
import { periodStats } from "@/lib/finance/period";
import type { Category, Transaction } from "@/lib/db/types";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";

/** Příjmy a výdaje za aktuální a dva předchozí měsíce vedle sebe. */
export function MonthHistory({ transactions, categories, today }: { transactions: Transaction[]; categories: Category[]; today: ISODate }) {
  const months = [0, -1, -2].map((i) => {
    const start = addMonths(startOfMonth(today), i);
    const end = i === 0 ? today : endOfMonth(start);
    const s = periodStats(transactions, start, end);
    const count = transactions.filter((t) => t.status === "posted" && t.date >= start && t.date <= end && t.type !== "transfer").length;
    const cancelled = transactions.filter((t) => t.status === "cancelled" && t.date >= start && t.date <= end).length;
    return { i, start, end, s, count, cancelled };
  });
  const name = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Bez kategorie";
  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        {months.map(({ i, start, s, count, cancelled }, idx) => {
          const prev = months[idx + 1]?.s;
          const diff = prev ? sub(s.expense, prev.expense) : null;
          return (
            <Card key={start} title={monthName(start)} subtitle={i === 0 ? "Tento měsíc (do dneška)" : i === -1 ? "Minulý měsíc" : "Předminulý měsíc"} variant={i === 0 ? "light" : "glass"}>
              <div className="grid grid-cols-3 gap-2">
                <div><p className="text-[11px] uppercase tracking-wider text-ink-3">Příjmy</p><Money value={s.income} decimals="never" className="font-semibold text-pos" /></div>
                <div><p className="text-[11px] uppercase tracking-wider text-ink-3">Výdaje</p><Money value={s.expense} decimals="never" className="font-semibold" /></div>
                <div><p className="text-[11px] uppercase tracking-wider text-ink-3">Bilance</p><Money value={s.net} decimals="never" colored className="font-semibold" /></div>
              </div>
              {diff != null && prev && prev.expense > 0 && (
                <p className="mt-2 text-xs text-ink-2">Výdaje oproti předchozímu měsíci: <span className={diff > 0 ? "text-neg" : "text-pos"}>{diff > 0 ? "+" : "−"}{formatMoney(Math.abs(diff), { decimals: "never" })} ({diff > 0 ? "+" : ""}{Math.round(percent(diff, prev.expense))} %)</span></p>
              )}
              <p className="mt-1 text-xs text-ink-3">{count} pohybů{cancelled ? ` · ${cancelled} stornováno` : ""}</p>
              <ul className="mt-3 space-y-1.5">
                {s.byCategory.slice(0, 6).map((c) => (
                  <li key={c.categoryId ?? "none"} className="flex items-center gap-2 text-sm">
                    <span className="min-w-0 flex-1 truncate text-ink-2">{name(c.categoryId)}</span>
                    <span className="text-xs text-ink-3">{Math.round(percent(c.amount, s.expense || 1))} %</span>
                    <Money value={c.amount} decimals="never" className="w-24 text-right" />
                  </li>
                ))}
                {!s.byCategory.length && <li className="text-sm text-ink-3">Žádné výdaje.</li>}
              </ul>
            </Card>
          );
        })}
      </div>
      <div className="flex items-start gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-3 text-sm text-ink-2">
        <History className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
        <p>Zatím vidíte aktuální a 2 předchozí měsíce. <Badge>připravujeme</Badge> V budoucnu bude možné zobrazit až <b>6 měsíců zpětně</b> s rozsáhlejšími informacemi – podrobnou historií změn (logy), kdo co zadal nebo upravil, a vývojem jednotlivých kategorií.</p>
      </div>
    </div>
  );
}
