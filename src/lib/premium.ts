import "server-only";
import { cache } from "react";
import type { AppContext } from "@/lib/context";
import { adminBackend, adminConfigured, isAdminEmail } from "@/lib/admin";

export interface PremiumState {
  /** Má aktuální domácnost Premium (stačí jeden člen s předplatným)? */
  household: boolean;
  /** Má Premium sám přihlášený uživatel? */
  user: boolean;
  isAdmin: boolean;
}

/**
 * Stav Premium pro aktuální požadavek. Administrátor má Premium vždy – a aby to platilo
 * i v databázi (RLS), zajistí se mu trvalé přidělení.
 */
export const getPremium = cache(async (ctx: AppContext): Promise<PremiumState> => {
  const isAdmin = isAdminEmail(ctx.user.email);
  let [household, user] = await Promise.all([ctx.store.householdPremium(ctx.household.id), ctx.store.userPremium()]);
  if (isAdmin && !user && adminConfigured()) {
    try {
      const b = await adminBackend();
      await b.upsertSubscription({ user_id: ctx.user.id, status: "granted", source: "admin", variant: "lifetime", ends_at: null, note: "Administrátor aplikace" });
      user = true;
      household = true;
    } catch {
      /* bez serverového klíče platí aspoň v aplikaci */
    }
  }
  return { household: household || isAdmin, user: user || isAdmin, isAdmin };
});

export class PremiumRequired extends Error {
  constructor(public feature: string) {
    super(`${feature} je součástí Premium.`);
  }
}

/** Pro serverové akce: vrátí chybovou hlášku, když domácnost nemá Premium. */
export async function premiumError(ctx: AppContext, feature: string): Promise<string | null> {
  const p = await getPremium(ctx);
  return p.household ? null : `${feature} je součástí Premium. Aktivujte ho v Nastavení → Předplatné.`;
}
