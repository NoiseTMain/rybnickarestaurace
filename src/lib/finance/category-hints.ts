import type { Transaction } from "@/lib/db/types";
import { merchantKey } from "./subscriptions";

/** Naučené kategorie: obchodník/popis → nejčastější kategorie z dřívějších zápisů. */
export type CategoryHints = Record<string, string>;

export function buildCategoryHints(txs: readonly Pick<Transaction, "description" | "category_id" | "status" | "type" | "date">[], limit = 400): CategoryHints {
  const counts = new Map<string, Map<string, { n: number; last: string }>>();
  for (const t of txs) {
    if (t.status !== "posted" || !t.category_id || t.type === "transfer") continue;
    const k = `${t.type}:${merchantKey(t.description)}`;
    if (k.endsWith(":")) continue;
    const m = counts.get(k) ?? new Map();
    const c = m.get(t.category_id) ?? { n: 0, last: "" };
    c.n++; if (t.date > c.last) c.last = t.date;
    m.set(t.category_id, c); counts.set(k, m);
  }
  const out: [string, string, number][] = [];
  for (const [k, m] of counts) {
    // nejčastější; při shodě ta naposledy použitá
    const best = [...m.entries()].sort((a, b) => b[1].n - a[1].n || b[1].last.localeCompare(a[1].last))[0];
    out.push([k, best[0], best[1].n]);
  }
  out.sort((a, b) => b[2] - a[2]);
  return Object.fromEntries(out.slice(0, limit).map(([k, c]) => [k, c]));
}

/** Navrhne kategorii podle popisu (null, když se zatím nic nenaučilo). */
export function suggestCategory(hints: CategoryHints | undefined, description: string, type: "income" | "expense"): string | null {
  if (!hints) return null;
  const key = merchantKey(description);
  if (!key) return null;
  if (hints[`${type}:${key}`]) return hints[`${type}:${key}`];
  // shoda podle prvního slova („albert praha“ ~ „albert“)
  const first = key.split(" ")[0];
  const hit = Object.entries(hints).find(([k]) => k.startsWith(`${type}:`) && k.slice(type.length + 1).split(" ")[0] === first);
  return hit ? hit[1] : null;
}
