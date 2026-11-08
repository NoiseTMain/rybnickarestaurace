import type { Cents } from "@/lib/money";
import type { ISODate } from "@/lib/dates";
import type { Frequency } from "@/lib/finance/recurrence";

/** Všechny částky jsou v haléřích (bigint v DB → number v aplikaci). */

export interface Household {
  id: string;
  name: string;
  is_demo: boolean;
  created_by: string;
  created_at: string;
}

export const PERMISSION_SECTIONS = {
  finance: "Příjmy, výdaje, účty, rozpočty a platby",
  invoices: "Faktury",
  work: "Práce a výplaty",
  purchases: "Nákupy a plánování",
  savings: "Spoření a cíle",
  travel: "Cestování",
  settings: "Nastavení domácnosti a členové",
} as const;
export type PermissionSection = keyof typeof PERMISSION_SECTIONS;
export type Permissions = Partial<Record<PermissionSection, "edit" | "view">>;

export interface HouseholdUser {
  id: string;
  household_id: string;
  user_id: string;
  role: "owner" | "member";
  permissions: Permissions;
  created_at: string;
}

export interface HouseholdInvite {
  id: string;
  household_id: string;
  code: string;
  created_by: string;
  expires_at: string;
  used_by: string | null;
  created_at: string;
}

export interface HouseholdSettings {
  id: string;
  household_id: string;
  safety_buffer: Cents;
  food_warn_percent: number;
  pace_tolerance_percent: number;
  notify_due_days: number;
  notify_food: boolean;
  notify_invoices: boolean;
  notify_payments: boolean;
  billing_name: string | null;
  billing_ico: string | null;
  billing_dic: string | null;
  billing_address: string | null;
  billing_bank_account: string | null;
  invoice_number_prefix: string | null;
  onboarded_at: string | null;
  ico_activated_at: string | null;
  ico_changed_at: string | null;
  ico_info: IcoInfo | null;
  updated_at: string;
}

export interface IcoInfo {
  ico: string;
  name: string | null;
  address: string | null;
  legalForm: string | null;
  dic: string | null;
  established: string | null;
  verified: boolean;
  source: "ares" | "manual";
  checkedAt: string;
}

export interface Member {
  id: string;
  household_id: string;
  name: string;
  color: string;
  user_id: string | null;
  is_active: boolean;
  sort: number;
  phone: string | null;
  avatar_document_id: string | null;
  created_at: string;
}

export type AccountKind = "checking" | "cash" | "savings";

export interface Account {
  id: string;
  household_id: string;
  name: string;
  kind: AccountKind;
  opening_balance: Cents;
  opening_date: ISODate;
  include_in_available: boolean;
  member_id: string | null;
  is_active: boolean;
  sort: number;
  created_at: string;
}

export type CategoryKind = "expense" | "income";

export interface Category {
  id: string;
  household_id: string;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  is_food: boolean;
  is_household: boolean;
  is_archived: boolean;
  sort: number;
  created_at: string;
}

export type TxType = "income" | "expense" | "transfer";
export type TxStatus = "posted" | "cancelled";
export type PaymentMethod = "card" | "cash" | "transfer" | "direct_debit" | "other";
export type TxScope = "shared" | "personal";
export type TxSource = "manual" | "csv" | "payout" | "recurring" | "invoice" | "purchase" | "income_source" | "savings" | "shopping" | "trip";

export interface Transaction {
  id: string;
  household_id: string;
  type: TxType;
  status: TxStatus;
  amount: Cents; // vždy kladná
  date: ISODate;
  account_id: string;
  transfer_account_id: string | null;
  category_id: string | null;
  description: string;
  member_id: string | null;
  scope: TxScope;
  is_recurring: boolean;
  payment_method: PaymentMethod;
  source: TxSource;
  external_id: string | null;
  recurring_payment_id: string | null;
  income_source_id: string | null;
  occurrence_date: ISODate | null;
  payout_id: string | null;
  invoice_id: string | null;
  purchase_id: string | null;
  contribution_id: string | null;
  shopping_list_id: string | null;
  document_id: string | null;
  note: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RecurringPayment {
  id: string;
  household_id: string;
  name: string;
  amount: Cents;
  frequency: Frequency;
  start_date: ISODate;
  end_date: ISODate | null;
  category_id: string | null;
  account_id: string | null;
  member_id: string | null;
  payment_method: PaymentMethod;
  is_debt: boolean;
  debt_remaining: Cents | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

export interface IncomeSource {
  id: string;
  household_id: string;
  name: string;
  amount: Cents;
  frequency: Frequency;
  start_date: ISODate;
  end_date: ISODate | null;
  member_id: string | null;
  account_id: string | null;
  category_id: string | null;
  is_active: boolean;
  note: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  household_id: string;
  kind: "food" | "category" | "total";
  category_id: string | null;
  amount: Cents;
  month: ISODate | null; // null = platí každý měsíc; jinak první den konkrétního měsíce
  created_at: string;
}

export interface SavingsGoal {
  id: string;
  household_id: string;
  name: string;
  kind: "reserve" | "home" | "car" | "vacation" | "business" | "other";
  target_amount: Cents;
  target_date: ISODate | null;
  monthly_contribution: Cents | null;
  account_id: string | null;
  color: string;
  priority: number;
  status: "active" | "achieved" | "archived";
  note: string | null;
  created_at: string;
}

export interface SavingsContribution {
  id: string;
  household_id: string;
  goal_id: string;
  amount: Cents; // záporné = výběr
  date: ISODate;
  note: string | null;
  created_at: string;
}

export interface WorkSettings {
  id: string;
  household_id: string;
  member_id: string | null;
  company: string;
  rate_hour: Cents;
  rate_regular_route: Cents;
  rate_express_route: Cents;
  rate_order: Cents;
  rate_peak_hour_bonus: Cents;
  private_km_rate: Cents;
  default_vehicle_rent: Cents;
  updated_at: string;
}

export interface WorkShift {
  id: string;
  household_id: string;
  member_id: string | null;
  date: ISODate;
  minutes: number;
  peak_minutes: number;
  regular_routes: number;
  express_routes: number;
  orders: number;
  base_earnings: Cents;
  tips: Cents;
  bonuses: Cents;
  rewards: Cents;
  vehicle_rent: Cents;
  equipment_cost: Cents;
  private_km: string; // desetinné číslo jako text (např. „12.5“)
  private_km_cost: Cents;
  other_deductions: Cents;
  note: string | null;
  external_id: string | null;
  created_at: string;
}

export type PayoutStatus = "expected" | "received" | "cancelled";

export interface Payout {
  id: string;
  household_id: string;
  member_id: string | null;
  label: string;
  period_from: ISODate | null;
  period_to: ISODate | null;
  expected_amount: Cents;
  expected_date: ISODate;
  received_amount: Cents | null;
  received_date: ISODate | null;
  status: PayoutStatus;
  account_id: string | null;
  invoice_id: string | null;
  note: string | null;
  created_at: string;
}

export type InvoiceDirection = "issued" | "received";
export type InvoiceStatus = "unpaid" | "paid" | "cancelled";

export interface Invoice {
  id: string;
  household_id: string;
  direction: InvoiceDirection;
  number: string;
  counterparty: string;
  counterparty_ico: string | null;
  issue_date: ISODate;
  due_date: ISODate | null;
  paid_date: ISODate | null;
  amount: Cents;
  status: InvoiceStatus;
  include_in_plan: boolean;
  note: string | null;
  document_id: string | null;
  ocr_used: boolean;
  created_at: string;
}

export interface DocumentRow {
  id: string;
  household_id: string;
  kind: "invoice" | "receipt" | "contract" | "statement" | "other";
  title: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  ocr_text: string | null;
  tags: string | null;
  uploaded_by: string | null;
  trip_id?: string | null;
  created_at: string;
}

export interface Purchase {
  id: string;
  household_id: string;
  name: string;
  price: Cents;
  category_id: string | null;
  priority: number; // 1 = nejvyšší
  url: string | null;
  planned_date: ISODate | null;
  status: "planned" | "buying" | "bought";
  is_wish: boolean;
  note: string | null;
  kind: "general" | "home";
  room: string | null;
  image_document_id: string | null;
  source_url_title: string | null;
  created_at: string;
}

export interface ShoppingList {
  id: string;
  household_id: string;
  name: string;
  planned_date: ISODate | null;
  status: "open" | "done";
  note: string | null;
  created_at: string;
}

export interface ShoppingItem {
  id: string;
  household_id: string;
  list_id: string;
  name: string;
  quantity: string | null;
  est_price: Cents | null;
  store: string | null;
  checked: boolean;
  sort: number;
  created_at: string;
}

export interface OccurrenceMark {
  id: string;
  household_id: string;
  recurring_payment_id: string | null;
  income_source_id: string | null;
  occurrence_date: ISODate;
  state: "paid_untracked" | "skipped";
  created_at: string;
}

export interface PriceHistory {
  id: string;
  household_id: string;
  item_key: string;
  name: string;
  quantity: string | null;
  store: string | null;
  price: Cents;
  date: ISODate;
  created_at: string;
}

export type TripLegMode = "train" | "bus" | "car" | "plane" | "ferry" | "transit" | "bike" | "other";
export type TripExpenseKind = "transport" | "accommodation" | "food" | "activities" | "shopping" | "other";

export interface Trip {
  id: string;
  household_id: string;
  name: string;
  destination: string;
  country: string | null;
  start_date: ISODate | null;
  end_date: ISODate | null;
  travelers: number;
  budget: Cents | null;
  currency: string;
  lat: number | null;
  lon: number | null;
  note: string | null;
  goal_id: string | null;
  created_at: string;
}

export interface TripPerson {
  id: string;
  household_id: string;
  trip_id: string;
  name: string;
  member_id: string | null;
  sort: number;
  created_at: string;
}

export interface TripCashMove {
  id: string;
  household_id: string;
  trip_id: string;
  kind: "buy" | "return";
  currency: string;
  amount_original: number;
  /** Kč (haléře) */
  amount: Cents;
  rate: number;
  date: ISODate;
  transaction_id: string | null;
  note: string | null;
  created_at: string;
}

export interface TripChecklistItem {
  id: string;
  household_id: string;
  trip_id: string;
  text: string;
  category: string | null;
  done: boolean;
  sort: number;
  created_at: string;
}

export interface TripPlanItem {
  id: string;
  household_id: string;
  trip_id: string;
  kind: "stay" | "activity" | "note";
  date: ISODate | null;
  end_date: ISODate | null;
  time: string | null;
  title: string;
  address: string | null;
  url: string | null;
  note: string | null;
  created_at: string;
}

export interface TripNotification {
  id: string;
  household_id: string;
  trip_id: string;
  kind: "departure" | "overspend";
  date: ISODate;
  created_at: string;
}

export interface TripLeg {
  id: string;
  household_id: string;
  trip_id: string;
  mode: TripLegMode;
  carrier: string | null;
  from_place: string;
  to_place: string;
  depart_date: ISODate | null;
  depart_time: string | null;
  arrive_date: ISODate | null;
  arrive_time: string | null;
  price: Cents | null;
  distance_km: number | null;
  booking_ref: string | null;
  url: string | null;
  note: string | null;
  from_lat: number | null;
  from_lon: number | null;
  to_lat: number | null;
  to_lon: number | null;
  document_id: string | null;
  route_polyline: string | null;
  sort: number;
  created_at: string;
}

export interface TripExpense {
  id: string;
  household_id: string;
  trip_id: string;
  leg_id: string | null;
  transaction_id: string | null;
  status: "planned" | "paid";
  kind: TripExpenseKind;
  description: string;
  place: string | null;
  date: ISODate | null;
  /** Částka v Kč (haléře) – přepočtená kurzem, pokud se platilo v cizí měně. */
  amount: Cents;
  currency: string;
  /** Původní částka v cizí měně (v setinách měny). */
  amount_original: number | null;
  rate: number | null;
  /** Účastník cesty, který platil. */
  paid_by: string | null;
  /** Za koho se platilo (null = za všechny účastníky). */
  split_among: string[] | null;
  /** Placeno z hotovosti v cizí měně (výměna už je zapsaná jako výdaj domácnosti). */
  from_cash: boolean;
  document_id: string | null;
  created_at: string;
}

export interface PushSubscriptionRow {
  id: string;
  user_id: string;
  household_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
}

export interface Tables {
  households: Household;
  household_users: HouseholdUser;
  household_invites: HouseholdInvite;
  household_settings: HouseholdSettings;
  members: Member;
  accounts: Account;
  categories: Category;
  transactions: Transaction;
  recurring_payments: RecurringPayment;
  income_sources: IncomeSource;
  budgets: Budget;
  savings_goals: SavingsGoal;
  savings_contributions: SavingsContribution;
  work_settings: WorkSettings;
  work_shifts: WorkShift;
  payouts: Payout;
  invoices: Invoice;
  documents: DocumentRow;
  purchases: Purchase;
  occurrence_marks: OccurrenceMark;
  shopping_lists: ShoppingList;
  shopping_items: ShoppingItem;
  price_history: PriceHistory;
  trips: Trip;
  trip_legs: TripLeg;
  trip_expenses: TripExpense;
  trip_people: TripPerson;
  trip_cash_moves: TripCashMove;
  trip_checklist: TripChecklistItem;
  trip_plan_items: TripPlanItem;
  trip_notifications: TripNotification;
  push_subscriptions: PushSubscriptionRow;
}

export type TableName = keyof Tables;

/** Tabulky s daty domácnosti (mají sloupec household_id) – exportují se v záloze. */
export const HOUSEHOLD_TABLES = [
  "household_settings",
  "members",
  "accounts",
  "categories",
  "documents",
  "recurring_payments",
  "income_sources",
  "budgets",
  "savings_goals",
  "savings_contributions",
  "work_settings",
  "invoices",
  "payouts",
  "work_shifts",
  "purchases",
  "occurrence_marks",
  "shopping_lists",
  "shopping_items",
  "price_history",
  "trips",
  "trip_people",
  "trip_legs",
  "trip_checklist",
  "trip_plan_items",
  "transactions",
  "trip_expenses",
  "trip_cash_moves",
] as const satisfies readonly TableName[];

export type HouseholdTable = (typeof HOUSEHOLD_TABLES)[number];

/** Sloupce s penězi (bigint) – při čtení ze Supabase se převádí na number. */
export const MONEY_COLUMNS: Partial<Record<TableName, string[]>> = {
  household_settings: ["safety_buffer"],
  accounts: ["opening_balance"],
  transactions: ["amount"],
  recurring_payments: ["amount", "debt_remaining"],
  income_sources: ["amount"],
  budgets: ["amount"],
  savings_goals: ["target_amount", "monthly_contribution"],
  savings_contributions: ["amount"],
  work_settings: ["rate_hour", "rate_regular_route", "rate_express_route", "rate_order", "rate_peak_hour_bonus", "private_km_rate", "default_vehicle_rent"],
  work_shifts: ["base_earnings", "tips", "bonuses", "rewards", "vehicle_rent", "equipment_cost", "private_km_cost", "other_deductions"],
  payouts: ["expected_amount", "received_amount"],
  invoices: ["amount"],
  purchases: ["price"],
  shopping_items: ["est_price"],
  price_history: ["price"],
  trips: ["budget"],
  trip_legs: ["price"],
  trip_expenses: ["amount", "amount_original", "rate"],
  trip_cash_moves: ["amount", "amount_original", "rate"],
};
