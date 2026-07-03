import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth/admin";
import { getOrders } from "@/lib/data/admin";
import { csvCell, normalizeFilters } from "@/lib/admin-utils";
import { rupeesPlain } from "@/lib/money";

// Export filtered orders as CSV. Admin-only.
export async function GET(req: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const filters = normalizeFilters({
    from: url.searchParams.get("from") ?? undefined,
    to: url.searchParams.get("to") ?? undefined,
    payment: url.searchParams.get("payment") ?? undefined,
  });

  const orders = await getOrders(filters, 10000);
  const header = [
    "order_code", "token", "placed_at", "name", "phone",
    "quantity", "payment_mode", "payment_status", "status", "total_inr",
  ];
  const lines = [
    header.join(","),
    ...orders.map((o) =>
      [
        o.order_code, o.token, o.placed_at, o.name ?? "", o.phone,
        o.quantity_total, o.payment_mode, o.payment_status, o.status, rupeesPlain(o.total_paise),
      ]
        .map(csvCell)
        .join(","),
    ),
  ];

  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="slicematic-orders-${Date.now()}.csv"`,
    },
  });
}
