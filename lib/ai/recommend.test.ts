import { describe, expect, it } from "vitest";
import { validateRecommendation } from "./recommend";

const menu = {
  bases: ["Thin Crust", "Cheese Burst"],
  pizzas: ["Margherita", "BBQ Chicken"],
  toppings: ["Extra Cheese", "Olives"],
};

describe("validateRecommendation (menu guardrail)", () => {
  it("accepts a valid suggestion", () => {
    const rec = validateRecommendation(
      { pizza: "BBQ Chicken", base: "Cheese Burst", topping: "Extra Cheese", reason: "You loved it." },
      menu,
    );
    expect(rec).toEqual({
      pizza: "BBQ Chicken",
      base: "Cheese Burst",
      topping: "Extra Cheese",
      reason: "You loved it.",
    });
  });

  it("rejects a hallucinated pizza", () => {
    expect(validateRecommendation({ pizza: "Truffle Supreme", base: "Thin Crust" }, menu)).toBeNull();
  });

  it("rejects a hallucinated base", () => {
    expect(validateRecommendation({ pizza: "Margherita", base: "Gold Crust" }, menu)).toBeNull();
  });

  it("drops an invalid topping to null instead of failing", () => {
    const rec = validateRecommendation({ pizza: "Margherita", base: "Thin Crust", topping: "Caviar" }, menu);
    expect(rec?.topping).toBeNull();
  });

  it("accepts a null topping", () => {
    const rec = validateRecommendation({ pizza: "Margherita", base: "Thin Crust", topping: null }, menu);
    expect(rec?.topping).toBeNull();
  });

  it("supplies a default reason when missing", () => {
    const rec = validateRecommendation({ pizza: "Margherita", base: "Thin Crust" }, menu);
    expect(rec?.reason).toBeTruthy();
  });
});
