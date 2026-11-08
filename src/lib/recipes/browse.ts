import { DISHES, GOALS, type Dish, type Recipe } from "./index";

export interface DishFilter { course?: string; cuisine?: string; meal?: string; goal?: string; diet?: string; freeOnly?: boolean; q?: string }

const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Varianta jídla, která odpovídá filtru (dieta, cíl) – nebo null, když žádná. */
export function matchVariant(d: Dish, f: DishFilter, nameOf: (r: Recipe) => string): Recipe | null {
  if (f.course && d.course !== f.course) return null;
  if (f.cuisine && d.cuisine !== f.cuisine) return null;
  if (f.meal && !d.meal.includes(f.meal as never)) return null;
  if (f.freeOnly && !d.free) return null;
  const q = f.q ? fold(f.q) : "";
  const ok = d.variants.filter((r) =>
    (!f.goal || r.goals.includes(f.goal as never))
    && (!f.diet || r.diet === f.diet || (f.diet === "vegetariánské" && r.diet === "veganské"))
    && (!q || fold(nameOf(r)).includes(q) || fold(r.name).includes(q) || fold(d.title).includes(q) || r.ingredients.some((i) => fold(i.name).includes(q))));
  return ok.find((r) => r.id === d.def.id) ?? ok[0] ?? null;
}

/** Deterministické „náhodné“ číslo ze řetězce (tip dne se nemění při každém načtení). */
export function seeded(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return Math.abs(h);
}

/** Tip „Co dnes uvařit?“ – podle dne, pořadí a dostupnosti (Premium). */
export function dishOfDay(day: string, offset: number, premium: boolean): Dish {
  const pool = DISHES.filter((d) => (premium || d.free) && d.course !== "dezert" && d.course !== "svacina");
  return pool[(seeded(day) + offset * 7919) % pool.length];
}

/** Jídelníček na týden: 7 různých obědů/večeří z různých kuchyní a kategorií. */
export function weekPlan(seed: string, premium: boolean, diet?: string, goal?: string): Recipe[] {
  const pool = DISHES.filter((d) => (premium || d.free) && ["hlavni", "testoviny", "bowl", "polevka", "salat"].includes(d.course));
  const out: Recipe[] = [];
  const usedCuisine = new Map<string, number>();
  let i = seeded(seed);
  for (let guard = 0; out.length < 7 && guard < pool.length * 3; guard++) {
    const d = pool[i % pool.length];
    i = Math.imul(i ^ (i >>> 13), 1597334677) >>> 0;
    if (out.some((r) => r.dishId === d.id) || (usedCuisine.get(d.cuisine) ?? 0) >= 2) continue;
    const v = d.variants.find((r) => (!diet || r.diet === diet || (diet === "vegetariánské" && r.diet === "veganské")) && (!goal || r.goals.includes(goal as never)));
    if (!v) continue;
    out.push(v);
    usedCuisine.set(d.cuisine, (usedCuisine.get(d.cuisine) ?? 0) + 1);
  }
  return out;
}

export { GOALS };
