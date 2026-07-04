"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { useCart } from "./cart-provider";
import { formatRupees } from "@/lib/money";
import { lineUnitPaise } from "@/lib/cart-types";

// Swiggy/Zomato-style floating cart bar: appears the moment something is in
// the cart, stays out of the way on the cart/checkout pages themselves.
// The amount shown is the client-side sum of line prices — the authoritative
// bill (discount + GST) is still computed server-side on the cart page.
export function CartBar() {
  const { lines, count } = useCart();
  const pathname = usePathname();

  const hidden = count === 0 || pathname === "/cart" || pathname === "/checkout";
  const itemsTotal = lines.reduce((s, l) => s + lineUnitPaise(l) * l.qty, 0);

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ y: 90, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 90, opacity: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 30 }}
          className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-3xl"
        >
          <Link
            href="/cart"
            className="flex items-center justify-between rounded-2xl bg-brand-gradient px-5 py-3.5 text-white shadow-warm-lg transition-transform hover:scale-[1.01] active:scale-[0.99]"
          >
            <span className="text-sm font-semibold">
              {count} pizza{count !== 1 ? "s" : ""} · {formatRupees(itemsTotal)}
              <span className="ml-1 font-normal text-white/75">+ taxes</span>
            </span>
            <span className="flex items-center gap-1 font-bold">
              View cart <span aria-hidden>→</span>
            </span>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
