import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { adminBackend } from "@/lib/admin";
import { appMode, publicEnv } from "@/lib/env";
import { loadHouseholdData } from "@/lib/data";
import { computeSnapshot } from "@/lib/finance/snapshot";
import { todayISO } from "@/lib/dates";
import type { Store } from "@/lib/db/store";

export const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");
export const newToken = () => randomBytes(24).toString("base64url");

/** Čísla pro widget – jen souhrny, žádné transakce ani názvy. */
export async function widgetData(token: string) {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const b = await adminBackend();
  const hit = await b.widgetGet(hashToken(token));
  if (!hit) return null;
  let store: Store;
  if (appMode() === "local") {
    const { createLocalStore } = await import("@/lib/db/local-store");
    store = createLocalStore(hit.user_id);
  } else {
    const { createClient } = await import("@supabase/supabase-js");
    const { createSupabaseStore } = await import("@/lib/db/supabase-store");
    store = createSupabaseStore(createClient(publicEnv.supabaseUrl, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false, autoRefreshToken: false } }));
    // přístup k domácnosti mohl být mezitím odebrán
    const access = await store.select("household_users", { household_id: hit.household_id, user_id: hit.user_id } as never);
    if (!access.length) return null;
  }
  const today = todayISO();
  const data = await loadHouseholdData(store, hit.household_id);
  const s = computeSnapshot(data, today);
  const days = Math.max(1, s.daysLeftInMonth);
  const spentToday = data.transactions.filter((t) => t.status === "posted" && t.type === "expense" && t.date === today).reduce((a, t) => a + t.amount, 0);
  return {
    today, daysLeft: s.daysLeftInMonth,
    safeToSpend: s.planner.safeToSpend, perDay: Math.max(0, Math.floor(s.planner.safeToSpend / days)),
    needToEarn: s.planner.needToEarn, spentToday, monthExpense: s.month.expense, available: s.planner.available,
  };
}
