import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { OrderFilters } from "@/lib/admin-utils";

export type { OrderFilters } from "@/lib/admin-utils";
export { normalizeFilters } from "@/lib/admin-utils";

export interface Analytics {
  order_count: number;
  revenue_paise: number;
  aov_paise: number;
  top_pizza: { name: string; qty: number } | null;
  busiest_hour: { hour: number; count: number } | null;
  by_hour: { hour: number; count: number }[];
  payment_breakdown: { mode: string; count: number }[];
}

export interface AdminOrderRow {
  order_code: string;
  token: number;
  name: string | null;
  phone: string;
  status: string;
  payment_mode: string;
  payment_status: string;
  quantity_total: number;
  total_paise: number;
  placed_at: string;
}

/** Dashboard summary via the admin_analytics RPC (respects the filters). */
export async function getAnalytics(f: OrderFilters): Promise<Analytics> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_analytics", {
    p_from: f.from ?? null,
    p_to: f.to ?? null,
    p_payment: f.payment ?? null,
  });
  if (error) throw error;
  return data as Analytics;
}

/** Filtered order list (admin RLS allows reading all). */
export async function getOrders(f: OrderFilters, limit = 200): Promise<AdminOrderRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("orders")
    .select("order_code, token, name, phone, status, payment_mode, payment_status, quantity_total, total_paise, placed_at")
    .order("placed_at", { ascending: false })
    .limit(limit);
  if (f.from) q = q.gte("placed_at", f.from);
  if (f.to) q = q.lt("placed_at", f.to);
  if (f.payment) q = q.eq("payment_mode", f.payment);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as AdminOrderRow[];
}

// --------------------------------------------------------------------------- //
// Kitchen board (today only; daily reset)
// --------------------------------------------------------------------------- //

export interface KitchenItem {
  qty: number;
  pizza: { name: string } | null;
  base: { name: string } | null;
  order_item_toppings: { topping: { name: string } | null }[];
}
export interface KitchenOrder {
  order_code: string;
  token: number;
  name: string | null;
  status: string;
  placed_at: string;
  payment_mode: string;
  payment_status: string;
  total_paise: number;
  order_items: KitchenItem[];
}

const KITCHEN_SELECT =
  "order_code, token, name, status, placed_at, payment_mode, payment_status, total_paise, " +
  "order_items(qty, pizza:pizza_id(name), base:base_id(name), order_item_toppings(topping:topping_id(name)))";

/** Start of the current IST day as an ISO timestamp. */
function istDayStartIso(): string {
  const dstr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  return new Date(`${dstr}T00:00:00+05:30`).toISOString();
}

export async function getKitchen(): Promise<{ pending: KitchenOrder[]; done: KitchenOrder[] }> {
  const supabase = await createClient();
  const since = istDayStartIso();

  const [pendingRes, doneRes] = await Promise.all([
    supabase
      .from("orders")
      .select(KITCHEN_SELECT)
      .in("status", ["confirmed", "preparing"])
      .gte("placed_at", since)
      .order("placed_at", { ascending: true }),
    supabase
      .from("orders")
      .select(KITCHEN_SELECT)
      .in("status", ["ready", "out_for_delivery", "delivered"])
      .gte("placed_at", since)
      .order("placed_at", { ascending: false })
      .limit(8),
  ]);

  return {
    pending: (pendingRes.data ?? []) as unknown as KitchenOrder[],
    done: (doneRes.data ?? []) as unknown as KitchenOrder[],
  };
}

/** Kitchen transition: mark a confirmed/preparing order as ready. */
export async function markOrderReady(orderCode: string): Promise<boolean> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .update({ status: "ready" })
    .eq("order_code", orderCode)
    .in("status", ["confirmed", "preparing"])
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

