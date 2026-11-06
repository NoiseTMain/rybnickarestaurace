import { clampZero, divCeil, percent, sub, sum, type Cents } from "@/lib/money";
import { addMonths, monthsBetween, startOfMonth, type ISODate } from "@/lib/dates";
import type { SavingsContribution, SavingsGoal } from "@/lib/db/types";

export interface GoalProgress {
  goal: SavingsGoal;
  saved: Cents;
  remaining: Cents;
  percent: number;
  contributedThisMonth: Cents;
  /** Počet měsíců do termínu včetně aktuálního a cílového měsíce. */
  monthsLeft: number | null;
  /** Kolik je potřeba odkládat měsíčně, aby byl cíl splněn v termínu. */
  requiredMonthly: Cents | null;
  /** Plán na tento měsíc (požadovaný nebo zadaný pravidelný vklad). */
  plannedThisMonth: Cents;
  /** Kolik z plánu na tento měsíc ještě zbývá odložit. */
  remainingThisMonth: Cents;
  /** Odhad data dosažení při pravidelném vkladu. */
  estimatedDate: ISODate | null;
  overdue: boolean;
  achieved: boolean;
}

export function goalProgress(goal: SavingsGoal, contributions: readonly SavingsContribution[], today: ISODate): GoalProgress {
  const mine = contributions.filter((c) => c.goal_id === goal.id && c.date <= today);
  const monthStart = startOfMonth(today);
  const saved = sum(mine, (c) => c.amount);
  const savedBefore = sum(mine.filter((c) => c.date < monthStart), (c) => c.amount);
  const contributedThisMonth = sub(saved, savedBefore);
  const remaining = clampZero(sub(goal.target_amount, saved));
  const achieved = saved >= goal.target_amount || goal.status === "achieved";

  let monthsLeft: number | null = null;
  let requiredMonthly: Cents | null = null;
  let overdue = false;
  if (goal.target_date) {
    if (goal.target_date < monthStart) {
      overdue = !achieved;
      monthsLeft = 0;
      requiredMonthly = remaining;
    } else {
      monthsLeft = monthsBetween(monthStart, startOfMonth(goal.target_date)) + 1;
      // počítáno ze stavu na začátku měsíce → během měsíce se požadavek nemění
      const remainingAtMonthStart = clampZero(sub(goal.target_amount, savedBefore));
      requiredMonthly = divCeil(remainingAtMonthStart, monthsLeft);
    }
  }

  const active = goal.status === "active" && !achieved;
  const plannedThisMonth = !active
    ? 0
    : requiredMonthly != null
      ? Math.max(requiredMonthly, goal.monthly_contribution ?? 0)
      : (goal.monthly_contribution ?? 0);
  const remainingThisMonth = active ? Math.min(remaining, clampZero(sub(plannedThisMonth, contributedThisMonth))) : 0;

  let estimatedDate: ISODate | null = null;
  const monthly = goal.monthly_contribution ?? requiredMonthly ?? 0;
  if (achieved) estimatedDate = null;
  else if (monthly > 0) {
    const afterThisMonth = clampZero(sub(remaining, remainingThisMonth));
    const n = afterThisMonth === 0 ? 0 : divCeil(afterThisMonth, monthly);
    estimatedDate = addMonths(monthStart, n);
  }

  return {
    goal, saved, remaining, percent: Math.min(100, percent(saved, goal.target_amount)),
    contributedThisMonth, monthsLeft, requiredMonthly, plannedThisMonth, remainingThisMonth,
    estimatedDate, overdue, achieved,
  };
}

export function goalsSummary(goals: readonly SavingsGoal[], contributions: readonly SavingsContribution[], today: ISODate) {
  const progress = goals.filter((g) => g.status !== "archived").map((g) => goalProgress(g, contributions, today));
  return {
    progress,
    totalSaved: sum(progress, (p) => p.saved),
    totalTarget: sum(progress, (p) => p.goal.target_amount),
    plannedThisMonth: sum(progress, (p) => p.plannedThisMonth),
    remainingThisMonth: sum(progress, (p) => p.remainingThisMonth),
    contributedThisMonth: sum(progress, (p) => p.contributedThisMonth),
    requiredMonthlyTotal: sum(progress, (p) => (p.achieved ? 0 : (p.requiredMonthly ?? p.goal.monthly_contribution ?? 0))),
  };
}

