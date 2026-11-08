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

import { evaluateChallenge, suggestChallenges } from "@/lib/finance/challenges";
describe("výzvy", () => {
  const cats = [{ id: "r", name: "Restaurace", kind: "expense" }, { id: "f", name: "Potraviny", kind: "expense" }] as never[];
  const tx = (date: string, amount: number, category_id: string) => ({ id: date + amount, status: "posted", type: "expense", date, amount, category_id, recurring_payment_id: null, created_at: `${date}T10:00:00Z` }) as never;
  const txs = [tx("2026-10-05", 100_000, "r"), tx("2026-10-06", 300_000, "f"), tx("2026-11-02", 30_000, "r"), tx("2026-11-03", 200_000, "f")];
  const d = { txs, categories: cats, contributions: [], today: "2026-11-08" };
  it("jídlo venku s limitem", () => {
    const s = evaluateChallenge({ kind: "no_takeout", month: "2026-11", target: 50_000, category_id: null }, d);
    expect(s).toMatchObject({ value: 30_000, status: "active", percent: 60 });
    expect(evaluateChallenge({ kind: "no_takeout", month: "2026-11", target: 0, category_id: null }, d).status).toBe("failed");
  });
  it("dny bez utrácení a škrt v kategorii", () => {
    expect(evaluateChallenge({ kind: "no_spend_days", month: "2026-11", target: 5, category_id: null }, d)).toMatchObject({ value: 6, status: "done" });
    const cut = evaluateChallenge({ kind: "category_cut", month: "2026-11", target: 20, category_id: "f" }, d);
    expect(cut).toMatchObject({ target: 240_000, value: 200_000, status: "active" });
  });
  it("návrhy z minulého měsíce", () => {
    const s = suggestChallenges(d, [{ kind: "daily_log" }]);
    expect(s.find((x) => x.kind === "no_takeout")?.target).toBe(50_000);
    expect(s.find((x) => x.kind === "category_cut")?.category_id).toBe("f");
    expect(s.some((x) => x.kind === "daily_log")).toBe(false);
  });
});
