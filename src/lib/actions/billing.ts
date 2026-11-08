"use server";
import { headers } from "next/headers";
import { requireContext } from "@/lib/context";
import { billingConfigured, createCheckoutUrl } from "@/lib/billing";

/** Vytvoří platbu v Lemon Squeezy a vrátí odkaz, kam uživatele přesměrovat. */
export async function startCheckout(plan: "monthly" | "yearly"): Promise<{ url?: string; error?: string }> {
  const ctx = await requireContext();
  if (!billingConfigured()) return { error: "Platby zatím nejsou spuštěné. Zkuste to prosím později." };
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  try {
    const url = await createCheckoutUrl({ userId: ctx.user.id, email: ctx.user.email, plan: plan === "yearly" ? "yearly" : "monthly", redirectUrl: `${origin}/premium?dekujeme=1` });
    return { url };
  } catch (e) {
    console.warn("checkout:", e);
    return { error: "Platební bránu se nepodařilo otevřít. Zkuste to prosím znovu." };
  }
}
