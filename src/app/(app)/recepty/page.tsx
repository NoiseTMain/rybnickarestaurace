import Link from "next/link";
import { ArrowLeft, Bookmark, CalendarDays, ChefHat, Crown, Heart, NotebookPen, Search, Shuffle } from "lucide-react";
import { requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { loadSnapshot } from "@/lib/data";
import { COURSES, CUISINES, DISHES, GOALS, MEALS, RECIPES, recipeName, type Dish, type Recipe } from "@/lib/recipes";
import { dishOfDay, matchVariant, type DishFilter } from "@/lib/recipes/browse";
import { phrase } from "@/lib/i18n/phrase";
import { formatMoney } from "@/lib/money";
import { todayISO } from "@/lib/dates";
import { Card, EmptyState, PageHeader } from "@/components/ui/Card";
import { FilterTabs } from "@/components/lists/Filters";
import { DishCard, type Reaction } from "@/components/recipes/DishCard";
import { CustomRecipeButton } from "@/components/recipes/CustomRecipeForms";
import type { CustomRecipe } from "@/lib/db/types";

export const metadata = { title: "Recepty" };
const PAGE = 24;
const VIEW_TITLE: Record<string, string> = { oblibene: "❤️ Oblíbené recepty", ulozene: "🔖 Uložené recepty", uvarene: "👨‍🍳 Uvařené recepty", vlastni: "📝 Vlastní recepty" };

export default async function RecipesPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const ctx = await requireContext();
  const [premium, { snapshot }, reactions, likes, custom] = await Promise.all([
    getPremium(ctx), loadSnapshot(ctx), ctx.store.select("recipe_reactions", { user_id: ctx.user.id }), ctx.store.recipeLikeCounts().catch(() => ({} as Record<string, number>)),
    ctx.store.select("custom_recipes", { household_id: ctx.household.id }),
  ]);
  const react = new Map<string, Reaction>(reactions.map((r) => [r.recipe_id, r]));
  const filter: DishFilter = { course: sp.kategorie, cuisine: sp.kuchyne, meal: sp.jidlo, goal: sp.cil, diet: sp.dieta, freeOnly: Boolean(sp.zdarma), q: sp.q?.trim() || undefined };
  const view = sp.pohled ?? "";
  let matched: { d: Dish; v: Recipe }[] = DISHES.map((d) => ({ d, v: matchVariant(d, filter, recipeName) })).filter((x): x is { d: Dish; v: Recipe } => Boolean(x.v));
  if (view === "ulozene") matched = matched.filter((x) => react.get(x.d.id)?.saved);
  if (view === "oblibene") matched = matched.filter((x) => react.get(x.d.id)?.liked);
  if (view === "uvarene") matched = matched.filter((x) => (react.get(x.d.id)?.cooked_count ?? 0) > 0).sort((a, b) => (react.get(b.d.id)?.cooked_count ?? 0) - (react.get(a.d.id)?.cooked_count ?? 0));
  if (sp.razeni === "oblibene") matched.sort((a, b) => (likes[b.d.id] ?? 0) - (likes[a.d.id] ?? 0));
  if (sp.razeni === "rychle") matched.sort((a, b) => a.v.time - b.v.time);
  if (sp.razeni === "levne") matched.sort((a, b) => a.v.price - b.v.price);
  if (sp.razeni === "protein") matched.sort((a, b) => b.v.protein - a.v.protein);
  const browsing = !view && !Object.entries(filter).some(([, v]) => v) && !sp.razeni;
  const card = (x: { d: Dish; v: Recipe }, wide = false) => <DishCard key={x.d.id} d={x.d} v={x.v} locked={!x.d.free && !premium.household} reaction={react.get(x.d.id)} likes={likes[x.d.id] ?? 0} wide={wide} />;
  const page = Math.max(1, Number(sp.strana) || 1);
  const pages = Math.ceil(matched.length / PAGE);
  const link = (p: number) => `/recepty?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null) as [string, string][]), strana: String(p) })}`;
  const tipN = Math.max(0, Number(sp.tip) || 0);
  const tip = dishOfDay(`${todayISO()}-${ctx.user.id}`, tipN, premium.household);
  const popular = DISHES.filter((d) => (likes[d.id] ?? 0) > 0).sort((a, b) => (likes[b.id] ?? 0) - (likes[a.id] ?? 0)).slice(0, 10);
  const counts = { oblibene: reactions.filter((r) => r.liked).length, ulozene: reactions.filter((r) => r.saved).length, uvarene: reactions.filter((r) => r.cooked_count > 0).length, vlastni: custom.length };
  const iconLink = (v: keyof typeof counts, icon: React.ReactNode, label: string, tone: string) => (
    <Link href={view === v ? "/recepty" : `/recepty?pohled=${v}`} aria-label={label} title={label} data-testid={`view-${v}`}
      className={`flex h-10 items-center gap-1.5 rounded-full border px-3 text-sm transition ${view === v ? `${tone} border-current bg-white/[0.06]` : "border-white/10 text-ink-2 hover:text-ink"}`}>
      {icon}<span className="num">{counts[v]}</span>
    </Link>
  );
  const q = sp.q?.trim().toLowerCase();
  const customList = custom.filter((c) => (!sp.kategorie || c.course === sp.kategorie) && (!q || c.title.toLowerCase().includes(q) || c.ingredients.some((i) => i.name.toLowerCase().includes(q))))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  return (
    <div className="space-y-4">
      <PageHeader title="Recepty" subtitle={`${DISHES.length} jídel a ${RECIPES.length} variant z ${Object.keys(CUISINES).length} kuchyní · kalorie, makra a cena porce · suroviny jedním klikem do nákupního seznamu`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {iconLink("oblibene", <Heart className={`h-4 w-4 ${counts.oblibene ? "fill-current text-neg" : ""}`} />, "Oblíbené", "text-neg")}
            {iconLink("ulozene", <Bookmark className={`h-4 w-4 ${counts.ulozene ? "fill-current text-gold" : ""}`} />, "Uložené", "text-gold")}
            {iconLink("uvarene", <ChefHat className="h-4 w-4" />, "Uvařené", "text-pos")}
            {iconLink("vlastni", <><NotebookPen className="h-4 w-4" />{!premium.household && <Crown className="h-3 w-3 text-gold" />}</>, "Vlastní recepty", "text-gold")}
            <Link href="/recepty/jidelnicek" className="flex h-10 items-center gap-2 rounded-full bg-gold px-4 text-sm font-medium text-[#1b1407]"><CalendarDays className="h-4 w-4" />Jídelníček na týden</Link>
          </div>
        } />
      {!premium.household && (
        <Card variant="light" className="!p-4 text-sm">
          <span className="flex flex-wrap items-center gap-2"><Crown className="h-4 w-4 text-gold" />Zdarma máte {DISHES.filter((d) => d.free).length} jídel. Všech {DISHES.length} odemkne <Link href="/premium" className="text-gold underline">Premium</Link>.</span>
        </Card>
      )}
      <form className="flex items-center gap-2" action="/recepty">
        <Search className="h-4 w-4 text-ink-3" />
        <input name="q" defaultValue={sp.q ?? ""} placeholder="Hledat recept nebo surovinu (např. losos, cizrna)…" className="field !h-10 flex-1" aria-label="Hledat recept" />
        {Object.entries(sp).filter(([k, v]) => v && k !== "q" && k !== "strana").map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      </form>
      {view && (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/recepty" className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm text-ink-2 hover:text-ink"><ArrowLeft className="h-4 w-4" />Všechny recepty</Link>
          <h2 className="text-lg font-semibold">{VIEW_TITLE[view] ?? ""}</h2>
          {view === "vlastni" && premium.household && <span className="ml-auto"><CustomRecipeButton /></span>}
        </div>
      )}
      <FilterTabs name="kategorie" options={[{ value: "", label: "Všechny kategorie" }, ...Object.entries(COURSES).map(([k, c]) => ({ value: k, label: `${c.emoji} ${phrase(c.label)}`, count: DISHES.filter((d) => d.course === k).length }))]} />
      <details className="rounded-2xl bg-white/[0.03] p-3" open={!browsing}>
        <summary className="cursor-pointer text-sm text-ink-2">Další filtry a řazení</summary>
        <div className="mt-3 space-y-2">
          <FilterTabs name="kuchyne" options={[{ value: "", label: "Všechny kuchyně" }, ...Object.entries(CUISINES).map(([k, c]) => ({ value: k, label: `${c.flag} ${phrase(c.label)}` }))]} />
          <FilterTabs name="jidlo" options={[{ value: "", label: "Každé jídlo" }, ...Object.entries(MEALS).map(([k, l]) => ({ value: k, label: l }))]} />
          <FilterTabs name="cil" options={[{ value: "", label: "Jakýkoli cíl" }, ...Object.entries(GOALS).map(([k, l]) => ({ value: k, label: l }))]} />
          <FilterTabs name="dieta" options={[{ value: "", label: "Vše" }, { value: "maso", label: "S masem" }, { value: "ryby", label: "Ryby" }, { value: "vegetariánské", label: "Vegetariánské" }, { value: "veganské", label: "Veganské" }]} />
          <FilterTabs name="razeni" options={[{ value: "", label: "Výchozí řazení" }, { value: "oblibene", label: "Nejoblíbenější" }, { value: "rychle", label: "Nejrychlejší" }, { value: "levne", label: "Nejlevnější" }, { value: "protein", label: "Nejvíc bílkovin" }]} />
          {!premium.household && <FilterTabs name="zdarma" options={[{ value: "", label: "Všechny" }, { value: "1", label: "Jen zdarma" }]} />}
        </div>
      </details>
      {snapshot.food && <p className="text-xs text-ink-3">Váš denní limit na jídlo: {formatMoney(snapshot.food.dailyLimit, { decimals: "never" })} – u receptů vidíte cenu porce.</p>}

      {view === "vlastni" ? (
        <div className="space-y-4" data-testid="custom-recipes">
          {!premium.household && (
            <Card variant="light" className="!p-5 text-sm">
              <p className="flex items-center gap-2 font-medium"><Crown className="h-4 w-4 text-gold" />Vlastní recepty jsou součástí Premium</p>
              <p className="mt-1 text-ink-2">Uložte si své oblíbené recepty s fotkou jídla, surovinami a postupem – a suroviny pak jedním klikem pošlete do nákupního seznamu. <Link href="/premium" className="text-gold underline">Aktivovat Premium</Link></p>
            </Card>
          )}
          {customList.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{customList.map((c) => <CustomCard key={c.id} c={c} />)}</div>
          ) : (
            <EmptyState title="Zatím tu nic není">{premium.household ? "Přidejte svůj první recept i s fotkou jídla." : "S Premium si sem uložíte vlastní recepty."}</EmptyState>
          )}
        </div>
      ) : browsing ? (
        <div className="space-y-6">
          <Card variant="light" title="Co dnes uvařit?" subtitle="Tip na dnešek – každý den jiný" data-testid="tip"
            action={<Link href={`/recepty?tip=${tipN + 1}`} className="flex items-center gap-1 rounded-full border border-white/10 px-3 py-1.5 text-sm"><Shuffle className="h-4 w-4" />Jiný tip</Link>}>
            <div className="max-w-sm">{card({ d: tip, v: tip.def })}</div>
          </Card>
          {popular.length > 0 && (
            <section>
              <div className="mb-2 flex items-baseline justify-between"><h2 className="text-lg font-semibold">❤️ Nejoblíbenější</h2><Link href="/recepty?razeni=oblibene" className="text-sm text-gold underline">Zobrazit vše</Link></div>
              <div className="scroll-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">{popular.map((d) => card({ d, v: d.def }, true))}</div>
            </section>
          )}
          {Object.entries(COURSES).map(([k, c]) => {
            const list = DISHES.filter((d) => d.course === k);
            return (
              <section key={k} data-testid={`course-${k}`}>
                <div className="mb-2 flex items-baseline justify-between gap-2"><h2 className="text-lg font-semibold">{c.emoji} {phrase(c.label)}</h2><Link href={`/recepty?kategorie=${k}`} className="text-sm text-gold underline">{phrase("Zobrazit vše")} ({list.length})</Link></div>
                <div className="scroll-thin -mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-2">{list.slice(0, 12).map((d) => card({ d, v: d.def }, true))}</div>
              </section>
            );
          })}
        </div>
      ) : (
        <>
          <p className="text-sm text-ink-3">Nalezeno {matched.length} jídel</p>
          {matched.length ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{matched.slice((page - 1) * PAGE, page * PAGE).map((x) => card(x))}</div>
          ) : (
            <EmptyState title={view ? "Zatím tu nic není" : "Nic jsme nenašli"}>{view === "ulozene" ? "Uložte si recepty záložkou 🔖 – najdete je tady." : view === "oblibene" ? "Lajkněte recepty srdíčkem ❤️." : view === "uvarene" ? "V detailu receptu klikněte na „Uvařil(a) jsem“." : "Zkuste jiný filtr nebo hledaný výraz."}</EmptyState>
          )}
          {pages > 1 && (
            <div className="flex items-center justify-center gap-2 text-sm">
              {page > 1 && <Link href={link(page - 1)} className="rounded-full border border-white/10 px-3 py-1.5">Předchozí</Link>}
              <span className="text-ink-3">{page} / {pages}</span>
              {page < pages && <Link href={link(page + 1)} className="rounded-full border border-white/10 px-3 py-1.5">Další</Link>}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function CustomCard({ c }: { c: CustomRecipe }) {
  return (
    <Link href={`/recepty/vlastni/${c.id}`} className="glass flex h-full flex-col overflow-hidden rounded-[var(--radius-card)] transition hover:border-gold/40" data-testid="custom-card">
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-black/30">
        {c.photo_document_id
          // eslint-disable-next-line @next/next/no-img-element
          ? <img src={`/api/files/${c.photo_document_id}`} alt={c.title} loading="lazy" className="h-full w-full object-cover" />
          : <span className="flex h-full w-full items-center justify-center text-5xl" aria-hidden>{COURSES[c.course].emoji}</span>}
        <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-xs backdrop-blur">{COURSES[c.course].emoji} {phrase(COURSES[c.course].label)}</span>
      </div>
      <div className="flex flex-1 flex-col px-4 pb-4">
        <p className="mt-2 line-clamp-2 font-medium leading-snug">{c.title}</p>
        <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1 pt-3 text-xs text-ink-2">
          <span>{c.ingredients.length} {phrase("surovin")}</span>
          {c.time_min && <span>{c.time_min} min</span>}
          {c.kcal != null && <span>{c.kcal} kcal</span>}
        </div>
      </div>
    </Link>
  );
}
