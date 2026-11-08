import { describe, expect, it } from "vitest";
import { runTool, TOOLS, type ToolEnv } from "@/lib/assistant-ai/tools";
import { runChat, type StreamingClient } from "@/lib/assistant-ai/chat";
import { computeSnapshot, type FinanceData } from "@/lib/finance/snapshot";
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

const env = (): ToolEnv => ({ data: { ...data, workSettings: null, documents: [], travel: { trips: [], legs: [], expenses: [], people: [], cash: [], checklist: [], plan: [] } }, snapshot: s, today, drafts: [] });

describe("AI nástroje", () => {
  it("všechny nástroje mají striktní schéma bez dalších vlastností", () => {
    for (const t of TOOLS) {
      expect((t as { strict?: boolean }).strict).toBe(true);
      const schema = t.input_schema as unknown as { additionalProperties: boolean; properties: Record<string, unknown>; required: string[] };
      expect(schema.additionalProperties).toBe(false);
      expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    }
  });

  it("find_transactions počítá přesně z dat (Kč)", () => {
    const r = runTool("find_transactions", { date_from: "2026-10-01", date_to: "2026-10-31", type: "expense", category: "restaur", text: null, member: null, min_amount_czk: null, max_amount_czk: null, sort: "largest", limit: 5 }, env());
    expect(r.ok).toBe(true);
    const res = (r as { result: { count: number; total_expenses_czk: number; items: { amount_czk: number; description: string }[] } }).result;
    expect(res.count).toBe(2);
    expect(res.total_expenses_czk).toBe(3300);
    expect(res.items[0]).toMatchObject({ amount_czk: 2500, description: "Oslava" });
  });

  it("text hledá bez diakritiky a neplatný vstup vrací chybu", () => {
    const r = runTool("find_transactions", { date_from: "2026-07-01", date_to: "2026-11-30", type: "any", category: null, text: "lidl", member: null, min_amount_czk: null, max_amount_czk: null, sort: "newest", limit: 100 }, env());
    expect((r as { result: { count: number } }).result.count).toBe(8);
    expect(runTool("find_transactions", { date_from: "včera" }, env()).ok).toBe(false);
    expect(runTool("smaz_vse", {}, env()).ok).toBe(false);
  });

  it("propose_transaction jen připraví návrh, nic neukládá", () => {
    const e = env();
    const r = runTool("propose_transaction", { type: "expense", amount_czk: 250.5, description: "Albert", category: "Potraviny", date: null, payment_method: "card" }, e);
    expect(r.ok).toBe(true);
    expect(e.drafts).toEqual([{ type: "expense", amount: 25050, description: "Albert", categoryId: "food", paymentMethod: "card", date: today }]);
    expect(e.data.transactions.length).toBe(transactions.length);
  });

  it("přehled, historie, scénáře a seznamy fungují", () => {
    const e = env();
    for (const [name, input] of [["get_financial_overview", {}], ["spending_by_category", { date_from: "2026-10-01", date_to: "2026-10-31" }], ["monthly_history", { months: 3 }], ["check_affordability", { price_czk: 9990 }], ["what_if", { kind: "installments", amount_czk: 15000, installments: 10 }], ["forecast", { months: 3 }], ["insights", {}], ["list_records", { what: "recurring_payments" }]] as const) {
      const r = runTool(name, input, e);
      expect(r.ok, name).toBe(true);
      expect(JSON.stringify(r)).not.toContain("NaN");
    }
  });
});

describe("AI chat smyčka", () => {
  const fake = (replies: object[]): StreamingClient & { calls: unknown[] } => {
    const calls: unknown[] = [];
    return {
      calls,
      beta: { messages: { stream: (params) => {
        calls.push(JSON.parse(JSON.stringify(params)));
        const msg = replies.shift() as { content: { type: string; text?: string }[] };
        const handlers: ((d: string) => void)[] = [];
        return {
          on: (_: "text", cb: (d: string) => void) => { handlers.push(cb); },
          finalMessage: async () => { for (const b of msg.content) if (b.type === "text") handlers.forEach((h) => h(b.text!)); return msg as never; },
        };
      } } },
    };
  };

  it("zavolá nástroj, vrátí výsledek modelu a streamuje text", async () => {
    const client = fake([
      { stop_reason: "tool_use", content: [{ type: "tool_use", id: "tu1", name: "propose_transaction", input: { type: "expense", amount_czk: 250, description: "Albert", category: null, date: null, payment_method: "card" } }] },
      { stop_reason: "end_turn", content: [{ type: "text", text: "Připravil jsem návrh, potvrďte ho." }] },
    ]);
    const e = env();
    const events = [];
    for await (const ev of runChat(client, e, "sys", [{ role: "user", content: "zapiš 250 albert" }])) events.push(ev);
    expect(events.map((x) => x.t)).toEqual(["status", "draft", "text", "done"]);
    const second = client.calls[1] as { messages: { role: string; content: { type: string; tool_use_id?: string }[] }[] };
    expect(second.messages.at(-1)?.content[0]).toMatchObject({ type: "tool_result", tool_use_id: "tu1" });
    expect((client.calls[0] as { model: string }).model).toBe("claude-opus-5-5");
  });

  it("odmítnutí ukončí odpověď slušně", async () => {
    const events = [];
    for await (const ev of runChat(fake([{ stop_reason: "refusal", content: [] }]), env(), "sys", [{ role: "user", content: "x" }])) events.push(ev);
    expect(events.at(-2)).toMatchObject({ t: "text" });
    expect(events.at(-1)).toEqual({ t: "done" });
  });
});
