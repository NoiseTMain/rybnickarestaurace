import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Subscription } from "@/lib/db/types";

/**
 * Platby přes Lemon Squeezy (prodejce = Lemon Squeezy: řeší DPH, faktury a výplaty na váš účet).
 * Konfigurace v proměnných prostředí:
 *   LEMONSQUEEZY_API_KEY, LEMONSQUEEZY_STORE_ID, LEMONSQUEEZY_VARIANT_MONTHLY, LEMONSQUEEZY_VARIANT_YEARLY,
 *   LEMONSQUEEZY_WEBHOOK_SECRET
 */
export function billingConfigured(): boolean {
  const e = process.env;
  return Boolean(e.LEMONSQUEEZY_API_KEY && e.LEMONSQUEEZY_STORE_ID && e.LEMONSQUEEZY_VARIANT_MONTHLY && e.LEMONSQUEEZY_VARIANT_YEARLY && e.LEMONSQUEEZY_WEBHOOK_SECRET);
}

export async function createCheckoutUrl(p: { userId: string; email: string; plan: "monthly" | "yearly"; redirectUrl: string }): Promise<string> {
  const variant = p.plan === "yearly" ? process.env.LEMONSQUEEZY_VARIANT_YEARLY! : process.env.LEMONSQUEEZY_VARIANT_MONTHLY!;
  const r = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: { Accept: "application/vnd.api+json", "Content-Type": "application/vnd.api+json", Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}` },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: { email: p.email, custom: { user_id: p.userId } },
          checkout_options: { embed: false },
          product_options: { redirect_url: p.redirectUrl, receipt_button_text: "Zpět do HomeOS", receipt_link_url: p.redirectUrl },
        },
        relationships: {
          store: { data: { type: "stores", id: String(process.env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: "variants", id: String(variant) } },
        },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!r.ok) throw new Error(`Platební brána odpověděla ${r.status}`);
  const json = (await r.json()) as { data?: { attributes?: { url?: string } } };
  const url = json.data?.attributes?.url;
  if (!url || !/^https:\/\//.test(url)) throw new Error("Platební brána nevrátila odkaz");
  return url;
}

/** Ověření podpisu webhooku (HMAC-SHA256 těla požadavku). */
export function verifySignature(rawBody: string, signature: string | null, secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ""): boolean {
  if (!signature || !secret) return false;
  const expected = Buffer.from(createHmac("sha256", secret).update(rawBody).digest("hex"), "utf8");
  const got = Buffer.from(signature, "utf8");
  return expected.length === got.length && timingSafeEqual(expected, got);
}

export interface LsWebhook {
  meta: { event_name: string; custom_data?: { user_id?: string } };
  data: { id: string; type: string; attributes: Record<string, unknown> };
}

/** Převod události Lemon Squeezy na řádek předplatného. Vrací null u událostí, které stav nemění. */
export function subscriptionFromWebhook(w: LsWebhook): (Partial<Subscription> & { provider_subscription_id: string }) | null {
  if (w.data?.type !== "subscriptions") return null;
  const a = w.data.attributes;
  const status = String(a.status ?? "");
  const allowed = ["active", "on_trial", "past_due", "paused", "cancelled", "expired", "unpaid"];
  if (!allowed.includes(status)) return null;
  const variantId = String(a.variant_id ?? "");
  const variant = variantId && variantId === String(process.env.LEMONSQUEEZY_VARIANT_YEARLY) ? "yearly" : "monthly";
  const urls = (a.urls ?? {}) as { customer_portal?: string };
  return {
    provider_subscription_id: String(w.data.id),
    provider_customer_id: a.customer_id != null ? String(a.customer_id) : null,
    status: status as Subscription["status"],
    source: "lemonsqueezy",
    variant,
    renews_at: (a.renews_at as string | null) ?? null,
    ends_at: (a.ends_at as string | null) ?? null,
    portal_url: urls.customer_portal && /^https:\/\//.test(urls.customer_portal) ? urls.customer_portal : null,
  };
}

/** Zruší předplatné v Lemon Squeezy (platí do konce zaplaceného období). */
export async function cancelSubscription(id: string): Promise<boolean> {
  if (!process.env.LEMONSQUEEZY_API_KEY) return false;
  const r = await fetch(`https://api.lemonsqueezy.com/v1/subscriptions/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/vnd.api+json", Authorization: `Bearer ${process.env.LEMONSQUEEZY_API_KEY}` },
    signal: AbortSignal.timeout(15_000),
  }).catch(() => null);
  return Boolean(r?.ok);
}
