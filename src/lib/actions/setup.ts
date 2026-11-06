"use server";
import { z } from "zod";
import { checkbox, date, enumOf, money, optionalUuid, text, optText } from "@/lib/validation";
import { MEMBER_COLORS } from "@/lib/defaults";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const color = () => z.preprocess((v) => (v ? v : MEMBER_COLORS[0]), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Neplatná barva"));

const memberSchema = z.object({ id: optionalUuid(), name: text(80), color: color(), is_active: checkbox() });

export async function saveMember(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(memberSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (id) {
      await own(ctx, "members", id);
      await ctx.store.update("members", { id, household_id: ctx.household.id }, row);
      return done("Člen upraven");
    }
    const [m] = await ctx.store.insert("members", [{ ...row, household_id: ctx.household.id, user_id: null, sort: 99 }]);
    return done("Člen přidán", m.id);
  });
}

const accountSchema = z.object({
  id: optionalUuid(),
  name: text(80),
  kind: enumOf(["checking", "cash", "savings"]),
  opening_balance: money({ allowNegative: true }),
  opening_date: date(),
  include_in_available: checkbox(),
  member_id: optionalUuid(),
  is_active: checkbox(),
});

export async function saveAccount(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(accountSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    await own(ctx, "members", row.member_id);
    if (id) {
      await own(ctx, "accounts", id);
      await ctx.store.update("accounts", { id, household_id: ctx.household.id }, row);
      return done("Účet upraven");
    }
    const [a] = await ctx.store.insert("accounts", [{ ...row, household_id: ctx.household.id, sort: 99 }]);
    return done("Účet přidán", a.id);
  });
}

const categorySchema = z.object({
  id: optionalUuid(),
  name: text(60),
  kind: enumOf(["expense", "income"]),
  color: color(),
  icon: z.string().max(40).optional().default("circle"),
  is_food: checkbox(),
  is_household: checkbox(),
  is_archived: checkbox(),
});

export async function saveCategory(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(categorySchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (row.kind === "income") row.is_food = false;
    if (id) {
      await own(ctx, "categories", id);
      await ctx.store.update("categories", { id, household_id: ctx.household.id }, row);
      return done("Kategorie upravena");
    }
    const [c] = await ctx.store.insert("categories", [{ ...row, household_id: ctx.household.id, sort: 99 }]);
    return done("Kategorie přidána", c.id);
  });
}

/** Smazání záznamu z číselníků. Účet s transakcemi smazat nelze – jen archivovat. */
export async function deleteSetupItem(table: "members" | "accounts" | "categories" | "income_sources", id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (!["members", "accounts", "categories", "income_sources"].includes(table)) return fail("Neplatná tabulka.");
    await own(ctx, table, id);
    await ctx.store.remove(table, { id, household_id: ctx.household.id });
    return done("Smazáno");
  });
}

const incomeSchema = z.object({
  id: optionalUuid(),
  name: text(120),
  amount: money({ min: 1 }),
  frequency: enumOf(["once", "weekly", "monthly", "quarterly", "yearly"]),
  start_date: date(),
  end_date: z.preprocess((v) => (v ? v : null), z.string().nullable()),
  member_id: optionalUuid(),
  account_id: optionalUuid(),
  category_id: optionalUuid(),
  is_active: checkbox(),
  note: optText(500),
});

export async function saveIncomeSource(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(incomeSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (row.end_date && row.end_date < row.start_date) return fail("Konec musí být po začátku.", { end_date: "Konec musí být po začátku" });
    await Promise.all([own(ctx, "members", row.member_id), own(ctx, "accounts", row.account_id), own(ctx, "categories", row.category_id)]);
    if (id) {
      await own(ctx, "income_sources", id);
      await ctx.store.update("income_sources", { id, household_id: ctx.household.id }, row);
      return done("Příjem upraven");
    }
    const [r] = await ctx.store.insert("income_sources", [{ ...row, household_id: ctx.household.id }]);
    return done("Příjem přidán", r.id);
  });
}
