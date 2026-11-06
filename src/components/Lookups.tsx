"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { Account, Category, Member, SavingsGoal, WorkSettings } from "@/lib/db/types";

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
