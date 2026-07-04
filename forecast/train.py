"""
SliceMatic demand forecasting (AI Feature C).

Trains a RandomForestRegressor on historical order volume per (day, hour) and
predicts the next 7 days x 24 hours. Reads orders + writes forecasts through the
Supabase REST API (service-role key) — no direct DB connection needed.

Run:  python forecast/train.py     (see forecast/README for setup)

Model:    RandomForestRegressor
Features: hour_of_day, day_of_week, is_weekend
Metric:   RMSE on a time-based holdout (last 20% of days)
Output:   forecast_runs (model, features, rmse) + demand_forecasts (per slot,
          top-3 predicted slots flagged is_peak)
"""

import os
from collections import Counter
from datetime import datetime, timedelta, date
from zoneinfo import ZoneInfo

from dotenv import load_dotenv
from supabase import create_client
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_squared_error

IST = ZoneInfo("Asia/Kolkata")
HORIZON_DAYS = 7


def load_orders(sb):
    """Fetch order timestamps (paginated) and bucket to counts per (IST date, hour)."""
    rows, page = [], 0
    while True:
        chunk = (
            sb.table("orders")
            .select("placed_at")
            .order("placed_at")
            .range(page * 1000, page * 1000 + 999)
            .execute()
            .data
        )
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        page += 1

    counts = Counter()
    days = set()
    for r in rows:
        ts = datetime.fromisoformat(r["placed_at"].replace("Z", "+00:00")).astimezone(IST)
        d = ts.date()
        counts[(d, ts.hour)] += 1
        days.add(d)
    return counts, sorted(days)


def build_dataset(counts, days):
    """Full grid: every observed day x 24 hours, count (0 where none)."""
    X, y, day_index = [], [], []
    for d in days:
        for h in range(24):
            dow = d.weekday()  # Mon=0..Sun=6
            X.append([h, dow, 1 if dow >= 5 else 0])
            y.append(counts.get((d, h), 0))
            day_index.append(d)
    return np.array(X, dtype=float), np.array(y, dtype=float), day_index


def main():
    load_dotenv()
    url = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
    key = os.environ["SUPABASE_SECRET_KEY"]
    sb = create_client(url, key)

    counts, days = load_orders(sb)
    if len(days) < 4:
        raise SystemExit("Not enough history to train (need a few days of orders).")

    X, y, day_index = build_dataset(counts, days)

    # Time-based split: last 20% of DAYS held out.
    cutoff = days[int(len(days) * 0.8)]
    train_mask = np.array([d < cutoff for d in day_index])
    Xtr, ytr = X[train_mask], y[train_mask]
    Xte, yte = X[~train_mask], y[~train_mask]

    model = RandomForestRegressor(n_estimators=200, random_state=42)
    model.fit(Xtr, ytr)

    rmse = float(np.sqrt(mean_squared_error(yte, model.predict(Xte)))) if len(yte) else 0.0
    print(f"Trained on {len(Xtr)} rows, tested on {len(Xte)} → RMSE {rmse:.3f}")

    # Predict the next HORIZON_DAYS x 24 hours.
    today = datetime.now(IST).date()
    preds = []
    for i in range(1, HORIZON_DAYS + 1):
        d = today + timedelta(days=i)
        dow = d.weekday()
        for h in range(24):
            p = float(model.predict([[h, dow, 1 if dow >= 5 else 0]])[0])
            preds.append({"target_date": d.isoformat(), "hour": h, "day_of_week": dow, "predicted_orders": round(p, 2)})

    # Flag the top-3 busiest predicted slots.
    top = sorted(preds, key=lambda p: p["predicted_orders"], reverse=True)[:3]
    top_keys = {(p["target_date"], p["hour"]) for p in top}
    for p in preds:
        p["is_peak"] = (p["target_date"], p["hour"]) in top_keys

    # Persist: clear old runs (cascades) then write the new run + slots.
    sb.table("forecast_runs").delete().gte("generated_at", "2000-01-01").execute()
    run = (
        sb.table("forecast_runs")
        .insert({
            "model": "RandomForestRegressor",
            "features": "hour_of_day, day_of_week, is_weekend",
            "rmse": round(rmse, 3),
            "notes": f"trained on {len(days)} days of order history",
        })
        .execute()
        .data[0]
    )
    for p in preds:
        p["run_id"] = run["id"]
    sb.table("demand_forecasts").insert(preds).execute()

    peak_str = ", ".join(f"{p['target_date']} {p['hour']:02d}:00 (~{p['predicted_orders']})" for p in top)
    print(f"Wrote {len(preds)} forecast slots. Peak slots: {peak_str}")


if __name__ == "__main__":
    main()
