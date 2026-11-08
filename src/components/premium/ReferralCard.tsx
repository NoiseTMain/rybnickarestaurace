import { headers } from "next/headers";
import { adminBackend, adminConfigured } from "@/lib/admin";
import { processReferrals, REFERRAL_MAX_PER_YEAR, REFERRAL_MIN_AGE_DAYS, REFERRAL_MIN_TX } from "@/lib/referrals";
import { CopyLink } from "./CopyLink";

/** „Doporuč kamarádovi“ – odkaz s kódem a stav doporučení. */
export async function ReferralCard({ userId }: { userId: string }) {
  if (!adminConfigured()) return <p className="text-sm text-ink-3">Doporučení se zapnou po nastavení serveru (SUPABASE_SERVICE_ROLE_KEY).</p>;
  const b = await adminBackend();
  await processReferrals(b, { referrerId: userId }).catch(() => undefined);
  const [code, refs] = await Promise.all([b.referralCode(userId), b.referrals()]);
  const mine = refs.filter((r) => r.referrer_id === userId);
  const h = await headers();
  const origin = process.env.APP_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const link = `${origin}/registrace?ref=${code}`;
  return (
    <div className="space-y-3 text-sm">
      <p className="text-ink-2">Pošlete kamarádovi odkaz. Až začne HomeOS opravdu používat, dostanete <b>oba měsíc Premium zdarma</b>.</p>
      <CopyLink link={link} />
      <div className="flex flex-wrap gap-4 text-xs text-ink-3" data-testid="referral-stats">
        <span>Čeká: <b className="text-ink">{mine.filter((r) => r.status === "pending").length}</b></span>
        <span>Odměněno: <b className="text-pos">{mine.filter((r) => r.status === "rewarded").length}</b></span>
      </div>
      <p className="text-xs text-ink-3">Podmínky: kamarád je u nás nový, účet má aspoň {REFERRAL_MIN_AGE_DAYS} dní a zapsal aspoň {REFERRAL_MIN_TX} pohybů. Odměnu lze získat nejvýš {REFERRAL_MAX_PER_YEAR}× za rok. Máte-li placené předplatné, měsíc navíc se nepřipisuje (předplatné běží dál). Zneužití (falešné účty) vede ke zrušení odměn.</p>
    </div>
  );
}
