import { abs, divFloor, formatMoney as fm, parseMoney, sub, type Cents } from "@/lib/money";
import { diffDays, endOfMonth, endOfWeek, formatDate, minDate, monthName } from "@/lib/dates";
import type { FinanceData, Snapshot } from "@/lib/finance/snapshot";
import { checkAffordability } from "@/lib/finance/affordability";

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

export interface AssistantAnswer {
  text: string;
  lines?: string[];
  tone: InsightTone;
  /** Asistent potřebuje doplnit údaj. */
  needs?: { message: string; href?: string };
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

export function answer(question: string, s: Snapshot, d: FinanceData): AssistantAnswer {
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
    return { text: `Teď ne. Chybí vám ${fmt(r.shortfall)} – tolik je potřeba ušetřit.${when}${withIncome}`, lines, tone: "warning" };
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
  if (/(prac|vydel|smen|rohlik|vyplat|hodin)/.test(q)) {
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
    ],
    tone: "neutral",
  };
}

