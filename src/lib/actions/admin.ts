"use server";
import { z } from "zod";
import { requireContext } from "@/lib/context";
import { adminBackend, adminConfigured, isAdminEmail } from "@/lib/admin";
import { subscriptionActive } from "@/lib/subscription";
import { done, fail, parse, withContext } from "./helpers";
import type { ActionResult } from "./result";

async function requireAdmin() {
  const ctx = await requireContext();
  if (!isAdminEmail(ctx.user.email)) throw new Error("forbidden");
  if (!adminConfigured()) throw new Error("Administrace potřebuje na serveru SUPABASE_SERVICE_ROLE_KEY.");
  return { ctx, backend: await adminBackend() };
}

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email("Zadejte platný e-mail"),
  length: z.enum(["1m", "3m", "1y", "forever", "date"]),
  until: z.string().optional(),
  note: z.string().trim().max(300).optional(),
});

function endDate(length: string, until?: string): string | null {
  const d = new Date();
  if (length === "forever") return null;
  if (length === "date") {
    if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) throw new Error("Zadejte datum");
    return new Date(`${until}T23:59:59+01:00`).toISOString();
  }
  if (length === "1m") d.setMonth(d.getMonth() + 1);
  if (length === "3m") d.setMonth(d.getMonth() + 3);
  if (length === "1y") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

/** Přidělí Premium podle e-mailu (uživatel musí mít účet). */
export async function adminGrantPremium(_: ActionResult, fd: FormData): Promise<ActionResult> {
  return withContext(async () => {
    const { ctx, backend } = await requireAdmin();
    const p = parse(grantSchema, fd);
    if (!p.ok) return p.result;
    const user = await backend.findUserByEmail(p.data.email);
    if (!user) return fail("Uživatel s tímto e-mailem nemá účet. Ať se nejdřív zaregistruje.", { email: "Neexistuje" });
    const existing = (await backend.subscriptions()).find((s) => s.user_id === user.id);
    if (existing?.source === "lemonsqueezy" && subscriptionActive(existing)) return fail("Uživatel už má placené Premium (předplatné v Lemon Squeezy).");
    let ends: string | null;
    try {
      ends = endDate(p.data.length, p.data.until);
    } catch (e) {
      return fail((e as Error).message, { until: "Zadejte datum" });
    }
    await backend.upsertSubscription({
      user_id: user.id, status: "granted", source: "admin", variant: ends ? "manual" : "lifetime", ends_at: ends, renews_at: null,
      provider_subscription_id: null, provider_customer_id: null, portal_url: null, granted_by: ctx.user.id, note: p.data.note || null,
    });
    await backend.audit({ admin_id: ctx.user.id, action: "grant_premium", target_user_id: user.id, target_email: user.email, detail: { ends_at: ends, note: p.data.note ?? null } });
    return done(`Premium přidáno: ${user.email}${ends ? ` do ${new Date(ends).toLocaleDateString("cs-CZ")}` : " napořád"}`);
  });
}

export async function adminRevokePremium(userId: string): Promise<ActionResult> {
  return withContext(async () => {
    const { ctx, backend } = await requireAdmin();
    if (userId === ctx.user.id) return fail("Sobě Premium odebrat nemůžete.");
    const s = (await backend.subscriptions()).find((x) => x.user_id === userId);
    if (!s) return fail("Uživatel Premium nemá.");
    if (s.source === "lemonsqueezy") return fail("Placené předplatné zrušte v Lemon Squeezy (Subscriptions → Cancel) – sem se změna propíše sama.");
    await backend.upsertSubscription({ user_id: userId, status: "revoked", ends_at: new Date().toISOString() });
    await backend.audit({ admin_id: ctx.user.id, action: "revoke_premium", target_user_id: userId, target_email: null, detail: null });
    return done("Premium odebráno");
  });
}

export async function adminSetBanned(userId: string, banned: boolean): Promise<ActionResult> {
  return withContext(async () => {
    const { ctx, backend } = await requireAdmin();
    if (userId === ctx.user.id) return fail("Sebe zablokovat nemůžete.");
    await backend.setBanned(userId, banned);
    await backend.audit({ admin_id: ctx.user.id, action: banned ? "ban" : "unban", target_user_id: userId, target_email: null, detail: null });
    return done(banned ? "Účet zablokován – uživatel se nepřihlásí" : "Účet odblokován");
  });
}
