"use server";
import { recipeById, amount } from "@/lib/recipes";
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
