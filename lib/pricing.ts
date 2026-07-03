// The pricing engine — the single source of truth for money math.
//
// Semantics are IDENTICAL to the Stage 2 Python implementation:
//   unit   = base + pizza + Σ toppings           (integer paise)
//   line   = unit * qty
//   subtotal = Σ line
//   discount = discount_pct% of subtotal   iff  total_qty >= discount_threshold
//   taxable  = subtotal - discount
//   gst      = gst_pct% of taxable
//   total    = taxable + gst
//
// Rounding is banker's rounding (ROUND_HALF_EVEN) on integer paise.
//
// This module is called SERVER-SIDE for every order write. The browser may call
// it for live UX, but the server recomputes from DB prices — client totals are
// never trusted.

import { pctOfPaise } from "./money";
import type { Bill, CartLine, LineBill, MenuItemRef, PricingSettings } from "./types";

/** Veg classification for a set of components: false if any is non-veg (is_veg===false),
 *  true if at least one is veg and none non-veg, null if entirely unclassified. */
function classifyVeg(items: MenuItemRef[]): boolean | null {
  let anyTrue = false;
  for (const it of items) {
    if (it.is_veg === false) return false;
    if (it.is_veg === true) anyTrue = true;
  }
  return anyTrue ? true : null;
}

function priceLine(line: CartLine): LineBill {
  const components = [line.base, line.pizza, ...line.toppings];
  const unit_paise = components.reduce((sum, c) => sum + c.price_paise, 0);
  return {
    unit_paise,
    line_paise: unit_paise * line.qty,
    qty: line.qty,
    is_veg: classifyVeg(components),
  };
}

export function computeBill(cart: CartLine[], settings: PricingSettings): Bill {
  const lines = cart.map(priceLine);

  const subtotal_paise = lines.reduce((s, l) => s + l.line_paise, 0);
  const quantity_total = cart.reduce((s, l) => s + l.qty, 0);

  const discount_applied = quantity_total >= settings.discount_threshold;
  const discount_paise = discount_applied
    ? pctOfPaise(subtotal_paise, settings.discount_pct)
    : 0;

  const taxable_paise = subtotal_paise - discount_paise;
  const gst_paise = pctOfPaise(taxable_paise, settings.gst_pct);
  const total_paise = taxable_paise + gst_paise;

  return {
    lines,
    quantity_total,
    subtotal_paise,
    discount_paise,
    gst_paise,
    total_paise,
    discount_applied,
  };
}
