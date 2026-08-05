/**
 * SMART ABSENSI GURU - GEOFENCE HAVERSINE MATH
 */

export const calculateDistanceMeters = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
};

/**
 * SHARED RADIUS HELPER
 * Returns the effective allowed geofence radius for attendance validation.
 * Both frontend (QRScannerOverlay) and backend (SupabaseProvider) MUST use
 * this function so they always enforce the same limit.
 *
 * Rules:
 *  - Minimum floor: 100m (avoids false-rejections due to GPS drift on cheap devices)
 *  - Maximum cap: 2000m (prevents admin misconfiguration accepting whole city)
 *  - Input configuredRadius comes from admin settings (geofence_radius column)
 */
export const getEffectiveAllowedRadius = (configuredRadius: number | undefined | null): number => {
  const MIN_RADIUS = 100; // meters
  const MAX_RADIUS = 2000; // meters
  const raw = typeof configuredRadius === 'number' && configuredRadius > 0 ? configuredRadius : MIN_RADIUS;
  return Math.min(Math.max(raw, MIN_RADIUS), MAX_RADIUS);
};
