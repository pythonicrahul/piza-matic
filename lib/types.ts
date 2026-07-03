// Domain types shared across the app. Money is ALWAYS integer paise (no floats).

export type Paise = number; // integer paise, e.g. ₹67.00 -> 6700

export type ItemCategory = "base" | "pizza" | "topping";
export type PaymentMode = "cash" | "card" | "upi";
export type PaymentStatus = "pending" | "paid" | "failed" | "refunded";
export type OrderStatus =
  | "placed"
  | "confirmed"
  | "preparing"
  | "ready"
  | "out_for_delivery"
  | "delivered"
  | "cancelled";
export type DeliveryStatus =
  | "unassigned"
  | "assigned"
  | "picked_up"
  | "out_for_delivery"
  | "delivered"
  | "failed";
export type AppRole = "admin" | "rider";

/** A menu item as needed for pricing (a thin projection of `menu_items`). */
export interface MenuItemRef {
  id: string;
  name: string;
  price_paise: Paise;
  is_veg?: boolean | null;
}

/** One pizza line the customer is building/ordering. */
export interface CartLine {
  base: MenuItemRef;
  pizza: MenuItemRef;
  toppings: MenuItemRef[];
  qty: number;
}

/** Business parameters that drive pricing — sourced from the `settings` table. */
export interface PricingSettings {
  discount_threshold: number; // qty >= this → discount applies
  discount_pct: number; // e.g. 10.00
  gst_pct: number; // e.g. 18.00
  max_pizzas: number; // cart cap
  max_toppings: number; // per-line cap
}

export interface LineBill {
  unit_paise: Paise; // base + pizza + Σ toppings (per unit)
  line_paise: Paise; // unit_paise * qty
  qty: number;
  is_veg: boolean | null;
}

/** The authoritative computed bill for a cart. */
export interface Bill {
  lines: LineBill[];
  quantity_total: number;
  subtotal_paise: Paise;
  discount_paise: Paise;
  gst_paise: Paise;
  total_paise: Paise;
  discount_applied: boolean;
}
