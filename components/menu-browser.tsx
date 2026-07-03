"use client";

import { useState } from "react";
import { formatRupees } from "@/lib/money";
import { useCart } from "./cart-provider";
import { BuilderDialog } from "./builder-dialog";
import { VegDot } from "./veg-dot";
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
            className={`rounded-full border px-3 py-1.5 text-sm font-medium capitalize ${
              filter === f ? "border-brand bg-brand text-white" : "border-border bg-surface"
            }`}
          >
            {f === "nonveg" ? "Non-veg" : f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {pizzas.map((p) => (
          <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4">
            <div>
              <div className="mb-1 flex items-center gap-2">
                <VegDot isVeg={p.is_veg} />
                <h3 className="font-semibold">{p.name}</h3>
              </div>
              <p className="text-sm text-muted">from {formatRupees(p.price_paise)}</p>
            </div>
            <button
              onClick={() => setActive(p)}
              className="rounded-xl border border-brand px-4 py-2 text-sm font-bold text-brand hover:bg-brand hover:text-white"
            >
              Add +
            </button>
          </div>
        ))}
      </div>

      {active && (
        <BuilderDialog
          pizza={active}
          bases={menu.base}
          toppings={menu.topping}
          maxToppings={maxToppings}
          onAdd={add}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}
