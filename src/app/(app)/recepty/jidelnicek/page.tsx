import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { GOALS, recipeName } from "@/lib/recipes";
import { weekPlan } from "@/lib/recipes/browse";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { Card, PageHeader } from "@/components/ui/Card";
import { FilterTabs } from "@/components/lists/Filters";
import { WeekPlanButton } from "@/components/recipes/WeekPlanButton";

export const metadata = { title: "Jídelníček na týden" };
const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];

export default async function WeekPlanPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const premium = (await getPremium(ctx)).household;
  const n = Math.max(0, Number(sp.varianta) || 0);
  const plan = weekPlan(`${todayISO().slice(0, 8)}-${ctx.user.id}-${n}`, premium, sp.dieta, sp.cil);
  const total = plan.reduce((a, r) => a + r.price, 0);
  const kcal = Math.round(plan.reduce((a, r) => a + r.kcal, 0) / Math.max(1, plan.length));
  const keep = Object.fromEntries(Object.entries(sp).filter(([k, v]) => v && k !== "varianta")) as Record<string, string>;
  return (
    <div className="space-y-4">
      <PageHeader title="Jídelníček na týden" subtitle="7 různých jídel z různých kuchyní – suroviny jedním klikem do nákupního seznamu" />
      <div className="flex flex-wrap gap-2">
        <FilterTabs name="dieta" options={[{ value: "", label: "Vše" }, { value: "maso", label: "S masem" }, { value: "ryby", label: "Ryby" }, { value: "vegetariánské", label: "Vegetariánské" }, { value: "veganské", label: "Veganské" }]} />
        <FilterTabs name="cil" options={[{ value: "", label: "Jakýkoli cíl" }, ...Object.entries(GOALS).map(([k, l]) => ({ value: k, label: l }))]} />
      </div>
      <Card data-testid="week-plan">
        <ol className="divide-y divide-white/[0.06]">
          {plan.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 py-2.5">
              <span className="w-20 shrink-0 text-xs text-ink-3">{DAYS[i]}</span>
              <Link href={`/recepty/${r.dishId}?a=${r.aKey}${r.bKey ? `&b=${r.bKey}` : ""}`} className="min-w-0 flex-1 truncate text-sm font-medium hover:text-gold">{recipeName(r)}</Link>
              <span className="hidden text-xs text-ink-3 sm:inline">{r.kcal} kcal · {r.time} min</span>
              <span className="num text-sm">{formatMoney(r.price, { decimals: "never" })}</span>
            </li>
          ))}
        </ol>
        {plan.length < 7 && <p className="mt-2 text-xs text-ink-3">Pro zvolený filtr máme jen {plan.length} vhodných jídel{premium ? "" : " ve verzi zdarma – všechna odemkne Premium"}.</p>}
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-3">
          <p className="text-sm text-ink-2">Za porci celkem ≈ <b>{formatMoney(total, { decimals: "never" })}</b> · průměrně {kcal} kcal</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/recepty/jidelnicek?${new URLSearchParams({ ...keep, varianta: String(n + 1) })}`} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-2 text-sm"><RefreshCw className="h-4 w-4" />Jiný jídelníček</Link>
            <WeekPlanButton ids={plan.map((r) => r.id)} />
          </div>
        </div>
      </Card>
    </div>
  );
}
