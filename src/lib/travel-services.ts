import "server-only";

/**
 * Externí služby pro cestování (bez API klíčů):
 * - kurzy ČNB (denní kurzovní lístek),
 * - geokódování míst přes OpenStreetMap Nominatim (pro mapu trasy).
 * Při nedostupnosti vrací null – aplikace funguje dál (kurz se zadá ručně, mapa bez bodu).
 */

const TIMEOUT = 6000;

export function parseCnbRates(txt: string): { date: string | null; rates: Record<string, number> } {
  const lines = txt.split(/\r?\n/).filter(Boolean);
  const m = /^(\d{2})\.(\d{2})\.(\d{4})/.exec(lines[0] ?? "");
  const rates: Record<string, number> = {};
  for (const line of lines.slice(2)) {
    const [, , amount, code, rate] = line.split("|");
    const a = Number(amount);
    const r = Number(String(rate).replace(",", "."));
    if (/^[A-Z]{3}$/.test(code ?? "") && a > 0 && r > 0) rates[code] = r / a;
  }
  return { date: m ? `${m[3]}-${m[2]}-${m[1]}` : null, rates };
}

const rateCache = new Map<string, { at: number; value: { date: string | null; rates: Record<string, number> } | null }>();

/** Kurz 1 jednotky měny v Kč k danému dni (ČNB vyhlašuje v pracovní dny, jinak platí poslední). */
export async function cnbRate(code: string, date: string): Promise<{ rate: number; date: string | null } | null> {
  if (code === "CZK") return { rate: 1, date };
  const key = date;
  let hit = rateCache.get(key);
  if (!hit || Date.now() - hit.at > 6 * 3600_000) {
    const d = `${date.slice(8, 10)}.${date.slice(5, 7)}.${date.slice(0, 4)}`;
    let value: { date: string | null; rates: Record<string, number> } | null = null;
    try {
      const r = await fetch(`https://www.cnb.cz/cs/financni-trhy/devizovy-trh/kurzy-devizoveho-trhu/kurzy-devizoveho-trhu/denni_kurz.txt?date=${d}`, { signal: AbortSignal.timeout(TIMEOUT) });
      if (r.ok) value = parseCnbRates(await r.text());
    } catch {
      value = null;
    }
    hit = { at: Date.now(), value };
    if (value) rateCache.set(key, hit);
  }
  const rate = hit.value?.rates[code];
  return rate ? { rate, date: hit.value!.date } : null;
}

const geoCache = new Map<string, { lat: number; lon: number } | null>();

export async function geocode(place: string): Promise<{ lat: number; lon: number } | null> {
  const q = place.trim().slice(0, 120);
  if (q.length < 2) return null;
  const key = q.toLowerCase();
  if (geoCache.has(key)) return geoCache.get(key)!;
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&accept-language=cs&q=${encodeURIComponent(q)}`, {
      headers: { "User-Agent": "HomeOS/1.0 (rodinne finance; cestovani)" },
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) return null;
    const json = (await r.json()) as { lat?: string; lon?: string }[];
    const hit = json[0] && Number.isFinite(Number(json[0].lat)) ? { lat: Number(json[0].lat), lon: Number(json[0].lon) } : null;
    geoCache.set(key, hit);
    return hit;
  } catch {
    return null;
  }
}
