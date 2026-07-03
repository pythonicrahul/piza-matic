import { NextResponse } from "next/server";
import { markOrderPaid, markOrderPaymentFailed } from "@/lib/data/orders";
import { verifyWebhookSignature } from "@/lib/razorpay";

// Async source of truth for payment state. Razorpay signs the raw body with the
// webhook secret; we must verify BEFORE parsing/trusting anything.
export async function POST(req: Request) {
  const raw = await req.text();
  const signature = req.headers.get("x-razorpay-signature") ?? "";

  if (!verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  let event: {
    event?: string;
    payload?: { payment?: { entity?: { id?: string; order_id?: string } } };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payment = event.payload?.payment?.entity;
  const rzpOrderId = payment?.order_id;

  if (rzpOrderId) {
    if (event.event === "payment.captured" && payment?.id) {
      await markOrderPaid(rzpOrderId, payment.id);
    } else if (event.event === "payment.failed") {
      await markOrderPaymentFailed(rzpOrderId);
    }
  }

  // Always 200 once the signature is valid, so Razorpay stops retrying.
  return NextResponse.json({ ok: true });
}
