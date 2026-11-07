import "server-only";
import type { AppUser } from "@/lib/auth";
import type { Store } from "@/lib/db/store";
import type { Household } from "@/lib/db/types";
import { DEFAULT_CATEGORIES } from "@/lib/defaults";

/** Založí domácnost s vlastníkem, výchozím nastavením a kategoriemi. Nevytváří žádné finanční údaje. */
export async function createHousehold(store: Store, user: AppUser, name: string, isDemo = false): Promise<Household> {
  const [household] = await store.insert("households", [{ name, is_demo: isDemo, created_by: user.id }]);
  await store.insert("household_users", [{ household_id: household.id, user_id: user.id, role: "owner", permissions: {} }]);
  await store.insert("household_settings", [{
    household_id: household.id, safety_buffer: 0, food_warn_percent: 85, pace_tolerance_percent: 10, notify_due_days: 5,
    notify_food: true, notify_invoices: true, notify_payments: true, billing_name: null, billing_ico: null, billing_dic: null,
    billing_address: null, billing_bank_account: null, invoice_number_prefix: null, onboarded_at: null,
  }]);
  await store.insert("categories", DEFAULT_CATEGORIES.map((c, i) => ({ ...c, household_id: household.id, is_archived: false, sort: i })));
  await store.insert("work_settings", [{
    household_id: household.id, member_id: null, company: "Rohlík", rate_hour: 0, rate_regular_route: 0, rate_express_route: 0,
    rate_order: 0, rate_peak_hour_bonus: 0, private_km_rate: 0, default_vehicle_rent: 0,
  }]);
  return household;
}
