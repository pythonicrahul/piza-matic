import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderByCode } from "@/lib/data/orders";
import { formatRupees } from "@/lib/money";
import { VegDot } from "@/components/veg-dot";

export const dynamic = "force-dynamic";

const STATUS_STEPS = ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"] as const;
const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function OrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const order = (await getOrderByCode(code)) as any;
  if (!order) notFound();

  const currentIdx = Math.max(0, STATUS_STEPS.indexOf(order.status));
  const delivery = Array.isArray(order.deliveries) ? order.deliveries[0] : order.deliveries;

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-5 rounded-2xl border border-brand/30 bg-orange-50 p-5 text-center">
        <p className="text-sm text-brand">Order confirmed 🎉</p>
        <p className="mt-1 text-4xl font-black text-brand">#{String(order.token).padStart(2, "0")}</p>
        <p className="mt-1 text-xs text-muted">{order.order_code}</p>
        <p className="mt-2 text-sm">
          {order.payment_mode === "cash" ? "Pay on delivery" : `Payment: ${order.payment_status}`}
        </p>
      </div>

      {/* Tracking */}
      <ol className="mb-5 flex justify-between rounded-2xl border border-border bg-surface p-4 text-center text-xs">
        {STATUS_STEPS.map((s, i) => (
          <li key={s} className={i <= currentIdx ? "font-semibold text-brand" : "text-muted"}>
            <div className={`mx-auto mb-1 h-2.5 w-2.5 rounded-full ${i <= currentIdx ? "bg-brand" : "bg-stone-200"}`} />
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ol>

      {/* Items */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">Your order</h2>
        <div className="space-y-2">
          {(order.order_items ?? []).map((it: any, i: number) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="flex items-center gap-2">
                <VegDot isVeg={it.is_veg} />
                {it.qty}× {it.pizza?.name}
                <span className="text-muted">
                  ({it.base?.name}
                  {it.order_item_toppings?.length ? ` · ${it.order_item_toppings.map((t: any) => t.topping?.name).join(", ")}` : ""})
                </span>
              </span>
              <span>{formatRupees(it.line_paise)}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 border-t border-border pt-3 text-sm">
          <div className="flex justify-between text-muted"><span>Subtotal</span><span>{formatRupees(order.subtotal_paise)}</span></div>
          {order.discount_paise > 0 && <div className="flex justify-between text-veg"><span>Discount</span><span>− {formatRupees(order.discount_paise)}</span></div>}
          <div className="flex justify-between text-muted"><span>GST</span><span>{formatRupees(order.gst_paise)}</span></div>
          <div className="mt-1 flex justify-between font-bold"><span>Total</span><span>{formatRupees(order.total_paise)}</span></div>
        </div>
        {delivery && (
          <p className="mt-3 text-xs text-muted">
            Delivering to {delivery.dropoff_address || "your location"} · {delivery.distance_km} km away
          </p>
        )}
      </div>

      <Link href="/" className="mt-5 block text-center text-sm font-semibold text-brand hover:underline">
        Order again
      </Link>
    </div>
  );
}
