// Fallback defaults. The DB `settings` row is authoritative at runtime; these
// mirror the migration defaults and are used for local pricing/tests before a
// settings row is fetched.

import type { PricingSettings } from "./types";

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

// Store location — configurable via NEXT_PUBLIC_* env (inlined at build; restart
// the dev server after changing). Read on both client (checkout geofence) and server.
export const SHOP = {
  name: process.env.NEXT_PUBLIC_SHOP_NAME || "SliceMatic",
  area: process.env.NEXT_PUBLIC_SHOP_AREA || "New Ashok Nagar, Delhi",
  lat: num(process.env.NEXT_PUBLIC_SHOP_LAT, 28.5905),
  lng: num(process.env.NEXT_PUBLIC_SHOP_LNG, 77.3037),
  deliveryRadiusKm: num(process.env.NEXT_PUBLIC_DELIVERY_RADIUS_KM, 4.0),
  // If the customer's GPS is within this of the store, they're AT the store →
  // checkout auto-selects take-away/dine-in instead of delivery.
  takeawayRadiusKm: num(process.env.NEXT_PUBLIC_TAKEAWAY_RADIUS_KM, 0.4),
};

export const DEFAULT_PRICING: PricingSettings = {
  discount_threshold: 5, // qty >= 5 → discount
  discount_pct: 10.0,
  gst_pct: 18.0,
  max_pizzas: 10,
  max_toppings: 5,
};

export const PAYMENT_LABELS: Record<string, string> = {
  cash: "Cash on Delivery",
  card: "Card",
  upi: "UPI",
};
