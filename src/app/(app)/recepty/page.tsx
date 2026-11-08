import Link from "next/link";
import { Clock, Crown, Flame, Search } from "lucide-react";
import { requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { loadSnapshot } from "@/lib/data";
import { CUISINES, GOALS, MEALS, RECIPES, type Recipe } from "@/lib/recipes";
import { formatMoney } from "@/lib/money";
import { Card, PageHeader } from "@/components/ui/Card";
import { FilterTabs } from "@/components/lists/Filters";

export const metadata = { title: "Recepty" };
const PAGE = 24;

function RecipeCard({ r, locked }: { r: Recipe; locked: boolean }) {
  return (
    <Link href={`/recepty/${r.id}`} className="block">
      <Card className="h-full !p-4 transition hover:border-gold/40">
        <div className="flex items-start justify-between gap-2">
          <span className="text-xl">{CUISINES[r.cuisine].flag}</span>
          {locked ? <Crown className="h-4 w-4 text-gold" aria-label="Premium" /> : <span className="rounded-full bg-pos/15 px-2 py-0.5 text-[10px] text-pos">zdarma</span>}
        </div>
        <p className="mt-1 line-clamp-2 font-medium leading-snug">{r.name}</p>
        <p className="mt-1 text-xs text-ink-3">{r.meal.map((m) => MEALS[m]).join(", ")} · {CUISINES[r.cuisine].label}</p>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-ink-2">
          <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-gold" />{r.kcal} kcal</span>
          <span>B {r.protein} g · S {r.carbs} g · T {r.fat} g</span>
          <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.time} min</span>
          <span>≈ {formatMoney(r.price, { decimals: "never" })}/porce</span>
        </div>
      </Card>
    </Link>
  );
}

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const [premium, { snapshot }] = await Promise.all([getPremium(ctx), loadSnapshot(ctx)]);
  const q = (sp.q ?? "").trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const list = RECIPES.filter((r) =>
    (!sp.kuchyne || r.cuisine === sp.kuchyne) && (!sp.jidlo || r.meal.includes(sp.jidlo as never)) && (!sp.cil || r.goals.includes(sp.cil as never))
    && (!sp.dieta || r.diet === sp.dieta || (sp.dieta === "vegetariánské" && r.diet === "veganské"))
    && (!sp.zdarma || r.free)
    && (!q || r.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q) || r.ingredients.some((i) => i.name.normalize("NFD").replace(/[̀-ͯ]/g, "").includes(q))));
  const page = Math.max(1, Number(sp.strana) || 1);
  const shown = list.slice((page - 1) * PAGE, page * PAGE);
  const pages = Math.ceil(list.length / PAGE);
  const link = (p: number) => `/recepty?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null) as [string, string][]), strana: String(p) })}`;
  return (
    <div className="space-y-4">
      <PageHeader title="Fitness recepty" subtitle={`${RECIPES.length} receptů z ${Object.keys(CUISINES).length} kuchyní · kalorie, makra a orientační cena porce · suroviny jedním klikem do nákupního seznamu`} />
      {!premium.household && (
        <Card variant="light" className="!p-4 text-sm">
          <span className="flex flex-wrap items-center gap-2"><Crown className="h-4 w-4 text-gold" />Zdarma máte {RECIPES.filter((r) => r.free).length} receptů. Všech {RECIPES.length} odemkne <Link href="/premium" className="text-gold underline">Premium</Link>.</span>
        </Card>
      )}
      {snapshot.food && <p className="text-xs text-ink-3">Váš denní limit na jídlo: {formatMoney(snapshot.food.dailyLimit, { decimals: "never" })} – u receptů vidíte cenu porce.</p>}
      <form className="flex items-center gap-2" action="/recepty">
        <Search className="h-4 w-4 text-ink-3" />
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Hledat recept nebo surovinu (např. losos, cizrna)…" className="field !h-10 flex-1" aria-label="Hledat recept" />
        {Object.entries(sp).filter(([k, v]) => v && k !== "q" && k !== "strana").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      </form>
      <FilterTabs name="kuchyne" options={[{ value: "", label: "Všechny kuchyně" }, ...Object.entries(CUISINES).map(([k, c]) => ({ value: k, label: `${c.flag} ${c.label}` }))]} />
      <div className="flex flex-wrap gap-2">
        <FilterTabs name="jidlo" options={[{ value: "", label: "Každé jídlo" }, ...Object.entries(MEALS).map(([k, l]) => ({ value: k, label: l }))]} />
        <FilterTabs name="cil" options={[{ value: "", label: "Jakýkoli cíl" }, ...Object.entries(GOALS).map(([k, l]) => ({ value: k, label: l }))]} />
        <FilterTabs name="dieta" options={[{ value: "", label: "Vše" }, { value: "maso", label: "S masem" }, { value: "ryby", label: "Ryby" }, { value: "vegetariánské", label: "Vegetariánské" }, { value: "veganské", label: "Veganské" }]} />
        {!premium.household && <FilterTabs name="zdarma" options={[{ value: "", label: "Všechny" }, { value: "1", label: "Jen zdarma" }]} />}
      </div>
      <p className="text-sm text-ink-3">Nalezeno {list.length} receptů</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{shown.map((r) => <RecipeCard key={r.id} r={r} locked={!r.free && !premium.household} />)}</div>
      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 text-sm">
          {page > 1 && <Link href={link(page - 1)} className="rounded-full border border-white/10 px-3 py-1.5">Předchozí</Link>}
          <span className="text-ink-3">{page} / {pages}</span>
          {page < pages && <Link href={link(page + 1)} className="rounded-full border border-white/10 px-3 py-1.5">Další</Link>}
        </div>
      )}
    </div>
  );
}
