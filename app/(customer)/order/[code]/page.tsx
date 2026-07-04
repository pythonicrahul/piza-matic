import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByCode } from "@/lib/data/orders";
import { formatRupees } from "@/lib/money";
import { SHOP } from "@/lib/constants";
import { VegDot } from "@/components/veg-dot";
import { PizzaThumb } from "@/components/pizza-photo";
import { OrderConfirmedHeader, OrderTracker } from "@/components/order-status";

export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = (await getOrderByCode(code)) as any;
  if (!order) notFound();

  const isTakeaway = order.fulfilment === "takeaway";
  const delivery = Array.isArray(order.deliveries) ? order.deliveries[0] : order.deliveries;

  return (
    <div className="mx-auto max-w-lg">
      <OrderConfirmedHeader
        token={order.token}
        orderCode={order.order_code}
        paymentLine={
          (isTakeaway ? "🛍️ Take-away / Dine-in · " : "") +
          (order.payment_mode === "cash"
            ? isTakeaway ? "Pay at store" : "Pay on delivery"
            : `Payment: ${order.payment_status}`)
        }
      />

      <OrderTracker status={order.status} fulfilment={order.fulfilment} />

      {/* Items */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
        <h2 className="mb-3 font-semibold">Your order</h2>
        <div className="space-y-3">
          {(order.order_items ?? []).map((it: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-sm">
              <PizzaThumb name={it.pizza?.name ?? "Pizza"} seed={it.pizza?.id ?? String(i)} isVeg={it.is_veg} size={36} />
              <span className="flex min-w-0 flex-1 items-center gap-2">
                <VegDot isVeg={it.is_veg} />
                <span className="truncate">
                  {it.qty}× {it.pizza?.name}
                  <span className="text-muted">
                    {" "}
                    ({it.base?.name}
                    {it.order_item_toppings?.length ? ` · ${it.order_item_toppings.map((t: any) => t.topping?.name).join(", ")}` : ""})
                  </span>
                </span>
              </span>
              <span className="shrink-0 font-medium">{formatRupees(it.line_paise)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted"><span>Subtotal</span><span>{formatRupees(order.subtotal_paise)}</span></div>
          {order.discount_paise > 0 && <div className="flex justify-between text-veg"><span>Discount</span><span>− {formatRupees(order.discount_paise)}</span></div>}
          <div className="flex justify-between text-muted"><span>GST</span><span>{formatRupees(order.gst_paise)}</span></div>
          <div className="mt-1 flex justify-between font-bold"><span>Total</span><span>{formatRupees(order.total_paise)}</span></div>
        </div>
        {isTakeaway ? (
          <p className="mt-3 text-xs text-muted">🛍️ Pick up at {SHOP.name} · {SHOP.area}</p>
        ) : delivery ? (
          <p className="mt-3 text-xs text-muted">
            Delivering to {delivery.dropoff_address || "your location"} · {delivery.distance_km} km away
          </p>
        ) : null}
      </div>

      <div className="mt-5 flex items-center justify-center gap-6 text-sm font-semibold text-brand">
        <Link href="/orders" className="hover:underline">My orders</Link>
        <Link href="/" className="hover:underline">Order again</Link>
      </div>
    </div>
  );
}
