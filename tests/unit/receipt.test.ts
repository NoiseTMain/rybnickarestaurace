import { describe, expect, it } from "vitest";
import { parseReceipt } from "@/lib/receipt-parse";

describe("čtení účtenky", () => {
  it("rakouská účtenka v eurech", () => {
    const r = parseReceipt("Figlmüller GmbH\nWollzeile 5, 1010 Wien\nUID ATU12345678\n2x Wiener Schnitzel 39,80\n1x Bier 4,90\nSUMME EUR 44,70\nKarte 44,70\n12.12.2026 19:45");
    expect(r).toEqual({ amount: 4470, currency: "EUR", date: "2026-12-12", merchant: "Figlmüller GmbH" });
  });
  it("česká účtenka a tisíce", () => {
    const r = parseReceipt("ALBERT CR\nIČO 44012373\nRohlík 3,90\nCELKEM K ÚHRADĚ 1 234,50 Kč\n08.11.26");
    expect(r).toMatchObject({ amount: 123450, currency: "CZK", date: "2026-11-08", merchant: "ALBERT CR" });
  });
  it("bez slova celkem vezme nejvyšší částku", () => {
    expect(parseReceipt("Konoba Mate\n2 x Pivo 6,00\nRiba 18,50\n€").amount).toBe(1850);
  });
});
