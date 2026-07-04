"use client";

import { useEffect, useState } from "react";
import { animate } from "framer-motion";

interface NumericTileProps {
  label: string;
  numericValue: number;
  format: (n: number) => string;
  sub?: string;
  icon: React.ReactNode;
}

// A summary tile that counts up from 0 to its value on mount — used for the
// purely numeric admin metrics (revenue, order count, AOV).
export function StatTile({ label, numericValue, format, sub, icon }: NumericTileProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const controls = animate(0, numericValue, {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [numericValue]);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
      <span className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      <p className="truncate text-xl font-extrabold">{format(display)}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

// Non-numeric tile (e.g. "top pizza" name) — same chrome, no count-up.
export function TextTile({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: React.ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
      <span className="absolute inset-x-0 top-0 h-1 bg-brand-gradient" />
      <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase text-muted">
        <span className="text-brand">{icon}</span>
        {label}
      </div>
      <p className="truncate text-xl font-extrabold">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}
