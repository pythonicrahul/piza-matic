import { describe, expect, it } from "vitest";
import {
  validateName,
  validatePhone,
  validatePizzaQty,
  validatePayment,
  validateToppings,
  validatePricePaise,
} from "./validators";

describe("validatePricePaise (admin menu editing)", () => {
  it("accepts a valid whole-paise price", () => {
    const r = validatePricePaise(22900);
    expect(r.ok && r.value).toBe(22900);
  });

  it("accepts zero (e.g. a free base)", () => {
    expect(validatePricePaise(0).ok).toBe(true);
  });

  it("coerces numeric strings", () => {
    const r = validatePricePaise("4950");
    expect(r.ok && r.value).toBe(4950);
  });

  it("rejects negatives", () => {
    expect(validatePricePaise(-1).ok).toBe(false);
  });

  it("rejects non-integers (fractional paise)", () => {
    expect(validatePricePaise(49.5).ok).toBe(false);
  });

  it("rejects non-numbers", () => {
    expect(validatePricePaise("free").ok).toBe(false);
    expect(validatePricePaise(NaN).ok).toBe(false);
  });

  it("rejects absurdly high prices", () => {
    expect(validatePricePaise(10_000_001).ok).toBe(false);
  });
});

describe("validateName (required)", () => {
  it("rejects empty / whitespace-only", () => {
    expect(validateName("").ok).toBe(false);
    expect(validateName("   ").ok).toBe(false);
    expect(validateName(null).ok).toBe(false);
  });
  it("accepts valid names", () => {
    expect(validateName("Al")).toEqual({ ok: true, value: "Al" });
    expect(validateName("John Doe")).toEqual({ ok: true, value: "John Doe" });
  });
  it("rejects too-short, digits, symbols", () => {
    expect(validateName("A").ok).toBe(false); // < 2 chars
    expect(validateName("John3").ok).toBe(false);
    expect(validateName("O'Brien").ok).toBe(false);
    expect(validateName("a".repeat(41)).ok).toBe(false); // > 40
  });
});

describe("validatePhone", () => {
  it("accepts 10-digit numbers starting 6-9", () => {
    for (const p of ["9876543210", "6000000000", "7123456789", "8123456789"]) {
      expect(validatePhone(p)).toEqual({ ok: true, value: p });
    }
  });
  it("normalizes real-world formats to canonical 10 digits", () => {
    for (const p of ["+91 98765 43210", "98765-43210", "919876543210", "098765 43210", "+91-98765-43210"]) {
      expect(validatePhone(p)).toEqual({ ok: true, value: "9876543210" });
    }
  });
  it("rejects bad formats", () => {
    expect(validatePhone("").ok).toBe(false);
    expect(validatePhone("1234567890").ok).toBe(false); // starts with 1
    expect(validatePhone("5123456789").ok).toBe(false); // starts with 5
    expect(validatePhone("98765").ok).toBe(false); // too short
    expect(validatePhone("98765432101").ok).toBe(false); // too long
    expect(validatePhone("98765abcde").ok).toBe(false);
  });
});

describe("validatePizzaQty", () => {
  it("accepts 1..maxAllowed", () => {
    expect(validatePizzaQty("1", 10)).toEqual({ ok: true, value: 1 });
    expect(validatePizzaQty(3, 10)).toEqual({ ok: true, value: 3 });
    expect(validatePizzaQty("10", 10)).toEqual({ ok: true, value: 10 });
  });
  it("rejects zero, negatives, floats, words, empty", () => {
    expect(validatePizzaQty("0", 10).ok).toBe(false);
    expect(validatePizzaQty("-1", 10).ok).toBe(false);
    expect(validatePizzaQty("2.5", 10).ok).toBe(false);
    expect(validatePizzaQty("three", 10).ok).toBe(false);
    expect(validatePizzaQty("", 10).ok).toBe(false);
  });
  it("rejects over the remaining cap", () => {
    expect(validatePizzaQty("4", 3).ok).toBe(false);
    expect(validatePizzaQty("2", 1).ok).toBe(false);
  });
});

describe("validatePayment", () => {
  it("maps numeric and named modes", () => {
    expect(validatePayment("1")).toEqual({ ok: true, value: "cash" });
    expect(validatePayment("2")).toEqual({ ok: true, value: "card" });
    expect(validatePayment("3")).toEqual({ ok: true, value: "upi" });
    expect(validatePayment("cash")).toEqual({ ok: true, value: "cash" });
    expect(validatePayment("UPI")).toEqual({ ok: true, value: "upi" });
  });
  it("rejects unknown / empty", () => {
    expect(validatePayment("").ok).toBe(false);
    expect(validatePayment("9").ok).toBe(false);
    expect(validatePayment("bitcoin").ok).toBe(false);
  });
});

describe("validateToppings", () => {
  it("accepts within cap, no dupes", () => {
    expect(validateToppings(["a", "b"], 5)).toEqual({ ok: true, value: ["a", "b"] });
    expect(validateToppings([], 5)).toEqual({ ok: true, value: [] });
  });
  it("rejects over cap", () => {
    expect(validateToppings(["a", "b", "c"], 2).ok).toBe(false);
  });
  it("rejects duplicates", () => {
    expect(validateToppings(["a", "a"], 5).ok).toBe(false);
  });
});
