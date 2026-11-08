import Link from "next/link";
import { AlertTriangle, CalendarClock, CircleCheck, Plane } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { REMINDER_KIND, dueReminders } from "@/lib/finance/networth";
import { badges } from "@/lib/finance/badges";
import { resolveBudget } from "@/lib/finance/budgets";
import { addDays, diffDays, formatDate, monthName } from "@/lib/dates";
import { formatMoney, percent, sub } from "@/lib/money";
import { balanceSeries } from "@/lib/finance/balances";
import { monthlySeries } from "@/lib/finance/period";
import { buildInsights } from "@/lib/assistant";
import { Card } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { PillBars, Progress } from "@/components/ui/Progress";
import { LinkButton } from "@/components/ui/Button";
import { BalanceChart, CategoryDonut, IncomeExpenseChart } from "@/components/charts/Charts";
import { CardLink, InsightItem, KV, Stat } from "@/components/dashboard/bits";
import { PayOccurrenceButton } from "@/components/forms/PaymentForms";
import { effectiveExpenses, summarizeTrip } from "@/lib/finance/travel";
import { OngoingTripBanner, TravelCard } from "@/components/dashboard/TravelCard";
import { SimpleDashboard } from "@/components/dashboard/SimpleDashboard";
import { DashboardMode } from "@/components/dashboard/DashboardMode";
import { DASH_COOKIE } from "@/lib/dashboard-mode";
import { cookies } from "next/headers";
import { getPremium } from "@/lib/premium";
import { getPrefs } from "@/lib/prefs";
import { getT } from "@/lib/i18n/server";
import { daysWord } from "@/lib/i18n/dict";
import { ProfileTips } from "@/components/dashboard/ProfileTips";
import { monthlyClosing } from "@/lib/finance/closing";
import { addMonths as addM, startOfMonth as som } from "@/lib/dates";

export const metadata = { title: "Přehled" };

export default async function DashboardPage() {
  const ctx = await requireContext();
  const { data, snapshot: s, today } = await loadSnapshot(ctx);
  const travel = data.travel;
  const trips = travel.trips.map((trip) => {
    const legs = travel.legs.filter((l) => l.trip_id === trip.id);
    return { trip, legs, s: summarizeTrip(trip, legs, effectiveExpenses(travel.expenses.filter((e) => e.trip_id === trip.id), data.transactions), today, travel.cash.filter((c) => c.trip_id === trip.id)) };
  });
  const [premium, prefs] = await Promise.all([getPremium(ctx), getPrefs(ctx.store, ctx.user)]);
  const ongoing = premium.household ? trips.find((t) => t.s.status === "ongoing") : undefined;
  const catName = (id: string | null) => data.categories.find((c) => c.id === id)?.name ?? "Bez kategorie";
  const firstOpening = data.accounts.reduce((m, a) => (a.opening_date < m ? a.opening_date : m), today);
  const seriesFrom = firstOpening > addDays(today, -89) ? firstOpening : addDays(today, -89);
  const series = balanceSeries(data.accounts, data.transactions, seriesFrom, today);
  const months = monthlySeries(data.transactions, today, 6);
  const insights = buildInsights(s, data).filter((i) => !i.id.startsWith("missing"));
  const greetingName = data.members.find((m) => m.user_id === ctx.user.id)?.name.replace(/\s*\(demo\)/, "");
  const hour = Number(new Intl.DateTimeFormat("cs-CZ", { hour: "numeric", timeZone: "Europe/Prague" }).format(new Date()));
  const { t, locale } = await getT();
  const greeting = hour < 10 ? t("dash.morning") : hour < 18 ? t("dash.day") : t("dash.evening");
  const householdCats = s.household.byCategory.slice(0, 6);
  const icoActive = Boolean(data.settings?.billing_ico && data.settings.ico_activated_at);
  const spentPct = s.month.income > 0 ? Math.round(percent(s.month.expense, s.month.income)) : null;
  const lastStart = addM(som(today), -1);
  const lastBudget = resolveBudget(data.budgets, "total", lastStart);
  const debtRows = await ctx.store.select("debts", { household_id: ctx.household.id });
  const ach = badges({
    txs: data.transactions, goals: data.goals, contributions: data.contributions, trips: data.travel.trips, today, lastMonth: s.lastMonth,
    monthlyExpenses: s.lastMonth.expense || s.month.expense, liquid: s.balance.liquid,
    debtsLeft: debtRows.length ? debtRows.reduce((a, d) => a + d.balance, 0) : null,
    budgetKept: lastBudget ? s.lastMonth.expense <= lastBudget.amount : null,
  });
  const mode = (await cookies()).get(DASH_COOKIE)?.value === "detailed" ? "detailed" : "simple";
  const greetingBlock = (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="text-sm text-ink-3">{monthName(today)} · {t("dash.daysLeft", { n: daysWord(locale, s.daysLeftInMonth) })}</p>
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}{greetingName ? `, ${greetingName}` : ""}</h1>
      </div>
      <DashboardMode mode={mode} />
    </div>
  );
  const missingBlock = s.missing.length > 0 && (
    <Card variant="light">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <AlertTriangle className="h-5 w-5 shrink-0 text-gold-bright" />
        <div className="flex-1 text-sm">
          <b>Aby čísla seděla, doplňte prosím:</b>{" "}
          {s.missing.map((m, i) => <span key={m.code}>{i > 0 && " · "}<Link href={m.href} className="underline underline-offset-2">{m.message}</Link></span>)}
        </div>
      </div>
    </Card>
  );
  const closing = Number(today.slice(8)) <= 7 ? monthlyClosing(data, addM(som(today), -1)) : null;
  const dueSoon = dueReminders(await ctx.store.select("reminders", { household_id: ctx.household.id }), today).slice(0, 4);
  const remindersBlock = dueSoon.length > 0 && (
    <Card className="!p-4" data-testid="due-reminders">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-semibold">⏰ Blíží se:</span>
        {dueSoon.map((r) => <Link key={r.id} href="/majetek#terminy" className="underline-offset-2 hover:underline">{REMINDER_KIND[r.kind].emoji} {r.title} <span className={r.daysLeft < 0 ? "text-neg" : "text-ink-3"}>{r.daysLeft < 0 ? `(${-r.daysLeft} d po termínu)` : r.daysLeft === 0 ? "(dnes)" : `(za ${r.daysLeft} d)`}</span></Link>)}
      </div>
    </Card>
  );
  const closingBlock = closing && closing.txCount > 0 && (
    <Card className="!p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1 text-sm">
          <p className="text-[11px] uppercase tracking-wider text-ink-3">Uzávěrka – {closing.label}</p>
          {premium.household ? <p className={closing.verdict.tone === "positive" ? "text-pos" : closing.verdict.tone === "warning" ? "text-warn" : ""}>{closing.verdict.text} {closing.highlights[0] ?? ""}</p> : <p className="text-ink-2">Podívejte se, jak jste minulý měsíc dopadli – měsíční uzávěrka je součástí Premium.</p>}
        </div>
        <Link href={premium.household ? "/uzaverka" : "/premium"} className="rounded-full bg-gold/90 px-3 py-1.5 text-xs font-medium text-[#1b1407]">{premium.household ? "Celá uzávěrka" : "Premium"}</Link>
      </div>
    </Card>
  );
  if (mode === "simple") {
    return (
      <div className="space-y-4">
        {greetingBlock}
        {ongoing && <OngoingTripBanner item={ongoing} today={today} />}
        {missingBlock}
        {closingBlock}
      {remindersBlock}
        {remindersBlock}
        <ProfileTips profile={prefs.profile} premium={premium.household} />
        <SimpleDashboard locale={locale} s={s} today={today} insights={insights} categories={s.month.byCategory.map((c) => ({ name: catName(c.categoryId), amount: c.amount }))}
          extra={premium.household && trips.some((t) => t.s.status === "upcoming" || t.s.status === "ongoing") ? <TravelCard items={trips} today={today} /> : null} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* hlavička jako na referenčním dashboardu */}
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-2">
          <div>
            <p className="text-sm text-ink-3">{monthName(today)} · {t("dash.daysLeft", { n: daysWord(locale, s.daysLeftInMonth) })}</p>
            <h1 className="font-[family-name:var(--font-display)] text-3xl font-semibold tracking-tight sm:text-4xl">{greeting}{greetingName ? `, ${greetingName}` : ""}</h1>
          </div>
          <DashboardMode mode={mode} />
        </div>
        <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
          <Stat big label={t("d.25")} value={s.planner.available} info="Peníze na běžných účtech a v hotovosti mínus částky odložené na cíle. Očekávané příjmy nejsou započteny." />
          <Stat big label={t("d.19")} value={s.planner.safeToSpend} tone="gold" info="Po odečtení závazků do konce měsíce (vč. plateb za cesty), zbytku rozpočtů, rezervy, rezervy na cesty a plánu spoření." />
        </div>
      </div>

      {closingBlock}
      {ongoing && <OngoingTripBanner item={ongoing} today={today} />}

      {s.missing.length > 0 && (
        <Card variant="light">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <AlertTriangle className="h-5 w-5 shrink-0 text-gold-bright" />
            <div className="flex-1 text-sm">
              <b>Pro přesné výpočty doplňte:</b>{" "}
              {s.missing.map((m, i) => <span key={m.code}>{i > 0 && " · "}<Link href={m.href} className="underline underline-offset-2">{m.message}</Link></span>)}
            </div>
          </div>
        </Card>
      )}

      {/* horní ukazatele */}
      <Card className="!p-4">
        <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-3 xl:grid-cols-6">
          <Stat label={t("d.24")} value={s.planner.available} hint={`celkem vč. spoření ${formatMoney(s.balance.total, { decimals: "never" })}`} />
          <Stat label={t("d.21")} value={s.month.income} hint={s.expectedIncomeTotal > 0 ? `+ očekáváno ${formatMoney(s.expectedIncomeTotal, { decimals: "never" })}` : "přijato"} tone="pos" />
          <Stat label={t("d.17")} value={s.month.expense} hint={spentPct != null ? `${spentPct} % příjmů` : undefined} />
          <Stat label={t("d.22")} value={s.goals.totalSaved} hint={`tento měsíc ${formatMoney(s.goals.contributedThisMonth, { decimals: "never" })}`} />
          <Stat label={t("d.16")} value={s.planner.afterObligations} hint={`po závazcích ${formatMoney(s.unpaidObligationsTotal, { decimals: "never" })}`} tone={s.planner.afterObligations < 0 ? "neg" : undefined} info="Disponibilní peníze po zaplacení všech nezaplacených závazků do konce měsíce." />
          <Stat label={t("d.20")} value={s.planner.safeToSpend} hint={s.planner.needToEarn > 0 ? `chybí ${formatMoney(s.planner.needToEarn, { decimals: "never" })}` : "bezpečně k utracení"} tone={s.planner.needToEarn > 0 ? "neg" : "gold"} />
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {/* 1. Stav financí */}
        <Card title={t("d.2")} subtitle={t("d.14")} action={<CardLink href="/transakce" />} className="md:col-span-2">
          {series.length > 1 ? <BalanceChart data={series} /> : <p className="py-6 text-center text-sm text-ink-3">Graf se bude plnit každým dnem evidence (od {formatDate(seriesFrom)}).</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {data.accounts.filter((a) => a.is_active).map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-xl bg-white/[0.04] px-3 py-2 text-sm">
                <span className="truncate text-ink-2">{a.name}{!a.include_in_available && <span className="ml-1 text-[10px] text-ink-3">(spoření)</span>}</span>
                <Money value={s.balance.byAccount[a.id] ?? 0} decimals="never" />
              </div>
            ))}
          </div>
        </Card>

        {/* 5. Rozpočet na jídlo */}
        <Card title={t("d.4")} variant="light" action={<CardLink href="/rozpocty" />}>
          {s.food ? (
            <>
              <div className="flex items-baseline justify-between">
                <span className="num text-3xl font-semibold">{formatMoney(s.food.dailyLimit, { decimals: "never" })}</span>
                <span className="text-xs text-ink-2">na den</span>
              </div>
              <Progress className="mt-3" value={s.food.usedPercent} marker={percent(s.food.expectedByNow, s.food.budget)} tone={s.food.status === "over" ? "neg" : s.food.status === "warning" ? "warn" : "gold"} label={t("d.18")} />
              <div className="mt-3 space-y-0.5">
                <KV k="Utraceno" v={<><Money value={s.food.spent} decimals="never" /> <span className="text-ink-3">/ {formatMoney(s.food.budget, { decimals: "never" })}</span></>} />
                <KV k="Zbývá" v={<Money value={s.food.remaining} colored decimals="never" />} />
                <KV k="Tento týden ještě" v={<Money value={s.food.weekLimit} decimals="never" />} />
                <KV k="Průměr / plán za den" v={`${formatMoney(s.food.avgDaily, { decimals: "never" })} / ${formatMoney(s.food.plannedDaily, { decimals: "never" })}`} />
              </div>
              {s.food.alerts.slice(0, 2).map((a) => <p key={a.code} className={`mt-2 text-xs ${a.level === "danger" ? "text-neg" : "text-warn"}`}>• {a.message}</p>)}
            </>
          ) : (
            <p className="text-sm text-ink-2">Nastavte měsíční rozpočet a aplikace ho rozpočítá na týdny a dny. <Link href="/rozpocty" className="text-gold underline">Nastavit</Link></p>
          )}
        </Card>

        {/* 9. Nadcházející platby */}
        <Card title={t("d.8")} variant="dark" subtitle={`Do konce měsíce ${formatMoney(s.unpaidObligationsTotal, { decimals: "never" })}`} action={<span className="num text-sm text-gold">{formatMoney(s.upcoming.slice(0, 7).reduce((a, o) => a + o.amount, 0), { decimals: "never" })}</span>} className="xl:row-span-2">
          {s.upcoming.length ? (
            <ul className="space-y-2">
              {s.upcoming.slice(0, 7).map((o) => {
                const days = diffDays(today, o.date);
                return (
                  <li key={o.key} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-3 py-2.5">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${o.state === "overdue" ? "bg-neg/20 text-neg" : days <= 3 ? "bg-warn/20 text-warn" : "bg-white/[0.07] text-ink-2"}`}>
                      {o.kind === "trip" ? <Plane className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      {o.kind === "trip" ? <Link href={`/cestovani/${o.refId}`} className="block truncate text-sm hover:text-gold">{o.name}</Link> : <p className="truncate text-sm">{o.name}</p>}
                      <p className="text-[11px] text-ink-3">{formatDate(o.date, "day")} · {o.state === "overdue" ? "po splatnosti" : days === 0 ? "dnes" : `za ${days} d.`}</p>
                    </div>
                    <Money value={o.amount} className="text-sm" decimals="never" />
                  </li>
                );
              })}
            </ul>
          ) : <p className="flex items-center gap-2 text-sm text-ink-2"><CircleCheck className="h-4 w-4 text-pos" /> Vše zaplaceno.</p>}
          {s.upcoming[0]?.kind === "recurring" && (
            <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs text-ink-3">
              <span className="truncate">Nejbližší: {s.upcoming[0].name}</span>
              <PayOccurrenceButton kind="recurring" refId={s.upcoming[0].refId} name={s.upcoming[0].name} occurrenceDate={s.upcoming[0].date} amount={s.upcoming[0].amount} accountId={data.recurring.find((r) => r.id === s.upcoming[0].refId)?.account_id ?? null} />
            </div>
          )}
          <LinkButton href="/platby" variant="ghost" size="sm" className="mt-2 w-full justify-center">Všechny platby</LinkButton>
        </Card>

        {/* 2. Příjmy vs výdaje */}
        <Card title={t("d.5")} subtitle={t("d.15")} action={<CardLink href="/transakce?zobrazeni=mesice" label={t("d.23")} />} className="md:col-span-2">
          <IncomeExpenseChart data={months} />
        </Card>

        {/* 3. Měsíční rozpočet */}
        <Card title={t("d.9")} action={<CardLink href="/rozpocty" />}>
          {s.totalBudget ? (
            <>
              <div className="num text-2xl font-semibold">{formatMoney(sub(s.totalBudget.amount, s.totalBudget.spent), { decimals: "never" })}</div>
              <p className="text-xs text-ink-3">zbývá z {formatMoney(s.totalBudget.amount, { decimals: "never" })}</p>
              <Progress className="mt-3" value={percent(s.totalBudget.spent, s.totalBudget.amount)} tone={s.totalBudget.spent > s.totalBudget.amount ? "neg" : "gold"} label={t("d.26")} />
            </>
          ) : <p className="text-sm text-ink-3">Celkový limit není nastaven.</p>}
          <div className="mt-3 space-y-2.5">
            {s.categoryBudgets.slice(0, 4).map((c) => (
              <div key={c.budget.id}>
                <div className="flex justify-between text-xs"><span className="text-ink-2">{c.category?.name}</span><span className="num">{formatMoney(c.spent, { decimals: "never" })} / {formatMoney(c.budget.amount, { decimals: "never" })}</span></div>
                <Progress className="mt-1 !h-1.5" value={c.percent} tone={c.over ? "neg" : c.percent > 85 ? "warn" : "gold"} label={c.category?.name} />
              </div>
            ))}
            {!s.categoryBudgets.length && !s.totalBudget && <LinkButton href="/rozpocty" size="sm">Nastavit limity</LinkButton>}
          </div>
        </Card>

        {/* 4. Domácí výdaje */}
        <Card title={t("d.12")} subtitle={`Tento měsíc ${formatMoney(s.household.spent, { decimals: "never" })}`} action={<CardLink href="/domacnost" />}>
          {householdCats.length ? (
            <PillBars values={householdCats.map((c) => ({ label: catName(c.categoryId).slice(0, 5), value: c.amount }))} highlight={0} />
          ) : <p className="text-sm text-ink-3">Zatím žádné domácí výdaje.</p>}
          <ul className="mt-2 space-y-0.5">
            {householdCats.slice(0, 3).map((c) => <KV key={c.categoryId} k={catName(c.categoryId)} v={<Money value={c.amount} decimals="never" />} />)}
          </ul>
        </Card>

        {/* 7. Pracovní příjmy */}
        <Card title={t("d.6")} subtitle={data.workSettings?.company ?? "Práce"} action={<CardLink href="/prace" />}>
          {!icoActive ? <p className="text-sm text-ink-3">Pro podnikání na IČO. <Link href="/nastaveni#ico" className="text-gold underline">Aktivovat IČO</Link></p> : <>
          <div className="num text-2xl font-semibold">{formatMoney(s.work.month.net, { decimals: "never" })}</div>
          <p className="text-xs text-ink-3">čistý výsledek tento měsíc · {s.work.month.days} dní</p>
          <div className="mt-3 space-y-0.5">
            <KV k="Průměr / den" v={<Money value={s.work.month.avgPerDay} decimals="never" />} />
            <KV k="Průměr / hodinu" v={<Money value={s.work.month.avgPerHour} decimals="never" />} />
            <KV k="Minulý měsíc" v={<Money value={s.work.lastMonth.net} decimals="never" />} />
            <KV k="Očekávané výplaty" v={<Money value={s.work.expectedPayoutTotal} decimals="never" />} />
          </div>
          </>}
        </Card>

        {/* 8. Neuhrazené faktury */}
        <Card title={t("d.7")} action={<CardLink href="/faktury" />}>
          {!icoActive ? <p className="text-sm text-ink-3">Pro podnikání na IČO. <Link href="/nastaveni#ico" className="text-gold underline">Aktivovat IČO</Link></p> : <>
          <div className="grid grid-cols-2 gap-3">
            <div><p className="text-[11px] uppercase tracking-wider text-ink-3">Dostanu</p><Money value={s.invoices.unpaidIssuedTotal} decimals="never" className="text-lg font-semibold" /><p className="text-xs text-ink-3">{s.invoices.unpaidIssued.length} faktur</p></div>
            <div><p className="text-[11px] uppercase tracking-wider text-ink-3">Zaplatím</p><Money value={s.invoices.unpaidReceivedTotal} decimals="never" className="text-lg font-semibold" /><p className="text-xs text-ink-3">{s.invoices.unpaidReceived.length} faktur</p></div>
          </div>
          {s.invoices.overdue.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {s.invoices.overdue.slice(0, 3).map((i) => (
                <li key={i.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="truncate">{i.number}</span>
                  <Badge tone="danger">po splatnosti {diffDays(i.due_date!, today)} d.</Badge>
                </li>
              ))}
            </ul>
          )}
          </>}
        </Card>

        {/* 6. Spoření */}
        <Card title={t("d.3")} action={<CardLink href="/sporeni" />}>
          <div className="num text-2xl font-semibold">{formatMoney(s.goals.totalSaved, { decimals: "never" })}</div>
          <p className="text-xs text-ink-3">naspořeno na cílech</p>
          <div className="mt-3 space-y-0.5">
            <KV k="Plán tento měsíc" v={<Money value={s.goals.plannedThisMonth} decimals="never" />} />
            <KV k="Už odloženo" v={<Money value={s.goals.contributedThisMonth} decimals="never" />} />
            <KV k="Zbývá odložit" v={<Money value={s.goals.remainingThisMonth} decimals="never" />} />
            <KV k="Můžete odložit až" v={<Money value={s.planner.canSave} decimals="never" className="text-gold" />} />
          </div>
        </Card>

        {/* Motivace */}
        <Card title={t("d.0")} subtitle={ach.streak.current > 0 ? `🔥 ${ach.streak.current} ${ach.streak.current === 1 ? "den" : ach.streak.current < 5 ? "dny" : "dní"} v řadě${ach.streak.todayDone ? "" : " – dnes ještě nic nezapsáno"}` : "Zapisujte každý den a sbírejte odznaky"} data-testid="badges">
          <div className="flex flex-wrap gap-1.5">
            {ach.list.map((b) => <span key={b.key} title={`${b.title} – ${b.detail}${!b.earned && b.progress ? ` (${b.progress.value.toLocaleString("cs-CZ")}/${b.progress.target.toLocaleString("cs-CZ")})` : ""}`} className={`flex h-9 w-9 items-center justify-center rounded-xl text-lg ${b.earned ? "bg-gold/15 ring-1 ring-gold/40" : "bg-white/[0.04] opacity-35 grayscale"}`} aria-label={`${b.title}${b.earned ? " – získáno" : ""}`}>{b.emoji}</span>)}
          </div>
          <p className="mt-2 text-xs text-ink-3">{ach.list.filter((b) => b.earned).length} z {ach.list.length} odznaků{(() => { const next = ach.list.find((b) => !b.earned && b.progress); return next ? ` · další: ${next.title} (${next.progress!.value.toLocaleString("cs-CZ")}/${next.progress!.target.toLocaleString("cs-CZ")})` : ""; })()}</p>
        </Card>

        {/* Cestování */}
        {premium.household && <TravelCard items={trips} today={today} className="md:col-span-2" />}

        {/* Kategorie */}
        <Card title={t("d.1")} subtitle={monthName(today)} className="md:col-span-2">
          <CategoryDonut data={s.month.byCategory.map((c) => ({ name: catName(c.categoryId), amount: c.amount }))} />
        </Card>

        {/* Doporučení */}
        <Card title={t("d.11")} subtitle={t("d.13")} action={<CardLink href="/asistent" />} className="md:col-span-2">
          <div className="space-y-2">
            {insights.slice(0, 4).map((i) => <InsightItem key={i.id} i={i} />)}
            {!insights.length && <p className="text-sm text-ink-3">Zatím nemám dost dat pro doporučení.</p>}
          </div>
        </Card>
        {/* 10. Finanční cíle */}
        <Card title={t("d.10")} action={<CardLink href="/sporeni" />} className="md:col-span-2">
          {s.goals.progress.length ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {s.goals.progress.slice(0, 4).map((g) => (
                <div key={g.goal.id} className="rounded-2xl bg-white/[0.04] p-3">
                  <div className="flex items-baseline justify-between gap-2"><span className="truncate text-sm">{g.goal.name}</span><span className="num text-sm text-gold">{g.percent} %</span></div>
                  <Progress className="mt-2" value={g.percent} label={g.goal.name} />
                  <p className="mt-1.5 text-xs text-ink-3">{formatMoney(g.saved, { decimals: "never" })} z {formatMoney(g.goal.target_amount, { decimals: "never" })}{g.requiredMonthly != null && !g.achieved ? ` · ${formatMoney(g.requiredMonthly, { decimals: "never" })}/měs.` : ""}</p>
                </div>
              ))}
            </div>
          ) : <p className="text-sm text-ink-3">Zatím žádné cíle. <Link className="text-gold underline" href="/sporeni">Vytvořit cíl</Link></p>}
        </Card>

      </div>
    </div>
  );
}
