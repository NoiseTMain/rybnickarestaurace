"use server";
import { z } from "zod";
import { checkbox, date, enumOf, money, optionalDate, optionalMoney, optionalUuid, text, optText, uuid } from "@/lib/validation";
import { occurrences } from "@/lib/finance/recurrence";
import type { IncomeSource, RecurringPayment } from "@/lib/db/types";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const recurringSchema = z.object({
  id: optionalUuid(),
  name: text(120),
  amount: money({ min: 1 }),
  frequency: enumOf(["once", "weekly", "monthly", "quarterly", "yearly"]),
  start_date: date(),
  end_date: optionalDate(),
  category_id: optionalUuid(),
  account_id: optionalUuid(),
  member_id: optionalUuid(),
  payment_method: enumOf(["card", "cash", "transfer", "direct_debit", "other"]),
  is_debt: checkbox(),
  debt_remaining: optionalMoney(),
  is_active: checkbox(),
  note: optText(500),
});

export async function saveRecurring(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(recurringSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (row.end_date && row.end_date < row.start_date) return fail("Konec musí být po první splatnosti.", { end_date: "Konec musí být po začátku" });
    if (!row.is_debt) row.debt_remaining = null;
    await Promise.all([own(ctx, "categories", row.category_id), own(ctx, "accounts", row.account_id), own(ctx, "members", row.member_id)]);
    if (id) {
      await own(ctx, "recurring_payments", id);
      await ctx.store.update("recurring_payments", { id, household_id: ctx.household.id }, row);
      return done("Platba upravena");
    }
    const [r] = await ctx.store.insert("recurring_payments", [{ ...row, household_id: ctx.household.id }]);
    return done("Pravidelná platba přidána", r.id);
  });
}

export async function deleteRecurring(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "recurring_payments", id);
    await ctx.store.remove("recurring_payments", { id, household_id: ctx.household.id });
    return done("Platba smazána – již zaplacené transakce zůstaly v evidenci");
  });
}

const paySchema = z.object({
  recurring_payment_id: uuid(),
  occurrence_date: date(),
  amount: money({ min: 1 }),
  date: date(),
  account_id: uuid(),
});

/** Zaplacení termínu pravidelné platby → výdaj. Jeden termín = max. jedna transakce (unikátní index). */
export async function payOccurrence(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(paySchema, fd);
    if (!p.ok) return p.result;
    const d = p.data;
    const rp = (await own(ctx, "recurring_payments", d.recurring_payment_id)) as RecurringPayment;
    await own(ctx, "accounts", d.account_id);
    if (!occurrences(rp, d.occurrence_date, d.occurrence_date).length) return fail("Tento termín k platbě nepatří.");
    await ctx.store.remove("occurrence_marks", { household_id: ctx.household.id, recurring_payment_id: rp.id, occurrence_date: d.occurrence_date });
    await ctx.store.insert("transactions", [{
      household_id: ctx.household.id, type: "expense", status: "posted", amount: d.amount, date: d.date, account_id: d.account_id,
      transfer_account_id: null, category_id: rp.category_id, description: rp.name, member_id: rp.member_id, scope: "shared",
      is_recurring: true, payment_method: rp.payment_method, source: "recurring", recurring_payment_id: rp.id,
      occurrence_date: d.occurrence_date, cancelled_at: null, note: null,
    }]);
    if (rp.is_debt && rp.debt_remaining != null) {
      await ctx.store.update("recurring_payments", { id: rp.id, household_id: ctx.household.id }, { debt_remaining: Math.max(0, rp.debt_remaining - d.amount) });
    }
    return done("Platba zaznamenána");
  });
}

/** Označení termínu bez transakce: zaplaceno mimo evidenci / tento termín přeskočit. */
export async function markOccurrence(kind: "recurring" | "income", refId: string, occurrenceDate: string, state: "paid_untracked" | "skipped" | null): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const filter = kind === "recurring" ? { recurring_payment_id: refId } : { income_source_id: refId };
    await own(ctx, kind === "recurring" ? "recurring_payments" : "income_sources", refId);
    await ctx.store.remove("occurrence_marks", { household_id: ctx.household.id, occurrence_date: occurrenceDate, ...filter });
    if (state) {
      await ctx.store.insert("occurrence_marks", [{
        household_id: ctx.household.id, recurring_payment_id: null, income_source_id: null, ...filter, occurrence_date: occurrenceDate, state,
      }]);
    }
    return done(state ? "Termín označen" : "Označení zrušeno");
  });
}

const receiveSchema = z.object({
  income_source_id: uuid(),
  occurrence_date: date(),
  amount: money({ min: 1 }),
  date: date(),
  account_id: uuid(),
});

/** Přijetí očekávaného pravidelného příjmu → příjem na účtu. Teprve pak jsou peníze dostupné. */
export async function receiveIncome(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(receiveSchema, fd);
    if (!p.ok) return p.result;
    const d = p.data;
    const src = (await own(ctx, "income_sources", d.income_source_id)) as IncomeSource;
    await own(ctx, "accounts", d.account_id);
    await ctx.store.insert("transactions", [{
      household_id: ctx.household.id, type: "income", status: "posted", amount: d.amount, date: d.date, account_id: d.account_id,
      transfer_account_id: null, category_id: src.category_id, description: src.name, member_id: src.member_id, scope: "shared",
      is_recurring: true, payment_method: "transfer", source: "income_source", income_source_id: src.id, occurrence_date: d.occurrence_date,
      cancelled_at: null, note: null,
    }]);
    return done("Příjem zaznamenán");
  });
}
