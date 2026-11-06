import { describe, expect, it } from "vitest";
import { plan } from "@/lib/finance/planner";
import { checkAffordability } from "@/lib/finance/affordability";
import { goalProgress } from "@/lib/finance/goals";
import type { SavingsGoal } from "@/lib/db/types";

const base = {
  liquidBalance: 5_000_000,
  reservedOnLiquid: 1_000_000,
  obligations: 1_500_000,
  foodRemaining: 800_000,
  otherBudgetsRemaining: 200_000,
  safetyBuffer: 500_000,
  savingsPlanRemaining: 300_000,
  expectedIncome: 3_000_000,
};

describe("plánovač", () => {
  it("nikdy nezapočítá očekávané příjmy jako dostupné", () => {
    const r = plan(base);
    expect(r.available).toBe(4_000_000);
    expect(r.mustKeep).toBe(4_000_000); // 10k rezervováno + 15k + 8k + 2k + 5k
    expect(r.canSave).toBe(1_000_000);
    expect(r.safeToSpend).toBe(700_000);
    expect(r.needToEarn).toBe(0);
    expect(r.safeToSpendIfIncomeArrives).toBe(3_700_000);
    expect(plan({ ...base, expectedIncome: 0 }).safeToSpend).toBe(r.safeToSpend);
  });

  it("spočítá, kolik chybí", () => {
    const r = plan({ ...base, liquidBalance: 3_000_000 });
    expect(r.safeToSpend).toBe(0);
    expect(r.needToEarn).toBe(1_300_000); // dostupných 20k, potřeba 30k závazky+rozpočty+rezerva + 3k spoření
    expect(r.afterObligations).toBe(500_000);
  });
});

describe("dostupnost nákupu", () => {
  it("vejde se", () => {
    expect(checkAffordability({ price: 500_000, safeToSpend: 700_000, monthlySurplus: 100_000, today: "2026-11-06" }).affordable).toBe(true);
  });
  it("sedačka za 15 000 Kč", () => {
    const r = checkAffordability({ price: 1_500_000, safeToSpend: 700_000, monthlySurplus: 400_000, today: "2026-11-06" });
    expect(r.affordable).toBe(false);
    expect(r.shortfall).toBe(800_000);
    expect(r.monthsNeeded).toBe(2);
    expect(r.affordableFrom).toBe("2027-01-01");
  });
  it("bez přebytku nelze odhadnout termín", () => {
    expect(checkAffordability({ price: 1_500_000, safeToSpend: 0, monthlySurplus: null, today: "2026-11-06" }).affordableFrom).toBeNull();
  });
});

describe("spořicí cíle", () => {
  const goal: SavingsGoal = {
    id: "g", household_id: "h", name: "Dovolená", kind: "vacation", target_amount: 3_000_000, target_date: "2027-04-30",
    monthly_contribution: null, account_id: null, color: "#000", priority: 1, status: "active", note: null, created_at: "",
  };
  it("spočítá potřebný měsíční vklad", () => {
    const p = goalProgress(goal, [
      { id: "1", household_id: "h", goal_id: "g", amount: 600_000, date: "2026-10-10", note: null, created_at: "" },
      { id: "2", household_id: "h", goal_id: "g", amount: 100_000, date: "2026-11-02", note: null, created_at: "" },
    ], "2026-11-06");
    // listopad–duben = 6 měsíců, na začátku listopadu zbývalo 24 000 Kč → 4 000 Kč/měs.
    expect(p.monthsLeft).toBe(6);
    expect(p.requiredMonthly).toBe(400_000);
    expect(p.remainingThisMonth).toBe(300_000);
    expect(p.saved).toBe(700_000);
    expect(p.percent).toBe(23.3);
  });
  it("zaokrouhluje nahoru", () => {
    const p = goalProgress({ ...goal, target_amount: 1_000_000, target_date: "2027-01-15" }, [], "2026-11-06");
    expect(p.requiredMonthly).toBe(333_334);
  });
});
