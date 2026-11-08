/**
 * Rozpoznání údajů z textu účtenky (OCR): celková částka, měna, datum, obchod.
 * Výsledek je jen návrh – uživatel ho vždy zkontroluje a potvrdí.
 */
export interface ReceiptGuess {
  amount: number | null; // v setinách měny
  currency: string | null;
  date: string | null; // YYYY-MM-DD
  merchant: string | null;
}

const TOTAL = /(celkem|k\s*úhradě|k\s*uhrade|total|summe|gesamt|suma|razem|ukupno|ukupan|totale|összesen|osszesen|zaplaceno|amount\s*due|to\s*pay)/i;
const CURRENCY: [RegExp, string][] = [
  [/\b(eur|euro)\b|€/i, "EUR"], [/(?<![a-zá-ž])(kč|kc|czk)(?![a-zá-ž])/i, "CZK"], [/(?<![a-zá-ž])(pln|zł|zl)(?![a-zá-ž])/i, "PLN"], [/\b(huf|ft)\b/i, "HUF"],
  [/\b(chf)\b/i, "CHF"], [/\b(gbp)\b|£/i, "GBP"], [/\b(usd)\b|\$/i, "USD"], [/\b(hrk|kn)\b/i, "HRK"], [/\b(ron|lei)\b/i, "RON"],
];

function parseAmount(s: string): number | null {
  // 1 234,56 / 1.234,56 / 1,234.56 / 23,20 / 23.2
  const m = s.match(/(\d{1,3}(?:[ . ']\d{3})*(?:[.,]\d{1,2})|\d+(?:[.,]\d{1,2})?)/g);
  if (!m) return null;
  const raw = m[m.length - 1];
  const dec = /[.,]\d{1,2}$/.exec(raw);
  const intPart = (dec ? raw.slice(0, dec.index) : raw).replace(/[ . ',]/g, "");
  const cents = dec ? Number(dec[0].slice(1).padEnd(2, "0")) : 0;
  const v = Number(intPart) * 100 + cents;
  return Number.isFinite(v) && v > 0 && v < 100_000_000 ? v : null;
}

export function parseReceipt(text: string): ReceiptGuess {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let amount: number | null = null;
  // poslední řádek se slovem „celkem/total…“ a číslem
  for (let i = lines.length - 1; i >= 0 && amount == null; i--) {
    if (TOTAL.test(lines[i])) amount = parseAmount(lines[i]) ?? (lines[i + 1] ? parseAmount(lines[i + 1]) : null);
  }
  if (amount == null) {
    // nejvyšší částka s desetinnými místy jako záloha
    const all = lines.flatMap((l) => (l.match(/\d+[.,]\d{2}\b/g) ?? []).map((x) => parseAmount(x) ?? 0));
    amount = all.length ? Math.max(...all) : null;
  }
  let currency: string | null = null;
  for (const [re, code] of CURRENCY) if (re.test(text)) { currency = code; break; }
  let date: string | null = null;
  const d = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
  if (d) {
    const y = d[3].length === 2 ? 2000 + Number(d[3]) : Number(d[3]);
    const mo = Number(d[2]), da = Number(d[1]);
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31 && y >= 2000 && y <= 2100) date = `${y}-${String(mo).padStart(2, "0")}-${String(da).padStart(2, "0")}`;
  }
  const merchant = lines.find((l) => /[a-zá-ž]{3,}/i.test(l) && !/^(dič|ičo|ič|dic|ico|vat|uid|tel|www|http)/i.test(l) && !TOTAL.test(l))?.slice(0, 80) ?? null;
  return { amount, currency, date, merchant };
}
