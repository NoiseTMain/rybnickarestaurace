"use server";
import { cookies } from "next/headers";
import { checkPassword } from "@/lib/password-check";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";
import type { AppContext } from "@/lib/context";
import type { TableName } from "@/lib/db/types";
import { THEME_COOKIE } from "@/lib/theme";
import { done, fail, withContext } from "./helpers";
import type { ActionResult } from "./result";

/** Části domácnosti, které lze vynulovat. Pořadí = bezpečné pořadí mazání (kvůli vazbám). */
const RESET_PARTS = {
  travel: { tables: ["trip_expenses", "trip_legs", "trips"] },
  transactions: { tables: ["transactions", "occurrence_marks"] },
  planning: { tables: ["shopping_items", "shopping_lists", "price_history", "purchases"] },
  savings: { tables: ["savings_contributions", "savings_goals"] },
  work: { tables: ["payouts", "work_shifts"] },
  invoices: { tables: ["invoices"] },
  budgets: { tables: ["budgets"] },
  recurring: { tables: ["recurring_payments", "income_sources"] },
  documents: { tables: ["documents"] },
  accounts: { tables: ["accounts"] },
} as const satisfies Record<string, { tables: TableName[] }>;

export type ResetPart = keyof typeof RESET_PARTS | "categories" | "members" | "settings";
const ALL_PARTS: ResetPart[] = [...(Object.keys(RESET_PARTS) as (keyof typeof RESET_PARTS)[]), "categories", "members", "settings"];

async function wipe(ctx: AppContext, parts: Set<ResetPart>) {
  const h = ctx.household.id;
  const del = (t: TableName) => ctx.store.remove(t, { household_id: h } as never);
  for (const part of Object.keys(RESET_PARTS) as (keyof typeof RESET_PARTS)[]) {
    if (!parts.has(part)) continue;
    if (part === "documents") {
      const docs = await ctx.store.select("documents", { household_id: h });
      for (const d of docs) await ctx.store.files.remove(d.storage_path).catch(() => undefined);
    }
    for (const t of RESET_PARTS[part].tables) await del(t);
  }
  if (parts.has("categories")) {
    await del("categories");
    await ctx.store.insert("categories", DEFAULT_CATEGORIES.map((c, i) => ({ ...c, household_id: h, is_archived: false, sort: i })));
  }
  if (parts.has("members")) {
    // členové bez účtu se smažou, členové s přístupem zůstanou (jinak by o domácnost přišli)
    const members = await ctx.store.select("members", { household_id: h });
    for (const m of members) if (!m.user_id) await ctx.store.remove("members", { id: m.id, household_id: h });
  }
  if (parts.has("settings")) {
    await ctx.store.update("household_settings", { household_id: h }, {
      safety_buffer: 0, food_warn_percent: 85, pace_tolerance_percent: 10, notify_due_days: 5, notify_food: true, notify_invoices: true,
      notify_payments: true, billing_name: null, billing_dic: null, billing_address: null, billing_bank_account: null, invoice_number_prefix: null,
    });
    await ctx.store.update("work_settings", { household_id: h }, {
      member_id: null, company: "Rohlík", rate_hour: 0, rate_regular_route: 0, rate_express_route: 0, rate_order: 0, rate_peak_hour_bonus: 0,
      private_km_rate: 0, default_vehicle_rent: 0,
    });
  }
}

/**
 * Reset domácnosti – vybrané části, nebo tovární reset (vše jako u nově založené domácnosti).
 * Jen vlastník, vždy s heslem, opsaným potvrzením a zaškrtnutím nevratnosti.
 */
export async function resetHousehold(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async (ctx) => {
    if (ctx.role !== "owner") return fail("Reset může provést jen vlastník domácnosti.");
    const factory = fd.get("mode") === "factory";
    const parts = new Set<ResetPart>(factory ? ALL_PARTS : (fd.getAll("parts").map(String).filter((p) => ALL_PARTS.includes(p as ResetPart)) as ResetPart[]));
    if (!parts.size) return fail("Vyberte, co se má vynulovat.");
    if (parts.has("accounts") && !parts.has("transactions")) return fail("Účty lze smazat jen spolu s pohyby na nich (vyberte i „Příjmy a výdaje“).", { parts: "Vyberte i pohyby" });
    if (fd.get("understand") !== "on") return fail("Potvrďte, že rozumíte nevratnosti.", { understand: "Potvrďte" });
    const expected = factory ? "TOVÁRNÍ RESET" : "VYNULOVAT";
    if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== expected) return fail(`Pro potvrzení napište ${expected}.`, { confirm: `Napište ${expected}` });
    if (!(await checkPassword(ctx.user, String(fd.get("password") ?? "")))) return fail("Nesprávné heslo.", { password: "Nesprávné heslo" });
    await wipe(ctx, parts);
    if (factory) {
      // tovární reset vrací i vzhled tohoto zařízení
      (await cookies()).delete(THEME_COOKIE);
      await ctx.store.update("household_settings", { household_id: ctx.household.id }, { onboarded_at: null });
    }
    return done(factory ? "Tovární reset dokončen – domácnost je jako nově založená." : `Vynulováno: ${parts.size} ${parts.size === 1 ? "část" : "částí"}.`);
  });
}
