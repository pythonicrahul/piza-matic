import { describe, expect, it } from "vitest";
import { repriceCart, CartError, type CartLinePayload } from "@/lib/cart";
import type { MenuItem } from "@/lib/data/menu";
import type { ShopSettings } from "@/lib/data/settings";
import { DEFAULT_PRICING, SHOP } from "@/lib/constants";

const settings: ShopSettings = {
  ...DEFAULT_PRICING,
  shop_lat: SHOP.lat,
  shop_lng: SHOP.lng,
  delivery_radius_km: 4,
};

function item(
  id: string,
  category: MenuItem["category"],
  price: number,
  name: string,
  is_veg: boolean | null = null,
): MenuItem {
  return { id, category, external_id: id, name, price_paise: price, is_veg, is_available: true, sort_order: 0 };
}

const base = item("b1", "base", 22900, "Cheese Burst", true);
const pizza = item("p1", "pizza", 37900, "BBQ Chicken", false);
const t1 = item("t1", "topping", 6900, "Extra Cheese", true);
const t2 = item("t2", "topping", 3900, "Olives", true);

const menu = new Map<string, MenuItem>([
  [base.id, base],
  [pizza.id, pizza],
  [t1.id, t1],
  [t2.id, t2],
]);

const line = (over: Partial<CartLinePayload> = {}): CartLinePayload => ({
  baseId: "b1",
  pizzaId: "p1",
  toppingIds: ["t1"],
  qty: 5,
  ...over,
});

describe("repriceCart", () => {
  it("prices a valid cart (canonical ₹3,594.87)", () => {
    const { bill } = repriceCart([line()], menu, settings);
    expect(bill.total_paise).toBe(359487);
    expect(bill.discount_applied).toBe(true);
    expect(bill.lines[0].is_veg).toBe(false); // non-veg pizza
  });

  it("rejects an empty cart", () => {
    expect(() => repriceCart([], menu, settings)).toThrow(CartError);
  });

  it("rejects an unknown base", () => {
    expect(() => repriceCart([line({ baseId: "nope" })], menu, settings)).toThrow(CartError);
  });

  it("rejects a wrong-category id (topping used as base)", () => {
    expect(() => repriceCart([line({ baseId: "t1" })], menu, settings)).toThrow(/base isn't available/);
  });

  it("rejects an unknown pizza", () => {
    expect(() => repriceCart([line({ pizzaId: "ghost" })], menu, settings)).toThrow(CartError);
  });

  it("rejects a duplicate topping", () => {
    expect(() => repriceCart([line({ toppingIds: ["t1", "t1"] })], menu, settings)).toThrow(/duplicate/);
  });

  it("rejects more toppings than the cap", () => {
    const strict = { ...settings, max_toppings: 1 };
    expect(() => repriceCart([line({ toppingIds: ["t1", "t2"] })], menu, strict)).toThrow(/maximum 1 toppings/);
  });

  it("rejects over the pizza cap (qty sum > max_pizzas)", () => {
    expect(() => repriceCart([line({ qty: 11 })], menu, settings)).toThrow(/Maximum 10 pizzas/);
  });

  it("rejects invalid quantity", () => {
    expect(() => repriceCart([line({ qty: 0 })], menu, settings)).toThrow(/invalid quantity/);
  });

  it("sums quantity across lines for the discount gate", () => {
    const cart = [line({ qty: 3, toppingIds: [] }), line({ qty: 2, toppingIds: [] })];
    expect(repriceCart(cart, menu, settings).bill.discount_applied).toBe(true);
    // one fewer → below threshold
    const belowCart = [line({ qty: 2, toppingIds: [] }), line({ qty: 2, toppingIds: [] })];
    expect(repriceCart(belowCart, menu, settings).bill.discount_applied).toBe(false);
  });
});
