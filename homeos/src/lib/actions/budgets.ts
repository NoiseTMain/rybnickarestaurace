"use server";
import { z } from "zod";
import { enumOf, money, optionalUuid } from "@/lib/validation";
import { isISODate, startOfMonth } from "@/lib/dates";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const budgetSchema = z.object({
  kind: enumOf(["food", "category", "total"]),
  category_id: optionalUuid(),
  amount: money(),
  /** prázdné = výchozí pro každý měsíc; „YYYY-MM“ = jen pro konkrétní měsíc */
  month: z.preprocess((v) => (v ? String(v) : null), z.string().regex(/^\d{4}-\d{2}$/, "Neplatný měsíc").nullable()),
});

export async function saveBudget(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(budgetSchema, fd);
    if (!p.ok) return p.result;
    const { kind, amount } = p.data;
    const category_id = kind === "category" ? p.data.category_id : null;
    if (kind === "category" && !category_id) return fail("Vyberte kategorii.", { category_id: "Vyberte kategorii" });
    await own(ctx, "categories", category_id);
    const month = p.data.month ? `${p.data.month}-01` : null;
    if (month && !isISODate(month)) return fail("Neplatný měsíc.");
    const filter = { household_id: ctx.household.id, kind, category_id, month: month ? startOfMonth(month) : null };
    const existing = await ctx.store.select("budgets", filter);
    if (existing.length) await ctx.store.update("budgets", { id: existing[0].id, household_id: ctx.household.id }, { amount });
    else await ctx.store.insert("budgets", [{ ...filter, amount }]);
    return done("Rozpočet uložen – limity jsou přepočítané");
  });
}

export async function deleteBudget(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "budgets", id);
    await ctx.store.remove("budgets", { id, household_id: ctx.household.id });
    return done("Rozpočet odstraněn");
  });
}
