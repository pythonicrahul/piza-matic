"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import type { CartItemRef, CartLineUI } from "@/lib/cart-types";

const KEY = "slicematic_cart_v1";

// crypto.randomUUID() only exists in secure contexts (https or localhost). On a
// plain-IP LAN dev URL (http://192.168.x.x, e.g. a phone) it's undefined, so
// fall back to a good-enough unique id for cart line keys.
function uid(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

interface CartCtx {
  lines: CartLineUI[];
  count: number;
  add: (line: Omit<CartLineUI, "key">) => void;
  setQty: (key: string, qty: number) => void;
  addToppingToLine: (key: string, topping: CartItemRef) => void;
  remove: (key: string) => void;
  clear: () => void;
}

const Ctx = createContext<CartCtx | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLineUI[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Load once on mount.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setLines(JSON.parse(raw));
    } catch {
      /* ignore corrupt storage */
    }
    setHydrated(true);
  }, []);

  // Persist after hydration.
  useEffect(() => {
    if (hydrated) localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines, hydrated]);

  const add = useCallback((line: Omit<CartLineUI, "key">) => {
    setLines((prev) => [...prev, { ...line, key: uid() }]);
  }, []);

  const setQty = useCallback((key: string, qty: number) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, qty } : l)));
  }, []);

  // Add a suggested topping to an existing line (no duplicates).
  const addToppingToLine = useCallback((key: string, topping: CartItemRef) => {
    setLines((prev) =>
      prev.map((l) =>
        l.key === key && !l.toppings.some((t) => t.id === topping.id)
          ? { ...l, toppings: [...l.toppings, topping] }
          : l,
      ),
    );
  }, []);

  const remove = useCallback((key: string) => {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const count = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <Ctx.Provider value={{ lines, count, add, setQty, addToppingToLine, remove, clear }}>
      {children}
    </Ctx.Provider>
  );
}

export function useCart() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
