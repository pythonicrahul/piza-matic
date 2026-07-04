"use client";

import { motion } from "framer-motion";

const STATUS_STEPS = ["placed", "confirmed", "preparing", "ready", "out_for_delivery", "delivered"] as const;
const STATUS_LABEL: Record<string, string> = {
  placed: "Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  ready: "Ready",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
};

// A handful of small bursting dots behind the token — tasteful, no
// canvas/confetti library, just a few staggered motion elements.
function Burst() {
  const dots = Array.from({ length: 8 }, (_, i) => i);
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      {dots.map((i) => {
        const angle = (i / dots.length) * Math.PI * 2;
        return (
          <motion.span
            key={i}
            className="absolute h-1.5 w-1.5 rounded-full bg-white"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: Math.cos(angle) * 70, y: Math.sin(angle) * 70, opacity: 0, scale: 0.5 }}
            transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          />
        );
      })}
    </div>
  );
}

export function OrderConfirmedHeader({
  token,
  orderCode,
  paymentLine,
}: {
  token: number;
  orderCode: string;
  paymentLine: string;
}) {
  return (
    <div className="bg-noise shadow-warm-lg relative mb-5 overflow-hidden rounded-2xl bg-brand-gradient p-5 text-center text-white">
      <Burst />
      <p className="text-sm text-white/85">Order confirmed 🎉</p>
      <motion.p
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 16, delay: 0.05 }}
        className="mt-1 text-4xl font-black"
      >
        #{String(token).padStart(2, "0")}
      </motion.p>
      <p className="mt-1 text-xs text-white/70">{orderCode}</p>
      <p className="mt-2 text-sm">{paymentLine}</p>
    </div>
  );
}

export function OrderTracker({ status }: { status: string }) {
  const currentIdx = Math.max(0, STATUS_STEPS.indexOf(status as (typeof STATUS_STEPS)[number]));
  const pct = (currentIdx / (STATUS_STEPS.length - 1)) * 100;

  return (
    <div className="relative mb-5 rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
      <div className="relative mb-2 mx-2">
        <div className="absolute left-0 right-0 top-1.5 h-0.5 -translate-y-1/2 bg-border" />
        <motion.div
          className="absolute left-0 top-1.5 h-0.5 -translate-y-1/2 bg-brand-gradient"
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
        />
        <div className="relative flex justify-between">
          {STATUS_STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-3 w-3 rounded-full border-2 ${
                i <= currentIdx ? "border-brand bg-brand" : "border-border bg-surface"
              }`}
            />
          ))}
        </div>
      </div>
      <ol className="flex justify-between text-center text-[11px]">
        {STATUS_STEPS.map((s, i) => (
          <li key={s} className={`w-0 flex-1 ${i <= currentIdx ? "font-semibold text-brand" : "text-muted"}`}>
            {STATUS_LABEL[s]}
          </li>
        ))}
      </ol>
    </div>
  );
}
