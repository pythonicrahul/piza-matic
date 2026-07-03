"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "@/components/cart-provider";
import { toPayload } from "@/lib/cart-types";

type PaymentMode = "cash" | "card" | "upi";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
// Checkout.js injects a global constructor.
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Razorpay: new (options: any) => { open: () => void; on: (e: string, cb: (r: any) => void) => void };
  }
}

export default function CheckoutPage() {
  const { lines, clear } = useCart();
  const router = useRouter();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [address, setAddress] = useState("");
  const [payment, setPayment] = useState<PaymentMode>("cash");
  const [geoState, setGeoState] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.session) router.replace("/login");
      });
  }, [router]);

  function captureLocation() {
    setGeoState("loading");
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGeoState("ok");
      },
      () => {
        setGeoState("error");
        setError("Couldn't get your location. Please allow location access to check delivery.");
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  }

  async function payWithRazorpay(orderCode: string) {
    const create = await fetch("/api/payments/create", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderCode }),
    }).then((r) => r.json());

    if (!create.ok) {
      setError(create.error);
      setBusy(false);
      return;
    }

    const rzp = new window.Razorpay({
      key: create.keyId,
      order_id: create.rzpOrderId,
      amount: create.amount,
      currency: create.currency,
      name: "SliceMatic",
      description: `Order ${orderCode}`,
      theme: { color: "#ea580c" },
      handler: async (resp: RazorpayResponse) => {
        const v = await fetch("/api/payments/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ orderCode, ...resp }),
        }).then((r) => r.json());
        if (v.ok) {
          clear();
          router.push(`/order/${orderCode}`);
        } else {
          setError("Payment could not be verified. If you were charged, contact support.");
          setBusy(false);
        }
      },
      modal: {
        ondismiss: () => {
          setBusy(false);
          setError("Payment cancelled — your order is saved. You can retry.");
        },
      },
    });
    rzp.on("payment.failed", () => {
      setError("Payment failed. Please try again.");
      setBusy(false);
    });
    rzp.open();
  }

  async function placeOrder() {
    if (!coords) return setError("Please share your delivery location first.");
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: toPayload(lines),
          paymentMode: payment,
          delivery: { lat: coords.lat, lng: coords.lng, address: address || null },
        }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error);
        setBusy(false);
        return;
      }
      if (!data.order.needsPayment) {
        clear();
        router.push(`/order/${data.order.code}`);
        return;
      }
      await payWithRazorpay(data.order.code);
    } catch {
      setError("Something went wrong. Please try again.");
      setBusy(false);
    }
  }

  if (lines.length === 0) {
    return <p className="py-16 text-center text-muted">Your cart is empty.</p>;
  }

  return (
    <div className="mx-auto max-w-lg">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <h1 className="mb-5 text-2xl font-extrabold">Checkout</h1>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 font-semibold">Delivery location</h2>
        <button
          onClick={captureLocation}
          className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand hover:text-white"
        >
          {geoState === "loading" ? "Locating…" : coords ? "📍 Location captured" : "Use my location"}
        </button>
        {coords && <p className="mt-2 text-xs text-muted">We&apos;ll confirm you&apos;re within our 4 km delivery radius.</p>}
        <input
          placeholder="Flat / building / landmark (optional)"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3"
        />
      </section>

      <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 font-semibold">Payment</h2>
        <div className="space-y-2">
          <PaymentOption id="cash" label="Cash on Delivery" checked={payment === "cash"} onSelect={() => setPayment("cash")} />
          <PaymentOption id="upi" label="UPI (Razorpay)" checked={payment === "upi"} onSelect={() => setPayment("upi")} />
          <PaymentOption id="card" label="Card (Razorpay)" checked={payment === "card"} onSelect={() => setPayment("card")} />
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={placeOrder}
        disabled={busy || !coords}
        className="w-full rounded-xl bg-brand px-4 py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Processing…" : payment === "cash" ? "Place order" : "Pay & place order"}
      </button>
    </div>
  );
}

function PaymentOption({
  label,
  checked,
  onSelect,
}: {
  id: string;
  label: string;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <label className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${checked ? "border-brand bg-orange-50" : "border-border"}`}>
      <input type="radio" name="payment" checked={checked} onChange={onSelect} className="accent-brand" />
      {label}
    </label>
  );
}
