"use client";

import { useCallback, useEffect, useState } from "react";
import { formatRupees } from "@/lib/money";

interface Current {
  id: string;
  status: string;
  distance_km: number;
  dropoff_lat: number;
  dropoff_lng: number;
  dropoff_address: string | null;
  order: {
    order_code: string;
    token: number;
    name: string | null;
    phone: string;
    total_paise: number;
    payment_mode: string;
    payment_status: string;
    order_items: { qty: number; pizza: { name: string } | null; base: { name: string } | null }[];
  } | null;
}

export function RiderConsole() {
  const [online, setOnline] = useState(false);
  const [current, setCurrent] = useState<Current | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/rider/current", { cache: "no-store" });
      if (r.ok) {
        const d = await r.json();
        setOnline(Boolean(d.online));
        setCurrent(d.current ?? null);
      }
    } catch {
      // transient network error (e.g. dev restart) — the next poll retries
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, 6000);
    return () => clearInterval(id);
  }, [load]);

  async function toggleOnline() {
    setBusy(true);
    const next = !online;
    setOnline(next); // optimistic
    await fetch("/api/rider/online", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ online: next }),
    });
    await load();
    setBusy(false);
  }

  async function advance(action: "pickup" | "deliver") {
    setBusy(true);
    await fetch("/api/rider/advance", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    await load();
    setBusy(false);
  }

  if (loading) return <p className="text-muted">Loading…</p>;

  return (
    <div className="space-y-5">
      {/* Availability */}
      <div className="flex items-center justify-between rounded-2xl border border-border bg-surface p-4">
        <div>
          <p className="font-semibold">{online ? "You're online" : "You're offline"}</p>
          <p className="text-xs text-muted">{online ? "You can receive deliveries" : "Go online to receive deliveries"}</p>
        </div>
        <button
          onClick={toggleOnline}
          disabled={busy}
          className={`rounded-full px-5 py-2 text-sm font-bold text-white disabled:opacity-50 ${online ? "bg-stone-500" : "bg-veg"}`}
        >
          {online ? "Go offline" : "Go online"}
        </button>
      </div>

      {/* Current assignment */}
      {current && current.order ? (
        <div className="rounded-2xl border-2 border-brand bg-surface p-5">
          <div className="mb-2 flex items-baseline justify-between">
            <span className="text-3xl font-black text-brand">#{String(current.order.token).padStart(2, "0")}</span>
            <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-brand capitalize">
              {current.status.replace(/_/g, " ")}
            </span>
          </div>

          <ul className="mb-3 space-y-1 text-sm">
            {current.order.order_items.map((it, i) => (
              <li key={i}>
                {it.qty}× {it.pizza?.name} <span className="text-muted">({it.base?.name})</span>
              </li>
            ))}
          </ul>

          <div className="mb-3 rounded-xl bg-background p-3 text-sm">
            <p className="font-semibold">{current.order.name || "Customer"} · {current.order.phone}</p>
            <p className="text-muted">{current.dropoff_address || "Shared location"} · {current.distance_km} km</p>
            <p className="mt-1">
              {formatRupees(current.order.total_paise)} ·{" "}
              <span className={current.order.payment_status === "paid" ? "text-veg" : "font-semibold text-brand"}>
                {current.order.payment_mode === "cash" ? "COLLECT CASH" : `paid (${current.order.payment_mode})`}
              </span>
            </p>
          </div>

          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${current.dropoff_lat},${current.dropoff_lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mb-3 block rounded-xl border border-border py-2.5 text-center text-sm font-semibold text-brand"
          >
            🧭 Navigate
          </a>

          {current.status === "assigned" ? (
            <button
              onClick={() => advance("pickup")}
              disabled={busy}
              className="w-full rounded-xl bg-brand py-3 font-bold text-white hover:bg-brand-dark disabled:opacity-50"
            >
              Picked up — start delivery
            </button>
          ) : (
            <button
              onClick={() => advance("deliver")}
              disabled={busy}
              className="w-full rounded-xl bg-veg py-3 font-bold text-white disabled:opacity-50"
            >
              Mark delivered
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted">
          {online ? "Waiting for your next delivery…" : "Go online to start receiving deliveries."}
        </div>
      )}
    </div>
  );
}
