import "server-only";
import { cache } from "react";
import type { AppContext } from "@/lib/context";
import { loadData } from "@/lib/data";
import type { TravelInput } from "@/lib/finance/travel";

export type TravelData = Required<TravelInput>;

/** Cesty domácnosti (načítají se spolu s ostatními daty, aby je plánovač započítal). */
export const loadTravel = cache(async (ctx: AppContext): Promise<TravelData> => (await loadData(ctx)).travel);
