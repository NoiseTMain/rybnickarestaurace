"use server";
import { z } from "zod";
import { pushConfigured, sendPush } from "@/lib/push";
import { loadSnapshot } from "@/lib/data";
import { weeklySummary } from "@/lib/finance/insights";
import { done, fail, withContext } from "./helpers";
import type { ActionResult } from "./result";

const subSchema = z.object({ endpoint: z.string().url().startsWith("https://").max(1000), keys: z.object({ p256dh: z.string().min(10).max(200), auth: z.string().min(8).max(100) }) });

export async function savePushSubscription(sub: unknown): Promise<ActionResult> {
  {
    const { requireContext } = await import("@/lib/context");
    const { premiumError } = await import("@/lib/premium");
    const err = await premiumError(await requireContext(), "Upozornění na telefon");
    if (err) return { ok: false, error: err, at: Date.now() };
  }
  return withContext(async (ctx) => {
    if (!pushConfigured()) return fail("Oznámení nejsou na serveru nastavená.");
    const p = subSchema.safeParse(sub);
    if (!p.success) return fail("Neplatné přihlášení k oznámením.");
    await ctx.store.remove("push_subscriptions", { endpoint: p.data.endpoint } as never).catch(() => undefined);
    await ctx.store.insert("push_subscriptions", [{ user_id: ctx.user.id, household_id: ctx.household.id, endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth }]);
    // hned pošleme ukázku, ať je vidět, že to funguje
    const { data, snapshot } = await loadSnapshot(ctx);
    const w = weeklySummary(snapshot, data);
    await sendPush({ endpoint: p.data.endpoint, p256dh: p.data.keys.p256dh, auth: p.data.keys.auth }, { title: "HomeOS – oznámení zapnuta", body: w.lines.slice(0, 2).join(" "), url: "/asistent" }).catch(() => undefined);
    return done("Oznámení zapnuta – týdenní souhrn přijde v neděli večer");
  });
}

export async function removePushSubscription(endpoint: string): Promise<ActionResult> {
  return withContext(async (ctx) => {
    await ctx.store.remove("push_subscriptions", { endpoint, user_id: ctx.user.id } as never);
    return done("Oznámení vypnuta");
  });
}
