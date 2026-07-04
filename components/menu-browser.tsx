"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatRupees } from "@/lib/money";
import { useCart } from "./cart-provider";
import { BuilderDialog } from "./builder-dialog";
import { VegDot } from "./veg-dot";
import { PizzaCover } from "./pizza-photo";
import type { CartItemRef } from "@/lib/cart-types";

interface MenuData {
  base: CartItemRef[];
  pizza: CartItemRef[];
  topping: CartItemRef[];
}

export function MenuBrowser({ menu, maxToppings }: { menu: MenuData; maxToppings: number }) {
  const { add } = useCart();
  const [active, setActive] = useState<CartItemRef | null>(null);
  const [filter, setFilter] = useState<"all" | "veg" | "nonveg">("all");

  const pizzas = menu.pizza.filter((p) =>
    filter === "all" ? true : filter === "veg" ? p.is_veg === true : p.is_veg === false,
  );

  return (
    <div>
      <div className="mb-4 flex gap-2">
        {(["all", "veg", "nonveg"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`relative rounded-full px-3 py-1.5 text-sm font-medium capitalize transition-colors ${
              filter === f ? "text-white" : "border border-border bg-surface text-foreground hover:border-brand/40"
            }`}
          >
            {filter === f && (
              <motion.span
                layoutId="filter-pill"
                className="absolute inset-0 rounded-full bg-brand-gradient shadow-warm-sm"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            <span className="relative">{f === "nonveg" ? "Non-veg" : f}</span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {pizzas.map((p) => (
          <motion.article
            key={p.id}
            whileHover={{ y: -4 }}
            className="group overflow-hidden rounded-2xl border border-border bg-surface shadow-warm-sm transition-shadow hover:shadow-warm-md"
          >
            <button type="button" onClick={() => setActive(p)} className="block w-full text-left">
              <div className="relative aspect-[16/10] overflow-hidden">
                <PizzaCover
                  name={p.name}
                  seed={p.id}
                  isVeg={p.is_veg}
                  sizes="(max-width: 640px) 100vw, 384px"
                  className="transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/45 to-transparent" />
                <span className="absolute left-3 top-3 rounded-full bg-white/95 p-1.5 shadow-warm-sm">
                  <VegDot isVeg={p.is_veg} />
                </span>
                <span className="absolute bottom-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-bold text-brand-dark shadow-warm-sm">
                  from {formatRupees(p.price_paise)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <h3 className="font-semibold leading-tight">{p.name}</h3>
                <span className="shrink-0 rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  Add +
                </span>
              </div>
            </button>
          </motion.article>
        ))}
      </div>

      <AnimatePresence>
        {active && (
          <BuilderDialog
            key={active.id}
            pizza={active}
            bases={menu.base}
            toppings={menu.topping}
            maxToppings={maxToppings}
            onAdd={add}
            onClose={() => setActive(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
