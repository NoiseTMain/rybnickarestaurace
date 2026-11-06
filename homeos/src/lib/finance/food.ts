import { clampZero, divFloor, divRound, percent, sub, type Cents } from "@/lib/money";
import { daysInMonth, endOfWeek, minDate, diffDays, endOfMonth, parts, type ISODate } from "@/lib/dates";

export type FoodAlertLevel = "info" | "warning" | "danger";

export interface FoodAlert {
  code: "near_limit" | "over_limit" | "too_fast" | "wont_last";
  level: FoodAlertLevel;
  message: string;
}

export interface FoodBudgetResult {
  budget: Cents;
  spent: Cents;
  spentToday: Cents;
  remaining: Cents; // může být záporné (překročení)
  daysInMonth: number;
  dayOfMonth: number;
  daysLeft: number; // včetně dneška
  /** Plán podle celého měsíce. */
  plannedDaily: Cents;
  plannedWeekly: Cents;
  /** Kolik mělo být podle plánu utraceno do dneška (včetně). */
  expectedByNow: Cents;
  /** Přepočítaný limit na den pro zbytek měsíce (včetně dneška). */
  dailyLimit: Cents;
  /** Kolik lze ještě utratit v aktuálním týdnu (po–ne, v rámci měsíce). */
  weekLimit: Cents;
  daysLeftInWeek: number;
  avgDaily: Cents;
  projected: Cents;
  /** Rozdíl proti plánu k dnešku: kladné = pod plánem (ušetřeno), záporné = nad plánem. */
  vsPlan: Cents;
  usedPercent: number;
  status: "ok" | "warning" | "over";
  alerts: FoodAlert[];
}

export interface FoodBudgetInput {
  budget: Cents;
  /** Výdaje za potraviny v aktuálním měsíci do dneška včetně. */
  spent: Cents;
  spentToday?: Cents;
  today: ISODate;
  warnPercent?: number; // výchozí 85
  paceTolerancePercent?: number; // výchozí 10
}

/**
 * Inteligentní rozpočet na jídlo.
 * Limity zaokrouhlujeme DOLŮ (na celé haléře), aby aplikace nikdy
 * nenabídla utratit víc, než je k dispozici.
 */
export function computeFoodBudget(input: FoodBudgetInput): FoodBudgetResult {
  const { budget, spent, today } = input;
  const spentToday = input.spentToday ?? 0;
  const warnPercent = input.warnPercent ?? 85;
  const tolerance = input.paceTolerancePercent ?? 10;
  const p = parts(today);
  const D = daysInMonth(p.y, p.m);
  const d = p.d;
  const daysLeft = D - d + 1;
  const remaining = sub(budget, spent);

  const plannedDaily = divFloor(budget, D);
  const plannedWeekly = divFloor(budget * 7, D);
  const expectedByNow = divRound(budget * d, D);
  const dailyLimit = divFloor(clampZero(remaining), daysLeft);
  const weekEnd = minDate(endOfWeek(today), endOfMonth(today));
  const daysLeftInWeek = diffDays(today, weekEnd) + 1;
  const weekLimit = divFloor(clampZero(remaining) * daysLeftInWeek, daysLeft);
  const avgDaily = divRound(spent, d);
  const projected = spent + divRound(spent * (D - d), d);
  const vsPlan = sub(expectedByNow, spent);
  const usedPercent = percent(spent, budget);

  const alerts: FoodAlert[] = [];
  if (budget > 0) {
    if (spent > budget) {
      alerts.push({ code: "over_limit", level: "danger", message: "Překročili jste měsíční rozpočet na jídlo." });
    } else if (spent * 100 >= budget * warnPercent) {
      alerts.push({ code: "near_limit", level: "warning", message: `Blížíte se k limitu – vyčerpáno ${usedPercent} % rozpočtu.` });
    }
    if (spent <= budget && spent * 100 > expectedByNow * (100 + tolerance) && spent > 0) {
      alerts.push({ code: "too_fast", level: "warning", message: "Utrácíte rychleji, než odpovídá plánu." });
    }
    if (spent <= budget && projected > budget && d < D) {
      alerts.push({
        code: "wont_last",
        level: "danger",
        message: "Při současném tempu vám peníze na jídlo nevystačí do konce měsíce.",
      });
    }
  }
  const status = spent > budget ? "over" : alerts.length ? "warning" : "ok";

  return {
    budget, spent, spentToday, remaining, daysInMonth: D, dayOfMonth: d, daysLeft,
    plannedDaily, plannedWeekly, expectedByNow, dailyLimit, weekLimit, daysLeftInWeek,
    avgDaily, projected, vsPlan, usedPercent, status, alerts,
  };
}
