"use server";
import { z } from "zod";
import { checkbox, date, duration, int, money, moneyOrZero, optionalDate, optionalUuid, quantity, text, optText, uuid } from "@/lib/validation";
import { privateKmCost } from "@/lib/finance/work";
import { fingerprint } from "@/lib/csv";
import type { Payout, WorkSettings } from "@/lib/db/types";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const settingsSchema = z.object({
  company: text(80),
  member_id: optionalUuid(),
  rate_hour: moneyOrZero(),
  rate_regular_route: moneyOrZero(),
  rate_express_route: moneyOrZero(),
  rate_order: moneyOrZero(),
  rate_peak_hour_bonus: moneyOrZero(),
  private_km_rate: moneyOrZero(),
  default_vehicle_rent: moneyOrZero(),
});

export async function saveWorkSettings(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(settingsSchema, fd);
    if (!p.ok) return p.result;
    await own(ctx, "members", p.data.member_id);
    const existing = await ctx.store.select("work_settings", { household_id: ctx.household.id });
    if (existing.length) await ctx.store.update("work_settings", { household_id: ctx.household.id }, p.data);
    else await ctx.store.insert("work_settings", [{ ...p.data, household_id: ctx.household.id }]);
    return done("Pracovní nastavení uloženo");
  });
}

const shiftSchema = z.object({
  id: optionalUuid(),
  member_id: optionalUuid(),
  date: date(),
  minutes: duration(),
  peak_minutes: duration(),
  regular_routes: int(0, 500),
  express_routes: int(0, 500),
  orders: int(0, 5000),
  base_earnings: moneyOrZero(),
  tips: moneyOrZero(),
  bonuses: moneyOrZero(),
  rewards: moneyOrZero(),
  vehicle_rent: moneyOrZero(),
  equipment_cost: moneyOrZero(),
  private_km: quantity(),
  other_deductions: moneyOrZero(),
  note: optText(500),
});

async function kmRate(ctx: Parameters<Parameters<typeof withContext>[0]>[0]) {
  const ws = (await ctx.store.select("work_settings", { household_id: ctx.household.id }))[0] as WorkSettings | undefined;
  return ws?.private_km_rate ?? 0;
}

export async function saveShift(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(shiftSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (row.peak_minutes > row.minutes) return fail("Čas ve špičce nemůže být delší než celá směna.", { peak_minutes: "Delší než směna" });
    await own(ctx, "members", row.member_id);
    const full = { ...row, private_km_cost: privateKmCost(await kmRate(ctx), row.private_km) };
    if (id) {
      await own(ctx, "work_shifts", id);
      await ctx.store.update("work_shifts", { id, household_id: ctx.household.id }, full);
      return done("Směna upravena");
    }
    const [s] = await ctx.store.insert("work_shifts", [{ ...full, household_id: ctx.household.id, external_id: null }]);
    return done("Směna uložena", s.id);
  });
}

export async function deleteShift(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "work_shifts", id);
    await ctx.store.remove("work_shifts", { id, household_id: ctx.household.id });
    return done("Směna smazána");
  });
}

/** Import směn z CSV – řádky už jsou namapované na pole v prohlížeči (hodnoty jako text). */
export async function importShifts(payload: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    let rows: Record<string, string>[];
    try {
      rows = JSON.parse(payload);
      if (!Array.isArray(rows) || rows.length > 3000) throw new Error();
    } catch {
      return fail("Neplatná data importu.");
    }
    const rate = await kmRate(ctx);
    const existing = new Set((await ctx.store.select("work_shifts", { household_id: ctx.household.id })).map((s) => s.external_id).filter(Boolean));
    const errors: string[] = [];
    const toInsert = [];
    const seen = new Map<string, number>();
    for (const [i, raw] of rows.entries()) {
      const r = shiftSchema.safeParse(raw);
      if (!r.success) {
        errors.push(`Řádek ${i + 1}: ${r.error.issues[0]?.path.join(".")} – ${r.error.issues[0]?.message}`);
        continue;
      }
      const base = JSON.stringify(raw);
      const n = (seen.get(base) ?? 0) + 1;
      seen.set(base, n);
      const external_id = `csv:${fingerprint([base, n])}`;
      if (existing.has(external_id)) continue;
      const { id: _id, ...row } = r.data;
      void _id;
      toInsert.push({ ...row, household_id: ctx.household.id, member_id: null, private_km_cost: privateKmCost(rate, row.private_km), external_id });
    }
    if (errors.length && !toInsert.length) return fail(`Nic nebylo importováno. ${errors.slice(0, 5).join("; ")}`);
    if (toInsert.length) await ctx.store.insert("work_shifts", toInsert);
    return done(`Importováno ${toInsert.length} směn${errors.length ? `, ${errors.length} řádků s chybou (${errors.slice(0, 3).join("; ")})` : ""}.`);
  });
}

const payoutSchema = z.object({
  id: optionalUuid(),
  label: text(120),
  member_id: optionalUuid(),
  period_from: optionalDate(),
  period_to: optionalDate(),
  expected_amount: money(),
  expected_date: date(),
  account_id: optionalUuid(),
  invoice_id: optionalUuid(),
  note: optText(500),
});

export async function savePayout(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(payoutSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (row.period_from && row.period_to && row.period_to < row.period_from) return fail("Konec období je před začátkem.", { period_to: "Před začátkem" });
    await Promise.all([own(ctx, "members", row.member_id), own(ctx, "accounts", row.account_id), own(ctx, "invoices", row.invoice_id)]);
    if (id) {
      await own(ctx, "payouts", id);
      await ctx.store.update("payouts", { id, household_id: ctx.household.id }, row);
      return done("Výplata upravena");
    }
    const [r] = await ctx.store.insert("payouts", [{ ...row, household_id: ctx.household.id, status: "expected", received_amount: null, received_date: null }]);
    return done("Očekávaná výplata přidána", r.id);
  });
}

const receivePayoutSchema = z.object({
  id: uuid(),
  received_amount: money({ min: 0 }),
  received_date: date(),
  account_id: optionalUuid(),
  create_transaction: checkbox(),
});

/** Přijetí výplaty: skutečná částka a datum; volitelně vznikne příjem na účtu (jen jednou). */
export async function receivePayout(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(receivePayoutSchema, fd);
    if (!p.ok) return p.result;
    const d = p.data;
    const payout = (await own(ctx, "payouts", d.id)) as Payout;
    if (payout.status === "received") return fail("Výplata už je přijatá.");
    let txId: string | null = null;
    if (d.create_transaction && d.received_amount > 0) {
      if (!d.account_id) return fail("Vyberte účet, na který výplata přišla.", { account_id: "Vyberte účet" });
      await own(ctx, "accounts", d.account_id);
      const cat = (await ctx.store.select("categories", { household_id: ctx.household.id, kind: "income" })).find((c) => c.name.includes("Rohlík"));
      const [t] = await ctx.store.insert("transactions", [{
        household_id: ctx.household.id, type: "income", status: "posted", amount: d.received_amount, date: d.received_date,
        account_id: d.account_id, transfer_account_id: null, category_id: cat?.id ?? null, description: payout.label,
        member_id: payout.member_id, scope: "shared", is_recurring: false, payment_method: "transfer", source: "payout",
        payout_id: payout.id, cancelled_at: null, note: null,
      }]);
      txId = t.id;
    }
    try {
      await ctx.store.update("payouts", { id: payout.id, household_id: ctx.household.id }, {
        status: "received", received_amount: d.received_amount, received_date: d.received_date, account_id: d.account_id ?? payout.account_id,
      });
    } catch (e) {
      if (txId) await ctx.store.remove("transactions", { id: txId, household_id: ctx.household.id });
      throw e;
    }
    const diff = d.received_amount - payout.expected_amount;
    return done(diff === 0 ? "Výplata přijata – odpovídá očekávání" : `Výplata přijata – rozdíl ${diff > 0 ? "+" : ""}${(diff / 100).toLocaleString("cs-CZ")} Kč`);
  });
}

export async function setPayoutStatus(id: string, status: "expected" | "cancelled"): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const payout = (await own(ctx, "payouts", id)) as Payout;
    const linked = (await ctx.store.select("transactions", { household_id: ctx.household.id, payout_id: id })).filter((t) => t.status === "posted");
    for (const t of linked) await ctx.store.update("transactions", { id: t.id, household_id: ctx.household.id }, { status: "cancelled", cancelled_at: new Date().toISOString() });
    await ctx.store.update("payouts", { id: payout.id, household_id: ctx.household.id }, { status, received_amount: null, received_date: null });
    return done(status === "cancelled" ? "Výplata zrušena" : "Výplata vrácena do očekávaných");
  });
}

export async function deletePayout(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "payouts", id);
    await ctx.store.remove("payouts", { id, household_id: ctx.household.id });
    return done("Výplata smazána – případný příjem zůstal v transakcích");
  });
}

