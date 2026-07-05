import { describe, expect, it } from "vitest";
import { resolveProposal, type ChatLimits } from "./chat";
import type { Menu, MenuItem } from "@/lib/data/menu";

function item(category: MenuItem["category"], name: string, price: number, is_veg = true, sort = 0): MenuItem {
  return {
    id: `${category}-${name}`.toLowerCase().replace(/\s+/g, "-"),
    category,
    external_id: name,
    name,
    price_paise: price,
    is_veg,
    is_available: true,
    sort_order: sort,
  };
}

const menu: Menu = {
  base: [item("base", "Thin Crust", 0), item("base", "Cheese Burst", 22900)],
  pizza: [item("pizza", "Margherita", 24900, true), item("pizza", "BBQ Chicken", 37900, false)],
  topping: [
    item("topping", "Extra Cheese", 6900, true),
    item("topping", "Olives", 3900, true),
    item("topping", "Jalapenos", 4900, true),
    item("topping", "Chicken Tikka", 9900, false),
  ],
};

const limits: ChatLimits = { maxToppings: 3, maxPizzas: 10 };

describe("resolveProposal (chat menu guardrail)", () => {
  it("resolves a valid proposal to real refs and computes the unit price", () => {
    const p = resolveProposal(
      { pizza: "Margherita", base: "Cheese Burst", toppings: ["Extra Cheese", "Olives"], qty: 2, why: "Cheesy & hearty" },
      menu,
      limits,
    );
    expect(p).not.toBeNull();
    expect(p!.pizza.name).toBe("Margherita");
    expect(p!.base.name).toBe("Cheese Burst");
    expect(p!.toppings.map((t) => t.name)).toEqual(["Extra Cheese", "Olives"]);
    expect(p!.qty).toBe(2);
    // 24900 (pizza) + 22900 (base) + 6900 + 3900
    expect(p!.unit_paise).toBe(58600);
  });

  it("rejects an unknown pizza (no card shown)", () => {
    expect(resolveProposal({ pizza: "Pineapple Supreme", base: "Thin Crust" }, menu, limits)).toBeNull();
  });

  it("rejects an unknown base", () => {
    expect(resolveProposal({ pizza: "Margherita", base: "Stuffed Crust" }, menu, limits)).toBeNull();
  });

  it("drops unknown toppings but keeps valid ones", () => {
    const p = resolveProposal({ pizza: "Margherita", base: "Thin Crust", toppings: ["Olives", "Truffle Dust"] }, menu, limits);
    expect(p!.toppings.map((t) => t.name)).toEqual(["Olives"]);
  });

  it("caps toppings at the limit", () => {
    const p = resolveProposal(
      { pizza: "Margherita", base: "Thin Crust", toppings: ["Extra Cheese", "Olives", "Jalapenos", "Chicken Tikka"] },
      menu,
      limits,
    );
    expect(p!.toppings.length).toBe(3);
  });

  it("de-dupes repeated toppings", () => {
    const p = resolveProposal({ pizza: "Margherita", base: "Thin Crust", toppings: ["Olives", "Olives"] }, menu, limits);
    expect(p!.toppings.length).toBe(1);
  });

  it("clamps quantity into [1, maxPizzas]", () => {
    expect(resolveProposal({ pizza: "Margherita", base: "Thin Crust", qty: 99 }, menu, limits)!.qty).toBe(10);
    expect(resolveProposal({ pizza: "Margherita", base: "Thin Crust", qty: 0 }, menu, limits)!.qty).toBe(1);
    expect(resolveProposal({ pizza: "Margherita", base: "Thin Crust", qty: -3 }, menu, limits)!.qty).toBe(1);
  });

  it("defaults quantity to 1 when missing or non-numeric", () => {
    expect(resolveProposal({ pizza: "Margherita", base: "Thin Crust" }, menu, limits)!.qty).toBe(1);
    expect(resolveProposal({ pizza: "Margherita", base: "Thin Crust", qty: "lots" }, menu, limits)!.qty).toBe(1);
  });

  it("matches names case-insensitively", () => {
    const p = resolveProposal({ pizza: "margherita", base: "  cheese burst ", toppings: ["EXTRA CHEESE"] }, menu, limits);
    expect(p!.pizza.name).toBe("Margherita");
    expect(p!.base.name).toBe("Cheese Burst");
    expect(p!.toppings[0].name).toBe("Extra Cheese");
  });

  it("rejects junk input", () => {
    expect(resolveProposal(null, menu, limits)).toBeNull();
    expect(resolveProposal("nope", menu, limits)).toBeNull();
    expect(resolveProposal({}, menu, limits)).toBeNull();
  });
});
