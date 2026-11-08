import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { subscriptionFromWebhook, verifySignature } from "@/lib/billing";
import { subscriptionActive } from "@/lib/subscription";

describe("platby (Lemon Squeezy)", () => {
  it("ověřuje podpis webhooku", () => {
    const body = JSON.stringify({ a: 1 });
    const sig = createHmac("sha256", "tajne").update(body).digest("hex");
    expect(verifySignature(body, sig, "tajne")).toBe(true);
    expect(verifySignature(body + " ", sig, "tajne")).toBe(false);
    expect(verifySignature(body, null, "tajne")).toBe(false);
    expect(verifySignature(body, sig, "")).toBe(false);
  });
  it("převede událost předplatného", () => {
    process.env.LEMONSQUEEZY_VARIANT_YEARLY = "222";
    const r = subscriptionFromWebhook({
      meta: { event_name: "subscription_created", custom_data: { user_id: "u" } },
      data: { id: "99", type: "subscriptions", attributes: { status: "active", variant_id: 222, customer_id: 5, renews_at: "2027-11-08T00:00:00Z", ends_at: null, urls: { customer_portal: "https://x.lemonsqueezy.com/billing" } } },
    });
    expect(r).toMatchObject({ provider_subscription_id: "99", status: "active", variant: "yearly", source: "lemonsqueezy", portal_url: "https://x.lemonsqueezy.com/billing" });
    expect(subscriptionFromWebhook({ meta: { event_name: "order_created" }, data: { id: "1", type: "orders", attributes: {} } })).toBeNull();
    expect(subscriptionFromWebhook({ meta: { event_name: "x" }, data: { id: "1", type: "subscriptions", attributes: { status: "hacked" } } })).toBeNull();
  });
  it("aktivní předplatné", () => {
    const now = new Date("2026-11-08T12:00:00Z");
    expect(subscriptionActive({ status: "active", ends_at: null }, now)).toBe(true);
    expect(subscriptionActive({ status: "cancelled", ends_at: "2026-12-01T00:00:00Z" }, now)).toBe(true);
    expect(subscriptionActive({ status: "cancelled", ends_at: "2026-11-01T00:00:00Z" }, now)).toBe(false);
    expect(subscriptionActive({ status: "granted", ends_at: null }, now)).toBe(true);
    expect(subscriptionActive({ status: "granted", ends_at: "2026-11-07T00:00:00Z" }, now)).toBe(false);
    expect(subscriptionActive({ status: "expired", ends_at: null }, now)).toBe(false);
    expect(subscriptionActive(null, now)).toBe(false);
  });
});
