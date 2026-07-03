// Client-safe cart shapes (no server-only imports). The cart holds display data
// so it renders without refetching; prices shown to the user are always
// re-confirmed by the server (/api/cart/price) before checkout.

import type { CartLinePayload } from "./cart";

export interface CartItemRef {
  id: string;
  name: string;
  price_paise: number;
  is_veg?: boolean | null;
}

export interface CartLineUI {
  key: string; // unique per cart line
  pizza: CartItemRef;
  base: CartItemRef;
  toppings: CartItemRef[];
  qty: number;
}

/** Per-unit price for display (server remains authoritative). */
export function lineUnitPaise(line: CartLineUI): number {
  return line.base.price_paise + line.pizza.price_paise + line.toppings.reduce((s, t) => s + t.price_paise, 0);
}

export function toPayload(lines: CartLineUI[]): CartLinePayload[] {
  return lines.map((l) => ({
    baseId: l.base.id,
    pizzaId: l.pizza.id,
    toppingIds: l.toppings.map((t) => t.id),
    qty: l.qty,
  }));
}
