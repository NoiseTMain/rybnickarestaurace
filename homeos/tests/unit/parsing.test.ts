import { describe, expect, it } from "vitest";
import { extractInvoice, isValidIco } from "@/lib/invoice-parse";
import { detectDelimiter, fingerprint, parseCSV, toCSV } from "@/lib/csv";
import { extractAmount } from "@/lib/assistant";

const INVOICE = `
FAKTURA - DAŇOVÝ DOKLAD č. 2026-0142
Dodavatel:
Servis Novák s.r.o.
Hlavní 12, Praha
IČO: 27082440
DIČ: CZ27082440
Odběratel: Jana Nováková
IČO: 12345678
Datum vystavení: 3. 11. 2026
Datum splatnosti: 17.11.2026
Variabilní symbol: 20260142
Celkem k úhradě: 12 345,60 Kč
`;

describe("vytěžení faktury (OCR text)", () => {
  it("najde všechna pole", () => {
    const r = extractInvoice(INVOICE, "12345678");
    expect(r.number.value).toBe("2026-0142");
    expect(r.counterparty.value).toBe("Servis Novák s.r.o.");
    expect(r.counterpartyIco.value).toBe("27082440");
    expect(r.counterpartyIco.confidence).toBe("high");
    expect(r.issueDate.value).toBe("2026-11-03");
    expect(r.dueDate.value).toBe("2026-11-17");
    expect(r.amount.value).toBe(1234560);
    expect(r.amount.confidence).toBe("high");
    expect(r.variableSymbol.value).toBe("20260142");
  });
  it("vlastní IČO přeskočí, nenalezená pole označí", () => {
    const r = extractInvoice("Nějaký text bez údajů IČO 12345678", "12345678");
    expect(r.counterpartyIco.value).toBeNull();
    expect(r.amount.confidence).toBe("none");
    expect(r.issueDate.value).toBeNull();
  });
  it("kontrola IČO", () => {
    expect(isValidIco("27082440")).toBe(true);
    expect(isValidIco("27082441")).toBe(false);
  });
});

describe("CSV", () => {
  it("parsuje bankovní export se středníkem a uvozovkami", () => {
    const t = '﻿Datum;Částka;Popis\r\n01.11.2026;"-1 234,50";"Albert; Praha"\r\n02.11.2026;30000;"Mzda ""listopad"""\r\n';
    expect(detectDelimiter(t)).toBe(";");
    expect(parseCSV(t)).toEqual([["Datum", "Částka", "Popis"], ["01.11.2026", "-1 234,50", "Albert; Praha"], ["02.11.2026", "30000", 'Mzda "listopad"']]);
  });
  it("export a zpětné načtení", () => {
    const csv = toCSV([["a", 'b"c', "d;e"]]);
    expect(parseCSV(csv)).toEqual([["a", 'b"c', "d;e"]]);
  });
  it("stabilní otisk pro deduplikaci", () => {
    expect(fingerprint(["a", 1])).toBe(fingerprint(["a", 1]));
    expect(fingerprint(["a", 1])).not.toBe(fingerprint(["a", 2]));
  });
});

describe("částka v otázce", () => {
  it.each([
    ["Můžeme si dovolit sedačku za 15 000 Kč?", 1_500_000],
    ["koupit pračku za 9990", 999_000],
    ["auto za 250 tis", 25_000_000],
    ["dovolená 1,5 mil", 150_000_000],
    ["kolo za 12k", 1_200_000],
  ])("%s", (q, c) => expect(extractAmount(q)).toBe(c));
});
