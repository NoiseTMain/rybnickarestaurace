import "server-only";
import { cache } from "react";
import type { AppContext } from "@/lib/context";
import type { Store } from "@/lib/db/store";
import type { FinanceData } from "@/lib/finance/snapshot";
import type { DocumentRow, HouseholdSettings, WorkSettings } from "@/lib/db/types";
import { computeSnapshot } from "@/lib/finance/snapshot";
import { todayISO } from "@/lib/dates";

export interface FullData extends FinanceData {
  travel: Required<NonNullable<FinanceData["travel"]>>;
  workSettings: WorkSettings | null;
  documents: DocumentRow[];
}

const byName = <T extends { name: string; sort?: number }>(a: T, b: T) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "cs");

/** Načte všechna data domácnosti (pro výpočty; osobní data mají řádově tisíce záznamů). */
export const loadData = cache(async (ctx: AppContext): Promise<FullData> => loadHouseholdData(ctx.store, ctx.household.id));

/** Načtení dat libovolné domácnosti přes zadané úložiště (např. pro plánované souhrny). */
export async function loadHouseholdData(s: Store, householdId: string): Promise<FullData> {
  const h = { household_id: householdId };
  const [settings, members, accounts, categories, transactions, recurring, incomeSources, budgets, goals, contributions, invoices, payouts, shifts, purchases, marks, workSettings, documents, trips, tripLegs, tripExpenses, tripPeople, tripCash, tripChecklist, tripPlan, tripSettlements] =
    await Promise.all([
      s.select("household_settings", h), s.select("members", h), s.select("accounts", h), s.select("categories", h),
      s.select("transactions", h), s.select("recurring_payments", h), s.select("income_sources", h), s.select("budgets", h),
      s.select("savings_goals", h), s.select("savings_contributions", h), s.select("invoices", h), s.select("payouts", h),
      s.select("work_shifts", h), s.select("purchases", h), s.select("occurrence_marks", h), s.select("work_settings", h),
      s.select("documents", h), s.select("trips", h), s.select("trip_legs", h), s.select("trip_expenses", h),
      s.select("trip_people", h), s.select("trip_cash_moves", h), s.select("trip_checklist", h), s.select("trip_plan_items", h), s.select("trip_settlements", h),
    ]);
  return {
    settings: (settings[0] as HouseholdSettings | undefined) ?? null,
    members: members.sort(byName),
    accounts: accounts.sort(byName),
    categories: categories.sort(byName),
    transactions: transactions.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    recurring, incomeSources, budgets, goals, contributions,
    invoices: invoices.sort((a, b) => b.issue_date.localeCompare(a.issue_date)),
    payouts: payouts.sort((a, b) => b.expected_date.localeCompare(a.expected_date)),
    shifts: shifts.sort((a, b) => b.date.localeCompare(a.date)),
    purchases, marks,
    workSettings: workSettings[0] ?? null,
    documents: documents.sort((a, b) => b.created_at.localeCompare(a.created_at)),
    travel: {
      trips: trips.sort((a, b) => (b.start_date ?? "9999").localeCompare(a.start_date ?? "9999")),
      legs: tripLegs.sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)),
      expenses: tripExpenses.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.created_at.localeCompare(a.created_at)),
      people: tripPeople.sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)),
      cash: tripCash.sort((a, b) => a.date.localeCompare(b.date) || a.created_at.localeCompare(b.created_at)),
      checklist: tripChecklist.sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)),
      settlements: tripSettlements.sort((a, b) => a.created_at.localeCompare(b.created_at)),
      plan: tripPlan.sort((a, b) => (a.date ?? "9999").localeCompare(b.date ?? "9999") || (a.time ?? "").localeCompare(b.time ?? "")),
    },
  };
}

export const loadSnapshot = cache(async (ctx: AppContext) => {
  const data = await loadData(ctx);
  const today = todayISO();
  return { data, today, snapshot: computeSnapshot(data, today) };
});
