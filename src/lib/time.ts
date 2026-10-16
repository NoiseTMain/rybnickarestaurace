/**
 * Práce s časem v pásmu Europe/Prague.
 * Server (např. Vercel) běží v UTC – proto se „dnešek“, otevírací doba
 * a časy přenosů vždy počítají explicitně pro Prahu.
 */
export const TZ = "Europe/Prague";

type Parts = { year: number; month: number; day: number; hour: number; minute: number; second: number; weekday: number };

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  weekday: "short",
});

/** Rozloží okamžik na složky pražského místního času. */
export function pragueParts(date: Date = new Date()): Parts {
  const out: Record<string, string> = {};
  for (const p of partsFormatter.formatToParts(date)) out[p.type] = p.value;
  return {
    year: Number(out.year),
    month: Number(out.month),
    day: Number(out.day),
    hour: Number(out.hour),
    minute: Number(out.minute),
    second: Number(out.second),
    weekday: WEEKDAYS[out.weekday] ?? 1,
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Dnešní datum v Praze ve formátu YYYY-MM-DD. */
export function pragueToday(now: Date = new Date()): string {
  const p = pragueParts(now);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Den v týdnu v Praze (1 = pondělí … 7 = neděle). */
export function pragueWeekday(now: Date = new Date()): number {
  return pragueParts(now).weekday;
}

/** Posun pražského času vůči UTC v minutách pro daný okamžik (+60 / +120). */
export function pragueOffsetMinutes(date: Date): number {
  const p = pragueParts(date);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/**
 * Převede pražský místní čas „YYYY-MM-DDTHH:mm“ (např. z <input type="datetime-local">)
 * na okamžik v UTC (ISO řetězec). Správně řeší přechody letního času.
 */
export function pragueLocalToUtcIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) throw new Error("Neplatný formát data a času");
  const [, y, mo, d, h, mi] = m.map(Number);
  const naive = Date.UTC(y, mo - 1, d, h, mi);
  let guess = naive - pragueOffsetMinutes(new Date(naive)) * 60000;
  // druhý průchod pro okamžiky těsně u změny času
  guess = naive - pragueOffsetMinutes(new Date(guess)) * 60000;
  return new Date(guess).toISOString();
}

/** Opak předchozího: okamžik → „YYYY-MM-DDTHH:mm“ v Praze (pro formuláře). */
export function utcIsoToPragueLocal(iso: string): string {
  const p = pragueParts(new Date(iso));
  return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
}

/** Kontrola formátu YYYY-MM-DD včetně platnosti data. */
export function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** Přičte dny ke kalendářnímu datu YYYY-MM-DD. */
export function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

const DAY_NAMES = ["", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota", "neděle"];
export const DAY_LABELS = ["", "Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek", "Sobota", "Neděle"];

/** „pátek 16. 10. 2026“ – pro kalendářní datum YYYY-MM-DD (bez posunu pásma). */
export function formatMenuDate(isoDate: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7;
  const base = `${d}. ${m}.${opts.year === false ? "" : ` ${y}`}`;
  return opts.weekday === false ? base : `${DAY_NAMES[weekday]} ${base}`;
}

const dateTimeFormatter = new Intl.DateTimeFormat("cs-CZ", {
  timeZone: TZ,
  day: "numeric",
  month: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** „16. 10. 2026 11:42“ v pražském čase. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return dateTimeFormatter.format(new Date(iso));
}

const timeFormatter = new Intl.DateTimeFormat("cs-CZ", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
export function formatTime(iso: string): string {
  return timeFormatter.format(new Date(iso));
}

/** Kalendářní datum (YYYY-MM-DD) okamžiku v Praze. */
export function pragueDateOf(iso: string): string {
  return pragueToday(new Date(iso));
}

/** Je podnik podle otevírací doby právě otevřený? null = doba není vyplněná. */
export function isOpenNow(
  hours: { day: number; closed: boolean; intervals: { open: string; close: string }[] }[],
  now: Date = new Date(),
): boolean | null {
  if (!hours.length) return null;
  const p = pragueParts(now);
  const minutes = p.hour * 60 + p.minute;
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const today = hours.find((h) => h.day === p.weekday);
  const yesterday = hours.find((h) => h.day === (p.weekday === 1 ? 7 : p.weekday - 1));
  // intervaly přes půlnoc (např. 17:00–01:00) z předchozího dne
  if (yesterday && !yesterday.closed) {
    for (const i of yesterday.intervals) {
      const o = toMin(i.open), c = toMin(i.close);
      if (c <= o && minutes < c) return true;
    }
  }
  if (!today || today.closed) return false;
  for (const i of today.intervals) {
    const o = toMin(i.open), c = toMin(i.close);
    if (c > o ? minutes >= o && minutes < c : minutes >= o) return true;
  }
  return false;
}

const SHORT_DAYS = ["", "po", "út", "st", "čt", "pá", "so", "ne"];
/** Zkratka dne v týdnu pro kalendářní datum YYYY-MM-DD („so“). */
export function shortWeekday(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  return SHORT_DAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay() || 7];
}

/** ISO okamžik posunutý o daný počet hodin od teď. */
export function isoHoursFromNow(hours: number): string {
  return new Date(Date.now() + hours * 3600 * 1000).toISOString();
}
