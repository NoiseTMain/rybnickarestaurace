"use server";
import { z } from "zod";
import { checkbox, date, enumOf, int, money, moneyOrZero, optionalUuid, optText, text } from "@/lib/validation";
import type { AppContext } from "@/lib/context";
import { addMonths, todayISO } from "@/lib/dates";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

/** Uloží (přepíše) stav čistého jmění za aktuální měsíc – pro graf vývoje. */
async function snapshot(ctx: AppContext) {
  const { netWorth } = await import("@/lib/finance/networth");
  const { loadSnapshot } = await import("@/lib/data");
  const [{ snapshot: s }, assets, debts] = await Promise.all([loadSnapshot(ctx), ctx.store.select("assets", { household_id: ctx.household.id }), ctx.store.select("debts", { household_id: ctx.household.id })]);
  const nw = netWorth(s.balance.total, assets, debts);
  const month = todayISO().slice(0, 7);
  const prev = await ctx.store.select("net_worth_snapshots", { household_id: ctx.household.id, month });
  if (prev.length) await ctx.store.update("net_worth_snapshots", { id: prev[0].id, household_id: ctx.household.id }, { assets: nw.assets, liabilities: nw.liabilities });
  else await ctx.store.insert("net_worth_snapshots", [{ household_id: ctx.household.id, month, assets: nw.assets, liabilities: nw.liabilities }]);
}

const assetSchema = z.object({
  id: optionalUuid(),
  name: text(120),
  kind: enumOf(["investment", "property", "vehicle", "pension", "other"]),
  value: money({ min: 0 }),
  note: optText(500),
});

export async function saveAsset(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(assetSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (id) { await own(ctx, "assets", id); await ctx.store.update("assets", { id, household_id: ctx.household.id }, { ...row, updated_at: new Date().toISOString() }); }
    else await ctx.store.insert("assets", [{ ...row, household_id: ctx.household.id }]);
    await snapshot(ctx);
    return done(id ? "Majetek upraven" : "Majetek přidán");
  });
}

export async function deleteAsset(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "assets", id);
    await ctx.store.remove("assets", { id, household_id: ctx.household.id });
    await snapshot(ctx);
    return done("Smazáno");
  });
}

const debtSchema = z.object({
  id: optionalUuid(),
  name: text(120),
  balance: money({ min: 0 }),
  rate: z.preprocess((v) => (v === "" || v == null ? 0 : Number(String(v).replace(",", "."))), z.number({ message: "Zadejte číslo" }).min(0, "Nejméně 0").max(200, "Nejvýše 200 %")),
  min_payment: moneyOrZero(),
  note: optText(500),
});

export async function saveDebt(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(debtSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (id) { await own(ctx, "debts", id); await ctx.store.update("debts", { id, household_id: ctx.household.id }, row); }
    else await ctx.store.insert("debts", [{ ...row, household_id: ctx.household.id }]);
    await snapshot(ctx);
    return done(id ? "Dluh upraven" : "Dluh přidán");
  });
}

export async function deleteDebt(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "debts", id);
    await ctx.store.remove("debts", { id, household_id: ctx.household.id });
    await snapshot(ctx);
    return done("Smazáno");
  });
}

const reminderSchema = z.object({
  id: optionalUuid(),
  title: text(120),
  kind: enumOf(["warranty", "stk", "insurance", "fixation", "contract", "document", "tax", "other"]),
  due_date: date(),
  notify_days: int(0, 365),
  repeat_yearly: checkbox(),
  note: optText(500),
});

export async function saveReminder(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(reminderSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (id) { await own(ctx, "reminders", id); await ctx.store.update("reminders", { id, household_id: ctx.household.id }, row); return done("Termín upraven"); }
    await ctx.store.insert("reminders", [{ ...row, done: false, household_id: ctx.household.id }]);
    return done("Termín přidán");
  });
}

/** Hotovo: opakovaný termín se posune o rok, jinak se označí jako vyřízený. */
export async function completeReminder(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const r = await own(ctx, "reminders", id);
    if (!r) return fail("Termín nenalezen");
    if (r.repeat_yearly) {
      await ctx.store.update("reminders", { id, household_id: ctx.household.id }, { due_date: addMonths(r.due_date, 12) });
      return done("Hotovo – další termín za rok");
    }
    await ctx.store.update("reminders", { id, household_id: ctx.household.id }, { done: !r.done });
    return done(r.done ? "Vráceno mezi aktivní" : "Hotovo");
  });
}

export async function deleteReminder(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "reminders", id);
    await ctx.store.remove("reminders", { id, household_id: ctx.household.id });
    return done("Smazáno");
  });
}
