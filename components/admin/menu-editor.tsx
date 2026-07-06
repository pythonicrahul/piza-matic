"use client";

import { useState } from "react";
import { VegDot } from "@/components/veg-dot";

export interface EditableItem {
  id: string;
  name: string;
  price_paise: number;
  is_veg: boolean | null;
  is_available: boolean;
}

export type MenuGroups = Record<"base" | "pizza" | "topping", EditableItem[]>;

const GROUPS: { key: keyof MenuGroups; label: string }[] = [
  { key: "pizza", label: "Pizzas" },
  { key: "base", label: "Bases" },
  { key: "topping", label: "Toppings" },
];

export function MenuEditor({ groups }: { groups: MenuGroups }) {
  return (
    <div className="space-y-8">
      {GROUPS.map((g) => (
        <section key={g.key}>
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">{g.label}</h2>
          <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-warm-sm">
            {groups[g.key].map((item, i) => (
              <ItemRow key={item.id} item={item} first={i === 0} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function ItemRow({ item, first }: { item: EditableItem; first: boolean }) {
  const [rupees, setRupees] = useState((item.price_paise / 100).toString());
  const [baseline, setBaseline] = useState(item.price_paise);
  const [available, setAvailable] = useState(item.is_available);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const paise = Math.round(parseFloat(rupees) * 100);
  const validPrice = Number.isFinite(paise) && paise >= 0;
  const dirty = validPrice && paise !== baseline;

  async function patch(payload: Record<string, unknown>): Promise<boolean> {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/admin/menu", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: item.id, ...payload }),
      });
      const d = await res.json();
      if (!d.ok) {
        setError(d.error || "Failed");
        return false;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
      return true;
    } catch {
      setError("Network error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function savePrice() {
    if (!dirty) return;
    if (await patch({ price_paise: paise })) setBaseline(paise);
  }

  async function toggleAvailable() {
    const next = !available;
    setAvailable(next); // optimistic
    if (!(await patch({ is_available: next }))) setAvailable(!next); // revert on failure
  }

  return (
    <div className={`flex flex-wrap items-center gap-3 px-4 py-3 ${first ? "" : "border-t border-border"} ${available ? "" : "opacity-60"}`}>
      <VegDot isVeg={item.is_veg} />
      <span className="min-w-0 flex-1 truncate font-medium">{item.name}</span>

      <div className="flex items-center gap-1">
        <span className="text-muted">₹</span>
        <input
          type="number"
          min="0"
          step="1"
          inputMode="decimal"
          value={rupees}
          onChange={(e) => setRupees(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && savePrice()}
          className="w-20 rounded-lg border border-border bg-surface px-2 py-1 text-right focus:border-brand focus:outline-none"
        />
        <button
          onClick={savePrice}
          disabled={!dirty || saving}
          className="rounded-lg bg-brand px-3 py-1 text-sm font-semibold text-white transition-opacity disabled:opacity-40"
        >
          {saving ? "…" : saved ? "✓" : "Save"}
        </button>
      </div>

      <button
        onClick={toggleAvailable}
        disabled={saving}
        className={`w-24 rounded-lg border px-2 py-1 text-xs font-semibold ${
          available ? "border-veg/40 bg-green-50 text-veg" : "border-border bg-background text-muted"
        }`}
      >
        {available ? "Available" : "Sold out"}
      </button>

      {error && <span className="w-full text-right text-xs text-red-500">{error}</span>}
    </div>
  );
}
