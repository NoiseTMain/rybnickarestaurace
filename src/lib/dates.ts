/**
 * Data jako řetězce „YYYY-MM-DD“ (kalendářní dny, bez časové zóny).
 * Dnešní datum se určuje v časové zóně Europe/Prague, aby se na serveru
 * v UTC neposunul den kolem půlnoci.
 */

export type ISODate = string;

export const TIME_ZONE = "Europe/Prague";

const ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isISODate(s: unknown): s is ISODate {
  if (typeof s !== "string") return false;
  const m = ISO_RE.exec(s);
  if (!m) return false;
  const y = +m[1], mo = +m[2], d = +m[3];
  return mo >= 1 && mo <= 12 && d >= 1 && d <= daysInMonth(y, mo);
}

export function todayISO(now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function parts(d: ISODate): { y: number; m: number; d: number } {
  const m = ISO_RE.exec(d);
  if (!m) throw new Error(`Neplatné datum: ${d}`);
  return { y: +m[1], m: +m[2], d: +m[3] };
}

export function make(y: number, m: number, d: number): ISODate {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function daysInMonth(y: number, m: number): number {
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

function toUTC(d: ISODate): number {
  const p = parts(d);
  return Date.UTC(p.y, p.m - 1, p.d);
}

function fromUTC(ms: number): ISODate {
  const dt = new Date(ms);
  return make(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate());
}

export function addDays(d: ISODate, n: number): ISODate {
  return fromUTC(toUTC(d) + n * 86_400_000);
}

/** Přičte měsíce; den se omezí na poslední den cílového měsíce (31. 1. + 1 = 28./29. 2.). */
export function addMonths(d: ISODate, n: number, anchorDay?: number): ISODate {
  const p = parts(d);
  const total = p.y * 12 + (p.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  const day = Math.min(anchorDay ?? p.d, daysInMonth(y, m));
  return make(y, m, day);
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTC(b) - toUTC(a)) / 86_400_000);
}

export function startOfMonth(d: ISODate): ISODate {
  const p = parts(d);
  return make(p.y, p.m, 1);
}

export function endOfMonth(d: ISODate): ISODate {
  const p = parts(d);
  return make(p.y, p.m, daysInMonth(p.y, p.m));
}

export function monthKey(d: ISODate): string {
  return d.slice(0, 7);
}

/** Pondělí týdne, ve kterém leží datum. */
export function startOfWeek(d: ISODate): ISODate {
  const dow = new Date(toUTC(d)).getUTCDay(); // 0 = neděle
  const offset = (dow + 6) % 7;
  return addDays(d, -offset);
}

export function endOfWeek(d: ISODate): ISODate {
  return addDays(startOfWeek(d), 6);
}

export function minDate(a: ISODate, b: ISODate): ISODate {
  return a < b ? a : b;
}

export function maxDate(a: ISODate, b: ISODate): ISODate {
  return a > b ? a : b;
}

export function inRange(d: ISODate, from: ISODate, to: ISODate): boolean {
  return d >= from && d <= to;
}

/** Kladný počet celých měsíců mezi dvěma daty (pro termíny cílů). */
export function monthsBetween(from: ISODate, to: ISODate): number {
  const a = parts(from), b = parts(to);
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months -= 1;
  return months;
}

const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];
const MONTHS_GEN = ["ledna", "února", "března", "dubna", "května", "června", "července", "srpna", "září", "října", "listopadu", "prosince"];
const WEEKDAYS = ["ne", "po", "út", "st", "čt", "pá", "so"];

export function formatDate(d: ISODate | null | undefined, style: "short" | "long" | "day" = "short"): string {
  if (!d) return "—";
  const p = parts(d);
  if (style === "long") return `${p.d}. ${MONTHS_GEN[p.m - 1]} ${p.y}`;
  if (style === "day") return `${WEEKDAYS[new Date(toUTC(d)).getUTCDay()]} ${p.d}. ${p.m}.`;
  return `${p.d}. ${p.m}. ${p.y}`;
}

export function monthName(d: ISODate, withYear = true): string {
  const p = parts(d);
  const name = MONTHS[p.m - 1];
  return withYear ? `${name} ${p.y}` : name;
}

export function shortMonth(d: ISODate): string {
  const p = parts(d);
  return `${MONTHS[p.m - 1].slice(0, 3)} ${String(p.y).slice(2)}`;
}

export function weekday(d: ISODate): number {
  return new Date(toUTC(d)).getUTCDay();
}

/** Parsuje „31. 12. 2026“, „31.12.26“, „2026-12-31“ → ISO, jinak null. */
export function parseCzechDate(input: string | null | undefined): ISODate | null {
  if (!input) return null;
  const s = input.trim();
  if (isISODate(s)) return s;
  const m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{2}|\d{4})$/.exec(s);
  if (!m) return null;
  let y = +m[3];
  if (y < 100) y += 2000;
  const iso = make(y, +m[2], +m[1]);
  return isISODate(iso) ? iso : null;
}
