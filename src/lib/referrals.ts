import "server-only";
import type { AdminBackend } from "@/lib/admin";
import { subscriptionActive } from "@/lib/subscription";

export const REFERRAL_DAYS = 30;
export const REFERRAL_MIN_TX = 10;
export const REFERRAL_MIN_AGE_DAYS = 7;
export const REFERRAL_MAX_PER_YEAR = 12;
const DAY = 86_400_000;

/** Normalizace e-mailu proti obcházení („jan+1@gmail.com“, „j.a.n@gmail.com“). */
export function canonicalEmail(email: string): string {
  const [local = "", domain = ""] = email.toLowerCase().trim().split("@");
  const d = domain === "googlemail.com" ? "gmail.com" : domain;
  let l = local.split("+")[0];
  if (d === "gmail.com") l = l.replace(/\./g, "");
  return `${l}@${d}`;
}

/** Připíše uživateli měsíc Premium (prodlouží přidělené). Placené předplatné nepřepisuje. */
export async function grantReferralMonth(backend: AdminBackend, userId: string, now = new Date()): Promise<boolean> {
  const sub = (await backend.subscriptions()).find((s) => s.user_id === userId);
  if (sub?.source === "lemonsqueezy" && subscriptionActive(sub, now)) return false;
  if (sub?.status === "granted" && sub.ends_at == null) return false; // napořád
  const base = sub?.status === "granted" && sub.ends_at && new Date(sub.ends_at) > now ? new Date(sub.ends_at) : now;
  await backend.upsertSubscription({
    user_id: userId, status: "granted", source: "admin", variant: "manual", ends_at: new Date(base.getTime() + REFERRAL_DAYS * DAY).toISOString(),
    renews_at: null, provider_subscription_id: null, provider_customer_id: null, portal_url: null, granted_by: null, note: "Doporučení kamaráda",
  });
  return true;
}

/**
 * Vyhodnotí čekající doporučení. Odměna (měsíc Premium oběma) až když nový uživatel aplikaci
 * opravdu používá: účet je starý aspoň 7 dní, v jeho domácnosti je aspoň 10 zápisů, není blokovaný,
 * nejde o stejnou osobu (normalizovaný e-mail) a doporučující nemá víc než 12 odměn za rok.
 * Po 60 dnech bez splnění se doporučení zamítne.
 */
export async function processReferrals(backend: AdminBackend, opts: { referrerId?: string; now?: Date } = {}) {
  const now = opts.now ?? new Date();
  const all = await backend.referrals();
  const pending = all.filter((r) => r.status === "pending" && (!opts.referrerId || r.referrer_id === opts.referrerId));
  if (!pending.length) return { rewarded: 0, rejected: 0 };
  const [users, households] = await Promise.all([backend.listUsers(), backend.households()]);
  const byId = new Map(users.map((u) => [u.id, u]));
  let rewarded = 0, rejected = 0;
  for (const r of pending) {
    const referrer = byId.get(r.referrer_id), referred = byId.get(r.referred_id);
    const age = now.getTime() - new Date(r.created_at).getTime();
    if (!referrer || !referred || referred.banned || canonicalEmail(referrer.email) === canonicalEmail(referred.email)) {
      await backend.setReferralStatus(r.id, "rejected"); rejected++; continue;
    }
    const tx = households.filter((h) => !h.is_demo && h.owners.includes(referred.email)).reduce((a, h) => a + h.counts.transactions, 0);
    const accountAge = now.getTime() - new Date(referred.created_at).getTime();
    if (tx >= REFERRAL_MIN_TX && accountAge >= REFERRAL_MIN_AGE_DAYS * DAY) {
      const yearAgo = now.getTime() - 365 * DAY;
      const already = all.filter((x) => x.referrer_id === r.referrer_id && x.status === "rewarded" && new Date(x.created_at).getTime() > yearAgo).length;
      await backend.setReferralStatus(r.id, "rewarded");
      await grantReferralMonth(backend, r.referred_id, now);
      if (already < REFERRAL_MAX_PER_YEAR) await grantReferralMonth(backend, r.referrer_id, now);
      await backend.audit({ admin_id: null, action: "referral_reward", target_user_id: r.referrer_id, target_email: referrer.email, detail: { referred: referred.email, referrer_rewarded: already < REFERRAL_MAX_PER_YEAR } });
      rewarded++;
    } else if (age > 60 * DAY) {
      await backend.setReferralStatus(r.id, "rejected"); rejected++;
    }
  }
  return { rewarded, rejected };
}
