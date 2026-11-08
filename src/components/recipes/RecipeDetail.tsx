"use client";
import Link from "next/link";
import { Clock, Flame, Minus, Plus, ShoppingCart } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addRecipeToList } from "@/lib/actions/recipes";
import { amount } from "@/lib/recipes/amount";
import type { Recipe } from "@/lib/recipes";
import { recipeName, recipeSteps } from "@/lib/recipes/localize";
import { phrase } from "@/lib/i18n/phrase";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

export function RecipeDetail({ r, lists, cuisine, meals, goals }: { r: Recipe; lists: { id: string; name: string }[]; cuisine: string; meals: string; goals: string[] }) {
  const [n, setN] = useState(2);
  const [list, setList] = useState("");
  const [pending, start] = useTransition();
  const toast = useToast();
  const router = useRouter();
  const add = () => start(async () => {
    const res = await addRecipeToList(r.id, n, list || null);
    if (res.ok) { toast(res.message ?? "Přidáno"); router.push("/planovani"); } else toast(res.error ?? "Nepovedlo se", "error");
  });
  return (
    <div className="space-y-4">
      <PageHeader title={recipeName(r)} subtitle={`${phrase(cuisine)} · ${meals.split(", ").map((m) => phrase(m)).join(", ")} · ${phrase(r.diet)}`} />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Energie</p><p className="flex items-center gap-1 text-xl font-semibold"><Flame className="h-4 w-4 text-gold" />{r.kcal} kcal</p><p className="text-xs text-ink-3">na porci</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Bílkoviny</p><p className="text-xl font-semibold">{r.protein} g</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Sacharidy</p><p className="text-xl font-semibold">{r.carbs} g</p></Card>
        <Card className="!p-4"><p className="text-[11px] uppercase tracking-wider text-ink-3">Tuky</p><p className="text-xl font-semibold">{r.fat} g</p></Card>
        <Card className="col-span-2 !p-4 lg:col-span-1"><p className="text-[11px] uppercase tracking-wider text-ink-3">Cena porce</p><p className="text-xl font-semibold">≈ {formatMoney(r.price, { decimals: "never" })}</p><p className="flex items-center gap-1 text-xs text-ink-3"><Clock className="h-3 w-3" />{r.time} min</p></Card>
      </div>
      {goals.length > 0 && <div className="flex flex-wrap gap-2">{goals.map((g) => <span key={g} className="rounded-full bg-gold/15 px-3 py-1 text-xs text-gold-bright">{g}</span>)}</div>}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Suroviny" action={
          <div className="flex items-center gap-2 text-sm">
            <button type="button" aria-label="Méně porcí" onClick={() => setN((x) => Math.max(1, x - 1))} className="rounded-full border border-white/10 p-1"><Minus className="h-3.5 w-3.5" /></button>
            <span className="w-16 text-center">{n} {n === 1 ? "porce" : n < 5 ? "porce" : "porcí"}</span>
            <button type="button" aria-label="Více porcí" onClick={() => setN((x) => Math.min(20, x + 1))} className="rounded-full border border-white/10 p-1"><Plus className="h-3.5 w-3.5" /></button>
          </div>
        }>
          <ul className="space-y-1 text-sm">{r.ingredients.map((i) => <li key={i.key} className="flex justify-between gap-2 border-t border-white/[0.06] py-1.5 first:border-0"><span>{i.name}</span><span className="num text-ink-2">{amount(i, n)}</span></li>)}</ul>
          <p className="mt-2 text-xs text-ink-3">Celkem ≈ {formatMoney(r.price * n, { decimals: "never" })} (orientační ceny surovin).</p>
          <div className="mt-3 space-y-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <select className="field !h-10 text-sm" aria-label="Nákupní seznam" value={list} onChange={(e) => setList(e.target.value)}>
              <option value="">Nový nákupní seznam</option>
              {lists.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
            <Button type="button" variant="primary" className="w-full justify-center" loading={pending} onClick={add} icon={<ShoppingCart className="h-4 w-4" />}>Do nákupního seznamu</Button>
          </div>
        </Card>
        <Card title="Postup">
          <ol className="space-y-3 text-sm">{recipeSteps(r).map((s, i) => <li key={i} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold/20 text-xs font-semibold text-gold">{i + 1}</span><span className="pt-0.5">{s}</span></li>)}</ol>
          <p className="mt-4 text-xs text-ink-3">Nutriční hodnoty jsou vypočtené z běžných tabulkových hodnot surovin (syrové váhy). <Link href="/recepty" className="text-gold underline">Další recepty</Link></p>
        </Card>
      </div>
    </div>
  );
}
