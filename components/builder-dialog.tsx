"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { formatRupees } from "@/lib/money";
import { sheetSpring, scaleTap } from "@/lib/motion";
import { VegDot } from "./veg-dot";
import { PizzaCover, PizzaThumb } from "./pizza-photo";
import { baseImageFor } from "@/lib/pizza-images";
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
    <motion.div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/40 sm:items-center"
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <motion.div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-warm-lg sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        initial={{ y: "100%", opacity: 0.6 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0.6 }}
        transition={sheetSpring}
      >
        {/* Full-bleed photo header */}
        <div className="relative aspect-[16/8] overflow-hidden rounded-t-2xl">
          <PizzaCover name={pizza.name} seed={pizza.id} isVeg={pizza.is_veg} sizes="(max-width: 640px) 100vw, 512px" />
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/70 to-transparent" />
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-colors hover:bg-black/65"
          >
            ✕
          </button>
          <div className="absolute bottom-3 left-4 text-white">
            <div className="flex items-center gap-2">
              <span className="rounded bg-white/95 p-0.5"><VegDot isVeg={pizza.is_veg} /></span>
              <h2 className="text-xl font-bold drop-shadow">{pizza.name}</h2>
            </div>
            <p className="text-sm text-white/85">Customize your pizza</p>
          </div>
        </div>

        <div className="p-5 pt-4">
        {/* Base — required */}
        <section className="mb-4">
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Choose a base</h3>
          <div className="grid grid-cols-1 gap-2">
            {bases.map((b) => {
              const selected = baseId === b.id;
              return (
                <label
                  key={b.id}
                  className={`flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2.5 transition-colors ${
                    selected ? "border-brand bg-orange-50 shadow-warm-sm" : "border-border hover:border-brand/30"
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-sm font-medium">
                    <span
                      className={`flex h-4 w-4 items-center justify-center rounded-full border-2 transition-colors ${
                        selected ? "border-brand bg-brand" : "border-border"
                      }`}
                    >
                      {selected && (
                        <motion.span
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", stiffness: 500, damping: 20 }}
                          className="h-1.5 w-1.5 rounded-full bg-white"
                        />
                      )}
                    </span>
                    <input type="radio" name="base" checked={selected} onChange={() => setBaseId(b.id)} className="sr-only" />
                    <PizzaThumb
                      name={b.name}
                      seed={b.id}
                      isVeg={b.is_veg}
                      imageUrl={baseImageFor(b.name)}
                      size={38}
                      className={`ring-2 transition-shadow ${selected ? "ring-brand" : "ring-transparent"}`}
                    />
                    <VegDot isVeg={b.is_veg} />
                    {b.name}
                  </span>
                  <span className="text-sm text-muted">+{formatRupees(b.price_paise)}</span>
                </label>
              );
            })}
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
                <motion.button
                  key={t.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => toggleTopping(t.id)}
                  whileTap={disabled ? undefined : scaleTap.whileTap}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    on ? "border-brand bg-brand text-white shadow-warm-sm" : "border-border bg-surface hover:border-brand/40"
                  } ${disabled ? "opacity-40" : ""}`}
                >
                  {t.name} · +{formatRupees(t.price_paise)}
                </motion.button>
              );
            })}
          </div>
        </section>

        {/* Quantity + add */}
        <div className="sticky bottom-0 -mx-5 -mb-5 flex items-center justify-between gap-3 border-t border-border bg-surface/95 px-5 py-4 backdrop-blur">
          <div className="flex items-center gap-3">
            <motion.button whileTap={scaleTap.whileTap} onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-9 w-9 rounded-full border border-border text-lg font-bold">−</motion.button>
            <span className="w-6 text-center font-semibold">{qty}</span>
            <motion.button whileTap={scaleTap.whileTap} onClick={() => setQty((q) => Math.min(10, q + 1))} className="h-9 w-9 rounded-full border border-border text-lg font-bold">+</motion.button>
          </div>
          <motion.button
            whileTap={scaleTap.whileTap}
            onClick={handleAdd}
            className="flex-1 rounded-xl bg-brand-gradient px-4 py-3 font-bold text-white shadow-warm-md"
          >
            Add — {formatRupees(unit * qty)}
          </motion.button>
        </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
