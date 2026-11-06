"use server";
import { z } from "zod";
import { checkbox, date, enumOf, ico, money, optionalDate, optionalUuid, text, optText, uuid } from "@/lib/validation";
import { addDays, todayISO } from "@/lib/dates";
import type { Invoice, Transaction } from "@/lib/db/types";
import { done, fail, own, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

/** Faktury starší než tato hranice se do plánu NEzahrnují automaticky. */
const STALE_DAYS = 60;

const invoiceSchema = z.object({
  id: optionalUuid(),
  direction: enumOf(["issued", "received"]),
  number: text(60),
  counterparty: text(200),
  counterparty_ico: ico(),
  issue_date: date(),
  due_date: optionalDate(),
  amount: money({ min: 1 }),
  note: optText(1000),
  document_id: optionalUuid(),
  include_in_plan: z.preprocess((v) => (v == null ? undefined : v === "on" || v === "true"), z.boolean().optional()),
  ocr_used: checkbox(),
  ocr_confirmed: checkbox(),
});

export async function saveInvoice(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(invoiceSchema, fd);
    if (!p.ok) return p.result;
    const { id, ocr_confirmed, include_in_plan, ...row } = p.data;
    // OCR nikdy neukládá bez výslovného potvrzení uživatele
    if (row.ocr_used && !ocr_confirmed) {
      return fail("Údaje byly rozpoznány automaticky. Zkontrolujte je a potvrďte zaškrtnutím.", { ocr_confirmed: "Potvrďte kontrolu údajů" });
    }
    if (row.due_date && row.due_date < row.issue_date) return fail("Splatnost nemůže být před datem vystavení.", { due_date: "Před vystavením" });
    await own(ctx, "documents", row.document_id);
    const stale = row.issue_date < addDays(todayISO(), -STALE_DAYS);
    if (id) {
      await own(ctx, "invoices", id);
      await ctx.store.update("invoices", { id, household_id: ctx.household.id }, { ...row, ...(include_in_plan != null ? { include_in_plan } : {}) });
      return done("Faktura upravena");
    }
    const [inv] = await ctx.store.insert("invoices", [{
      ...row, household_id: ctx.household.id, status: "unpaid", paid_date: null,
      include_in_plan: include_in_plan ?? !stale,
    }]);
    if (row.document_id) await ctx.store.update("documents", { id: row.document_id, household_id: ctx.household.id }, { kind: "invoice" });
    return done(stale && include_in_plan == null ? "Faktura uložena. Je starší než 60 dní, proto se nezapočítává do plánu (lze změnit)." : "Faktura uložena", inv.id);
  });
}

const paySchema = z.object({
  id: uuid(),
  paid_date: date(),
  mode: enumOf(["create", "link", "none"]),
  account_id: optionalUuid(),
  transaction_id: optionalUuid(),
});

/**
 * Úhrada faktury. Aby se platba nezapočetla dvakrát, lze ji propojit
 * s existující transakcí (např. importovanou z banky nebo výplatou).
 */
export async function payInvoice(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const p = parse(paySchema, fd);
    if (!p.ok) return p.result;
    const d = p.data;
    const inv = (await own(ctx, "invoices", d.id)) as Invoice;
    if (inv.status !== "unpaid") return fail("Faktura není nezaplacená.");
    if (d.paid_date < inv.issue_date) return fail("Datum úhrady je před vystavením.", { paid_date: "Před vystavením" });
    const h = ctx.household.id;
    let created: string | null = null;
    if (d.mode === "create") {
      if (!d.account_id) return fail("Vyberte účet.", { account_id: "Vyberte účet" });
      await own(ctx, "accounts", d.account_id);
      const [t] = await ctx.store.insert("transactions", [{
        household_id: h, type: inv.direction === "issued" ? "income" : "expense", status: "posted", amount: inv.amount,
        date: d.paid_date, account_id: d.account_id, transfer_account_id: null, category_id: null,
        description: `Faktura ${inv.number} – ${inv.counterparty}`, member_id: null, scope: "shared", is_recurring: false,
        payment_method: "transfer", source: "invoice", invoice_id: inv.id, document_id: inv.document_id, cancelled_at: null, note: null,
      }]);
      created = t.id;
    } else if (d.mode === "link") {
      if (!d.transaction_id) return fail("Vyberte transakci.", { transaction_id: "Vyberte transakci" });
      const t = (await own(ctx, "transactions", d.transaction_id)) as Transaction;
      if (t.status !== "posted") return fail("Transakce je stornovaná.");
      if (t.invoice_id && t.invoice_id !== inv.id) return fail("Transakce už je propojená s jinou fakturou.");
      await ctx.store.update("transactions", { id: t.id, household_id: h }, { invoice_id: inv.id });
    }
    try {
      await ctx.store.update("invoices", { id: inv.id, household_id: h }, { status: "paid", paid_date: d.paid_date });
    } catch (e) {
      if (created) await ctx.store.remove("transactions", { id: created, household_id: h });
      throw e;
    }
    return done("Faktura označena jako zaplacená");
  });
}

export async function setInvoiceStatus(id: string, status: "unpaid" | "cancelled"): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const inv = (await own(ctx, "invoices", id)) as Invoice;
    const h = ctx.household.id;
    const linked = (await ctx.store.select("transactions", { household_id: h, invoice_id: id })).filter((t) => t.status === "posted");
    for (const t of linked) {
      if (t.source === "invoice") await ctx.store.update("transactions", { id: t.id, household_id: h }, { status: "cancelled", cancelled_at: new Date().toISOString() });
      else await ctx.store.update("transactions", { id: t.id, household_id: h }, { invoice_id: null });
    }
    await ctx.store.update("invoices", { id: inv.id, household_id: h }, { status, paid_date: null });
    return done(status === "cancelled" ? "Faktura stornována" : "Faktura vrácena mezi nezaplacené");
  });
}

export async function toggleInvoicePlan(id: string, include: boolean): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "invoices", id);
    await ctx.store.update("invoices", { id, household_id: ctx.household.id }, { include_in_plan: include });
    return done(include ? "Faktura se započítává do plánu" : "Faktura se nezapočítává do plánu");
  });
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "invoices", id);
    const linked = (await ctx.store.select("transactions", { household_id: ctx.household.id, invoice_id: id })).filter((t) => t.status === "posted" && t.source === "invoice");
    for (const t of linked) await ctx.store.update("transactions", { id: t.id, household_id: ctx.household.id }, { status: "cancelled", cancelled_at: new Date().toISOString() });
    await ctx.store.remove("invoices", { id, household_id: ctx.household.id });
    return done("Faktura smazána (dokument zůstal v archivu)");
  });
}
