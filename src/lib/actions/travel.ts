"use server";
import { z } from "zod";
import { canEdit, type AppContext } from "@/lib/context";
import { checkbox, date, enumOf, int, money, optionalDate, optionalMoney, optionalUuid, optText, text, url, uuid } from "@/lib/validation";
import type { SavingsGoal, Transaction, Trip, TripCashMove, TripExpense, TripExpenseKind, TripLeg } from "@/lib/db/types";
import { addDays, diffDays, todayISO } from "@/lib/dates";
import { checklistTemplate, effectiveExpenses, guessKind, suggestTripTransactions, summarizeTrip, wallets } from "@/lib/finance/travel";
import { done, fail, own, parse, withContext } from "./helpers";
import { premiumError } from "@/lib/premium";
import type { ActionResult } from "./result";

const MODES = ["train", "bus", "car", "plane", "ferry", "transit", "bike", "other"] as const;
const KINDS = ["transport", "accommodation", "food", "activities", "shopping", "other"] as const;
const currency = () => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().toUpperCase() : "CZK"), z.string().regex(/^[A-Z]{3}$/, "Neplatná měna"));
const time = () => z.preprocess((v) => (typeof v === "string" && v.trim() ? v.trim().padStart(5, "0") : null), z.union([z.null(), z.string().regex(/^\d{2}:\d{2}$/, "Čas jako 14:30")]));

async function geo(place: string | null) {
  if (!place) return null;
  const { geocode } = await import("@/lib/travel-services");
  return geocode(place).catch(() => null);
}

// ---------------------------------------------------------------------------
// Cesty

const tripSchema = z.object({
  id: optionalUuid(), name: text(120), destination: text(120), country: optText(60), start_date: optionalDate(), end_date: optionalDate(),
  travelers: int(1, 50), budget: optionalMoney(), currency: currency(), note: optText(2000),
  budget_transport: optionalMoney(), budget_accommodation: optionalMoney(), budget_food: optionalMoney(),
  budget_activities: optionalMoney(), budget_shopping: optionalMoney(), budget_other: optionalMoney(),
}).refine((t) => !t.end_date || !t.start_date || t.end_date >= t.start_date, { message: "Návrat musí být po odjezdu", path: ["end_date"] })
  .refine((t) => !t.end_date || t.start_date, { message: "Zadejte i datum odjezdu", path: ["start_date"] });

export async function saveTrip(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const p = parse(tripSchema, fd);
    if (!p.ok) return p.result;
    const { id, budget_transport, budget_accommodation, budget_food, budget_activities, budget_shopping, budget_other, ...base } = p.data;
    const cb = Object.fromEntries(Object.entries({ transport: budget_transport, accommodation: budget_accommodation, food: budget_food, activities: budget_activities, shopping: budget_shopping, other: budget_other }).filter(([, v]) => v != null && v > 0));
    const row = { ...base, category_budgets: Object.keys(cb).length ? cb : null };
    const h = ctx.household.id;
    if (id) {
      const old = (await own(ctx, "trips", id)) as Trip;
      const moved = old.destination !== row.destination || old.country !== row.country;
      const g = moved ? await geo([row.destination, row.country].filter(Boolean).join(", ")) : null;
      await ctx.store.update("trips", { id, household_id: h }, { ...row, ...(moved ? { lat: g?.lat ?? null, lon: g?.lon ?? null } : {}) });
      return done("Cesta upravena", id);
    }
    const g = await geo([row.destination, row.country].filter(Boolean).join(", "));
    const [t] = await ctx.store.insert("trips", [{ ...row, household_id: h, lat: g?.lat ?? null, lon: g?.lon ?? null }]);
    return done("Cesta vytvořena", t.id);
  });
}

export async function deleteTrip(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "trips", id);
    await ctx.store.remove("trips", { id, household_id: ctx.household.id });
    return done("Cesta smazána – zapsané výdaje zůstaly v příjmech a výdajích");
  });
}

// ---------------------------------------------------------------------------
// Transakce pro výdaj na cestě (kategorie „Cestování“, vytvoří se, když chybí)

async function travelCategory(ctx: AppContext): Promise<string | null> {
  const h = ctx.household.id;
  const cats = await ctx.store.select("categories", { household_id: h, kind: "expense" });
  const found = cats.find((c) => c.name.toLowerCase() === "cestování");
  if (found) return found.id;
  try {
    const [c] = await ctx.store.insert("categories", [{ household_id: h, name: "Cestování", kind: "expense", icon: "plane", color: "#4fc3f7", is_food: false, is_household: false, is_archived: false, sort: cats.length }]);
    return c.id;
  } catch {
    return null;
  }
}

async function createTx(ctx: AppContext, trip: Trip, p: { amount: number; date: string; account_id: string; description: string; payment_method: Transaction["payment_method"]; note: string | null }) {
  await own(ctx, "accounts", p.account_id);
  const [t] = await ctx.store.insert("transactions", [{
    household_id: ctx.household.id, type: "expense", status: "posted", amount: p.amount, date: p.date, account_id: p.account_id, transfer_account_id: null,
    category_id: await travelCategory(ctx), description: `${trip.name}: ${p.description}`.slice(0, 200), member_id: null, scope: "shared",
    is_recurring: false, payment_method: p.payment_method, source: "trip", cancelled_at: null, note: p.note,
  }]);
  return t;
}

// ---------------------------------------------------------------------------
// Úseky trasy

const legSchema = z.object({
  id: optionalUuid(), trip_id: uuid(), mode: enumOf(MODES), carrier: optText(80), from_place: text(120), to_place: text(120),
  depart_date: optionalDate(), depart_time: time(), arrive_date: optionalDate(), arrive_time: time(), price: optionalMoney(),
  distance_km: z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))), z.union([z.null(), z.number().int("Celé km").min(0).max(50000)])),
  booking_ref: optText(80), url: url(), note: optText(1000), document_id: optionalUuid(),
});

/** Trasa po silnici (OSRM, bez klíče): lomená čára a vzdálenost. Při nedostupnosti null. */
async function roadRoute(mode: string, from: { lat: number; lon: number } | null, to: { lat: number; lon: number } | null) {
  if (!from || !to || (mode !== "car" && mode !== "bike")) return null;
  try {
    const profile = mode === "bike" ? "cycling" : "driving";
    const r = await fetch(`https://router.project-osrm.org/route/v1/${profile}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=simplified&geometries=polyline`, {
      headers: { "User-Agent": "HomeOS/1.0 (rodinne finance; cestovani)" }, signal: AbortSignal.timeout(6000),
    });
    if (!r.ok) return null;
    const j = (await r.json()) as { routes?: { geometry?: string; distance?: number }[] };
    const route = j.routes?.[0];
    return route?.geometry && route.geometry.length <= 20000 ? { polyline: route.geometry, km: Math.round((route.distance ?? 0) / 1000) } : null;
  } catch {
    return null;
  }
}

export async function saveLeg(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const p = parse(legSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    const h = ctx.household.id;
    await own(ctx, "trips", row.trip_id);
    const old = id ? ((await own(ctx, "trip_legs", id)) as TripLeg) : null;
    const [from, to] = await Promise.all([
      !old || old.from_place !== row.from_place ? geo(row.from_place) : Promise.resolve(old.from_lat != null ? { lat: old.from_lat, lon: old.from_lon! } : null),
      !old || old.to_place !== row.to_place ? geo(row.to_place) : Promise.resolve(old.to_lat != null ? { lat: old.to_lat, lon: old.to_lon! } : null),
    ]);
    if (row.document_id) await own(ctx, "documents", row.document_id);
    const coords = { from_lat: from?.lat ?? null, from_lon: from?.lon ?? null, to_lat: to?.lat ?? null, to_lon: to?.lon ?? null };
    const sameRoute = old && old.from_place === row.from_place && old.to_place === row.to_place && old.mode === row.mode && old.route_polyline;
    const road = sameRoute ? { polyline: old!.route_polyline!, km: old!.distance_km ?? 0 } : await roadRoute(row.mode, from, to);
    Object.assign(coords, { route_polyline: road?.polyline ?? null });
    if (row.distance_km == null && road?.km) row.distance_km = road.km;
    if (old) {
      await ctx.store.update("trip_legs", { id: old.id, household_id: h }, { ...row, ...coords });
      return done("Úsek upraven", old.id);
    }
    const count = (await ctx.store.select("trip_legs", { household_id: h, trip_id: row.trip_id })).length;
    const [l] = await ctx.store.insert("trip_legs", [{ ...row, ...coords, household_id: h, sort: count }]);
    return done("Úsek přidán", l.id);
  });
}

export async function deleteLeg(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "trip_legs", id);
    await ctx.store.remove("trip_legs", { id, household_id: ctx.household.id });
    return done("Úsek smazán");
  });
}

export async function moveLeg(id: string, dir: -1 | 1): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const leg = (await own(ctx, "trip_legs", id)) as TripLeg;
    const legs = (await ctx.store.select("trip_legs", { household_id: ctx.household.id, trip_id: leg.trip_id })).sort((a, b) => a.sort - b.sort);
    const i = legs.findIndex((l) => l.id === id);
    const j = i + dir;
    if (j < 0 || j >= legs.length) return done("");
    [legs[i], legs[j]] = [legs[j], legs[i]];
    await Promise.all(legs.map((l, n) => (l.sort === n ? null : ctx.store.update("trip_legs", { id: l.id, household_id: ctx.household.id }, { sort: n }))));
    return done("");
  });
}

// ---------------------------------------------------------------------------
// Výdaje na cestě

const expenseSchema = z.object({
  id: optionalUuid(), trip_id: uuid(), leg_id: optionalUuid(), status: enumOf(["planned", "paid"] as const), kind: enumOf(KINDS),
  description: text(200), place: optText(120), date: optionalDate(), currency: currency(),
  amount: optionalMoney(), amount_original: optionalMoney(),
  rate: z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))), z.union([z.null(), z.number().positive("Kurz musí být kladný").max(100000)])),
  record_tx: checkbox(), account_id: optionalUuid(), payment_method: enumOf(["card", "cash", "transfer", "other"] as const),
  paid_by: optionalUuid(), from_cash: checkbox(), document_id: optionalUuid(),
}).superRefine((e, c) => {
  if (e.from_cash && e.currency === "CZK") c.addIssue({ code: "custom", path: ["from_cash"], message: "Z hotovosti v cizí měně lze platit jen v cizí měně" });
  if (e.currency === "CZK" && e.amount == null) c.addIssue({ code: "custom", path: ["amount"], message: "Zadejte částku" });
  if (e.currency !== "CZK") {
    if (e.amount_original == null) c.addIssue({ code: "custom", path: ["amount_original"], message: "Zadejte částku v cizí měně" });
    if (e.rate == null && e.amount == null && !(e.from_cash && e.status === "paid")) c.addIssue({ code: "custom", path: ["rate"], message: "Zadejte kurz nebo částku v Kč" });
  }
  if (e.status === "paid" && e.record_tx && !e.from_cash && !e.account_id) c.addIssue({ code: "custom", path: ["account_id"], message: "Vyberte účet" });
});

function czkAmount(e: z.infer<typeof expenseSchema>): number {
  if (e.currency === "CZK") return e.amount!;
  if (e.rate != null) return Math.round(e.amount_original! * e.rate);
  return e.amount!;
}

export async function saveTripExpense(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const p = parse(expenseSchema, fd);
    if (!p.ok) return p.result;
    const e = p.data;
    const h = ctx.household.id;
    const trip = (await own(ctx, "trips", e.trip_id)) as Trip;
    if (e.leg_id) await own(ctx, "trip_legs", e.leg_id);
    if (e.document_id) await own(ctx, "documents", e.document_id);
    const people = await ctx.store.select("trip_people", { household_id: h, trip_id: trip.id });
    if (e.paid_by && !people.some((x) => x.id === e.paid_by)) return fail("Neplatný plátce.");
    const split = fd.getAll("split_among").map(String).filter((id) => people.some((x) => x.id === id));
    const split_among = split.length && split.length < people.length ? split : null;
    if (e.from_cash && e.status === "paid") {
      // hodnota v Kč podle průměrného kurzu, za který jste hotovost koupili
      const [cash, exps] = await Promise.all([ctx.store.select("trip_cash_moves", { household_id: h, trip_id: trip.id }), ctx.store.select("trip_expenses", { household_id: h, trip_id: trip.id })]);
      const w = wallets(cash, exps.filter((x) => x.id !== e.id)).find((x) => x.currency === e.currency);
      if (!w?.avgRate) return fail(`Nemáte zapsanou hotovost v ${e.currency} – nejdřív zapište výměnu nebo výběr z bankomatu.`, { from_cash: "Chybí výměna" });
      e.rate = w.avgRate;
      e.amount = null;
    }
    const amount = czkAmount(e);
    if (amount <= 0) return fail("Částka musí být větší než 0.", { amount: "Zadejte částku" });
    const row = {
      trip_id: trip.id, leg_id: e.leg_id, status: e.status, kind: e.kind as TripExpenseKind, description: e.description, place: e.place,
      date: e.date ?? (e.status === "paid" ? todayISO() : null), amount, currency: e.currency,
      amount_original: e.currency === "CZK" ? null : e.amount_original, rate: e.currency === "CZK" ? null : e.rate ?? amount / e.amount_original!,
      paid_by: e.paid_by, split_among, from_cash: e.status === "paid" && e.from_cash, document_id: e.document_id,
    };
    const wantTx = e.status === "paid" && e.record_tx && !e.from_cash;
    if (wantTx && !canEdit(ctx, "finance")) return fail("Nemáte oprávnění zapisovat výdaje domácnosti – vypněte „Zapsat i do výdajů“.");

    if (e.id) {
      const old = (await own(ctx, "trip_expenses", e.id)) as TripExpense;
      let transaction_id = old.transaction_id;
      if (transaction_id) {
        const [t] = await ctx.store.select("transactions", { id: transaction_id, household_id: h });
        if (t?.status === "posted" && canEdit(ctx, "finance")) {
          await ctx.store.update("transactions", { id: t.id, household_id: h }, { amount, date: row.date ?? t.date, description: `${trip.name}: ${e.description}`.slice(0, 200) });
        }
      } else if (wantTx) {
        transaction_id = (await createTx(ctx, trip, { amount, date: row.date!, account_id: e.account_id!, description: e.description, payment_method: e.payment_method, note: null })).id;
      }
      await ctx.store.update("trip_expenses", { id: old.id, household_id: h }, { ...row, transaction_id });
      return done(old.status === "planned" && e.status === "paid" ? "Zaplaceno" : "Výdaj upraven", old.id);
    }
    let transaction_id: string | null = null;
    if (wantTx) transaction_id = (await createTx(ctx, trip, { amount, date: row.date!, account_id: e.account_id!, description: e.description, payment_method: e.payment_method, note: null })).id;
    try {
      const [x] = await ctx.store.insert("trip_expenses", [{ ...row, household_id: h, transaction_id }]);
      return done(e.status === "planned" ? "Naplánováno" : transaction_id ? "Výdaj zapsán k cestě i do výdajů domácnosti" : "Výdaj zapsán k cestě", x.id);
    } catch (err) {
      if (transaction_id) await ctx.store.remove("transactions", { id: transaction_id, household_id: h });
      throw err;
    }
  });
}

/** Smazání výdaje; propojená transakce se stornuje (aby nezůstala v přehledech), pokud uživatel nechce jinak. */
export async function deleteTripExpense(id: string, cancelTx = true): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const e = (await own(ctx, "trip_expenses", id)) as TripExpense;
    const h = ctx.household.id;
    await ctx.store.remove("trip_expenses", { id, household_id: h });
    if (e.transaction_id && cancelTx && canEdit(ctx, "finance")) {
      await ctx.store.update("transactions", { id: e.transaction_id, household_id: h, status: "posted" }, { status: "cancelled", cancelled_at: new Date().toISOString() });
      return done("Výdaj smazán a platba stornována");
    }
    return done("Výdaj smazán");
  });
}

/** Přiřazení už zapsaného výdaje (např. platba kartou v zahraničí z importu banky) k cestě. */
export async function linkTransactionToTrip(tripId: string, transactionId: string, kind: TripExpenseKind): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    if (!KINDS.includes(kind as never)) return fail("Neplatný druh");
    await own(ctx, "trips", tripId);
    const t = (await own(ctx, "transactions", transactionId)) as Transaction;
    if (t.type !== "expense" || t.status !== "posted") return fail("Přiřadit lze jen platný výdaj.");
    await ctx.store.insert("trip_expenses", [{
      household_id: ctx.household.id, trip_id: tripId, leg_id: null, transaction_id: t.id, status: "paid", kind, description: t.description.slice(0, 200),
      place: null, date: t.date, amount: t.amount, currency: "CZK", amount_original: null, rate: null, paid_by: null, split_among: null, from_cash: false, document_id: null,
    }]);
    return done("Přiřazeno k cestě");
  });
}

/** Kurz ČNB pro formulář (Kč za 1 jednotku měny). */
export async function getExchangeRate(code: string, day: string): Promise<{ rate: number; date: string | null } | null> {
  const c = String(code).toUpperCase();
  if (!/^[A-Z]{3}$/.test(c)) return null;
  const d = date().safeParse(day);
  const { cnbRate } = await import("@/lib/travel-services");
  return cnbRate(c, d.success ? d.data : todayISO()).catch(() => null);
}

// ---------------------------------------------------------------------------
// Účastníci cesty

export async function addTripPerson(tripId: string, name: string, memberId: string | null = null): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    await own(ctx, "trips", tripId);
    const n = String(name).trim().slice(0, 60);
    if (!n) return fail("Zadejte jméno.");
    if (memberId) await own(ctx, "members", memberId);
    const existing = await ctx.store.select("trip_people", { household_id: ctx.household.id, trip_id: tripId });
    if (existing.some((p) => p.name.toLowerCase() === n.toLowerCase())) return fail("Tento účastník už na cestě je.");
    await ctx.store.insert("trip_people", [{ household_id: ctx.household.id, trip_id: tripId, name: n, member_id: memberId, sort: existing.length }]);
    await syncTravelers(ctx, tripId);
    return done("Účastník přidán");
  });
}

/** Přidá všechny členy domácnosti jako účastníky. */
export async function addMembersToTrip(tripId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    await own(ctx, "trips", tripId);
    const h = ctx.household.id;
    const [members, existing] = await Promise.all([ctx.store.select("members", { household_id: h }), ctx.store.select("trip_people", { household_id: h, trip_id: tripId })]);
    const add = members.filter((m) => m.is_active && !existing.some((p) => p.member_id === m.id || p.name.toLowerCase() === m.name.toLowerCase()));
    if (!add.length) return done("Všichni členové už na cestě jsou");
    await ctx.store.insert("trip_people", add.map((m, i) => ({ household_id: h, trip_id: tripId, name: m.name.slice(0, 60), member_id: m.id, sort: existing.length + i })));
    await syncTravelers(ctx, tripId);
    return done(`Přidáno ${add.length}`);
  });
}

export async function deleteTripPerson(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = await own(ctx, "trip_people", id);
    await ctx.store.remove("trip_people", { id, household_id: ctx.household.id });
    // odebrat ze sdílení výdajů
    const exps = await ctx.store.select("trip_expenses", { household_id: ctx.household.id, trip_id: p!.trip_id });
    for (const e of exps.filter((x) => x.split_among?.includes(id))) {
      const rest = e.split_among!.filter((x) => x !== id);
      await ctx.store.update("trip_expenses", { id: e.id, household_id: ctx.household.id }, { split_among: rest.length ? rest : null });
    }
    await syncTravelers(ctx, p!.trip_id);
    return done("Účastník odebrán");
  });
}

async function syncTravelers(ctx: AppContext, tripId: string) {
  const n = (await ctx.store.select("trip_people", { household_id: ctx.household.id, trip_id: tripId })).length;
  if (n > 0) await ctx.store.update("trips", { id: tripId, household_id: ctx.household.id }, { travelers: Math.min(50, n) });
}

// ---------------------------------------------------------------------------
// Hotovost v cizí měně

const cashSchema = z.object({
  trip_id: uuid(), kind: enumOf(["buy", "return"] as const), currency: currency(), amount_original: money({ min: 1 }),
  rate: z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))), z.number({ error: "Zadejte kurz" }).positive("Kurz musí být kladný").max(100000)),
  date: date(), record_tx: checkbox(), account_id: optionalUuid(), note: optText(300),
}).superRefine((c, x) => {
  if (c.currency === "CZK") x.addIssue({ code: "custom", path: ["currency"], message: "Vyberte cizí měnu" });
  if (c.record_tx && !c.account_id) x.addIssue({ code: "custom", path: ["account_id"], message: "Vyberte účet" });
});

export async function saveCashMove(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const p = parse(cashSchema, fd);
    if (!p.ok) return p.result;
    const c = p.data;
    const h = ctx.household.id;
    const trip = (await own(ctx, "trips", c.trip_id)) as Trip;
    const amount = Math.round(c.amount_original * c.rate);
    if (c.kind === "return") {
      const [cash, exps] = await Promise.all([ctx.store.select("trip_cash_moves", { household_id: h, trip_id: trip.id }), ctx.store.select("trip_expenses", { household_id: h, trip_id: trip.id })]);
      const w = wallets(cash, exps).find((x) => x.currency === c.currency);
      if (!w || c.amount_original > w.left) return fail(`V hotovosti máte jen ${((w?.left ?? 0) / 100).toLocaleString("cs-CZ")} ${c.currency}.`, { amount_original: "Více, než máte" });
    }
    let transaction_id: string | null = null;
    if (c.record_tx) {
      if (!canEdit(ctx, "finance")) return fail("Nemáte oprávnění zapisovat do příjmů a výdajů – vypněte zápis na účet.");
      await own(ctx, "accounts", c.account_id);
      const label = `${(c.amount_original / 100).toLocaleString("cs-CZ")} ${c.currency}`;
      const [t] = await ctx.store.insert("transactions", [{
        household_id: h, type: c.kind === "buy" ? "expense" : "income", status: "posted", amount, date: c.date, account_id: c.account_id!, transfer_account_id: null,
        category_id: c.kind === "buy" ? await travelCategory(ctx) : null,
        description: `${trip.name}: ${c.kind === "buy" ? "výměna / výběr" : "vrácení zbytku"} ${label}`.slice(0, 200), member_id: null, scope: "shared",
        is_recurring: false, payment_method: c.kind === "buy" ? "cash" : "cash", source: "trip", cancelled_at: null, note: c.note,
      }]);
      transaction_id = t.id;
    }
    await ctx.store.insert("trip_cash_moves", [{ household_id: h, trip_id: trip.id, kind: c.kind, currency: c.currency, amount_original: c.amount_original, amount, rate: c.rate, date: c.date, transaction_id, note: c.note }]);
    return done(c.kind === "buy" ? "Hotovost zapsána" : "Vrácení zapsáno");
  });
}

export async function deleteCashMove(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const m = (await own(ctx, "trip_cash_moves", id)) as TripCashMove;
    const h = ctx.household.id;
    await ctx.store.remove("trip_cash_moves", { id, household_id: h });
    if (m.transaction_id && canEdit(ctx, "finance")) await ctx.store.update("transactions", { id: m.transaction_id, household_id: h, status: "posted" }, { status: "cancelled", cancelled_at: new Date().toISOString() });
    return done(m.transaction_id ? "Smazáno a platba stornována" : "Smazáno");
  });
}

// ---------------------------------------------------------------------------
// Co vyřídit a sbalit

export async function addChecklistItem(tripId: string, text_: string, category: string | null = null): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    await own(ctx, "trips", tripId);
    const t = String(text_).trim().slice(0, 120);
    if (!t) return fail("Zadejte, co vyřídit nebo sbalit.");
    const n = (await ctx.store.select("trip_checklist", { household_id: ctx.household.id, trip_id: tripId })).length;
    await ctx.store.insert("trip_checklist", [{ household_id: ctx.household.id, trip_id: tripId, text: t, category: category?.slice(0, 40) ?? null, done: false, sort: n }]);
    return done("");
  });
}

export async function fillChecklist(tripId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const trip = (await own(ctx, "trips", tripId)) as Trip;
    const h = ctx.household.id;
    const [legs, existing] = await Promise.all([ctx.store.select("trip_legs", { household_id: h, trip_id: tripId }), ctx.store.select("trip_checklist", { household_id: h, trip_id: tripId })]);
    const have = new Set(existing.map((x) => x.text.toLowerCase()));
    const add = checklistTemplate(trip, legs).filter((x) => !have.has(x.text.toLowerCase()));
    if (!add.length) return done("Seznam už je kompletní");
    await ctx.store.insert("trip_checklist", add.map((x, i) => ({ household_id: h, trip_id: tripId, text: x.text, category: x.category, done: false, sort: existing.length + i })));
    return done(`Přidáno ${add.length} položek podle typu cesty`);
  });
}

export async function toggleChecklistItem(id: string, doneFlag: boolean): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    await own(ctx, "trip_checklist", id);
    await ctx.store.update("trip_checklist", { id, household_id: ctx.household.id }, { done: doneFlag });
    return done("");
  });
}

export async function deleteChecklistItem(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "trip_checklist", id);
    await ctx.store.remove("trip_checklist", { id, household_id: ctx.household.id });
    return done("");
  });
}

// ---------------------------------------------------------------------------
// Program po dnech

const planSchema = z.object({
  id: optionalUuid(), trip_id: uuid(), kind: enumOf(["stay", "activity", "note"] as const), date: optionalDate(), end_date: optionalDate(), time: time(),
  title: text(120), address: optText(200), url: url(), note: optText(1000),
}).refine((p) => !p.end_date || !p.date || p.end_date >= p.date, { message: "Konec musí být po začátku", path: ["end_date"] });

export async function savePlanItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const p = parse(planSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    await own(ctx, "trips", row.trip_id);
    if (id) {
      await own(ctx, "trip_plan_items", id);
      await ctx.store.update("trip_plan_items", { id, household_id: ctx.household.id }, row);
      return done("Upraveno");
    }
    await ctx.store.insert("trip_plan_items", [{ ...row, household_id: ctx.household.id }]);
    return done("Přidáno do programu");
  });
}

export async function deletePlanItem(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "trip_plan_items", id);
    await ctx.store.remove("trip_plan_items", { id, household_id: ctx.household.id });
    return done("Smazáno");
  });
}

// ---------------------------------------------------------------------------
// Dokumenty cesty

export async function attachDocumentToTrip(tripId: string, documentId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    await Promise.all([own(ctx, "trips", tripId), own(ctx, "documents", documentId)]);
    await ctx.store.update("documents", { id: documentId, household_id: ctx.household.id }, { trip_id: tripId } as never);
    return done("Dokument přiložen k cestě");
  });
}

export async function detachDocumentFromTrip(documentId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "documents", documentId);
    await ctx.store.update("documents", { id: documentId, household_id: ctx.household.id }, { trip_id: null } as never);
    return done("Odebráno z cesty (dokument zůstal v Dokumentech)");
  });
}

// ---------------------------------------------------------------------------
// Kopie cesty

export async function duplicateTrip(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const p = parse(z.object({ id: uuid(), start_date: optionalDate(), name: text(120) }), fd);
    if (!p.ok) return p.result;
    const h = ctx.household.id;
    const src = (await own(ctx, "trips", p.data.id)) as Trip;
    const shift = p.data.start_date && src.start_date ? diffDays(src.start_date, p.data.start_date) : null;
    // data se posunou o stejný počet dní jako odjezd; bez nového termínu zůstanou prázdná
    const mv = (d: string | null) => (d && shift != null ? addDays(d, shift) : null);
    const [legs, people, checklist, plan, exps] = await Promise.all([
      ctx.store.select("trip_legs", { household_id: h, trip_id: src.id }), ctx.store.select("trip_people", { household_id: h, trip_id: src.id }),
      ctx.store.select("trip_checklist", { household_id: h, trip_id: src.id }), ctx.store.select("trip_plan_items", { household_id: h, trip_id: src.id }),
      ctx.store.select("trip_expenses", { household_id: h, trip_id: src.id }),
    ]);
    const start = p.data.start_date;
    const end = start && src.start_date && src.end_date ? addDays(start, diffDays(src.start_date, src.end_date)) : start;
    const [t] = await ctx.store.insert("trips", [{
      household_id: h, name: p.data.name, destination: src.destination, country: src.country, start_date: start, end_date: end, travelers: src.travelers,
      budget: src.budget, currency: src.currency, lat: src.lat, lon: src.lon, note: src.note, goal_id: null,
    }]);
    const personMap = new Map<string, string>();
    if (people.length) {
      const ins = await ctx.store.insert("trip_people", people.map((x) => ({ household_id: h, trip_id: t.id, name: x.name, member_id: x.member_id, sort: x.sort })));
      people.forEach((x, i) => personMap.set(x.id, ins[i].id));
    }
    if (legs.length) await ctx.store.insert("trip_legs", legs.map((l) => ({
      household_id: h, trip_id: t.id, mode: l.mode, carrier: l.carrier, from_place: l.from_place, to_place: l.to_place, depart_date: mv(l.depart_date), depart_time: l.depart_time,
      arrive_date: mv(l.arrive_date), arrive_time: l.arrive_time, price: l.price, distance_km: l.distance_km, booking_ref: null, url: null, note: l.note,
      from_lat: l.from_lat, from_lon: l.from_lon, to_lat: l.to_lat, to_lon: l.to_lon, document_id: null, route_polyline: l.route_polyline, sort: l.sort,
    })));
    if (checklist.length) await ctx.store.insert("trip_checklist", checklist.map((c) => ({ household_id: h, trip_id: t.id, text: c.text, category: c.category, done: false, sort: c.sort })));
    if (plan.length) await ctx.store.insert("trip_plan_items", plan.map((x) => ({ household_id: h, trip_id: t.id, kind: x.kind, date: mv(x.date), end_date: mv(x.end_date), time: x.time, title: x.title, address: x.address, url: x.url, note: x.note })));
    // zaplacené i plánované výdaje (kromě dopravy z úseků) jako plán nové cesty
    const planned = exps.filter((e) => !e.leg_id && !e.from_cash && (e.kind === "accommodation" || e.status === "planned"));
    if (planned.length) await ctx.store.insert("trip_expenses", planned.map((e) => ({
      household_id: h, trip_id: t.id, leg_id: null, transaction_id: null, status: "planned", kind: e.kind, description: e.description, place: e.place, date: mv(e.date),
      amount: e.amount, currency: e.currency, amount_original: e.amount_original, rate: e.rate, paid_by: e.paid_by ? personMap.get(e.paid_by) ?? null : null,
      split_among: e.split_among?.map((x) => personMap.get(x)).filter((x): x is string => Boolean(x)) ?? null, from_cash: false, document_id: null,
    })));
    return done("Cesta zkopírována", t.id);
  });
}

// ---------------------------------------------------------------------------
// Cíl ve Spoření pro cestu

export async function createGoalForTrip(tripId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    if (!canEdit(ctx, "savings")) return fail("Nemáte oprávnění upravovat Spoření.");
    const h = ctx.household.id;
    const trip = (await own(ctx, "trips", tripId)) as Trip;
    if (trip.goal_id) return fail("Cesta už má cíl ve Spoření.");
    const d = (await import("@/lib/data")).loadData;
    const data = await d(ctx);
    const today = todayISO();
    const legs = data.travel.legs.filter((l) => l.trip_id === tripId);
    const s = summarizeTrip(trip, legs, effectiveExpenses(data.travel.expenses.filter((e) => e.trip_id === tripId), data.transactions), today, data.travel.cash.filter((c) => c.trip_id === tripId));
    const target = Math.max(s.toCover - s.cashLeft, 0);
    if (target <= 0) return fail("Na cestu už není potřeba nic odkládat.");
    const [g] = await ctx.store.insert("savings_goals", [{
      household_id: h, name: `Cesta: ${trip.name}`.slice(0, 120), kind: "vacation", target_amount: target, target_date: trip.start_date, monthly_contribution: null,
      account_id: null, color: "#4fc3f7", priority: 2, status: "active", note: "Založeno z Cestování – rezervu na cestu teď drží tento cíl.",
    } as Omit<SavingsGoal, "id" | "created_at">]);
    await ctx.store.update("trips", { id: tripId, household_id: h }, { goal_id: g.id });
    return done("Cíl ve Spoření založen – vklady na něj odkládejte skutečné peníze", g.id);
  });
}

export async function unlinkGoal(tripId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "trips", tripId);
    await ctx.store.update("trips", { id: tripId, household_id: ctx.household.id }, { goal_id: null });
    return done("Cíl odpojen – rezervu znovu počítá plánovač (cíl ve Spoření zůstal)");
  });
}

// ---------------------------------------------------------------------------
// Hromadné přiřazení navržených plateb z účtu

export async function linkSuggestedTransactions(tripId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    const trip = (await own(ctx, "trips", tripId)) as Trip;
    const h = ctx.household.id;
    const [txs, exps, cats, cash] = await Promise.all([
      ctx.store.select("transactions", { household_id: h }), ctx.store.select("trip_expenses", { household_id: h }), ctx.store.select("categories", { household_id: h }),
      ctx.store.select("trip_cash_moves", { household_id: h }),
    ]);
    const linked = new Set([...exps.map((e) => e.transaction_id), ...cash.map((c) => c.transaction_id)].filter((x): x is string => Boolean(x)));
    const list = suggestTripTransactions(trip, txs, linked).filter((x) => x.suggested);
    if (!list.length) return done("Nic dalšího k přiřazení");
    await ctx.store.insert("trip_expenses", list.map(({ tx }) => ({
      household_id: h, trip_id: trip.id, leg_id: null, transaction_id: tx.id, status: "paid", kind: guessKind(cats.find((c) => c.id === tx.category_id)?.name ?? null, tx.description),
      description: tx.description.slice(0, 200), place: null, date: tx.date, amount: tx.amount, currency: "CZK", amount_original: null, rate: null,
      paid_by: null, split_among: null, from_cash: false, document_id: null,
    })));
    return done(`Přiřazeno ${list.length} plateb`);
  });
}

// ---------------------------------------------------------------------------
// Účet účastníka (QR platba), vyrovnání, sdílení

export async function updateTripPerson(id: string, name: string, account: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "trip_people", id);
    const n = String(name).trim().slice(0, 60);
    if (!n) return fail("Zadejte jméno.");
    const acc = String(account ?? "").trim();
    const { normalizeIban } = await import("@/lib/qr-payment");
    if (acc && !normalizeIban(acc)) return fail("Neplatné číslo účtu – zadejte např. 123456789/0800 nebo IBAN.");
    await ctx.store.update("trip_people", { id, household_id: ctx.household.id }, { name: n, account: acc ? acc.slice(0, 40) : null });
    return done("Uloženo");
  });
}

export async function markSettled(tripId: string, from: string, to: string, amount: number): Promise<ActionResult> {
  return withContext(async (ctx) => {
    { const err = await premiumError(ctx, "Cestování"); if (err) return fail(err); }
    await Promise.all([own(ctx, "trips", tripId), own(ctx, "trip_people", from), own(ctx, "trip_people", to)]);
    if (!Number.isSafeInteger(amount) || amount <= 0) return fail("Neplatná částka.");
    await ctx.store.insert("trip_settlements", [{ household_id: ctx.household.id, trip_id: tripId, from_person: from, to_person: to, amount, date: todayISO() }]);
    return done("Označeno jako vyrovnané");
  });
}

export async function deleteSettlement(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "trip_settlements", id);
    await ctx.store.remove("trip_settlements", { id, household_id: ctx.household.id });
    return done("Vyrovnání vráceno");
  });
}

/** Zapne/vypne veřejný odkaz jen pro čtení (trasa, program, kdo komu dluží). */
export async function setTripShare(tripId: string, enable: boolean): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (enable) { const err = await premiumError(ctx, "Sdílení cesty"); if (err) return fail(err); }
    await own(ctx, "trips", tripId);
    const { randomBytes } = await import("node:crypto");
    const token = enable ? randomBytes(18).toString("base64url") : null;
    await ctx.store.update("trips", { id: tripId, household_id: ctx.household.id }, { share_token: token });
    return done(enable ? "Odkaz pro sdílení vytvořen" : "Sdílení vypnuto – starý odkaz už nefunguje", token ?? undefined);
  });
}
