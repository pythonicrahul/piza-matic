import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/session";
import { getOrderForPayment, setRazorpayOrder } from "@/lib/data/orders";
import { createRazorpayOrder, isRazorpayConfigured } from "@/lib/razorpay";

// Create a Razorpay order for an existing (card/upi) SliceMatic order. Amount is
// taken from the DB order — never from the client.
export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });

  if (!isRazorpayConfigured()) {
    return NextResponse.json({ ok: false, error: "Payments are not configured." }, { status: 503 });
  }

  const body = await req.json().catch(() => ({}));
  const orderCode = String(body?.orderCode ?? "");
  const order = await getOrderForPayment(orderCode);
  if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  if (order.payment_status === "paid") {
    return NextResponse.json({ ok: false, error: "This order is already paid." }, { status: 400 });
  }
  if (order.payment_mode === "cash") {
    return NextResponse.json({ ok: false, error: "Cash orders don't need online payment." }, { status: 400 });
  }

  try {
    const rzp = await createRazorpayOrder(order.total_paise, orderCode);
    await setRazorpayOrder(order.id, rzp.id);
    return NextResponse.json({
      ok: true,
      rzpOrderId: rzp.id,
      amount: rzp.amount,
      currency: rzp.currency,
      keyId: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
      orderCode,
    });
  } catch (e) {
    console.error("razorpay create failed", e);
    return NextResponse.json({ ok: false, error: "Couldn't start payment. Please try again." }, { status: 502 });
  }
}
