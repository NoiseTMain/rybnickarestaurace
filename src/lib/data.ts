import "server-only";
import type { AppContext } from "@/lib/context";
import type { FinanceData } from "@/lib/finance/snapshot";
import type { DocumentRow, HouseholdSettings, WorkSettings } from "@/lib/db/types";
import { computeSnapshot } from "@/lib/finance/snapshot";
import { todayISO } from "@/lib/dates";

export interface FullData extends FinanceData {
  workSettings: WorkSettings | null;
  documents: DocumentRow[];
}

const byName = <T extends { name: string; sort?: number }>(a: T, b: T) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name, "cs");

/** Načte všechna data domácnosti (pro výpočty; osobní data mají řádově tisíce záznamů). */
export async function loadData(ctx: AppContext): Promise<FullData> {
  const s = ctx.store;
  const h = { household_id: ctx.household.id };
  const [settings, members, accounts, categories, transactions, recurring, incomeSources, budgets, goals, contributions, invoices, payouts, shifts, purchases, marks, workSettings, documents] =
    await Promise.all([
      s.select("household_settings", h), s.select("members", h), s.select("accounts", h), s.select("categories", h),
      s.select("transactions", h), s.select("recurring_payments", h), s.select("income_sources", h), s.select("budgets", h),
      s.select("savings_goals", h), s.select("savings_contributions", h), s.select("invoices", h), s.select("payouts", h),
      s.select("work_shifts", h), s.select("purchases", h), s.select("occurrence_marks", h), s.select("work_settings", h),
      s.select("documents", h),
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
  };
}

export async function loadSnapshot(ctx: AppContext) {
  const data = await loadData(ctx);
  const today = todayISO();
  return { data, today, snapshot: computeSnapshot(data, today) };
}
