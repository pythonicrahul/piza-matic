import Link from "next/link";
import { redirect } from "next/navigation";
import { getCustomerSession } from "@/lib/session";
import { getCustomerOrders } from "@/lib/data/orders";
import { formatRupees } from "@/lib/money";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  placed: "bg-stone-100 text-stone-600",
  confirmed: "bg-blue-50 text-blue-700",
  preparing: "bg-amber-50 text-amber-700",
  ready: "bg-orange-50 text-brand",
  out_for_delivery: "bg-orange-50 text-brand",
  delivered: "bg-green-50 text-green-700",
  cancelled: "bg-red-50 text-red-600",
};

function statusLabel(status: string, fulfilment: string): string {
  if (status === "ready" && fulfilment === "takeaway") return "Ready for pickup";
  return status.replace(/_/g, " ");
}

function istTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export default async function OrdersPage() {
  const session = await getCustomerSession();
  if (!session) redirect("/login?next=/orders");

  const orders = (await getCustomerOrders(session.customerId)) as any[];

  return (
    <div>
      <h1 className="mb-4 text-2xl font-extrabold">My orders</h1>

      {orders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-surface p-10 text-center">
          <p className="mb-2 text-sm text-muted">You haven&apos;t ordered yet.</p>
          <Link href="/" className="font-semibold text-brand hover:underline">Build your first pizza →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((o) => {
            const summary = (o.order_items ?? []).map((it: any) => `${it.qty}× ${it.pizza?.name}`).join(", ");
            const active = !["delivered", "cancelled"].includes(o.status);
            return (
              <Link
                key={o.order_code}
                href={`/order/${o.order_code}`}
                className="block rounded-2xl border border-border bg-surface p-4 shadow-warm-sm transition hover:border-brand/40 hover:shadow-warm-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-lg font-black text-brand">#{String(o.token).padStart(2, "0")}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATUS_STYLE[o.status] ?? "bg-stone-100 text-muted"}`}>
                        {statusLabel(o.status, o.fulfilment)}
                      </span>
                      {o.fulfilment === "takeaway" && <span className="text-xs text-muted">🛍️ Take-away</span>}
                    </div>
                    <p className="mt-1 truncate text-sm text-muted">{summary || "—"}</p>
                    <p className="mt-0.5 text-xs text-muted">{istTime(o.placed_at)}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-bold">{formatRupees(o.total_paise)}</p>
                    <span className="text-xs font-semibold text-brand">Track →</span>
                  </div>
                </div>
                {active && <p className="mt-2 text-xs font-medium text-brand">● In progress — tap to track</p>}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
