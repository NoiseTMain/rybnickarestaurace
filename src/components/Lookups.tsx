"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Account, Category, Member, Permissions, SavingsGoal, Trip, TripPerson, WorkSettings } from "@/lib/db/types";
import type { Wallet } from "@/lib/finance/travel";

export interface Lookups {
  mode: "supabase" | "local";
  householdId: string;
  isDemo: boolean;
  today: string;
  ownIco: string | null;
  accounts: Account[];
  categories: Category[];
  members: Member[];
  goals: SavingsGoal[];
  workSettings: WorkSettings | null;
  role: "owner" | "member";
  permissions: Permissions;
  icoActive: boolean;
  /** Probíhající a brzy začínající cesty (pro rychlý zápis výdaje). */
  activeTrips?: { trip: Trip; people: TripPerson[]; wallets: Wallet[] }[];
}

const Ctx = createContext<Lookups | null>(null);

export function LookupsProvider({ value, children }: { value: Lookups; children: ReactNode }) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLookups(): Lookups {
  const v = useContext(Ctx);
  if (!v) throw new Error("LookupsProvider chybí");
  return v;
}
