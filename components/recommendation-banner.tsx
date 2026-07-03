"use client";

import { useEffect, useState } from "react";

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

  if (!rec) return null;

  return (
    <div className="mb-5 rounded-2xl border border-brand/30 bg-orange-50 p-4">
      <div className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand">
        <span>✨ {source === "ai" ? "Recommended for you" : "Popular pick"}</span>
      </div>
      <p className="font-semibold">
        {rec.pizza} on {rec.base}
        {rec.topping ? ` + ${rec.topping}` : ""}
      </p>
      <p className="text-sm text-muted">{rec.reason}</p>
    </div>
  );
}
