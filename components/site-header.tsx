"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AnimatePresence, motion, useScroll, useMotionValueEvent } from "framer-motion";
import { useCart } from "./cart-provider";
import { PizzaMark } from "./pizza-art";

interface Session {
  phone: string;
  name: string | null;
}

export function SiteHeader() {
  const { count } = useCart();
  const [session, setSession] = useState<Session | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setScrolled(y > 8));

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => setSession(d.session))
      .catch(() => {});
  }, []);

  return (
    <header
      className={`sticky top-0 z-20 border-b transition-all duration-300 ${
        scrolled
          ? "border-border bg-surface/80 shadow-warm-sm backdrop-blur-lg"
          : "border-transparent bg-surface/40 backdrop-blur-sm"
      }`}
    >
      <div
        className={`mx-auto flex max-w-3xl items-center justify-between px-4 transition-all duration-300 ${
          scrolled ? "py-2.5" : "py-3.5"
        }`}
      >
        <Link href="/" className="group flex items-center gap-2">
          <motion.span whileHover={{ rotate: -12, scale: 1.08 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
            <PizzaMark size={scrolled ? 24 : 28} />
          </motion.span>
          <span className="text-lg font-extrabold tracking-tight text-brand">SliceMatic</span>
        </Link>

        <div className="flex items-center gap-3 text-sm">
          <Link
            href="/cart"
            className="relative rounded-full bg-brand-gradient px-4 py-2 font-semibold text-white shadow-warm-sm transition-transform hover:scale-105 hover:shadow-warm-md active:scale-95"
          >
            Cart
            <AnimatePresence>
              {count > 0 && (
                <motion.span
                  key={count}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.4, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 420, damping: 20 }}
                  className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-stone-900 px-1 text-xs font-bold text-white"
                >
                  {count}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
          {session ? (
            <span className="hidden text-muted sm:inline">
              {session.name || session.phone}
            </span>
          ) : (
            <Link href="/login" className="font-semibold text-brand hover:underline">
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
