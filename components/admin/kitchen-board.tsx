"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { formatRupees } from "@/lib/money";

interface KItem {
  qty: number;
  pizza: { name: string } | null;
  base: { name: string } | null;
  order_item_toppings: { topping: { name: string } | null }[];
}
interface KOrder {
  order_code: string;
  token: number;
  name: string | null;
  status: string;
  placed_at: string;
  payment_mode: string;
  payment_status: string;
  total_paise: number;
  order_items: KItem[];
}

function itemText(it: KItem): string {
  const tops = it.order_item_toppings.map((t) => t.topping?.name).filter(Boolean).join(", ");
  return `${it.qty}× ${it.pizza?.name} (${it.base?.name}${tops ? ` · ${tops}` : ""})`;
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit" });
}

function urgency(placedAt: string): "ok" | "warn" | "late" {
  const mins = (Date.now() - new Date(placedAt).getTime()) / 60000;
  if (mins > 10) return "late";
  if (mins > 5) return "warn";
  return "ok";
}

const URGENCY_BORDER: Record<string, string> = {
  ok: "border-brand",
  warn: "border-amber-500",
  late: "border-red-500",
};

export function KitchenBoard() {
  const [pending, setPending] = useState<KOrder[]>([]);
  const [done, setDone] = useState<KOrder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/admin/kitchen", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setPending(d.pending ?? []);
        setDone(d.done ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 8000);
    return () => clearInterval(id);
  }, [load]);

  async function markDone(orderCode: string) {
    // optimistic
    setPending((p) => p.filter((o) => o.order_code !== orderCode));
    await fetch("/api/admin/kitchen/done", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ orderCode }),
    });
    load();
  }

  if (loading) return <p className="text-muted">Loading kitchen…</p>;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">
          🔴 Preparing — {pending.length} order{pending.length !== 1 ? "s" : ""}
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-xl border border-dashed border-border p-6 text-center text-veg">✅ All caught up!</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <AnimatePresence initial={false}>
              {pending.map((o) => {
                const level = urgency(o.placed_at);
                return (
                  <motion.div
                    key={o.order_code}
                    layout
                    initial={{ opacity: 0, scale: 0.92, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ type: "spring", stiffness: 340, damping: 28 }}
                    className={`flex flex-col gap-2 rounded-2xl border-2 bg-surface p-4 shadow-warm-sm ${URGENCY_BORDER[level]}`}
                  >
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-black text-brand">#{String(o.token).padStart(2, "0")}</span>
                      <span className={`flex items-center gap-1 text-xs ${level === "late" ? "font-semibold text-red-600" : "text-muted"}`}>
                        {level === "late" && (
                          <motion.span
                            className="h-1.5 w-1.5 rounded-full bg-red-500"
                            animate={{ opacity: [1, 0.3, 1] }}
                            transition={{ repeat: Infinity, duration: 1.2 }}
                          />
                        )}
                        {timeLabel(o.placed_at)}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">{o.name || "Guest"}</span>
                    <ul className="space-y-1 text-sm text-foreground/80">
                      {o.order_items.map((it, i) => (
                        <li key={i}>{itemText(it)}</li>
                      ))}
                    </ul>
                    <div className="mt-1 flex items-center justify-between border-t border-border pt-2 text-xs text-muted">
                      <span>{formatRupees(o.total_paise)} · {o.payment_mode} · {o.payment_status}</span>
                    </div>
                    <motion.button
                      whileTap={{ scale: 0.96 }}
                      onClick={() => markDone(o.order_code)}
                      className="mt-1 rounded-xl bg-brand-gradient px-3 py-2 text-sm font-bold text-white shadow-warm-sm"
                    >
                      Mark ready
                    </motion.button>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </section>

      {done.length > 0 && (
        <section>
          <h2 className="mb-3 text-xs font-bold uppercase tracking-wide text-muted">✅ Recently ready</h2>
          <div className="flex flex-wrap gap-2">
            <AnimatePresence initial={false}>
              {done.map((o) => (
                <motion.span
                  key={o.order_code}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="rounded-lg border border-veg/40 bg-green-50 px-3 py-1.5 text-sm text-green-800"
                >
                  <strong>#{String(o.token).padStart(2, "0")}</strong> {o.name || "Guest"}
                </motion.span>
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  );
}
