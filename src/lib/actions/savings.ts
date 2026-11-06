"use server";
import { z } from "zod";
import { checkbox, date, enumOf, int, money, optionalDate, optionalMoney, optionalUuid, text, optText, uuid } from "@/lib/validation";
import type { Account, SavingsGoal } from "@/lib/db/types";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const goalSchema = z.object({
  id: optionalUuid(),
  name: text(120),
  kind: enumOf(["reserve", "home", "car", "vacation", "business", "other"]),
  target_amount: money({ min: 1 }),
  target_date: optionalDate(),
  monthly_contribution: optionalMoney(),
  account_id: optionalUuid(),
  color: z.preprocess((v) => v || "#d4b483", z.string().regex(/^#[0-9a-fA-F]{6}$/)),
  priority: int(1, 5),
  status: enumOf(["active", "achieved", "archived"]).default("active"),
  note: optText(500),
  initial_amount: optionalMoney(),
});

export async function saveGoal(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(goalSchema, fd);
    if (!p.ok) return p.result;
    const { id, initial_amount, ...row } = p.data;
    await own(ctx, "accounts", row.account_id);
    if (id) {
      await own(ctx, "savings_goals", id);
      await ctx.store.update("savings_goals", { id, household_id: ctx.household.id }, row);
      return done("Cíl upraven");
    }
    const [g] = await ctx.store.insert("savings_goals", [{ ...row, household_id: ctx.household.id }]);
    if (initial_amount && initial_amount > 0) {
      await ctx.store.insert("savings_contributions", [{ household_id: ctx.household.id, goal_id: g.id, amount: initial_amount, date: new Date().toISOString().slice(0, 10), note: "Počáteční stav" }]);
    }
    return done("Cíl vytvořen", g.id);
  });
}

export async function deleteGoal(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "savings_goals", id);
    await ctx.store.remove("savings_goals", { id, household_id: ctx.household.id });
    return done("Cíl smazán");
  });
}

const contributionSchema = z.object({
  goal_id: uuid(),
  direction: enumOf(["deposit", "withdraw"]),
  amount: money({ min: 1 }),
  date: date(),
  note: optText(300),
  transfer: checkbox(),
  from_account_id: optionalUuid(),
});

/**
 * Vklad/výběr na cíl. Pokud cíl leží na spořicím účtu a uživatel zvolí převod,
 * vznikne i převod mezi účty (peníze opravdu odejdou z běžného účtu).
 * Jinak jde jen o vyčlenění peněz na běžném účtu (rezervace).
 */
export async function addContribution(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(contributionSchema, fd);
    if (!p.ok) return p.result;
    const d = p.data;
    const goal = (await own(ctx, "savings_goals", d.goal_id)) as SavingsGoal;
    const amount = d.direction === "deposit" ? d.amount : -d.amount;
    if (d.direction === "withdraw") {
      const saved = (await ctx.store.select("savings_contributions", { household_id: ctx.household.id, goal_id: goal.id })).reduce((a, c) => a + c.amount, 0);
      if (d.amount > saved) return fail("Nelze vybrat víc, než je na cíli naspořeno.", { amount: "Více než naspořeno" });
    }
    let goalAccount: Account | null = null;
    if (d.transfer) {
      if (!goal.account_id) return fail("Cíl nemá přiřazený účet – nelze vytvořit převod.");
      goalAccount = (await own(ctx, "accounts", goal.account_id)) as Account;
      if (!d.from_account_id) return fail("Vyberte účet, ze kterého peníze převádíte.", { from_account_id: "Vyberte účet" });
      if (d.from_account_id === goalAccount.id) return fail("Zdrojový účet je stejný jako účet cíle.", { from_account_id: "Jiný účet" });
      await own(ctx, "accounts", d.from_account_id);
    }
    const [c] = await ctx.store.insert("savings_contributions", [{ household_id: ctx.household.id, goal_id: goal.id, amount, date: d.date, note: d.note }]);
    if (d.transfer && goalAccount && d.from_account_id) {
      try {
        await ctx.store.insert("transactions", [{
          household_id: ctx.household.id, type: "transfer", status: "posted", amount: d.amount, date: d.date,
          account_id: d.direction === "deposit" ? d.from_account_id : goalAccount.id,
          transfer_account_id: d.direction === "deposit" ? goalAccount.id : d.from_account_id,
          category_id: null, description: `${d.direction === "deposit" ? "Spoření" : "Výběr ze spoření"}: ${goal.name}`, member_id: null,
          scope: "shared", is_recurring: false, payment_method: "transfer", source: "savings", contribution_id: c.id, cancelled_at: null, note: d.note,
        }]);
      } catch (e) {
        await ctx.store.remove("savings_contributions", { id: c.id, household_id: ctx.household.id });
        throw e;
      }
    }
    return done(d.direction === "deposit" ? "Vklad zaznamenán" : "Výběr zaznamenán");
  });
}

export async function deleteContribution(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "savings_contributions", id);
    const linked = await ctx.store.select("transactions", { household_id: ctx.household.id, contribution_id: id });
    for (const t of linked) {
      await ctx.store.update("transactions", { id: t.id, household_id: ctx.household.id }, { status: "cancelled", cancelled_at: new Date().toISOString(), contribution_id: null });
    }
    await ctx.store.remove("savings_contributions", { id, household_id: ctx.household.id });
    return done(linked.length ? "Vklad smazán a související převod stornován" : "Vklad smazán");
  });
}
