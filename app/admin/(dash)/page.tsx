import Link from "next/link";
import { getAnalytics, getOrders, normalizeFilters } from "@/lib/data/admin";
import { formatRupees } from "@/lib/money";
import { HourChart } from "@/components/admin/hour-chart";
import { StatTile, TextTile } from "@/components/admin/stat-tile";
import { StatusPill } from "@/components/admin/status-pill";
import { RevenueIcon, OrdersIcon, AovIcon, StarIcon } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

function hourLabel(h: number): string {
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12} ${am ? "AM" : "PM"}`;
}

function istTime(iso: string): string {
  return new Date(iso).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

type SP = { from?: string; to?: string; payment?: string };

export default async function AdminDashboard({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filters = normalizeFilters(sp);
  const [analytics, orders] = await Promise.all([getAnalytics(filters), getOrders(filters)]);

  const csvHref = `/api/admin/orders/csv?${new URLSearchParams(
    Object.entries({ from: sp.from, to: sp.to, payment: sp.payment }).filter(([, v]) => v) as [string, string][],
  ).toString()}`;

  return (
    <div className="space-y-6">
      {/* Filters */}
      <form method="get" className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">From</span>
          <input type="date" name="from" defaultValue={sp.from} className="rounded-lg border border-border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">To</span>
          <input type="date" name="to" defaultValue={sp.to} className="rounded-lg border border-border px-3 py-2" />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Payment</span>
          <select name="payment" defaultValue={sp.payment ?? ""} className="rounded-lg border border-border px-3 py-2">
            <option value="">All</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
            <option value="upi">UPI</option>
          </select>
        </label>
        <button className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-bold text-white shadow-warm-sm">Apply</button>
        <Link href="/admin" className="rounded-lg border border-border px-4 py-2 text-sm font-medium hover:border-brand/40">Reset</Link>
        <a href={csvHref} className="ml-auto rounded-lg border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand hover:text-white">
          Export CSV
        </a>
      </form>

      {/* Summary tiles */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Revenue" numericValue={analytics.revenue_paise} format={formatRupees} icon={<RevenueIcon />} />
        <StatTile label="Orders" numericValue={analytics.order_count} format={(n) => String(Math.round(n))} icon={<OrdersIcon />} />
        <StatTile label="Avg order value" numericValue={analytics.aov_paise} format={formatRupees} icon={<AovIcon />} />
        <TextTile
          label="Top pizza"
          value={analytics.top_pizza?.name ?? "—"}
          sub={analytics.top_pizza ? `${analytics.top_pizza.qty} sold` : undefined}
          icon={<StarIcon />}
        />
      </div>

      {/* Busiest hour + histogram */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
        <div className="mb-1 flex items-baseline justify-between">
          <h2 className="font-semibold">Orders by hour (IST)</h2>
          {analytics.busiest_hour && (
            <span className="text-sm text-muted">
              Busiest: <span className="font-semibold text-brand">{hourLabel(analytics.busiest_hour.hour)}</span> ({analytics.busiest_hour.count})
            </span>
          )}
        </div>
        {analytics.by_hour.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No orders in range.</p>
        ) : (
          <HourChart data={analytics.by_hour} busiestHour={analytics.busiest_hour?.hour ?? null} />
        )}
      </div>

      {/* Orders table */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-surface shadow-warm-sm">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="sticky top-0 border-b border-border bg-surface text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Token</th>
              <th className="px-4 py-3">Time</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Qty</th>
              <th className="px-4 py-3">Payment</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o, i) => (
              <tr key={o.order_code} className={`border-b border-border/60 last:border-0 hover:bg-background/60 ${i % 2 === 1 ? "bg-background/30" : ""}`}>
                <td className="px-4 py-3 font-semibold">#{String(o.token).padStart(2, "0")}</td>
                <td className="px-4 py-3 text-muted">{istTime(o.placed_at)}</td>
                <td className="px-4 py-3">{o.name || o.phone}</td>
                <td className="px-4 py-3">{o.quantity_total}</td>
                <td className="px-4 py-3 capitalize">
                  {o.payment_mode}
                  <span className={`ml-1 text-xs ${o.payment_status === "paid" ? "text-veg" : "text-muted"}`}>· {o.payment_status}</span>
                </td>
                <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                <td className="px-4 py-3 text-right font-medium">{formatRupees(o.total_paise)}</td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted">No orders match these filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
