"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Script from "next/script";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/components/cart-provider";
import { toPayload } from "@/lib/cart-types";
import { SHOP } from "@/lib/constants";
import { haversineKm } from "@/lib/geo";
import { scaleTap } from "@/lib/motion";

type PaymentMode = "cash" | "card" | "upi";
type Fulfilment = "delivery" | "takeaway";

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}
interface SavedAddress {
  id: string;
  label: string | null;
  address: string | null;
  lat: number;
  lng: number;
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
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedAddrId, setSelectedAddrId] = useState<string>("new");
  const [label, setLabel] = useState("");
  const [saveNew, setSaveNew] = useState(true);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => {
        if (!d.session) router.replace("/login?next=/checkout");
      });
  }, [router]);

  // Load saved addresses and preselect the most recent, so no re-entry is needed.
  useEffect(() => {
    fetch("/api/addresses")
      .then((r) => r.json())
      .then((d) => {
        if (d.ok && d.addresses?.length) {
          setSavedAddresses(d.addresses);
          applySaved(d.addresses[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const inRange = distanceKm !== null && distanceKm <= SHOP.deliveryRadiusKm;

  function applySaved(a: SavedAddress) {
    setSelectedAddrId(a.id);
    const dist = Math.round(haversineKm(SHOP.lat, SHOP.lng, a.lat, a.lng) * 100) / 100;
    setCoords({ lat: a.lat, lng: a.lng });
    setDistanceKm(dist);
    setAddress(a.address || "");
    setGeoState("ok");
    setAutoNote("");
    setError(dist > SHOP.deliveryRadiusKm ? `This address is ${dist} km away — outside delivery range.` : "");
  }

  function selectNew() {
    setSelectedAddrId("new");
    setCoords(null);
    setDistanceKm(null);
    setAddress("");
    setGeoState("idle");
    setError("");
    setAutoNote("");
  }

  async function removeSaved(id: string) {
    await fetch(`/api/addresses?id=${encodeURIComponent(id)}`, { method: "DELETE" }).catch(() => {});
    setSavedAddresses((prev) => prev.filter((a) => a.id !== id));
    if (selectedAddrId === id) selectNew();
  }

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
      // Save a brand-new delivery location for reuse next time.
      if (fulfilment === "delivery" && selectedAddrId === "new" && saveNew && coords) {
        await fetch("/api/addresses", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ label: label || null, address: address || null, lat: coords.lat, lng: coords.lng }),
        }).catch(() => {});
      }

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

  return (
    <div className="mx-auto max-w-lg">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <h1 className="mb-5 text-2xl font-extrabold">Checkout</h1>

      {/* Fulfilment toggle */}
      <div className="mb-5 grid grid-cols-2 gap-2">
        <button
          onClick={() => { setFulfilment("delivery"); setAutoNote(""); }}
          className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${fulfilment === "delivery" ? "border-brand bg-brand-gradient text-white shadow-warm-sm" : "border-border bg-surface"}`}
        >
          🛵 Delivery
        </button>
        <button
          onClick={() => { setFulfilment("takeaway"); setError(""); }}
          className={`rounded-xl border px-4 py-3 text-sm font-bold transition-colors ${fulfilment === "takeaway" ? "border-brand bg-brand-gradient text-white shadow-warm-sm" : "border-border bg-surface"}`}
        >
          🛍️ Take-away / Dine-in
        </button>
      </div>

      <AnimatePresence>
        {autoNote && (
          <motion.p
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-700"
          >
            {autoNote}
          </motion.p>
        )}
      </AnimatePresence>

      <div className="relative">
        <div className="absolute left-4 top-9 bottom-9 w-px bg-border" aria-hidden="true" />

        {fulfilment === "delivery" ? (
          <StepSection index={1} title="Delivery location">
            {savedAddresses.length > 0 && (
              <div className="mb-3 space-y-2">
                {savedAddresses.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 ${selectedAddrId === a.id ? "border-brand bg-orange-50" : "border-border"}`}
                  >
                    <button type="button" onClick={() => applySaved(a)} className="flex flex-1 items-center gap-2 text-left">
                      <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${selectedAddrId === a.id ? "border-brand bg-brand" : "border-border"}`} />
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{a.label || "Saved address"}</span>
                        {a.address && <span className="block truncate text-xs text-muted">{a.address}</span>}
                      </span>
                    </button>
                    <button type="button" onClick={() => removeSaved(a.id)} className="shrink-0 text-xs text-red-500 hover:underline">Remove</button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={selectNew}
                  className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2.5 text-left ${selectedAddrId === "new" ? "border-brand bg-orange-50" : "border-border"}`}
                >
                  <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${selectedAddrId === "new" ? "border-brand bg-brand" : "border-border"}`} />
                  <span className="text-sm font-medium">+ Use a new location</span>
                </button>
              </div>
            )}

            {selectedAddrId === "new" && (
              <>
                <motion.button
                  whileTap={scaleTap.whileTap}
                  onClick={captureLocation}
                  className="flex items-center gap-2 rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand transition-colors hover:bg-brand hover:text-white"
                >
                  {geoState === "loading" ? (
                    <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1 }} className="inline-block">📍</motion.span>
                  ) : coords ? (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400, damping: 15 }}>✅</motion.span>
                  ) : (
                    <span>📍</span>
                  )}
                  {geoState === "loading" ? "Locating…" : coords ? "Location captured" : "Use my location"}
                </motion.button>
                <input
                  placeholder="Label — Home, Work (optional)"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="mt-3 w-full rounded-xl border border-border bg-surface px-4 py-3"
                />
                <input
                  placeholder="Flat / building / landmark (optional)"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-border bg-surface px-4 py-3"
                />
                <label className="mt-2 flex items-center gap-2 text-xs text-muted">
                  <input type="checkbox" checked={saveNew} onChange={(e) => setSaveNew(e.target.checked)} className="accent-brand" />
                  Save this address for next time
                </label>
              </>
            )}

            {distanceKm !== null && (
              <p className={`mt-2 text-xs ${inRange ? "text-veg" : "text-red-500"}`}>
                {distanceKm} km from {SHOP.area} · {inRange ? "within delivery range ✓" : "out of range"}
              </p>
            )}
          </StepSection>
        ) : (
          <StepSection index={1} title="Pick up at the store">
            <p className="text-sm text-muted">🛍️ {SHOP.name} · {SHOP.area}</p>
            <p className="mt-1 text-xs text-muted">We&apos;ll have your order ready at the counter — no delivery needed.</p>
          </StepSection>
        )}

        <StepSection index={2} title="Payment">
          <div className="grid grid-cols-3 gap-2">
            <PaymentOption id="cash" label="Cash" icon={<CashIcon />} checked={payment === "cash"} onSelect={() => setPayment("cash")} />
            <PaymentOption id="upi" label="UPI" icon={<UpiIcon />} checked={payment === "upi"} onSelect={() => setPayment("upi")} />
            <PaymentOption id="card" label="Card" icon={<CardIcon />} checked={payment === "card"} onSelect={() => setPayment("card")} />
          </div>
          {payment === "cash" && (
            <p className="mt-2 text-xs text-muted">{fulfilment === "delivery" ? "Pay cash on delivery." : "Pay at the store counter."}</p>
          )}
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
        whileTap={canPlace ? scaleTap.whileTap : undefined}
        onClick={placeOrder}
        disabled={!canPlace}
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
