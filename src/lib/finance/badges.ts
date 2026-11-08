import type { SavingsContribution, SavingsGoal, Transaction, Trip } from "@/lib/db/types";
import { addDays, type ISODate } from "@/lib/dates";

export interface Badge { key: string; emoji: string; title: string; detail: string; earned: boolean; progress?: { value: number; target: number } }

/** Dnes v Praze z ISO časové značky. */
const pragueDay = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date(iso));

/** Série: kolik dní po sobě (do dneška nebo včerejška) jste něco zapsali. */
export function recordingStreak(txs: readonly Pick<Transaction, "created_at">[], today: ISODate) {
  const days = new Set(txs.map((t) => pragueDay(t.created_at)));
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) { n++; d = addDays(d, -1); }
  let best = 0, run = 0, prev: string | null = null;
  for (const day of [...days].sort()) { run = prev && addDays(prev, 1) === day ? run + 1 : 1; best = Math.max(best, run); prev = day; }
  return { current: n, best, todayDone: days.has(today) };
}

export function badges(input: {
  txs: readonly Transaction[]; goals: readonly SavingsGoal[]; contributions: readonly SavingsContribution[]; trips: readonly Trip[];
  today: ISODate; lastMonth: { income: number; expense: number }; monthlyExpenses: number; liquid: number; debtsLeft: number | null; budgetKept: boolean | null;
}): { streak: ReturnType<typeof recordingStreak>; list: Badge[] } {
  const streak = recordingStreak(input.txs, input.today);
  const posted = input.txs.filter((t) => t.status === "posted");
  const saved = input.contributions.reduce((a, c) => a + c.amount, 0);
  const reserveMonths = input.monthlyExpenses > 0 ? input.liquid / input.monthlyExpenses : 0;
  const list: Badge[] = [
    { key: "first", emoji: "✍️", title: "První zápis", detail: "Zapsali jste první příjem nebo výdaj", earned: posted.length > 0 },
    { key: "tx100", emoji: "📚", title: "Pečlivý účetní", detail: "100 zapsaných pohybů", earned: posted.length >= 100, progress: { value: Math.min(posted.length, 100), target: 100 } },
    { key: "streak7", emoji: "🔥", title: "Týden v řadě", detail: "7 dní po sobě jste zapisovali", earned: streak.best >= 7, progress: { value: Math.min(streak.best, 7), target: 7 } },
    { key: "streak30", emoji: "🏆", title: "Měsíc v řadě", detail: "30 dní po sobě jste zapisovali", earned: streak.best >= 30, progress: { value: Math.min(streak.best, 30), target: 30 } },
    { key: "goal", emoji: "🎯", title: "Mám cíl", detail: "Založili jste spořicí cíl", earned: input.goals.length > 0 },
    { key: "goalDone", emoji: "🥇", title: "Cíl splněn", detail: "Dosáhli jste spořicího cíle", earned: input.goals.some((g) => g.status === "achieved") },
    { key: "saved10k", emoji: "🐷", title: "Prvních 10 000", detail: "Odloženo 10 000 Kč na cíle", earned: saved >= 1_000_000, progress: { value: Math.min(Math.max(0, saved), 1_000_000) / 100, target: 10_000 } },
    { key: "plus", emoji: "📈", title: "Měsíc v plusu", detail: "Minulý měsíc byly příjmy vyšší než výdaje", earned: input.lastMonth.income > 0 && input.lastMonth.income > input.lastMonth.expense },
    { key: "budget", emoji: "🧘", title: "Rozpočet dodržen", detail: "Minulý měsíc jste nepřekročili celkový rozpočet", earned: input.budgetKept === true },
    { key: "reserve3", emoji: "🛟", title: "Rezerva na 3 měsíce", detail: "Na běžných účtech máte aspoň 3 měsíce výdajů", earned: reserveMonths >= 3, progress: { value: Math.min(Math.round(reserveMonths * 10) / 10, 3), target: 3 } },
    { key: "debtFree", emoji: "🕊️", title: "Bez dluhů", detail: "Splatili jste všechny evidované dluhy", earned: input.debtsLeft === 0 },
    { key: "trip", emoji: "🧳", title: "Cestovatel", detail: "Naplánovali jste první cestu", earned: input.trips.length > 0 },
  ];
  return { streak, list };
}
