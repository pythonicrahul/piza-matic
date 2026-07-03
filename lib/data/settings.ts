import "server-only";

// Server-side reads of the single `settings` row (business params + geofence).

import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_PRICING, SHOP } from "@/lib/constants";
import type { PricingSettings } from "@/lib/types";

export interface ShopSettings extends PricingSettings {
  shop_lat: number;
  shop_lng: number;
  delivery_radius_km: number;
}

const FALLBACK: ShopSettings = {
  ...DEFAULT_PRICING,
  shop_lat: SHOP.lat,
  shop_lng: SHOP.lng,
  delivery_radius_km: SHOP.deliveryRadiusKm,
};

/** Fetch the authoritative settings row. Falls back to constants if unavailable. */
export async function getSettings(): Promise<ShopSettings> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("settings")
    .select(
      "shop_lat, shop_lng, delivery_radius_km, discount_threshold, discount_pct, gst_pct, max_pizzas, max_toppings",
    )
    .eq("id", 1)
    .single();

  if (error || !data) return FALLBACK;

  return {
    shop_lat: data.shop_lat,
    shop_lng: data.shop_lng,
    delivery_radius_km: Number(data.delivery_radius_km),
    discount_threshold: data.discount_threshold,
    discount_pct: Number(data.discount_pct),
    gst_pct: Number(data.gst_pct),
    max_pizzas: data.max_pizzas,
    max_toppings: data.max_toppings,
  };
}
