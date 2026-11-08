"use server";
import { headers } from "next/headers";
import { requireContext } from "@/lib/context";
import { adminBackend, adminConfigured } from "@/lib/admin";
import { hashToken, newToken } from "@/lib/widget";

/** Vytvoří nový tajný odkaz pro widget (starý přestane fungovat). Odkaz se ukáže jen jednou. */
export async function createWidgetLink(): Promise<{ url?: string; error?: string }> {
  const ctx = await requireContext();
  if (!adminConfigured()) return { error: "Widget zatím není na serveru dostupný." };
  const token = newToken();
  await (await adminBackend()).widgetSet(ctx.user.id, ctx.household.id, hashToken(token));
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  return { url: `${origin}/api/widget/${token}` };
}

export async function revokeWidgetLink(): Promise<void> {
  const ctx = await requireContext();
  if (adminConfigured()) await (await adminBackend()).widgetDelete(ctx.user.id);
}
