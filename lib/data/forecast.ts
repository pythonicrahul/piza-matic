import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ForecastRun {
  id: string;
  generated_at: string;
  model: string;
  features: string;
  rmse: number;
  notes: string | null;
}

export interface ForecastSlot {
  target_date: string;
  hour: number;
  day_of_week: number;
  predicted_orders: number;
  is_peak: boolean;
}

/** The most recent forecast run and its per-slot predictions (admin RLS). */
export async function getLatestForecast(): Promise<{ run: ForecastRun; slots: ForecastSlot[] } | null> {
  const supabase = await createClient();

  const { data: run } = await supabase
    .from("forecast_runs")
    .select("id, generated_at, model, features, rmse, notes")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!run) return null;

  const { data: slots } = await supabase
    .from("demand_forecasts")
    .select("target_date, hour, day_of_week, predicted_orders, is_peak")
    .eq("run_id", run.id)
    .order("target_date", { ascending: true })
    .order("hour", { ascending: true });

  return {
    run: { ...run, rmse: Number(run.rmse) },
    slots: (slots ?? []).map((s) => ({ ...s, predicted_orders: Number(s.predicted_orders) })),
  };
}
