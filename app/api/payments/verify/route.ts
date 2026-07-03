import { NextResponse } from "next/server";
import { getCustomerSession } from "@/lib/session";
import { getOrderForPayment, markOrderPaid } from "@/lib/data/orders";
import { verifyPaymentSignature } from "@/lib/razorpay";

// Verify a Checkout success payload server-side (HMAC) and mark the order paid.
// The webhook is the async backstop; this is the synchronous happy path.
export async function POST(req: Request) {
  const session = await getCustomerSession();
  if (!session) return NextResponse.json({ ok: false, error: "Please sign in." }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const { orderCode, razorpay_order_id, razorpay_payment_id, razorpay_signature } = body ?? {};

  const order = await getOrderForPayment(String(orderCode ?? ""));
  if (!order) return NextResponse.json({ ok: false, error: "Order not found." }, { status: 404 });
  if (order.razorpay_order_id !== razorpay_order_id) {
    return NextResponse.json({ ok: false, error: "Payment does not match this order." }, { status: 400 });
  }

  if (!verifyPaymentSignature(razorpay_order_id, razorpay_payment_id, razorpay_signature)) {
    return NextResponse.json({ ok: false, error: "Payment verification failed." }, { status: 400 });
  }

  await markOrderPaid(razorpay_order_id, razorpay_payment_id);
  return NextResponse.json({ ok: true });
}
