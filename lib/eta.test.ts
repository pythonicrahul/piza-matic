import { describe, expect, it } from "vitest";
import { estimateMinutes, targetIso, AVG_SPEED_KMPH, MINUTES_PER_ORDER } from "./eta";

describe("estimateMinutes (order ETA)", () => {
  it("adds travel time and queue time", () => {
    // 3 km at 18 km/h = 10 min; + 1 order × 7 = 17 min
    expect(estimateMinutes({ distanceKm: 3, pendingOrders: 1 })).toBe(17);
  });

  it("has no travel leg for take-away (null distance)", () => {
    expect(estimateMinutes({ distanceKm: null, pendingOrders: 2 })).toBe(2 * MINUTES_PER_ORDER);
  });

  it("treats zero/negative distance as no travel", () => {
    expect(estimateMinutes({ distanceKm: 0, pendingOrders: 1 })).toBe(MINUTES_PER_ORDER);
  });

  it("never returns less than 1 minute", () => {
    expect(estimateMinutes({ distanceKm: null, pendingOrders: 0 })).toBe(1);
  });

  it("scales with the queue depth", () => {
    // 4 km at 18 km/h ≈ 13.33 min; + 3 × 7 = 21 → 34
    expect(estimateMinutes({ distanceKm: 4, pendingOrders: 3 })).toBe(34);
  });

  it("uses the documented constants", () => {
    expect(AVG_SPEED_KMPH).toBe(18);
    expect(MINUTES_PER_ORDER).toBe(7);
  });

  it("targetIso is placed_at + eta minutes", () => {
    const placed = "2026-07-06T15:00:00.000Z";
    expect(targetIso(placed, 20)).toBe("2026-07-06T15:20:00.000Z");
  });
});
