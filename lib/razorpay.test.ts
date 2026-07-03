import { describe, expect, it } from "vitest";
import crypto from "node:crypto";
import { verifyPaymentSignature, verifyWebhookSignature } from "./razorpay";

const SECRET = "test_secret_key";
const hmac = (data: string, secret: string) =>
  crypto.createHmac("sha256", secret).update(data).digest("hex");

describe("verifyPaymentSignature", () => {
  const orderId = "order_ABC123";
  const paymentId = "pay_XYZ789";
  const good = hmac(`${orderId}|${paymentId}`, SECRET);

  it("accepts a correct signature", () => {
    expect(verifyPaymentSignature(orderId, paymentId, good, SECRET)).toBe(true);
  });
  it("rejects a tampered signature", () => {
    const bad = hmac(`${orderId}|${paymentId}`, "wrong_secret");
    expect(verifyPaymentSignature(orderId, paymentId, bad, SECRET)).toBe(false);
  });
  it("rejects when the order id is swapped", () => {
    expect(verifyPaymentSignature("order_OTHER", paymentId, good, SECRET)).toBe(false);
  });
  it("rejects empty/missing inputs", () => {
    expect(verifyPaymentSignature("", paymentId, good, SECRET)).toBe(false);
    expect(verifyPaymentSignature(orderId, paymentId, "", SECRET)).toBe(false);
    expect(verifyPaymentSignature(orderId, paymentId, good, "")).toBe(false);
  });
  it("rejects a non-hex signature without throwing", () => {
    expect(verifyPaymentSignature(orderId, paymentId, "not-hex-!!", SECRET)).toBe(false);
  });
});

describe("verifyWebhookSignature", () => {
  const body = JSON.stringify({ event: "payment.captured", payload: { payment: { entity: { id: "pay_1" } } } });
  const good = hmac(body, SECRET);

  it("accepts a correct webhook signature", () => {
    expect(verifyWebhookSignature(body, good, SECRET)).toBe(true);
  });
  it("rejects a tampered body", () => {
    expect(verifyWebhookSignature(body + " ", good, SECRET)).toBe(false);
  });
  it("rejects a wrong secret", () => {
    expect(verifyWebhookSignature(body, hmac(body, "nope"), SECRET)).toBe(false);
  });
  it("rejects empty signature/secret", () => {
    expect(verifyWebhookSignature(body, "", SECRET)).toBe(false);
    expect(verifyWebhookSignature(body, good, "")).toBe(false);
  });
});
