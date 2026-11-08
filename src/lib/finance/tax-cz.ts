import type { Cents } from "@/lib/money";

/**
 * Orientační výpočet daně a pojistného OSVČ (ČR). Parametry se každý rok mění –
 * výchozí hodnoty jsou pro rok 2026 a uživatel je může upravit. Nejde o daňové poradenství.
 */
export interface TaxParams {
  year: number;
  /** Průměrná mzda pro daný rok (Kč) – z ní hranice 23% sazby (36×). */
  averageWage: number;
  /** Sleva na poplatníka za rok (Kč). */
  taxpayerCredit: number;
  /** Minimální měsíční záloha na sociální pojištění – hlavní činnost (Kč). */
  minSocial: number;
  /** Minimální měsíční záloha na zdravotní pojištění – hlavní činnost (Kč). */
  minHealth: number;
}
export const TAX_PARAMS_2026: TaxParams = { year: 2026, averageWage: 48_967, taxpayerCredit: 30_840, minSocial: 5_720, minHealth: 3_306 };

export const FLAT_EXPENSES = [
  { rate: 80, cap: 1_600_000, label: "80 % – řemeslné živnosti, zemědělství" },
  { rate: 60, cap: 1_200_000, label: "60 % – ostatní živnosti (většina OSVČ)" },
  { rate: 40, cap: 800_000, label: "40 % – svobodná povolání (např. IT na volné noze, poradci)" },
  { rate: 30, cap: 600_000, label: "30 % – pronájem majetku" },
] as const;

export interface TaxInput {
  /** Příjmy za rok (haléře). */
  income: Cents;
  /** Skutečné výdaje (haléře) – použijí se, pokud expenseRate je null. */
  realExpenses: Cents;
  /** Výdajový paušál v % (80/60/40/30) nebo null = skutečné výdaje. */
  expenseRate: number | null;
  /** Další slevy na dani za rok (manžel/ka, studium…) v Kč – volitelné. */
  extraCredits?: number;
  /** Daňové zvýhodnění na děti za rok v Kč (může vést k bonusu). */
  childCredit?: number;
  params?: TaxParams;
}

export interface TaxResult {
  expenses: number; profit: number; taxBase: number;
  tax: number; taxBeforeCredits: number; childBonus: number;
  social: number; health: number;
  socialMonthly: number; healthMonthly: number;
  total: number; net: number; effectiveRate: number;
}

const kc = (h: Cents) => Math.round(h / 100);

export function osvcTax(input: TaxInput): TaxResult {
  const p = input.params ?? TAX_PARAMS_2026;
  const income = Math.max(0, kc(input.income));
  let expenses: number;
  if (input.expenseRate != null) {
    const f = FLAT_EXPENSES.find((x) => x.rate === input.expenseRate) ?? FLAT_EXPENSES[1];
    expenses = Math.min(Math.round((income * f.rate) / 100), f.cap);
  } else expenses = Math.max(0, kc(input.realExpenses));
  const profit = Math.max(0, income - expenses);
  const taxBase = Math.floor(profit / 100) * 100; // zaokrouhlení základu dolů na stovky
  const limit = 36 * p.averageWage;
  const taxBeforeCredits = Math.round(Math.min(taxBase, limit) * 0.15 + Math.max(0, taxBase - limit) * 0.23);
  const afterCredits = Math.max(0, taxBeforeCredits - p.taxpayerCredit - (input.extraCredits ?? 0));
  const child = input.childCredit ?? 0;
  const tax = Math.max(0, afterCredits - child);
  const childBonus = Math.max(0, child - afterCredits);
  // pojistné: sociální 29,2 % z 55 % zisku, zdravotní 13,5 % z 50 % zisku, nejméně minima
  const social = Math.max(Math.round(profit * 0.55 * 0.292), p.minSocial * 12);
  const health = Math.max(Math.round(profit * 0.5 * 0.135), p.minHealth * 12);
  const total = tax - childBonus + social + health;
  return {
    expenses, profit, taxBase, tax, taxBeforeCredits, childBonus, social, health,
    socialMonthly: Math.ceil(social / 12), healthMonthly: Math.ceil(health / 12),
    total, net: income - (input.expenseRate == null ? expenses : 0) - total,
    effectiveRate: income ? total / income : 0,
  };
}
