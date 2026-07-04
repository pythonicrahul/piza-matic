"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/cart-provider";
import { toPayload } from "@/lib/cart-types";
import { scaleTap } from "@/lib/motion";

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

      <div className="relative">
        <div className="absolute left-4 top-9 bottom-9 w-px bg-border" aria-hidden="true" />

        <StepSection index={1} title="Delivery location">
          <motion.button
            whileTap={scaleTap.whileTap}
            onClick={captureLocation}
            className="flex items-center gap-2 rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand transition-colors hover:bg-brand hover:text-white"
          >
            {geoState === "loading" ? (
              <motion.span
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ repeat: Infinity, duration: 1 }}
                className="inline-block"
              >
                📍
              </motion.span>
            ) : coords ? (
              <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>
                ✅
              </motion.span>
            ) : (
              <span>📍</span>
            )}
            {geoState === "loading" ? "Locating…" : coords ? "Location captured" : "Use my location"}
          </motion.button>
          {coords && <p className="mt-2 text-xs text-muted">We&apos;ll confirm you&apos;re within our 4 km delivery radius.</p>}
          <input
            placeholder="Flat / building / landmark (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3"
          />
        </StepSection>

        <StepSection index={2} title="Payment">
          <div className="grid grid-cols-3 gap-2">
            <PaymentOption id="cash" label="Cash" icon={<CashIcon />} checked={payment === "cash"} onSelect={() => setPayment("cash")} />
            <PaymentOption id="upi" label="UPI" icon={<UpiIcon />} checked={payment === "upi"} onSelect={() => setPayment("upi")} />
            <PaymentOption id="card" label="Card" icon={<CardIcon />} checked={payment === "card"} onSelect={() => setPayment("card")} />
          </div>
        </StepSection>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={busy || !coords ? undefined : scaleTap.whileTap}
        onClick={placeOrder}
        disabled={busy || !coords}
        className="w-full rounded-xl bg-brand-gradient px-4 py-3 font-bold text-white shadow-warm-md disabled:opacity-50"
      >
        {busy ? "Processing…" : payment === "cash" ? "Place order" : "Pay & place order"}
      </motion.button>
    </div>
  );
}

function StepSection({ index, title, children }: { index: number; title: string; children: React.ReactNode }) {
  return (
    <section className="relative mb-5 pl-11">
      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-brand-gradient text-sm font-bold text-white shadow-warm-sm">
        {index}
      </span>
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
        <h2 className="mb-2 font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  );
}

function PaymentOption({
  label,
  icon,
  checked,
  onSelect,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  checked: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex flex-col items-center gap-1.5 rounded-xl border px-2 py-3 text-xs font-semibold transition-colors ${
        checked ? "border-brand bg-orange-50 text-brand shadow-warm-sm" : "border-border text-foreground hover:border-brand/30"
      }`}
    >
      <span className={checked ? "text-brand" : "text-muted"}>{icon}</span>
      {label}
    </button>
  );
}

function CashIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="6" width="19" height="12" rx="2" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}
function UpiIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M10 18h4" />
    </svg>
  );
}
function CardIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 10h19" />
    </svg>
  );
}
