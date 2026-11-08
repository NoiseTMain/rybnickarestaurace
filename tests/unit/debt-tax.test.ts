import { describe, expect, it } from "vitest";
import { debtPlan } from "@/lib/finance/debt-plan";
import { osvcTax } from "@/lib/finance/tax-cz";

const debts = [
  { id: "a", name: "Kreditka", balance: 3_000_000, rate: 20, min_payment: 150_000 },
  { id: "b", name: "Půjčka", balance: 1_000_000, rate: 8, min_payment: 100_000 },
];

describe("plán splacení dluhů", () => {
  it("lavina je levnější než sněhová koule, koule splatí nejmenší dluh první", () => {
    const av = debtPlan(debts, 200_000, "avalanche");
    const sb = debtPlan(debts, 200_000, "snowball");
    expect(av.impossible).toBe(false);
    expect(av.totalInterest).toBeLessThanOrEqual(sb.totalInterest);
    expect(sb.payoff[0].id).toBe("b");
    expect(av.timeline.at(-1)).toBe(0);
    expect(av.totalPaid).toBe(4_000_000 + av.totalInterest);
  });
  it("bez úroku = prostý součet / splátka", () => {
    const r = debtPlan([{ id: "x", name: "X", balance: 1_000_000, rate: 0, min_payment: 100_000 }], 0, "avalanche");
    expect(r.months).toBe(10);
    expect(r.totalInterest).toBe(0);
  });
  it("splátka nepokryje úrok → nesplatitelné", () => {
    expect(debtPlan([{ id: "x", name: "X", balance: 10_000_000, rate: 24, min_payment: 100_000 }], 0, "avalanche").impossible).toBe(true);
  });
});

describe("daňový pomocník OSVČ", () => {
  it("paušál 60 %, příjem 1 000 000 Kč", () => {
    const r = osvcTax({ income: 100_000_000, realExpenses: 0, expenseRate: 60 });
    expect(r.expenses).toBe(600_000);
    expect(r.profit).toBe(400_000);
    expect(r.taxBeforeCredits).toBe(60_000);
    expect(r.tax).toBe(60_000 - 30_840);
    expect(r.social).toBe(Math.max(Math.round(400_000 * 0.55 * 0.292), 5_720 * 12));
    expect(r.health).toBe(Math.max(27_000, 3_306 * 12));
  });
  it("nízký příjem → minimální pojistné, žádná daň, bonus na dítě", () => {
    const r = osvcTax({ income: 20_000_000, realExpenses: 0, expenseRate: 60, childCredit: 15_204 });
    expect(r.tax).toBe(0);
    expect(r.childBonus).toBe(15_204);
    expect(r.social).toBe(5_720 * 12);
  });
  it("strop paušálu a 23% sazba", () => {
    const r = osvcTax({ income: 500_000_000, realExpenses: 0, expenseRate: 60 });
    expect(r.expenses).toBe(1_200_000);
    expect(r.taxBeforeCredits).toBe(Math.round(36 * 48_967 * 0.15 + (3_800_000 - 36 * 48_967) * 0.23));
  });
});
