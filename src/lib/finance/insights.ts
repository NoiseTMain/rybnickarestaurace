import { clampZero, divCeil, divRound, formatMoney, sum, type Cents } from "@/lib/money";

const czk = (c: number) => formatMoney(Math.round(c), { decimals: "never" });
import { addDays, addMonths, endOfMonth, monthName, startOfMonth, weekday, type ISODate } from "@/lib/dates";
import type { Transaction } from "@/lib/db/types";
import type { FinanceData, Snapshot } from "./snapshot";
import { occurrences, FREQUENCY_PER_MONTH } from "./recurrence";

import { shiftNet } from "./work";

const posted = (t: Transaction) => t.status === "posted";
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// ---------------------------------------------------------------------------
// 1) Kategorie, obchody a období

export interface Period {
  from: ISODate;
  to: ISODate;
  label: string;
  months: number;
}

/** Rozpozná období v otázce („minulý měsíc“, „za poslední 3 měsíce“, „letos“, „tento týden“). */
export function parsePeriod(question: string, today: ISODate, monthsHint?: number | null): Period {
  const q = norm(question);
  const ms = startOfMonth(today);
  const lastN = /(?:poslednich|posledni|za)\s*(\d{1,2})\s*mesic/.exec(q)?.[1];
  const n = lastN ? Number(lastN) : monthsHint ?? null;
  if (n && n > 0) return { from: addMonths(ms, -(n - 1)), to: today, label: `za posledních ${n} ${n === 1 ? "měsíc" : n < 5 ? "měsíce" : "měsíců"}`, months: n };
  if (/minul(y|em) mesic/.test(q)) {
    const f = addMonths(ms, -1);
    return { from: f, to: endOfMonth(f), label: `v ${monthName(f)}`, months: 1 };
  }
  if (/letos|tento rok|za rok/.test(q)) return { from: `${today.slice(0, 4)}-01-01`, to: today, label: "letos", months: Number(today.slice(5, 7)) };
  if (/(tento|tenhle|tomto) tyden|za tyden/.test(q)) return { from: addDays(today, -((weekday(today) + 6) % 7)), to: today, label: "tento týden", months: 0.25 };
  return { from: ms, to: today, label: "tento měsíc", months: 1 };
}

export function findCategory(question: string, d: FinanceData, hint?: string | null) {
  const q = norm(question);
  const cats = d.categories.filter((c) => c.kind === "expense");
  if (hint) {
    const h = cats.find((c) => norm(c.name) === norm(hint));
    if (h) return h;
  }
  // nejdelší shoda názvu kategorie (i kmen slova: „restauracích“ → „restaurac“)
  let best: (typeof cats)[number] | null = null;
  for (const c of cats) {
    const stem = norm(c.name).replace(/[aeiouy]$/, "").slice(0, Math.max(4, norm(c.name).length - 2));
    if (stem.length >= 4 && q.includes(stem) && (!best || c.name.length > best.name.length)) best = c;
  }
  return best;
}

/** Obchod / obchodník: slovo z otázky, které se objevuje v popisech výdajů. */
export function findMerchant(question: string, d: FinanceData, hint?: string | null): string | null {
  const descs = d.transactions.filter((t) => t.type === "expense").map((t) => norm(`${t.description} ${t.note ?? ""}`));
  const candidates = hint ? [norm(hint)] : norm(question).split(/[^a-z0-9.]+/).filter((w) => w.length >= 3);
  for (const w of candidates) {
    const stem = w.replace(/(u|em|ech|ovi|e|a)$/, "");
    if (stem.length >= 3 && descs.some((x) => x.includes(stem))) return stem;
  }
  return null;
}

export function spendIn(d: FinanceData, p: Period, filter: (t: Transaction) => boolean) {
  const list = d.transactions.filter((t) => posted(t) && t.type === "expense" && t.date >= p.from && t.date <= p.to && filter(t));
  return { total: sum(list, (t) => t.amount), count: list.length, list };
}

// ---------------------------------------------------------------------------
// 2) Co kdyby – scénáře

export type ScenarioKind = "purchase" | "installments" | "rent_change" | "food_change" | "income_change";

export interface ScenarioResult {
  title: string;
  lines: string[];
  monthlyBefore: Cents | null;
  monthlyAfter: Cents | null;
  safeBefore: Cents;
  safeAfter: Cents;
  goals: { name: string; before: ISODate | null; after: ISODate | null }[];
}

export function whatIf(s: Snapshot, d: FinanceData, kind: ScenarioKind, amount: Cents, installments = 1): ScenarioResult {
  const before = s.monthlySurplus.amount;
  let monthlyDelta = 0;
  let nowDelta = 0;
  let title = "";
  if (kind === "purchase") { nowDelta = -amount; title = `Nákup za ${czk(amount)} najednou`; }
  if (kind === "installments") {
    const per = divCeil(amount, Math.max(1, installments));
    monthlyDelta = -per; nowDelta = -per;
    title = `Nákup za ${czk(amount)} na ${installments} splátek (${czk(per)} měsíčně)`;
  }
  if (kind === "rent_change") { monthlyDelta = -amount; nowDelta = -amount; title = `Nájem ${amount >= 0 ? "dražší" : "levnější"} o ${czk(Math.abs(amount))}`; }
  if (kind === "food_change") { monthlyDelta = -amount; nowDelta = -amount; title = amount < 0 ? `Na jídle ušetříte ${czk(Math.abs(amount))} měsíčně` : `Za jídlo utratíte o ${czk(amount)} měsíčně víc`; }
  if (kind === "income_change") { monthlyDelta = amount; title = `Příjem ${amount >= 0 ? "vyšší" : "nižší"} o ${czk(Math.abs(amount))} měsíčně`; }
  const after = before == null ? null : before + monthlyDelta;
  const safeBefore = s.planner.safeToSpend;
  const safeAfter = Math.max(0, safeBefore + nowDelta);
  // dopad na cíle bez termínu: odhad podle toho, kolik ze přebytku zbude na spoření
  const goals = s.goals.progress.filter((g) => !g.achieved && g.goal.status === "active").map((g) => {
    const share = (x: Cents | null) => (x != null && x > 0 ? x : 0);
    const est = (surplus: Cents) => {
      const monthly = Math.max(g.goal.monthly_contribution ?? 0, 0) || divRound(share(surplus), Math.max(1, s.goals.progress.length));
      if (monthly <= 0) return null;
      return addMonths(startOfMonth(s.today), divCeil(g.remaining, monthly));
    };
    const b = before != null ? est(before) : g.estimatedDate;
    const a = after != null ? est(Math.max(0, after)) : null;
    return { name: g.goal.name, before: b, after: g.goal.monthly_contribution ? (after != null && after < 0 ? null : b) : a };
  });
  const lines = [
    before != null ? `Měsíčně vám zbývá ~${czk(before)} → po změně ~${czk((after ?? 0))}` : "Měsíční přebytek zatím nelze spočítat – chybí historie nebo pravidelné příjmy.",
    `Bezpečně k utracení tento měsíc: ${czk(safeBefore)} → ${czk(safeAfter)}`,
  ];
  if (after != null && after < 0) lines.push("Pozor: po změně by vám měsíčně chybělo – výdaje by převýšily příjmy.");
  if (kind === "installments" && amount > 0 && installments > 1) lines.push("Splátky často znamenají úrok/RPSN – zkontrolujte celkovou cenu u prodejce.");
  return { title, lines, monthlyBefore: before, monthlyAfter: after, safeBefore, safeAfter, goals };
}

// ---------------------------------------------------------------------------
// 3) Výhled na 3 měsíce

export interface ForecastMonth {
  start: ISODate;
  label: string;
  income: Cents;
  fixed: Cents;
  variable: Cents;
  savings: Cents;
  net: Cents;
  endBalance: Cents;
  endBalanceWithoutIncome: Cents;
}

export function forecast(s: Snapshot, d: FinanceData, months = 3): { months: ForecastMonth[]; basis: string; tightest: ForecastMonth | null } {
  const ms = startOfMonth(s.today);
  // průměr variabilních výdajů za poslední až 3 celé měsíce, jinak rozpočty
  const variableMonths: Cents[] = [];
  for (let i = 1; i <= 3; i++) {
    const f = addMonths(ms, -i);
    const list = d.transactions.filter((t) => posted(t) && t.type === "expense" && t.date >= f && t.date <= endOfMonth(f) && !t.recurring_payment_id && !t.invoice_id);
    if (d.transactions.some((t) => t.date <= f)) variableMonths.push(sum(list, (t) => t.amount));
  }
  const budgetsVariable = sum(d.budgets.filter((b) => b.month == null && (b.kind === "food" || b.kind === "category")), (b) => b.amount);
  const avgVariable = variableMonths.length ? divRound(sum(variableMonths, (x) => x), variableMonths.length) : budgetsVariable;
  const basis = variableMonths.length ? `běžné výdaje podle průměru posledních ${variableMonths.length} měsíců` : "běžné výdaje podle rozpočtů";
  const savingsMonthly = s.goals.requiredMonthlyTotal;
  let bal = s.projectedEndOfMonth;
  let balNoIncome = s.projectedEndOfMonth;
  const out: ForecastMonth[] = [];
  for (let i = 1; i <= months; i++) {
    const f = addMonths(ms, i);
    const t = endOfMonth(f);
    const income = sum(d.incomeSources.filter((x) => x.is_active), (x) => x.amount * occurrences(x, f, t).length)
      + sum(d.payouts.filter((p) => p.status === "expected" && p.expected_date >= f && p.expected_date <= t), (p) => p.expected_amount);
    const fixed = sum(d.recurring.filter((r) => r.is_active), (r) => r.amount * occurrences(r, f, t).length);
    const net = income - fixed - avgVariable - savingsMonthly;
    bal += net;
    balNoIncome += -fixed - avgVariable - savingsMonthly;
    out.push({ start: f, label: monthName(f), income, fixed, variable: avgVariable, savings: savingsMonthly, net, endBalance: bal, endBalanceWithoutIncome: balNoIncome });
  }
  const tightest = out.reduce<ForecastMonth | null>((m, x) => (m == null || x.endBalance < m.endBalance ? x : m), null);
  return { months: out, basis, tightest };
}

// ---------------------------------------------------------------------------
// 4) Neobvyklé věci

export interface Anomaly {
  id: string;
  tone: "warning" | "danger" | "neutral";
  title: string;
  detail?: string;
}

export function anomalies(s: Snapshot, d: FinanceData): Anomaly[] {
  const out: Anomaly[] = [];
  const recent = addDays(s.today, -30);
  const expenses = d.transactions.filter((t) => posted(t) && t.type === "expense");
  const catName = (id: string | null) => d.categories.find((c) => c.id === id)?.name ?? "bez kategorie";

  // neobvykle vysoký výdaj v kategorii
  for (const t of expenses.filter((x) => x.date >= recent)) {
    const history = expenses.filter((x) => x.category_id === t.category_id && x.id !== t.id && x.date < t.date).map((x) => x.amount).sort((a, b) => a - b);
    if (history.length < 5) continue;
    const median = history[Math.floor(history.length / 2)];
    if (t.amount > median * 3 && t.amount - median > 50_000) {
      out.push({ id: `big-${t.id}`, tone: "warning", title: `Neobvykle vysoký výdaj: ${t.description || catName(t.category_id)} ${czk(t.amount)}`, detail: `Obvykle v kategorii „${catName(t.category_id)}“ utrácíte kolem ${czk(median)}.` });
    }
  }
  // stejná platba dvakrát
  const recentExp = expenses.filter((x) => x.date >= recent).sort((a, b) => a.date.localeCompare(b.date));
  const seen = new Set<string>();
  for (let i = 0; i < recentExp.length; i++) {
    for (let j = i + 1; j < recentExp.length; j++) {
      const a = recentExp[i], b = recentExp[j];
      if (b.date > addDays(a.date, 3)) break;
      if (a.amount === b.amount && a.amount >= 10_000 && norm(a.description) === norm(b.description) && a.description && !seen.has(a.id)) {
        seen.add(a.id); seen.add(b.id);
        out.push({ id: `dup-${a.id}`, tone: "danger", title: `Možná duplicitní platba: ${a.description} ${czk(a.amount)} (${a.date} a ${b.date})`, detail: "Zkontrolujte, zda nejde o stejnou platbu zapsanou dvakrát – případně ji stornujte." });
      }
    }
  }
  // opakující se platby, které nejsou v pravidelných platbách (možné zapomenuté předplatné)
  const groups = new Map<string, Transaction[]>();
  for (const t of expenses.filter((x) => x.date >= addDays(s.today, -120) && !x.recurring_payment_id)) {
    const k = `${norm(t.description).slice(0, 20)}|${t.amount}`;
    if (!t.description) continue;
    groups.set(k, [...(groups.get(k) ?? []), t]);
  }
  const knownRecurring = d.recurring.map((r) => norm(r.name));
  for (const [, list] of groups) {
    const months = new Set(list.map((t) => t.date.slice(0, 7)));
    if (months.size >= 3 && !knownRecurring.some((r) => r.includes(norm(list[0].description).slice(0, 6)))) {
      out.push({ id: `sub-${list[0].id}`, tone: "neutral", title: `Pravidelná platba „${list[0].description}“ (${czk(list[0].amount)}) není v pravidelných platbách`, detail: `Opakuje se ${months.size} měsíce po sobě. Pokud jde o předplatné, které nepoužíváte, ročně by to ušetřilo ${czk((list[0].amount * 12))}.` });
    }
  }
  // zdražující energie
  for (const name of ["Elektřina", "Plyn", "Voda"]) {
    const cat = d.categories.find((c) => c.name === name);
    if (!cat) continue;
    const list = expenses.filter((t) => t.category_id === cat.id).sort((a, b) => a.date.localeCompare(b.date));
    if (list.length < 4) continue;
    const first = list.slice(0, 2), last = list.slice(-2);
    const a = divRound(sum(first, (t) => t.amount), first.length), b = divRound(sum(last, (t) => t.amount), last.length);
    if (b > a * 1.1) out.push({ id: `util-${name}`, tone: "warning", title: `${name}: platby rostou (${Math.round(a / 100)} → ${czk(b)})`, detail: "Zkontrolujte vyúčtování nebo srovnejte dodavatele." });
  }
  // nižší výplata
  const received = d.payouts.filter((p) => p.status === "received" && p.received_amount != null).sort((a, b) => (a.received_date ?? "").localeCompare(b.received_date ?? ""));
  if (received.length >= 3) {
    const last = received[received.length - 1];
    const prev = received.slice(-4, -1);
    const avg = divRound(sum(prev, (p) => p.received_amount!), prev.length);
    if (last.received_amount! < avg * 0.9) out.push({ id: `payout-${last.id}`, tone: "warning", title: `Poslední výplata (${czk(last.received_amount!)}) je nižší než obvykle (~${czk(avg)})`, detail: "Srovnejte s odpracovanými směnami v sekci Práce." });
  }
  // přijatá výplata nižší, než se čekalo
  for (const p of received.slice(-3)) {
    if (p.received_amount! < p.expected_amount - 10_000) out.push({ id: `payout-diff-${p.id}`, tone: "warning", title: `${p.label}: přišlo o ${czk((p.expected_amount - p.received_amount!))} méně, než se čekalo` });
  }
  return out.slice(0, 12);
}

// ---------------------------------------------------------------------------
// 5) Tipy na úspory

export interface Tip {
  id: string;
  title: string;
  saving: Cents;
}

export function savingsTips(s: Snapshot, d: FinanceData): Tip[] {
  const out: Tip[] = [];
  const ms = startOfMonth(s.today);
  const goal = s.goals.progress.find((g) => !g.achieved && g.goal.status === "active");
  const toGoal = goal ? ` na cíl „${goal.goal.name}“` : " na spoření";
  // poslední celý měsíc vs. průměr 3 předchozích, podle kategorie
  const last = addMonths(ms, -1);
  const cats = d.categories.filter((c) => c.kind === "expense" && !["Nájem", "Elektřina", "Plyn", "Voda", "Pojištění"].includes(c.name));
  for (const c of cats) {
    const inMonth = (f: ISODate) => sum(d.transactions.filter((t) => posted(t) && t.type === "expense" && t.category_id === c.id && t.date >= f && t.date <= endOfMonth(f)), (t) => t.amount);
    const lastSpend = inMonth(last);
    const prev = [2, 3, 4].map((i) => inMonth(addMonths(ms, -i))).filter((x) => x > 0);
    if (prev.length < 2) continue;
    const avg = divRound(sum(prev, (x) => x), prev.length);
    if (lastSpend > avg * 1.2 && lastSpend - avg >= 30_000) {
      out.push({ id: `cat-${c.id}`, saving: lastSpend - avg, title: `${c.name}: minulý měsíc ${czk(lastSpend)}, obvykle ${czk(avg)}. Návrat k průměru = +${czk((lastSpend - avg))} měsíčně${toGoal}.` });
    }
  }
  // předplatné a zábava – roční náklad
  const subs = d.recurring.filter((r) => r.is_active && /netflix|spotify|hbo|disney|youtube|apple|google|předplat|predplat|max\b/i.test(r.name));
  if (subs.length) {
    const yearly = sum(subs, (r) => divRound(r.amount * FREQUENCY_PER_MONTH[r.frequency][0] * 12, FREQUENCY_PER_MONTH[r.frequency][1]));
    out.push({ id: "subs", saving: divRound(yearly, 12), title: `Předplatná vás stojí ${czk(yearly)} ročně (${subs.map((r) => r.name).join(", ")}). Zrušení nevyužívaného = úspora.` });
  }
  if (s.food && s.food.vsPlan < -50_000) {
    out.push({ id: "food", saving: clampZero(-s.food.vsPlan), title: `Jídlo: jste ${czk(-s.food.vsPlan)} nad plánem. Nákup podle seznamu v sekci Plánování pomůže držet limit ${czk(s.food.dailyLimit)}/den.` });
  }
  return out.sort((a, b) => b.saving - a.saving).slice(0, 6);
}

// ---------------------------------------------------------------------------
// 6) Postřehy z práce

const DAYS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];

export function workInsights(d: FinanceData, today: ISODate): string[] {
  const shifts = d.shifts.filter((x) => x.date >= addDays(today, -120) && x.minutes > 0);
  if (shifts.length < 3) return [];
  const out: string[] = [];
  const perDay = new Map<number, { net: number; min: number; n: number }>();
  for (const s of shifts) {
    const w = weekday(s.date);
    const v = perDay.get(w) ?? { net: 0, min: 0, n: 0 };
    perDay.set(w, { net: v.net + shiftNet(s), min: v.min + s.minutes, n: v.n + 1 });
  }
  const ranked = [...perDay.entries()].filter(([, v]) => v.n >= 2).map(([w, v]) => ({ w, perHour: (v.net * 60) / v.min })).sort((a, b) => b.perHour - a.perHour);
  if (ranked.length >= 2) out.push(`Nejvíc vyděláte v ${DAYS[ranked[0].w]} (~${czk(ranked[0].perHour)}/h), nejméně v ${DAYS[ranked[ranked.length - 1].w]} (~${czk(ranked[ranked.length - 1].perHour)}/h).`);
  const peak = shifts.filter((s) => s.peak_minutes * 2 >= s.minutes), off = shifts.filter((s) => s.peak_minutes * 2 < s.minutes);
  const ph = (l: typeof shifts) => (l.length ? (sum(l, shiftNet) * 60) / l.reduce((a, s) => a + s.minutes, 0) : 0);
  if (peak.length >= 2 && off.length >= 2) out.push(`Směny převážně ve špičce: ~${czk(ph(peak))}/h, mimo špičku: ~${czk(ph(off))}/h.`);
  const gross = sum(shifts, (s) => s.base_earnings + s.tips + s.bonuses + s.rewards);
  const rent = sum(shifts, (s) => s.vehicle_rent);
  if (gross > 0 && rent > 0) out.push(`Pronájem vozidla tvoří ${Math.round((rent / gross) * 100)} % hrubého výdělku (${czk(rent)} za posledních ${shifts.length} směn).`);
  // odhad příští výplaty: směny od konce posledního vyúčtovaného období
  const lastPeriodEnd = d.payouts.map((p) => p.period_to).filter((x): x is string => Boolean(x)).sort().pop() ?? startOfMonth(today);
  const pending = d.shifts.filter((s) => s.date > lastPeriodEnd && s.date <= today);
  if (pending.length) out.push(`Odhad příští výplaty podle ${pending.length} odjetých směn od ${lastPeriodEnd}: ~${czk(sum(pending, shiftNet))} (čistého).`);
  return out;
}

// ---------------------------------------------------------------------------
// 9) Týdenní souhrn

export function weeklySummary(s: Snapshot, d: FinanceData): { title: string; lines: string[] } {
  const weekStart = addDays(s.today, -6);
  const prevStart = addDays(s.today, -13);
  const spentWeek = sum(d.transactions.filter((t) => posted(t) && t.type === "expense" && t.date >= weekStart && t.date <= s.today), (t) => t.amount);
  const spentPrev = sum(d.transactions.filter((t) => posted(t) && t.type === "expense" && t.date >= prevStart && t.date < weekStart), (t) => t.amount);
  const upcoming = s.upcoming.filter((o) => o.date <= addDays(s.today, 7));
  const lines = [
    `Za posledních 7 dní jste utratili ${czk(spentWeek)}${spentPrev ? ` (předchozí týden ${czk(spentPrev)})` : ""}.`,
    s.food ? `Jídlo: zbývá ${czk(s.food.remaining)}, tj. ${czk(s.food.dailyLimit)} na den.` : "",
    upcoming.length ? `Příštích 7 dní: ${upcoming.map((o) => `${o.name} ${czk(o.amount)}`).join(", ")}.` : "Příštích 7 dní žádné platby.",
    s.goals.progress.length ? `Spoření: ${czk(s.goals.totalSaved)} z ${czk(s.goals.totalTarget)}, tento měsíc zbývá odložit ${czk(s.goals.remainingThisMonth)}.` : "",
    s.invoices.overdue.length ? `Faktury po splatnosti: ${s.invoices.overdue.length}.` : "",
    `Bezpečně k utracení do konce měsíce: ${czk(s.planner.safeToSpend)}.`,
  ].filter(Boolean);
  return { title: "Týdenní souhrn", lines };
}

