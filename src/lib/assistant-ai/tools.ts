import { z } from "zod";
import type Anthropic from "@anthropic-ai/sdk";
import type { FullData } from "@/lib/data";
import type { Snapshot } from "@/lib/finance/snapshot";
import { isISODate, addMonths, startOfMonth } from "@/lib/dates";
import { checkAffordability } from "@/lib/finance/affordability";
import { anomalies, forecast, lookback, savingsTips, weeklySummary, whatIf, workInsights } from "@/lib/finance/insights";
import { aggregate, inPeriod, shiftNet } from "@/lib/finance/work";
import { invoiceStatusLabel } from "@/lib/finance/obligations";
import { buildInsights, type ExpenseDraft } from "@/lib/assistant";
import { guessCategoryName } from "@/lib/categorize";

/**
 * Nástroje, kterými AI asistent čte data domácnosti. Všechny počítá aplikace
 * (stejné funkce jako přehledy) – model čísla jen používá, nevymýšlí.
 * Částky se modelu předávají v Kč (číslo se 2 desetinnými místy).
 * Zápis: jen návrh transakce, který musí uživatel potvrdit v rozhraní.
 */

const kc = (cents: number | null | undefined) => (cents == null ? null : Math.round(cents) / 100);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export interface ToolEnv {
  data: FullData;
  snapshot: Snapshot;
  today: string;
  /** Návrhy transakcí čekající na potvrzení uživatelem. */
  drafts: (ExpenseDraft & { type: "expense" | "income" })[];
}

const nullable = (t: Record<string, unknown>) => ({ ...t, type: [t.type as string, "null"] });

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "get_financial_overview",
    description: "Aktuální stav financí domácnosti: zůstatky účtů, disponibilní peníze, kolik lze bezpečně utratit, příjmy a výdaje tohoto měsíce, rozpočet na jídlo, spořicí cíle, nezaplacené závazky a nadcházející platby, očekávané příjmy, faktury, práce, chybějící údaje. Použij na skoro každou otázku o penězích.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "find_transactions",
    description: "Vyhledá platné transakce (pohyby na účtech) podle období, typu, kategorie, textu v popisu/obchodníka, člena a částky. Vrací součet, počet a seznam (nejnovější první). Pro otázky typu „kolik jsme utratili za…“, „kdy jsme naposledy platili…“, „největší výdaje“.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["date_from", "date_to", "type", "category", "text", "member", "min_amount_czk", "max_amount_czk", "sort", "limit"],
      properties: {
        date_from: { type: "string", description: "YYYY-MM-DD" },
        date_to: { type: "string", description: "YYYY-MM-DD (včetně)" },
        type: { type: "string", enum: ["expense", "income", "transfer", "any"] },
        category: nullable({ type: "string", description: "název kategorie (přesně nebo část), např. Potraviny" }),
        text: nullable({ type: "string", description: "hledaný text v popisu nebo poznámce, např. Lidl" }),
        member: nullable({ type: "string", description: "jméno člena domácnosti" }),
        min_amount_czk: nullable({ type: "number" }),
        max_amount_czk: nullable({ type: "number" }),
        sort: { type: "string", enum: ["newest", "largest"] },
        limit: { type: "integer", description: "kolik položek vrátit (1–100)" },
      },
    },
    strict: true,
  },
  {
    name: "spending_by_category",
    description: "Součty výdajů a příjmů podle kategorií za zvolené období.",
    input_schema: { type: "object", additionalProperties: false, required: ["date_from", "date_to"], properties: { date_from: { type: "string" }, date_to: { type: "string" } } },
    strict: true,
  },
  {
    name: "monthly_history",
    description: "Uplynulé celé měsíce zpětně: příjmy, pevné platby, běžné výdaje, odloženo, bilance a zůstatek na konci měsíce, plus průměr.",
    input_schema: { type: "object", additionalProperties: false, required: ["months"], properties: { months: { type: "integer", description: "1–12" } } },
    strict: true,
  },
  {
    name: "check_affordability",
    description: "Zda si domácnost může dovolit nákup za danou cenu (proti penězům bezpečně k utracení), kolik chybí a odkdy by to šlo.",
    input_schema: { type: "object", additionalProperties: false, required: ["price_czk"], properties: { price_czk: { type: "number" } } },
    strict: true,
  },
  {
    name: "what_if",
    description: "Scénář „co kdyby“: nákup najednou, nákup na splátky, změna nájmu, změna výdajů za jídlo (záporné = úspora), změna měsíčního příjmu. Vrací dopad na měsíční přebytek, peníze k utracení a termíny cílů.",
    input_schema: {
      type: "object", additionalProperties: false, required: ["kind", "amount_czk", "installments"],
      properties: {
        kind: { type: "string", enum: ["purchase", "installments", "rent_change", "food_change", "income_change"] },
        amount_czk: { type: "number", description: "cena nebo měsíční změna v Kč (může být záporná)" },
        installments: nullable({ type: "integer", description: "počet splátek" }),
      },
    },
    strict: true,
  },
  {
    name: "forecast",
    description: "Odhad dalších měsíců dopředu (včetně očekávaných příjmů, pravidelných plateb, průměrných běžných výdajů a plánu spoření).",
    input_schema: { type: "object", additionalProperties: false, required: ["months"], properties: { months: { type: "integer", description: "1–6" } } },
    strict: true,
  },
  {
    name: "insights",
    description: "Neobvyklé věci (duplicitní platby, výkyvy, neevidovaná předplatná, rostoucí energie, nižší výplaty), tipy na úspory s čísly, postřehy z práce, týdenní souhrn a upozornění.",
    input_schema: { type: "object", properties: {}, required: [], additionalProperties: false },
    strict: true,
  },
  {
    name: "list_records",
    description: "Seznam záznamů z aplikace: pravidelné platby, pravidelné příjmy, spořicí cíle, faktury, výplaty, pracovní směny, nákupy (vč. nábytku), nákupní seznamy, rozpočty, účty, členové, kategorie, dokumenty.",
    input_schema: {
      type: "object", additionalProperties: false, required: ["what"],
      properties: { what: { type: "string", enum: ["recurring_payments", "income_sources", "goals", "invoices", "payouts", "work_shifts", "purchases", "budgets", "accounts", "members", "categories", "documents"] } },
    },
    strict: true,
  },
  {
    name: "propose_transaction",
    description: "Připraví NÁVRH výdaje nebo příjmu k zapsání. Nic neukládá – uživatel ho musí v chatu zkontrolovat a potvrdit tlačítkem. Použij, když uživatel chce něco zapsat (např. „zapiš 250 Kč Albert“).",
    input_schema: {
      type: "object", additionalProperties: false, required: ["type", "amount_czk", "description", "category", "date", "payment_method"],
      properties: {
        type: { type: "string", enum: ["expense", "income"] },
        amount_czk: { type: "number" },
        description: { type: "string" },
        category: nullable({ type: "string", description: "název existující kategorie, nebo null" }),
        date: nullable({ type: "string", description: "YYYY-MM-DD, výchozí dnes" }),
        payment_method: { type: "string", enum: ["card", "cash", "transfer", "other"] },
      },
    },
    strict: true,
  },
];

// ---------------------------------------------------------------------------

const date = z.string().refine(isISODate, "datum ve tvaru YYYY-MM-DD");
const schemas = {
  get_financial_overview: z.object({}),
  find_transactions: z.object({
    date_from: date, date_to: date, type: z.enum(["expense", "income", "transfer", "any"]), category: z.string().nullable(), text: z.string().nullable(),
    member: z.string().nullable(), min_amount_czk: z.number().nullable(), max_amount_czk: z.number().nullable(), sort: z.enum(["newest", "largest"]), limit: z.number().int(),
  }),
  spending_by_category: z.object({ date_from: date, date_to: date }),
  monthly_history: z.object({ months: z.number().int() }),
  check_affordability: z.object({ price_czk: z.number().positive() }),
  what_if: z.object({ kind: z.enum(["purchase", "installments", "rent_change", "food_change", "income_change"]), amount_czk: z.number(), installments: z.number().int().nullable() }),
  forecast: z.object({ months: z.number().int() }),
  insights: z.object({}),
  list_records: z.object({ what: z.enum(["recurring_payments", "income_sources", "goals", "invoices", "payouts", "work_shifts", "purchases", "budgets", "accounts", "members", "categories", "documents"]) }),
  propose_transaction: z.object({
    type: z.enum(["expense", "income"]), amount_czk: z.number().positive().max(100_000_000), description: z.string().min(1).max(200),
    category: z.string().nullable(), date: date.nullable(), payment_method: z.enum(["card", "cash", "transfer", "other"]),
  }),
} as const;

export type ToolName = keyof typeof schemas;

/** Krátký popis toho, co asistent právě dělá (zobrazí se v chatu). */
export const TOOL_STATUS: Record<ToolName, string> = {
  get_financial_overview: "Dívám se na stav financí…",
  find_transactions: "Hledám v transakcích…",
  spending_by_category: "Počítám výdaje podle kategorií…",
  monthly_history: "Procházím minulé měsíce…",
  check_affordability: "Ověřuji, zda si to můžete dovolit…",
  what_if: "Počítám scénář…",
  forecast: "Počítám výhled…",
  insights: "Hledám neobvyklé věci a úspory…",
  list_records: "Čtu záznamy…",
  propose_transaction: "Připravuji návrh k zapsání…",
};

export function runTool(name: string, rawInput: unknown, env: ToolEnv): { ok: true; result: unknown } | { ok: false; error: string } {
  if (!(name in schemas)) return { ok: false, error: `Neznámý nástroj ${name}` };
  const parsed = schemas[name as ToolName].safeParse(rawInput);
  if (!parsed.success) return { ok: false, error: `Neplatný vstup: ${parsed.error.issues.map((i) => `${i.path.join(".")} ${i.message}`).join("; ")}` };
  const { data: d, snapshot: s, today } = env;
  const input = parsed.data as never;
  const catName = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? null;
  const accName = (id: string | null) => d.accounts.find((a) => a.id === id)?.name ?? null;
  const memName = (id: string | null) => d.members.find((m) => m.id === id)?.name ?? null;
  try {
    switch (name as ToolName) {
      case "get_financial_overview":
        return { ok: true, result: overview(env) };
      case "find_transactions": {
        const i = input as z.infer<typeof schemas.find_transactions>;
        const cat = i.category ? norm(i.category) : null;
        const text = i.text ? norm(i.text) : null;
        const mem = i.member ? norm(i.member) : null;
        let list = d.transactions.filter((t) => t.status === "posted" && t.date >= i.date_from && t.date <= i.date_to && (i.type === "any" || t.type === i.type));
        if (cat) list = list.filter((t) => norm(catName(t.category_id) ?? "").includes(cat));
        if (text) list = list.filter((t) => norm(`${t.description} ${t.note ?? ""}`).includes(text));
        if (mem) list = list.filter((t) => norm(memName(t.member_id) ?? "").includes(mem));
        if (i.min_amount_czk != null) list = list.filter((t) => t.amount >= i.min_amount_czk! * 100);
        if (i.max_amount_czk != null) list = list.filter((t) => t.amount <= i.max_amount_czk! * 100);
        list.sort((a, b) => (i.sort === "largest" ? b.amount - a.amount : b.date.localeCompare(a.date)));
        const total = list.reduce((a, t) => a + (t.type === "income" ? t.amount : t.type === "expense" ? -t.amount : 0), 0);
        return {
          ok: true,
          result: {
            count: list.length,
            total_expenses_czk: kc(list.filter((t) => t.type === "expense").reduce((a, t) => a + t.amount, 0)),
            total_income_czk: kc(list.filter((t) => t.type === "income").reduce((a, t) => a + t.amount, 0)),
            net_czk: kc(total),
            items: list.slice(0, Math.min(100, Math.max(1, i.limit))).map((t) => ({
              date: t.date, type: t.type, amount_czk: kc(t.amount), description: t.description, category: catName(t.category_id),
              account: accName(t.account_id), to_account: accName(t.transfer_account_id), member: memName(t.member_id), scope: t.scope, note: t.note,
            })),
          },
        };
      }
      case "spending_by_category": {
        const i = input as z.infer<typeof schemas.spending_by_category>;
        const list = d.transactions.filter((t) => t.status === "posted" && t.date >= i.date_from && t.date <= i.date_to);
        const by = (type: "expense" | "income") => {
          const m = new Map<string, number>();
          for (const t of list.filter((x) => x.type === type)) m.set(catName(t.category_id) ?? "Bez kategorie", (m.get(catName(t.category_id) ?? "Bez kategorie") ?? 0) + t.amount);
          return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([category, amount]) => ({ category, amount_czk: kc(amount) }));
        };
        return { ok: true, result: { expenses: by("expense"), income: by("income") } };
      }
      case "monthly_history": {
        const r = lookback(s, d, Math.min(12, Math.max(1, (input as { months: number }).months)));
        const conv = (m: Record<string, unknown>) => Object.fromEntries(Object.entries(m).map(([k, v]) => [["income", "fixed", "variable", "saved", "net", "endBalance"].includes(k) ? `${k}_czk` : k, ["income", "fixed", "variable", "saved", "net", "endBalance"].includes(k) ? kc(v as number | null) : v]));
        return { ok: true, result: { months: r.months.map((m) => conv(m as never)), average: r.average ? conv(r.average as never) : null, note: "fixed = pravidelné platby a faktury, variable = ostatní výdaje" } };
      }
      case "check_affordability": {
        const price = Math.round((input as { price_czk: number }).price_czk * 100);
        const r = checkAffordability({ price, safeToSpend: s.planner.safeToSpend, monthlySurplus: s.monthlySurplus.amount, today });
        return { ok: true, result: { affordable: r.affordable, safe_to_spend_czk: kc(s.planner.safeToSpend), shortfall_czk: kc(r.shortfall), months_needed: r.monthsNeeded, affordable_from: r.affordableFrom, reason: r.reason, expected_income_not_counted_czk: kc(s.expectedIncomeTotal), safe_to_spend_if_income_arrives_czk: kc(s.planner.safeToSpendIfIncomeArrives) } };
      }
      case "what_if": {
        const i = input as z.infer<typeof schemas.what_if>;
        const r = whatIf(s, d, i.kind, Math.round(i.amount_czk * 100), i.installments ?? 10);
        return { ok: true, result: { title: r.title, monthly_surplus_before_czk: kc(r.monthlyBefore), monthly_surplus_after_czk: kc(r.monthlyAfter), safe_to_spend_before_czk: kc(r.safeBefore), safe_to_spend_after_czk: kc(r.safeAfter), goals: r.goals, notes: r.lines } };
      }
      case "forecast": {
        if (!d.accounts.length) return { ok: true, result: { error: "Chybí účty a zůstatky – nelze spočítat." } };
        const f = forecast(s, d, Math.min(6, Math.max(1, (input as { months: number }).months)));
        return { ok: true, result: { basis: f.basis, start_balance_end_of_this_month_czk: kc(s.projectedEndOfMonth), months: f.months.map((m) => ({ month: m.label, income_czk: kc(m.income), fixed_czk: kc(m.fixed), variable_czk: kc(m.variable), savings_czk: kc(m.savings), end_balance_czk: kc(m.endBalance), end_balance_without_expected_income_czk: kc(m.endBalanceWithoutIncome) })), tightest_month: f.tightest?.label ?? null } };
      }
      case "insights":
        return { ok: true, result: { anomalies: anomalies(s, d), savings_tips: savingsTips(s, d).map((t) => ({ tip: t.title, monthly_saving_czk: kc(t.saving) })), work: workInsights(d, today), weekly_summary: weeklySummary(s, d).lines, alerts: buildInsights(s, d).map((i) => ({ title: i.title, detail: i.detail ?? null, tone: i.tone })) } };
      case "list_records":
        return { ok: true, result: listRecords((input as { what: string }).what, env, { catName, accName, memName }) };
      case "propose_transaction": {
        const i = input as z.infer<typeof schemas.propose_transaction>;
        const cats = d.categories.filter((c) => c.kind === i.type && !c.is_archived);
        const wanted = i.category ?? guessCategoryName(i.description);
        const cat = wanted ? cats.find((c) => norm(c.name) === norm(wanted)) ?? cats.find((c) => norm(c.name).includes(norm(wanted))) : null;
        const draft = { type: i.type, amount: Math.round(i.amount_czk * 100), description: i.description.slice(0, 200), categoryId: cat?.id ?? null, paymentMethod: i.payment_method, date: i.date ?? today };
        env.drafts.push(draft);
        return { ok: true, result: { status: "Návrh připraven a zobrazen uživateli k potvrzení. Zatím NENÍ uložen – řekni uživateli, ať ho zkontroluje a potvrdí tlačítkem.", category: cat?.name ?? null } };
      }
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Chyba nástroje" };
  }
  return { ok: false, error: "Neznámý nástroj" };
}

function overview({ data: d, snapshot: s, today }: ToolEnv) {
  return {
    today,
    household_currency: "CZK",
    accounts: d.accounts.filter((a) => a.is_active).map((a) => ({ name: a.name, kind: a.kind, counts_as_available: a.include_in_available, balance_czk: kc(s.balance.byAccount[a.id] ?? 0) })),
    totals: { total_balance_czk: kc(s.balance.total), liquid_czk: kc(s.balance.liquid), available_after_reserved_goals_czk: kc(s.planner.available) },
    planner: { must_keep_czk: kc(s.planner.mustKeep), safe_to_spend_czk: kc(s.planner.safeToSpend), to_save_this_month_czk: kc(s.planner.toSave), need_to_earn_czk: kc(s.planner.needToEarn), can_save_czk: kc(s.planner.canSave), after_obligations_czk: kc(s.planner.afterObligations) },
    this_month: { income_czk: kc(s.month.income), expenses_czk: kc(s.month.expense), days_left: s.daysLeftInMonth, projected_end_of_month_czk: kc(s.projectedEndOfMonth), last_month_to_same_day_expenses_czk: kc(s.lastMonthToDate.expense) },
    food_budget: s.food ? { budget_czk: kc(s.food.budget), spent_czk: kc(s.food.spent), remaining_czk: kc(s.food.remaining), daily_limit_czk: kc(s.food.dailyLimit), week_limit_czk: kc(s.food.weekLimit), avg_daily_czk: kc(s.food.avgDaily), projected_czk: kc(s.food.projected), alerts: s.food.alerts.map((a) => a.message) } : null,
    category_budgets: s.categoryBudgets.map((c) => ({ category: c.category?.name, limit_czk: kc(c.budget.amount), spent_czk: kc(c.spent), remaining_czk: kc(c.remaining) })),
    goals: s.goals.progress.map((g) => ({ name: g.goal.name, saved_czk: kc(g.saved), target_czk: kc(g.goal.target_amount), percent: g.percent, target_date: g.goal.target_date, required_monthly_czk: kc(g.requiredMonthly), estimated_date: g.estimatedDate, achieved: g.achieved })),
    unpaid_obligations_until_month_end_czk: kc(s.unpaidObligationsTotal),
    upcoming_payments: s.upcoming.slice(0, 10).map((o) => ({ name: o.name, date: o.date, amount_czk: kc(o.amount), state: o.state })),
    expected_incomes_not_yet_available: s.expectedIncomes.map((e) => ({ name: e.name, date: e.date, amount_czk: kc(e.amount), late: e.late })),
    invoices: { unpaid_issued_czk: kc(s.invoices.unpaidIssuedTotal), unpaid_received_czk: kc(s.invoices.unpaidReceivedTotal), overdue: s.invoices.overdue.map((i) => ({ number: i.number, counterparty: i.counterparty, amount_czk: kc(i.amount), due_date: i.due_date })) },
    work_this_month: { net_czk: kc(s.work.month.net), days: s.work.month.days, hours: Math.round(s.work.month.minutes / 6) / 10, avg_per_hour_czk: kc(s.work.month.avgPerHour), expected_payouts_czk: kc(s.work.expectedPayoutTotal) },
    monthly_surplus_estimate_czk: kc(s.monthlySurplus.amount),
    missing_data: s.missing.map((m) => m.message),
    members: d.members.map((m) => m.name),
  };
}

function listRecords(what: string, { data: d, snapshot: s, today }: ToolEnv, n: { catName: (id: string | null) => string | null; accName: (id: string | null) => string | null; memName: (id: string | null) => string | null }) {
  switch (what) {
    case "recurring_payments": return d.recurring.map((r) => ({ name: r.name, amount_czk: kc(r.amount), frequency: r.frequency, first_due: r.start_date, end: r.end_date, category: n.catName(r.category_id), active: r.is_active, debt_remaining_czk: kc(r.debt_remaining) }));
    case "income_sources": return d.incomeSources.map((r) => ({ name: r.name, amount_czk: kc(r.amount), frequency: r.frequency, next: r.start_date, member: n.memName(r.member_id), active: r.is_active }));
    case "goals": return s.goals.progress.map((g) => ({ name: g.goal.name, kind: g.goal.kind, saved_czk: kc(g.saved), target_czk: kc(g.goal.target_amount), target_date: g.goal.target_date, monthly_czk: kc(g.goal.monthly_contribution), required_monthly_czk: kc(g.requiredMonthly), estimated_date: g.estimatedDate, status: g.goal.status }));
    case "invoices": return d.invoices.slice(0, 60).map((i) => ({ number: i.number, direction: i.direction, counterparty: i.counterparty, ico: i.counterparty_ico, issued: i.issue_date, due: i.due_date, paid: i.paid_date, amount_czk: kc(i.amount), status: invoiceStatusLabel(i, today) }));
    case "payouts": return d.payouts.slice(0, 24).map((p) => ({ label: p.label, expected_czk: kc(p.expected_amount), expected_date: p.expected_date, received_czk: kc(p.received_amount), received_date: p.received_date, status: p.status }));
    case "work_shifts": {
      const from = addMonths(startOfMonth(today), -2);
      const shifts = inPeriod(d.shifts, from, today);
      const agg = aggregate("3m", shifts);
      return { last_3_months: { shifts: agg.shifts, days: agg.days, hours: Math.round(agg.minutes / 6) / 10, gross_czk: kc(agg.gross), costs_czk: kc(agg.costs), net_czk: kc(agg.net), avg_per_day_czk: kc(agg.avgPerDay), avg_per_hour_czk: kc(agg.avgPerHour) }, recent: shifts.slice(0, 30).map((x) => ({ date: x.date, hours: Math.round(x.minutes / 6) / 10, orders: x.orders, routes: x.regular_routes + x.express_routes, net_czk: kc(shiftNet(x)) })) };
    }
    case "purchases": return d.purchases.map((p) => ({ name: p.name, price_czk: kc(p.price), kind: p.kind === "home" ? "nábytek/vybavení" : "nákup", room: p.room, priority: p.priority, status: p.status, wish: p.is_wish, planned: p.planned_date, url: p.url }));
    case "budgets": return d.budgets.map((b) => ({ kind: b.kind, category: n.catName(b.category_id), amount_czk: kc(b.amount), month: b.month ?? "každý měsíc" }));
    case "accounts": return d.accounts.map((a) => ({ name: a.name, kind: a.kind, opening_balance_czk: kc(a.opening_balance), opening_date: a.opening_date, current_czk: kc(s.balance.byAccount[a.id] ?? 0), active: a.is_active }));
    case "members": return d.members.map((m) => ({ name: m.name, has_account: Boolean(m.user_id), active: m.is_active }));
    case "categories": return d.categories.filter((c) => !c.is_archived).map((c) => ({ name: c.name, kind: c.kind, food: c.is_food, household: c.is_household }));
    case "documents": return d.documents.slice(0, 50).map((x) => ({ title: x.title, kind: x.kind, uploaded: x.created_at.slice(0, 10), tags: x.tags }));
  }
  return [];
}
