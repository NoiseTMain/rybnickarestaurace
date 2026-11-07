import { describe, expect, it } from "vitest";
import { computeSnapshot, type FinanceData } from "@/lib/finance/snapshot";
import { answer, parseExpenseDraft } from "@/lib/assistant";
import { anomalies, forecast, parsePeriod, savingsTips, whatIf } from "@/lib/finance/insights";
import type { Account, Category, IncomeSource, RecurringPayment, Transaction } from "@/lib/db/types";

const H = "h";
const cat = (id: string, name: string, extra: Partial<Category> = {}): Category => ({ id, household_id: H, name, kind: "expense", icon: "", color: "", is_food: false, is_household: false, is_archived: false, sort: 0, created_at: "", ...extra });
const acc: Account = { id: "main", household_id: H, name: "Účet", kind: "checking", opening_balance: 3_000_000, opening_date: "2026-07-01", include_in_available: true, member_id: null, is_active: true, sort: 0, created_at: "" };
let n = 0;
const tx = (p: Partial<Transaction>): Transaction => ({
  id: `t${++n}`, household_id: H, type: "expense", status: "posted", amount: 0, date: "2026-11-02", account_id: "main", transfer_account_id: null,
  category_id: null, description: "", member_id: null, scope: "shared", is_recurring: false, payment_method: "card", source: "manual",
  external_id: null, recurring_payment_id: null, income_source_id: null, occurrence_date: null, payout_id: null, invoice_id: null,
  purchase_id: null, contribution_id: null, shopping_list_id: null, document_id: null, note: null, cancelled_at: null, created_at: "", updated_at: "", ...p,
});
const salary: IncomeSource = { id: "sal", household_id: H, name: "Mzda", amount: 3_500_000, frequency: "monthly", start_date: "2026-07-15", end_date: null, member_id: null, account_id: "main", category_id: null, is_active: true, note: null, created_at: "" };
const rent: RecurringPayment = { id: "rent", household_id: H, name: "Nájem", amount: 1_500_000, frequency: "monthly", start_date: "2026-07-05", end_date: null, category_id: "najem", account_id: "main", member_id: null, payment_method: "transfer", is_debt: false, debt_remaining: null, is_active: true, note: null, created_at: "" };

const transactions: Transaction[] = [];
for (const m of ["07", "08", "09", "10"]) {
  transactions.push(tx({ type: "income", amount: 3_500_000, date: `2026-${m}-15`, income_source_id: "sal", occurrence_date: `2026-${m}-15` }));
  transactions.push(tx({ amount: 1_500_000, date: `2026-${m}-05`, category_id: "najem", recurring_payment_id: "rent", occurrence_date: `2026-${m}-05`, description: "Nájem" }));
  transactions.push(tx({ amount: 80_000, date: `2026-${m}-10`, category_id: "rest", description: "Pizza Roma" }));
  transactions.push(tx({ amount: 25_000, date: `2026-${m}-12`, category_id: "food", description: "Lidl" }));
  transactions.push(tx({ amount: 25_000, date: `2026-${m}-20`, category_id: "food", description: "Lidl" }));
  transactions.push(tx({ amount: 29_900, date: `2026-${m}-03`, category_id: "zab", description: "Netflix" }));
}
transactions.push(tx({ amount: 250_000, date: "2026-10-25", category_id: "rest", description: "Oslava" }));
transactions.push(tx({ amount: 45_000, date: "2026-11-02", category_id: "food", description: "Albert" }));
transactions.push(tx({ amount: 45_000, date: "2026-11-03", category_id: "food", description: "Albert" }));

const data: FinanceData = {
  settings: null, members: [], accounts: [acc],
  categories: [cat("food", "Potraviny", { is_food: true }), cat("rest", "Restaurace"), cat("najem", "Nájem"), cat("zab", "Zábava")],
  transactions, recurring: [rent], incomeSources: [salary], budgets: [], goals: [], contributions: [], invoices: [], payouts: [], shifts: [], purchases: [], marks: [],
};
const today = "2026-11-06";
const s = computeSnapshot(data, today);

describe("asistent – kategorie, obchody, období", () => {
  it("období", () => {
    expect(parsePeriod("za poslední 3 měsíce", today)).toMatchObject({ from: "2026-09-01", to: today, months: 3 });
    expect(parsePeriod("minulý měsíc", today)).toMatchObject({ from: "2026-10-01", to: "2026-10-31" });
  });
  it("kolik v restauracích za 3 měsíce", () => {
    const a = answer("Kolik jsme za poslední 3 měsíce utratili v restauracích?", s, data);
    expect(a.text).toMatch(/Restaurace/);
    expect(a.text).toMatch(/4\s100\s*Kč/); // září 800 + říjen 800 + oslava 2 500, listopad zatím nic
  });
  it("kolik u obchodu (Lidl) minulý měsíc", () => {
    const a = answer("Kolik jsme dali minulý měsíc v Lidlu?", s, data);
    expect(a.text).toMatch(/500\s*Kč/);
    expect(a.context?.merchant).toBe("lidl");
  });
  it("navazující otázka mění období", () => {
    const first = answer("Kolik jsme dali minulý měsíc v Lidlu?", s, data);
    const next = answer("A letos?", s, data, first.context);
    expect(next.text).toMatch(/Letos/);
    expect(next.text).toMatch(/2\s000\s*Kč/);
  });
});

describe("co kdyby, výhled, anomálie, tipy", () => {
  it("splátky snižují měsíční přebytek", () => {
    const r = whatIf(s, data, "installments", 1_500_000, 10);
    expect(r.monthlyAfter).toBe(r.monthlyBefore! - 150_000);
    const a = answer("Co když koupíme sedačku za 15 000 Kč na 10 splátek?", s, data);
    expect(a.text).toMatch(/10 splátek/);
  });
  it("navazující otázka na nákup", () => {
    const a = answer("Můžeme si dovolit pračku za 9 000 Kč?", s, data);
    const b = answer("A za 90 000?", s, data, a.context);
    expect(b.text).toMatch(/90\s000/);
  });
  it("výhled na 3 měsíce", () => {
    const f = forecast(s, data, 3);
    expect(f.months).toHaveLength(3);
    expect(f.months[0].income).toBe(3_500_000);
    expect(f.months[0].fixed).toBe(1_500_000);
    expect(answer("Jaký je výhled na 3 měsíce?", s, data).table?.rows).toHaveLength(3);
  });
  it("anomálie: duplicita a neevidované předplatné", () => {
    const a = anomalies(s, data);
    expect(a.some((x) => x.id.startsWith("dup-"))).toBe(true);
    expect(a.some((x) => x.title.includes("Netflix"))).toBe(true);
    expect(a.some((x) => x.title.includes("Oslava") || x.title.includes("Neobvykle"))).toBe(false); // jen 4 vzorky v kategorii
  });
  it("tipy na úspory", () => {
    const t = savingsTips(s, data);
    expect(t.some((x) => x.title.startsWith("Restaurace"))).toBe(true);
  });
});

describe("zadání výdaje", () => {
  it("rozpozná krátký zápis a kategorii", () => {
    const d = parseExpenseDraft("250 Albert", data, today);
    expect(d).toMatchObject({ amount: 25_000, description: "Albert", categoryId: "food", paymentMethod: "card" });
    expect(parseExpenseDraft("tankování 1 400 hotově", data, today)).toMatchObject({ amount: 140_000, paymentMethod: "cash" });
    expect(parseExpenseDraft("Můžeme si dovolit sedačku za 15 000?", data, today)).toBeNull();
    expect(answer("250 Albert", s, data).draft?.amount).toBe(25_000);
  });
});
