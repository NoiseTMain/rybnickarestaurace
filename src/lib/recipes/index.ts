import { ING } from "./ingredients";
import { A_GRAMS, B_GRAMS, BASES, CUISINES, MEALS, type Cuisine, type Meal } from "./bases";

export { CUISINES, MEALS, ING };
export type { Cuisine, Meal };

export interface RecipeIngredient { key: string; name: string; grams: number; pieces: number | null }
export interface Recipe {
  id: string;
  name: string;
  cuisine: Cuisine;
  meal: Meal[];
  time: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  /** Části názvu (titulek, „s …“, „a …“) a šablony kroků – pro překlad. */
  nameParts: string[];
  stepParts: { tpls: string[]; a: string; b: string };
  /** Na 1 porci. */
  kcal: number; protein: number; carbs: number; fat: number;
  /** Orientační cena 1 porce v haléřích. */
  price: number;
  diet: "maso" | "ryby" | "vegetariánské" | "veganské";
  goals: ("hubnuti" | "nabirani" | "protein" | "lowcarb" | "rychle")[];
  free: boolean;
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function build(): Recipe[] {
  const out: Recipe[] = [];
  for (const b of BASES) {
    for (const a of b.a) {
      for (const side of b.b ?? [null]) {
        const A = ING[a];
        const B = side ? ING[side] : null;
        const parts: [string, number][] = [[a, A_GRAMS[a] ?? 120], ...(side ? [[side, B_GRAMS[side] ?? 80] as [string, number]] : []), ...b.base];
        // sloučit duplicity (např. vejce jako hlavní i v základu)
        const merged = new Map<string, number>();
        for (const [k, g] of parts) merged.set(k, (merged.get(k) ?? 0) + g);
        const ingredients = [...merged.entries()].map(([key, grams]) => {
          const i = ING[key];
          return { key, name: i.name, grams, pieces: i.piece ? Math.max(1, Math.round(grams / i.piece)) : null };
        });
        let kcal = 0, p = 0, c = 0, f = 0, price = 0;
        for (const { key, grams } of ingredients) {
          const i = ING[key];
          kcal += (i.kcal * grams) / 100; p += (i.p * grams) / 100; c += (i.c * grams) / 100; f += (i.f * grams) / 100;
          price += i.price * grams / 10; // Kč/kg × g / 1000 × 100 haléřů
        }
        const tags = ingredients.flatMap((x) => ING[x.key].tags ?? []);
        const meat = tags.includes("meat"), fish = tags.includes("fish");
        const animal = tags.includes("dairy") || ingredients.some((x) => x.key === "honey" || x.key === "eggs" || x.key === "egg_whites");
        const diet = meat ? "maso" : fish ? "ryby" : animal ? "vegetariánské" : "veganské";
        const aWord = A.acc ?? A.name, bWord = B?.acc ?? B?.name ?? "přílohu";
        const fill = (s: string) => cap(s.replaceAll("{a}", aWord).replaceAll("{b}", bWord));
        const tpls = [A.prep, B?.prep, ...b.steps].filter((x): x is string => Boolean(x));
        const steps = tpls.map(fill);
        const nameParts = [b.title, A.with ?? `s ${A.name}`, ...(B ? [B.and ?? `a ${B.name}`] : [])];
        const r = {
          id: `${b.id}-${a}${side ? `-${side}` : ""}`,
          name: `${b.title} ${A.with ?? `s ${A.name}`}${B ? ` ${B.and ?? `a ${B.name}`}` : ""}`,
          cuisine: b.cuisine, meal: b.meal, time: b.time, ingredients, steps, nameParts, stepParts: { tpls, a: aWord, b: bWord },
          kcal: Math.round(kcal), protein: Math.round(p), carbs: Math.round(c), fat: Math.round(f), price: Math.round(price),
          diet: diet as Recipe["diet"], goals: [] as Recipe["goals"], free: false,
        };
        if (r.kcal <= 500) r.goals.push("hubnuti");
        if (r.kcal >= 650) r.goals.push("nabirani");
        if (r.protein >= 30) r.goals.push("protein");
        if (r.carbs <= 25) r.goals.push("lowcarb");
        if (r.time <= 20) r.goals.push("rychle");
        out.push(r);
      }
    }
  }
  // zdarma: každý 15. recept (rovnoměrně napříč kuchyněmi), ostatní v Premium
  out.forEach((r, i) => { r.free = i % 15 === 0; });
  return out;
}

export const RECIPES: Recipe[] = build();

export { recipeName, recipeSteps } from "./localize";
export const recipeById = (id: string) => RECIPES.find((r) => r.id === id) ?? null;

export const GOALS: Record<Recipe["goals"][number], string> = {
  hubnuti: "Na hubnutí (do 500 kcal)", nabirani: "Na nabírání (650+ kcal)", protein: "Vysoký protein (30+ g)", lowcarb: "Málo sacharidů", rychle: "Do 20 minut",
};

export { amount } from "./amount";
