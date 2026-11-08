import { phrase } from "@/lib/i18n/phrase";

/** Jen to, co potřebuje překlad – bez celé databáze receptů (bezpečné i pro klienta). */
interface Localizable { nameParts: string[]; stepParts: { tpls: string[]; a: string; b: string } }
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Název receptu v jazyce uživatele (skládá se z přeložených částí). */
export function recipeName(r: Localizable): string {
  return r.nameParts.map((p) => phrase(p)).join(" ");
}
/** Postup v jazyce uživatele: šablona kroku se přeloží a doplní přeloženými surovinami. */
export function recipeSteps(r: Localizable): string[] {
  const a = phrase(r.stepParts.a), b = phrase(r.stepParts.b);
  return r.stepParts.tpls.map((t) => cap(phrase(t).replaceAll("{a}", a).replaceAll("{b}", b)));
}
