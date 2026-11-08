/**
 * Překlad celé aplikace: každý český text (popisek, tlačítko, hláška) se při vykreslení
 * přeloží podle slovníku (klíčem je český originál). Volá ho vlastní JSX runtime (./jsx),
 * takže funguje na serveru i v prohlížeči stejně – bez probliknutí a bez chyb hydratace.
 */

export type PhraseLocale = "cs" | "sk" | "en";
interface Raw { exact: Record<string, string>; patterns: [string, string][] }
interface Compiled { exact: Map<string, string>; byFirst: Map<string, { re: RegExp; out: string }[]>; loose: { re: RegExp; out: string }[] }

const firstWord = (s: string) => s.trim().split(/\s+/)[0]?.toLowerCase() ?? "";
function compile(raw: Raw): Compiled {
  const exact = new Map(Object.entries(raw.exact));
  const byFirst = new Map<string, { re: RegExp; out: string }[]>();
  const loose: { re: RegExp; out: string }[] = [];
  for (const [src, outRaw] of raw.patterns) {
    let out = outRaw;
    // {0} = cokoli (i prázdné), {0:d} = datum „10. 11.“ / „10. 11. 2026“, {0:n} = číslo
    const parts = src.split(/\{\d+(?::[dn])?\}/);
    const kinds = [...src.matchAll(/\{\d+(?::([dn]))?\}/g)].map((m) => m[1]);
    const group = (k?: string) => (k === "d" ? "(\\d{1,2}\\. ?\\d{1,2}\\.(?: ?\\d{4})?)" : k === "n" ? "([\\d\\s\u00a0.,−-]+)" : "([\\s\\S]*?)");
    const re = new RegExp("^" + parts.map((p, i) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + (i < kinds.length ? group(kinds[i]) : "")).join("") + "$");
    const head = parts[0];
    out = out.replace(/\{(\d+):[dn]\}/g, "{$1}");
    const fw = firstWord(head);
    const entry = { re, out };
    if (head.trim() && fw) byFirst.set(fw, [...(byFirst.get(fw) ?? []), entry]);
    else loose.push(entry);
  }
  return { exact, byFirst, loose };
}
/**
 * Slovník: na serveru ho zaregistruje instrumentation.ts (oba jazyky), v prohlížeči ho
 * root layout vloží do stránky jen pro zvolený jazyk – čeští uživatelé nestahují nic navíc.
 */
const compiled: Partial<Record<"sk" | "en", Compiled>> = {};
function dict(locale: "sk" | "en"): Compiled | null {
  if (compiled[locale]) return compiled[locale]!;
  let raw: Raw | undefined;
  if (typeof window === "undefined") raw = (globalThis as { __homeosDicts?: Record<string, Raw> }).__homeosDicts?.[locale];
  else {
    const el = document.getElementById("homeos-dict");
    if (el?.dataset.locale === locale && el.textContent) { try { raw = JSON.parse(el.textContent) as Raw; } catch { raw = undefined; } }
  }
  if (!raw) return null;
  return (compiled[locale] = compile(raw));
}

/** Jazyk pro aktuální vykreslení: v prohlížeči z <html lang>, na serveru z požadavku. */
export function currentLocale(): PhraseLocale {
  if (typeof window !== "undefined") {
    const l = document.documentElement.lang;
    return l === "sk" || l === "en" ? l : "cs";
  }
  const g = (globalThis as { __homeosLocale?: () => PhraseLocale }).__homeosLocale;
  try { return g ? g() : "cs"; } catch { return "cs"; }
}

function fill(out: string, groups: string[], d: Compiled, depth: number) {
  return out.replace(/\{(\d+)\}/g, (_, i) => {
    const g = groups[Number(i)] ?? "";
    const core = g.trim();
    if (depth >= 2 || !core) return g;
    const t = lookup(core, d, depth + 1);
    return t === undefined ? g : g.replace(core, t);
  });
}

function lookup(text: string, d: Compiled, depth = 0): string | undefined {
  const hit = d.exact.get(text);
  if (hit !== undefined) return hit;
  if (text.length > 400 || !/[A-Za-zÀ-ž]/.test(text)) return undefined;
  for (const p of d.byFirst.get(firstWord(text)) ?? []) { const m = p.re.exec(text); if (m) return fill(p.out, m.slice(1), d, depth); }
  for (const p of d.loose) { const m = p.re.exec(text); if (m) return fill(p.out, m.slice(1), d, depth); }
  return undefined;
}

/** Přeloží český text (zachová mezery na okrajích). Neznámý text vrátí beze změny. */
export function phrase(text: string, locale: PhraseLocale = currentLocale()): string {
  if (locale === "cs" || !text) return text;
  const core = text.trim();
  if (!core) return text;
  const d = dict(locale);
  if (!d) return text;
  const out = lookup(core, d);
  if (out === undefined || out === core) return text;
  return core === text ? out : text.replace(core, out);
}
