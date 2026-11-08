import { describe, expect, it } from "vitest";
import { czAccountToIban, normalizeIban, spdString } from "@/lib/qr-payment";

describe("QR platba", () => {
  it("převod českého účtu na IBAN", () => {
    expect(czAccountToIban("19-2000145399/0800")).toBe("CZ6508000000192000145399");
    expect(normalizeIban(czAccountToIban("2000145399/0800")!)).toBe("CZ7908000000002000145399"); // platný kontrolní součet
    expect(czAccountToIban("124/0800")).toBeNull(); // neprojde kontrolou modulo 11
  });
  it("IBAN a text SPD", () => {
    expect(normalizeIban("CZ65 0800 0000 1920 0014 5399")).toBe("CZ6508000000192000145399");
    expect(normalizeIban("CZ00 0800 0000 1920 0014 5399")).toBeNull();
    expect(spdString({ iban: "CZ6508000000192000145399", amount: 56632, message: "Vídeň – vyrovnání*" })).toBe("SPD*1.0*ACC:CZ6508000000192000145399*AM:566.32*CC:CZK*MSG:Viden – vyrovnani");
  });
});
