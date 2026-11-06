import { sum, type Cents } from "@/lib/money";
import { addMonths, monthKey, startOfMonth, endOfMonth, type ISODate } from "@/lib/dates";
import type { Category, Transaction } from "@/lib/db/types";

export function txInRange(txs: readonly Transaction[], from: ISODate, to: ISODate) {
  return txs.filter((t) => t.status === "posted" && t.date >= from && t.date <= to);
}

export interface PeriodStats {
  income: Cents;
  expense: Cents;
  net: Cents;
  byCategory: { categoryId: string | null; amount: Cents }[];
}

/** Příjmy a výdaje v období. Převody mezi účty nejsou příjem ani výdaj. */
export function periodStats(txs: readonly Transaction[], from: ISODate, to: ISODate): PeriodStats {
  const list = txInRange(txs, from, to);
  const income = sum(list.filter((t) => t.type === "income"), (t) => t.amount);
  const expense = sum(list.filter((t) => t.type === "expense"), (t) => t.amount);
  const map = new Map<string | null, Cents>();
  for (const t of list) if (t.type === "expense") map.set(t.category_id, (map.get(t.category_id) ?? 0) + t.amount);
  return {
    income,
    expense,
    net: income - expense,
    byCategory: [...map.entries()].map(([categoryId, amount]) => ({ categoryId, amount })).sort((a, b) => b.amount - a.amount),
  };
}

export function expensesIn(txs: readonly Transaction[], from: ISODate, to: ISODate, filter: (t: Transaction) => boolean): Cents {
  return sum(txInRange(txs, from, to).filter((t) => t.type === "expense" && filter(t)), (t) => t.amount);
}

export function foodCategoryIds(categories: readonly Category[]): Set<string> {
  return new Set(categories.filter((c) => c.is_food).map((c) => c.id));
}

/** Měsíční řada příjmů a výdajů za posledních N měsíců (včetně aktuálního). */
export function monthlySeries(txs: readonly Transaction[], today: ISODate, months: number) {
  const out: { month: string; start: ISODate; income: Cents; expense: Cents }[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const start = addMonths(startOfMonth(today), -i);
    const s = periodStats(txs, start, endOfMonth(start));
    out.push({ month: monthKey(start), start, income: s.income, expense: s.expense });
  }
  return out;
}
