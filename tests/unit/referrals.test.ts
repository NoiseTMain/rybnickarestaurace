import { describe, expect, it } from "vitest";
import type { AdminBackend } from "@/lib/admin";
import type { Subscription } from "@/lib/db/types";
import { canonicalEmail, processReferrals } from "@/lib/referrals";

const now = new Date("2026-11-08T12:00:00Z");
const ago = (d: number) => new Date(now.getTime() - d * 86_400_000).toISOString();

function fake(opts: { referredTx: number; referredAgeDays: number; referredEmail?: string; refSub?: Partial<Subscription> }) {
  const subs: Subscription[] = opts.refSub ? [{ user_id: "a", ...opts.refSub } as Subscription] : [];
  const refs = [{ id: "r1", referrer_id: "a", referred_id: "b", status: "pending", created_at: ago(opts.referredAgeDays) }];
  const b = {
    referrals: async () => refs,
    listUsers: async () => [
      { id: "a", email: "jan.novak@gmail.com", created_at: ago(100), last_sign_in_at: null, confirmed: true, banned: false },
      { id: "b", email: opts.referredEmail ?? "petra@seznam.cz", created_at: ago(opts.referredAgeDays), last_sign_in_at: null, confirmed: true, banned: false },
    ],
    households: async () => [{ id: "h", name: "P", is_demo: false, created_at: ago(opts.referredAgeDays), owners: [opts.referredEmail ?? "petra@seznam.cz"], users: [], counts: { members: 1, accounts: 1, transactions: opts.referredTx, trips: 0, documents: 0 }, lastActivity: null }],
    setReferralStatus: async (id: string, status: string) => { refs.find((r) => r.id === id)!.status = status; },
    subscriptions: async () => subs,
    upsertSubscription: async (row: Partial<Subscription> & { user_id: string }) => { const i = subs.findIndex((s) => s.user_id === row.user_id); if (i >= 0) subs[i] = { ...subs[i], ...row }; else subs.push(row as Subscription); },
    audit: async () => undefined,
  } as unknown as AdminBackend;
  return { b, subs, refs };
}

describe("doporuč kamarádovi", () => {
  it("normalizuje e-mail proti obcházení", () => {
    expect(canonicalEmail("Jan.Novak+test@GoogleMail.com")).toBe("jannovak@gmail.com");
    expect(canonicalEmail("jan+x@seznam.cz")).toBe("jan@seznam.cz");
  });
  it("odmění oba až po splnění podmínek", async () => {
    const early = fake({ referredTx: 3, referredAgeDays: 10 });
    expect(await processReferrals(early.b, { now })).toEqual({ rewarded: 0, rejected: 0 });
    const ok = fake({ referredTx: 12, referredAgeDays: 8 });
    expect((await processReferrals(ok.b, { now })).rewarded).toBe(1);
    expect(ok.subs.map((s) => s.user_id).sort()).toEqual(["a", "b"]);
    expect(new Date(ok.subs[0].ends_at!).getTime() - now.getTime()).toBe(30 * 86_400_000);
  });
  it("prodlouží přidělené Premium, placené nepřepíše", async () => {
    const granted = fake({ referredTx: 12, referredAgeDays: 8, refSub: { status: "granted", source: "admin", ends_at: ago(-10) } });
    await processReferrals(granted.b, { now });
    expect(new Date(granted.subs.find((s) => s.user_id === "a")!.ends_at!).getTime() - now.getTime()).toBe(40 * 86_400_000);
    const paid = fake({ referredTx: 12, referredAgeDays: 8, refSub: { status: "active", source: "lemonsqueezy", ends_at: null } });
    await processReferrals(paid.b, { now });
    expect(paid.subs.find((s) => s.user_id === "a")!.source).toBe("lemonsqueezy");
  });
  it("zamítne sám sebe a staré nesplněné", async () => {
    const self = fake({ referredTx: 50, referredAgeDays: 30, referredEmail: "jannovak+2@gmail.com" });
    expect((await processReferrals(self.b, { now })).rejected).toBe(1);
    const old = fake({ referredTx: 1, referredAgeDays: 61 });
    expect((await processReferrals(old.b, { now })).rejected).toBe(1);
  });
});
