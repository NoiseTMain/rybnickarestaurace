import { addDays, diffDays } from "@/lib/dates";
import { divFloor, formatMoney, sum } from "@/lib/money";
import type { Transaction } from "@/lib/db/types";
import { effectiveExpenses, MODE_LABEL, summarizeTrip, type TravelInput } from "./travel";

export interface TravelAlert {
  tripId: string;
  kind: "departure" | "overspend";
  title: string;
  body: string;
}

/** Upozornění k cestám pro daný den (večer): zítřejší odjezd, dnešní překročení denního limitu. */
export function travelAlerts(data: { travel: TravelInput; transactions: Pick<Transaction, "id" | "status" | "amount">[] }, today: string): TravelAlert[] {
  const out: TravelAlert[] = [];
  const kc = (c: number) => formatMoney(c, { decimals: "never" });
  for (const trip of data.travel.trips) {
    const legs = data.travel.legs.filter((l) => l.trip_id === trip.id).sort((a, b) => a.sort - b.sort);
    const ex = effectiveExpenses(data.travel.expenses.filter((e) => e.trip_id === trip.id), data.transactions);
    if (trip.start_date === addDays(today, 1)) {
      const first = legs[0];
      const leg = first ? `${MODE_LABEL[first.mode]}${first.carrier ? ` ${first.carrier}` : ""} ${first.from_place} → ${first.to_place}${first.depart_time ? ` v ${first.depart_time}` : ""}.` : "";
      const todo = (data.travel.checklist ?? []).filter((c) => c.trip_id === trip.id && !c.done).length;
      out.push({
        tripId: trip.id, kind: "departure", title: `Zítra odjezd: ${trip.name}`,
        body: [leg, todo ? `Ještě ${todo} ${todo === 1 ? "věc" : todo < 5 ? "věci" : "věcí"} na seznamu.` : "", `Na místě ${kc(summarizeTrip(trip, legs, ex, today).perDayAllowance ?? 0)} na den.`].filter(Boolean).join(" "),
      });
    }
    const end = trip.end_date ?? trip.start_date;
    if (trip.start_date && end && today >= trip.start_date && today <= end && trip.budget != null) {
      const days = diffDays(trip.start_date, end) + 1;
      const fixed = sum(ex.filter((e) => e.kind === "transport" || e.kind === "accommodation"), (e) => e.value);
      const limit = divFloor(Math.max(0, trip.budget - fixed), days);
      const spent = sum(ex.filter((e) => e.status === "paid" && e.date === today && e.kind !== "transport" && e.kind !== "accommodation"), (e) => e.value);
      if (limit > 0 && spent > limit) {
        out.push({ tripId: trip.id, kind: "overspend", title: `${trip.name}: dnes přes limit`, body: `Dnes utraceno ${kc(spent)}, denní limit ${kc(limit)} (o ${kc(spent - limit)} víc).` });
      }
    }
  }
  return out;
}
