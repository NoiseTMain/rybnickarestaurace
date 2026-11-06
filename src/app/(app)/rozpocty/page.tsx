import { AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";
import { requireContext } from "@/lib/context";
import { loadSnapshot } from "@/lib/data";
import { addDays, daysInMonth, formatDate, monthName, parts } from "@/lib/dates";
import { divRound, formatMoney, percent } from "@/lib/money";
import { deleteBudget } from "@/lib/actions/budgets";
import { Card, PageHeader } from "@/components/ui/Card";
import { Money } from "@/components/ui/Money";
import { Badge } from "@/components/ui/Badge";
import { Progress } from "@/components/ui/Progress";
import { BudgetButton } from "@/components/forms/BudgetForm";
import { FoodPaceChart } from "@/components/charts/Charts";
import { KV } from "@/components/dashboard/bits";
import { ActionButton } from "@/components/ui/ActionButton";

export const metadata = { title: "Rozpočty" };

export default async function BudgetsPage() {
  const ctx = await requireContext();
  const { data, snapshot: s, today } = await loadSnapshot(ctx);
  const f = s.food;
  const foodIds = new Set(data.categories.filter((c) => c.is_food).map((c) => c.id));
  const foodBudget = data.budgets.find((b) => b.kind === "food" && b.month == null);
  const foodMonthBudget = data.budgets.find((b) => b.kind === "food" && b.month === s.monthStart);
  const totalBudget = data.budgets.find((b) => b.kind === "total" && b.month == null);

  let pace: { day: number; plan: number; actual: number | null }[] = [];
  if (f) {
    const p = parts(today);
    const D = daysInMonth(p.y, p.m);
    let cum = 0;
    pace = Array.from({ length: D }, (_, i) => {
      const day = i + 1;
      const date = addDays(s.monthStart, i);
      if (date <= today) cum += data.transactions.filter((t) => t.status === "posted" && t.type === "expense" && t.date === date && t.category_id && foodIds.has(t.category_id)).reduce((a, t) => a + t.amount, 0);
      return { day, plan: divRound(f.budget * day, D), actual: date <= today ? cum : null };
    });
  }

  return (
    <div className="space-y-4">
      <PageHeader title="Rozpočty" subtitle={`${monthName(today)} · limity se přepočítávají podle skutečných výdajů`} />

      <Card variant="light" title="Inteligentní rozpočet na jídlo" subtitle={`Kategorie: ${data.categories.filter((c) => c.is_food).map((c) => c.name).join(", ") || "žádná – označte v kategoriích"}`}
        action={<BudgetButton kind="food" initial={foodBudget} label={foodBudget ? "Upravit" : "Nastavit"} variant={foodBudget ? "secondary" : "primary"} />}>
        {f ? (
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
            <div>
              <div className="grid grid-cols-3 gap-3">
                <div><p className="text-[11px] uppercase tracking-wider text-ink-2">Dnes a dál / den</p><p className="num text-2xl font-semibold sm:text-3xl">{formatMoney(f.dailyLimit, { decimals: "never" })}</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-ink-2">Do konce týdne</p><p className="num text-2xl font-semibold sm:text-3xl">{formatMoney(f.weekLimit, { decimals: "never" })}</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-ink-2">Zbývá v měsíci</p><p className={`num text-2xl font-semibold sm:text-3xl ${f.remaining < 0 ? "text-neg" : ""}`}>{formatMoney(f.remaining, { decimals: "never" })}</p></div>
              </div>
              <Progress className="mt-4" value={f.usedPercent} marker={percent(f.expectedByNow, f.budget)} tone={f.status === "over" ? "neg" : f.status === "warning" ? "warn" : "gold"} label="Vyčerpání rozpočtu na jídlo" />
              <p className="mt-1.5 text-xs text-ink-2">Vyčerpáno {f.usedPercent} % · svislá značka = kde byste podle plánu měli být dnes</p>
              <div className="mt-4 grid gap-x-6 sm:grid-cols-2">
                <KV k="Měsíční rozpočet" v={<Money value={f.budget} />} />
                <KV k="Utraceno" v={<Money value={f.spent} />} />
                <KV k="Plán na den (celý měsíc)" v={<Money value={f.plannedDaily} />} />
                <KV k="Plán na týden" v={<Money value={f.plannedWeekly} />} />
                <KV k="Průměrně utrácíte / den" v={<Money value={f.avgDaily} />} />
                <KV k="Dnes utraceno" v={<Money value={f.spentToday} />} />
                <KV k="Podle plánu k dnešku" v={<Money value={f.expectedByNow} />} />
                <KV k={f.vsPlan >= 0 ? "Pod plánem o" : "Nad plánem o"} v={<Money value={Math.abs(f.vsPlan)} className={f.vsPlan >= 0 ? "text-pos" : "text-neg"} />} />
                <KV k="Odhad na konec měsíce" v={<Money value={f.projected} className={f.projected > f.budget ? "text-neg" : ""} />} />
                <KV k="Zbývá dní (vč. dneška)" v={f.daysLeft} />
              </div>
              {foodMonthBudget && <p className="mt-2 text-xs text-ink-2">Pro tento měsíc platí zvláštní rozpočet {formatMoney(foodMonthBudget.amount)}.</p>}
            </div>
            <div>
              <FoodPaceChart data={pace} />
              <div className="mt-3 space-y-2">
                {f.alerts.length ? f.alerts.map((a) => (
                  <div key={a.code} className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm ${a.level === "danger" ? "bg-neg/15 text-neg" : "bg-warn/15 text-warn"}`}><AlertTriangle className="h-4 w-4 shrink-0" />{a.message}</div>
                )) : <div className="flex items-center gap-2 rounded-xl bg-pos/10 px-3 py-2 text-sm text-pos"><CheckCircle2 className="h-4 w-4" />Jste v plánu. Takhle dál!</div>}
              </div>
            </div>
          </div>
        ) : (
          <p className="text-sm text-ink-2">Zadejte měsíční rozpočet (např. 12 000 Kč). Aplikace spočítá týdenní a denní limit, sleduje tempo a upozorní, když nebude stačit.</p>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Celkový měsíční limit" subtitle="Všechny výdaje měsíce" action={<BudgetButton kind="total" initial={totalBudget} label={totalBudget ? "Upravit" : "Nastavit"} />}>
          {s.totalBudget ? (
            <>
              <div className="flex items-baseline justify-between"><Money value={s.totalBudget.spent} className="text-2xl font-semibold" decimals="never" /><span className="text-sm text-ink-3">z {formatMoney(s.totalBudget.amount, { decimals: "never" })}</span></div>
              <Progress className="mt-3" value={percent(s.totalBudget.spent, s.totalBudget.amount)} tone={s.totalBudget.spent > s.totalBudget.amount ? "neg" : "gold"} label="Celkový rozpočet" />
              <p className="mt-2 text-sm text-ink-2">Zbývá <Money value={s.totalBudget.amount - s.totalBudget.spent} colored decimals="never" /></p>
            </>
          ) : <p className="text-sm text-ink-3">Volitelné – horní hranice všech výdajů za měsíc.</p>}
        </Card>

        <Card title="Limity kategorií" className="lg:col-span-2" action={<BudgetButton kind="category" label="Přidat limit" />}>
          {s.categoryBudgets.length ? (
            <ul className="space-y-3">
              {s.categoryBudgets.map((c) => (
                <li key={c.budget.id}>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.category?.color }} />
                    <span className="flex-1">{c.category?.name}{c.budget.month && <Badge className="ml-2">jen {monthName(c.budget.month)}</Badge>}</span>
                    {c.over && <Badge tone="danger">překročeno</Badge>}
                    <span className="num">{formatMoney(c.spent, { decimals: "never" })} / {formatMoney(c.budget.amount, { decimals: "never" })}</span>
                    <BudgetButton kind="category" initial={c.budget} size="icon" variant="ghost" />
                    <ActionButton action={deleteBudget.bind(null, c.budget.id)} confirm="Odstranit limit?" size="icon" icon={<Trash2 className="h-4 w-4" />} />
                  </div>
                  <Progress className="mt-1.5" value={c.percent} tone={c.over ? "neg" : c.percent > 85 ? "warn" : "gold"} label={c.category?.name} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-3">Žádné limity. Přidejte např. Restaurace 2 000 Kč.</p>}
        </Card>
      </div>
      <p className="text-xs text-ink-3">Zbytky rozpočtů do konce měsíce se ve finančním plánu rezervují – nepočítají se do peněz „volných k utracení“. Dnes je {formatDate(today, "long")}.</p>
    </div>
  );
}

