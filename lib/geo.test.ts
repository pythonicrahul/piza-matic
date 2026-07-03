import { describe, expect, it } from "vitest";
import { haversineKm, checkGeofence } from "./geo";

const SHOP = { lat: 28.5905, lng: 77.3037 }; // New Ashok Nagar

describe("haversineKm", () => {
  it("is zero for identical points", () => {
    expect(haversineKm(SHOP.lat, SHOP.lng, SHOP.lat, SHOP.lng)).toBeCloseTo(0, 6);
  });
  it("≈111 km per degree of latitude", () => {
    expect(haversineKm(0, 0, 1, 0)).toBeCloseTo(111.19, 1);
  });
  it("is symmetric", () => {
    const a = haversineKm(28.6, 77.3, 28.5, 77.2);
    const b = haversineKm(28.5, 77.2, 28.6, 77.3);
    expect(a).toBeCloseTo(b, 9);
  });
});

describe("checkGeofence (4 km radius)", () => {
  it("serviceable within the radius", () => {
    const r = checkGeofence(SHOP.lat, SHOP.lng, 28.595, 77.305, 4);
    expect(r.serviceable).toBe(true);
    expect(r.distanceKm).toBeLessThan(4);
  });
  it("not serviceable far away", () => {
    const r = checkGeofence(SHOP.lat, SHOP.lng, 28.7, 77.1, 4);
    expect(r.serviceable).toBe(false);
    expect(r.distanceKm).toBeGreaterThan(4);
  });
  it("boundary is inclusive (distance == radius is serviceable)", () => {
    // radius set to the exact computed distance → still serviceable (<=)
    const d = Math.round(haversineKm(SHOP.lat, SHOP.lng, 28.595, 77.305) * 100) / 100;
    expect(checkGeofence(SHOP.lat, SHOP.lng, 28.595, 77.305, d).serviceable).toBe(true);
    // a hair under → rejected
    expect(checkGeofence(SHOP.lat, SHOP.lng, 28.595, 77.305, d - 0.01).serviceable).toBe(false);
  });
  it("rounds distance to 2 dp", () => {
    const r = checkGeofence(SHOP.lat, SHOP.lng, 28.595, 77.305, 4);
    expect(Number(r.distanceKm.toFixed(2))).toBe(r.distanceKm);
  });
});
