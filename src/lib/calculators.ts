/** Finanční kalkulačky – čisté funkce, vše v korunách (ne haléřích). */

/** Anuitní splátka úvěru. */
export function mortgage(principal: number, ratePct: number, years: number) {
  const n = Math.max(1, Math.round(years * 12));
  const r = ratePct / 100 / 12;
  const payment = r === 0 ? principal / n : (principal * r) / (1 - Math.pow(1 + r, -n));
  const total = payment * n;
  return { payment, total, interest: total - principal, months: n };
}

/** Budoucí hodnota pravidelného spoření (vklad na konci měsíce, měsíční úročení). */
export function futureValue(initial: number, monthly: number, ratePct: number, years: number) {
  const n = Math.max(0, Math.round(years * 12));
  const r = ratePct / 100 / 12;
  const growth = Math.pow(1 + r, n);
  const value = initial * growth + (r === 0 ? monthly * n : monthly * ((growth - 1) / r));
  const deposited = initial + monthly * n;
  return { value, deposited, gain: value - deposited };
}

/** Kolik měsíčně spořit, abych za X let měl cílovou částku. */
export function monthlyForTarget(target: number, initial: number, ratePct: number, years: number) {
  const n = Math.max(1, Math.round(years * 12));
  const r = ratePct / 100 / 12;
  const growth = Math.pow(1 + r, n);
  const need = target - initial * growth;
  if (need <= 0) return 0;
  return r === 0 ? need / n : (need * r) / (growth - 1);
}

/** Za kolik měsíců si můžu dovolit věc (s úročením naspořeného). */
export function monthsToAfford(price: number, have: number, monthly: number, ratePct = 0) {
  if (have >= price) return 0;
  if (monthly <= 0) return null;
  const r = ratePct / 100 / 12;
  let v = have, m = 0;
  while (v < price && m < 1200) { v = v * (1 + r) + monthly; m++; }
  return m >= 1200 ? null : m;
}

/** Penze: kolik naspořit, abych si mohl X let vybírat měsíčně částku (při daném výnosu). */
export function retirementNeed(monthlyIncome: number, yearsOfWithdrawal: number, ratePct: number) {
  const n = Math.max(1, Math.round(yearsOfWithdrawal * 12));
  const r = ratePct / 100 / 12;
  return r === 0 ? monthlyIncome * n : (monthlyIncome * (1 - Math.pow(1 + r, -n))) / r;
}

/** Skutečné roční náklady na auto. */
export function carCost(i: { price: number; years: number; resalePct: number; kmPerYear: number; consumption: number; fuelPrice: number; insurance: number; service: number; other: number }) {
  const years = Math.max(1, i.years);
  const depreciation = (i.price * (1 - i.resalePct / 100)) / years;
  const fuel = (i.kmPerYear / 100) * i.consumption * i.fuelPrice;
  const yearly = depreciation + fuel + i.insurance + i.service + i.other;
  return { depreciation, fuel, yearly, monthly: yearly / 12, perKm: i.kmPerYear > 0 ? yearly / i.kmPerYear : 0 };
}

/** Kolik budou peníze mít hodnotu za X let při inflaci. */
export function inflation(amount: number, ratePct: number, years: number) {
  const f = Math.pow(1 + ratePct / 100, years);
  return { realValue: amount / f, neededAmount: amount * f };
}
