"use server";
import { amount, dishById, recipeById } from "@/lib/recipes";
import { ING } from "@/lib/recipes/ingredients";
import { premiumError } from "@/lib/premium";
import { z } from "zod";
import { enumOf, optText, optionalUuid, text } from "@/lib/validation";
import { parseIngredientLines, scaleAmount } from "@/lib/recipes/custom";
import { done, fail, own, parse, withContext } from "./helpers";
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

/** Lajk / uložení receptu (přepínač). Uložené recepty jsou pod ikonou záložky. */
export async function toggleRecipe(recipeId: string, field: "liked" | "saved"): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (!dishById(String(recipeId))) return fail("Recept neexistuje.");
    if (field !== "liked" && field !== "saved") return fail("Neplatná akce.");
    const [cur] = await ctx.store.select("recipe_reactions", { user_id: ctx.user.id, recipe_id: recipeId });
    const value = !(cur?.[field] ?? false);
    if (cur) await ctx.store.update("recipe_reactions", { id: cur.id, user_id: ctx.user.id } as never, { [field]: value } as never);
    else await ctx.store.insert("recipe_reactions", [{ user_id: ctx.user.id, recipe_id: recipeId, liked: field === "liked", saved: field === "saved", cooked_count: 0, last_cooked_at: null, note: null } as never]);
    return done(field === "liked" ? (value ? "Líbí se vám ❤️" : "Lajk odebrán") : value ? "Recept uložen 🔖" : "Odebráno z uložených");
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

const optInt = (min: number, max: number) => z.preprocess((v) => (v === "" || v == null ? null : Number(String(v).replace(",", "."))), z.union([z.null(), z.number().int("Zadejte celé číslo").min(min, `Minimálně ${min}`).max(max, `Maximálně ${max}`)]));
const customSchema = z.object({
  id: optionalUuid(),
  title: text(120).refine((v) => v.length >= 2, "Nejméně 2 znaky"),
  course: enumOf(["snidane", "polevka", "salat", "bowl", "testoviny", "hlavni", "svacina", "dezert"]),
  time_min: optInt(1, 1440),
  servings: z.preprocess((v) => (v === "" || v == null ? 2 : Number(v)), z.number().int().min(1, "Minimálně 1").max(20, "Maximálně 20")),
  kcal: optInt(0, 5000),
  ingredients: z.string().max(6000, "Moc dlouhý seznam surovin").default(""),
  steps: optText(8000),
  note: optText(1000),
  photo_document_id: optionalUuid(),
});

/** Vlastní recept domácnosti (Premium) – nový nebo úprava. */
export async function saveCustomRecipe(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const err = await premiumError(ctx, "Vlastní recepty");
    if (err) return fail(err);
    const p = parse(customSchema, fd);
    if (!p.ok) return p.result;
    const { id, ingredients, ...rest } = p.data;
    const ing = parseIngredientLines(ingredients);
    if (!ing.length) return fail("Zkontrolujte zvýrazněná pole.", { ingredients: "Napište aspoň jednu surovinu" });
    if (ing.length > 60) return fail("Zkontrolujte zvýrazněná pole.", { ingredients: "Nejvýše 60 surovin" });
    await own(ctx, "documents", rest.photo_document_id);
    const row = { ...rest, ingredients: ing };
    if (id) {
      await own(ctx, "custom_recipes", id);
      await ctx.store.update("custom_recipes", { id, household_id: ctx.household.id }, row);
      return done("Recept upraven", id);
    }
    const [r] = await ctx.store.insert("custom_recipes", [{ ...row, household_id: ctx.household.id, created_by: ctx.user.id }]);
    return done("Recept uložen mezi vaše recepty 👩‍🍳", r.id);
  });
}

export async function deleteCustomRecipe(id: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await own(ctx, "custom_recipes", id);
    await ctx.store.remove("custom_recipes", { id, household_id: ctx.household.id });
    return done("Recept smazán");
  });
}

/** Suroviny vlastního receptu do nákupního seznamu (přepočet podle porcí, když jde množství přepočítat). */
export async function addCustomToList(id: string, servings: number, listId: string | null): Promise<ActionResult> {
  return withContext(async (ctx) => {
    const r = await own(ctx, "custom_recipes", id);
    if (!r) return fail("Recept neexistuje.");
    const n = Math.min(20, Math.max(1, Math.round(Number(servings) || r.servings)));
    const h = ctx.household.id;
    let lid = listId;
    if (lid) {
      const l = await own(ctx, "shopping_lists", lid);
      if (l && (l as { status: string }).status === "done") return fail("Seznam je už nakoupený.");
    } else {
      const [l] = await ctx.store.insert("shopping_lists", [{ household_id: h, name: r.title.slice(0, 120), planned_date: null, status: "open", note: `Vlastní recept – ${n} ${n === 1 ? "porce" : n < 5 ? "porce" : "porcí"}` }]);
      lid = l.id;
    }
    const existing = await ctx.store.select("shopping_items", { household_id: h, list_id: lid! });
    await ctx.store.insert("shopping_items", r.ingredients.map((i, k) => ({
      household_id: h, list_id: lid!, name: i.name.slice(0, 120), quantity: scaleAmount(i.amount, n / r.servings).slice(0, 30) || null,
      est_price: null, store: null, checked: false, sort: existing.length + k,
    })));
    return done(`Suroviny přidány do nákupního seznamu (${r.ingredients.length})`, lid!);
  });
}
