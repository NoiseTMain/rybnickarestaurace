import { ING } from "./ingredients";
import { A_GRAMS, B_GRAMS, BASES, COURSES, COURSE_OF, CUISINES, MEALS, type Base, type Course, type Cuisine, type Meal } from "./bases";
import { MORE_BASES } from "./bases-more";

export { COURSES, CUISINES, MEALS, ING };
export type { Course, Cuisine, Meal };

export interface RecipeIngredient { key: string; name: string; grams: number; pieces: number | null }
export interface Recipe {
  id: string;
  /** Jídlo, ke kterému varianta patří. */
  dishId: string;
  course: Course;
  /** Zvolená hlavní surovina a příloha (klíče do ING). */
  aKey: string;
  bKey: string | null;
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

/** Jídlo = jeden recept s variantami (hlavní surovina × příloha), aby se v seznamu nic neopakovalo. */
export interface Dish {
  id: string;
  title: string;
  cuisine: Cuisine;
  course: Course;
  meal: Meal[];
  time: number;
  free: boolean;
  variants: Recipe[];
  /** Výchozí varianta (první surovina a příloha). */
  def: Recipe;
  aOptions: string[];
  bOptions: string[] | null;
}

const ALL_BASES: Base[] = [...BASES, ...MORE_BASES];

function build(): Recipe[] {
  const out: Recipe[] = [];
  for (const b of ALL_BASES) {
    const course: Course = b.course ?? COURSE_OF[b.id] ?? "hlavni";
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
          id: `${b.id}-${a}${side ? `-${side}` : ""}`, dishId: b.id, course, aKey: a, bKey: side,
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
  // zdarma: každé 5. jídlo (rovnoměrně napříč kuchyněmi a kategoriemi) se všemi variantami
  const freeDish = new Set(ALL_BASES.filter((_, i) => i % 5 === 0).map((b) => b.id));
  out.forEach((r) => { r.free = freeDish.has(r.dishId); });
  return out;
}

export const RECIPES: Recipe[] = build();

export const DISHES: Dish[] = ALL_BASES.map((b) => {
  const variants = RECIPES.filter((r) => r.dishId === b.id);
  return { id: b.id, title: b.title, cuisine: b.cuisine, course: variants[0].course, meal: b.meal, time: b.time, free: variants[0].free, variants, def: variants[0], aOptions: b.a, bOptions: b.b };
});

export const dishById = (id: string) => DISHES.find((d) => d.id === id) ?? null;

/** Varianta jídla podle zvolené suroviny/přílohy (neplatná volba → výchozí). */
export function variantOf(d: Dish, a?: string | null, b?: string | null): Recipe {
  return d.variants.find((v) => v.aKey === (a || d.def.aKey) && v.bKey === (b ?? d.def.bKey)) ?? d.variants.find((v) => v.aKey === a) ?? d.def;
}

export { recipeName, recipeSteps } from "./localize";
/** Varianta podle id (nebo výchozí varianta jídla, když je id jen jídlo). */
export const recipeById = (id: string) => RECIPES.find((r) => r.id === id) ?? dishById(id)?.def ?? null;

export const GOALS: Record<Recipe["goals"][number], string> = {
  hubnuti: "Na hubnutí (do 500 kcal)", nabirani: "Na nabírání (650+ kcal)", protein: "Vysoký protein (30+ g)", lowcarb: "Málo sacharidů", rychle: "Do 20 minut",
};

export { amount } from "./amount";
