import { describe, expect, it } from "vitest";
import { computeBill } from "./pricing";
import { pctOfPaise, divRoundHalfEven, formatRupees } from "./money";
import { DEFAULT_PRICING } from "./constants";
import type { CartLine, MenuItemRef } from "./types";

const base = (price: number, name = "Cheese Burst"): MenuItemRef => ({ id: "b", name, price_paise: price });
const pizza = (price: number, name = "BBQ Chicken"): MenuItemRef => ({ id: "p", name, price_paise: price, is_veg: false });
const topping = (price: number, name = "Extra Cheese"): MenuItemRef => ({ id: "t", name, price_paise: price });

describe("banker's rounding", () => {
  it("rounds exact halves to even (integer paise)", () => {
    // 1.5 -> 2, 2.5 -> 2, 3.5 -> 4, 4.5 -> 4  (denominator 2)
    expect(divRoundHalfEven(3n, 2n)).toBe(2n);
    expect(divRoundHalfEven(5n, 2n)).toBe(2n);
    expect(divRoundHalfEven(7n, 2n)).toBe(4n);
    expect(divRoundHalfEven(9n, 2n)).toBe(4n);
  });
  it("pctOfPaise matches Decimal ROUND_HALF_EVEN", () => {
    expect(pctOfPaise(338500, 10)).toBe(33850); // exact
    expect(pctOfPaise(304650, 18)).toBe(54837); // exact
  });
});

describe("computeBill — Stage 2 parity", () => {
  it("canonical order: Cheese Burst(229)+BBQ(379)+Extra Cheese(69), qty=5 → ₹3,594.87", () => {
    const cart: CartLine[] = [
      { base: base(22900), pizza: pizza(37900), toppings: [topping(6900)], qty: 5 },
    ];
    const bill = computeBill(cart, DEFAULT_PRICING);
    expect(bill.lines[0].unit_paise).toBe(67700); // 229+379+69 = 677.00
    expect(bill.subtotal_paise).toBe(338500);
    expect(bill.discount_applied).toBe(true);
    expect(bill.discount_paise).toBe(33850); // 10%
    expect(bill.gst_paise).toBe(54837); // 18% of 304650
    expect(bill.total_paise).toBe(359487);
    expect(formatRupees(bill.total_paise)).toBe("₹3,594.87");
  });

  it("no discount below threshold (qty=4)", () => {
    const cart: CartLine[] = [
      { base: base(22900), pizza: pizza(37900), toppings: [topping(6900)], qty: 4 },
    ];
    const bill = computeBill(cart, DEFAULT_PRICING);
    expect(bill.discount_applied).toBe(false);
    expect(bill.discount_paise).toBe(0);
    // subtotal 270800, gst 18% = 48744, total 319544
    expect(bill.subtotal_paise).toBe(270800);
    expect(bill.gst_paise).toBe(48744);
    expect(bill.total_paise).toBe(319544);
  });

  it("multi-line cart sums qty across lines for the discount gate", () => {
    const cart: CartLine[] = [
      { base: base(14900), pizza: pizza(29900), toppings: [], qty: 3 },
      { base: base(22900), pizza: pizza(37900), toppings: [topping(3900)], qty: 2 },
    ];
    const bill = computeBill(cart, DEFAULT_PRICING);
    expect(bill.quantity_total).toBe(5);
    expect(bill.discount_applied).toBe(true); // 3+2 >= 5
  });

  it("live-modify demo: lowering threshold to 3 makes a qty-3 order discountable", () => {
    const cart: CartLine[] = [{ base: base(14900), pizza: pizza(29900), toppings: [], qty: 3 }];
    expect(computeBill(cart, DEFAULT_PRICING).discount_applied).toBe(false);
    expect(computeBill(cart, { ...DEFAULT_PRICING, discount_threshold: 3 }).discount_applied).toBe(true);
  });
});

describe("veg classification", () => {
  it("a line with a non-veg component is non-veg", () => {
    const cart: CartLine[] = [{ base: base(14900), pizza: pizza(29900), toppings: [], qty: 1 }];
    expect(computeBill(cart, DEFAULT_PRICING).lines[0].is_veg).toBe(false);
  });
  it("all-veg components → veg", () => {
    const vBase: MenuItemRef = { id: "b", name: "Thin", price_paise: 14900, is_veg: true };
    const vPizza: MenuItemRef = { id: "p", name: "Margherita", price_paise: 29900, is_veg: true };
    const cart: CartLine[] = [{ base: vBase, pizza: vPizza, toppings: [], qty: 1 }];
    expect(computeBill(cart, DEFAULT_PRICING).lines[0].is_veg).toBe(true);
  });
});
