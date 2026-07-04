"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { useCart } from "@/components/cart-provider";
import { toPayload } from "@/lib/cart-types";
import { SHOP } from "@/lib/constants";
import { haversineKm } from "@/lib/geo";

type PaymentMode = "cash" | "card" | "upi";
type Fulfilment = "delivery" | "takeaway";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    Razorpay: new (options: any) => { open: () => void; on: (e: string, cb: (r: any) => void) => void };
  }
}

export default function CheckoutPage() {
  const { lines, clear } = useCart();
  const router = useRouter();
  const [fulfilment, setFulfilment] = useState<Fulfilment>("delivery");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [autoNote, setAutoNote] = useState("");
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

  const inRange = distanceKm !== null && distanceKm <= SHOP.deliveryRadiusKm;

  function captureLocation() {
    setGeoState("loading");
    setError("");
    setAutoNote("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const dist = Math.round(haversineKm(SHOP.lat, SHOP.lng, c.lat, c.lng) * 100) / 100;
        setCoords(c);
        setDistanceKm(dist);
        setGeoState("ok");
        if (dist <= SHOP.takeawayRadiusKm) {
          // Customer is essentially at the store → take-away / dine-in.
          setFulfilment("takeaway");
          setAutoNote(`You're at ${SHOP.name} — switched to take-away / dine-in.`);
        } else if (dist > SHOP.deliveryRadiusKm) {
          setError(`You're ${dist} km away — outside our ${SHOP.deliveryRadiusKm} km delivery range. You can still choose take-away.`);
        }
      },
      () => {
        setGeoState("error");
        setError("Couldn't get your location. Allow location access, or choose take-away.");
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
      name: SHOP.name,
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
    if (fulfilment === "delivery" && (!coords || !inRange)) {
      return setError("Share a delivery location within range, or choose take-away.");
    }
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          lines: toPayload(lines),
          paymentMode: payment,
          fulfilment,
          delivery:
            fulfilment === "delivery" && coords
              ? { lat: coords.lat, lng: coords.lng, address: address || null }
              : null,
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

  const canPlace = !busy && (fulfilment === "takeaway" || (!!coords && inRange));
  const cashLabel = fulfilment === "delivery" ? "Cash on Delivery" : "Cash (pay at store)";

  return (
    <div className="mx-auto max-w-lg">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <h1 className="mb-5 text-2xl font-extrabold">Checkout</h1>

      {/* Fulfilment toggle */}
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => { setFulfilment("delivery"); setAutoNote(""); }}
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${fulfilment === "delivery" ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}
        >
          🛵 Delivery
        </button>
        <button
          onClick={() => { setFulfilment("takeaway"); setError(""); }}
          className={`rounded-xl border px-4 py-3 text-sm font-bold ${fulfilment === "takeaway" ? "border-brand bg-brand text-white" : "border-border bg-surface"}`}
        >
          🛍️ Take-away / Dine-in
        </button>
      </div>

      {autoNote && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700">{autoNote}</p>}

      {fulfilment === "delivery" ? (
        <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-2 font-semibold">Delivery location</h2>
          <button
            onClick={captureLocation}
            className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand hover:text-white"
          >
            {geoState === "loading" ? "Locating…" : coords ? "📍 Location captured" : "Use my location"}
          </button>
          {distanceKm !== null && (
            <p className={`mt-2 text-xs ${inRange ? "text-veg" : "text-red-500"}`}>
              {distanceKm} km from {SHOP.area} · {inRange ? "within delivery range ✓" : "out of range"}
            </p>
          )}
          <input
            placeholder="Flat / building / landmark (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3"
          />
        </section>
      ) : (
        <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
          <h2 className="mb-1 font-semibold">Pick up at the store</h2>
          <p className="text-sm text-muted">🛍️ {SHOP.name} · {SHOP.area}</p>
          <p className="mt-1 text-xs text-muted">We&apos;ll have your order ready at the counter — no delivery needed.</p>
        </section>
      )}

      <section className="mb-5 rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-2 font-semibold">Payment</h2>
        <div className="space-y-2">
          <PaymentOption label={cashLabel} checked={payment === "cash"} onSelect={() => setPayment("cash")} />
          <PaymentOption label="UPI (Razorpay)" checked={payment === "upi"} onSelect={() => setPayment("upi")} />
          <PaymentOption label="Card (Razorpay)" checked={payment === "card"} onSelect={() => setPayment("card")} />
        </div>
      </section>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <button
        onClick={placeOrder}
        disabled={!canPlace}
        className="w-full rounded-xl bg-brand px-4 py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
      >
        {busy ? "Processing…" : payment === "cash" ? "Place order" : "Pay & place order"}
      </button>
    </div>
  );
}

function PaymentOption({ label, checked, onSelect }: { label: string; checked: boolean; onSelect: () => void }) {
  return (
    <label className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium ${checked ? "border-brand bg-orange-50" : "border-border"}`}>
      <input type="radio" name="payment" checked={checked} onChange={onSelect} className="accent-brand" />
      {label}
    </label>
  );
}
