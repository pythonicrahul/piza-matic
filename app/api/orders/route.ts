import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/session";
import { getSettings } from "@/lib/data/settings";
import { getMenuMap } from "@/lib/data/menu";
import { CartError, repriceCart, type CartLinePayload } from "@/lib/cart";
import { validatePayment } from "@/lib/validators";
import { checkGeofence } from "@/lib/geo";
import { confirmCashOrder, createOrder } from "@/lib/data/orders";

// Create an order. Reprices server-side, enforces the delivery geofence, writes
// atomically via the place_order RPC. Cash confirms immediately; card/upi return
// the order for the Razorpay step.
export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const lines = body?.lines as CartLinePayload[] | undefined;
  if (!Array.isArray(lines)) {
    return NextResponse.json({ ok: false, error: "Invalid cart." }, { status: 400 });
  }

  const payment = validatePayment(body?.paymentMode);
  if (!payment.ok) return NextResponse.json({ ok: false, error: payment.error }, { status: 400 });

  const drop = body?.delivery;
  if (!drop || typeof drop.lat !== "number" || typeof drop.lng !== "number") {
    return NextResponse.json({ ok: false, error: "Delivery location is required." }, { status: 400 });
  }

  const [settings, menu] = await Promise.all([getSettings(), getMenuMap()]);

  // Geofence — block anything outside the delivery radius.
  const fence = checkGeofence(settings.shop_lat, settings.shop_lng, drop.lat, drop.lng, settings.delivery_radius_km);
  if (!fence.serviceable) {
    return NextResponse.json(
      {
        ok: false,
        error: `Sorry, you're ${fence.distanceKm} km away — we deliver within ${settings.delivery_radius_km} km of the shop.`,
      },
      { status: 400 },
    );
  }

  try {
    const repriced = repriceCart(lines, menu, settings);

    const created = await createOrder({
      customerId: session.customerId,
      name: session.name,
      phone: session.phone,
      paymentMode: payment.value,
      repriced,
      delivery: {
        lat: drop.lat,
        lng: drop.lng,
        address: typeof drop.address === "string" ? drop.address : null,
        distanceKm: fence.distanceKm,
      },
    });

    if (payment.value === "cash") {
      await confirmCashOrder(created.orderId);
    }

    return NextResponse.json({
      ok: true,
      order: {
        code: created.orderCode,
        token: created.token,
        totalPaise: repriced.bill.total_paise,
        paymentMode: payment.value,
        needsPayment: payment.value !== "cash",
      },
    });
  } catch (e) {
    if (e instanceof CartError) return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    console.error("order create failed", e);
    return NextResponse.json({ ok: false, error: "Could not place your order. Please try again." }, { status: 500 });
  }
}
