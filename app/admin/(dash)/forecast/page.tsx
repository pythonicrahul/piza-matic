import { getLatestForecast, type ForecastSlot } from "@/lib/data/forecast";

export const dynamic = "force-dynamic";

// Sequential single-hue (orange) ramp, light→dark = low→high demand.
const RAMP = ["#fdecdc", "#fbcfa0", "#f7a862", "#ef7d2e", "#c2410c"];
const EMPTY = "#f7f3ef";

function colorFor(value: number, max: number): string {
  if (max <= 0 || value <= 0.01) return EMPTY;
  const f = value / max;
  const idx = Math.min(RAMP.length - 1, Math.floor(f * RAMP.length - 1e-9));
  return RAMP[Math.max(0, idx)];
}

function dayLabel(iso: string): string {
  return new Date(`${iso}T00:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function hourLabel(h: number): string {
  const am = h < 12;
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}${am ? "am" : "pm"}`;
}

export default async function ForecastPage() {
  const forecast = await getLatestForecast();

  if (!forecast) {
    return (
      <div>
        <h1 className="mb-1 text-2xl font-extrabold">Demand forecast</h1>
        <div className="mt-4 rounded-2xl border border-dashed border-border bg-surface p-6 text-center text-sm text-muted">
          No forecast yet. Run the model with <code>python forecast/train.py</code> to populate it.
        </div>
      </div>
    );
  }

  const { run, slots } = forecast;

  // group slots by date, index by hour
  const dates = [...new Set(slots.map((s) => s.target_date))];
  const byDateHour = new Map<string, ForecastSlot>();
  for (const s of slots) byDateHour.set(`${s.target_date}:${s.hour}`, s);
  const max = Math.max(...slots.map((s) => s.predicted_orders), 0);
  const peaks = slots.filter((s) => s.is_peak).sort((a, b) => b.predicted_orders - a.predicted_orders);
  const hourTicks = [0, 6, 12, 18, 23];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">Demand forecast</h1>
        <p className="text-sm text-muted">
          {run.model} · RMSE <span className="font-semibold text-foreground">{run.rmse.toFixed(2)}</span> ·
          features: {run.features} · generated {new Date(run.generated_at).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" })}
        </p>
      </div>

      {/* Peak slots */}
      <div>
        <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Predicted busiest slots (next 7 days)</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {peaks.map((p) => (
            <div key={`${p.target_date}-${p.hour}`} className="rounded-2xl border border-brand/30 bg-orange-50 p-4">
              <p className="text-xs font-semibold uppercase text-brand">🔥 Peak</p>
              <p className="mt-1 text-lg font-extrabold">{dayLabel(p.target_date)}, {hourLabel(p.hour)}</p>
              <p className="text-sm text-muted">~{p.predicted_orders.toFixed(1)} orders/hr</p>
            </div>
          ))}
        </div>
      </div>

      {/* Heatmap: day (row) × hour (col) */}
      <div className="rounded-2xl border border-border bg-surface p-4">
        <h2 className="mb-3 font-semibold">Orders per hour, next 7 days (IST)</h2>
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            {/* hour axis */}
            <div className="mb-1 flex pl-24 text-[10px] text-muted">
              {Array.from({ length: 24 }, (_, h) => (
                <div key={h} className="flex-1 text-center">{hourTicks.includes(h) ? hourLabel(h) : ""}</div>
              ))}
            </div>
            {dates.map((d) => (
              <div key={d} className="mb-1 flex items-center">
                <div className="w-24 shrink-0 pr-2 text-right text-xs font-medium text-muted">{dayLabel(d)}</div>
                <div className="flex flex-1 gap-[2px]">
                  {Array.from({ length: 24 }, (_, h) => {
                    const slot = byDateHour.get(`${d}:${h}`);
                    const v = slot?.predicted_orders ?? 0;
                    return (
                      <div
                        key={h}
                        title={`${dayLabel(d)} ${hourLabel(h)} — ~${v.toFixed(1)} orders`}
                        className={`h-6 flex-1 rounded-[3px] ${slot?.is_peak ? "ring-2 ring-brand-dark" : ""}`}
                        style={{ background: colorFor(v, max) }}
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted">
          <span>Fewer</span>
          <div className="flex gap-[2px]">
            <div className="h-3 w-6 rounded-[2px]" style={{ background: EMPTY }} />
            {RAMP.map((c) => (
              <div key={c} className="h-3 w-6 rounded-[2px]" style={{ background: c }} />
            ))}
          </div>
          <span>More</span>
          <span className="ml-3">Peak hours ringed. Hover a cell for the number.</span>
        </div>
      </div>
    </div>
  );
}
