"use server";
import { z } from "zod";
import { canEdit, type AppContext } from "@/lib/context";
import { checkbox, date, enumOf, int, optionalDate, optionalMoney, optionalUuid, optText, text, url, uuid } from "@/lib/validation";
import type { Transaction, Trip, TripExpense, TripExpenseKind, TripLeg } from "@/lib/db/types";
import { todayISO } from "@/lib/dates";
import { done, fail, own, parse, withContext } from "./helpers";
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
}).refine((t) => !t.end_date || !t.start_date || t.end_date >= t.start_date, { message: "Návrat musí být po odjezdu", path: ["end_date"] })
  .refine((t) => !t.end_date || t.start_date, { message: "Zadejte i datum odjezdu", path: ["start_date"] });

export async function saveTrip(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(tripSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
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
  booking_ref: optText(80), url: url(), note: optText(1000),
});

export async function saveLeg(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
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
    const coords = { from_lat: from?.lat ?? null, from_lon: from?.lon ?? null, to_lat: to?.lat ?? null, to_lon: to?.lon ?? null };
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
}).superRefine((e, c) => {
  if (e.currency === "CZK" && e.amount == null) c.addIssue({ code: "custom", path: ["amount"], message: "Zadejte částku" });
  if (e.currency !== "CZK") {
    if (e.amount_original == null) c.addIssue({ code: "custom", path: ["amount_original"], message: "Zadejte částku v cizí měně" });
    if (e.rate == null && e.amount == null) c.addIssue({ code: "custom", path: ["rate"], message: "Zadejte kurz nebo částku v Kč" });
  }
  if (e.status === "paid" && e.record_tx && !e.account_id) c.addIssue({ code: "custom", path: ["account_id"], message: "Vyberte účet" });
});

function czkAmount(e: z.infer<typeof expenseSchema>): number {
  if (e.currency === "CZK") return e.amount!;
  if (e.rate != null) return Math.round(e.amount_original! * e.rate);
  return e.amount!;
}

export async function saveTripExpense(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(expenseSchema, fd);
    if (!p.ok) return p.result;
    const e = p.data;
    const h = ctx.household.id;
    const trip = (await own(ctx, "trips", e.trip_id)) as Trip;
    if (e.leg_id) await own(ctx, "trip_legs", e.leg_id);
    const amount = czkAmount(e);
    if (amount <= 0) return fail("Částka musí být větší než 0.", { amount: "Zadejte částku" });
    const row = {
      trip_id: trip.id, leg_id: e.leg_id, status: e.status, kind: e.kind as TripExpenseKind, description: e.description, place: e.place,
      date: e.date ?? (e.status === "paid" ? todayISO() : null), amount, currency: e.currency,
      amount_original: e.currency === "CZK" ? null : e.amount_original, rate: e.currency === "CZK" ? null : e.rate ?? amount / e.amount_original!,
    };
    const wantTx = e.status === "paid" && e.record_tx;
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
    if (!KINDS.includes(kind as never)) return fail("Neplatný druh");
    await own(ctx, "trips", tripId);
    const t = (await own(ctx, "transactions", transactionId)) as Transaction;
    if (t.type !== "expense" || t.status !== "posted") return fail("Přiřadit lze jen platný výdaj.");
    await ctx.store.insert("trip_expenses", [{
      household_id: ctx.household.id, trip_id: tripId, leg_id: null, transaction_id: t.id, status: "paid", kind, description: t.description.slice(0, 200),
      place: null, date: t.date, amount: t.amount, currency: "CZK", amount_original: null, rate: null,
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
