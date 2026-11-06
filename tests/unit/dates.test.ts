import { describe, expect, it } from "vitest";
import { addMonths, diffDays, endOfWeek, monthsBetween, parseCzechDate, startOfWeek, todayISO } from "@/lib/dates";
import { occurrences } from "@/lib/finance/recurrence";

describe("dates", () => {
  it("dnešek v Praze", () => {
    expect(todayISO(new Date("2026-11-06T23:30:00Z"))).toBe("2026-11-07");
    expect(todayISO(new Date("2026-07-01T21:59:00Z"))).toBe("2026-07-01");
  });
  it("měsíce s krátkým koncem", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2028-01-31", 1)).toBe("2028-02-29");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("týden začíná pondělím", () => {
    expect(startOfWeek("2026-11-06")).toBe("2026-11-02");
    expect(endOfWeek("2026-11-08")).toBe("2026-11-08");
  });
  it("rozdíly", () => {
    expect(diffDays("2026-03-28", "2026-03-30")).toBe(2); // přes změnu času
    expect(monthsBetween("2026-11-01", "2027-02-01")).toBe(3);
  });
  it("parsuje české datum", () => {
    expect(parseCzechDate("6. 11. 2026")).toBe("2026-11-06");
    expect(parseCzechDate("31.2.2026")).toBeNull();
    expect(parseCzechDate("1.1.27")).toBe("2027-01-01");
  });
  it("opakování plateb drží den v měsíci", () => {
    const s = { frequency: "monthly" as const, start_date: "2026-01-31" };
    expect(occurrences(s, "2026-01-01", "2026-04-30")).toEqual(["2026-01-31", "2026-02-28", "2026-03-31", "2026-04-30"]);
    expect(occurrences({ frequency: "weekly", start_date: "2026-11-02", end_date: "2026-11-16" }, "2026-11-01", "2026-12-31")).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(occurrences({ frequency: "once", start_date: "2026-11-10" }, "2026-11-01", "2026-11-30")).toEqual(["2026-11-10"]);
  });
});
