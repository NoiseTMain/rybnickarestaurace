import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { COURSES, CUISINES, DISHES, GOALS, ING, MEALS, dishById, recipeById, variantOf } from "@/lib/recipes";
import { PremiumWall } from "@/components/premium/PremiumWall";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";
import { RecipeActions } from "@/components/recipes/RecipeActions";
import { DishCard } from "@/components/recipes/DishCard";
import { phrase } from "@/lib/i18n/phrase";

export const metadata = { title: "Recept" };

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export default async function RecipePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { id } = await params;
  const sp = await searchParams;
  const legacy = recipeById(id);
  const dish = dishById(id) ?? (legacy ? dishById(legacy.dishId) : null);
  if (!dish) notFound();
  const r = sp.a || sp.b ? variantOf(dish, sp.a, sp.b) : legacy && legacy.dishId === dish.id ? legacy : dish.def;
  const ctx = await requireContext();
  const premium = (await getPremium(ctx)).household;
  if (!dish.free && !premium) return <PremiumWall title={phrase(dish.title)}>Tento recept je součástí Premium – spolu s dalšími stovkami fitness receptů z 10 kuchyní.</PremiumWall>;
  const [lists, mine, likes] = await Promise.all([
    ctx.store.select("shopping_lists", { household_id: ctx.household.id }).then((ls) => ls.filter((l) => l.status === "open").map((l) => ({ id: l.id, name: l.name }))),
    ctx.store.select("recipe_reactions", { user_id: ctx.user.id, recipe_id: dish.id }),
    ctx.store.recipeLikeCounts().catch(() => ({} as Record<string, number>)),
  ]);
  const me = mine[0];
  const href = (a: string, b: string | null) => `/recepty/${dish.id}?a=${a}${b ? `&b=${b}` : ""}`;
  const similar = DISHES.filter((d) => d.id !== dish.id && d.course === dish.course && (premium || d.free)).sort((x, y) => Number(y.cuisine === dish.cuisine) - Number(x.cuisine === dish.cuisine)).slice(0, 4);
  return (
    <div className="space-y-4">
      <RecipeDetail r={r} lists={lists} cuisine={`${CUISINES[r.cuisine].flag} ${CUISINES[r.cuisine].label}`} meals={r.meal.map((m) => MEALS[m]).join(", ")} goals={r.goals.map((g) => GOALS[g])}
        top={
          <div className="space-y-3">
            <RecipeActions id={dish.id} liked={Boolean(me?.liked)} saved={Boolean(me?.saved)} likes={likes[dish.id] ?? 0} cooked={me?.cooked_count ?? 0} />
            {(dish.aOptions.length > 1 || (dish.bOptions?.length ?? 0) > 1) && (
              <div className="glass space-y-2 rounded-2xl p-3 text-sm" data-testid="variants">
                {dish.aOptions.length > 1 && <div className="flex flex-wrap items-center gap-2"><span className="w-24 text-ink-3">{phrase("Hlavní surovina")}</span>{dish.aOptions.map((a) => <Link key={a} href={href(a, r.bKey)} className={`rounded-full px-3 py-1 ${a === r.aKey ? "bg-gold text-[#1b1407]" : "bg-white/[0.06] hover:bg-white/10"}`}>{cap(phrase(ING[a].name))}</Link>)}</div>}
                {dish.bOptions && dish.bOptions.length > 1 && <div className="flex flex-wrap items-center gap-2"><span className="w-24 text-ink-3">{phrase("Příloha k jídlu")}</span>{dish.bOptions.map((b) => <Link key={b} href={href(r.aKey, b)} className={`rounded-full px-3 py-1 ${b === r.bKey ? "bg-gold text-[#1b1407]" : "bg-white/[0.06] hover:bg-white/10"}`}>{cap(phrase(ING[b].name))}</Link>)}</div>}
              </div>
            )}
          </div>
        } />
      {similar.length > 0 && (
        <section>
          <h2 className="mb-2 text-lg font-semibold">{COURSES[dish.course].emoji} {phrase("Podobné recepty")}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{similar.map((d) => <DishCard key={d.id} d={d} v={d.def} locked={false} likes={likes[d.id] ?? 0} />)}</div>
        </section>
      )}
    </div>
  );
}
