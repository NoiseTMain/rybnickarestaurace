import { sum, type Cents } from "@/lib/money";
import { addMonths, endOfMonth, monthName, startOfMonth, type ISODate } from "@/lib/dates";
import type { FinanceData } from "./snapshot";
import { posted } from "./balances";
import { expensesIn, foodCategoryIds, periodStats } from "./period";
import { resolveBudget } from "./budgets";

/** Měsíční uzávěrka: co se v měsíci povedlo, kam šly peníze, srovnání s předchozím měsícem. */
export interface MonthlyClosing {
  start: ISODate;
  label: string;
  income: Cents;
  expense: Cents;
  net: Cents;
  prev: { income: Cents; expense: Cents; net: Cents } | null;
  categories: { name: string; amount: Cents; prev: Cents; diff: Cents }[];
  food: { budget: Cents; spent: Cents } | null;
  saved: Cents;
  biggest: { description: string; amount: Cents; date: string } | null;
  txCount: number;
  verdict: { tone: "positive" | "neutral" | "warning"; text: string };
  highlights: string[];
}

const kc = (c: number) => `${Math.round(c / 100).toLocaleString("cs-CZ")} Kč`;

export function monthlyClosing(d: FinanceData, month: ISODate): MonthlyClosing {
  const start = startOfMonth(month);
  const end = endOfMonth(start);
  const pStart = addMonths(start, -1);
  const txs = posted(d.transactions);
  const cur = periodStats(txs, start, end);
  const hasPrev = txs.some((t) => t.date >= pStart && t.date < start);
  const prev = hasPrev ? periodStats(txs, pStart, endOfMonth(pStart)) : null;
  const catName = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? "Bez kategorie";
  const prevBy = new Map((prev?.byCategory ?? []).map((c) => [c.categoryId, c.amount]));
  const categories = cur.byCategory.slice(0, 6).map((c) => ({ name: catName(c.categoryId), amount: c.amount, prev: prevBy.get(c.categoryId) ?? 0, diff: c.amount - (prevBy.get(c.categoryId) ?? 0) }));
  const foodIds = foodCategoryIds(d.categories);
  const fb = resolveBudget(d.budgets, "food", start);
  const food = fb ? { budget: fb.amount, spent: expensesIn(txs, start, end, (t) => t.category_id != null && foodIds.has(t.category_id)) } : null;
  const saved = sum(d.contributions.filter((c) => c.date >= start && c.date <= end), (c) => c.amount);
  const exp = txs.filter((t) => t.type === "expense" && t.date >= start && t.date <= end && !t.recurring_payment_id);
  const big = exp.sort((a, b) => b.amount - a.amount)[0];
  const highlights: string[] = [];
  if (prev) {
    const diff = cur.expense - prev.expense;
    highlights.push(diff <= 0 ? `Utratili jste o ${kc(-diff)} méně než v předchozím měsíci.` : `Utratili jste o ${kc(diff)} více než v předchozím měsíci.`);
  }
  if (food) highlights.push(food.spent <= food.budget ? `Rozpočet na jídlo jste dodrželi (${kc(food.spent)} z ${kc(food.budget)}).` : `Rozpočet na jídlo jste překročili o ${kc(food.spent - food.budget)}.`);
  const rise = categories.filter((c) => c.prev > 0 && c.diff > 50_000).sort((a, b) => b.diff - a.diff)[0];
  if (rise) highlights.push(`Nejvíc narostla kategorie ${rise.name} (+${kc(rise.diff)}).`);
  if (saved > 0) highlights.push(`Na cíle jste odložili ${kc(saved)}.`);
  const verdict = cur.income === 0 && cur.expense === 0
    ? { tone: "neutral" as const, text: "V tomto měsíci nejsou žádné záznamy." }
    : cur.net >= 0
      ? { tone: "positive" as const, text: `Měsíc skončil v plusu ${kc(cur.net)}. Dobrá práce!` }
      : { tone: "warning" as const, text: `Výdaje převýšily příjmy o ${kc(-cur.net)}.` };
  return {
    start, label: monthName(start), income: cur.income, expense: cur.expense, net: cur.net,
    prev: prev ? { income: prev.income, expense: prev.expense, net: prev.net } : null,
    categories, food, saved, biggest: big ? { description: big.description, amount: big.amount, date: big.date } : null,
    txCount: txs.filter((t) => t.date >= start && t.date <= end).length, verdict, highlights,
  };
}
