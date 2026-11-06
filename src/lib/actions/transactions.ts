"use server";
import { z } from "zod";
import { checkbox, date, enumOf, money, optionalUuid, optText, uuid } from "@/lib/validation";
import { fingerprint } from "@/lib/csv";
import { addDays, isISODate } from "@/lib/dates";
import type { AppContext } from "@/lib/context";
import type { Transaction } from "@/lib/db/types";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

const txSchema = z.object({
  id: optionalUuid(),
  type: enumOf(["income", "expense", "transfer"]),
  amount: money({ min: 1 }),
  date: date(),
  account_id: uuid(),
  transfer_account_id: optionalUuid(),
  category_id: optionalUuid(),
  description: z.preprocess((v) => (typeof v === "string" ? v.trim() : ""), z.string().max(200, "Nejvýše 200 znaků")),
  member_id: optionalUuid(),
  scope: enumOf(["shared", "personal"]).default("shared"),
  is_recurring: checkbox(),
  payment_method: enumOf(["card", "cash", "transfer", "direct_debit", "other"]).default("card"),
  note: optText(1000),
  document_id: optionalUuid(),
});

export async function saveTransaction(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(txSchema, fd);
    if (!p.ok) return p.result;
    const { id, ...row } = p.data;
    if (row.type === "transfer") {
      if (!row.transfer_account_id) return fail("Vyberte cílový účet.", { transfer_account_id: "Vyberte cílový účet" });
      if (row.transfer_account_id === row.account_id) return fail("Zdrojový a cílový účet musí být různé.", { transfer_account_id: "Musí být jiný účet" });
      row.category_id = null;
    } else row.transfer_account_id = null;
    if (row.type !== "transfer" && !row.description && !row.category_id) return fail("Vyplňte popis nebo kategorii.", { description: "Vyplňte popis nebo kategorii" });
    await Promise.all([
      own(ctx, "accounts", row.account_id), own(ctx, "accounts", row.transfer_account_id), own(ctx, "categories", row.category_id),
      own(ctx, "members", row.member_id), own(ctx, "documents", row.document_id),
    ]);
    if (id) {
      const existing = (await own(ctx, "transactions", id)) as Transaction;
      if (existing.status === "cancelled") return fail("Stornovanou transakci nelze upravit – nejprve ji obnovte.");
      await ctx.store.update("transactions", { id, household_id: ctx.household.id }, row);
      return done("Transakce upravena – přehledy jsou přepočítané");
    }
    const [t] = await ctx.store.insert("transactions", [{ ...row, household_id: ctx.household.id, status: "posted", source: "manual", cancelled_at: null }]);
    return done(row.type === "income" ? "Příjem uložen" : row.type === "expense" ? "Výdaj uložen" : "Převod uložen", t.id);
  });
}

/** Navazující záznamy po stornu – aby žádný přehled nepočítal se zrušenou platbou. */
async function afterCancel(ctx: AppContext, t: Transaction) {
  const h = ctx.household.id;
  if (t.payout_id) await ctx.store.update("payouts", { id: t.payout_id, household_id: h }, { status: "expected", received_amount: null, received_date: null });
  if (t.invoice_id) await ctx.store.update("invoices", { id: t.invoice_id, household_id: h, status: "paid" }, { status: "unpaid", paid_date: null });
  if (t.purchase_id) await ctx.store.update("purchases", { id: t.purchase_id, household_id: h, status: "bought" }, { status: "buying" });
  if (t.shopping_list_id) await ctx.store.update("shopping_lists", { id: t.shopping_list_id, household_id: h }, { status: "open" });
  if (t.contribution_id) {
    const cid = t.contribution_id;
    await ctx.store.update("transactions", { id: t.id, household_id: h }, { contribution_id: null });
    await ctx.store.remove("savings_contributions", { id: cid, household_id: h });
  }
}

export async function cancelTransaction(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const t = (await own(ctx, "transactions", id)) as Transaction;
    if (t.status === "cancelled") return fail("Transakce už je stornovaná.");
    await ctx.store.update("transactions", { id, household_id: ctx.household.id }, { status: "cancelled", cancelled_at: new Date().toISOString() });
    await afterCancel(ctx, t);
    return done("Transakce stornována – přehledy jsou přepočítané");
  });
}

export async function restoreTransaction(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const t = (await own(ctx, "transactions", id)) as Transaction;
    if (t.status !== "cancelled") return fail("Transakce není stornovaná.");
    // obnovení může narazit na unikátní omezení (termín mezitím zaplacen jinou platbou) → chyba, nic se nezapočte dvakrát
    await ctx.store.update("transactions", { id, household_id: ctx.household.id }, { status: "posted", cancelled_at: null, payout_id: null, invoice_id: null, purchase_id: null, shopping_list_id: null });
    return done("Transakce obnovena");
  });
}

export async function deleteTransaction(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const t = (await own(ctx, "transactions", id)) as Transaction;
    if (t.status === "posted") await afterCancel(ctx, t);
    await ctx.store.remove("transactions", { id, household_id: ctx.household.id });
    return done("Transakce smazána");
  });
}

// ---------------------------------------------------------------------------
// Import bankovních transakcí z CSV

const importRow = z.object({
  date: z.string().refine(isISODate, "Neplatné datum"),
  amount: z.number().int().refine((n) => n !== 0, "Nulová částka"),
  description: z.string().max(200),
  counterparty: z.string().max(200).optional().default(""),
  reference: z.string().max(100).optional().default(""),
  category_id: z.string().uuid().nullable().optional(),
  include: z.boolean().optional().default(true),
});
const importSchema = z.object({ account_id: z.string().uuid(), rows: z.array(importRow).min(1).max(5000) });

export type ImportRowInput = z.input<typeof importRow>;

export interface ImportAnalysis {
  ok: boolean;
  error?: string;
  rows?: { index: number; externalId: string; status: "new" | "imported" | "possible_duplicate" | "before_opening"; categoryId: string | null; matchDescription?: string }[];
}

const FOOD_SHOPS = /(albert|lidl|billa|tesco|kaufland|penny|globus|rohlik|kosik|coop|norma|potravin|zabka|makro)/i;
const RULES: [RegExp, string][] = [
  [FOOD_SHOPS, "Potraviny"],
  [/(dm drogerie|rossmann|teta drogerie|drogerie)/i, "Drogerie"],
  [/(cez|pre |e\.on|eon|innogy|elektr)/i, "Elektřina"],
  [/(plyn|ppas|gas)/i, "Plyn"],
  [/(vodafone|t-mobile|o2 |telefon)/i, "Telefony"],
  [/(upc|vodafone internet|internet)/i, "Internet"],
  [/(shell|omv|benzina|orlen|mol |cerpaci|parkov)/i, "Auto"],
  [/(dpp|cd\.cz|regiojet|leo express|jizdenk|bolt|uber)/i, "Doprava"],
  [/(restaur|bistro|kavarn|mcdonald|kfc|wolt|foodora|pizza)/i, "Restaurace"],
  [/(pojist|kooperativa|allianz|generali|uniqa|cpp)/i, "Pojištění"],
  [/(najem|najemne)/i, "Nájem"],
  [/(netflix|spotify|hbo|disney|kino|steam)/i, "Zábava"],
  [/(rohlik.*vyplat|velka pecka|rohlik\.cz.*mzd)/i, "Práce – Rohlík"],
];

function rowIds(accountId: string, rows: { date: string; amount: number; description: string; reference?: string }[]) {
  const seen = new Map<string, number>();
  return rows.map((r) => {
    const base = [accountId, r.date, r.amount, r.description.trim().toLowerCase(), r.reference ?? ""].join("|");
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return `csv:${fingerprint([base, n])}`;
  });
}

export async function analyzeBankImport(payload: string): Promise<ImportAnalysis> {
  const res = await withContext(async (ctx) => {
    const p = parse(importSchema, JSON.parse(payload));
    if (!p.ok) return p.result;
    const { account_id, rows } = p.data;
    const account = await own(ctx, "accounts", account_id);
    const [txs, categories] = await Promise.all([
      ctx.store.select("transactions", { household_id: ctx.household.id, account_id }),
      ctx.store.select("categories", { household_id: ctx.household.id }),
    ]);
    const imported = new Set(txs.map((t) => t.external_id).filter(Boolean));
    const manual = txs.filter((t) => t.status === "posted" && !t.external_id);
    const ids = rowIds(account_id, rows);
    const out: NonNullable<ImportAnalysis["rows"]> = rows.map((r, index) => {
      const externalId = ids[index];
      const text = `${r.description} ${r.counterparty}`;
      const isIncome = r.amount > 0;
      const rule = RULES.find(([re, name]) => re.test(text) && categories.some((c) => c.name === name && c.kind === (isIncome ? "income" : "expense")));
      const categoryId = rule ? categories.find((c) => c.name === rule[1])!.id : null;
      if (imported.has(externalId)) return { index, externalId, status: "imported", categoryId };
      const match = manual.find((t) => t.amount === Math.abs(r.amount) && t.type === (isIncome ? "income" : "expense") && t.date >= addDays(r.date, -3) && t.date <= addDays(r.date, 3));
      if (match) return { index, externalId, status: "possible_duplicate", categoryId: match.category_id ?? categoryId, matchDescription: `${match.date} ${match.description}` };
      if (account && r.date < (account as { opening_date: string }).opening_date) return { index, externalId, status: "before_opening", categoryId };
      return { index, externalId, status: "new", categoryId };
    });
    return { ok: true, message: JSON.stringify(out) };
  });
  if (!res.ok) return { ok: false, error: res.error ?? "Analýza selhala" };
  return { ok: true, rows: JSON.parse(res.message!) };
}

export async function commitBankImport(payload: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(importSchema, JSON.parse(payload));
    if (!p.ok) return p.result;
    const { account_id, rows } = p.data;
    await own(ctx, "accounts", account_id);
    const categories = new Set((await ctx.store.select("categories", { household_id: ctx.household.id })).map((c) => c.id));
    const existing = new Set((await ctx.store.select("transactions", { household_id: ctx.household.id, account_id })).map((t) => t.external_id).filter(Boolean));
    const ids = rowIds(account_id, rows);
    const toInsert = rows
      .map((r, i) => ({ r, externalId: ids[i] }))
      .filter(({ r, externalId }) => r.include && !existing.has(externalId))
      .map(({ r, externalId }) => ({
        household_id: ctx.household.id, type: (r.amount > 0 ? "income" : "expense") as Transaction["type"], status: "posted" as const,
        amount: Math.abs(r.amount), date: r.date, account_id, transfer_account_id: null,
        category_id: r.category_id && categories.has(r.category_id) ? r.category_id : null,
        description: (r.description || r.counterparty || "Bankovní pohyb").slice(0, 200), member_id: null, scope: "shared" as const,
        is_recurring: false, payment_method: "transfer" as const, source: "csv" as const, external_id: externalId,
        note: [r.counterparty, r.reference ? `VS ${r.reference}` : ""].filter(Boolean).join(" · ") || null, cancelled_at: null,
      }));
    if (!toInsert.length) return done("Nic nového k importu – všechny vybrané řádky už jsou v evidenci.");
    await ctx.store.insert("transactions", toInsert);
    const skipped = rows.length - toInsert.length;
    return done(`Importováno ${toInsert.length} transakcí${skipped ? `, ${skipped} přeskočeno` : ""}.`);
  });
}
