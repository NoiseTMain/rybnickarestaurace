import { describe, expect, it } from "vitest";
import { RECIPES, CUISINES, amount, recipeById } from "@/lib/recipes";
import { ING } from "@/lib/recipes/ingredients";

describe("recepty", () => {
  it("je jich přes 500 z 10 kuchyní, s unikátním id a správnými surovinami", () => {
    expect(RECIPES.length).toBeGreaterThanOrEqual(500);
    expect(new Set(RECIPES.map((r) => r.id)).size).toBe(RECIPES.length);
    expect(new Set(RECIPES.map((r) => r.cuisine)).size).toBe(Object.keys(CUISINES).length);
    for (const r of RECIPES) {
      for (const i of r.ingredients) expect(ING[i.key], `${r.id}: ${i.key}`).toBeTruthy();
      expect(r.steps.length).toBeGreaterThanOrEqual(2);
      expect(r.steps.join(" ")).not.toMatch(/\{a\}|\{b\}|undefined/);
      expect(r.kcal).toBeGreaterThan(100);
      expect(r.kcal).toBeLessThan(1400);
    }
    expect(RECIPES.filter((r) => r.free).length).toBeGreaterThanOrEqual(30);
  });
  it("makra odpovídají kaloriím (4/4/9 kcal na gram, ±15 %)", () => {
    for (const r of RECIPES) {
      const est = r.protein * 4 + r.carbs * 4 + r.fat * 9;
      expect(Math.abs(est - r.kcal) / r.kcal, r.id).toBeLessThan(0.15);
    }
  });
  it("výpočet konkrétního receptu a množství", () => {
    const r = recipeById("recky-salat-chicken-quinoa")!;
    expect(r.name).toBe("Řecký salát s kuřecím masem a quinoou");
    expect(r.diet).toBe("maso");
    expect(r.goals).toContain("protein");
    expect(amount(r.ingredients.find((i) => i.key === "chicken")!, 2)).toBe("300 g");
    expect(amount({ key: "eggs", name: "vejce", grams: 180, pieces: 3 }, 2)).toBe("6 ks");
  });
});

import { DISHES, COURSES, dishById, variantOf } from "@/lib/recipes";
import { matchVariant, weekPlan, dishOfDay } from "@/lib/recipes/browse";
describe("jídla, kategorie a jídelníček", () => {
  it("jídla se neopakují a každá kategorie je naplněná", () => {
    expect(DISHES.length).toBeGreaterThanOrEqual(170);
    expect(new Set(DISHES.map((d) => d.id)).size).toBe(DISHES.length);
    expect(new Set(DISHES.map((d) => d.title)).size).toBe(DISHES.length);
    for (const c of Object.keys(COURSES)) expect(DISHES.filter((d) => d.course === c).length, c).toBeGreaterThanOrEqual(8);
    expect(DISHES.filter((d) => d.free).length).toBeGreaterThanOrEqual(30);
  });
  it("varianta podle volby a podle filtru diety", () => {
    const d = dishById("gulas")!;
    expect(variantOf(d, "tofu", "bread").id).toBe("gulas-tofu-bread");
    expect(variantOf(d, "neexistuje", null).id).toBe(d.def.id);
    expect(matchVariant(d, { diet: "veganské" }, (r) => r.name)?.aKey).toBe("tofu");
    expect(matchVariant(d, { course: "dezert" }, (r) => r.name)).toBeNull();
  });
  it("jídelníček má 7 různých jídel a tip dne je stabilní", () => {
    const w = weekPlan("2026-11-x", true);
    expect(w).toHaveLength(7);
    expect(new Set(w.map((r) => r.dishId)).size).toBe(7);
    expect(weekPlan("2026-11-x", false).every((r) => r.free)).toBe(true);
    expect(dishOfDay("2026-11-09", 0, true).id).toBe(dishOfDay("2026-11-09", 0, true).id);
  });
});
