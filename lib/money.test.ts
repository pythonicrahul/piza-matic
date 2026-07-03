import { describe, expect, it } from "vitest";
import { divRoundHalfEven, pctOfPaise, formatRupees, rupeesPlain } from "./money";

describe("divRoundHalfEven", () => {
  it("rounds down below the half", () => {
    expect(divRoundHalfEven(14n, 10n)).toBe(1n); // 1.4 -> 1
  });
  it("rounds up above the half", () => {
    expect(divRoundHalfEven(16n, 10n)).toBe(2n); // 1.6 -> 2
  });
  it("ties go to the nearest EVEN integer", () => {
    expect(divRoundHalfEven(1n, 2n)).toBe(0n); // 0.5 -> 0
    expect(divRoundHalfEven(3n, 2n)).toBe(2n); // 1.5 -> 2
    expect(divRoundHalfEven(5n, 2n)).toBe(2n); // 2.5 -> 2
    expect(divRoundHalfEven(7n, 2n)).toBe(4n); // 3.5 -> 4
  });
  it("is exact when evenly divisible", () => {
    expect(divRoundHalfEven(100n, 10n)).toBe(10n);
  });
  it("throws on non-positive denominator", () => {
    expect(() => divRoundHalfEven(1n, 0n)).toThrow();
  });
});

describe("pctOfPaise", () => {
  it("computes exact percentages", () => {
    expect(pctOfPaise(338500, 10)).toBe(33850);
    expect(pctOfPaise(304650, 18)).toBe(54837);
    expect(pctOfPaise(10000, 18)).toBe(1800);
  });
  it("applies banker's rounding on exact halves", () => {
    // 5 * 10% = 0.5 paise -> even -> 0
    expect(pctOfPaise(5, 10)).toBe(0);
    // 15 * 10% = 1.5 paise -> even -> 2
    expect(pctOfPaise(15, 10)).toBe(2);
    // 25 * 10% = 2.5 -> even -> 2
    expect(pctOfPaise(25, 10)).toBe(2);
  });
  it("handles fractional-percent settings (2 dp)", () => {
    expect(pctOfPaise(100000, 12.5)).toBe(12500);
  });
  it("zero amount → zero", () => {
    expect(pctOfPaise(0, 18)).toBe(0);
  });
});

describe("formatRupees", () => {
  it("formats with Indian grouping and 2-dp paise", () => {
    expect(formatRupees(359487)).toBe("₹3,594.87");
    expect(formatRupees(6700)).toBe("₹67.00");
    expect(formatRupees(5)).toBe("₹0.05");
    expect(formatRupees(0)).toBe("₹0.00");
  });
  it("groups lakhs in the Indian system", () => {
    expect(formatRupees(1000000)).toBe("₹10,000.00");
    expect(formatRupees(10000000)).toBe("₹1,00,000.00");
  });
  it("handles negatives", () => {
    expect(formatRupees(-33850)).toBe("-₹338.50");
  });
});

describe("rupeesPlain", () => {
  it("returns unformatted rupees.paise", () => {
    expect(rupeesPlain(359487)).toBe("3594.87");
    expect(rupeesPlain(6700)).toBe("67.00");
    expect(rupeesPlain(9)).toBe("0.09");
  });
});
