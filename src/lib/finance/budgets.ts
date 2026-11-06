import { clampZero, sub, sum, percent, type Cents } from "@/lib/money";
import { startOfMonth, type ISODate } from "@/lib/dates";
import type { Budget, Category, Transaction } from "@/lib/db/types";
import { expensesIn } from "./period";

/** Rozpočet pro měsíc: konkrétní měsíc má přednost před výchozím (month = null). */
export function resolveBudget(budgets: readonly Budget[], kind: Budget["kind"], month: ISODate, categoryId: string | null = null): Budget | null {
  const m = startOfMonth(month);
  const matching = budgets.filter((b) => b.kind === kind && (kind !== "category" || b.category_id === categoryId));
  return matching.find((b) => b.month === m) ?? matching.find((b) => b.month == null) ?? null;
}

export interface CategoryBudgetView {
  budget: Budget;
  category: Category | undefined;
  spent: Cents;
  remaining: Cents;
  percent: number;
  over: boolean;
}

export function categoryBudgets(
  budgets: readonly Budget[],
  categories: readonly Category[],
  txs: readonly Transaction[],
  monthStart: ISODate,
  today: ISODate,
): CategoryBudgetView[] {
  const ids = [...new Set(budgets.filter((b) => b.kind === "category" && b.category_id).map((b) => b.category_id!))];
  const out: CategoryBudgetView[] = [];
  for (const id of ids) {
    const budget = resolveBudget(budgets, "category", monthStart, id);
    if (!budget) continue;
    const spent = expensesIn(txs, monthStart, today, (t) => t.category_id === id);
    out.push({
      budget, category: categories.find((c) => c.id === id), spent,
      remaining: sub(budget.amount, spent), percent: percent(spent, budget.amount), over: spent > budget.amount,
    });
  }
  return out.sort((a, b) => b.percent - a.percent);
}

/** Kolik ještě zbývá z kategoriových rozpočtů (mimo jídlo) – rezervuje se v plánu. */
export function remainingCategoryBudgets(views: readonly CategoryBudgetView[], foodIds: Set<string>): Cents {
  return sum(views.filter((v) => !foodIds.has(v.budget.category_id ?? "")), (v) => clampZero(v.remaining));
}
