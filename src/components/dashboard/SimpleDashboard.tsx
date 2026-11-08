import Link from "next/link";
import { CalendarClock, ChevronRight, HelpCircle, Plane, ShoppingBasket, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import type { ReactNode } from "react";
import type { Snapshot } from "@/lib/finance/snapshot";
import type { Insight } from "@/lib/assistant";
import { diffDays, formatDate, monthName } from "@/lib/dates";
import { divFloor, formatMoney } from "@/lib/money";
import { Card } from "@/components/ui/Card";
import { Progress } from "@/components/ui/Progress";
import { CategoryDonut } from "@/components/charts/Charts";
import { InsightItem } from "./bits";
import { daysWord, translate, type Key, type Locale } from "@/lib/i18n/dict";

const kc = (c: number) => formatMoney(c, { decimals: "never" });

/** Krátké vysvětlení „Co to znamená?“ – rozbalovací, bez odborných pojmů. */
function Explain({ children, label }: { children: ReactNode; label: string }) {
  return (
    <details className="group mt-2 text-xs text-ink-3">
      <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-ink-2"><HelpCircle className="h-3.5 w-3.5" />{label}</summary>
      <p className="mt-1 leading-relaxed">{children}</p>
    </details>
  );
}

function Tile({ icon, label, value, note, tone, href, explain, what }: { icon: ReactNode; label: string; value: number; note?: ReactNode; tone?: "pos" | "neg" | "gold"; href?: string; explain: ReactNode; what: string }) {
  const body = (
    <Card className="h-full !p-4 transition hover:border-gold/30">
      <div className="flex items-center gap-2 text-sm text-ink-2"><span className="text-gold">{icon}</span>{label}{href && <ChevronRight className="ml-auto h-4 w-4 text-ink-3" />}</div>
      <p className={`num mt-1 text-2xl font-semibold ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "gold" ? "gold-text" : ""}`}>{kc(value)}</p>
      {note && <p className="mt-0.5 text-xs text-ink-3">{note}</p>}
      <Explain label={what}>{explain}</Explain>
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/**
 * Jednoduchý Přehled: jedna hlavní odpověď („kolik můžete ještě utratit“)
 * a pár srozumitelných čísel. Vše počítá stejný plánovač jako podrobný pohled.
 */
export function SimpleDashboard({ s, today, insights, categories, extra, locale = "cs" }: {
  s: Snapshot; today: string; insights: Insight[]; categories: { name: string; amount: number }[]; extra?: ReactNode; locale?: Locale;
}) {
  const t = (k: Key, v?: Record<string, string | number>) => translate(locale, k, v);
  const what = t("dash.whatMeans");
  const daysLeft = s.daysLeftInMonth;
  const perDay = divFloor(s.planner.safeToSpend, Math.max(1, daysLeft));
  const lastSame = s.lastMonthToDate.expense;
  const diff = s.month.expense - lastSame;
  const upcoming = s.upcoming.filter((o) => o.date <= s.monthEnd).slice(0, 4);
  return (
    <div className="space-y-4">
      {/* hlavní odpověď */}
      <Card variant="light" className="!p-5 sm:!p-6">
        <p className="text-sm text-ink-2">{t("dash.canSpend", { n: daysWord(locale, daysLeft) })}</p>
        <p className={`num mt-1 text-4xl font-semibold sm:text-5xl ${s.planner.safeToSpend > 0 ? "gold-text" : "text-neg"}`}>{kc(s.planner.safeToSpend)}</p>
        {s.planner.safeToSpend > 0 && <p className="mt-1 text-sm text-ink-2">{t("dash.perDay", { x: kc(perDay) })}</p>}
        {s.planner.needToEarn > 0 && <p className="mt-2 rounded-xl bg-neg/10 px-3 py-2 text-sm text-neg">{t("dash.missing", { x: kc(s.planner.needToEarn) })}</p>}
        <Explain label={what}>{t("dash.canSpendExplain")}</Explain>
        <p className="mt-3 text-xs text-ink-3"><Link href="/sporeni" className="text-gold underline">{t("dash.howCalc")}</Link></p>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile what={what} icon={<Wallet className="h-4 w-4" />} label={t("dash.onAccounts")} value={s.planner.available} href="/transakce"
          note={s.goals.totalSaved > 0 ? t("dash.savedOnGoals", { x: kc(s.goals.totalSaved) }) : t("dash.currentAndCash")}
          explain={t("dash.onAccountsExplain")} />
        <Tile what={what} icon={<TrendingDown className="h-4 w-4" />} label={t("dash.spent")} value={s.month.expense} href="/transakce"
          note={lastSame > 0 ? (diff > 0 ? t("dash.more", { x: kc(diff) }) : t("dash.less", { x: kc(-diff) })) : undefined}
          tone={lastSame > 0 && diff > 0 ? "neg" : undefined}
          explain={t("dash.spentExplain")} />
        <Tile what={what} icon={<TrendingUp className="h-4 w-4" />} label={t("dash.income")} value={s.month.income} tone="pos" href="/transakce"
          note={s.expectedIncomeTotal > 0 ? t("dash.stillExpected", { x: kc(s.expectedIncomeTotal) }) : t("dash.thisMonth")}
          explain={t("dash.incomeExplain")} />
        <Tile what={what} icon={<CalendarClock className="h-4 w-4" />} label={t("dash.toPay")} value={s.unpaidObligationsTotal} href="/platby"
          note={upcoming[0] ? t("dash.nearest", { x: `${upcoming[0].name} ${formatDate(upcoming[0].date, "day")}` }) : t("dash.nothingMore")}
          explain={t("dash.toPayExplain")} />
      </div>

      {extra}

      <div className="grid gap-4 lg:grid-cols-3">
        {s.food ? (
          <Card title={t("dash.food")} action={<Link href="/rozpocty" className="text-xs text-gold">{t("nav./rozpocty")}</Link>}>
            <div className="flex items-center gap-2 text-sm text-ink-2"><ShoppingBasket className="h-4 w-4 text-gold" />{t("dash.foodLeft")}</div>
            <p className={`num text-2xl font-semibold ${s.food.remaining < 0 ? "text-neg" : ""}`}>{kc(s.food.remaining)}</p>
            <Progress className="mt-2" value={s.food.usedPercent} tone={s.food.status === "over" ? "neg" : s.food.status === "warning" ? "warn" : "gold"} label="Rozpočet na jídlo" />
            <p className="mt-2 text-sm">{t("dash.foodDaily", { x: kc(s.food.dailyLimit), y: kc(s.food.weekLimit) })}</p>
            {s.food.alerts[0] && <p className={`mt-1 text-xs ${s.food.alerts[0].level === "danger" ? "text-neg" : "text-warn"}`}>{s.food.alerts[0].message}</p>}
          </Card>
        ) : (
          <Card title={t("dash.food")}><p className="text-sm text-ink-2">{t("dash.foodSet")} <Link href="/rozpocty" className="text-gold underline">{t("dash.set")}</Link></p></Card>
        )}
        <Card title={t("dash.upcoming")} action={<Link href="/platby" className="text-xs text-gold">{t("dash.all")}</Link>}>
          {s.upcoming.length ? (
            <ul className="space-y-2">
              {s.upcoming.slice(0, 5).map((o) => {
                const d = diffDays(today, o.date);
                return (
                  <li key={o.key} className="flex items-center gap-2 text-sm">
                    {o.kind === "trip" ? <Plane className="h-4 w-4 shrink-0 text-gold" /> : <CalendarClock className="h-4 w-4 shrink-0 text-ink-3" />}
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    <span className={`text-xs ${o.state === "overdue" ? "text-neg" : "text-ink-3"}`}>{o.state === "overdue" ? t("dash.overdue") : d === 0 ? t("dash.today") : d === 1 ? t("dash.tomorrow") : t("dash.inDays", { n: d })}</span>
                    <span className="num w-20 text-right">{kc(o.amount)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-ink-2">{t("dash.noUpcoming")}</p>}
        </Card>
        <Card title={t("dash.whereMoney")} subtitle={monthName(today)}>
          <CategoryDonut data={categories} />
        </Card>
      </div>

      {s.goals.progress.length > 0 && (
        <Card title={t("dash.goals")} action={<Link href="/sporeni" className="text-xs text-gold">{t("nav./sporeni")}</Link>}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {s.goals.progress.slice(0, 4).map((g) => (
              <div key={g.goal.id}>
                <div className="flex justify-between text-sm"><span className="truncate">{g.goal.name}</span><span className="text-gold">{g.percent} %</span></div>
                <Progress className="mt-1" value={g.percent} label={g.goal.name} />
                <p className="mt-1 text-xs text-ink-3">{kc(g.saved)} z {kc(g.goal.target_amount)}{g.requiredMonthly != null && !g.achieved ? ` · odkládat ${kc(g.requiredMonthly)} měsíčně` : ""}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {insights.length > 0 && (
        <Card title={t("dash.advice")} action={<Link href="/asistent" className="text-xs text-gold">{t("dash.ask")}</Link>}>
          <div className="space-y-2">{insights.slice(0, 3).map((i) => <InsightItem key={i.id} i={i} />)}</div>
        </Card>
      )}
    </div>
  );
}
