import { describe, expect, it } from "vitest";
import { connectionLinks, effectiveExpenses, fuelCost, haversineKm, summarizeTrip, tripStatus } from "@/lib/finance/travel";
import { parseCnbRates } from "@/lib/travel-services";
import type { Trip, TripExpense, TripLeg } from "@/lib/db/types";

const trip: Trip = { id: "t", household_id: "h", name: "Vídeň", destination: "Vídeň", country: "Rakousko", start_date: "2026-12-10", end_date: "2026-12-13", travelers: 2, budget: 1_000_000, currency: "EUR", lat: null, lon: null, note: null, created_at: "" };
const leg = (p: Partial<TripLeg>): TripLeg => ({ id: "l", household_id: "h", trip_id: "t", mode: "train", carrier: "RegioJet", from_place: "Praha", to_place: "Vídeň", depart_date: null, depart_time: null, arrive_date: null, arrive_time: null, price: null, distance_km: null, booking_ref: null, url: null, note: null, from_lat: null, from_lon: null, to_lat: null, to_lon: null, sort: 0, created_at: "", ...p });
const ex = (p: Partial<TripExpense>): TripExpense => ({ id: Math.random().toString(), household_id: "h", trip_id: "t", leg_id: null, transaction_id: null, status: "paid", kind: "food", description: "x", place: null, date: "2026-12-10", amount: 0, currency: "CZK", amount_original: null, rate: null, created_at: "", ...p });

describe("cestování", () => {
  it("stav cesty podle data", () => {
    expect(tripStatus(trip, "2026-12-01")).toBe("upcoming");
    expect(tripStatus(trip, "2026-12-10")).toBe("ongoing");
    expect(tripStatus(trip, "2026-12-13")).toBe("ongoing");
    expect(tripStatus(trip, "2026-12-14")).toBe("finished");
    expect(tripStatus({ start_date: null, end_date: null }, "2026-12-14")).toBe("idea");
  });

  it("rozpočet: zaplaceno, plán, nezaplacená doprava a peníze na den", () => {
    const legs = [leg({ id: "l1", price: 80_000 }), leg({ id: "l2", price: 50_000, mode: "bus" })];
    const expenses = effectiveExpenses([
      ex({ leg_id: "l1", kind: "transport", amount: 80_000 }),
      ex({ kind: "accommodation", amount: 450_000, place: "Hotel" }),
      ex({ status: "planned", kind: "activities", amount: 20_000 }),
    ], []);
    const s = summarizeTrip(trip, legs, expenses, "2026-12-01");
    expect(s.paid).toBe(530_000);
    expect(s.unpaidLegs).toBe(50_000);
    expect(s.plannedExpenses).toBe(20_000);
    expect(s.total).toBe(600_000);
    expect(s.spendingMoney).toBe(400_000);
    expect(s.days).toBe(4);
    expect(s.perDayAllowance).toBe(100_000);
    expect(s.perPerson).toBe(265_000);
    expect(s.toCover).toBe(470_000);
    expect(s.byKind[0]).toMatchObject({ kind: "accommodation", amount: 450_000 });
    // během cesty se limit počítá na zbývající dny
    expect(summarizeTrip(trip, legs, expenses, "2026-12-12").perDayAllowance).toBe(200_000);
  });

  it("výdaj se stornovanou platbou se nepočítá, propojený bere částku z platby", () => {
    const list = effectiveExpenses([ex({ transaction_id: "a", amount: 100 }), ex({ transaction_id: "b", amount: 100 })], [{ id: "a", status: "cancelled", amount: 100 }, { id: "b", status: "posted", amount: 250 }]);
    expect(list.map((e) => e.value)).toEqual([250]);
  });

  it("palivo a vzdálenost", () => {
    expect(fuelCost(1000, 6.5, 3_800)).toBe(247_000);
    expect(fuelCost(0, 6.5, 3_800)).toBe(0);
    const km = haversineKm({ lat: 50.0755, lon: 14.4378 }, { lat: 48.2083, lon: 16.3725 });
    expect(km).toBeGreaterThan(240);
    expect(km).toBeLessThan(260);
  });

  it("odkazy na spojení", () => {
    const links = connectionLinks(leg({ depart_date: "2026-12-10", depart_time: "07:04" }));
    expect(links.map((l) => l.label)).toEqual(["Trasa na mapě", "IDOS"]);
    expect(links[1].href).toContain("date=10.12.2026");
    expect(connectionLinks(leg({ mode: "plane" })).map((l) => l.label)).toContain("Google Flights");
  });

  it("parser kurzovního lístku ČNB", () => {
    const txt = "06.11.2026 #216\nzemě|měna|množství|kód|kurz\nEMU|euro|1|EUR|25,120\nMaďarsko|forint|100|HUF|6,512\nJaponsko|jen|100|JPY|15,401\n";
    const r = parseCnbRates(txt);
    expect(r.date).toBe("2026-11-06");
    expect(r.rates.EUR).toBeCloseTo(25.12);
    expect(r.rates.HUF).toBeCloseTo(0.06512);
  });
});

import { travelCommitments } from "@/lib/finance/travel";
import { computeSnapshot, type FinanceData } from "@/lib/finance/snapshot";
import type { Account } from "@/lib/db/types";

describe("cestování v plánovači", () => {
  const t = (p: Partial<Trip>): Trip => ({ ...trip, created_at: "2026-11-01T10:00:00Z", ...p });

  it("platby splatné tento měsíc jsou závazky, zbytek se rezervuje postupně do odjezdu", () => {
    // založeno v listopadu, odjezd v lednu → 3 měsíce; listopad = 1/3 rezervy
    const tr = t({ start_date: "2027-01-10", end_date: "2027-01-14", budget: 3_000_000 });
    const legs = [leg({ id: "l1", price: 120_000, depart_date: "2027-01-10" })];
    const ex = effectiveExpenses([
      ex_({ status: "planned", kind: "accommodation", amount: 600_000, date: "2026-11-20", description: "Záloha" }),
      ex_({ status: "paid", kind: "accommodation", amount: 300_000 }),
    ], []);
    const s = summarizeTrip(tr, legs, ex, "2026-11-07");
    expect(s.toCover).toBe(2_700_000);
    expect(s.dueThisMonth).toBe(600_000);
    expect(s.reserveNow).toBe(700_000); // (2 700 000 − 600 000) / 3
    expect(s.monthsLeft).toBe(2);
    expect(s.monthlyAdd).toBe(700_000);
    // v měsíci odjezdu je rezervováno vše
    expect(summarizeTrip(tr, legs, ex, "2027-01-02").reserveNow).toBe(s.toCover - 0 - 120_000 /* jízdenka je v lednu závazek */ - 600_000 /* záloha po splatnosti = závazek */);
    const c = travelCommitments({ trips: [tr], legs, expenses: [] }, [], "2026-11-07", 45);
    expect(c.obligations.map((o) => [o.kind, o.date, o.amount])).toEqual([["trip", "2027-01-10", 120_000]]);
  });

  it("probíhající cesta drží stranou zbytek peněz na útratu", () => {
    const s = summarizeTrip(trip, [], effectiveExpenses([ex_({ amount: 400_000 })], []), "2026-12-11");
    expect(s.reserveNow).toBe(600_000);
    expect(s.monthlyAdd).toBeNull();
  });

  it("snapshot: cesty snižují Volné k utracení, očekávané příjmy se nemění", () => {
    const acc: Account = { id: "a", household_id: "h", name: "Účet", kind: "checking", opening_balance: 5_000_000, opening_date: "2026-11-01", include_in_available: true, member_id: null, is_active: true, sort: 0, created_at: "" };
    const base: FinanceData = { settings: null, members: [], accounts: [acc], categories: [], transactions: [], recurring: [], incomeSources: [], budgets: [], goals: [], contributions: [], invoices: [], payouts: [], shifts: [], purchases: [], marks: [] };
    const tr = t({ start_date: "2026-12-10", end_date: "2026-12-13", budget: 1_000_000 });
    const withTrip = { ...base, travel: { trips: [tr], legs: [leg({ id: "l1", trip_id: "t", price: 100_000, depart_date: "2026-11-20" })], expenses: [] } };
    const a = computeSnapshot(base, "2026-11-07");
    const b = computeSnapshot(withTrip, "2026-11-07");
    expect(b.unpaidObligationsTotal - a.unpaidObligationsTotal).toBe(100_000);
    expect(b.upcoming.some((o) => o.kind === "trip")).toBe(true);
    expect(b.travel.reserve).toBe(450_000); // (1 000 000 − 100 000) / 2 měsíce
    expect(a.planner.safeToSpend - b.planner.safeToSpend).toBe(550_000);
    expect(b.expectedIncomeTotal).toBe(a.expectedIncomeTotal);
    expect(b.planner.available).toBe(a.planner.available);
  });
});

function ex_(p: Partial<TripExpense>): TripExpense {
  return ex(p);
}
