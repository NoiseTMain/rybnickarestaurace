import { describe, expect, it } from "vitest";
import { computeSnapshot, type FinanceData } from "@/lib/finance/snapshot";
import { answer, buildInsights } from "@/lib/assistant";
import type { Account, Category, RecurringPayment, Transaction } from "@/lib/db/types";

const H = "h";
const acc = (id: string, opening: number, liquid = true): Account => ({
  id, household_id: H, name: id, kind: liquid ? "checking" : "savings", opening_balance: opening, opening_date: "2026-11-01",
  include_in_available: liquid, member_id: null, is_active: true, sort: 0, created_at: "",
});
const food: Category = { id: "food", household_id: H, name: "Potraviny", kind: "expense", icon: "", color: "", is_food: true, is_household: true, is_archived: false, sort: 0, created_at: "" };
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, household_id: H, type: "expense", status: "posted", amount: 0, date: "2026-11-02", account_id: "main", transfer_account_id: null,
  category_id: null, description: "", member_id: null, scope: "shared", is_recurring: false, payment_method: "card", source: "manual",
  external_id: null, recurring_payment_id: null, income_source_id: null, occurrence_date: null, payout_id: null, invoice_id: null,
  purchase_id: null, contribution_id: null, shopping_list_id: null, document_id: null, note: null, cancelled_at: null, created_at: "", updated_at: "", ...p,
});
const rent: RecurringPayment = {
  id: "rent", household_id: H, name: "Nájem", amount: 1_500_000, frequency: "monthly", start_date: "2026-11-05", end_date: null, category_id: null,
  account_id: "main", member_id: null, payment_method: "transfer", is_debt: false, debt_remaining: null, is_active: true, note: null, created_at: "",
};

function data(over: Partial<FinanceData> = {}): FinanceData {
  return {
    settings: null, members: [], accounts: [acc("main", 5_000_000), acc("sav", 10_000_000, false)], categories: [food], transactions: [],
    recurring: [rent], incomeSources: [], budgets: [{ id: "b", household_id: H, kind: "food", category_id: null, amount: 1_200_000, month: null, created_at: "" }],
    goals: [], contributions: [], invoices: [], payouts: [], shifts: [], purchases: [], marks: [], ...over,
  };
}

describe("snapshot – nic se nezapočítá dvakrát", () => {
  it("nezaplacený nájem je závazek, zaplacený už jen v zůstatku", () => {
    const before = computeSnapshot(data(), "2026-11-06");
    expect(before.balance.liquid).toBe(5_000_000);
    expect(before.balance.total).toBe(15_000_000);
    expect(before.unpaidObligationsTotal).toBe(1_500_000); // po splatnosti od 5. 11.
    expect(before.planner.afterObligations).toBe(3_500_000);

    const paid = computeSnapshot(data({ transactions: [tx({ amount: 1_500_000, recurring_payment_id: "rent", occurrence_date: "2026-11-05", date: "2026-11-05" })] }), "2026-11-06");
    expect(paid.balance.liquid).toBe(3_500_000);
    expect(paid.unpaidObligationsTotal).toBe(0);
    expect(paid.planner.afterObligations).toBe(3_500_000); // stejný výsledek – žádné dvojí odečtení
  });

  it("stornovaná transakce se ignoruje, převod není výdaj", () => {
    const s = computeSnapshot(data({
      transactions: [
        tx({ amount: 50_000, category_id: "food" }),
        tx({ amount: 99_999, category_id: "food", status: "cancelled", cancelled_at: "x" }),
        tx({ type: "transfer", amount: 1_000_000, transfer_account_id: "sav" }),
      ],
    }), "2026-11-06");
    expect(s.month.expense).toBe(50_000);
    expect(s.food!.spent).toBe(50_000);
    expect(s.balance.liquid).toBe(5_000_000 - 50_000 - 1_000_000);
    expect(s.balance.total).toBe(15_000_000 - 50_000);
  });

  it("transakce před datem počátečního zůstatku se do zůstatku nepočítají", () => {
    const s = computeSnapshot(data({ transactions: [tx({ amount: 70_000, date: "2026-10-30" })] }), "2026-11-06");
    expect(s.balance.liquid).toBe(5_000_000);
  });

  it("očekávané příjmy nejsou dostupné peníze", () => {
    const s = computeSnapshot(data({ payouts: [{ id: "p", household_id: H, member_id: null, label: "Výplata", period_from: null, period_to: null, expected_amount: 2_000_000, expected_date: "2026-11-15", received_amount: null, received_date: null, status: "expected", account_id: null, invoice_id: null, note: null, created_at: "" }] }), "2026-11-06");
    expect(s.expectedIncomeTotal).toBe(2_000_000);
    expect(s.planner.available).toBe(5_000_000);
    expect(s.planner.safeToSpendIfIncomeArrives - s.planner.safeToSpend).toBe(2_000_000);
  });

  it("stará nezaplacená faktura mimo plán se nezapočítá", () => {
    const inv = { id: "i", household_id: H, direction: "received" as const, number: "1", counterparty: "X", counterparty_ico: null, issue_date: "2026-01-01", due_date: "2026-01-15", paid_date: null, amount: 900_000, status: "unpaid" as const, include_in_plan: false, note: null, document_id: null, ocr_used: false, created_at: "" };
    expect(computeSnapshot(data({ invoices: [inv] }), "2026-11-06").unpaidObligationsTotal).toBe(1_500_000);
  });
});

describe("asistent", () => {
  it("bez účtů se doptá", () => {
    const d = data({ accounts: [] });
    const a = answer("Můžeme si dovolit sedačku za 15 000 Kč?", computeSnapshot(d, "2026-11-06"), d);
    expect(a.needs?.href).toBe("/nastaveni#ucty");
  });
  it("odpoví na nákup podle dat", () => {
    const d = data();
    const s = computeSnapshot(d, "2026-11-06");
    // 50 000 − nájem 15 000 − jídlo 12 000 = 23 000 volných
    expect(s.planner.safeToSpend).toBe(2_300_000);
    expect(answer("Můžeme si dovolit sedačku za 15 000 Kč?", s, d).text).toMatch(/^Ano/);
    expect(answer("Můžeme si dovolit auto za 30 000 Kč?", s, d).text).toMatch(/Chybí vám 7\s000/);
    expect(buildInsights(s, d).some((i) => i.id === "due-soon")).toBe(true);
  });
});
