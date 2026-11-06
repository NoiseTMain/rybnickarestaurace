"use server";
import { z } from "zod";
import { checkbox, date, enumOf, int, money, optionalDate, optionalUuid, text, optText, url, uuid } from "@/lib/validation";
import type { Purchase } from "@/lib/db/types";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const purchaseSchema = z.object({
  id: optionalUuid(),
  name: text(160),
  price: money(),
  category_id: optionalUuid(),
  priority: int(1, 5),
  url: url(),
  planned_date: optionalDate(),
  status: enumOf(["planned", "buying", "bought"]),
  is_wish: checkbox(),
  note: optText(1000),
});

export async function savePurchase(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(purchaseSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    await own(ctx, "categories", row.category_id);
    if (id) {
      await own(ctx, "purchases", id);
      await ctx.store.update("purchases", { id, household_id: ctx.household.id }, row);
      return done("Nákup upraven");
    }
    const [r] = await ctx.store.insert("purchases", [{ ...row, household_id: ctx.household.id }]);
    return done("Nákup přidán", r.id);
  });
}

export async function setPurchaseStatus(id: string, status: "planned" | "buying"): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "purchases", id);
    await ctx.store.update("purchases", { id, household_id: ctx.household.id }, { status });
    return done("Stav změněn");
  });
}

const boughtSchema = z.object({ id: uuid(), amount: money({ min: 1 }), date: date(), account_id: optionalUuid(), create_transaction: checkbox() });

/** Označení jako koupeno – volitelně se zapíše výdaj (jen jednou díky purchase_id). */
export async function markBought(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(boughtSchema, fd);
    if (!p.ok) return p.result;
    const d = p.data;
    const pu = (await own(ctx, "purchases", d.id)) as Purchase;
    if (d.create_transaction) {
      if (!d.account_id) return fail("Vyberte účet.", { account_id: "Vyberte účet" });
      await own(ctx, "accounts", d.account_id);
      await ctx.store.insert("transactions", [{
        household_id: ctx.household.id, type: "expense", status: "posted", amount: d.amount, date: d.date, account_id: d.account_id,
        transfer_account_id: null, category_id: pu.category_id, description: pu.name, member_id: null, scope: "shared", is_recurring: false,
        payment_method: "card", source: "purchase", purchase_id: pu.id, cancelled_at: null, note: null,
      }]);
    }
    await ctx.store.update("purchases", { id: pu.id, household_id: ctx.household.id }, { status: "bought" });
    return done("Koupeno!");
  });
}

export async function deletePurchase(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "purchases", id);
    await ctx.store.remove("purchases", { id, household_id: ctx.household.id });
    return done("Nákup smazán");
  });
}
