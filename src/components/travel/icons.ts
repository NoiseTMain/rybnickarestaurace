import { Bike, Bus, Car, Footprints, Plane, Ship, Train, TramFront } from "lucide-react";
import type { TripLegMode } from "@/lib/db/types";

export const MODE_ICON: Record<TripLegMode, typeof Train> = { train: Train, bus: Bus, car: Car, plane: Plane, ferry: Ship, transit: TramFront, bike: Bike, other: Footprints };
