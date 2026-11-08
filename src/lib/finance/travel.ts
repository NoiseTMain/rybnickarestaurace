import type { Cents } from "@/lib/money";
import { divFloor, sum } from "@/lib/money";
import { addDays, diffDays, endOfMonth } from "@/lib/dates";
import type { PaymentOccurrence } from "./obligations";
import type { Transaction, Trip, TripCashMove, TripChecklistItem, TripExpense, TripExpenseKind, TripLeg, TripLegMode, TripPerson, TripPlanItem, TripSettlement } from "@/lib/db/types";

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
  /** Kolik ještě cesta bude stát nad už zaplacené (do výše rozpočtu, nebo plánu, je-li vyšší). */
  toCover: Cents;
  /** Naplánované platby a jízdenky splatné do konce tohoto měsíce (počítají se jako závazky). */
  dueThisMonth: Cents;
  /** Částka, kterou plánovač teď drží stranou na tuto cestu (mimo závazky tohoto měsíce). */
  reserveNow: Cents;
  /** O kolik rezervu navýšit každý další měsíc do odjezdu. */
  monthlyAdd: Cents | null;
  /** Celých kalendářních měsíců do měsíce odjezdu. */
  monthsLeft: number | null;
  /** Nevyužitá hotovost v cizí měně přepočtená na Kč (už odečtená z účtu při výměně). */
  cashLeft: Cents;
  /** Rezervu drží cíl ve Spoření. */
  goalLinked: boolean;
}

/** Pořadové číslo kalendářního měsíce (pro počítání měsíců bez ohledu na den). */
const monthIndex = (d: string) => Number(d.slice(0, 4)) * 12 + Number(d.slice(5, 7)) - 1;

/** Termín platby: u výdaje jeho datum, jinak odjezd; u jízdenky datum odjezdu úseku, jinak odjezd. */
function dueDate(trip: Trip, own: string | null): string | null {
  return own ?? trip.start_date;
}

export function summarizeTrip(trip: Trip, legs: TripLeg[], expenses: EffectiveExpense[], today: string, cash: TripCashMove[] = []): TripSummary {
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

  // Plánovač: platby splatné do konce měsíce jsou závazky, zbytek se rezervuje postupně do odjezdu.
  const monthEnd = endOfMonth(today);
  const dueThisMonth = status === "ongoing" || status === "upcoming"
    ? sum(tripObligationItems(trip, legs, expenses, today).filter((o) => o.date <= monthEnd), (o) => o.amount)
    : 0;
  const cashLeft = sum(wallets(cash, expenses), (w) => Math.max(0, w.leftCzk));
  const goalLinked = Boolean(trip.goal_id);
  const need = goalLinked ? 0 : Math.max(0, toCover - dueThisMonth - cashLeft);
  let reserveNow = 0;
  let monthlyAdd: Cents | null = null;
  let monthsLeft: number | null = null;
  if (status === "ongoing") reserveNow = need;
  else if (status === "upcoming" && trip.start_date) {
    // rezerva roste rovnoměrně od měsíce založení cesty do měsíce odjezdu (v měsíci odjezdu = celá částka)
    const created = trip.created_at ? trip.created_at.slice(0, 10) : today;
    const c = Math.min(monthIndex(created), monthIndex(today));
    const d = monthIndex(trip.start_date);
    const m = monthIndex(today);
    const total_ = Math.max(1, d - c + 1);
    reserveNow = Math.min(need, Math.ceil((need * (m - c + 1)) / total_));
    monthsLeft = Math.max(0, d - m);
    monthlyAdd = monthsLeft > 0 ? Math.ceil((need - reserveNow) / monthsLeft) : 0;
  }
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
    dueThisMonth,
    reserveNow,
    monthlyAdd,
    monthsLeft,
    cashLeft,
    goalLinked,
  };
}

/** Nezaplacené plánované výdaje a jízdenky cesty s termínem platby. */
function tripObligationItems(trip: Trip, legs: TripLeg[], expenses: EffectiveExpense[], today: string) {
  const status = tripStatus(trip, today);
  const out: { key: string; name: string; date: string; amount: Cents }[] = [];
  for (const e of expenses) {
    if (e.status !== "planned" || e.value <= 0) continue;
    const date = dueDate(trip, e.date);
    if (date) out.push({ key: `trip|exp|${e.id}`, name: `${trip.name}: ${e.description}`, date, amount: e.value });
  }
  if (status !== "finished") {
    const paidLegs = new Set(expenses.map((e) => e.leg_id).filter(Boolean));
    for (const l of legs) {
      if (paidLegs.has(l.id) || !l.price) continue;
      const date = dueDate(trip, l.depart_date);
      if (date) out.push({ key: `trip|leg|${l.id}`, name: `${trip.name}: ${MODE_LABEL[l.mode]} ${l.from_place} → ${l.to_place}`, date, amount: l.price });
    }
  }
  return out;
}

export interface TravelInput {
  trips: Trip[];
  legs: TripLeg[];
  expenses: TripExpense[];
  people?: TripPerson[];
  cash?: TripCashMove[];
  checklist?: TripChecklistItem[];
  plan?: TripPlanItem[];
  settlements?: TripSettlement[];
}

/**
 * Cesty v plánovači domácnosti:
 *  - nezaplacené plánované výdaje a jízdenky = závazky (nadcházející platby),
 *  - zbytek rozpočtu cesty = rezerva, která se do odjezdu postupně navyšuje.
 * Očekávané příjmy se tím nijak nemění – odečítá se jen z peněz, které už na účtech jsou.
 */
export function travelCommitments(travel: TravelInput | undefined, transactions: Pick<Transaction, "id" | "status" | "amount">[], today: string, lookbackDays: number) {
  const obligations: PaymentOccurrence[] = [];
  let reserve = 0;
  let monthlyAdd = 0;
  if (!travel) return { obligations, reserve, monthlyAdd };
  const from = addDays(today, -lookbackDays);
  for (const trip of travel.trips) {
    const legs = travel.legs.filter((l) => l.trip_id === trip.id);
    const ex = effectiveExpenses(travel.expenses.filter((e) => e.trip_id === trip.id), transactions);
    const s = summarizeTrip(trip, legs, ex, today, (travel.cash ?? []).filter((c) => c.trip_id === trip.id));
    reserve += s.reserveNow;
    monthlyAdd += s.monthlyAdd ?? 0;
    for (const o of tripObligationItems(trip, legs, ex, today)) {
      if (o.date < from) continue;
      obligations.push({
        key: o.key, kind: "trip", refId: trip.id, name: o.name, date: o.date, amount: o.amount, categoryId: null, isDebt: false,
        state: o.date < today ? "overdue" : o.date === today ? "due" : "upcoming", transactionId: null,
      });
    }
  }
  return { obligations, reserve, monthlyAdd };
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

// ---------------------------------------------------------------------------
// Hotovost v cizí měně („peněženka“)

export interface Wallet {
  currency: string;
  /** Koupeno / vybráno (v setinách měny) a kolik to stálo v Kč. */
  bought: number;
  boughtCzk: Cents;
  returned: number;
  spent: number;
  left: number;
  /** Průměrný kurz nákupu (Kč za 1 jednotku). */
  avgRate: number | null;
  leftCzk: Cents;
}

export function wallets(cash: TripCashMove[], expenses: Pick<TripExpense, "from_cash" | "currency" | "amount_original" | "status">[]): Wallet[] {
  const map = new Map<string, Wallet>();
  const w = (c: string) => {
    if (!map.has(c)) map.set(c, { currency: c, bought: 0, boughtCzk: 0, returned: 0, spent: 0, left: 0, avgRate: null, leftCzk: 0 });
    return map.get(c)!;
  };
  for (const m of cash) {
    const x = w(m.currency);
    if (m.kind === "buy") { x.bought += m.amount_original; x.boughtCzk += m.amount; } else x.returned += m.amount_original;
  }
  for (const e of expenses) if (e.from_cash && e.status === "paid" && e.amount_original != null && e.currency !== "CZK") w(e.currency).spent += e.amount_original;
  for (const x of map.values()) {
    x.left = x.bought - x.returned - x.spent;
    x.avgRate = x.bought > 0 ? x.boughtCzk / x.bought : null;
    x.leftCzk = x.avgRate ? Math.round(x.left * x.avgRate) : 0;
  }
  return [...map.values()];
}

// ---------------------------------------------------------------------------
// Kdo co platil a vyrovnání

export interface Settlement {
  balances: { personId: string; name: string; paid: Cents; share: Cents; balance: Cents }[];
  transfers: { from: string; to: string; fromName: string; toName: string; amount: Cents }[];
  /** Výdaje bez uvedeného plátce (do vyrovnání se nepočítají). */
  unassigned: Cents;
}

export function settle(people: TripPerson[], expenses: EffectiveExpense[], done: Pick<TripSettlement, "from_person" | "to_person" | "amount">[] = []): Settlement {
  const ids = new Set(people.map((p) => p.id));
  const paid = new Map<string, number>();
  const share = new Map<string, number>();
  let unassigned = 0;
  for (const e of expenses) {
    if (e.status !== "paid") continue;
    if (!e.paid_by || !ids.has(e.paid_by)) { unassigned += e.value; continue; }
    paid.set(e.paid_by, (paid.get(e.paid_by) ?? 0) + e.value);
    const among = (e.split_among?.filter((x) => ids.has(x)).length ? e.split_among.filter((x) => ids.has(x)) : people.map((p) => p.id));
    // rozdělení na haléře: zbytek dostanou první v pořadí
    const base = Math.floor(e.value / among.length);
    let rest = e.value - base * among.length;
    for (const id of among) {
      share.set(id, (share.get(id) ?? 0) + base + (rest > 0 ? 1 : 0));
      if (rest > 0) rest--;
    }
  }
  // už provedené vyrovnání: kdo poslal peníze, tomu se dluh snižuje
  const sent = new Map<string, number>();
  for (const s of done) {
    if (!ids.has(s.from_person) || !ids.has(s.to_person)) continue;
    sent.set(s.from_person, (sent.get(s.from_person) ?? 0) + s.amount);
    sent.set(s.to_person, (sent.get(s.to_person) ?? 0) - s.amount);
  }
  const balances = people.map((p) => ({ personId: p.id, name: p.name, paid: paid.get(p.id) ?? 0, share: share.get(p.id) ?? 0, balance: (paid.get(p.id) ?? 0) - (share.get(p.id) ?? 0) + (sent.get(p.id) ?? 0) }));
  // minimum převodů: největší dlužník platí největšímu věřiteli
  const debtors = balances.filter((b) => b.balance < 0).map((b) => ({ ...b, left: -b.balance })).sort((a, b) => b.left - a.left);
  const creditors = balances.filter((b) => b.balance > 0).map((b) => ({ ...b, left: b.balance })).sort((a, b) => b.left - a.left);
  const transfers: Settlement["transfers"] = [];
  let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) {
    const amount = Math.min(debtors[i].left, creditors[j].left);
    if (amount > 0) transfers.push({ from: debtors[i].personId, to: creditors[j].personId, fromName: debtors[i].name, toName: creditors[j].name, amount });
    debtors[i].left -= amount;
    creditors[j].left -= amount;
    if (debtors[i].left === 0) i++;
    if (creditors[j].left === 0) j++;
  }
  return { balances, transfers, unassigned };
}

// ---------------------------------------------------------------------------
// Seznam věcí k vyřízení a sbalení podle typu cesty

const SEA = ["chorvat", "itali", "reck", "španěl", "spanel", "turec", "egypt", "bulhar", "černá hora", "cerna hora", "portugal", "kypr", "malt", "albán", "alban", "tunis", "francie"];
const PLUGS_OTHER = ["británie", "britanie", "anglie", "irsko", "skotsko", "malta", "kypr", "švýcarsko", "svycarsko", "usa", "spojené státy", "kanada", "japonsko", "thajsko", "spojené arabské", "dubaj"];
const EU = ["rakousko", "německo", "nemecko", "slovensko", "polsko", "maďarsko", "madarsko", "chorvatsko", "itálie", "italie", "slovinsko", "francie", "španělsko", "spanelsko", "portugalsko", "řecko", "recko", "nizozemsko", "belgie", "dánsko", "švédsko", "finsko", "irsko", "bulharsko", "rumunsko", "kypr", "malta", "lucembursko", "estonsko", "lotyšsko", "litva", "česko"];

export function checklistTemplate(trip: Pick<Trip, "country" | "destination">, legs: Pick<TripLeg, "mode">[]): { text: string; category: string }[] {
  const where = `${trip.country ?? ""} ${trip.destination}`.toLowerCase();
  const modes = new Set(legs.map((l) => l.mode));
  const sea = SEA.some((k) => where.includes(k)) || modes.has("ferry");
  const abroad = trip.country != null && !/česk|cesk|čr\b/i.test(trip.country);
  const inEu = EU.some((k) => where.includes(k));
  const out: { text: string; category: string }[] = [
    { text: abroad && !inEu ? "Cestovní pas (platnost aspoň 6 měsíců)" : "Občanský průkaz / pas", category: "Doklady" },
    { text: "Cestovní pojištění", category: "Doklady" },
    ...(inEu && abroad ? [{ text: "Kartička zdravotní pojišťovny (EHIC)", category: "Doklady" }] : []),
    ...(abroad && !inEu ? [{ text: "Ověřit vízum / vstupní podmínky", category: "Doklady" }] : []),
    { text: "Jízdenky, rezervace ubytování", category: "Doklady" },
    { text: "Platební karta (+ záložní)", category: "Peníze" },
    ...(abroad ? [{ text: "Hotovost v místní měně", category: "Peníze" }] : []),
    { text: "Nabíječky a powerbanka", category: "Elektronika" },
    ...(PLUGS_OTHER.some((k) => where.includes(k)) ? [{ text: "Adaptér do zásuvky", category: "Elektronika" }] : []),
    { text: "Léky a lékárnička", category: "Zdraví" },
    { text: "Oblečení a hygiena", category: "Sbalit" },
  ];
  if (modes.has("car")) out.push(
    { text: "Řidičský průkaz a technický průkaz", category: "Auto" },
    { text: "Dálniční známky / mýto na trase", category: "Auto" },
    { text: "Zelená karta (pojištění auta)", category: "Auto" },
    { text: "Povinná výbava (vesta, trojúhelník, lékárnička)", category: "Auto" },
    { text: "Kontrola pneumatik a oleje", category: "Auto" },
  );
  if (modes.has("plane")) out.push(
    { text: "Online check-in a palubenka v mobilu", category: "Letadlo" },
    { text: "Tekutiny do 100 ml v sáčku", category: "Letadlo" },
    { text: "Zkontrolovat rozměry a váhu zavazadel", category: "Letadlo" },
  );
  if (modes.has("train") || modes.has("bus")) out.push({ text: "Jízdenky v mobilu / vytištěné", category: "Doprava" });
  if (sea) out.push(
    { text: "Plavky a ručník", category: "Moře" },
    { text: "Opalovací krém", category: "Moře" },
    { text: "Boty do vody", category: "Moře" },
  );
  out.push(
    { text: "Zalít květiny, vynést koš", category: "Doma" },
    { text: "Vypnout spotřebiče, zavřít okna, zamknout", category: "Doma" },
  );
  return out;
}

// ---------------------------------------------------------------------------
// Návrh plateb z účtu, které patří k cestě

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function suggestTripTransactions<T extends Pick<Transaction, "id" | "date" | "type" | "status" | "description" | "note" | "recurring_payment_id" | "invoice_id" | "payout_id" | "contribution_id" | "shopping_list_id" | "purchase_id">>(
  trip: Pick<Trip, "start_date" | "end_date" | "destination" | "country" | "currency">, txs: T[], linked: Set<string>,
): { tx: T; suggested: boolean; reason: string | null }[] {
  if (!trip.start_date) return [];
  const end = trip.end_date ?? trip.start_date;
  const from = addDays(trip.start_date, -2);
  const to = addDays(end, 1);
  const words = [trip.destination, trip.country ?? ""].map(norm).filter((w) => w.length >= 3);
  const cur = trip.currency !== "CZK" ? trip.currency.toLowerCase() : null;
  const out: { tx: T; suggested: boolean; reason: string | null }[] = [];
  for (const t of txs) {
    if (t.type !== "expense" || t.status !== "posted" || linked.has(t.id) || t.date < from || t.date > to) continue;
    if (t.recurring_payment_id || t.invoice_id || t.payout_id || t.contribution_id || t.shopping_list_id || t.purchase_id) continue;
    const text = norm(`${t.description} ${t.note ?? ""}`);
    const reason = words.find((w) => text.includes(w)) ? "místo cesty v popisu"
      : cur && new RegExp(`\\b${cur}\\b`).test(text) ? `platba v ${trip.currency}`
      : /\b(booking|airbnb|hotel|hostel|regiojet|flixbus|ryanair|wizz|smartwings|easyjet|cd\.cz|leo express|omv|shell|mol|vignette|maut|autostrada)\b/.test(text) ? "cestovní obchodník"
      : t.date >= trip.start_date && t.date <= end ? "v termínu cesty" : null;
    out.push({ tx: t, suggested: reason != null, reason });
  }
  return out.sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.tx.date.localeCompare(b.tx.date));
}

/** Odhad druhu výdaje z kategorie a popisu. */
export function guessKind(categoryName: string | null, description: string): TripExpenseKind {
  const t = norm(`${categoryName ?? ""} ${description}`);
  if (/booking|airbnb|hotel|hostel|ubytovan|apartm|penzion/.test(t)) return "accommodation";
  if (/doprav|auto|benzin|nafta|omv|shell|mol|regiojet|flixbus|ryanair|wizz|vlak|letenk|parkov|myto|vignette|dalnic/.test(t)) return "transport";
  if (/restaura|potravin|kavarn|cafe|bistro|pizza|bar\b|jidlo/.test(t)) return "food";
  if (/zabav|vstup|muzeum|vylet|ticket|tour/.test(t)) return "activities";
  if (/suvenyr|obchod|nakup|shop/.test(t)) return "shopping";
  return "other";
}

/** Dekódování lomené čáry (Google polyline, přesnost 5) pro mapu. */
export function decodePolyline(str: string): [number, number][] {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lon = 0;
  while (i < str.length) {
    for (const which of [0, 1]) {
      let shift = 0, result = 0, b: number;
      do { b = str.charCodeAt(i++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
      const d = result & 1 ? ~(result >> 1) : result >> 1;
      if (which === 0) lat += d; else lon += d;
    }
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Rozpočet po kategoriích

export interface KindBudget { kind: TripExpenseKind; label: string; budget: Cents; spent: Cents; planned: Cents; left: Cents; over: boolean }

export function categoryBudgetStatus(trip: Pick<Trip, "category_budgets">, legs: TripLeg[], expenses: EffectiveExpense[]): KindBudget[] {
  const b = trip.category_budgets ?? {};
  const paidLegs = new Set(expenses.map((e) => e.leg_id).filter(Boolean));
  const out: KindBudget[] = [];
  for (const kind of Object.keys(KIND_LABEL) as TripExpenseKind[]) {
    const budget = b[kind];
    if (!budget) continue;
    const spent = sum(expenses.filter((e) => e.kind === kind && e.status === "paid"), (e) => e.value);
    const planned = sum(expenses.filter((e) => e.kind === kind && e.status === "planned"), (e) => e.value)
      + (kind === "transport" ? sum(legs.filter((l) => !paidLegs.has(l.id)), (l) => l.price ?? 0) : 0);
    out.push({ kind, label: KIND_LABEL[kind], budget, spent, planned, left: budget - spent - planned, over: spent + planned > budget });
  }
  return out;
}
