import { describe, expect, it } from "vitest";
import { checklistTemplate, decodePolyline, effectiveExpenses, guessKind, settle, suggestTripTransactions, summarizeTrip, wallets } from "@/lib/finance/travel";
import { travelAlerts } from "@/lib/finance/travel-alerts";
import type { Transaction, Trip, TripCashMove, TripExpense, TripPerson } from "@/lib/db/types";

const trip: Trip = { id: "t", household_id: "h", name: "Vídeň", destination: "Vídeň", country: "Rakousko", start_date: "2026-12-10", end_date: "2026-12-12", travelers: 2, budget: 900_000, currency: "EUR", lat: null, lon: null, note: null, goal_id: null, created_at: "2026-11-01T00:00:00Z" };
const person = (id: string, name: string): TripPerson => ({ id, household_id: "h", trip_id: "t", name, member_id: null, sort: 0, created_at: "" });
let n = 0;
const ex = (p: Partial<TripExpense>): TripExpense => ({ id: `e${++n}`, household_id: "h", trip_id: "t", leg_id: null, transaction_id: null, status: "paid", kind: "food", description: "x", place: null, date: "2026-12-10", amount: 0, currency: "CZK", amount_original: null, rate: null, paid_by: null, split_among: null, from_cash: false, document_id: null, created_at: "", ...p });
const cash = (p: Partial<TripCashMove>): TripCashMove => ({ id: `c${++n}`, household_id: "h", trip_id: "t", kind: "buy", currency: "EUR", amount_original: 10_000, amount: 252_000, rate: 25.2, date: "2026-12-10", transaction_id: null, note: null, created_at: "", ...p });

describe("vyrovnání mezi účastníky", () => {
  const A = person("a", "Petra"), B = person("b", "Tomáš"), C = person("c", "Eva");
  it("rovným dílem a s minimem převodů", () => {
    const s = settle([A, B, C], effectiveExpenses([ex({ paid_by: "a", amount: 90_000 }), ex({ paid_by: "b", amount: 30_000 })], []));
    expect(s.balances.map((b) => b.balance)).toEqual([50_000, -10_000, -40_000]);
    expect(s.transfers).toEqual([
      { from: "c", to: "a", fromName: "Eva", toName: "Petra", amount: 40_000 },
      { from: "b", to: "a", fromName: "Tomáš", toName: "Petra", amount: 10_000 },
    ]);
  });
  it("výdaj jen za některé, haléře beze ztráty, bez plátce mimo vyrovnání", () => {
    const s = settle([A, B, C], effectiveExpenses([ex({ paid_by: "a", amount: 100, split_among: ["a", "b", "c"] }), ex({ paid_by: "b", amount: 5_000, split_among: ["c"] }), ex({ amount: 7_000 })], []));
    expect(s.balances.reduce((x, b) => x + b.share, 0)).toBe(5_100);
    expect(s.balances.find((b) => b.personId === "c")!.share).toBe(5_033);
    expect(s.unassigned).toBe(7_000);
  });
});

describe("hotovost v cizí měně", () => {
  it("peněženka: koupeno, utraceno, zbývá a průměrný kurz", () => {
    const w = wallets([cash({}), cash({ amount_original: 10_000, amount: 254_000, rate: 25.4 })], [ex({ from_cash: true, currency: "EUR", amount_original: 4_000 }), ex({ currency: "EUR", amount_original: 9_999 })]);
    expect(w[0]).toMatchObject({ currency: "EUR", bought: 20_000, boughtCzk: 506_000, spent: 4_000, left: 16_000 });
    expect(w[0].avgRate).toBeCloseTo(25.3);
    expect(w[0].leftCzk).toBe(404_800);
  });
  it("nevyužitá hotovost snižuje rezervu na cestu (už odešla z účtu)", () => {
    const e = effectiveExpenses([], []);
    const without = summarizeTrip(trip, [], e, "2026-11-08");
    const withCash = summarizeTrip(trip, [], e, "2026-11-08", [cash({})]);
    expect(withCash.cashLeft).toBe(252_000);
    expect(without.reserveNow - withCash.reserveNow).toBe(126_000); // polovina (2 měsíce)
  });
  it("cíl ve Spoření přebírá rezervu", () => {
    expect(summarizeTrip({ ...trip, goal_id: "g" }, [], [], "2026-11-08").reserveNow).toBe(0);
  });
});

describe("příprava a párování", () => {
  it("seznam věcí podle typu cesty", () => {
    const items = checklistTemplate({ country: "Chorvatsko", destination: "Split" }, [{ mode: "car" }]).map((i) => i.text);
    expect(items).toContain("Dálniční známky / mýto na trase");
    expect(items).toContain("Opalovací krém");
    expect(items).toContain("Kartička zdravotní pojišťovny (EHIC)");
    const usa = checklistTemplate({ country: "USA", destination: "New York" }, [{ mode: "plane" }]).map((i) => i.text);
    expect(usa).toContain("Cestovní pas (platnost aspoň 6 měsíců)");
    expect(usa).toContain("Online check-in a palubenka v mobilu");
    expect(usa).toContain("Adaptér do zásuvky");
  });
  it("navrhne platby z účtu podle místa, měny a termínu, ne nájem", () => {
    const tx = (p: Partial<Transaction>) => ({ id: p.id!, date: "2026-12-11", type: "expense" as const, status: "posted" as const, description: "", note: null, recurring_payment_id: null, invoice_id: null, payout_id: null, contribution_id: null, shopping_list_id: null, purchase_id: null, ...p });
    const r = suggestTripTransactions(trip, [
      tx({ id: "1", description: "BILLA WIEN" }), tx({ id: "2", description: "Platba kartou 23,50 EUR", date: "2026-12-08" }), tx({ id: "3", description: "Nájem", recurring_payment_id: "r" }),
      tx({ id: "4", description: "Booking.com", date: "2026-12-09" }), tx({ id: "5", description: "Lidl Praha", date: "2026-12-08" }), tx({ id: "6", description: "Vídeň hotel" }),
    ], new Set(["6"]));
    expect(r.map((x) => [x.tx.id, x.suggested])).toEqual([["2", true], ["4", true], ["1", true], ["5", false]]);
    expect(guessKind(null, "Booking.com")).toBe("accommodation");
    expect(guessKind("Restaurace", "Figlmüller")).toBe("food");
  });
  it("dekódování trasy", () => {
    expect(decodePolyline("_p~iF~ps|U_ulLnnqC_mqNvxq`@")).toEqual([[38.5, -120.2], [40.7, -120.95], [43.252, -126.453]]);
  });
});

describe("upozornění", () => {
  it("den před odjezdem a překročení denního limitu", () => {
    const data = { transactions: [], travel: { trips: [trip], legs: [], expenses: [ex({ amount: 400_000, kind: "food", date: "2026-12-11" })], checklist: [] } };
    expect(travelAlerts(data, "2026-12-09").map((a) => a.kind)).toEqual(["departure"]);
    expect(travelAlerts(data, "2026-12-11").map((a) => a.kind)).toEqual(["overspend"]);
    expect(travelAlerts(data, "2026-12-10")).toEqual([]);
  });
});
