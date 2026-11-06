import { clampZero, divCeil, sub, type Cents } from "@/lib/money";
import { addMonths, startOfMonth, type ISODate } from "@/lib/dates";

export interface AffordabilityInput {
  price: Cents;
  safeToSpend: Cents;
  /** Částky dražších/prioritnějších nákupů, které jsou ve frontě před tímto. */
  queuedBefore?: Cents;
  /** Odhad, kolik měsíčně reálně zbývá (null = nelze odhadnout). */
  monthlySurplus: Cents | null;
  today: ISODate;
}

export interface AffordabilityResult {
  affordable: boolean;
  /** Kolik chybí. */
  shortfall: Cents;
  /** Kolik je potřeba ušetřit (= chybějící částka). */
  toSave: Cents;
  /** Kolik měsíců šetření při současném přebytku. */
  monthsNeeded: number | null;
  /** Nejbližší měsíc, kdy si nákup můžeme bezpečně dovolit. */
  affordableFrom: ISODate | null;
  reason: string;
}

export function checkAffordability(i: AffordabilityInput): AffordabilityResult {
  const free = clampZero(sub(i.safeToSpend, i.queuedBefore ?? 0));
  if (i.price <= free) {
    return { affordable: true, shortfall: 0, toSave: 0, monthsNeeded: 0, affordableFrom: i.today, reason: "Nákup se vejde do peněz, které lze bezpečně utratit." };
  }
  const shortfall = sub(i.price, free);
  if (i.monthlySurplus == null || i.monthlySurplus <= 0) {
    return {
      affordable: false, shortfall, toSave: shortfall, monthsNeeded: null, affordableFrom: null,
      reason: i.monthlySurplus == null
        ? "Zatím není dost dat k odhadu měsíčního přebytku – zadejte pravidelné příjmy nebo počkejte na první celý měsíc evidence."
        : "Podle dosavadních dat vám měsíčně nic nezbývá – bez změny výdajů nebo příjmů nelze termín odhadnout.",
    };
  }
  const months = divCeil(shortfall, i.monthlySurplus);
  return {
    affordable: false, shortfall, toSave: shortfall, monthsNeeded: months,
    affordableFrom: addMonths(startOfMonth(i.today), months),
    reason: `Při přebytku zhruba ${Math.round(i.monthlySurplus / 100)} Kč měsíčně.`,
  };
}
