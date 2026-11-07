import "server-only";
import { cache } from "react";
import type { AppContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import type { Trip, TripExpense, TripLeg } from "@/lib/db/types";

export interface TravelData {
  trips: Trip[];
  legs: TripLeg[];
  expenses: TripExpense[];
}

/** Cesty domácnosti (načítají se spolu s ostatními daty, aby je plánovač započítal). */
export const loadTravel = cache(async (ctx: AppContext): Promise<TravelData> => (await loadData(ctx)).travel);
