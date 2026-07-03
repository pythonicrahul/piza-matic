// Geofencing helpers for the 4 km delivery radius.
// Straight-line (great-circle) distance via the Haversine formula — no maps API.

const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in kilometres between two lat/lng points. */
export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export interface GeofenceResult {
  serviceable: boolean;
  distanceKm: number;
}

/** Is a dropoff within `radiusKm` of the shop? Distance rounded to 2 dp. */
export function checkGeofence(
  shopLat: number,
  shopLng: number,
  dropLat: number,
  dropLng: number,
  radiusKm: number,
): GeofenceResult {
  const distanceKm = Math.round(haversineKm(shopLat, shopLng, dropLat, dropLng) * 100) / 100;
  return { serviceable: distanceKm <= radiusKm, distanceKm };
}
