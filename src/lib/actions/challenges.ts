"use server";
import { z } from "zod";
import { enumOf, optionalUuid } from "@/lib/validation";
import { todayISO } from "@/lib/dates";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const schema = z.object({
  kind: enumOf(["no_takeout", "no_spend_days", "save_amount", "category_cut", "daily_log"]),
  target: z.coerce.number().int().min(0).max(1_000_000_000),
  category_id: optionalUuid(),
});

export async function acceptChallenge(input: { kind: string; target: number; category_id: string | null }): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(schema, input);
    if (!p.ok) return p.result;
    if (p.data.kind === "category_cut" && !p.data.category_id) return fail("Vyberte kategorii.");
    await own(ctx, "categories", p.data.category_id);
    await ctx.store.insert("challenges", [{ ...p.data, household_id: ctx.household.id, month: todayISO().slice(0, 7) }]);
    return done("Výzva přijata – držíme palce! 💪");
  });
}

export async function removeChallenge(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "challenges", id);
    await ctx.store.remove("challenges", { id, household_id: ctx.household.id });
    return done("Výzva zrušena");
  });
}
