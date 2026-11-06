import { add, clampZero, sub, type Cents } from "@/lib/money";

/**
 * Chytrý finanční plánovač pro zbytek aktuálního měsíce.
 *
 * Zásady:
 *  - Očekávané (zatím nepřijaté) příjmy se NIKDY nepočítají jako dostupné peníze.
 *    Zobrazují se zvlášť jen pro informaci.
 *  - Peníze odložené na cíle, které leží na běžných účtech, jsou rezervované.
 *  - Budoucí závazky do konce měsíce, zbytek rozpočtu na jídlo a ostatní
 *    rozpočty i bezpečnostní rezerva musí zůstat na účtu.
 */
export interface PlannerInput {
  /** Zůstatek na běžných účtech a v hotovosti (bez spořicích účtů). */
  liquidBalance: Cents;
  /** Částky odložené na cíle, které fyzicky leží na běžných účtech. */
  reservedOnLiquid: Cents;
  /** Neuhrazené závazky splatné do konce měsíce (vč. po splatnosti). */
  obligations: Cents;
  /** Zbytek rozpočtu na jídlo do konce měsíce. */
  foodRemaining: Cents;
  /** Zbytek ostatních kategoriových rozpočtů. */
  otherBudgetsRemaining: Cents;
  /** Bezpečnostní rezerva na nečekané situace. */
  safetyBuffer: Cents;
  /** Kolik ještě letos v měsíci podle plánu odložit na cíle. */
  savingsPlanRemaining: Cents;
  /** Očekávané příjmy do konce měsíce – pouze informativně. */
  expectedIncome: Cents;
}

export interface PlannerResult {
  /** Disponibilní = běžné účty − rezervováno na cíle. */
  available: Cents;
  /** 1. Kolik peněz musí zůstat na účtu. */
  mustKeep: Cents;
  /** 2. Kolik můžeme bezpečně utratit (navíc nad plán). */
  safeToSpend: Cents;
  /** 3. Kolik máme ještě tento měsíc odložit. */
  toSave: Cents;
  /** 4. Kolik nám chybí – potřebujeme ještě vydělat. */
  needToEarn: Cents;
  /** 5. Kolik můžeme celkem dát na spoření, pokud nic navíc neutratíme. */
  canSave: Cents;
  /** Zbývá po zaplacení všech závazků do konce měsíce (bez rozpočtů a rezervy). */
  afterObligations: Cents;
  /** Informativně: kolik by bylo volných peněz PO přijetí očekávaných příjmů. */
  safeToSpendIfIncomeArrives: Cents;
  breakdown: { label: string; amount: Cents }[];
}

export function plan(i: PlannerInput): PlannerResult {
  const available = sub(i.liquidBalance, i.reservedOnLiquid);
  const commitments = add(i.obligations, i.foodRemaining, i.otherBudgetsRemaining, i.safetyBuffer);
  const mustKeep = add(i.reservedOnLiquid, commitments);
  const freeAfterCommitments = sub(available, commitments);
  const safeToSpend = clampZero(sub(freeAfterCommitments, i.savingsPlanRemaining));
  const needToEarn = clampZero(sub(add(commitments, i.savingsPlanRemaining), available));
  const canSave = clampZero(freeAfterCommitments);
  return {
    available,
    mustKeep,
    safeToSpend,
    toSave: i.savingsPlanRemaining,
    needToEarn,
    canSave,
    afterObligations: sub(available, i.obligations),
    safeToSpendIfIncomeArrives: clampZero(sub(add(freeAfterCommitments, i.expectedIncome), i.savingsPlanRemaining)),
    breakdown: [
      { label: "Odloženo na cíle (na běžných účtech)", amount: i.reservedOnLiquid },
      { label: "Závazky do konce měsíce", amount: i.obligations },
      { label: "Zbytek rozpočtu na jídlo", amount: i.foodRemaining },
      { label: "Zbytek ostatních rozpočtů", amount: i.otherBudgetsRemaining },
      { label: "Bezpečnostní rezerva", amount: i.safetyBuffer },
      { label: "Plán spoření tento měsíc", amount: i.savingsPlanRemaining },
    ],
  };
}
