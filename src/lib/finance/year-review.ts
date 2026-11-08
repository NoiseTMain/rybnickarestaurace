import type { Category, Transaction, Trip } from "@/lib/db/types";
import { addDays } from "@/lib/dates";
import { merchantKey } from "./subscriptions";
import { recordingStreak } from "./badges";

/** „Můj rok v číslech“ – souhrn roku z vlastních dat. */
export function yearReview(year: string, txs: readonly Transaction[], categories: readonly Category[], trips: readonly Trip[], today: string) {
  const inYear = txs.filter((t) => t.status === "posted" && t.date.startsWith(year));
  const exp = inYear.filter((t) => t.type === "expense"), inc = inYear.filter((t) => t.type === "income");
  const income = inc.reduce((a, t) => a + t.amount, 0), expense = exp.reduce((a, t) => a + t.amount, 0);
  const byCat = new Map<string | null, number>();
  for (const t of exp) byCat.set(t.category_id, (byCat.get(t.category_id) ?? 0) + t.amount);
  const topCategories = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    .map(([id, amount]) => ({ name: categories.find((c) => c.id === id)?.name ?? "Bez kategorie", amount, share: expense ? amount / expense : 0 }));
  const biggest = [...exp].sort((a, b) => b.amount - a.amount)[0] ?? null;
  const merchants = new Map<string, { name: string; count: number; amount: number }>();
  for (const t of exp) { const k = merchantKey(t.description); if (!k) continue; const m = merchants.get(k) ?? { name: t.description, count: 0, amount: 0 }; m.count++; m.amount += t.amount; merchants.set(k, m); }
  const favorite = [...merchants.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    const mi = inc.filter((t) => t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0), me = exp.filter((t) => t.date.startsWith(m)).reduce((a, t) => a + t.amount, 0);
    return { month: m, income: mi, expense: me, net: mi - me };
  }).filter((m) => m.income || m.expense);
  const best = [...months].sort((a, b) => b.net - a.net)[0] ?? null;
  const plusMonths = months.filter((m) => m.net > 0).length;
  const spendDays = new Set(exp.filter((t) => !t.recurring_payment_id).map((t) => t.date));
  const last = today.startsWith(year) ? today : `${year}-12-31`;
  const first = inYear.length ? inYear.reduce((m, t) => (t.date < m ? t.date : m), last) : last;
  let noSpend = 0;
  for (let d = first; d <= last; d = addDays(d, 1)) if (!spendDays.has(d)) noSpend++;
  const streak = recordingStreak(txs.filter((t) => t.created_at.startsWith(year)), last);
  const tripList = trips.filter((t) => (t.start_date ?? "").startsWith(year) || (t.end_date ?? "").startsWith(year));
  return {
    year, income, expense, saved: income - expense, savingsRate: income ? (income - expense) / income : 0,
    count: inYear.length, topCategories, biggest: biggest ? { description: biggest.description, amount: biggest.amount, date: biggest.date } : null,
    favorite, months, best, plusMonths, noSpend, bestStreak: streak.best, trips: tripList.map((t) => t.name),
  };
}
