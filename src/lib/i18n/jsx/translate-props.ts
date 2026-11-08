import { currentLocale, phrase } from "../phrase";

/** Props, které nesou data nebo technické hodnoty – nikdy se nepřekládají. */
const SKIP = new Set(["className", "href", "src", "id", "name", "type", "value", "defaultValue", "key", "htmlFor", "role", "method", "action", "target", "rel", "inputMode", "autoComplete", "pattern", "accept", "d", "viewBox", "fill", "stroke", "lang", "dir", "style", "variant", "size", "tone", "color", "kind", "locale", "path", "mode", "format", "encType", "dataKey", "stopColor", "theme", "accent", "bg", "field", "section", "highlight", "testId", "data-testid", "form", "formAction", "download", "sizes", "media", "as", "content", "property", "charSet", "httpEquiv", "nonce", "integrity", "crossOrigin", "referrerPolicy", "loading", "decoding", "fetchPriority", "srcSet", "poster", "preload", "wrap", "spellCheck", "translate", "slot", "is", "itemProp", "datetime", "dateTime", "cite", "list", "step", "min", "max"]);

function tr(v: unknown, l: "sk" | "en"): unknown {
  if (typeof v === "string") return phrase(v, l);
  if (Array.isArray(v)) { let changed = false; const out = v.map((x) => { const y = typeof x === "string" ? phrase(x, l) : x; if (y !== x) changed = true; return y; }); return changed ? out : v; }
  return v;
}

export function translateProps<P>(type: unknown, props: P): P {
  if (!props || typeof props !== "object") return props;
  const l = currentLocale();
  if (l === "cs") return props;
  // obsah <script>, <style>, <code> a <textarea> nepřekládáme
  if (type === "script" || type === "style" || type === "code" || type === "textarea" || type === "pre") return props;
  let out: Record<string, unknown> | null = null;
  for (const k in props as Record<string, unknown>) {
    if (SKIP.has(k) || k.startsWith("data-") || k.startsWith("on")) continue;
    const v = (props as Record<string, unknown>)[k];
    if (typeof v !== "string" && !(k === "children" && Array.isArray(v))) continue;
    const t = tr(v, l);
    if (t !== v) { out ??= { ...(props as Record<string, unknown>) }; out[k] = t; }
  }
  return (out ?? props) as P;
}
