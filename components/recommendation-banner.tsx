"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PizzaThumb } from "./pizza-photo";

interface Rec {
  pizza: string;
  base: string;
  topping: string | null;
  reason: string;
}

export function RecommendationBanner() {
  const [rec, setRec] = useState<Rec | null>(null);
  const [source, setSource] = useState<string>("");

  useEffect(() => {
    fetch("/api/ai/recommend")
      .then((r) => r.json())
      .then((d) => {
        if (d.rec) {
          setRec(d.rec);
          setSource(d.source ?? "");
        }
      })
      .catch(() => {});
  }, []);

  return (
    <AnimatePresence>
      {rec && (
        <motion.div
          initial={{ opacity: 0, y: -14, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 24 }}
          className="relative mb-5 flex items-center gap-3 overflow-hidden rounded-2xl border border-brand/20 bg-surface p-4 shadow-warm-sm"
        >
          <span className="pointer-events-none absolute inset-0 rounded-2xl bg-brand-gradient opacity-[0.06]" />
          <PizzaThumb name={rec.pizza} seed={`${rec.pizza}-${rec.base}`} size={48} className="relative shadow-warm-sm" />
          <div className="relative min-w-0">
            <div className="mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-brand">
              <span>✨</span>
              <span>{source === "ai" ? "Recommended for you" : "Popular pick"}</span>
            </div>
            <p className="truncate font-semibold">
              {rec.pizza} on {rec.base}
              {rec.topping ? ` + ${rec.topping}` : ""}
            </p>
            <p className="truncate text-sm text-muted">{rec.reason}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
