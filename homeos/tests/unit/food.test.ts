import { describe, expect, it } from "vitest";
import { computeFoodBudget } from "@/lib/finance/food";

describe("rozpočet na jídlo", () => {
  it("příklad ze zadání: 12 000 Kč v listopadu (30 dní)", () => {
    const r = computeFoodBudget({ budget: 1_200_000, spent: 0, today: "2026-11-01" });
    expect(r.plannedDaily).toBe(40_000); // 400 Kč/den
    expect(r.plannedWeekly).toBe(280_000); // 2 800 Kč/týden
    expect(r.dailyLimit).toBe(40_000);
    expect(r.daysLeft).toBe(30);
    expect(r.alerts).toHaveLength(0);
  });

  it("po vyšší útratě přepočítá zbývající denní limit", () => {
    // 6. 11.: utraceno 4 000 Kč, zbývá 8 000 Kč na 25 dní (včetně dneška)
    const r = computeFoodBudget({ budget: 1_200_000, spent: 400_000, today: "2026-11-06" });
    expect(r.remaining).toBe(800_000);
    expect(r.daysLeft).toBe(25);
    expect(r.dailyLimit).toBe(32_000);
    expect(r.expectedByNow).toBe(240_000);
    expect(r.vsPlan).toBe(-160_000);
    expect(r.avgDaily).toBe(66_667);
    expect(r.alerts.map((a) => a.code)).toEqual(["too_fast", "wont_last"]);
    // týden 6.–8. 11. = 3 dny ze 25
    expect(r.daysLeftInWeek).toBe(3);
    expect(r.weekLimit).toBe(96_000);
  });

  it("blížíme se k limitu a překročení", () => {
    expect(computeFoodBudget({ budget: 1_000_000, spent: 900_000, today: "2026-11-29" }).alerts.map((a) => a.code)).toContain("near_limit");
    const over = computeFoodBudget({ budget: 1_000_000, spent: 1_050_000, today: "2026-11-20" });
    expect(over.status).toBe("over");
    expect(over.dailyLimit).toBe(0);
    expect(over.alerts[0].code).toBe("over_limit");
  });

  it("pod plánem bez upozornění", () => {
    const r = computeFoodBudget({ budget: 1_200_000, spent: 100_000, today: "2026-11-10" });
    expect(r.alerts).toHaveLength(0);
    expect(r.status).toBe("ok");
    expect(r.vsPlan).toBe(300_000);
  });
});
