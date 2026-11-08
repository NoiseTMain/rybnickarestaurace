import { describe, expect, it } from "vitest";
import { carCost, futureValue, inflation, monthlyForTarget, monthsToAfford, mortgage, retirementNeed } from "@/lib/calculators";

describe("kalkulačky", () => {
  it("hypotéka 4 mil, 5 %, 30 let ≈ 21 473 Kč", () => {
    const m = mortgage(4_000_000, 5, 30);
    expect(Math.round(m.payment)).toBe(21_473);
    expect(m.months).toBe(360);
    expect(mortgage(120_000, 0, 1).payment).toBe(10_000);
  });
  it("spoření a cíl jsou inverzní", () => {
    const fv = futureValue(10_000, 2_000, 6, 10).value;
    expect(Math.round(monthlyForTarget(fv, 10_000, 6, 10))).toBe(2_000);
    expect(futureValue(0, 1000, 0, 2).value).toBe(24_000);
  });
  it("kdy si můžu dovolit", () => {
    expect(monthsToAfford(30_000, 5_000, 5_000)).toBe(5);
    expect(monthsToAfford(30_000, 40_000, 0)).toBe(0);
    expect(monthsToAfford(30_000, 0, 0)).toBeNull();
  });
  it("penze, auto, inflace", () => {
    expect(retirementNeed(10_000, 10, 0)).toBe(1_200_000);
    const c = carCost({ price: 500_000, years: 5, resalePct: 40, kmPerYear: 15_000, consumption: 6, fuelPrice: 38, insurance: 8_000, service: 6_000, other: 2_000 });
    expect(Math.round(c.depreciation)).toBe(60_000);
    expect(Math.round(c.fuel)).toBe(34_200);
    expect(Math.round(c.yearly)).toBe(110_200);
    expect(Math.round(inflation(100_000, 3, 10).realValue)).toBe(74_409);
  });
});

import { recordingStreak } from "@/lib/finance/badges";
describe("série zápisů", () => {
  it("počítá dny po sobě a nejlepší sérii", () => {
    const at = (d: string) => ({ created_at: `${d}T10:00:00Z` });
    const s = recordingStreak([at("2026-11-01"), at("2026-11-02"), at("2026-11-03"), at("2026-11-06"), at("2026-11-07")], "2026-11-08");
    expect(s).toEqual({ current: 2, best: 3, todayDone: false });
  });
});
