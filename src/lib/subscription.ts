import type { Subscription } from "@/lib/db/types";

/** Je předplatné aktivní? (stejné pravidlo jako SQL funkce subscription_active) */
export function subscriptionActive(s: Pick<Subscription, "status" | "ends_at"> | null | undefined, now = new Date()): boolean {
  if (!s) return false;
  if (s.status === "active" || s.status === "on_trial" || s.status === "past_due") return true;
  if (s.status === "granted") return s.ends_at == null || new Date(s.ends_at) > now;
  if (s.status === "cancelled") return s.ends_at != null && new Date(s.ends_at) > now;
  return false;
}
