/**
 * Peněžní aritmetika v HALÉŘÍCH (celá čísla).
 *
 * Všechny částky v aplikaci i databázi jsou celé haléře (1 Kč = 100 h).
 * Nikdy nepracujeme s desetinnými čísly Kč – sčítání, odčítání i porovnání
 * probíhá nad celými čísly, takže nevznikají chyby typu 0.1 + 0.2.
 * Kontrolujeme, že výsledky zůstávají v rozsahu bezpečných celých čísel.
 */

export type Cents = number;

export class MoneyError extends Error {}

function assertSafe(n: number): Cents {
  if (!Number.isSafeInteger(n)) throw new MoneyError(`Částka mimo bezpečný rozsah: ${n}`);
  return n;
}

export function cents(n: number): Cents {
  if (!Number.isInteger(n)) throw new MoneyError(`Částka musí být v celých haléřích: ${n}`);
  return assertSafe(n);
}

export function add(...values: Cents[]): Cents {
  let total = 0;
  for (const v of values) total = assertSafe(total + cents(v));
  return total;
}

export function sub(a: Cents, b: Cents): Cents {
  return assertSafe(cents(a) - cents(b));
}

export function sum<T>(items: readonly T[], pick: (item: T) => Cents): Cents {
  let total = 0;
  for (const item of items) total = assertSafe(total + cents(pick(item)));
  return total;
}

export function neg(a: Cents): Cents {
  return a === 0 ? 0 : -cents(a);
}

export function abs(a: Cents): Cents {
  return Math.abs(cents(a));
}

export function max(...values: Cents[]): Cents {
  return Math.max(...values.map(cents));
}

export function min(...values: Cents[]): Cents {
  return Math.min(...values.map(cents));
}

export function clampZero(a: Cents): Cents {
  return a < 0 ? 0 : a;
}

/** Celočíselné dělení se zaokrouhlením dolů (k −∞). Pro limity – nikdy nenabídne víc, než je. */
export function divFloor(a: Cents, divisor: number): Cents {
  if (!Number.isInteger(divisor) || divisor === 0) throw new MoneyError("Neplatný dělitel");
  cents(a);
  return Math.floor(a / divisor);
}

/** Celočíselné dělení se zaokrouhlením na nejbližší (polovina od nuly). */
export function divRound(a: Cents, divisor: number): Cents {
  if (!Number.isInteger(divisor) || divisor === 0) throw new MoneyError("Neplatný dělitel");
  cents(a);
  const sign = (a < 0) !== (divisor < 0) ? -1 : 1;
  const absA = Math.abs(a);
  const absD = Math.abs(divisor);
  const q = Math.floor(absA / absD);
  const r = absA - q * absD;
  return sign * (r * 2 >= absD ? q + 1 : q);
}

/** Dělení se zaokrouhlením nahoru (k +∞). Pro „kolik musíme odložit“ – raději o haléř víc. */
export function divCeil(a: Cents, divisor: number): Cents {
  if (!Number.isInteger(divisor) || divisor <= 0) throw new MoneyError("Neplatný dělitel");
  cents(a);
  return Math.ceil(a / divisor);
}

/**
 * Násobení částky desetinným množstvím zadaným jako text („12,5“ km),
 * bez převodu na float: množství se převede na celé číslo × 10^d.
 */
export function mulQuantity(unitPrice: Cents, quantity: string | number): Cents {
  cents(unitPrice);
  const q = typeof quantity === "number" ? String(quantity) : quantity.trim().replace(",", ".");
  const m = /^(-?)(\d+)(?:\.(\d{1,4}))?$/.exec(q);
  if (!m) throw new MoneyError(`Neplatné množství: ${quantity}`);
  const decimals = m[3] ?? "";
  const scale = 10 ** decimals.length;
  const scaled = Number(m[2] + decimals) * (m[1] ? -1 : 1);
  return divRound(assertSafe(unitPrice * scaled), scale);
}

/** Procento a/b na 1 desetinné místo (pro zobrazení). */
export function percent(part: Cents, whole: Cents): number {
  if (whole === 0) return 0;
  return Math.round((part * 1000) / whole) / 10;
}

/**
 * Převede uživatelský vstup („1 234,50“, „1234.5“, „1 234 Kč“, „-50“) na haléře.
 * Vrací null, pokud vstup není platná částka. Nikdy nepoužívá parseFloat.
 */
export function parseMoney(input: string | null | undefined): Cents | null {
  if (input == null) return null;
  let s = String(input)
    .replace(/[\s  ]/g, "")
    .replace(/kč|czk|,-$/gi, "")
    .replace(/,-$/, "");
  if (s === "") return null;
  let sign = 1;
  if (s.startsWith("-") || s.startsWith("−")) {
    sign = -1;
    s = s.slice(1);
  } else if (s.startsWith("+")) s = s.slice(1);

  // „1,234“ / „1.234“ je nejednoznačné (tisíce, nebo desetinná místa?) → odmítnout
  if (/^\d{1,3}[.,]\d{3}$/.test(s)) return null;
  // oddělovač desetinných míst: poslední ',' nebo '.', za kterým jsou 1–2 číslice
  const m = /^(\d{1,3}(?:[.,']\d{3})+|\d+)(?:[.,](\d{1,2}))?$/.exec(s);
  if (!m) return null;
  const whole = m[1].replace(/[.,']/g, "");
  const frac = (m[2] ?? "").padEnd(2, "0");
  const value = Number(whole) * 100 + Number(frac);
  if (!Number.isSafeInteger(value)) return null;
  return sign * value || 0;
}

const czk = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const czk2 = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Formátování pro zobrazení: „12 345 Kč“, s haléři jen pokud nejsou nulové
 * (nebo vynuceně). Formátuje celé koruny a haléře zvlášť – žádné dělení floatem.
 */
export function formatMoney(value: Cents, opts: { decimals?: "auto" | "always" | "never"; sign?: boolean } = {}): string {
  cents(value);
  const decimals = opts.decimals ?? "auto";
  const negative = value < 0;
  const absV = Math.abs(value);
  const whole = Math.floor(absV / 100);
  const frac = absV % 100;
  let body: string;
  if (decimals === "never") {
    body = czk.format(Math.round(absV / 100));
  } else if (decimals === "always" || frac !== 0) {
    body = czk2.format(whole).replace(/,00$/, "") + "," + String(frac).padStart(2, "0");
  } else {
    body = czk.format(whole);
  }
  const prefix = negative ? "−" : opts.sign && value > 0 ? "+" : "";
  return `${prefix}${body} Kč`;
}

/** Hodnota pro <input> – „1234,5“ → „1234,50“; prázdné pro null. */
export function toInputValue(value: Cents | null | undefined): string {
  if (value == null) return "";
  const negative = value < 0;
  const absV = Math.abs(value);
  const whole = Math.floor(absV / 100);
  const frac = absV % 100;
  return `${negative ? "-" : ""}${whole}${frac ? "," + String(frac).padStart(2, "0") : ""}`;
}
