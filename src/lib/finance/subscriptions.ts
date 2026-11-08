import type { RecurringPayment, Transaction } from "@/lib/db/types";
import { diffDays } from "@/lib/dates";
import type { Cents } from "@/lib/money";

const STOP = /\b(platba|kartou|karta|nákup|nakup|card|payment|pos|cz|s\.?r\.?o\.?|a\.?s\.?|inc|ltd|www|com)\b/g;
/** Normalizace popisu („NETFLIX.COM 12345 Amsterdam“ → „netflix“). */
export function merchantKey(description: string): string {
  return description.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\.(com|cz|net|io|eu)\b/g, " ").replace(STOP, " ").replace(/[^a-z ]+/g, " ").trim().split(/\s+/).filter((w) => w.length > 2).slice(0, 2).join(" ");
}

export interface SubscriptionCandidate { key: string; name: string; amount: Cents; count: number; lastDate: string; yearly: Cents; known: boolean }
export interface PriceIncrease { key: string; name: string; from: Cents; to: Cents; date: string; yearlyImpact: Cents; recurringId: string | null }

/**
 * Hledá v transakcích pravidelné měsíční platby (≥ 3× po cca měsíci, podobná částka)
 * a zdražení (poslední platba vyšší než předchozí o víc než 3 %).
 */
export function detectSubscriptions(txs: readonly Transaction[], recurring: readonly RecurringPayment[], today: string) {
  const groups = new Map<string, Transaction[]>();
  for (const t of txs) {
    if (t.type !== "expense" || t.status !== "posted" || diffDays(t.date, today) > 400) continue;
    const k = t.recurring_payment_id ? `rp:${t.recurring_payment_id}` : merchantKey(t.description);
    if (!k) continue;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const candidates: SubscriptionCandidate[] = [];
  const increases: PriceIncrease[] = [];
  for (const [key, list] of groups) {
    const sorted = [...list].sort((a, b) => a.date.localeCompare(b.date));
    // jedna platba za měsíc
    const byMonth = new Map<string, Transaction>();
    for (const t of sorted) byMonth.set(t.date.slice(0, 7), t);
    const monthly = [...byMonth.values()];
    if (monthly.length < 3) continue;
    const gaps = monthly.slice(1).map((t, i) => diffDays(monthly[i].date, t.date));
    const regular = gaps.filter((g) => g >= 25 && g <= 36).length >= gaps.length * 0.7;
    const last = monthly.at(-1)!, prev = monthly.at(-2)!;
    const amounts = monthly.map((t) => t.amount);
    const median = [...amounts].sort((a, b) => a - b)[Math.floor(amounts.length / 2)];
    const similar = amounts.filter((a) => Math.abs(a - median) <= median * 0.25).length >= amounts.length * 0.7;
    if (!regular || !similar || diffDays(last.date, today) > 45) continue;
    const rpId = key.startsWith("rp:") ? key.slice(3) : null;
    const rp = rpId ? recurring.find((r) => r.id === rpId) : recurring.find((r) => merchantKey(r.name) === key);
    const name = rp?.name ?? last.description;
    candidates.push({ key, name, amount: last.amount, count: monthly.length, lastDate: last.date, yearly: last.amount * 12, known: Boolean(rp) });
    if (last.amount > prev.amount * 1.03 && last.amount - prev.amount >= 1000) {
      increases.push({ key, name, from: prev.amount, to: last.amount, date: last.date, yearlyImpact: (last.amount - prev.amount) * 12, recurringId: rp?.id ?? null });
    }
  }
  candidates.sort((a, b) => b.yearly - a.yearly);
  return { candidates, unknown: candidates.filter((c) => !c.known), increases, yearlyTotal: candidates.reduce((a, c) => a + c.yearly, 0) };
}
