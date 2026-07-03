// Fallback defaults. The DB `settings` row is authoritative at runtime; these
// mirror the migration defaults and are used for local pricing/tests before a
// settings row is fetched.

import type { PricingSettings } from "./types";

export const SHOP = {
  name: "SliceMatic",
  area: "New Ashok Nagar, Delhi",
  lat: 28.5905,
  lng: 77.3037,
  deliveryRadiusKm: 4.0,
} as const;

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
