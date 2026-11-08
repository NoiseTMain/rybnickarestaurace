import { notFound } from "next/navigation";
import { requireContext } from "@/lib/context";
import { getPremium } from "@/lib/premium";
import { CUISINES, GOALS, MEALS, recipeById } from "@/lib/recipes";
import { PremiumWall } from "@/components/premium/PremiumWall";
import { RecipeDetail } from "@/components/recipes/RecipeDetail";

export const metadata = { title: "Recept" };

export default async function RecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const r = recipeById(id);
  if (!r) notFound();
  const ctx = await requireContext();
  if (!r.free && !(await getPremium(ctx)).household) return <PremiumWall title={r.name}>Tento recept je součástí Premium – spolu s dalšími stovkami fitness receptů z 10 kuchyní.</PremiumWall>;
  const lists = (await ctx.store.select("shopping_lists", { household_id: ctx.household.id })).filter((l) => l.status === "open").map((l) => ({ id: l.id, name: l.name }));
  return <RecipeDetail r={r} lists={lists} cuisine={`${CUISINES[r.cuisine].flag} ${CUISINES[r.cuisine].label}`} meals={r.meal.map((m) => MEALS[m]).join(", ")} goals={r.goals.map((g) => GOALS[g])} />;
}
