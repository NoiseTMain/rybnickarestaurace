import type { Asset, Debt, Reminder } from "@/lib/db/types";
import { diffDays, type ISODate } from "@/lib/dates";
import type { Cents } from "@/lib/money";

export const ASSET_KIND_LABEL: Record<Asset["kind"], string> = { investment: "Investice", property: "Nemovitost", vehicle: "Auto / vozidlo", pension: "Penzijní spoření", other: "Ostatní" };
export const REMINDER_KIND: Record<Reminder["kind"], { label: string; emoji: string }> = {
  warranty: { label: "Záruka", emoji: "🧾" }, stk: { label: "STK / emise", emoji: "🚗" }, insurance: { label: "Pojištění", emoji: "🛡️" },
  fixation: { label: "Konec fixace hypotéky", emoji: "🏠" }, contract: { label: "Smlouva / výpověď", emoji: "📄" }, document: { label: "Doklad (OP, pas, ŘP)", emoji: "🪪" },
  tax: { label: "Daně", emoji: "🏛️" }, other: { label: "Jiné", emoji: "📌" },
};

/** Čisté jmění = účty + majetek − dluhy. Záporné zůstatky účtů se počítají jako dluh. */
export function netWorth(accountsTotal: Cents, assets: readonly Asset[], debts: readonly Debt[]) {
  const assetSum = assets.reduce((a, x) => a + x.value, 0);
  const accountsPos = Math.max(0, accountsTotal);
  const liabilities = debts.reduce((a, d) => a + d.balance, 0) + Math.max(0, -accountsTotal);
  return { accounts: accountsPos, assetSum, assets: accountsPos + assetSum, liabilities, net: accountsPos + assetSum - liabilities };
}

/** Termíny, které je čas řešit (do notify_days dní nebo po termínu). */
export function dueReminders(list: readonly Reminder[], today: ISODate) {
  return list
    .filter((r) => !r.done)
    .map((r) => ({ ...r, daysLeft: diffDays(today, r.due_date) }))
    .filter((r) => r.daysLeft <= r.notify_days)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}
