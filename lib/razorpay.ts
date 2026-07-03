import "server-only";

// Razorpay server helpers. The key secret + webhook secret live only here (never
// on the client). Card/UPI payments are created + verified server-side; the
// browser only ever sees the public key id and the razorpay order id.

import crypto from "node:crypto";

export function isRazorpayConfigured(): boolean {
  return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
}

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  status: string;
}

/** Create a Razorpay order for a given paise amount via the Orders API. */
export async function createRazorpayOrder(amountPaise: number, receipt: string): Promise<RazorpayOrder> {
  const keyId = process.env.RAZORPAY_KEY_ID!;
  const keySecret = process.env.RAZORPAY_KEY_SECRET!;
  const auth = Buffer.from(`${keyId}:${keySecret}`).toString("base64");

  const res = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: { authorization: `Basic ${auth}`, "content-type": "application/json" },
    body: JSON.stringify({ amount: amountPaise, currency: "INR", receipt, payment_capture: 1 }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Razorpay order create failed (${res.status}): ${detail}`);
  }
  return (await res.json()) as RazorpayOrder;
}

function hmacHex(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("hex");
}

/** Constant-time compare of two hex signatures. */
function safeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  if (ab.length !== bb.length || ab.length === 0) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Verify a Checkout success payload:
 *   expected = HMAC_SHA256(order_id + "|" + payment_id, key_secret)
 */
export function verifyPaymentSignature(
  razorpayOrderId: string,
  razorpayPaymentId: string,
  signature: string,
  secret = process.env.RAZORPAY_KEY_SECRET ?? "",
): boolean {
  if (!secret || !razorpayOrderId || !razorpayPaymentId || !signature) return false;
  const expected = hmacHex(`${razorpayOrderId}|${razorpayPaymentId}`, secret);
  return safeEqualHex(expected, signature);
}

/**
 * Verify a webhook: expected = HMAC_SHA256(rawBody, webhook_secret), compared to
 * the X-Razorpay-Signature header.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signature: string,
  secret = process.env.RAZORPAY_WEBHOOK_SECRET ?? "",
): boolean {
  if (!secret || !signature) return false;
  const expected = hmacHex(rawBody, secret);
  return safeEqualHex(expected, signature);
}
