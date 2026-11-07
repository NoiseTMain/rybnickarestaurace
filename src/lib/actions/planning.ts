"use server";
import { z } from "zod";
import { date, money, optionalDate, optionalMoney, optText, optionalUuid, text, uuid } from "@/lib/validation";
import type { ShoppingList } from "@/lib/db/types";
import { itemKey } from "@/lib/shops";
import { addDays, todayISO } from "@/lib/dates";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const listSchema = z.object({ id: optionalUuid(), name: text(120), planned_date: optionalDate(), note: optText(500) });

export async function saveShoppingList(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(listSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (id) {
      await own(ctx, "shopping_lists", id);
      await ctx.store.update("shopping_lists", { id, household_id: ctx.household.id }, row);
      return done("Seznam upraven");
    }
    const [l] = await ctx.store.insert("shopping_lists", [{ ...row, household_id: ctx.household.id, status: "open" }]);
    return done("Seznam vytvořen", l.id);
  });
}

const itemSchema = z.object({ list_id: uuid(), name: text(120), quantity: optText(30), est_price: optionalMoney(), store: optText(40) });

export async function addShoppingItem(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(itemSchema, fd);
    if (!p.ok) return p.result;
    const list = (await own(ctx, "shopping_lists", p.data.list_id)) as ShoppingList;
    if (list.status === "done") return fail("Seznam je už nakoupený.");
    const count = (await ctx.store.select("shopping_items", { household_id: ctx.household.id, list_id: list.id })).length;
    await ctx.store.insert("shopping_items", [{ ...p.data, household_id: ctx.household.id, checked: false, sort: count }]);
    return done("");
  });
}

export async function toggleShoppingItem(id: string, checked: boolean): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "shopping_items", id);
    await ctx.store.update("shopping_items", { id, household_id: ctx.household.id }, { checked });
    return done("");
  });
}

export async function updateItemPrice(id: string, value: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "shopping_items", id);
    const r = optionalMoney().safeParse(value);
    if (!r.success) return fail("Neplatná částka");
    await ctx.store.update("shopping_items", { id, household_id: ctx.household.id }, { est_price: r.data });
    return done("");
  });
}

export async function deleteShoppingItem(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "shopping_items", id);
    await ctx.store.remove("shopping_items", { id, household_id: ctx.household.id });
    return done("");
  });
}

export async function deleteShoppingList(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "shopping_lists", id);
    await ctx.store.remove("shopping_lists", { id, household_id: ctx.household.id });
    return done("Seznam smazán – případný výdaj zůstal v transakcích");
  });
}

/** Kopie seznamu (např. pravidelný týdenní nákup) – položky bez odškrtnutí. */
export async function duplicateShoppingList(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const list = (await own(ctx, "shopping_lists", id)) as ShoppingList;
    const items = await ctx.store.select("shopping_items", { household_id: ctx.household.id, list_id: id });
    const [copy] = await ctx.store.insert("shopping_lists", [{ household_id: ctx.household.id, name: `${list.name} (kopie)`.slice(0, 120), planned_date: null, status: "open", note: list.note }]);
    if (items.length) {
      await ctx.store.insert("shopping_items", items.sort((a, b) => a.sort - b.sort).map((i, n) => ({ household_id: ctx.household.id, list_id: copy.id, name: i.name, quantity: i.quantity, est_price: i.est_price, checked: false, sort: n })));
    }
    return done("Seznam zkopírován", copy.id);
  });
}

const completeSchema = z.object({ id: uuid(), amount: money({ min: 1 }), date: date(), account_id: uuid(), category_id: optionalUuid(), note: optText(300) });

/** Nakoupeno: zapíše výdaj (jen jednou díky vazbě shopping_list_id) a uzavře seznam. */
export async function completeShoppingList(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(completeSchema, fd);
    if (!p.ok) return p.result;
    const d = p.data;
    const list = (await own(ctx, "shopping_lists", d.id)) as ShoppingList;
    if (list.status === "done") return fail("Seznam je už nakoupený.");
    await Promise.all([own(ctx, "accounts", d.account_id), own(ctx, "categories", d.category_id)]);
    const [t] = await ctx.store.insert("transactions", [{
      household_id: ctx.household.id, type: "expense", status: "posted", amount: d.amount, date: d.date, account_id: d.account_id,
      transfer_account_id: null, category_id: d.category_id, description: `Nákup: ${list.name}`.slice(0, 200), member_id: null, scope: "shared",
      is_recurring: false, payment_method: "card", source: "shopping", shopping_list_id: list.id, cancelled_at: null, note: d.note,
    }]);
    try {
      await ctx.store.update("shopping_lists", { id: list.id, household_id: ctx.household.id }, { status: "done" });
    } catch (e) {
      await ctx.store.remove("transactions", { id: t.id, household_id: ctx.household.id });
      throw e;
    }
    // cenová paměť: koupené položky s cenou se zapamatují pro příští návrhy
    const items = (await ctx.store.select("shopping_items", { household_id: ctx.household.id, list_id: list.id })).filter((i) => i.checked && i.est_price);
    if (items.length) {
      await ctx.store.insert("price_history", items.map((i) => ({
        household_id: ctx.household.id, item_key: itemKey(i.name) || i.name.toLowerCase(), name: i.name, quantity: i.quantity, store: i.store, price: i.est_price!, date: d.date,
      }))).catch(() => undefined);
    }
    return done("Nakoupeno – výdaj zapsán a rozpočet na jídlo přepočítán");
  });
}

export async function reopenShoppingList(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "shopping_lists", id);
    const linked = (await ctx.store.select("transactions", { household_id: ctx.household.id, shopping_list_id: id })).filter((t) => t.status === "posted");
    for (const t of linked) await ctx.store.update("transactions", { id: t.id, household_id: ctx.household.id }, { status: "cancelled", cancelled_at: new Date().toISOString() });
    await ctx.store.update("shopping_lists", { id, household_id: ctx.household.id }, { status: "open" });
    return done(linked.length ? "Seznam znovu otevřen, výdaj stornován" : "Seznam znovu otevřen");
  });
}

export interface PriceSuggestion {
  history: { store: string | null; price: number; date: string; quantity: string | null }[];
  average: number | null;
  cheapest: { store: string | null; price: number } | null;
  ai: { low: number; high: number; typical: number; note: string } | null;
}

/** Návrh ceny položky: z vaší cenové paměti (posledních 90 dní), případně odhad AI. */
export async function suggestPrice(name: string, quantity?: string | null): Promise<PriceSuggestion> {
  const ctx = await (await import("@/lib/context")).requireContext();
  const key = itemKey(String(name));
  const empty: PriceSuggestion = { history: [], average: null, cheapest: null, ai: null };
  if (key.length < 2) return empty;
  const since = addDays(todayISO(), -90);
  const rows = (await ctx.store.select("price_history", { household_id: ctx.household.id, item_key: key }))
    .filter((r) => r.date >= since)
    .sort((a, b) => b.date.localeCompare(a.date));
  const latestPerStore = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!latestPerStore.has(r.store ?? "")) latestPerStore.set(r.store ?? "", r);
  const history = [...latestPerStore.values()].map((r) => ({ store: r.store, price: r.price, date: r.date, quantity: r.quantity }));
  const average = rows.length ? Math.round(rows.reduce((a, r) => a + r.price, 0) / rows.length) : null;
  const cheapest = history.length ? history.reduce((m, h) => (h.price < m.price ? h : m)) : null;
  let ai: PriceSuggestion["ai"] = null;
  if (!rows.length) {
    const { estimateGroceryPrice } = await import("@/lib/ai");
    ai = await estimateGroceryPrice(String(name).slice(0, 120), quantity ?? null).catch(() => null);
  }
  return { history, average, cheapest: cheapest ? { store: cheapest.store, price: cheapest.price } : null, ai };
}
