"use client";

import { useState } from "react";
import { formatRupees } from "@/lib/money";
import { VegDot } from "./veg-dot";
import type { CartItemRef, CartLineUI } from "@/lib/cart-types";

interface Props {
  pizza: CartItemRef;
  bases: CartItemRef[];
  toppings: CartItemRef[];
  maxToppings: number;
  onAdd: (line: Omit<CartLineUI, "key">) => void;
  onClose: () => void;
}

export function BuilderDialog({ pizza, bases, toppings, maxToppings, onAdd, onClose }: Props) {
  const [baseId, setBaseId] = useState(bases[0]?.id ?? "");
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [qty, setQty] = useState(1);

  const base = bases.find((b) => b.id === baseId)!;
  const selectedToppings = toppings.filter((t) => chosen.has(t.id));
  const unit = pizza.price_paise + (base?.price_paise ?? 0) + selectedToppings.reduce((s, t) => s + t.price_paise, 0);

  function toggleTopping(id: string) {
    setChosen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < maxToppings) next.add(id);
      return next;
    });
  }

  function handleAdd() {
    if (!base) return;
    onAdd({ pizza, base, toppings: selectedToppings, qty });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-center gap-2">
          <VegDot isVeg={pizza.is_veg} />
          <h2 className="text-lg font-bold">{pizza.name}</h2>
        </div>
        <p className="mb-4 text-sm text-muted">Customize your pizza</p>

        {/* Base — required */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Choose a base</h3>
          <div className="grid grid-cols-1 gap-2">
            {bases.map((b) => (
              <label
                key={b.id}
                className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 ${
                  baseId === b.id ? "border-brand bg-orange-50" : "border-border"
                }`}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <input type="radio" name="base" checked={baseId === b.id} onChange={() => setBaseId(b.id)} className="accent-brand" />
                  <VegDot isVeg={b.is_veg} />
                  {b.name}
                </span>
                <span className="text-sm text-muted">+{formatRupees(b.price_paise)}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Toppings — optional */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            Add toppings <span className="font-normal normal-case">(up to {maxToppings})</span>
          </h3>
          <div className="flex flex-wrap gap-2">
            {toppings.map((t) => {
              const on = chosen.has(t.id);
              const disabled = !on && chosen.size >= maxToppings;
              return (
                <button
                  key={t.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleTopping(t.id)}
                  className={`rounded-full border px-3 py-1.5 text-sm ${
                    on ? "border-brand bg-brand text-white" : "border-border bg-surface"
                  } ${disabled ? "opacity-40" : ""}`}
                >
                  {t.name} · +{formatRupees(t.price_paise)}
                </button>
              );
            })}
          </div>
        </section>

        {/* Quantity + add */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full border border-border text-lg font-bold">−</button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <button onClick={() => setQty((q) => Math.min(10, q + 1))} className="h-9 w-9 rounded-full border border-border text-lg font-bold">+</button>
          </div>
          <button
            onClick={handleAdd}
            className="flex-1 rounded-xl bg-brand px-4 py-3 font-bold text-white hover:bg-brand-dark"
          >
            Add — {formatRupees(unit * qty)}
          </button>
        </div>
      </div>
    </div>
  );
}
