import { sum, type Cents } from "@/lib/money";
import { addDays, type ISODate } from "@/lib/dates";
import type { IncomeSource, Invoice, OccurrenceMark, RecurringPayment, Transaction } from "@/lib/db/types";
import { occurrences } from "./recurrence";

/** Jak daleko do minulosti hledáme neuhrazené termíny. Starší se automaticky NEpovažují za aktuální. */
export const OVERDUE_LOOKBACK_DAYS = 45;

export type OccurrenceState = "paid" | "paid_untracked" | "skipped" | "due" | "overdue" | "upcoming";

export interface PaymentOccurrence {
  key: string;
  kind: "recurring" | "invoice" | "trip";
  refId: string;
  name: string;
  date: ISODate;
  amount: Cents;
  categoryId: string | null;
  isDebt: boolean;
  state: OccurrenceState;
  transactionId: string | null;
}

function stateFor(date: ISODate, today: ISODate, paid: boolean, mark?: OccurrenceMark): OccurrenceState {
  if (paid) return "paid";
  if (mark) return mark.state;
  if (date < today) return "overdue";
  if (date === today) return "due";
  return "upcoming";
}

/** Termíny pravidelných plateb v intervalu se stavem úhrady. */
export function recurringOccurrences(
  payments: readonly RecurringPayment[],
  txs: readonly Transaction[],
  marks: readonly OccurrenceMark[],
  from: ISODate,
  to: ISODate,
  today: ISODate,
): PaymentOccurrence[] {
  const paidKeys = new Map<string, string>();
  for (const t of txs) {
    if (t.status === "posted" && t.recurring_payment_id && t.occurrence_date) {
      paidKeys.set(`${t.recurring_payment_id}|${t.occurrence_date}`, t.id);
    }
  }
  const markMap = new Map(marks.filter((m) => m.recurring_payment_id).map((m) => [`${m.recurring_payment_id}|${m.occurrence_date}`, m]));
  const out: PaymentOccurrence[] = [];
  for (const p of payments) {
    if (!p.is_active) continue;
    for (const date of occurrences(p, from, to)) {
      const key = `${p.id}|${date}`;
      const txId = paidKeys.get(key) ?? null;
      out.push({
        key, kind: "recurring", refId: p.id, name: p.name, date, amount: p.amount,
        categoryId: p.category_id, isDebt: p.is_debt,
        state: stateFor(date, today, txId != null, markMap.get(key)), transactionId: txId,
      });
    }
  }
  return out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name, "cs")));
}

export interface ExpectedIncome {
  key: string;
  kind: "income_source" | "payout" | "invoice";
  refId: string;
  name: string;
  date: ISODate;
  amount: Cents;
  received: boolean;
  late: boolean;
}

export function incomeOccurrences(
  sources: readonly IncomeSource[],
  txs: readonly Transaction[],
  marks: readonly OccurrenceMark[],
  from: ISODate,
  to: ISODate,
  today: ISODate,
): ExpectedIncome[] {
  const got = new Set<string>();
  for (const t of txs) {
    if (t.status === "posted" && t.income_source_id && t.occurrence_date) got.add(`${t.income_source_id}|${t.occurrence_date}`);
  }
  for (const m of marks) if (m.income_source_id) got.add(`${m.income_source_id}|${m.occurrence_date}`);
  const out: ExpectedIncome[] = [];
  for (const s of sources) {
    if (!s.is_active) continue;
    for (const date of occurrences(s, from, to)) {
      const key = `${s.id}|${date}`;
      out.push({ key, kind: "income_source", refId: s.id, name: s.name, date, amount: s.amount, received: got.has(key), late: !got.has(key) && date < today });
    }
  }
  return out;
}

export function isInvoiceOverdue(inv: Invoice, today: ISODate): boolean {
  return inv.status === "unpaid" && inv.due_date != null && inv.due_date < today;
}

export type InvoiceView = Invoice & { overdue: boolean; daysToDue: number | null };

export function invoiceStatusLabel(inv: Invoice, today: ISODate): string {
  if (inv.status === "cancelled") return "Stornovaná";
  if (inv.status === "paid") return "Zaplacená";
  return isInvoiceOverdue(inv, today) ? "Po splatnosti" : "Nezaplacená";
}

/** Neuhrazené PŘIJATÉ faktury zahrnuté do plánu se splatností do `to`. */
export function invoiceObligations(invoices: readonly Invoice[], to: ISODate, today: ISODate): PaymentOccurrence[] {
  const lookback = addDays(today, -OVERDUE_LOOKBACK_DAYS);
  return invoices
    .filter((i) => i.direction === "received" && i.status === "unpaid" && i.include_in_plan)
    .filter((i) => {
      const d = i.due_date ?? i.issue_date;
      return d <= to && d >= lookback;
    })
    .map((i) => {
      const d = i.due_date ?? i.issue_date;
      return {
        key: `inv|${i.id}`, kind: "invoice" as const, refId: i.id, name: `Faktura ${i.number} – ${i.counterparty}`,
        date: d, amount: i.amount, categoryId: null, isDebt: false,
        state: d < today ? ("overdue" as const) : d === today ? ("due" as const) : ("upcoming" as const), transactionId: null,
      };
    });
}

export function unpaidTotal(items: readonly PaymentOccurrence[]): Cents {
  return sum(items.filter((i) => i.state === "due" || i.state === "overdue" || i.state === "upcoming"), (i) => i.amount);
}
