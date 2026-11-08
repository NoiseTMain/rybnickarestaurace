import { describe, expect, it } from "vitest";
import { KB, kbPhrasings, searchKb } from "@/lib/assistant-kb";

describe("znalostní báze asistenta", () => {
  it("je rozsáhlá", () => {
    expect(KB.length).toBeGreaterThanOrEqual(120);
    expect(kbPhrasings()).toBeGreaterThanOrEqual(1000);
  });
  it.each([
    ["Co je RPSN?", "RPSN je roční"],
    ["Jak funguje paušální daň?", "Paušální daň"],
    ["Kolik bych měl mít nouzovou rezervu?", "3–6 měsíců"],
    ["Jak přidám výdaj?", "Přidat výdaj"],
    ["Mám nárok na přídavek na dítě?", "Přídavek na dítě"],
    ["Jak investovat jako začátečník?", "indexových fondů"],
    ["Platit v zahraničí v eurech nebo korunách?", "místní měně"],
    ["Jak zrušit předplatné premium?", "Spravovat předplatné"],
    ["co znamená volné k utracení", "navíc"],
    ["kolik bílkovin denně", "1,6–2 g"],
    ["Existuje ještě sleva na studenta?", "zrušili"],
    ["jak se zbavit dluhů", "lavina"],
  ])("%s", (q, expected) => {
    expect(searchKb(q)?.a).toContain(expected);
  });
  it("nesmyslná otázka nic nenajde", () => {
    expect(searchKb("xyz qwerty")).toBeNull();
  });
});
