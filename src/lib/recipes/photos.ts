/**
 * Jídla, která mají realistickou fotku v public/recipes/<id>.webp (vygenerovanou AI podle surovin).
 * Soubor přepisuje scripts/recipes/gen-photos.ts – ručně neupravovat.
 */
export const PHOTOS: ReadonlySet<string> = new Set<string>([]);
