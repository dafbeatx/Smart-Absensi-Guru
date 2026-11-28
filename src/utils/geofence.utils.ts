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

export interface CompensatedDistanceResult {
  rawDistanceMeters: number;
  compensationMeters: number;
  effectiveDistanceMeters: number;
}

/**
 * Computes bounded effective distance from raw geofence distance and GPS accuracy:
 *   effectiveDistance = Math.max(0, rawDistance - Math.min(safeAccuracy, B_max))
 * Invalid/negative/NaN accuracy values yield 0 compensation.
 */
export const calculateCompensatedDistance = (
  rawDistanceMeters: number,
  accuracyMeters: unknown,
  maxCompensationMeters: number = 35
): CompensatedDistanceResult => {
  const safeRaw =
    typeof rawDistanceMeters === 'number' && Number.isFinite(rawDistanceMeters)
      ? Math.max(0, Math.round(rawDistanceMeters))
      : 0;
  const safeAccuracy =
    typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters) && accuracyMeters > 0
      ? accuracyMeters
      : 0;
  const safeMaxComp =
    typeof maxCompensationMeters === 'number' && Number.isFinite(maxCompensationMeters)
      ? Math.max(0, Math.round(maxCompensationMeters))
      : 0;

  const compensationMeters = Math.min(Math.round(safeAccuracy), safeMaxComp);
  const effectiveDistanceMeters = Math.max(0, safeRaw - compensationMeters);

  return {
    rawDistanceMeters: safeRaw,
    compensationMeters,
    effectiveDistanceMeters,
  };
};

export interface ServerGeofenceGateParams {
  rawDistanceMeters: number;
  gpsAccuracy: unknown;
  allowedRadiusMeters: number;
  isBiometric: boolean;
  isOfflineSync?: boolean;
  maxAllowedAccuracyMeters?: number;
  maxCompensationMeters?: number;
}

/**
 * Backend geofence validator synchronized with client B_max compensation bounds.
 * Biometric defaults to strict B_max = 25m; Door QR defaults to B_max = 35m.
 * If accuracy is missing/NaN/negative or exceeds maxAllowedAccuracyMeters, compensation is 0.
 */
export const evaluateServerGeofenceGate = (
  params: ServerGeofenceGateParams
): CompensatedDistanceResult & { isAllowed: boolean } => {
  const maxAccuracy =
    params.maxAllowedAccuracyMeters ?? (params.isBiometric ? 100 : 90);
  const bMax =
    params.maxCompensationMeters ?? (params.isBiometric ? 25 : 35);

  const validAccuracy =
    typeof params.gpsAccuracy === 'number' &&
    Number.isFinite(params.gpsAccuracy) &&
    params.gpsAccuracy > 0 &&
    params.gpsAccuracy <= maxAccuracy
      ? params.gpsAccuracy
      : 0;

  const compResult = calculateCompensatedDistance(
    params.rawDistanceMeters,
    validAccuracy,
    validAccuracy > 0 ? bMax : 0
  );

  const isAllowed = params.isOfflineSync
    ? true
    : compResult.effectiveDistanceMeters <= params.allowedRadiusMeters;

  return {
    ...compResult,
    isAllowed,
  };
};

export interface PositionFreshnessResult {
  isStale: boolean;
  ageMs: number;
  anomaly: 'NONE' | 'DEVICE_CLOCK_BEHIND' | 'STALE_TIMESTAMP';
  suggestedClockSkewMs?: number;
}

/**
 * Evaluates geolocation position.timestamp against local wall clock with clock-skew guard.
 * - Rejects cached fixes older than maxAgeMs (default 10s).
 * - Prevents false rejection when device clock lags GPS time (rawDelta < -2000ms) or
 *   when a calibrated device-vs-satellite clockSkewOffsetMs is supplied.
 */
export const evaluatePositionFreshness = (
  positionTimestamp: unknown,
  receivedAtMs: number,
  maxAgeMs: number = 10000,
  clockSkewOffsetMs: number = 0
): PositionFreshnessResult => {
  if (
    typeof positionTimestamp !== 'number' ||
    !Number.isFinite(positionTimestamp) ||
    positionTimestamp <= 0
  ) {
    return { isStale: false, ageMs: 0, anomaly: 'NONE' };
  }

  const safeSkew =
    typeof clockSkewOffsetMs === 'number' && Number.isFinite(clockSkewOffsetMs)
      ? clockSkewOffsetMs
      : 0;
  const rawDelta = receivedAtMs - positionTimestamp;

  // Device clock lags GPS satellite clock (> 2s ahead of local Date.now())
  if (rawDelta < -2000 && safeSkew === 0) {
    return {
      isStale: false,
      ageMs: 0,
      anomaly: 'DEVICE_CLOCK_BEHIND',
      suggestedClockSkewMs: positionTimestamp - receivedAtMs,
    };
  }

  const adjustedDelta = receivedAtMs + safeSkew - positionTimestamp;
  if (adjustedDelta >= -2000 && adjustedDelta <= maxAgeMs) {
    return {
      isStale: false,
      ageMs: Math.max(0, Math.round(adjustedDelta)),
      anomaly: 'NONE',
    };
  }

  return {
    isStale: true,
    ageMs: Math.max(0, Math.round(Math.abs(adjustedDelta))),
    anomaly: 'STALE_TIMESTAMP',
  };
};

export interface GpsJumpEvaluation {
  isJump: boolean;
  jumpMeters: number;
  speedMps: number;
  dtMs: number;
  isCoarseJump: boolean;
  withinSpikeWindow: boolean;
}

/**
 * Detects physically impossible coordinate jumps (e.g. > 50 m/s in < 2s caused by BTS bounce).
 */
export const evaluateCoordinateJump = (
  candidate: { latitude: number; longitude: number; accuracy: number; timestamp: number },
  baseline: { latitude: number; longitude: number; accuracy: number; timestamp: number },
  options?: { maxOutlierSpeedMps?: number; windowMs?: number; coarseAccuracyThreshold?: number }
): GpsJumpEvaluation => {
  const maxSpeedMps = options?.maxOutlierSpeedMps ?? 50;
  const windowMs = options?.windowMs ?? 2000;
  const coarseThreshold = options?.coarseAccuracyThreshold ?? 50;

  const dtMs = Math.max(50, candidate.timestamp - baseline.timestamp);
  const dtSec = dtMs / 1000;
  const jumpMeters = calculateDistanceMeters(
    candidate.latitude,
    candidate.longitude,
    baseline.latitude,
    baseline.longitude
  );
  const speedMps = jumpMeters / dtSec;
  const isJump = jumpMeters > 80 && speedMps > maxSpeedMps;
  const withinSpikeWindow = dtMs <= windowMs;

  return {
    isJump,
    jumpMeters,
    speedMps,
    dtMs,
    isCoarseJump: isJump && candidate.accuracy > coarseThreshold,
    withinSpikeWindow,
  };
};

/**
 * Picks spatial median from tightest accuracy cluster (>= 3 samples) or best accuracy fix.
 */
export const selectBestGpsSample = <
  T extends { latitude: number; longitude: number; accuracy: number; timestamp: number }
>(
  samples: T[]
): (T & { selectionMethod: 'MEDIAN_CLUSTER' | 'BEST_ACCURACY' }) | null => {
  if (!samples || samples.length === 0) return null;

  const normalized = [...samples].sort((a, b) => {
    const accA = Number.isFinite(a.accuracy) && a.accuracy > 0 ? a.accuracy : Number.MAX_SAFE_INTEGER;
    const accB = Number.isFinite(b.accuracy) && b.accuracy > 0 ? b.accuracy : Number.MAX_SAFE_INTEGER;
    if (accA !== accB) return accA - accB;
    return b.timestamp - a.timestamp;
  });

  const best = normalized[0];
  const minAcc = Number.isFinite(best.accuracy) && best.accuracy > 0 ? best.accuracy : 50;
  const clusterLimit = Math.max(minAcc * 1.5, minAcc + 15);
  const cluster = normalized.filter((s) => s.accuracy <= clusterLimit);

  if (cluster.length >= 3) {
    const lats = cluster.map((c) => c.latitude).sort((a, b) => a - b);
    const lngs = cluster.map((c) => c.longitude).sort((a, b) => a - b);
    const accs = cluster.map((c) => c.accuracy).sort((a, b) => a - b);
    const mid = Math.floor(cluster.length / 2);

    return {
      ...best,
      latitude: lats[mid],
      longitude: lngs[mid],
      accuracy: Math.round(accs[mid] * 10) / 10,
      selectionMethod: 'MEDIAN_CLUSTER',
    };
  }

  return {
    ...best,
    selectionMethod: 'BEST_ACCURACY',
  };
};

/**
 * Prevents overwriting an active accurate GPS fix with a coarser candidate fix.
 */
export const shouldReplaceWithBetterFix = (
  current: { accuracy: number; timestamp?: number } | null | undefined,
  candidate: { accuracy: number },
  maxAgeMs: number = 10000,
  nowMs: number = Date.now()
): boolean => {
  if (!current) return true;
  if (typeof current.timestamp === 'number' && nowMs - current.timestamp > maxAgeMs) {
    return true;
  }
  const candAcc =
    typeof candidate.accuracy === 'number' && Number.isFinite(candidate.accuracy) && candidate.accuracy > 0
      ? candidate.accuracy
      : Number.MAX_SAFE_INTEGER;
  const currAcc =
    typeof current.accuracy === 'number' && Number.isFinite(current.accuracy) && current.accuracy > 0
      ? current.accuracy
      : Number.MAX_SAFE_INTEGER;

  return candAcc <= currAcc;
};
