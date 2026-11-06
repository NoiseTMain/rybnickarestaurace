import { add, divRound, mulQuantity, sub, sum, type Cents } from "@/lib/money";
import { monthKey, startOfWeek, type ISODate } from "@/lib/dates";
import type { Payout, WorkSettings, WorkShift } from "@/lib/db/types";

export function shiftGross(s: WorkShift): Cents {
  return add(s.base_earnings, s.tips, s.bonuses, s.rewards);
}

export function shiftCosts(s: WorkShift): Cents {
  return add(s.vehicle_rent, s.equipment_cost, s.private_km_cost, s.other_deductions);
}

export function shiftNet(s: WorkShift): Cents {
  return sub(shiftGross(s), shiftCosts(s));
}

/** Návrh základního výdělku podle sazeb v nastavení (uživatel jej může přepsat). */
export function suggestBaseEarnings(
  w: Pick<WorkSettings, "rate_hour" | "rate_regular_route" | "rate_express_route" | "rate_order" | "rate_peak_hour_bonus">,
  shift: { minutes: number; peak_minutes: number; regular_routes: number; express_routes: number; orders: number },
): Cents {
  return add(
    divRound(w.rate_hour * shift.minutes, 60),
    divRound(w.rate_peak_hour_bonus * shift.peak_minutes, 60),
    w.rate_regular_route * shift.regular_routes,
    w.rate_express_route * shift.express_routes,
    w.rate_order * shift.orders,
  );
}

export function privateKmCost(rate: Cents, km: string): Cents {
  if (!km || km.trim() === "") return 0;
  return mulQuantity(rate, km);
}

export interface WorkAggregate {
  key: string;
  shifts: number;
  days: number;
  minutes: number;
  peakMinutes: number;
  regularRoutes: number;
  expressRoutes: number;
  orders: number;
  gross: Cents;
  base: Cents;
  tips: Cents;
  bonuses: Cents;
  rewards: Cents;
  costs: Cents;
  net: Cents;
  avgPerDay: Cents;
  avgPerHour: Cents;
}

export function aggregate(key: string, shifts: readonly WorkShift[]): WorkAggregate {
  const days = new Set(shifts.map((s) => s.date)).size;
  const minutes = shifts.reduce((a, s) => a + s.minutes, 0);
  const net = sum(shifts, shiftNet);
  return {
    key,
    shifts: shifts.length,
    days,
    minutes,
    peakMinutes: shifts.reduce((a, s) => a + s.peak_minutes, 0),
    regularRoutes: shifts.reduce((a, s) => a + s.regular_routes, 0),
    expressRoutes: shifts.reduce((a, s) => a + s.express_routes, 0),
    orders: shifts.reduce((a, s) => a + s.orders, 0),
    gross: sum(shifts, shiftGross),
    base: sum(shifts, (s) => s.base_earnings),
    tips: sum(shifts, (s) => s.tips),
    bonuses: sum(shifts, (s) => s.bonuses),
    rewards: sum(shifts, (s) => s.rewards),
    costs: sum(shifts, shiftCosts),
    net,
    avgPerDay: days ? divRound(net, days) : 0,
    avgPerHour: minutes ? divRound(net * 60, minutes) : 0,
  };
}

export function groupBy(shifts: readonly WorkShift[], by: "day" | "week" | "month"): WorkAggregate[] {
  const map = new Map<string, WorkShift[]>();
  for (const s of shifts) {
    const k = by === "day" ? s.date : by === "week" ? startOfWeek(s.date) : monthKey(s.date);
    const list = map.get(k) ?? [];
    list.push(s);
    map.set(k, list);
  }
  return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([k, list]) => aggregate(k, list));
}

export function inPeriod(shifts: readonly WorkShift[], from: ISODate, to: ISODate) {
  return shifts.filter((s) => s.date >= from && s.date <= to);
}

export interface PayoutView extends Payout {
  difference: Cents | null; // skutečnost − očekávání
  isLate: boolean;
}

export function payoutView(p: Payout, today: ISODate): PayoutView {
  return {
    ...p,
    difference: p.status === "received" && p.received_amount != null ? sub(p.received_amount, p.expected_amount) : null,
    isLate: p.status === "expected" && p.expected_date < today,
  };
}
