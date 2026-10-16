import { describe, expect, it } from "vitest";
import {
  addDays,
  formatMenuDate,
  isOpenNow,
  isValidIsoDate,
  pragueLocalToUtcIso,
  pragueToday,
  utcIsoToPragueLocal,
} from "@/lib/time";

describe("Europe/Prague", () => {
  it("dnešek se počítá v pražském čase, ne v UTC", () => {
    // 22:30 UTC 15. 10. = 00:30 SELČ 16. 10.
    expect(pragueToday(new Date("2026-10-15T22:30:00Z"))).toBe("2026-10-16");
    // 23:30 UTC 15. 1. = 00:30 SEČ 16. 1.
    expect(pragueToday(new Date("2026-01-15T23:30:00Z"))).toBe("2026-01-16");
    expect(pragueToday(new Date("2026-01-15T22:59:00Z"))).toBe("2026-01-15");
  });

  it("převod místního času na UTC (letní i zimní čas)", () => {
    expect(pragueLocalToUtcIso("2026-07-01T20:45")).toBe("2026-07-01T18:45:00.000Z");
    expect(pragueLocalToUtcIso("2026-12-01T20:45")).toBe("2026-12-01T19:45:00.000Z");
    // den změny času (25. 10. 2026 ve 3:00 SELČ → 2:00 SEČ)
    expect(pragueLocalToUtcIso("2026-10-25T12:00")).toBe("2026-10-25T11:00:00.000Z");
    expect(pragueLocalToUtcIso("2026-03-29T12:00")).toBe("2026-03-29T10:00:00.000Z");
  });

  it("zpětný převod pro formuláře", () => {
    expect(utcIsoToPragueLocal("2026-07-01T18:45:00Z")).toBe("2026-07-01T20:45");
    expect(utcIsoToPragueLocal(pragueLocalToUtcIso("2026-11-14T09:05"))).toBe("2026-11-14T09:05");
  });

  it("formát data menu", () => {
    expect(formatMenuDate("2026-10-16")).toBe("pátek 16. 10. 2026");
    expect(formatMenuDate("2026-10-18", { weekday: false })).toBe("18. 10. 2026");
    expect(formatMenuDate("2026-10-19", { year: false })).toBe("pondělí 19. 10.");
  });

  it("validace a posun dat", () => {
    expect(isValidIsoDate("2026-02-29")).toBe(false);
    expect(isValidIsoDate("2028-02-29")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("isOpenNow", () => {
  const hours = [
    { day: 5, closed: false, intervals: [{ open: "11:00", close: "14:00" }, { open: "17:00", close: "01:00" }] },
    { day: 6, closed: false, intervals: [{ open: "11:00", close: "23:00" }] },
    { day: 7, closed: true, intervals: [] },
  ];
  it("pracuje s pražským časem a intervaly přes půlnoc", () => {
    expect(isOpenNow(hours, new Date("2026-10-16T10:00:00Z"))).toBe(true); // pá 12:00
    expect(isOpenNow(hours, new Date("2026-10-16T13:00:00Z"))).toBe(false); // pá 15:00
    expect(isOpenNow(hours, new Date("2026-10-16T22:30:00Z"))).toBe(true); // so 00:30 (z pátku)
    expect(isOpenNow(hours, new Date("2026-10-17T23:30:00Z"))).toBe(false); // ne 01:30
  });
  it("bez vyplněné doby vrací null", () => {
    expect(isOpenNow([])).toBeNull();
  });
});
