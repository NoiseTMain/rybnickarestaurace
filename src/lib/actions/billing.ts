"use server";
import { headers } from "next/headers";
import { requireContext } from "@/lib/context";
import { billingConfigured, createCheckoutUrl, emailHash, trialConfigured } from "@/lib/billing";
import { adminBackend, adminConfigured } from "@/lib/admin";

/** Může uživatel ještě využít 3 dny zdarma? (jednou na účet i e-mail; karta se hlídá ve webhooku) */
export async function trialEligible(userId: string, email: string): Promise<boolean> {
  if (!billingConfigured() || !trialConfigured("monthly") || !adminConfigured()) return false;
  const b = await adminBackend();
  const [subs, claimed] = await Promise.all([b.subscriptions(), b.trialClaimed(emailHash(email))]);
  return !claimed && !subs.some((s) => s.user_id === userId && s.source === "lemonsqueezy");
}

/** Vytvoří platbu v Lemon Squeezy a vrátí odkaz, kam uživatele přesměrovat. */
export async function startCheckout(plan: "monthly" | "yearly", trial = false): Promise<{ url?: string; error?: string }> {
  const ctx = await requireContext();
  if (!billingConfigured()) return { error: "Platby zatím nejsou spuštěné. Zkuste to prosím později." };
  const p = plan === "yearly" ? "yearly" : "monthly";
  const useTrial = trial && trialConfigured(p) && (await trialEligible(ctx.user.id, ctx.user.email));
  if (trial && !useTrial) return { error: "Zkušební období už bylo využito. Premium si můžete rovnou předplatit." };
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  try {
    const url = await createCheckoutUrl({ userId: ctx.user.id, email: ctx.user.email, plan: p, redirectUrl: `${origin}/premium?dekujeme=1`, trial: useTrial });
    return { url };
  } catch (e) {
    console.warn("checkout:", e);
    return { error: "Platební bránu se nepodařilo otevřít. Zkuste to prosím znovu." };
  }
}
