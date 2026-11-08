import type { Cents } from "@/lib/money";

export interface DebtInput { id: string; name: string; balance: Cents; rate: number; min_payment: Cents }
export type DebtStrategy = "avalanche" | "snowball";
export interface DebtPlanResult {
  months: number;
  totalInterest: Cents;
  totalPaid: Cents;
  /** Měsíc (1 = příští), kdy je dluh splacen. */
  payoff: { id: string; name: string; month: number; interest: Cents }[];
  /** Zbývající jistina po měsících (pro graf). */
  timeline: Cents[];
  /** Splátky nestačí ani na úroky. */
  impossible: boolean;
}

/**
 * Simulace splácení: každý měsíc se připíše úrok (sazba p.a. / 12), zaplatí se minimální
 * splátky a všechno navíc (`extra`) + uvolněné splátky splacených dluhů jde na prioritní dluh.
 * Lavina = nejvyšší úrok první (nejlevnější), sněhová koule = nejmenší zůstatek první (motivace).
 */
export function debtPlan(debts: readonly DebtInput[], extra: Cents, strategy: DebtStrategy, maxMonths = 600): DebtPlanResult {
  const list = debts.filter((d) => d.balance > 0).map((d) => ({ ...d, left: d.balance, interest: 0, done: 0 }));
  const budget = list.reduce((a, d) => a + d.min_payment, 0) + Math.max(0, extra);
  const order = () => [...list].filter((d) => d.left > 0).sort((a, b) => strategy === "avalanche" ? b.rate - a.rate || a.left - b.left : a.left - b.left || b.rate - a.rate);
  const timeline: Cents[] = [];
  let month = 0, totalInterest = 0, totalPaid = 0;
  while (list.some((d) => d.left > 0) && month < maxMonths) {
    month++;
    for (const d of list) if (d.left > 0) { const i = Math.round((d.left * d.rate) / 100 / 12); d.left += i; d.interest += i; totalInterest += i; }
    let money = budget;
    for (const d of list) if (d.left > 0) { const p = Math.min(d.left, d.min_payment, money); d.left -= p; money -= p; totalPaid += p; }
    for (const d of order()) { if (money <= 0) break; const p = Math.min(d.left, money); d.left -= p; money -= p; totalPaid += p; }
    for (const d of list) if (d.left <= 0 && !d.done) d.done = month;
    timeline.push(list.reduce((a, d) => a + Math.max(0, d.left), 0));
    if (month === 24 && timeline[23] >= timeline[0] && timeline[0] > 0) return { months: month, totalInterest, totalPaid, payoff: [], timeline, impossible: true };
  }
  const impossible = list.some((d) => d.left > 0);
  return { months: month, totalInterest, totalPaid, payoff: list.map((d) => ({ id: d.id, name: d.name, month: d.done, interest: d.interest })).sort((a, b) => a.month - b.month), timeline, impossible };
}
