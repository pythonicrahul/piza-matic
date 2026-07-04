"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "@/components/cart-provider";
import { VegDot } from "@/components/veg-dot";
import { PizzaArt } from "@/components/pizza-art";
import { PizzaThumb } from "@/components/pizza-photo";
import { formatRupees } from "@/lib/money";
import { lineUnitPaise, toPayload } from "@/lib/cart-types";
import { listExit, scaleTap } from "@/lib/motion";
import type { Bill } from "@/lib/types";

export default function CartPage() {
  const { lines, setQty, remove } = useCart();
  const router = useRouter();
  const [bill, setBill] = useState<Bill | null>(null);
  const [error, setError] = useState("");

  // Re-price authoritatively whenever the cart changes.
  useEffect(() => {
    if (lines.length === 0) {
      setBill(null);
      return;
    }
    fetch("/api/cart/price", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lines: toPayload(lines) }),
    })
      .then((r) => r.json())
      .then((d) => (d.ok ? (setBill(d.bill), setError("")) : setError(d.error)))
      .catch(() => setError("Couldn't price your cart."));
  }, [lines]);

  if (lines.length === 0) {
    return (
      <div className="flex flex-col items-center py-16 text-center">
        <PizzaArt seed="empty-cart" isVeg={true} size={96} className="mb-4 opacity-90" />
        <p className="mb-1 text-lg font-semibold">Your cart is looking empty.</p>
        <p className="mb-5 text-sm text-muted">Build a pizza and it&apos;ll show up right here.</p>
        <Link href="/" className="rounded-xl bg-brand-gradient px-5 py-3 font-bold text-white shadow-warm-md transition-transform hover:scale-[1.02] active:scale-95">
          Browse menu
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-28 sm:pb-0">
      <h1 className="mb-4 text-2xl font-extrabold">Your cart</h1>

      <div className="space-y-3">
        <AnimatePresence initial={false}>
          {lines.map((l) => (
            <motion.div
              key={l.key}
              layout
              variants={listExit}
              initial="hidden"
              animate="show"
              exit="exit"
              className="flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-warm-sm"
            >
              <PizzaThumb name={l.pizza.name} seed={l.pizza.id} isVeg={l.pizza.is_veg} size={52} className="shadow-warm-sm" />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                      <VegDot isVeg={l.pizza.is_veg} />
                      {l.pizza.name}
                    </div>
                    <p className="truncate text-sm text-muted">
                      {l.base.name}
                      {l.toppings.length > 0 && ` · ${l.toppings.map((t) => t.name).join(", ")}`}
                    </p>
                    <p className="mt-1 text-sm font-medium">{formatRupees(lineUnitPaise(l))} / pizza</p>
                  </div>
                  <button onClick={() => remove(l.key)} className="shrink-0 text-sm text-red-500 hover:underline">Remove</button>
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <motion.button whileTap={scaleTap.whileTap} onClick={() => setQty(l.key, Math.max(1, l.qty - 1))} className="h-8 w-8 rounded-full border border-border font-bold">−</motion.button>
                  <span className="w-6 text-center font-semibold">{l.qty}</span>
                  <motion.button whileTap={scaleTap.whileTap} onClick={() => setQty(l.key, Math.min(10, l.qty + 1))} className="h-8 w-8 rounded-full border border-border font-bold">+</motion.button>
                  <span className="ml-auto font-semibold">{formatRupees(lineUnitPaise(l) * l.qty)}</span>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {error && <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      {bill && (
        <motion.div
          layout
          className="sticky bottom-4 mt-5 rounded-2xl border border-border bg-surface/90 p-4 shadow-warm-lg backdrop-blur-lg"
        >
          <Row label="Subtotal" value={formatRupees(bill.subtotal_paise)} />
          {bill.discount_applied && <Row label="Discount (10%)" value={`− ${formatRupees(bill.discount_paise)}`} accent />}
          <Row label="GST (18%)" value={formatRupees(bill.gst_paise)} />
          <div className="mt-2 border-t border-border pt-2">
            <Row label="Total" value={formatRupees(bill.total_paise)} bold />
          </div>
          <motion.button
            whileTap={scaleTap.whileTap}
            onClick={() => router.push("/checkout")}
            className="mt-4 w-full rounded-xl bg-brand-gradient px-4 py-3 font-bold text-white shadow-warm-md"
          >
            Proceed to checkout
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

function Row({ label, value, bold, accent }: { label: string; value: string; bold?: boolean; accent?: boolean }) {
  return (
    <div className={`flex justify-between py-0.5 text-sm ${bold ? "text-base font-bold" : ""} ${accent ? "text-veg" : ""}`}>
      <span className={bold ? "" : "text-muted"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
