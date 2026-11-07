import type { Cents } from "@/lib/money";
import { divFloor, sum } from "@/lib/money";
import { diffDays, monthsBetween } from "@/lib/dates";
import type { Transaction, Trip, TripExpense, TripExpenseKind, TripLeg, TripLegMode } from "@/lib/db/types";

/** Cestování: stav cesty, rozpočet, kolik lze utratit na místě, souhrny po návratu. */

export const MODE_LABEL: Record<TripLegMode, string> = {
  train: "Vlak", bus: "Autobus", car: "Auto", plane: "Letadlo", ferry: "Trajekt", transit: "MHD", bike: "Kolo", other: "Jiné",
};

export const KIND_LABEL: Record<TripExpenseKind, string> = {
  transport: "Doprava", accommodation: "Ubytování", food: "Jídlo a pití", activities: "Výlety a vstupy", shopping: "Nákupy a suvenýry", other: "Ostatní",
};

export const CARRIERS: Partial<Record<TripLegMode, string[]>> = {
  train: ["České dráhy", "RegioJet", "Leo Express", "Arriva", "GW Train Regio", "ÖBB", "Deutsche Bahn", "ŽSSK", "PKP Intercity", "MÁV", "Trenitalia", "SNCF"],
  bus: ["RegioJet", "FlixBus", "Arriva", "Leo Express", "ČSAD", "BlaBlaCar Bus", "Eurolines", "Student Agency"],
  plane: ["Smartwings", "Ryanair", "Wizz Air", "easyJet", "Lufthansa", "Austrian", "KLM", "Air France", "Turkish Airlines", "Emirates", "Eurowings", "Vueling"],
  ferry: ["Jadrolinija", "Blue Star Ferries", "Moby", "Tirrenia", "Stena Line"],
  car: ["Vlastní auto", "Půjčené auto", "BlaBlaCar (spolujízda)"],
};

export const CURRENCIES = ["CZK", "EUR", "USD", "GBP", "PLN", "HUF", "CHF", "HRK", "RON", "BGN", "DKK", "SEK", "NOK", "TRY", "JPY", "THB", "AED"] as const;

export type TripStatus = "idea" | "upcoming" | "ongoing" | "finished";

export const STATUS_LABEL: Record<TripStatus, string> = { idea: "Nápad", upcoming: "Chystá se", ongoing: "Právě probíhá", finished: "Hotovo" };

export function tripStatus(t: Pick<Trip, "start_date" | "end_date">, today: string): TripStatus {
  if (!t.start_date) return "idea";
  const end = t.end_date ?? t.start_date;
  if (today < t.start_date) return "upcoming";
  if (today > end) return "finished";
  return "ongoing";
}

/** Počet dní cesty (včetně prvního i posledního). */
export function tripDays(t: Pick<Trip, "start_date" | "end_date">): number | null {
  if (!t.start_date) return null;
  return diffDays(t.start_date, t.end_date ?? t.start_date) + 1;
}

/** Náklad na palivo: km × spotřeba (l/100 km) × cena za litr (haléře). */
export function fuelCost(km: number, litresPer100: number, pricePerLitre: Cents): Cents {
  if (!(km > 0) || !(litresPer100 > 0) || !(pricePerLitre > 0)) return 0;
  return Math.round((km * litresPer100 * pricePerLitre) / 100);
}

/** Vzdušná vzdálenost v km (pro odhad, když chybí zadaná). */
export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const R = 6371;
  const r = (x: number) => (x * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

export interface EffectiveExpense extends TripExpense {
  /** Skutečná částka – u výdaje propojeného s transakcí se bere z transakce. */
  value: Cents;
}

/** Výdaje cesty: výdaj, jehož transakce byla stornována, se nepočítá. */
export function effectiveExpenses(expenses: TripExpense[], transactions: Pick<Transaction, "id" | "status" | "amount">[]): EffectiveExpense[] {
  const tx = new Map(transactions.map((t) => [t.id, t]));
  const out: EffectiveExpense[] = [];
  for (const e of expenses) {
    const t = e.transaction_id ? tx.get(e.transaction_id) : null;
    if (t && t.status !== "posted") continue;
    out.push({ ...e, value: t ? t.amount : e.amount });
  }
  return out;
}

export interface TripSummary {
  status: TripStatus;
  days: number | null;
  daysUntil: number | null;
  daysLeft: number | null;
  paid: Cents;
  plannedExpenses: Cents;
  unpaidLegs: Cents;
  /** Celkem zaplaceno + naplánováno. */
  total: Cents;
  budget: Cents | null;
  /** Rozpočet − vše zaplacené a naplánované (peníze „na útratu“ na místě). */
  spendingMoney: Cents | null;
  /** Kolik lze utratit za den (na zbývající dny cesty, nebo na celou cestu, když ještě nezačala). */
  perDayAllowance: Cents | null;
  overBudget: boolean;
  byKind: { kind: TripExpenseKind; label: string; amount: Cents }[];
  byDay: { date: string; amount: Cents }[];
  byPlace: { place: string; amount: Cents; count: number }[];
  byCurrency: { currency: string; original: number; czk: Cents }[];
  perDayActual: Cents | null;
  perPerson: Cents;
  top: EffectiveExpense[];
  legsByMode: { mode: TripLegMode; label: string; count: number; price: Cents; km: number }[];
  carriers: string[];
  distanceKm: number;
  /** Do odjezdu: kolik ještě zbývá zaplatit/našetřit a kolik měsíčně. */
  toCover: Cents;
  monthsToSave: number | null;
  monthlySaving: Cents | null;
}

export function summarizeTrip(trip: Trip, legs: TripLeg[], expenses: EffectiveExpense[], today: string): TripSummary {
  const status = tripStatus(trip, today);
  const days = tripDays(trip);
  const paidList = expenses.filter((e) => e.status === "paid");
  const paid = sum(paidList, (e) => e.value);
  const plannedExpenses = sum(expenses.filter((e) => e.status === "planned"), (e) => e.value);
  const paidLegIds = new Set(expenses.map((e) => e.leg_id).filter(Boolean));
  const unpaidLegs = sum(legs.filter((l) => !paidLegIds.has(l.id)), (l) => l.price ?? 0);
  const total = paid + plannedExpenses + unpaidLegs;
  const budget = trip.budget;
  const spendingMoney = budget == null ? null : budget - total;
  const end = trip.end_date ?? trip.start_date;
  const daysLeft = status === "ongoing" && end ? diffDays(today, end) + 1 : status === "upcoming" ? days : status === "finished" ? 0 : null;
  const perDayAllowance = spendingMoney == null || !daysLeft ? null : divFloor(Math.max(0, spendingMoney), daysLeft);

  const kinds = new Map<TripExpenseKind, Cents>();
  for (const e of paidList) kinds.set(e.kind, (kinds.get(e.kind) ?? 0) + e.value);
  const days_ = new Map<string, Cents>();
  for (const e of paidList) if (e.date) days_.set(e.date, (days_.get(e.date) ?? 0) + e.value);
  const places = new Map<string, { amount: Cents; count: number }>();
  for (const e of paidList) {
    const p = e.place?.trim() || "Neuvedeno";
    const cur = places.get(p) ?? { amount: 0, count: 0 };
    places.set(p, { amount: cur.amount + e.value, count: cur.count + 1 });
  }
  const cur = new Map<string, { original: number; czk: Cents }>();
  for (const e of paidList) {
    const c = cur.get(e.currency) ?? { original: 0, czk: 0 };
    cur.set(e.currency, { original: c.original + (e.amount_original ?? (e.currency === "CZK" ? e.value : 0)), czk: c.czk + e.value });
  }
  const modes = new Map<TripLegMode, { count: number; price: Cents; km: number }>();
  for (const l of legs) {
    const m = modes.get(l.mode) ?? { count: 0, price: 0, km: 0 };
    const km = l.distance_km ?? (l.from_lat != null && l.from_lon != null && l.to_lat != null && l.to_lon != null ? haversineKm({ lat: l.from_lat, lon: l.from_lon }, { lat: l.to_lat, lon: l.to_lon }) : 0);
    modes.set(l.mode, { count: m.count + 1, price: m.price + (l.price ?? 0), km: m.km + km });
  }
  const daysUntil = status === "upcoming" && trip.start_date ? diffDays(today, trip.start_date) : null;
  const target = Math.max(budget ?? 0, total);
  const toCover = Math.max(0, target - paid);
  // měsíců do odjezdu (alespoň 1, když se odjíždí ještě tento měsíc)
  const monthsToSave = status === "upcoming" && trip.start_date ? Math.max(1, monthsBetween(today, trip.start_date)) : null;
  return {
    status, days, daysUntil, daysLeft, paid, plannedExpenses, unpaidLegs, total, budget, spendingMoney, perDayAllowance,
    overBudget: budget != null && total > budget,
    byKind: [...kinds.entries()].sort((a, b) => b[1] - a[1]).map(([kind, amount]) => ({ kind, label: KIND_LABEL[kind], amount })),
    byDay: [...days_.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, amount]) => ({ date, amount })),
    byPlace: [...places.entries()].sort((a, b) => b[1].amount - a[1].amount).map(([place, v]) => ({ place, ...v })),
    byCurrency: [...cur.entries()].map(([currency, v]) => ({ currency, ...v })),
    perDayActual: days ? divFloor(paid, days) : null,
    perPerson: divFloor(paid, Math.max(1, trip.travelers)),
    top: [...paidList].sort((a, b) => b.value - a.value).slice(0, 5),
    legsByMode: [...modes.entries()].map(([mode, v]) => ({ mode, label: MODE_LABEL[mode], ...v })),
    carriers: [...new Set(legs.map((l) => l.carrier).filter((c): c is string => Boolean(c)))],
    distanceKm: [...modes.values()].reduce((a, m) => a + m.km, 0),
    toCover,
    monthsToSave,
    monthlySaving: monthsToSave && toCover ? Math.ceil(toCover / monthsToSave) : null,
  };
}


// ---------------------------------------------------------------------------
// Odkazy: vyhledání spojení a trasy (bez API klíčů)

const enc = encodeURIComponent;
const czDate = (d: string | null) => (d ? `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}` : "");

export function connectionLinks(l: Pick<TripLeg, "mode" | "from_place" | "to_place" | "depart_date" | "depart_time">): { label: string; href: string }[] {
  const out: { label: string; href: string }[] = [];
  const gmMode = l.mode === "car" ? "driving" : l.mode === "bike" ? "bicycling" : "transit";
  out.push({ label: "Trasa na mapě", href: `https://www.google.com/maps/dir/?api=1&origin=${enc(l.from_place)}&destination=${enc(l.to_place)}&travelmode=${gmMode}` });
  if (l.mode === "car" || l.mode === "bike") {
    out.push({ label: "Mapy.cz", href: `https://mapy.cz/zakladni?q=${enc(`${l.from_place} ${l.to_place}`)}` });
  }
  if (l.mode === "train" || l.mode === "bus" || l.mode === "transit") {
    out.push({ label: "IDOS", href: `https://idos.cz/vlakyautobusy/spojeni/?f=${enc(l.from_place)}&t=${enc(l.to_place)}${l.depart_date ? `&date=${czDate(l.depart_date)}` : ""}${l.depart_time ? `&time=${enc(l.depart_time)}` : ""}` });
  }
  if (l.mode === "plane") {
    out.push({ label: "Google Flights", href: `https://www.google.com/travel/flights?q=${enc(`Flights from ${l.from_place} to ${l.to_place}${l.depart_date ? ` on ${l.depart_date}` : ""}`)}` });
  }
  return out;
}

const CARRIER_SITES: Record<string, string> = {
  "České dráhy": "https://www.cd.cz", RegioJet: "https://regiojet.cz", "Leo Express": "https://www.leoexpress.com", FlixBus: "https://www.flixbus.cz",
  Arriva: "https://arriva.cz", "ÖBB": "https://www.oebb.at", "Deutsche Bahn": "https://www.bahn.de", Smartwings: "https://www.smartwings.com",
  Ryanair: "https://www.ryanair.com", "Wizz Air": "https://wizzair.com", easyJet: "https://www.easyjet.com",
};
export const carrierSite = (c: string | null) => (c ? CARRIER_SITES[c] ?? null : null);
