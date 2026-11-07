import "server-only";
import { cache } from "react";
import type { AppContext } from "@/lib/context";
import type { Store } from "@/lib/db/store";
import type { Trip, TripExpense, TripLeg } from "@/lib/db/types";

export interface TravelData {
  trips: Trip[];
  legs: TripLeg[];
  expenses: TripExpense[];
}

export async function loadTravelFrom(s: Store, householdId: string): Promise<TravelData> {
  const h = { household_id: householdId };
  const [trips, legs, expenses] = await Promise.all([s.select("trips", h), s.select("trip_legs", h), s.select("trip_expenses", h)]);
  return {
    trips: trips.sort((a, b) => (b.start_date ?? "9999").localeCompare(a.start_date ?? "9999")),
    legs: legs.sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)),
    expenses: expenses.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || b.created_at.localeCompare(a.created_at)),
  };
}

export const loadTravel = cache(async (ctx: AppContext) => loadTravelFrom(ctx.store, ctx.household.id));
