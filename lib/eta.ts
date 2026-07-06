// Delivery / pickup time estimate shown on the order tracking page.
//
// ETA = travel time (shop → drop) + queue time (orders in the kitchen × avg).
//   • travel: straight-line distance ÷ an effective speed that folds in road
//     detours + city traffic (we only have great-circle km, no maps API).
//   • queue: how many orders are in the pipeline at/before this one, each adding
//     ~7 min of kitchen throughput. Because an active order counts itself, the
//     queue term is always ≥ 7 min — a built-in minimum prep time.
// Take-away orders have no travel leg (distanceKm = null).

export const AVG_SPEED_KMPH = 18; // effective speed for a straight-line proxy
export const MINUTES_PER_ORDER = 7; // avg kitchen throughput per pending order

export interface EtaInput {
  distanceKm: number | null; // null for take-away (no travel leg)
  pendingOrders: number; // active orders at/before this one (incl. itself)
}

/** Whole-minute estimate, never below 1. */
export function estimateMinutes({ distanceKm, pendingOrders }: EtaInput): number {
  const travel = distanceKm && distanceKm > 0 ? (distanceKm / AVG_SPEED_KMPH) * 60 : 0;
  const queue = Math.max(0, pendingOrders) * MINUTES_PER_ORDER;
  return Math.max(1, Math.round(travel + queue));
}

/** placed_at + eta → the target arrival timestamp (ISO). */
export function targetIso(placedAtIso: string, etaMinutes: number): string {
  return new Date(new Date(placedAtIso).getTime() + etaMinutes * 60_000).toISOString();
}
