"use server";
import { amount, dishById, recipeById } from "@/lib/recipes";
import { ING } from "@/lib/recipes/ingredients";
import { premiumError } from "@/lib/premium";
import { done, fail, own, withContext } from "./helpers";
import type { ActionResult } from "./result";

/** Přidá suroviny receptu do nákupního seznamu (existujícího, nebo nového) s orientační cenou. */
export async function addRecipeToList(recipeId: string, servings: number, listId: string | null): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const r = recipeById(String(recipeId));
    if (!r) return fail("Recept neexistuje.");
    if (!r.free) { const err = await premiumError(ctx, "Tento recept"); if (err) return fail(err); }
    const n = Math.min(20, Math.max(1, Math.round(Number(servings) || 1)));
    const h = ctx.household.id;
    let id = listId;
    if (id) {
      const l = await own(ctx, "shopping_lists", id);
      if (l && (l as { status: string }).status === "done") return fail("Seznam je už nakoupený.");
    } else {
      const [l] = await ctx.store.insert("shopping_lists", [{ household_id: h, name: `${r.name}`.slice(0, 120), planned_date: null, status: "open", note: `Recept – ${n} ${n === 1 ? "porce" : n < 5 ? "porce" : "porcí"}` }]);
      id = l.id;
    }
    const existing = await ctx.store.select("shopping_items", { household_id: h, list_id: id! });
    // koření, olej a podobné drobnosti se v nákupu nepočítají po gramech – jen připomenutí
    const pantry = new Set(["spices", "olive_oil", "soy_sauce", "honey", "garlic", "herbs", "lemon", "lime", "mustard", "sesame", "curry_paste", "chili", "ginger"]);
    await ctx.store.insert("shopping_items", r.ingredients.map((i, k) => ({
      household_id: h, list_id: id!, name: ING[i.key].name.slice(0, 120), quantity: amount(i, n).slice(0, 30),
      est_price: pantry.has(i.key) ? null : Math.max(100, Math.round(ING[i.key].price * i.grams * n / 10)), store: null, checked: false, sort: existing.length + k,
    })));
    return done(`Suroviny přidány do nákupního seznamu (${r.ingredients.length})`, id!);
  });
}

/** Lajk / uložení receptu (přepínač). Uložené recepty jsou v „Moje recepty“. */
export async function toggleRecipe(recipeId: string, field: "liked" | "saved"): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (!dishById(String(recipeId))) return fail("Recept neexistuje.");
    if (field !== "liked" && field !== "saved") return fail("Neplatná akce.");
    const [cur] = await ctx.store.select("recipe_reactions", { user_id: ctx.user.id, recipe_id: recipeId });
    const value = !(cur?.[field] ?? false);
    if (cur) await ctx.store.update("recipe_reactions", { id: cur.id, user_id: ctx.user.id } as never, { [field]: value } as never);
    else await ctx.store.insert("recipe_reactions", [{ user_id: ctx.user.id, recipe_id: recipeId, liked: field === "liked", saved: field === "saved", cooked_count: 0, last_cooked_at: null, note: null } as never]);
    return done(field === "liked" ? (value ? "Líbí se vám ❤️" : "Lajk odebrán") : value ? "Uloženo do Moje recepty" : "Odebráno z Moje recepty");
  });
}

/** „Uvařil(a) jsem“ – počítadlo a datum, aby šlo vidět, co vaříte nejčastěji. */
export async function markCooked(recipeId: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (!dishById(String(recipeId))) return fail("Recept neexistuje.");
    const today = new Date().toISOString().slice(0, 10);
    const [cur] = await ctx.store.select("recipe_reactions", { user_id: ctx.user.id, recipe_id: recipeId });
    if (cur) await ctx.store.update("recipe_reactions", { id: cur.id, user_id: ctx.user.id } as never, { cooked_count: cur.cooked_count + 1, last_cooked_at: today } as never);
    else await ctx.store.insert("recipe_reactions", [{ user_id: ctx.user.id, recipe_id: recipeId, liked: false, saved: false, cooked_count: 1, last_cooked_at: today, note: null } as never]);
    return done("Dobrou chuť! Zapsáno jako uvařené 🍽️");
  });
}

/** Týdenní jídelníček: suroviny vybraných receptů sečtené do jednoho nákupního seznamu. */
export async function addWeekPlan(recipeIds: string[], servings: number): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const ids = [...new Set(recipeIds.map(String))].slice(0, 14);
    const recipes = ids.map((id) => recipeById(id)).filter((r): r is NonNullable<typeof r> => Boolean(r));
    if (!recipes.length) return fail("Vyberte aspoň jeden recept.");
    if (recipes.some((r) => !r.free)) { const err = await premiumError(ctx, "Jídelníček s recepty Premium"); if (err) return fail(err); }
    const n = Math.min(10, Math.max(1, Math.round(Number(servings) || 2)));
    const total = new Map<string, number>();
    for (const r of recipes) for (const i of r.ingredients) total.set(i.key, (total.get(i.key) ?? 0) + i.grams);
    const h = ctx.household.id;
    const [l] = await ctx.store.insert("shopping_lists", [{ household_id: h, name: `Jídelníček (${recipes.length} jídel)`, planned_date: null, status: "open", note: recipes.map((r) => r.name).join(", ").slice(0, 500) }]);
    const pantry = new Set(["spices", "olive_oil", "soy_sauce", "honey", "garlic", "herbs", "lemon", "lime", "mustard", "sesame", "curry_paste", "chili", "ginger"]);
    await ctx.store.insert("shopping_items", [...total.entries()].map(([key, grams], k) => ({
      household_id: h, list_id: l.id, name: ING[key].name.slice(0, 120), quantity: amount({ key, name: ING[key].name, grams, pieces: ING[key].piece ? Math.max(1, Math.round(grams / ING[key].piece!)) : null }, n).slice(0, 30),
      est_price: pantry.has(key) ? null : Math.max(100, Math.round(ING[key].price * grams * n / 10)), store: null, checked: false, sort: k,
    })));
    return done(`Jídelníček je v nákupním seznamu (${total.size} surovin)`, l.id);
  });
}
