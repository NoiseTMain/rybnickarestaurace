import type { Invoice } from "@/lib/db/types";

/**
 * Limit pro povinnou registraci k DPH (ČR, od 2025): obrat 2 000 000 Kč za kalendářní rok;
 * po překročení 2 536 500 Kč se plátcem stáváte hned následujícím dnem. Orientační – ověřte na financnisprava.cz.
 */
export const VAT_LIMIT = 200_000_000;
export const VAT_LIMIT_IMMEDIATE = 253_650_000;

export function vatStatus(invoices: readonly Invoice[], year: string) {
  const turnover = invoices.filter((i) => i.direction === "issued" && i.status !== "cancelled" && i.issue_date.startsWith(year)).reduce((a, i) => a + i.amount, 0);
  const share = turnover / VAT_LIMIT;
  const level = turnover > VAT_LIMIT_IMMEDIATE ? "immediate" : turnover > VAT_LIMIT ? "over" : share >= 0.8 ? "warning" : "ok";
  return { turnover, share, remaining: Math.max(0, VAT_LIMIT - turnover), level } as const;
}

/** Podklady pro účetní: faktury za rok po měsících. */
export function yearInvoices(invoices: readonly Invoice[], year: string) {
  const list = invoices.filter((i) => i.status !== "cancelled" && i.issue_date.startsWith(year)).sort((a, b) => a.issue_date.localeCompare(b.issue_date));
  const months = Array.from({ length: 12 }, (_, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    const inMonth = list.filter((x) => x.issue_date.startsWith(m));
    return { month: m, issued: inMonth.filter((x) => x.direction === "issued").reduce((a, x) => a + x.amount, 0), received: inMonth.filter((x) => x.direction === "received").reduce((a, x) => a + x.amount, 0) };
  });
  const issued = list.filter((i) => i.direction === "issued"), received = list.filter((i) => i.direction === "received");
  return { issued, received, months, issuedTotal: issued.reduce((a, i) => a + i.amount, 0), receivedTotal: received.reduce((a, i) => a + i.amount, 0), unpaid: list.filter((i) => i.status === "unpaid") };
}
