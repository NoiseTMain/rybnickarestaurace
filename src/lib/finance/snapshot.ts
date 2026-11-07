import { add, clampZero, divRound, sub, sum, type Cents } from "@/lib/money";
import { addDays, addMonths, endOfMonth, startOfMonth, type ISODate } from "@/lib/dates";
import type {
  Account, Budget, Category, HouseholdSettings, IncomeSource, Invoice, Member, OccurrenceMark, Payout,
  Purchase, RecurringPayment, SavingsContribution, SavingsGoal, Transaction, WorkShift,
} from "@/lib/db/types";
import { balances, posted } from "./balances";
import { categoryBudgets, remainingCategoryBudgets, resolveBudget } from "./budgets";
import { computeFoodBudget, type FoodBudgetResult } from "./food";
import { goalsSummary } from "./goals";
import {
  OVERDUE_LOOKBACK_DAYS, incomeOccurrences, invoiceObligations, isInvoiceOverdue, recurringOccurrences, type ExpectedIncome,
  type PaymentOccurrence,
} from "./obligations";
import { expensesIn, foodCategoryIds, periodStats } from "./period";
import { plan, type PlannerResult } from "./planner";
import { FREQUENCY_PER_MONTH } from "./recurrence";
import { aggregate, inPeriod } from "./work";
import { travelCommitments, type TravelInput } from "./travel";

export interface FinanceData {
  settings: HouseholdSettings | null;
  members: Member[];
  accounts: Account[];
  categories: Category[];
  transactions: Transaction[];
  recurring: RecurringPayment[];
  incomeSources: IncomeSource[];
  budgets: Budget[];
  goals: SavingsGoal[];
  contributions: SavingsContribution[];
  invoices: Invoice[];
  payouts: Payout[];
  shifts: WorkShift[];
  purchases: Purchase[];
  marks: OccurrenceMark[];
  /** Cesty – jejich nezaplacené platby jsou závazky a zbytek rozpočtu se rezervuje. */
  travel?: TravelInput;
}

export interface MissingData {
  code: "accounts" | "food_budget" | "income" | "recurring";
  message: string;
  href: string;
}

export interface Snapshot {
  today: ISODate;
  monthStart: ISODate;
  monthEnd: ISODate;
  daysLeftInMonth: number;
  balance: ReturnType<typeof balances>;
  month: ReturnType<typeof periodStats>;
  lastMonth: ReturnType<typeof periodStats>;
  /** Stejné období minulého měsíce (1.–dnešní den) pro férové srovnání. */
  lastMonthToDate: ReturnType<typeof periodStats>;
  food: FoodBudgetResult | null;
  foodSpentLastMonthToDate: Cents;
  household: { spent: Cents; byCategory: { categoryId: string | null; amount: Cents }[] };
  categoryBudgets: ReturnType<typeof categoryBudgets>;
  totalBudget: { amount: Cents; spent: Cents } | null;
  goals: ReturnType<typeof goalsSummary>;
  reservedOnLiquid: Cents;
  obligationsThisMonth: PaymentOccurrence[];
  upcoming: PaymentOccurrence[];
  unpaidObligationsTotal: Cents;
  expectedIncomes: ExpectedIncome[];
  expectedIncomeTotal: Cents;
  invoices: { unpaidIssued: Invoice[]; unpaidReceived: Invoice[]; overdue: Invoice[]; unpaidIssuedTotal: Cents; unpaidReceivedTotal: Cents };
  work: { month: ReturnType<typeof aggregate>; lastMonth: ReturnType<typeof aggregate>; expectedPayouts: Payout[]; expectedPayoutTotal: Cents };
  planner: PlannerResult;
  monthlySurplus: { amount: Cents | null; basis: "history" | "plan" | "none"; months: number };
  /** Rezerva na cesty a o kolik ji měsíčně navyšovat. */
  travel: { reserve: Cents; monthlyAdd: Cents; obligationsThisMonth: Cents };
  /** Odhad zůstatku na konci měsíce při současném tempu (bez očekávaných příjmů). */
  projectedEndOfMonth: Cents;
  avgDailyVariableSpend: Cents;
  missing: MissingData[];
}

function within<T extends { date: ISODate }>(items: T[], from: ISODate, to: ISODate) {
  return items.filter((i) => i.date >= from && i.date <= to);
}

export function computeSnapshot(data: FinanceData, today: ISODate): Snapshot {
  const txs = posted(data.transactions);
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);
  const daysLeftInMonth = Number(monthEnd.slice(8)) - Number(today.slice(8)) + 1;
  const lastMonthStart = addMonths(monthStart, -1);
  const lastMonthEnd = endOfMonth(lastMonthStart);
  const lastMonthSameDay = addMonths(today, -1);

  const balance = balances(data.accounts, txs, today);
  const month = periodStats(txs, monthStart, today);
  const lastMonth = periodStats(txs, lastMonthStart, lastMonthEnd);
  const lastMonthToDate = periodStats(txs, lastMonthStart, lastMonthSameDay);

  // --- jídlo
  const foodIds = foodCategoryIds(data.categories);
  const isFood = (t: Transaction) => t.category_id != null && foodIds.has(t.category_id);
  const foodBudget = resolveBudget(data.budgets, "food", monthStart);
  const foodSpent = expensesIn(txs, monthStart, today, isFood);
  const food = foodBudget
    ? computeFoodBudget({
        budget: foodBudget.amount,
        spent: foodSpent,
        spentToday: expensesIn(txs, today, today, isFood),
        today,
        warnPercent: data.settings?.food_warn_percent ?? 85,
        paceTolerancePercent: data.settings?.pace_tolerance_percent ?? 10,
      })
    : null;
  const foodSpentLastMonthToDate = expensesIn(txs, lastMonthStart, lastMonthSameDay, isFood);

  // --- domácnost
  const householdIds = new Set(data.categories.filter((c) => c.is_household).map((c) => c.id));
  const householdTx = (t: Transaction) => t.category_id != null && householdIds.has(t.category_id);
  const household = {
    spent: expensesIn(txs, monthStart, today, householdTx),
    byCategory: month.byCategory.filter((c) => c.categoryId && householdIds.has(c.categoryId)),
  };

  // --- rozpočty
  const catBudgets = categoryBudgets(data.budgets, data.categories, txs, monthStart, today);
  const total = resolveBudget(data.budgets, "total", monthStart);
  const totalBudget = total ? { amount: total.amount, spent: month.expense } : null;

  // --- spoření
  const goals = goalsSummary(data.goals, data.contributions, today);
  const liquidAccountIds = new Set(data.accounts.filter((a) => a.include_in_available).map((a) => a.id));
  // cíl bez účtu = peníze vyčleněné z běžných účtů
  const reservedOnLiquid = sum(
    goals.progress.filter((p) => p.goal.status !== "archived" && (!p.goal.account_id || liquidAccountIds.has(p.goal.account_id))),
    (p) => clampZero(p.saved),
  );

  // --- závazky
  const lookback = addDays(today, -OVERDUE_LOOKBACK_DAYS);
  const rec = recurringOccurrences(data.recurring, data.transactions, data.marks, lookback, addDays(today, 45), today);
  const invObl = invoiceObligations(data.invoices, addDays(today, 45), today);
  const trips = travelCommitments(data.travel, data.transactions, today, OVERDUE_LOOKBACK_DAYS);
  const tripObl = trips.obligations.filter((o) => o.date <= addDays(today, 45));
  const all = [...rec, ...invObl, ...tripObl].sort((a, b) => (a.date < b.date ? -1 : 1));
  const open = (o: PaymentOccurrence) => o.state === "due" || o.state === "overdue" || o.state === "upcoming";
  const obligationsThisMonth = all.filter((o) => o.date <= monthEnd && (o.date >= monthStart || open(o)));
  const unpaidObligationsTotal = sum(obligationsThisMonth.filter(open), (o) => o.amount);
  const upcoming = all.filter((o) => open(o)).slice(0, 12);

  // --- očekávané příjmy (NEjsou dostupné peníze)
  const incomeOcc = incomeOccurrences(data.incomeSources, data.transactions, data.marks, monthStart, monthEnd, today);
  const expectedPayouts = data.payouts.filter((p) => p.status === "expected");
  const payoutIncomes: ExpectedIncome[] = expectedPayouts
    .filter((p) => p.expected_date >= lookback && p.expected_date <= monthEnd)
    .map((p) => ({ key: `payout|${p.id}`, kind: "payout", refId: p.id, name: p.label, date: p.expected_date, amount: p.expected_amount, received: false, late: p.expected_date < today }));
  const linkedInvoiceIds = new Set(data.payouts.map((p) => p.invoice_id).filter(Boolean));
  const issuedUnpaid = data.invoices.filter((i) => i.direction === "issued" && i.status === "unpaid");
  const invoiceIncomes: ExpectedIncome[] = issuedUnpaid
    .filter((i) => i.include_in_plan && !linkedInvoiceIds.has(i.id))
    .filter((i) => (i.due_date ?? i.issue_date) <= monthEnd && (i.due_date ?? i.issue_date) >= lookback)
    .map((i) => ({ key: `inv|${i.id}`, kind: "invoice", refId: i.id, name: `Faktura ${i.number}`, date: i.due_date ?? i.issue_date, amount: i.amount, received: false, late: isInvoiceOverdue(i, today) }));
  const expectedIncomes = [...incomeOcc.filter((o) => !o.received), ...payoutIncomes, ...invoiceIncomes].sort((a, b) => (a.date < b.date ? -1 : 1));
  const expectedIncomeTotal = sum(expectedIncomes, (e) => e.amount);

  // --- faktury
  const unpaidReceived = data.invoices.filter((i) => i.direction === "received" && i.status === "unpaid");
  const invoices = {
    unpaidIssued: issuedUnpaid,
    unpaidReceived,
    overdue: data.invoices.filter((i) => isInvoiceOverdue(i, today)),
    unpaidIssuedTotal: sum(issuedUnpaid, (i) => i.amount),
    unpaidReceivedTotal: sum(unpaidReceived, (i) => i.amount),
  };

  // --- práce
  const work = {
    month: aggregate("month", inPeriod(data.shifts, monthStart, today)),
    lastMonth: aggregate("lastMonth", inPeriod(data.shifts, lastMonthStart, lastMonthEnd)),
    expectedPayouts,
    expectedPayoutTotal: sum(expectedPayouts, (p) => p.expected_amount),
  };

  // --- plánovač
  const foodRemaining = food ? clampZero(food.remaining) : 0;
  const planner = plan({
    liquidBalance: balance.liquid,
    reservedOnLiquid,
    obligations: unpaidObligationsTotal,
    foodRemaining,
    otherBudgetsRemaining: remainingCategoryBudgets(catBudgets, foodIds),
    safetyBuffer: data.settings?.safety_buffer ?? 0,
    tripReserve: trips.reserve,
    savingsPlanRemaining: goals.remainingThisMonth,
    expectedIncome: expectedIncomeTotal,
  });

  // --- měsíční přebytek: historie (poslední až 3 celé měsíce s daty), jinak plán
  const firstTx = txs.reduce<ISODate | null>((m, t) => (m == null || t.date < m ? t.date : m), null);
  const fullMonths: { income: Cents; expense: Cents }[] = [];
  for (let i = 1; i <= 3; i++) {
    const s = addMonths(monthStart, -i);
    if (firstTx == null || firstTx > s) break;
    fullMonths.push(periodStats(txs, s, endOfMonth(s)));
  }
  let monthlySurplus: Snapshot["monthlySurplus"];
  if (fullMonths.length > 0) {
    const net = sum(fullMonths, (m) => sub(m.income, m.expense));
    monthlySurplus = { amount: sub(sub(divRound(net, fullMonths.length), goals.requiredMonthlyTotal), trips.monthlyAdd), basis: "history", months: fullMonths.length };
  } else {
    const perMonth = (amount: Cents, f: keyof typeof FREQUENCY_PER_MONTH) => {
      const [n, d] = FREQUENCY_PER_MONTH[f];
      return divRound(amount * n, d);
    };
    const income = sum(data.incomeSources.filter((s) => s.is_active), (s) => perMonth(s.amount, s.frequency));
    if (income > 0) {
      const fixed = sum(data.recurring.filter((r) => r.is_active), (r) => perMonth(r.amount, r.frequency));
      const budgets = add(foodBudget?.amount ?? 0, sum(catBudgets.filter((c) => !foodIds.has(c.budget.category_id ?? "")), (c) => c.budget.amount));
      monthlySurplus = { amount: sub(sub(sub(sub(income, fixed), budgets), goals.requiredMonthlyTotal), trips.monthlyAdd), basis: "plan", months: 0 };
    } else monthlySurplus = { amount: null, basis: "none", months: 0 };
  }

  // --- projekce konce měsíce: variabilní výdaje (mimo pravidelné platby) tempem tohoto měsíce
  const variable = within(txs, monthStart, today).filter((t) => t.type === "expense" && !t.recurring_payment_id && !t.invoice_id);
  const dayOfMonth = Number(today.slice(8));
  const avgDailyVariableSpend = divRound(sum(variable, (t) => t.amount), dayOfMonth);
  const projectedEndOfMonth = sub(sub(planner.available, unpaidObligationsTotal), avgDailyVariableSpend * (daysLeftInMonth - 1));

  // --- chybějící data (asistent se doptá)
  const missing: MissingData[] = [];
  if (data.accounts.length === 0) missing.push({ code: "accounts", message: "Zadejte své účty a jejich aktuální zůstatky.", href: "/nastaveni#ucty" });
  if (!foodBudget) missing.push({ code: "food_budget", message: "Nastavte měsíční rozpočet na jídlo.", href: "/rozpocty" });
  if (data.incomeSources.length === 0 && data.payouts.length === 0) missing.push({ code: "income", message: "Zadejte pravidelné příjmy nebo očekávané výplaty.", href: "/nastaveni#prijmy" });

  return {
    today, monthStart, monthEnd, daysLeftInMonth, balance, month, lastMonth, lastMonthToDate, food, foodSpentLastMonthToDate,
    household, categoryBudgets: catBudgets, totalBudget, goals, reservedOnLiquid, obligationsThisMonth, upcoming,
    unpaidObligationsTotal, expectedIncomes, expectedIncomeTotal, invoices, work, planner, monthlySurplus,
    projectedEndOfMonth, avgDailyVariableSpend, missing,
    travel: { reserve: trips.reserve, monthlyAdd: trips.monthlyAdd, obligationsThisMonth: sum(obligationsThisMonth.filter((o) => o.kind === "trip" && open(o)), (o) => o.amount) },
  };
}
