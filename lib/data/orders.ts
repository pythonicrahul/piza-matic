import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import type { RepricedCart } from "@/lib/cart";
import type { PaymentMode } from "@/lib/types";

/** Human-readable order code in IST, e.g. PM-20260704-193045-k2p. */
export function makeOrderCode(): string {
  const ist = new Date(Date.now() + 5.5 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${ist.getUTCFullYear()}${p(ist.getUTCMonth() + 1)}${p(ist.getUTCDate())}` +
    `-${p(ist.getUTCHours())}${p(ist.getUTCMinutes())}${p(ist.getUTCSeconds())}`;
  const suffix = Math.random().toString(36).slice(2, 5);
  return `PM-${stamp}-${suffix}`;
}

export interface CreateOrderArgs {
  customerId: string;
  name: string | null;
  phone: string;
  paymentMode: PaymentMode;
  repriced: RepricedCart;
  fulfilment: "delivery" | "takeaway";
  // Present only for delivery orders; null/omitted for take-away.
  delivery: { lat: number; lng: number; address: string | null; distanceKm: number } | null;
}

export interface CreatedOrder {
  orderId: string;
  orderCode: string;
  token: number;
}

/** Insert an order atomically via the place_order RPC (order + items + toppings + delivery). */
export async function createOrder(args: CreateOrderArgs): Promise<CreatedOrder> {
  const supabase = createAdminClient();
  const { bill, cart } = args.repriced;

  const items = cart.map((line, i) => ({
    base_id: line.base.id,
    pizza_id: line.pizza.id,
    qty: line.qty,
    unit_paise: bill.lines[i].unit_paise,
    line_paise: bill.lines[i].line_paise,
    is_veg: bill.lines[i].is_veg,
    toppings: line.toppings.map((t) => ({ topping_id: t.id, price_paise: t.price_paise })),
  }));

  const orderCode = makeOrderCode();
  const { data, error } = await supabase.rpc("place_order", {
    p_customer_id: args.customerId,
    p_name: args.name,
    p_phone: args.phone,
    p_payment_mode: args.paymentMode,
    p_order_code: orderCode,
    p_qty_total: bill.quantity_total,
    p_subtotal: bill.subtotal_paise,
    p_discount: bill.discount_paise,
    p_gst: bill.gst_paise,
    p_total: bill.total_paise,
    p_items: items,
    p_fulfilment: args.fulfilment,
    p_delivery: args.delivery
      ? {
          lat: args.delivery.lat,
          lng: args.delivery.lng,
          address: args.delivery.address,
          distance_km: args.delivery.distanceKm,
        }
      : null,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  return { orderId: row.order_id, orderCode: row.order_code, token: row.token };
}

/** Full order detail for the confirmation / tracking page (public by code). */
export async function getOrderByCode(code: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select(
      `order_code, token, status, payment_mode, payment_status, name, phone, fulfilment,
       subtotal_paise, discount_paise, gst_paise, total_paise, placed_at,
       order_items ( qty, unit_paise, line_paise, is_veg,
         pizza:pizza_id(name), base:base_id(name),
         order_item_toppings( topping:topping_id(name) ) ),
       deliveries ( status, dropoff_address, distance_km )`,
    )
    .eq("order_code", code)
    .maybeSingle();
  return data;
}

/** Cash-on-delivery: no gateway, so confirm the order immediately. */
export async function confirmCashOrder(orderId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("orders")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", orderId);
}

// --------------------------------------------------------------------------- //
// Razorpay payment state
// --------------------------------------------------------------------------- //

export interface PaymentOrder {
  id: string;
  total_paise: number;
  payment_mode: string;
  payment_status: string;
  razorpay_order_id: string | null;
}

export async function getOrderForPayment(orderCode: string): Promise<PaymentOrder | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .select("id, total_paise, payment_mode, payment_status, razorpay_order_id")
    .eq("order_code", orderCode)
    .maybeSingle();
  return data;
}

export async function setRazorpayOrder(orderId: string, razorpayOrderId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase.from("orders").update({ razorpay_order_id: razorpayOrderId }).eq("id", orderId);
}

/** Mark paid + confirmed. Scoped by the stored razorpay_order_id to prevent replay. */
export async function markOrderPaid(razorpayOrderId: string, razorpayPaymentId: string): Promise<boolean> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("orders")
    .update({
      payment_status: "paid",
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      razorpay_payment_id: razorpayPaymentId,
    })
    .eq("razorpay_order_id", razorpayOrderId)
    .neq("payment_status", "paid")
    .select("id")
    .maybeSingle();
  return Boolean(data);
}

export async function markOrderPaymentFailed(razorpayOrderId: string): Promise<void> {
  const supabase = createAdminClient();
  await supabase
    .from("orders")
    .update({ payment_status: "failed" })
    .eq("razorpay_order_id", razorpayOrderId)
    .neq("payment_status", "paid");
}
