import { describe, expect, it } from "vitest";
import { parseAres } from "@/lib/ares";

describe("ARES", () => {
  it("přečte údaje subjektu", () => {
    const info = parseAres({
      ico: "27082440", obchodniJmeno: "Alza.cz a.s.", pravniForma: "121", dic: "CZ27082440", datumVzniku: "2003-08-26",
      sidlo: { textovaAdresa: "Jankovcova 1522/53, Holešovice, 17000 Praha 7" },
    }, "27082440");
    expect(info).toMatchObject({
      ico: "27082440", name: "Alza.cz a.s.", legalForm: "Akciová společnost", dic: "CZ27082440", established: "2003-08-26",
      address: "Jankovcova 1522/53, Holešovice, 17000 Praha 7", verified: true, source: "ares",
    });
  });
  it("živnostník", () => {
    expect(parseAres({ pravniForma: "101", obchodniJmeno: "Jan Novák" }, "12345679").legalForm).toBe("Fyzická osoba podnikající (živnostník)");
  });
});
