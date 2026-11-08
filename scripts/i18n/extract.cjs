// Vytáhne všechny české texty z aplikace (pro slovník překladů). Výstup: JSON {exact:[...], patterns:[...]}
const ts = require("typescript"); const fs = require("fs"); const path = require("path");
const ROOTS = ["src/app", "src/components", "src/lib"];
const SKIP = [/src\/lib\/assistant-kb\.ts$/, /src\/lib\/articles\.ts$/, /src\/app\/(podminky|soukromi)\//, /src\/app\/api\//, /src\/lib\/(db|supabase|i18n)\//, /\.test\./, /src\/lib\/legal\.ts$/, /src\/app\/clanky\//, /src\/components\/Tour\.tsx$/, /src\/app\/\(app\)\/admin\//, /src\/components\/admin\//, /src\/lib\/(admin|billing|errors-log|push|referrals|env|auth|totp)\.ts$/, /src\/instrumentation\.ts$/, /src\/proxy\.ts$/, /src\/app\/(robots|sitemap|manifest)\.ts$/];
const files = [];
const walk = (d) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else if (/\.tsx?$/.test(f) && !SKIP.some((r) => r.test(p))) files.push(p); } };
ROOTS.forEach(walk);
const DIAC = /[ěščřžýáíéůúťďňĚŠČŘŽÝÁÍÉŮÚŤĎŇ]/;
const SKIP_ATTR = new Set(["className", "href", "src", "id", "name", "type", "value", "defaultValue", "key", "htmlFor", "role", "method", "target", "rel", "inputMode", "autoComplete", "pattern", "accept", "d", "viewBox", "fill", "stroke", "style", "variant", "size", "tone", "color", "kind", "dataKey", "stopColor", "data-testid", "field", "section", "highlight", "mode", "format"]);
const SKIP_CALL = new Set(["cn", "clsx", "require", "import", "select", "eq", "from", "order", "is", "set", "get", "has", "delete", "startsWith", "endsWith", "includes", "split", "join", "replace", "test", "match", "querySelector", "getElementById", "addEventListener", "removeEventListener", "getPropertyValue", "setItem", "getItem", "redirect", "revalidatePath", "fetch", "createHash", "update", "digest", "toLocaleString", "toLocaleDateString", "localeCompare", "padStart", "slice", "Intl", "DateTimeFormat", "NumberFormat", "RegExp", "Error", "DbError", "log", "error", "warn", "assert", "expect", "getByText", "locator", "goto", "env", "notFound", "cookies", "headers", "translate", "t", "insert", "upsert", "remove", "single", "maybeSingle", "rpc", "range", "limit", "neq", "gte", "lte", "in", "or", "not", "storage", "createSignedUrl", "upload", "download", "query", "enumOf"]);
const looksText = (s) => {
  const t = s.trim();
  if (t.length < 2 || !/[A-Za-zÀ-ž]/.test(t)) return false;
  if (/^(use (client|server)|@\/|\.{0,2}\/|https?:|mailto:|tel:|#|\/)/.test(t)) return false;
  if (/^[\w.-]+\.(png|svg|jpg|js|ts|json|webp|css|pdf|csv|xml|txt)$/i.test(t)) return false;
  if (/^[a-z0-9_]+$/.test(t)) return false; // identifikátor
  if (/^[a-z][a-zA-Z0-9]*$/.test(t)) return false; // camelCase
  if (/^[A-Z0-9_]+$/.test(t) && t.length > 3 && !DIAC.test(t)) return false; // KONSTANTA
  if (!/\s/.test(t) && /[-:\[\]/=]/.test(t) && !DIAC.test(t)) return false; // tailwind / css
  if (/^(text|bg|flex|grid|rounded|px|py|mt|mb|p|m|w|h|gap|border|items|justify|space|min|max|font|hidden|block|inline|absolute|relative|fixed|sticky|z|top|left|right|bottom|opacity|transition|shadow|ring|overflow|truncate|num|glass|sr-only|lg:|sm:|md:|xl:)\b/.test(t) && !DIAC.test(t)) return false;
  if (/^[\d\s.,:%+\-–—·/()×]+$/.test(t)) return false;
  return DIAC.test(t) || /\s/.test(t) || /^[A-ZÁ-Ž][a-zá-ž]{2,}/.test(t);
};
const exact = new Set(), patterns = new Set(), where = {};
for (const f of files) {
  const src = ts.createSourceFile(f, fs.readFileSync(f, "utf8"), ts.ScriptTarget.Latest, true, f.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    const parent = node.parent;
    // přeskoč importy, typy, klíče objektů
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node) || ts.isTypeNode(node) || ts.isLiteralTypeNode?.(node)) return;
    let skip = false;
    if (parent && ts.isJsxAttribute(parent) && SKIP_ATTR.has(parent.name.getText())) skip = true;
    if (parent && ts.isPropertyAssignment(parent) && parent.name === node) skip = true;
    if (parent && ts.isElementAccessExpression(parent) && parent.argumentExpression === node) skip = true;
    if (parent && (ts.isCallExpression(parent) || ts.isNewExpression(parent))) {
      const e = parent.expression; const n = ts.isPropertyAccessExpression(e) ? e.name.text : ts.isIdentifier(e) ? e.text : "";
      if (SKIP_CALL.has(n)) skip = true;
    }
    if (parent && ts.isBinaryExpression(parent) && ["===", "!==", "==", "!="].includes(parent.operatorToken.getText())) skip = true;
    if (parent && ts.isCaseClause(parent)) skip = true;
    if (parent && ts.isJsxAttribute(parent?.parent ?? {}) ) {}
    if (!skip) {
      let s = null, pat = null;
      if (ts.isJsxText(node)) s = node.text.replace(/\s+/g, " ").trim();
      else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) s = node.text;
      else if (ts.isTemplateExpression(node)) {
        let i = 0; pat = node.head.text + node.templateSpans.map((x) => `{${i++}}` + x.literal.text).join("");
        // literálové části samy o sobě (pro texty rozdělené do více uzlů) se nepřidávají
      }
      if (s && looksText(s)) { exact.add(s); (where[s] ??= f); }
      if (pat && !/^url\(|\b(px|py|text|bg|flex|num|rounded|border|whitespace)-?\w*\b.*\{\d\}|\{\d\}.*\b(px|py|text-\w+|bg-\w+)\b/.test(pat) && looksText(pat.replace(/\{\d+\}/g, " ")) && /[A-Za-zÀ-ž]{2,}/.test(pat.replace(/\{\d+\}/g, ""))) { patterns.add(pat); (where[pat] ??= f); }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}
const out = { exact: [...exact].sort(), patterns: [...patterns].sort() };
fs.writeFileSync(process.argv[2] ?? "phrases-source.json", JSON.stringify(out, null, 1));
console.log("exact", out.exact.length, "patterns", out.patterns.length, "chars", [...exact, ...patterns].join("").length);
if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(where, null, 1));
