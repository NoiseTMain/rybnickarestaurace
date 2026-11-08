/** Pomůcky pro vlastní recepty: rozpoznání „200 g kuřecí prsa“ a přepočet množství podle porcí. */

const UNIT = "(?:g|kg|dkg|ml|dl|l|ks|kus(?:y|ů)?|lžíc(?:e|í)?|lžičk(?:a|y|ek)|hrnk(?:y|ů)|hrnek|hrst(?:i)?|špetk(?:a|y)|stroužk(?:y|ů)|stroužek|plátk(?:y|ů)|plátek|balení|konzerv(?:a|y)|pl|čl|tsp|tbsp|cup|cups|pcs)\\.?";
const LINE = new RegExp(`^((?:\\d+(?:[.,]\\d+)?|\\d+/\\d+|½|¼|¾)(?:\\s*[-–]\\s*\\d+(?:[.,]\\d+)?)?\\s*(?:${UNIT})?)\\s+(.+)$`, "i");

/** Jeden řádek = jedna surovina. Množství na začátku řádku se oddělí (např. „2 lžíce oleje“). */
export function parseIngredientLines(text: string): { name: string; amount: string }[] {
  return text.split(/\r?\n/).map((l) => l.replace(/^[-•*·\s]+/, "").trim()).filter(Boolean).map((l) => {
    const m = l.match(LINE);
    const name = (m ? m[2] : l).trim().slice(0, 120);
    return { name, amount: m ? m[1].trim().slice(0, 30) : "" };
  }).filter((i) => i.name.length > 0);
}

const FRAC: Record<string, number> = { "½": 0.5, "¼": 0.25, "¾": 0.75 };

/** „200 g“ × 1,5 → „300 g“. Když množství nejde přepočítat, vrátí původní text. */
export function scaleAmount(amount: string, k: number): string {
  if (!amount || Math.abs(k - 1) < 1e-9) return amount;
  const m = amount.match(/^(\d+(?:[.,]\d+)?|\d+\/\d+|[½¼¾])(.*)$/);
  if (!m || /[-–]/.test(m[2])) return amount;
  const raw = m[1];
  const v = FRAC[raw] ?? (raw.includes("/") ? Number(raw.split("/")[0]) / Number(raw.split("/")[1]) : Number(raw.replace(",", ".")));
  if (!Number.isFinite(v)) return amount;
  const x = v * k;
  const nice = x >= 10 ? Math.round(x) : Math.round(x * 10) / 10;
  return `${String(nice).replace(".", ",")}${m[2]}`;
}
