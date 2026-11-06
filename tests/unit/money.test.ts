import { describe, expect, it } from "vitest";
import { add, divCeil, divFloor, divRound, formatMoney, mulQuantity, parseMoney, sub, sum, toInputValue } from "@/lib/money";

describe("money", () => {
  it("parsuje české i anglické zápisy do haléřů bez floatů", () => {
    expect(parseMoney("1 234,50")).toBe(123450);
    expect(parseMoney("1234.5")).toBe(123450);
    expect(parseMoney("1 234 Kč")).toBe(123400);
    expect(parseMoney("1.234,56")).toBe(123456);
    expect(parseMoney("0,1")).toBe(10);
    expect(parseMoney("-50")).toBe(-5000);
    expect(parseMoney("12 000,-")).toBe(1200000);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("")).toBeNull();
    expect(parseMoney("1,234")).toBeNull(); // nejednoznačné
  });

  it("0,1 + 0,2 = 0,3 přesně", () => {
    expect(add(parseMoney("0,1")!, parseMoney("0,2")!)).toBe(30);
    expect(sum([10, 20, 30], (x) => x)).toBe(60);
    expect(sub(30, 10)).toBe(20);
  });

  it("odmítá necelé haléře", () => {
    expect(() => add(0.5)).toThrow();
  });

  it("dělení se zaokrouhlením", () => {
    expect(divFloor(1000, 3)).toBe(333);
    expect(divRound(1000, 3)).toBe(333);
    expect(divRound(1001, 2)).toBe(501);
    expect(divRound(-1001, 2)).toBe(-501);
    expect(divCeil(1000, 3)).toBe(334);
  });

  it("násobí desetinným množstvím", () => {
    expect(mulQuantity(450, "12,5")).toBe(5625);
    expect(mulQuantity(333, "0.1")).toBe(33);
    expect(mulQuantity(100, 3)).toBe(300);
  });

  it("formátuje česky", () => {
    expect(formatMoney(1200000)).toBe("12 000 Kč");
    expect(formatMoney(123450)).toBe("1 234,50 Kč");
    expect(formatMoney(-5000)).toBe("−50 Kč");
    expect(toInputValue(123405)).toBe("1234,05");
  });
});
