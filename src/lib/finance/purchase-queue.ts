import type { Purchase } from "@/lib/db/types";

/** Pořadí, ve kterém se nákupy „berou z peněz“: nejdřív nutné podle priority, pak přání. */
export function purchaseQueue(purchases: readonly Purchase[]): Map<string, number> {
  const active = purchases.filter((p) => p.status !== "bought");
  const byPriority = (a: Purchase, b: Purchase) => a.priority - b.priority || (a.planned_date ?? "9999").localeCompare(b.planned_date ?? "9999") || a.created_at.localeCompare(b.created_at);
  const queue = [...active.filter((p) => !p.is_wish).sort(byPriority), ...active.filter((p) => p.is_wish).sort(byPriority)];
  const before = new Map<string, number>();
  let acc = 0;
  for (const p of queue) {
    before.set(p.id, acc);
    acc += p.price;
  }
  return before;
}
