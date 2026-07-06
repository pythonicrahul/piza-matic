"use client";

import { useEffect, useState } from "react";

// Live ETA banner shown between the status tracker and the order details.
// The target time is computed on the server (queue + distance); here we just
// count down to it and re-render every 30s.
function remainingMin(targetIso: string): number {
  return Math.max(0, Math.round((new Date(targetIso).getTime() - Date.now()) / 60_000));
}

function clockIST(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Kolkata",
  });
}

export function OrderEta({ targetIso, fulfilment }: { targetIso: string; fulfilment: string }) {
  const isTakeaway = fulfilment === "takeaway";
  const [remaining, setRemaining] = useState(() => remainingMin(targetIso));

  useEffect(() => {
    setRemaining(remainingMin(targetIso));
    const t = setInterval(() => setRemaining(remainingMin(targetIso)), 30_000);
    return () => clearInterval(t);
  }, [targetIso]);

  const soon = remaining <= 1;

  return (
    <div className="mb-5 flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-warm-sm">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-brand/10 text-2xl">
        {isTakeaway ? "🛍️" : "🛵"}
      </span>
      <div className="min-w-0" suppressHydrationWarning>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted">
          {isTakeaway ? "Estimated pickup" : "Estimated delivery"}
        </p>
        <p className="text-lg font-extrabold leading-tight">
          {soon ? (isTakeaway ? "Ready any minute now" : "Arriving any minute now") : `~${remaining} min`}
        </p>
        {!soon && <p className="text-xs text-muted">by {clockIST(targetIso)}</p>}
      </div>
    </div>
  );
}
