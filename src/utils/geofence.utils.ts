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
 *  - Minimum floor: 100m (or minBufferFloor if specified, e.g. 500m for door poster/school zone)
 *  - Maximum cap: 2000m (prevents admin misconfiguration accepting whole city)
 *  - Input configuredRadius comes from admin settings (geofence_radius column)
 */
export const getEffectiveAllowedRadius = (
  configuredRadius: number | undefined | null,
  minBufferFloor: number = 100
): number => {
  const MIN_RADIUS = Math.max(100, minBufferFloor); // meters
  const MAX_RADIUS = 2000; // meters
  const raw = typeof configuredRadius === 'number' && configuredRadius > 0 ? configuredRadius : MIN_RADIUS;
  return Math.min(Math.max(raw, MIN_RADIUS), MAX_RADIUS);
};

/**
 * Auto-sanitizes raw GPS coordinate inputs, fixing non-decimal representations
 * (e.g. -6613144 -> -6.613144, 106684975 -> 106.684975) per protocol.
 */
export const sanitizeCoordinate = (val: unknown, isLat: boolean, defaultVal: number): number => {
  if (val === undefined || val === null || val === '') {
    return defaultVal;
  }
  let str = String(val).trim().replace(',', '.');
  if (!str.includes('.')) {
    const raw = parseFloat(str);
    if (!isNaN(raw) && Math.abs(raw) > 180) {
      if (isLat && str.startsWith('-')) {
        str = str.substring(0, 2) + '.' + str.substring(2);
      } else if (isLat) {
        str = str.substring(0, 1) + '.' + str.substring(1);
      } else if (str.length >= 8) {
        str = str.substring(0, 3) + '.' + str.substring(3);
      }
    }
  }
  const parsed = parseFloat(str);
  return !isNaN(parsed) ? parsed : defaultVal;
};

/**
 * Sanitizes and normalizes school geofence coordinates.
 * Resolves legacy 14-km longitude offset (106.812... vs official 106.684975)
 * and Jakarta Monas placeholder coordinates back to the official school coordinates.
 */
export const sanitizeSchoolCoordinates = (
  rawLat: unknown,
  rawLng: unknown
): { lat: number; lng: number } => {
  const DEFAULT_LAT = -6.613144;
  const DEFAULT_LNG = 106.684975;

  let lat = sanitizeCoordinate(rawLat, true, DEFAULT_LAT);
  let lng = sanitizeCoordinate(rawLng, false, DEFAULT_LNG);

  // 1. Detect Jakarta Monas default coordinates (-6.2, 106.81) and replace with official school
  if (lat === -6.2 || (lat > -6.21 && lat < -6.19 && lng > 106.81 && lng < 106.83)) {
    lat = DEFAULT_LAT;
    lng = DEFAULT_LNG;
  }

  // 2. Detect the legacy/stale 14km longitude mismatch (106.812... vs true school location 106.684975)
  // When latitude matches school (~ -6.61), if longitude is around 106.81, auto-correct to 106.684975
  if (Math.abs(lat - DEFAULT_LAT) < 0.05 && lng > 106.80 && lng < 106.83) {
    lng = DEFAULT_LNG;
  }

  return { lat, lng };
};
