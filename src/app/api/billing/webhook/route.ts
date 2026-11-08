import { NextResponse } from "next/server";
import { billingConfigured, cancelSubscription, emailHash, subscriptionFromWebhook, verifySignature, type LsWebhook } from "@/lib/billing";
import { adminBackend } from "@/lib/admin";

/**
 * Webhook Lemon Squeezy: změny předplatného (vytvořeno, obnoveno, zrušeno, vypršelo…).
 * Ověřuje podpis; zapisuje serverovým klíčem. V Lemon Squeezy nastavte URL
 * https://<vaše-doména>/api/billing/webhook a události subscription_*.
 */
export async function POST(req: Request) {
  if (!billingConfigured()) return NextResponse.json({ error: "Platby nejsou nastavené" }, { status: 501 });
  const raw = await req.text();
  if (raw.length > 200_000 || !verifySignature(raw, req.headers.get("x-signature"))) return NextResponse.json({ error: "Neplatný podpis" }, { status: 401 });
  let body: LsWebhook;
  try {
    body = JSON.parse(raw) as LsWebhook;
  } catch {
    return NextResponse.json({ error: "Neplatná data" }, { status: 400 });
  }
  const row = subscriptionFromWebhook(body);
  if (!row) return NextResponse.json({ ok: true, ignored: true });
  const backend = await adminBackend();
  const existing = await backend.subscriptionByProviderId(row.provider_subscription_id);
  const userId = existing?.user_id ?? body.meta?.custom_data?.user_id;
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return NextResponse.json({ error: "Neznámý uživatel" }, { status: 422 });
  // zkušební období jen jednou: e-mail i karta (značka + poslední 4 číslice + platnost)
  if (row.status === "on_trial") {
    const a = body.data.attributes;
    const email = String(a.user_email ?? "");
    const card = a.card_last_four ? `${a.card_brand ?? ""}:${a.card_last_four}` : null;
    const reused = card ? await backend.trialCardUsed(card, userId) : false;
    if (email) await backend.claimTrial(emailHash(email), userId, card);
    if (reused) {
      // stejná karta už zkušební dobu měla → zrušit trial (uživatel si může Premium normálně koupit)
      await cancelSubscription(row.provider_subscription_id);
      await backend.upsertSubscription({ ...row, status: "cancelled", ends_at: new Date().toISOString(), user_id: userId, granted_by: null, note: "Zkušební doba odmítnuta – karta už byla použita" });
      await backend.audit({ admin_id: null, action: "trial_rejected_card", target_user_id: userId, target_email: email || null, detail: { card } });
      return NextResponse.json({ ok: true, rejected: true });
    }
  }
  await backend.upsertSubscription({ ...row, user_id: userId, granted_by: null, note: null });
  await backend.audit({ admin_id: null, action: `webhook:${body.meta.event_name}`.slice(0, 60), target_user_id: userId, target_email: null, detail: { status: row.status, variant: row.variant } });
  return NextResponse.json({ ok: true });
}
