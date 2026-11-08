import type { TableName } from "./types";

/**
 * Metadata schématu pro lokální režim (JSON úložiště). Odpovídají
 * omezením v SQL migracích, aby se oba režimy chovaly stejně:
 * unikátní klíče (ochrana proti dvojímu započtení) a vazby mezi tabulkami.
 */

export interface UniqueConstraint {
  columns: string[];
  /** Podmínka částečného indexu – omezení platí jen pro řádky, které ji splňují. */
  where?: (row: Record<string, unknown>) => boolean;
  message: string;
}

const posted = (col: string) => (r: Record<string, unknown>) => r[col] != null && r.status === "posted";

export const UNIQUE: Partial<Record<TableName, UniqueConstraint[]>> = {
  household_users: [{ columns: ["household_id", "user_id"], message: "Uživatel už je členem domácnosti." }],
  user_prefs: [{ columns: ["user_id"], message: "Předvolby už existují." }],
  net_worth_snapshots: [{ columns: ["household_id", "month"], message: "Snímek za tento měsíc už existuje." }],
  household_invites: [{ columns: ["code"], message: "Kód pozvánky už existuje." }],
  household_settings: [{ columns: ["household_id"], message: "Nastavení už existuje." }],
  work_settings: [{ columns: ["household_id"], message: "Nastavení práce už existuje." }],
  categories: [{ columns: ["household_id", "kind", "name"], message: "Kategorie s tímto názvem už existuje." }],
  documents: [{ columns: ["storage_path"], message: "Soubor už je evidován." }],
  invoices: [{ columns: ["household_id", "direction", "number"], message: "Faktura s tímto číslem už existuje." }],
  budgets: [{ columns: ["household_id", "kind", "category_id", "month"], message: "Rozpočet pro toto období už existuje." }],
  occurrence_marks: [
    { columns: ["recurring_payment_id", "occurrence_date"], where: (r) => r.recurring_payment_id != null, message: "Termín už je označen." },
    { columns: ["income_source_id", "occurrence_date"], where: (r) => r.income_source_id != null, message: "Termín už je označen." },
  ],
  work_shifts: [{ columns: ["household_id", "external_id"], where: (r) => r.external_id != null, message: "Směna už byla importována." }],
  transactions: [
    { columns: ["household_id", "account_id", "external_id"], where: (r) => r.external_id != null, message: "Transakce už byla importována." },
    { columns: ["recurring_payment_id", "occurrence_date"], where: posted("recurring_payment_id"), message: "Tento termín platby už je zaplacen." },
    { columns: ["income_source_id", "occurrence_date"], where: posted("income_source_id"), message: "Tento příjem už je zaznamenán." },
    { columns: ["payout_id"], where: posted("payout_id"), message: "Výplata už je zaznamenána." },
    { columns: ["invoice_id"], where: posted("invoice_id"), message: "Platba faktury už je zaznamenána." },
    { columns: ["purchase_id"], where: posted("purchase_id"), message: "Nákup už je zaznamenán." },
    { columns: ["contribution_id"], where: posted("contribution_id"), message: "Vklad už je zaznamenán." },
    { columns: ["shopping_list_id"], where: posted("shopping_list_id"), message: "Nákup podle seznamu už je zaznamenán." },
  ],
  trip_notifications: [{ columns: ["trip_id", "kind", "date"], message: "Upozornění už bylo odesláno." }],
  trip_expenses: [
    { columns: ["transaction_id"], where: (r) => r.transaction_id != null, message: "Tento výdaj už je u cesty zapsán." },
    { columns: ["leg_id"], where: (r) => r.leg_id != null, message: "Tento úsek už je zaplacen." },
  ],
};

export type OnDelete = "cascade" | "set_null" | "restrict";

export interface Ref {
  column: string;
  table: TableName;
  onDelete: OnDelete;
}

/** Sekce oprávnění pro zápis do tabulky (stejné jako v SQL migraci 0006). "*" = jakékoli právo k úpravám. */
export const TABLE_SECTION: Partial<Record<TableName, string>> = {
  transactions: "finance", accounts: "finance", categories: "finance", recurring_payments: "finance", income_sources: "finance",
  occurrence_marks: "finance", budgets: "finance", invoices: "invoices", work_shifts: "work", payouts: "work", work_settings: "work",
  purchases: "purchases", shopping_lists: "purchases", shopping_items: "purchases", price_history: "purchases",
  savings_goals: "savings", savings_contributions: "savings", trips: "travel", trip_legs: "travel", trip_expenses: "travel", trip_people: "travel", trip_cash_moves: "travel", trip_checklist: "travel", trip_plan_items: "travel", trip_settlements: "travel", assets: "finance", debts: "finance", net_worth_snapshots: "finance", reminders: "finance", household_settings: "settings", members: "settings", documents: "*",
};

export const REFS: Partial<Record<TableName, Ref[]>> = {
  members: [{ column: "avatar_document_id", table: "documents", onDelete: "set_null" }],
  accounts: [{ column: "member_id", table: "members", onDelete: "set_null" }],
  recurring_payments: [
    { column: "category_id", table: "categories", onDelete: "set_null" },
    { column: "account_id", table: "accounts", onDelete: "set_null" },
    { column: "member_id", table: "members", onDelete: "set_null" },
  ],
  income_sources: [
    { column: "member_id", table: "members", onDelete: "set_null" },
    { column: "account_id", table: "accounts", onDelete: "set_null" },
    { column: "category_id", table: "categories", onDelete: "set_null" },
  ],
  occurrence_marks: [
    { column: "recurring_payment_id", table: "recurring_payments", onDelete: "cascade" },
    { column: "income_source_id", table: "income_sources", onDelete: "cascade" },
  ],
  budgets: [{ column: "category_id", table: "categories", onDelete: "cascade" }],
  savings_goals: [{ column: "account_id", table: "accounts", onDelete: "set_null" }, { column: "member_id", table: "members", onDelete: "set_null" }],
  savings_contributions: [{ column: "goal_id", table: "savings_goals", onDelete: "cascade" }],
  work_settings: [{ column: "member_id", table: "members", onDelete: "set_null" }],
  invoices: [{ column: "document_id", table: "documents", onDelete: "set_null" }],
  documents: [{ column: "trip_id", table: "trips", onDelete: "set_null" }],
  payouts: [
    { column: "member_id", table: "members", onDelete: "set_null" },
    { column: "account_id", table: "accounts", onDelete: "set_null" },
    { column: "invoice_id", table: "invoices", onDelete: "set_null" },
  ],
  work_shifts: [{ column: "member_id", table: "members", onDelete: "set_null" }],
  purchases: [
    { column: "category_id", table: "categories", onDelete: "set_null" },
    { column: "image_document_id", table: "documents", onDelete: "set_null" },
  ],
  shopping_items: [{ column: "list_id", table: "shopping_lists", onDelete: "cascade" }],
  trips: [{ column: "goal_id", table: "savings_goals", onDelete: "set_null" }],
  trip_people: [
    { column: "trip_id", table: "trips", onDelete: "cascade" },
    { column: "member_id", table: "members", onDelete: "set_null" },
  ],
  trip_legs: [
    { column: "trip_id", table: "trips", onDelete: "cascade" },
    { column: "document_id", table: "documents", onDelete: "set_null" },
  ],
  trip_expenses: [
    { column: "trip_id", table: "trips", onDelete: "cascade" },
    { column: "leg_id", table: "trip_legs", onDelete: "set_null" },
    { column: "transaction_id", table: "transactions", onDelete: "set_null" },
    { column: "paid_by", table: "trip_people", onDelete: "set_null" },
    { column: "document_id", table: "documents", onDelete: "set_null" },
  ],
  trip_cash_moves: [
    { column: "trip_id", table: "trips", onDelete: "cascade" },
    { column: "transaction_id", table: "transactions", onDelete: "set_null" },
  ],
  trip_checklist: [{ column: "trip_id", table: "trips", onDelete: "cascade" }],
  trip_settlements: [
    { column: "trip_id", table: "trips", onDelete: "cascade" },
    { column: "from_person", table: "trip_people", onDelete: "cascade" },
    { column: "to_person", table: "trip_people", onDelete: "cascade" },
  ],
  trip_plan_items: [{ column: "trip_id", table: "trips", onDelete: "cascade" }],
  trip_notifications: [{ column: "trip_id", table: "trips", onDelete: "cascade" }],
  transactions: [
    { column: "account_id", table: "accounts", onDelete: "restrict" },
    { column: "transfer_account_id", table: "accounts", onDelete: "restrict" },
    { column: "category_id", table: "categories", onDelete: "set_null" },
    { column: "member_id", table: "members", onDelete: "set_null" },
    { column: "recurring_payment_id", table: "recurring_payments", onDelete: "set_null" },
    { column: "income_source_id", table: "income_sources", onDelete: "set_null" },
    { column: "payout_id", table: "payouts", onDelete: "set_null" },
    { column: "invoice_id", table: "invoices", onDelete: "set_null" },
    { column: "purchase_id", table: "purchases", onDelete: "set_null" },
    { column: "contribution_id", table: "savings_contributions", onDelete: "set_null" },
    { column: "shopping_list_id", table: "shopping_lists", onDelete: "set_null" },
    { column: "document_id", table: "documents", onDelete: "set_null" },
  ],
};

export const TABLES_WITH_UPDATED_AT: TableName[] = ["transactions", "household_settings", "work_settings", "user_prefs", "assets"];
