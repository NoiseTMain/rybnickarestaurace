import { searchKb, type KbEntry } from "@/lib/assistant-kb";
import { abs, divFloor, divRound, formatMoney as fm, parseMoney, sub, type Cents } from "@/lib/money";
import { diffDays, endOfMonth, endOfWeek, formatDate, minDate, monthName } from "@/lib/dates";
import type { FinanceData, Snapshot } from "@/lib/finance/snapshot";
import { checkAffordability } from "@/lib/finance/affordability";
import { anomalies, findCategory, findMerchant, forecast, lookback, parsePeriod, savingsTips, spendIn, weeklySummary, whatIf, workInsights, type ScenarioKind } from "@/lib/finance/insights";
import { guessCategoryName } from "@/lib/categorize";

/**
 * Finanční asistent – deterministická analýza nad skutečnými daty.
 * Nepoužívá jazykový model, nic si nevymýšlí: každé tvrzení je spočítané
 * z databáze. Chybí-li data, asistent se doptá a odkáže, kde je doplnit.
 */

export type InsightTone = "positive" | "neutral" | "warning" | "danger";

export interface Insight {
  id: string;
  tone: InsightTone;
  title: string;
  detail?: string;
  href?: string;
}

const fmt = (c: Cents) => fm(c, { decimals: "never" });

/** Kolik lze utratit tento týden mimo jídlo (poměrně ze zbytku měsíce). */
export function weeklySafe(s: Snapshot): { amount: Cents; days: number } {
  const weekEnd = minDate(endOfWeek(s.today), endOfMonth(s.today));
  const days = diffDays(s.today, weekEnd) + 1;
  return { amount: divFloor(s.planner.safeToSpend * days, s.daysLeftInMonth), days };
}

export function buildInsights(s: Snapshot, d: FinanceData): Insight[] {
  const out: Insight[] = [];
  for (const m of s.missing) out.push({ id: `missing-${m.code}`, tone: "neutral", title: "Chybí údaje", detail: m.message, href: m.href });

  if (s.food) {
    const diff = sub(s.food.spent, s.foodSpentLastMonthToDate);
    if (s.foodSpentLastMonthToDate > 0 && diff !== 0) {
      out.push({
        id: "food-vs-last",
        tone: diff > 0 ? "warning" : "positive",
        title: `Za potraviny jste tento měsíc utratili o ${fmt(abs(diff))} ${diff > 0 ? "více" : "méně"} než ve stejném období minulého měsíce.`,
        detail: `Tento měsíc ${fmt(s.food.spent)}, minulý měsíc ke stejnému dni ${fmt(s.foodSpentLastMonthToDate)}.`,
        href: "/rozpocty",
      });
    }
    for (const a of s.food.alerts) out.push({ id: `food-${a.code}`, tone: a.level === "danger" ? "danger" : "warning", title: a.message, href: "/rozpocty" });
  }

  if (d.accounts.length) {
    out.push({
      id: "eom",
      tone: s.projectedEndOfMonth >= 0 ? "neutral" : "danger",
      title: s.projectedEndOfMonth >= 0
        ? `Na konci měsíce vám při současném tempu pravděpodobně zbude ${fmt(s.projectedEndOfMonth)}.`
        : `Při současném tempu vám do konce měsíce bude chybět ${fmt(abs(s.projectedEndOfMonth))}.`,
      detail: `Výpočet: disponibilní ${fmt(s.planner.available)} − nezaplacené závazky ${fmt(s.unpaidObligationsTotal)} − běžné výdaje ${fmt(s.avgDailyVariableSpend)}/den × ${s.daysLeftInMonth - 1} dní. Očekávané příjmy (${fmt(s.expectedIncomeTotal)}) nejsou započteny.`,
    });
    const w = weeklySafe(s);
    out.push({
      id: "week",
      tone: w.amount > 0 ? "positive" : "warning",
      title: `Tento týden můžete bezpečně utratit maximálně ${fmt(w.amount)} mimo potraviny.`,
      detail: s.food ? `Na jídlo máte tento týden ještě ${fmt(s.food.weekLimit)}.` : undefined,
    });
  }

  for (const g of s.goals.progress) {
    if (g.achieved || g.goal.status !== "active") continue;
    if (g.requiredMonthly != null && g.requiredMonthly > 0) {
      out.push({
        id: `goal-${g.goal.id}`,
        tone: g.overdue ? "danger" : "neutral",
        title: g.overdue
          ? `Termín cíle „${g.goal.name}“ už uplynul – chybí ${fmt(g.remaining)}.`
          : `Abyste dosáhli cíle „${g.goal.name}“ do ${formatDate(g.goal.target_date)}, potřebujete odkládat ${fmt(g.requiredMonthly)} měsíčně.`,
        href: "/sporeni",
      });
    }
  }

  if (s.invoices.overdue.length) {
    const n = s.invoices.overdue.length;
    out.push({
      id: "inv-overdue",
      tone: "danger",
      title: `Máte ${n} ${n === 1 ? "fakturu" : n < 5 ? "faktury" : "faktur"} po splatnosti.`,
      detail: s.invoices.overdue.slice(0, 4).map((i) => `${i.number} (${i.counterparty}) – ${fmt(i.amount)}`).join(", "),
      href: "/faktury?stav=po-splatnosti",
    });
  }

  const soon = s.upcoming.filter((o) => diffDays(s.today, o.date) <= (d.settings?.notify_due_days ?? 5));
  if (soon.length) {
    out.push({
      id: "due-soon",
      tone: soon.some((o) => o.state === "overdue") ? "danger" : "warning",
      title: `${soon.length} ${soon.length === 1 ? "platba je" : "plateb je"} splatných v příštích dnech nebo po splatnosti.`,
      detail: soon.slice(0, 4).map((o) => `${o.name} ${formatDate(o.date)} – ${fmt(o.amount)}`).join(", "),
      href: "/platby",
    });
  }

  for (const c of s.categoryBudgets.filter((c) => c.over)) {
    out.push({ id: `cat-${c.budget.id}`, tone: "danger", title: `Rozpočet „${c.category?.name ?? "kategorie"}“ je překročen o ${fmt(abs(c.remaining))}.`, href: "/rozpocty" });
  }

  if (s.planner.needToEarn > 0) {
    out.push({
      id: "need-earn",
      tone: "danger",
      title: `Do konce měsíce potřebujete ještě vydělat ${fmt(s.planner.needToEarn)}, aby vyšly závazky, rozpočty, rezerva i plán spoření.`,
      href: "/sporeni#planovac",
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Otázky

export interface AssistantContext {
  intent: string;
  amount?: number | null;
  category?: string | null;
  merchant?: string | null;
  months?: number | null;
  scenario?: string | null;
  installments?: number | null;
}

export interface ExpenseDraft {
  amount: Cents;
  description: string;
  categoryId: string | null;
  paymentMethod: "card" | "cash" | "transfer" | "other";
  date: string;
}

export interface AssistantAnswer {
  text: string;
  lines?: string[];
  tone: InsightTone;
  /** Asistent potřebuje doplnit údaj. */
  needs?: { message: string; href?: string };
  /** Kontext pro navazující otázky („A za 20 000?“). */
  context?: AssistantContext;
  /** Návrh výdaje k potvrzení. */
  draft?: ExpenseDraft;
  /** Tabulka (např. výhled na 3 měsíce). */
  table?: { head: string[]; rows: string[][] };
  /** Odpověď vznikla z dotazu interpretovaného AI (čísla stále počítá aplikace). */
  viaAi?: boolean;
}

function norm(q: string) {
  return q.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Najde částku v otázce: „15 000 Kč“, „15000“, „15 tis.“, „15k“, „1,5 mil“. */
export function extractAmount(question: string): Cents | null {
  const q = norm(question);
  const m = /(\d[\d\s ]*(?:[,.]\d+)?)\s*(tisic|tis\.?|k\b|mil\.?|milion\w*)?\s*(kc|korun|czk)?/i.exec(q);
  if (!m) return null;
  const raw = m[1].trim();
  const mult = m[2] ? (m[2].startsWith("mil") ? 1_000_000 : 1_000) : 1;
  if (mult === 1) return parseMoney(raw);
  const base = parseMoney(raw.replace(/\s/g, ""));
  return base == null ? null : base * mult;
}

function baseAnswer(question: string, s: Snapshot, d: FinanceData): AssistantAnswer {
  const q = norm(question.trim());
  if (!q) return { text: "Zeptejte se třeba: „Můžeme si dovolit koupit sedačku za 15 000 Kč?“", tone: "neutral" };

  const needAccounts = (): AssistantAnswer => ({
    text: "Abych mohl odpovědět, potřebuji znát vaše účty a jejich aktuální zůstatky.",
    tone: "neutral",
    needs: { message: "Doplňte účty a zůstatky v Nastavení.", href: "/nastaveni#ucty" },
  });

  // 1) Můžeme si dovolit…?
  if (/(dovolit|koupit|koupime|mame na|stihneme zaplatit|utratit za|investovat)/.test(q)) {
    if (!d.accounts.length) return needAccounts();
    const price = extractAmount(question);
    if (price == null || price <= 0) {
      return { text: "Kolik daná věc stojí? Napište prosím částku, např. „…za 15 000 Kč“.", tone: "neutral", needs: { message: "Chybí cena." } };
    }
    const r = checkAffordability({ price, safeToSpend: s.planner.safeToSpend, monthlySurplus: s.monthlySurplus.amount, today: s.today });
    const lines = [
      `Disponibilní peníze: ${fmt(s.planner.available)}`,
      `Musí zůstat na účtu (závazky, jídlo, rozpočty, rezerva): ${fmt(sub(s.planner.mustKeep, s.reservedOnLiquid))}`,
      `Plán spoření tento měsíc: ${fmt(s.planner.toSave)}`,
      `Bezpečně k utracení: ${fmt(s.planner.safeToSpend)}`,
    ];
    if (s.expectedIncomeTotal > 0) lines.push(`Očekávané příjmy ${fmt(s.expectedIncomeTotal)} nejsou započteny, dokud nepřijdou.`);
    if (r.affordable) {
      return {
        text: `Ano. Nákup za ${fmt(price)} si můžete dovolit – po něm vám zbude ${fmt(sub(s.planner.safeToSpend, price))} k bezpečnému utracení do konce měsíce.`,
        lines, tone: "positive",
      };
    }
    const when = r.affordableFrom ? ` Při současném tempu si ho můžete bezpečně dovolit přibližně od ${monthName(r.affordableFrom)} (za ${r.monthsNeeded} měs.).` : ` ${r.reason}`;
    const withIncome = s.planner.safeToSpendIfIncomeArrives >= price && s.expectedIncomeTotal > 0
      ? " Pokud dorazí očekávané příjmy, nákup by se do rozpočtu vešel."
      : "";
    return { text: `Nákup za ${fmt(price)} teď ne. Chybí vám ${fmt(r.shortfall)} – tolik je potřeba ušetřit.${when}${withIncome}`, lines, tone: "warning" };
  }

  // 2) Jídlo
  if (/(jidl|potravin|nakup(y)? jidla|na jidlo)/.test(q)) {
    if (!s.food) return { text: "Zatím nemáte nastavený rozpočet na jídlo. Kolik chcete měsíčně utratit za potraviny?", tone: "neutral", needs: { message: "Nastavte rozpočet na jídlo.", href: "/rozpocty" } };
    const f = s.food;
    return {
      text: f.remaining >= 0
        ? `Na jídlo vám tento měsíc zbývá ${fmt(f.remaining)} – to je ${fmt(f.dailyLimit)} na den a ${fmt(f.weekLimit)} do konce týdne.`
        : `Rozpočet na jídlo je překročen o ${fmt(abs(f.remaining))}.`,
      lines: [
        `Rozpočet ${fmt(f.budget)}, utraceno ${fmt(f.spent)} (${f.usedPercent} %)`,
        `Průměrně utrácíte ${fmt(f.avgDaily)} denně, plán je ${fmt(f.plannedDaily)}`,
        `Odhad na konec měsíce: ${fmt(f.projected)}`,
        f.vsPlan >= 0 ? `Jste ${fmt(f.vsPlan)} pod plánem.` : `Jste ${fmt(abs(f.vsPlan))} nad plánem.`,
        ...(s.foodSpentLastMonthToDate > 0 ? [`Minulý měsíc ke stejnému dni: ${fmt(s.foodSpentLastMonthToDate)}`] : []),
      ],
      tone: f.status === "over" ? "danger" : f.status === "warning" ? "warning" : "positive",
    };
  }

  // 3) Týden / kolik můžeme utratit
  if (/(tyden|tydnu|dnes|kolik muzeme utratit|kolik muzu utratit|volnych|volne penize)/.test(q)) {
    if (!d.accounts.length) return needAccounts();
    const w = weeklySafe(s);
    return {
      text: `Tento týden (${w.days} ${w.days === 1 ? "den" : w.days < 5 ? "dny" : "dní"}) můžete bezpečně utratit ${fmt(w.amount)} mimo potraviny. Do konce měsíce celkem ${fmt(s.planner.safeToSpend)}.`,
      lines: s.food ? [`Na jídlo zbývá ${fmt(s.food.weekLimit)} do konce týdne (${fmt(s.food.dailyLimit)}/den).`] : undefined,
      tone: w.amount > 0 ? "positive" : "warning",
    };
  }

  // 4) Konec měsíce
  if (/(konec mesice|konci mesice|zbude|zustane|vyjdeme|vystaci)/.test(q)) {
    if (!d.accounts.length) return needAccounts();
    return {
      text: s.projectedEndOfMonth >= 0
        ? `Při současném tempu vám na konci měsíce zbude přibližně ${fmt(s.projectedEndOfMonth)}.`
        : `Při současném tempu vám do konce měsíce bude chybět přibližně ${fmt(abs(s.projectedEndOfMonth))}.`,
      lines: [
        `Disponibilní teď: ${fmt(s.planner.available)}`,
        `Nezaplacené závazky do konce měsíce: ${fmt(s.unpaidObligationsTotal)}`,
        `Běžné výdaje průměrně ${fmt(s.avgDailyVariableSpend)} denně, zbývá ${s.daysLeftInMonth - 1} dní`,
        `Očekávané příjmy (nezapočteno): ${fmt(s.expectedIncomeTotal)}`,
      ],
      tone: s.projectedEndOfMonth >= 0 ? "neutral" : "danger",
    };
  }

  // 5) Faktury
  if (/faktur/.test(q)) {
    const o = s.invoices.overdue;
    return {
      text: o.length ? `Po splatnosti máte ${o.length} ${o.length === 1 ? "fakturu" : "faktury"}.` : "Žádnou fakturu po splatnosti nemáte.",
      lines: [
        ...o.map((i) => `${i.direction === "issued" ? "Vystavená" : "Přijatá"} ${i.number} – ${i.counterparty}, ${fmt(i.amount)}, splatnost ${formatDate(i.due_date)}`),
        `Nezaplacené vystavené: ${s.invoices.unpaidIssued.length} (${fmt(s.invoices.unpaidIssuedTotal)})`,
        `Nezaplacené přijaté: ${s.invoices.unpaidReceived.length} (${fmt(s.invoices.unpaidReceivedTotal)})`,
      ],
      tone: o.length ? "danger" : "positive",
    };
  }

  // 6) Spoření a cíle
  if (/(spor|cil|odklad|nasporit|rezerv)/.test(q)) {
    if (!s.goals.progress.length) return { text: "Zatím nemáte žádný spořicí cíl. Na co chcete šetřit a kolik?", tone: "neutral", needs: { message: "Vytvořte cíl.", href: "/sporeni" } };
    return {
      text: `Na cílech máte celkem ${fmt(s.goals.totalSaved)} z ${fmt(s.goals.totalTarget)}. Tento měsíc je podle plánu potřeba odložit ještě ${fmt(s.goals.remainingThisMonth)}; můžete odložit až ${fmt(s.planner.canSave)}.`,
      lines: s.goals.progress.map((g) =>
        `${g.goal.name}: ${fmt(g.saved)} / ${fmt(g.goal.target_amount)} (${g.percent} %)` +
        (g.requiredMonthly != null && !g.achieved ? ` – potřeba ${fmt(g.requiredMonthly)}/měs.` : "") +
        (g.estimatedDate ? `, odhad splnění ${monthName(g.estimatedDate)}` : ""),
      ),
      tone: "neutral",
    };
  }

  // 7) Práce / výdělek
  if (WORK_RE.test(q)) {
    const m = s.work.month;
    if (!d.shifts.length) return { text: "Zatím nemáte zadané žádné směny.", tone: "neutral", needs: { message: "Přidejte směnu nebo importujte CSV.", href: "/prace" } };
    return {
      text: `Tento měsíc máte čistý pracovní výsledek ${fmt(m.net)} za ${m.days} ${m.days === 1 ? "den" : "dní"} (${fmt(m.avgPerDay)}/den, ${fmt(m.avgPerHour)}/h).`,
      lines: [
        `Hrubý příjem ${fmt(m.gross)}, náklady ${fmt(m.costs)}`,
        `Minulý měsíc: ${fmt(s.work.lastMonth.net)}`,
        `Očekávané výplaty: ${s.work.expectedPayouts.length} (${fmt(s.work.expectedPayoutTotal)}) – nejsou započteny jako dostupné peníze.`,
      ],
      tone: "neutral",
    };
  }

  // 8) Srovnání s minulým měsícem
  if (/(minul|oproti|porovn|srovn)/.test(q)) {
    const diff = sub(s.month.expense, s.lastMonthToDate.expense);
    return {
      text: `Do dnešního dne jste utratili ${fmt(s.month.expense)}, minulý měsíc ke stejnému dni ${fmt(s.lastMonthToDate.expense)} (${diff >= 0 ? "+" : "−"}${fmt(abs(diff))}).`,
      lines: [`Příjmy: tento měsíc ${fmt(s.month.income)}, minulý ke stejnému dni ${fmt(s.lastMonthToDate.income)}`],
      tone: diff > 0 ? "warning" : "positive",
    };
  }

  // 9) Platby
  if (/(plat|najem|splatn|zavaz|dluh|splatk)/.test(q)) {
    const list = s.upcoming.slice(0, 8);
    return {
      text: list.length ? `Nejbližší nezaplacené platby (celkem do konce měsíce ${fmt(s.unpaidObligationsTotal)}):` : "Nemáte žádné nezaplacené pravidelné platby.",
      lines: list.map((o) => `${formatDate(o.date)} – ${o.name}: ${fmt(o.amount)}${o.state === "overdue" ? " (po splatnosti)" : ""}`),
      tone: list.some((o) => o.state === "overdue") ? "danger" : "neutral",
    };
  }

  // 10) Zůstatek
  if (/(zustatek|kolik mame|na uctu|penez mame)/.test(q)) {
    if (!d.accounts.length) return needAccounts();
    return {
      text: `Celkem máte ${fmt(s.balance.total)}, z toho na běžných účtech a v hotovosti ${fmt(s.balance.liquid)}. Disponibilní (po odečtení peněz odložených na cíle) ${fmt(s.planner.available)}.`,
      lines: d.accounts.map((a) => `${a.name}: ${fmt(s.balance.byAccount[a.id] ?? 0)}`),
      tone: "neutral",
    };
  }

  return {
    text: "Této otázce zatím nerozumím. Umím odpovědět na otázky typu:",
    lines: [
      "Můžeme si dovolit koupit sedačku za 15 000 Kč?",
      "Kolik můžeme utratit tento týden?",
      "Kolik nám zbývá na jídlo?",
      "Kolik nám zbude na konci měsíce?",
      "Máme nějaké faktury po splatnosti?",
      "Kolik musíme odkládat na cíle?",
      "Kolik jsem tento měsíc vydělal?",
      "Jaké platby nás čekají?",
      "Kolik jsme za poslední 3 měsíce utratili v restauracích?",
      "Co když koupíme sedačku za 15 000 Kč na 10 splátek?",
      "Jak jsme na tom za poslední 3 měsíce?",
      "Jaký je výhled na příští 3 měsíce dopředu?",
      "Je v našich výdajích něco neobvyklého?",
      "Kde můžeme ušetřit?",
      "250 Albert (zapíše výdaj)",
    ],
    tone: "neutral",
    context: { intent: "unknown" },
  };
}


// ---------------------------------------------------------------------------
// Rozšířené dotazy: kategorie a obchody, co kdyby, výhled, neobvyklé věci, tipy,
// práce, zadání výdaje, týdenní souhrn, navazující otázky.

const czk = (c: Cents) => fm(c, { decimals: "never" });
/** Práce – ne „pračka“: celé tvary slova práce, výdělek, směny, výplaty… */
const WORK_RE = /(\bprac(e|i|uji|ovat|oval)\b|vydel|smen|rohlik|vyplat|hodinov)/;

/** „250 Albert“, „tankování 1 400 kartou“, „zapiš výdaj 89 kafe“ → návrh výdaje. */
export function parseExpenseDraft(question: string, d: FinanceData, today: string): ExpenseDraft | null {
  const q = question.trim();
  const qn = norm(q);
  const explicit = /^(zapis|pridej|pridat|zaznamenej|vydaj|utratil[a]?|zaplatil[a]?)\b/.test(qn);
  const shortForm = /^\d[\d\s,.]*\s*(kc)?\s+\p{L}/u.test(qn) || /^\p{L}[\p{L}\s]{1,30}\s\d[\d\s,.]*\s*(kc)?(\s+(kartou|hotove|hotovosti|prevodem))?$/u.test(qn);
  if (!explicit && !shortForm) return null;
  if (/\?$/.test(q) || /(dovolit|kolik|muzeme|co kdyz|kdyby)/.test(qn)) return null;
  const amount = extractAmount(q);
  if (amount == null || amount <= 0) return null;
  const paymentMethod = /hotov/.test(qn) ? "cash" : /prevod/.test(qn) ? "transfer" : /kart/.test(qn) ? "card" : "card";
  const description = q
    .replace(/\d[\d\s\u00a0]*(?:[,.]\d+)?\s*(tis\.?|k\b)?\s*(kč|kc|korun|czk)?/gi, " ")
    .replace(/\b(zapiš|zapis|přidej|pridej|přidat|zaznamenej|výdaj|vydaj|kartou|hotově|hotove|hotovostí|převodem|prevodem|za)\b/gi, " ")
    .replace(/\s+/g, " ").trim().slice(0, 120) || "Výdaj";
  const catName = guessCategoryName(description);
  const categoryId = catName ? d.categories.find((c) => c.kind === "expense" && c.name === catName)?.id ?? null : null;
  return { amount, description: description.charAt(0).toUpperCase() + description.slice(1), categoryId, paymentMethod, date: today };
}

function categoryAnswer(question: string, s: Snapshot, d: FinanceData, ctx: Partial<AssistantContext>): AssistantAnswer | null {
  const category = findCategory(question, d, ctx.category);
  const merchant = category ? null : findMerchant(question, d, ctx.merchant);
  if (!category && !merchant) return null;
  const period = parsePeriod(question, s.today, ctx.months);
  const filter = category ? (t: { category_id: string | null }) => t.category_id === category.id : (t: { description: string; note: string | null }) => norm(`${t.description} ${t.note ?? ""}`).includes(merchant!);
  const r = spendIn(d, period, filter as never);
  const label = category ? `v kategorii „${category.name}“` : `u „${merchant}“`;
  const lines: string[] = [];
  if (period.months >= 2) lines.push(`Průměrně ${czk(divRound(r.total, Math.max(1, Math.round(period.months))))} měsíčně`);
  if (r.count) lines.push(`${r.count} ${r.count === 1 ? "platba" : r.count < 5 ? "platby" : "plateb"}, průměrně ${czk(divRound(r.total, r.count))} za nákup`);
  const top = [...r.list].sort((a, b) => b.amount - a.amount).slice(0, 3);
  for (const t of top) lines.push(`${formatDate(t.date)} – ${t.description || "bez popisu"}: ${czk(t.amount)}`);
  if (category) {
    const b = s.categoryBudgets.find((x) => x.budget.category_id === category.id);
    if (b && period.label === "tento měsíc") lines.push(`Limit ${czk(b.budget.amount)}, zbývá ${czk(b.remaining)}`);
  }
  return {
    text: r.count ? `${period.label.charAt(0).toUpperCase() + period.label.slice(1)} jste ${label} utratili ${czk(r.total)}.` : `${period.label.charAt(0).toUpperCase() + period.label.slice(1)} jste ${label} nic neutratili.`,
    lines, tone: "neutral",
    context: { intent: "category_spend", category: category?.name ?? null, merchant, months: period.months >= 1 ? Math.round(period.months) : null },
  };
}

function whatIfAnswer(question: string, s: Snapshot, d: FinanceData, ctx: Partial<AssistantContext>): AssistantAnswer {
  const qn = norm(question);
  const amount = ctx.amount ?? extractAmount(question);
  const inst = ctx.installments ?? Number(/(\d{1,3})\s*(splat|mesicnich splat|x)/.exec(qn)?.[1] ?? 0);
  let kind: ScenarioKind = (ctx.scenario as ScenarioKind) ?? "purchase";
  if (!ctx.scenario) {
    if (/splat/.test(qn)) kind = "installments";
    else if (/najem/.test(qn)) kind = "rent_change";
    else if (/jidl|potravin/.test(qn)) kind = "food_change";
    else if (/prijem|vyplat|plat |mzd|vydelav/.test(qn)) kind = "income_change";
  }
  if (amount == null) return { text: "O jakou částku jde? Napište např. „Co když zdraží nájem o 1 500 Kč?“", tone: "neutral", needs: { message: "Chybí částka." }, context: { intent: "what_if", scenario: kind } };
  let signed = amount;
  if ((kind === "food_change" && /usetr|min|snizi|mene/.test(qn)) || (kind === "rent_change" && /zlevn|nizsi|mene/.test(qn)) || (kind === "income_change" && /nizsi|mene|klesne|prijdu/.test(qn))) signed = -amount;
  const r = whatIf(s, d, kind, signed, inst || 10);
  const goalLines = r.goals.map((g) => `${g.name}: ${g.before ? monthName(g.before) : "termín nelze odhadnout"} → ${g.after ? monthName(g.after) : "termín nelze odhadnout"}`);
  return {
    text: r.title,
    lines: [...r.lines, ...goalLines],
    tone: r.monthlyAfter != null && r.monthlyAfter < 0 ? "danger" : r.safeAfter < r.safeBefore ? "warning" : "positive",
    context: { intent: "what_if", amount, scenario: kind, installments: inst || null },
  };
}

function lookbackAnswer(s: Snapshot, d: FinanceData): AssistantAnswer {
  const r = lookback(s, d, 3);
  if (!r.average) return { text: "Za poslední 3 měsíce zatím nemám žádná data – evidence začala teprve tento měsíc.", tone: "neutral", context: { intent: "lookback" } };
  const best = [...r.months].filter((m) => m.hasData).sort((a, b) => b.net - a.net)[0];
  const worst = [...r.months].filter((m) => m.hasData).sort((a, b) => a.net - b.net)[0];
  return {
    text: `Za poslední 3 měsíce jste průměrně měsíčně získali ${czk(r.average.income)} a utratili ${czk(r.average.fixed + r.average.variable)} – bilance ${r.average.net >= 0 ? "+" : "−"}${czk(Math.abs(r.average.net))} měsíčně.`,
    table: {
      head: ["Měsíc", "Příjmy", "Pevné platby", "Běžné výdaje", "Odloženo", "Bilance", "Zůstatek"],
      rows: r.months.map((m) => m.hasData ? [m.label, czk(m.income), czk(m.fixed), czk(m.variable), czk(m.saved), czk(m.net), m.endBalance != null ? czk(m.endBalance) : "—"] : [m.label, "—", "—", "—", "—", "—", "—"]),
    },
    lines: best && worst && best !== worst ? [`Nejlépe: ${best.label} (${czk(best.net)}), nejhůř: ${worst.label} (${czk(worst.net)}).`] : undefined,
    tone: r.average.net >= 0 ? "positive" : "warning",
    context: { intent: "lookback" },
  };
}

function forecastAnswer(s: Snapshot, d: FinanceData): AssistantAnswer {
  if (!d.accounts.length) return { text: "Pro výhled potřebuji znát účty a zůstatky.", tone: "neutral", needs: { message: "Doplňte účty.", href: "/nastaveni#ucty" } };
  const f = forecast(s, d, 3);
  const t = f.tightest;
  const tight = t && t.endBalance < 0
    ? `Nejtěsněji bude v měsíci ${t.label}: chybět bude asi ${czk(-t.endBalance)}. Začněte si odkládat už teď.`
    : t ? `Nejtěsněji bude v měsíci ${t.label}, ale i tak by vám mělo zbýt asi ${czk(t.endBalance)}.` : "";
  return {
    text: `Výhled na 3 měsíce (s očekávanými příjmy). ${tight}`,
    table: {
      head: ["Měsíc", "Příjmy", "Pevné platby", "Běžné výdaje", "Spoření", "Na konci"],
      rows: f.months.map((m) => [m.label, czk(m.income), czk(m.fixed), czk(m.variable), czk(m.savings), czk(m.endBalance)]),
    },
    lines: [
      `Výchozí stav: odhad konce tohoto měsíce ${czk(s.projectedEndOfMonth)}; ${f.basis}.`,
      f.months.some((m) => m.endBalanceWithoutIncome < 0) ? "Bez očekávaných příjmů by se rozpočet dostal do mínusu – výplaty jsou pro vás klíčové." : "I bez očekávaných příjmů by peníze vystačily.",
      "Výhled je odhad – čtvrtletní a roční platby jsou započtené podle splatností.",
    ],
    tone: t && t.endBalance < 0 ? "danger" : "neutral",
    context: { intent: "forecast" },
  };
}

function anomaliesAnswer(s: Snapshot, d: FinanceData): AssistantAnswer {
  const a = anomalies(s, d);
  return {
    text: a.length ? `Našel jsem ${a.length} ${a.length === 1 ? "věc, která stojí" : "věci, které stojí"} za kontrolu:` : "Nic neobvyklého jsem v posledních výdajích nenašel.",
    lines: a.map((x) => x.title + (x.detail ? ` – ${x.detail}` : "")),
    tone: a.some((x) => x.tone === "danger") ? "danger" : a.length ? "warning" : "positive",
    context: { intent: "anomalies" },
  };
}

function tipsAnswer(s: Snapshot, d: FinanceData): AssistantAnswer {
  const t = savingsTips(s, d);
  const total = t.reduce((a, x) => a + x.saving, 0);
  return {
    text: t.length ? `Kde můžete ušetřit – dohromady až ${czk(total)} měsíčně:` : "Zatím nevidím výrazné rezervy – výdaje jsou v kategoriích blízko vašemu průměru.",
    lines: t.map((x) => x.title),
    tone: t.length ? "neutral" : "positive",
    context: { intent: "savings_tips" },
  };
}

function detectIntent(q: string): string | null {
  if (/(co kdyz|co kdyby|kdyby|kdybychom|na splatky|splatk)/.test(q)) return "what_if";
  if (/(dopredu|pristi (mesic|mesice)|nasledujici|nejtesnej|predpoved)/.test(q)) return "forecast";
  if (/(zpet|zpetne|dozadu|poslednich (3|tri) mesic|poslednich mesic|za posledni (3|tri) mesice|vyhled|jak jsme na tom)/.test(q) && !/(utratil|dali|stalo)/.test(q)) return "lookback";
  if (/(neobvykl|divn|podezrel|duplic|dvakrat|zapomenut|predplatn)/.test(q)) return "anomalies";
  if (/(usetrit|uspor|tip|kde.*setrit|jak.*setrit)/.test(q)) return "savings_tips";
  if (/(souhrn|shrnuti|v kostce|prehled tydne)/.test(q)) return "weekly_summary";
  if (/(kolik|utratil|utratili|stalo|dali|platili).*(za|v|u|na)\s/.test(q) && !/(dovolit|jidlo|potravin)/.test(q)) return "category_spend";
  return null;
}

/**
 * Hlavní odpověď asistenta. `prev` = kontext minulé odpovědi pro navazující
 * otázky („A za 20 000?“, „A minulý měsíc?“).
 */
export function answer(question: string, s: Snapshot, d: FinanceData, prev?: AssistantContext | null, forced?: Partial<AssistantContext> | null): AssistantAnswer {
  const q = norm(question.trim());
  const draft = forced?.intent === "add_expense" || !forced ? parseExpenseDraft(question, d, s.today) : null;
  if (draft) {
    return {
      text: `Mám zapsat výdaj ${czk(draft.amount)} – „${draft.description}“? Zkontrolujte a potvrďte.`,
      tone: "neutral", draft, context: { intent: "add_expense" },
    };
  }
  // navazující otázka: krátká, začíná „a …“, nebo jen částka/období
  const followUp = prev && prev.intent !== "unknown" && (/^(a|a co|a kdyz|a za|a pri|a minul|a letos|a za posledni)\b/.test(q) || q.split(" ").length <= 4);
  // obecné otázky („Co je RPSN?“, „Jak přidám výdaj?“) – znalostní báze má přednost před výpočty
  if (!forced && /^(co je|co jsou|co znamena|jak |kde |proc |muzu|mohu|lze|da se|je lepsi|vyplati se|mam narok|existuje|ahoj|dobry|diky|dekuji|kolik stoji|kolik bych|kolik bilkovin)/.test(q)) {
    const kb = searchKb(question);
    if (kb) return kbAnswer(kb);
  }
  let intent = forced?.intent ?? detectIntent(q);
  const ctx: Partial<AssistantContext> = { ...(forced ?? {}) };
  if (!intent && followUp && prev) {
    intent = prev.intent;
    const amt = extractAmount(question);
    Object.assign(ctx, { category: prev.category, merchant: prev.merchant, scenario: prev.scenario, installments: prev.installments, months: prev.months });
    if (amt != null) ctx.amount = amt;
    if (/minul|poslednich|letos|tyden|mesic/.test(q)) ctx.months = null; // období vezmeme z nové otázky
    if (intent === "afford" && amt != null) return baseAnswer(`Můžeme si dovolit koupit za ${amt / 100} Kč?`, s, d);
    if (["food", "week", "end_of_month", "invoices", "goals", "work", "payments", "balance", "compare"].includes(intent)) intent = null;
  }
  switch (intent) {
    case "what_if": return whatIfAnswer(question, s, d, ctx);
    case "forecast": return forecastAnswer(s, d);
    case "lookback": return lookbackAnswer(s, d);
    case "anomalies": return anomaliesAnswer(s, d);
    case "savings_tips": return tipsAnswer(s, d);
    case "weekly_summary": {
      const w = weeklySummary(s, d);
      return { text: w.title, lines: w.lines, tone: "neutral", context: { intent: "weekly_summary" } };
    }
    case "category_spend":
    case "merchant_spend": {
      const r = categoryAnswer(question, s, d, ctx);
      if (r) return r;
      break;
    }
  }
  const base = baseAnswer(question, s, d);
  if (/(dovolit|koupit|koupime)/.test(q)) return { ...base, context: { intent: "afford", amount: extractAmount(question) } };
  // práce: doplnit postřehy
  if (WORK_RE.test(q) && !base.needs) {
    const extra = workInsights(d, s.today);
    return { ...base, lines: [...(base.lines ?? []), ...extra], context: { intent: "work" } };
  }
  // ještě zkusíme kategorii/obchod u obecných dotazů „kolik … “
  if (base.context?.intent === "unknown" && /kolik/.test(q)) {
    const r = categoryAnswer(question, s, d, ctx);
    if (r) return r;
  }
  if (base.context?.intent === "unknown") {
    const kb = searchKb(question);
    if (kb) return kbAnswer(kb);
  }
  return base;
}

function kbAnswer(kb: KbEntry): AssistantAnswer {
  return { text: kb.a, tone: "neutral", needs: kb.href ? { message: kb.label ?? "Otevřít v aplikaci", href: kb.href } : undefined, context: { intent: "unknown" } };
}
