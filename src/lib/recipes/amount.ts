import { ING } from "./ingredients";
import type { RecipeIngredient } from "./index";

/** Množství na N porcí (g, nebo kusy, je-li to přirozenější). */
export function amount(i: RecipeIngredient, servings: number): string {
  const g = i.grams * servings;
  const ing = ING[i.key];
  if (ing.piece) {
    const pcs = Math.round((g / ing.piece) * 2) / 2;
    if (pcs >= 0.5) return `${pcs.toLocaleString("cs-CZ")} ks`;
  }
  return g >= 1000 ? `${(g / 1000).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} kg` : `${Math.round(g)} g`;
}
