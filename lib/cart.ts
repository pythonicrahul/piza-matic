import "server-only";

// Server-authoritative cart handling. The client sends only item IDs + quantities;
// the server re-reads prices from the DB, validates every selection, and computes
// the bill. Client-sent prices/totals are never trusted.

import { computeBill } from "./pricing";
import type { MenuItem } from "./data/menu";
import type { ShopSettings } from "./data/settings";
import type { Bill, CartLine } from "./types";

export interface CartLinePayload {
  baseId: string;
  pizzaId: string;
  toppingIds: string[];
  qty: number;
}

export interface RepricedCart {
  bill: Bill;
  cart: CartLine[];
}

/** Thrown for any invalid cart (unknown item, wrong category, bad qty, over caps). */
export class CartError extends Error {}

function buildCartLines(
  payload: CartLinePayload[],
  menu: Map<string, MenuItem>,
  maxToppings: number,
): CartLine[] {
  return payload.map((line, i) => {
    const n = i + 1;
    const base = menu.get(line.baseId);
    const pizza = menu.get(line.pizzaId);
    if (!base || base.category !== "base") throw new CartError(`Line ${n}: that base isn't available.`);
    if (!pizza || pizza.category !== "pizza") throw new CartError(`Line ${n}: that pizza isn't available.`);

    const toppings = (line.toppingIds ?? []).map((id) => {
      const t = menu.get(id);
      if (!t || t.category !== "topping") throw new CartError(`Line ${n}: a selected topping isn't available.`);
      return t;
    });
    if (new Set(line.toppingIds ?? []).size !== (line.toppingIds ?? []).length) {
      throw new CartError(`Line ${n}: duplicate topping.`);
    }
    if (toppings.length > maxToppings) {
      throw new CartError(`Line ${n}: maximum ${maxToppings} toppings per pizza.`);
    }

    const qty = Number(line.qty);
    if (!Number.isInteger(qty) || qty < 1) throw new CartError(`Line ${n}: invalid quantity.`);

    return { base, pizza, toppings, qty };
  });
}

export function repriceCart(
  payload: CartLinePayload[],
  menu: Map<string, MenuItem>,
  settings: ShopSettings,
): RepricedCart {
  if (!Array.isArray(payload) || payload.length === 0) throw new CartError("Your cart is empty.");

  const cart = buildCartLines(payload, menu, settings.max_toppings);
  const qtyTotal = cart.reduce((s, l) => s + l.qty, 0);
  if (qtyTotal > settings.max_pizzas) {
    throw new CartError(`Maximum ${settings.max_pizzas} pizzas per order.`);
  }

  return { bill: computeBill(cart, settings), cart };
}
