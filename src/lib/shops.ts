/** Obchody pro nákupní seznam + ověřené odkazy na letáky (kupi.cz) a nákup (rohlik.cz). */
export const STORES = [
  { key: "Lidl", kupi: "lidl" },
  { key: "Albert", kupi: "albert" },
  { key: "Kaufland", kupi: "kaufland" },
  { key: "Billa", kupi: "billa" },
  { key: "Penny", kupi: "penny-market" },
  { key: "Tesco", kupi: "tesco" },
  { key: "Globus", kupi: "globus" },
  { key: "Norma", kupi: "norma" },
  { key: "Rohlík.cz", kupi: null },
  { key: "Košík.cz", kupi: null },
] as const;

export const kupiLeafletUrl = (slug: string) => `https://www.kupi.cz/letaky/${slug}`;
export const kupiSearchUrl = (q: string) => `https://www.kupi.cz/hledej?f=${encodeURIComponent(q)}`;
export const rohlikSearchUrl = (q: string) => `https://www.rohlik.cz/hledat?q=${encodeURIComponent(q)}`;

/** Normalizovaný klíč položky pro cenovou paměť („Brambory 1kg“ = „brambory“). */
export function itemKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\d+([.,]\d+)?\s*(kg|g|l|ml|ks|bal\.?|x)\b/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}
