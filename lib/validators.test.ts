import { describe, expect, it } from "vitest";
import {
  validateName,
  validatePhone,
  validatePizzaQty,
  validatePayment,
  validateToppings,
} from "./validators";

describe("validateName (optional in Stage 3)", () => {
  it("accepts empty / whitespace-only as blank", () => {
    expect(validateName("")).toEqual({ ok: true, value: "" });
    expect(validateName("   ")).toEqual({ ok: true, value: "" });
    expect(validateName(null)).toEqual({ ok: true, value: "" });
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
