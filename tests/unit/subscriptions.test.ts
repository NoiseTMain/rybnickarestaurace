import { describe, expect, it } from "vitest";
import { detectSubscriptions, merchantKey } from "@/lib/finance/subscriptions";
import type { Transaction } from "@/lib/db/types";

const tx = (date: string, amount: number, description: string): Transaction => ({ id: date + description, household_id: "h", type: "expense", status: "posted", amount, date, account_id: "a", transfer_account_id: null, category_id: null, description, member_id: null, scope: "shared", is_recurring: false, payment_method: "card", source: "manual", external_id: null, recurring_payment_id: null, income_source_id: null, occurrence_date: null, payout_id: null, invoice_id: null, purchase_id: null, contribution_id: null, shopping_list_id: null, document_id: null, note: null, cancelled_at: null, created_at: date } as Transaction);

describe("detekce předplatných", () => {
  it("normalizuje obchodníka", () => {
    expect(merchantKey("NETFLIX.COM 4029357733 Amsterdam")).toBe("netflix amsterdam");
    expect(merchantKey("Platba kartou Spotify")).toBe("spotify");
  });
  it("najde měsíční platbu a zdražení", () => {
    const txs = [tx("2026-07-05", 19_900, "Spotify"), tx("2026-08-05", 19_900, "Spotify"), tx("2026-09-05", 19_900, "Spotify"), tx("2026-10-05", 22_900, "Spotify"), tx("2026-10-12", 50_000, "Albert"), tx("2026-09-20", 80_000, "Albert")];
    const r = detectSubscriptions(txs, [], "2026-11-01");
    expect(r.candidates.map((c) => c.name)).toEqual(["Spotify"]);
    expect(r.unknown).toHaveLength(1);
    expect(r.increases[0]).toMatchObject({ from: 19_900, to: 22_900, yearlyImpact: 36_000 });
  });
  it("ignoruje skončené a nepravidelné", () => {
    const txs = [tx("2026-01-05", 19_900, "Netflix"), tx("2026-02-05", 19_900, "Netflix"), tx("2026-03-05", 19_900, "Netflix")];
    expect(detectSubscriptions(txs, [], "2026-11-01").candidates).toHaveLength(0);
  });
});
