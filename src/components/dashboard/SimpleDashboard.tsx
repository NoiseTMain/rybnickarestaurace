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

const kc = (c: number) => formatMoney(c, { decimals: "never" });
const dny = (n: number) => `${n} ${n === 1 ? "den" : n < 5 ? "dny" : "dní"}`;

/** Krátké vysvětlení „Co to znamená?“ – rozbalovací, bez odborných pojmů. */
function Explain({ children }: { children: ReactNode }) {
  return (
    <details className="group mt-2 text-xs text-ink-3">
      <summary className="flex cursor-pointer list-none items-center gap-1 hover:text-ink-2"><HelpCircle className="h-3.5 w-3.5" />Co to znamená?</summary>
      <p className="mt-1 leading-relaxed">{children}</p>
    </details>
  );
}

function Tile({ icon, label, value, note, tone, href, explain }: { icon: ReactNode; label: string; value: number; note?: ReactNode; tone?: "pos" | "neg" | "gold"; href?: string; explain: ReactNode }) {
  const body = (
    <Card className="h-full !p-4 transition hover:border-gold/30">
      <div className="flex items-center gap-2 text-sm text-ink-2"><span className="text-gold">{icon}</span>{label}{href && <ChevronRight className="ml-auto h-4 w-4 text-ink-3" />}</div>
      <p className={`num mt-1 text-2xl font-semibold ${tone === "pos" ? "text-pos" : tone === "neg" ? "text-neg" : tone === "gold" ? "gold-text" : ""}`}>{kc(value)}</p>
      {note && <p className="mt-0.5 text-xs text-ink-3">{note}</p>}
      <Explain>{explain}</Explain>
    </Card>
  );
  return href ? <Link href={href} className="block">{body}</Link> : body;
}

/**
 * Jednoduchý Přehled: jedna hlavní odpověď („kolik můžete ještě utratit“)
 * a pár srozumitelných čísel. Vše počítá stejný plánovač jako podrobný pohled.
 */
export function SimpleDashboard({ s, today, insights, categories, extra }: {
  s: Snapshot; today: string; insights: Insight[]; categories: { name: string; amount: number }[]; extra?: ReactNode;
}) {
  const daysLeft = s.daysLeftInMonth;
  const perDay = divFloor(s.planner.safeToSpend, Math.max(1, daysLeft));
  const lastSame = s.lastMonthToDate.expense;
  const diff = s.month.expense - lastSame;
  const upcoming = s.upcoming.filter((o) => o.date <= s.monthEnd).slice(0, 4);
  return (
    <div className="space-y-4">
      {/* hlavní odpověď */}
      <Card variant="light" className="!p-5 sm:!p-6">
        <p className="text-sm text-ink-2">Do konce měsíce ({dny(daysLeft)}) můžete ještě v klidu utratit</p>
        <p className={`num mt-1 text-4xl font-semibold sm:text-5xl ${s.planner.safeToSpend > 0 ? "gold-text" : "text-neg"}`}>{kc(s.planner.safeToSpend)}</p>
        {s.planner.safeToSpend > 0 && <p className="mt-1 text-sm text-ink-2">to je zhruba <b className="text-ink">{kc(perDay)} na den</b> navíc k tomu, co už máte naplánované</p>}
        {s.planner.needToEarn > 0 && <p className="mt-2 rounded-xl bg-neg/10 px-3 py-2 text-sm text-neg">Pozor: na všechno naplánované do konce měsíce chybí {kc(s.planner.needToEarn)}. Zkuste omezit výdaje nebo počkejte na příjem.</p>}
        <Explain>
          Je to částka, kterou můžete utratit za cokoli navíc, aniž byste ohrozili to důležité. Už jsme z vašich peněz odečetli: platby, které tento měsíc ještě přijdou (nájem, energie…),
          zbytek peněz na jídlo a další rozpočty, rezervu na nečekané výdaje, odkládání na spoření a cesty. Peníze, které teprve mají přijít (výplata), nepočítáme, dokud nepřijdou.
        </Explain>
        <p className="mt-3 text-xs text-ink-3"><Link href="/sporeni" className="text-gold underline">Jak se to počítá – podrobný rozpis</Link></p>
      </Card>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Tile icon={<Wallet className="h-4 w-4" />} label="Na účtech teď máte" value={s.planner.available} href="/transakce"
          note={s.goals.totalSaved > 0 ? `+ ${kc(s.goals.totalSaved)} naspořeno na cílech` : "běžné účty a hotovost"}
          explain="Součet peněz na běžných účtech a v hotovosti. Peníze, které jste si odložili na spoření, tu nejsou – ty máte zvlášť." />
        <Tile icon={<TrendingDown className="h-4 w-4" />} label="Tento měsíc jste utratili" value={s.month.expense} href="/transakce"
          note={lastSame > 0 ? (diff > 0 ? `o ${kc(diff)} víc než minulý měsíc touhle dobou` : `o ${kc(-diff)} míň než minulý měsíc touhle dobou`) : undefined}
          tone={lastSame > 0 && diff > 0 ? "neg" : undefined}
          explain="Všechny výdaje od začátku měsíce do dneška. Srovnáváme se stejným počtem dní minulého měsíce, aby to bylo férové." />
        <Tile icon={<TrendingUp className="h-4 w-4" />} label="Přišlo vám" value={s.month.income} tone="pos" href="/transakce"
          note={s.expectedIncomeTotal > 0 ? `ještě čekáte ${kc(s.expectedIncomeTotal)}` : "tento měsíc"}
          explain="Příjmy, které už jsou na účtu. Výplaty a faktury, které teprve mají přijít, ukazujeme zvlášť jako „ještě čekáte“ – do volných peněz se nepočítají, dokud nedorazí." />
        <Tile icon={<CalendarClock className="h-4 w-4" />} label="Ještě zaplatíte" value={s.unpaidObligationsTotal} href="/platby"
          note={upcoming[0] ? `nejbližší: ${upcoming[0].name} ${formatDate(upcoming[0].date, "day")}` : "do konce měsíce nic dalšího"}
          explain="Pravidelné platby a faktury, které jsou splatné do konce měsíce a ještě nejsou zaplacené (i ty po splatnosti). Tyto peníze jsou už odečtené z částky nahoře." />
      </div>

      {extra}

      <div className="grid gap-4 lg:grid-cols-3">
        {s.food ? (
          <Card title="Jídlo" action={<Link href="/rozpocty" className="text-xs text-gold">Rozpočty</Link>}>
            <div className="flex items-center gap-2 text-sm text-ink-2"><ShoppingBasket className="h-4 w-4 text-gold" />Na jídlo vám zbývá</div>
            <p className={`num text-2xl font-semibold ${s.food.remaining < 0 ? "text-neg" : ""}`}>{kc(s.food.remaining)}</p>
            <Progress className="mt-2" value={s.food.usedPercent} tone={s.food.status === "over" ? "neg" : s.food.status === "warning" ? "warn" : "gold"} label="Rozpočet na jídlo" />
            <p className="mt-2 text-sm">Můžete utrácet <b>{kc(s.food.dailyLimit)} denně</b>, tento týden ještě {kc(s.food.weekLimit)}.</p>
            {s.food.alerts[0] && <p className={`mt-1 text-xs ${s.food.alerts[0].level === "danger" ? "text-neg" : "text-warn"}`}>{s.food.alerts[0].message}</p>}
          </Card>
        ) : (
          <Card title="Jídlo"><p className="text-sm text-ink-2">Nastavte si, kolik chcete měsíčně utratit za jídlo, a aplikace vám řekne, kolik můžete denně. <Link href="/rozpocty" className="text-gold underline">Nastavit</Link></p></Card>
        )}
        <Card title="Co vás čeká" action={<Link href="/platby" className="text-xs text-gold">Vše</Link>}>
          {s.upcoming.length ? (
            <ul className="space-y-2">
              {s.upcoming.slice(0, 5).map((o) => {
                const d = diffDays(today, o.date);
                return (
                  <li key={o.key} className="flex items-center gap-2 text-sm">
                    {o.kind === "trip" ? <Plane className="h-4 w-4 shrink-0 text-gold" /> : <CalendarClock className="h-4 w-4 shrink-0 text-ink-3" />}
                    <span className="min-w-0 flex-1 truncate">{o.name}</span>
                    <span className={`text-xs ${o.state === "overdue" ? "text-neg" : "text-ink-3"}`}>{o.state === "overdue" ? "po splatnosti" : d === 0 ? "dnes" : d === 1 ? "zítra" : `za ${d} d.`}</span>
                    <span className="num w-20 text-right">{kc(o.amount)}</span>
                  </li>
                );
              })}
            </ul>
          ) : <p className="text-sm text-ink-2">Žádné platby v nejbližší době.</p>}
        </Card>
        <Card title="Kam šly peníze" subtitle={monthName(today)}>
          <CategoryDonut data={categories} />
        </Card>
      </div>

      {s.goals.progress.length > 0 && (
        <Card title="Na co spoříte" action={<Link href="/sporeni" className="text-xs text-gold">Spoření</Link>}>
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
        <Card title="Rada od asistenta" action={<Link href="/asistent" className="text-xs text-gold">Zeptat se</Link>}>
          <div className="space-y-2">{insights.slice(0, 3).map((i) => <InsightItem key={i.id} i={i} />)}</div>
        </Card>
      )}
    </div>
  );
}
