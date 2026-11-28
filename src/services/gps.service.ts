import { CONSTANTS } from '../config/constants';
import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';
import {
  calculateCompensatedDistance,
  calculateDistanceMeters,
  evaluateCoordinateJump,
  evaluatePositionFreshness,
  getEffectiveAllowedRadius,
  sanitizeSchoolCoordinates,
  selectBestGpsSample,
  shouldReplaceWithBetterFix,
} from '../utils/geofence.utils';
import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger.utils';

export type GPSAttendanceMode = 'QR_SCAN' | 'BIOMETRIC' | 'DEFAULT';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceMeters: number;
  rawDistanceMeters?: number;
  compensationMeters?: number;
  isMock?: boolean;
  mockReason?: string;
  isSignalOutlier?: boolean;
  isApproximateLocation?: boolean;
  timestamp?: number;
  sampleCount?: number;
  rejectedOutliers?: number;
  staleFiltered?: number;
  speed?: number | null;
  altitude?: number | null;
  heading?: number | null;
}

export interface GPSValidationResult {
  isValid: boolean;
  coords?: GPSCoordinates;
  error?: ErrorDefinition;
}

export interface CachedGPSFix {
  coords: GPSCoordinates;
  timestamp: number;
}

export interface GeolocationLike {
  getCurrentPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ) => void;
  watchPosition: (
    success: PositionCallback,
    error?: PositionErrorCallback | null,
    options?: PositionOptions
  ) => number;
  clearWatch: (watchId: number) => void;
}

export interface GetGPSPositionOptions {
  mode?: GPSAttendanceMode;
  maxCompensationMeters?: number;
  maxAgeMs?: number;
  minSamples?: number;
  maxSamples?: number;
  sampleWindowMs?: number;
  sampleIntervalMs?: number;
  hardTimeoutMs?: number;
  geolocationProvider?: GeolocationLike;
  nowFn?: () => number;
}

export interface LivePositionMeta {
  rejectedOutliers: number;
  staleFiltered: number;
  consecutiveCoarseCount: number;
  isApproximateLocation: boolean;
}

export interface LivePositionListenerOptions {
  mode?: GPSAttendanceMode;
  maxCompensationMeters?: number;
  maxAgeMs?: number;
  geolocationProvider?: GeolocationLike;
  onUpdate: (coords: GPSCoordinates, meta: LivePositionMeta) => void;
  onSignalAlert?: (alert: { type: 'COARSE_APPROXIMATE' | 'MOCK_DETECTED'; accuracy: number; error?: ErrorDefinition }) => void;
  onError?: (err: ErrorDefinition | string) => void;
}

interface TimestampSkewTracker {
  clockSkewOffsetMs: number;
  consecutiveStaleHits: number;
  lastStalePosTimestamp: number;
  lastStaleReceivedAt: number;
  lastStaleCoordsKey: string;
}

export class GPSService {
  private static cachedFix: CachedGPSFix | null = null;
  private static watchId: number | null = null;
  private static backgroundWarmUpActive = false;
  private static activeWatchProvider: GeolocationLike | null = null;
  private static liveSubscribers = new Set<LivePositionListenerOptions>();
  private static recentWatchPool: Array<GPSCoordinates & { timestamp: number }> = [];
  private static consecutiveCoarseCount = 0;
  private static totalRejectedOutliers = 0;
  private static totalStaleFiltered = 0;
  private static pendingSingleHighJump: (GPSCoordinates & { timestamp: number }) | null = null;
  private static globalSkewTracker: TimestampSkewTracker = {
    clockSkewOffsetMs: 0,
    consecutiveStaleHits: 0,
    lastStalePosTimestamp: 0,
    lastStaleReceivedAt: 0,
    lastStaleCoordsKey: '',
  };

  /**
   * Resets internal cache and watch tracking state (used in isolated unit tests).
   */
  public static resetStateForTesting(): void {
    this.liveSubscribers.clear();
    this.backgroundWarmUpActive = false;
    if (this.watchId !== null && this.activeWatchProvider) {
      try {
        this.activeWatchProvider.clearWatch(this.watchId);
      } catch {
        // ignore cleanup errors in test env
      }
    }
    this.watchId = null;
    this.activeWatchProvider = null;
    this.cachedFix = null;
    this.recentWatchPool = [];
    this.consecutiveCoarseCount = 0;
    this.totalRejectedOutliers = 0;
    this.totalStaleFiltered = 0;
    this.pendingSingleHighJump = null;
    this.globalSkewTracker = {
      clockSkewOffsetMs: 0,
      consecutiveStaleHits: 0,
      lastStalePosTimestamp: 0,
      lastStaleReceivedAt: 0,
      lastStaleCoordsKey: '',
    };
  }

  public static resolveCompensationLimit(
    mode: GPSAttendanceMode = 'DEFAULT',
    explicitLimit?: number
  ): number {
    if (typeof explicitLimit === 'number' && Number.isFinite(explicitLimit)) {
      return Math.max(0, Math.round(explicitLimit));
    }
    if (mode === 'QR_SCAN') {
      return CONSTANTS.DEFAULTS.GPS_QR_MAX_COMPENSATION_METERS || 35;
    }
    return CONSTANTS.DEFAULTS.GPS_BIOMETRIC_MAX_COMPENSATION_METERS || 25;
  }

  private static createFreshTracker(): TimestampSkewTracker {
    return {
      clockSkewOffsetMs: 0,
      consecutiveStaleHits: 0,
      lastStalePosTimestamp: 0,
      lastStaleReceivedAt: 0,
      lastStaleCoordsKey: '',
    };
  }

  /**
   * Evaluates timestamp freshness while guarding against Android device clock skew.
   * When multiple live callbacks arrive with consistently advancing `position.timestamp`,
   * auto-calibrates the skew offset instead of locking out teachers whose phone clock differs.
   * Identical frozen `(timestamp, lat, lng)` values remain rejected as stale OS cache.
   */
  private static checkFreshnessWithClockSkew(
    position: GeolocationPosition,
    receivedAtMs: number,
    maxAgeMs: number,
    tracker: TimestampSkewTracker
  ): { isStale: boolean; effectiveTimestamp: number; skewCalibrated: boolean } {
    const posTs = typeof position.timestamp === 'number' ? position.timestamp : undefined;
    const coordsKey = `${position.coords.latitude.toFixed(6)},${position.coords.longitude.toFixed(6)}`;
    const evalResult = evaluatePositionFreshness(posTs, receivedAtMs, maxAgeMs, tracker.clockSkewOffsetMs);

    if (!evalResult.isStale) {
      if (evalResult.anomaly === 'DEVICE_CLOCK_BEHIND' && typeof evalResult.suggestedClockSkewMs === 'number') {
        tracker.clockSkewOffsetMs = evalResult.suggestedClockSkewMs;
      }
      tracker.consecutiveStaleHits = 0;
      return {
        isStale: false,
        effectiveTimestamp: receivedAtMs,
        skewCalibrated: tracker.clockSkewOffsetMs !== 0,
      };
    }

    // Check if phone clock is ahead of GPS satellite time (advancing timestamps across live callbacks)
    if (typeof posTs === 'number' && tracker.lastStalePosTimestamp > 0) {
      const posDelta = posTs - tracker.lastStalePosTimestamp;
      const wallDelta = receivedAtMs - tracker.lastStaleReceivedAt;
      const isFrozenOsCache = posDelta === 0 && coordsKey === tracker.lastStaleCoordsKey;

      if (!isFrozenOsCache && posDelta > 0 && Math.abs(posDelta - wallDelta) <= 5000) {
        tracker.clockSkewOffsetMs = posTs - receivedAtMs;
        tracker.consecutiveStaleHits = 0;
        logger.info('GPSService', 'Calibrated device-vs-satellite clock skew (ms):', tracker.clockSkewOffsetMs);
        return {
          isStale: false,
          effectiveTimestamp: receivedAtMs,
          skewCalibrated: true,
        };
      }
    }

    tracker.consecutiveStaleHits += 1;
    tracker.lastStalePosTimestamp = posTs || 0;
    tracker.lastStaleReceivedAt = receivedAtMs;
    tracker.lastStaleCoordsKey = coordsKey;

    return {
      isStale: true,
      effectiveTimestamp: posTs || receivedAtMs,
      skewCalibrated: false,
    };
  }

  private static updateCachedFixIfBetter(
    candidate: GPSCoordinates,
    maxAgeMs: number,
    nowMs: number
  ): void {
    const currentSnapshot = this.cachedFix
      ? { accuracy: this.cachedFix.coords.accuracy, timestamp: this.cachedFix.timestamp }
      : null;
    if (shouldReplaceWithBetterFix(currentSnapshot, candidate, maxAgeMs, nowMs)) {
      this.cachedFix = { coords: candidate, timestamp: nowMs };
    }
  }

  private static buildCoordsFromPosition(
    position: GeolocationPosition,
    schoolLat: number,
    schoolLng: number,
    maxCompensationMeters: number,
    previousHighAccFix?: CachedGPSFix | null,
    timestampMs: number = Date.now()
  ): GPSCoordinates {
    const mockCheck = GPSService.detectMockLocation(position, previousHighAccFix);
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    const accuracy = typeof position.coords.accuracy === 'number' && Number.isFinite(position.coords.accuracy)
      ? position.coords.accuracy
      : 0;

    const rawDistance = calculateDistanceMeters(lat, lng, schoolLat, schoolLng);
    const comp = calculateCompensatedDistance(rawDistance, accuracy, maxCompensationMeters);

    return {
      latitude: lat,
      longitude: lng,
      accuracy,
      distanceMeters: comp.effectiveDistanceMeters,
      rawDistanceMeters: comp.rawDistanceMeters,
      compensationMeters: comp.compensationMeters,
      isMock: mockCheck.isMock,
      mockReason: mockCheck.reason,
      isSignalOutlier: mockCheck.isSignalOutlier,
      timestamp: timestampMs,
      speed: position.coords.speed,
      altitude: position.coords.altitude,
      heading: position.coords.heading,
    };
  }

  /**
   * Evaluates if a given position fix exhibits signs of mock location / spoofing.
   * Separates coarse BTS signal jumps (accuracy > 50m -> signal outlier, not Fake GPS)
   * from high-precision spoofing / native mock flags (GPS_003).
   */
  public static detectMockLocation(
    position: GeolocationPosition,
    previousFix?: CachedGPSFix | null
  ): { isMock: boolean; isSignalOutlier?: boolean; reason?: string } {
    const coords = position.coords;
    const rawPosition = position as unknown as Record<string, unknown>;
    const rawCoords = coords as unknown as Record<string, unknown>;

    // 1. Direct Web Geolocation API Mock Flag (Android Webview / Chrome Mock Providers)
    if (rawPosition.isMock === true || rawCoords.mocked === true || rawCoords.isMock === true) {
      return { isMock: true, reason: 'NATIVE_MOCK_FLAG_DETECTED' };
    }

    // 2. DevTools Geolocation Override & Synthetic Constant Spoofer Check
    if (coords.latitude === 0 && coords.longitude === 0) {
      return { isMock: true, reason: 'NULL_ISLAND_COORDINATES' };
    }

    if (coords.accuracy === 0) {
      return { isMock: true, reason: 'ZERO_ACCURACY_SYNTHETIC_FIX' };
    }

    if (Number.isInteger(coords.latitude) && Number.isInteger(coords.longitude) && coords.latitude !== 0) {
      return { isMock: true, reason: 'EXACT_INTEGER_COORDINATES' };
    }

    // 3. Telemetry Jump Check
    if (previousFix && previousFix.coords) {
      const timeDeltaSec = (Date.now() - previousFix.timestamp) / 1000;
      if (timeDeltaSec > 0.1 && timeDeltaSec < 60) {
        const distanceMoved = calculateDistanceMeters(
          coords.latitude,
          coords.longitude,
          previousFix.coords.latitude,
          previousFix.coords.longitude
        );
        const speedKmh = (distanceMoved / timeDeltaSec) * 3.6;
        const speedMps = distanceMoved / timeDeltaSec;
        const maxSpeedKmh = CONSTANTS.DEFAULTS.GPS_MOCK_SUSPICIOUS_SPEED_KMH || 150;
        const accuracy = typeof coords.accuracy === 'number' ? coords.accuracy : 0;

        if ((speedKmh > maxSpeedKmh || speedMps > CONSTANTS.DEFAULTS.GPS_OUTLIER_SPEED_MPS) && distanceMoved > 80) {
          // Coarse BTS/Cell bounce (> 50m) is discarded as outlier rather than flagged as Fake GPS
          if (accuracy > (CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS || 50)) {
            logger.warn('GPSService', `Discarded coarse BTS jump (${Math.round(distanceMoved)}m, accuracy=${accuracy}m)`);
            return { isMock: false, isSignalOutlier: true, reason: 'COARSE_SIGNAL_JUMP' };
          }

          logger.warn('GPSService', `Suspicious speed jump detected: ${speedKmh.toFixed(1)} km/h over ${timeDeltaSec.toFixed(1)}s`);
          return { isMock: true, reason: `IMPOSSIBLE_SPEED_JUMP_${Math.round(speedKmh)}KMH` };
        }
      }
    }

    return { isMock: false };
  }

  private static ensureSharedWatcherRunning(geoProvider?: GeolocationLike): void {
    const geo = geoProvider ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);
    if (!geo) return;
    if (this.watchId !== null) return;

    const settings = this.getGeofenceSettings();
    this.activeWatchProvider = geo;

    try {
      this.watchId = geo.watchPosition(
        (position) => {
          const nowMs = Date.now();
          const maxAge = CONSTANTS.DEFAULTS.GPS_SAMPLE_MAX_AGE_MS || 10000;
          const freshCheck = this.checkFreshnessWithClockSkew(position, nowMs, maxAge, this.globalSkewTracker);
          if (freshCheck.isStale) {
            this.totalStaleFiltered += 1;
            logger.info('GPSService', 'Skipped stale watchPosition sample (OS cache)');
            return;
          }

          const baselineForJump =
            this.recentWatchPool.length > 0
              ? {
                  coords: this.recentWatchPool[this.recentWatchPool.length - 1],
                  timestamp: this.recentWatchPool[this.recentWatchPool.length - 1].timestamp,
                }
              : this.cachedFix;

          const newCoords = this.buildCoordsFromPosition(
            position,
            settings.lat,
            settings.lng,
            this.resolveCompensationLimit('DEFAULT'),
            baselineForJump && (baselineForJump.coords.accuracy ?? 999) <= 35 ? baselineForJump : null,
            nowMs
          );

          // 1. Native/synthetic mock check -> notify subscribers immediately
          if (newCoords.isMock && newCoords.mockReason && !newCoords.mockReason.startsWith('IMPOSSIBLE_SPEED_JUMP')) {
            this.notifyLiveWatchSubscribers(newCoords, { type: 'MOCK_DETECTED', accuracy: newCoords.accuracy, error: getErrorDefinition('GPS_003') });
            return;
          }

          // 2. Physical speed jump check (> 50 m/s in < 2s)
          if (baselineForJump && baselineForJump.coords) {
            const jumpEval = evaluateCoordinateJump(
              {
                latitude: newCoords.latitude,
                longitude: newCoords.longitude,
                accuracy: newCoords.accuracy,
                timestamp: nowMs,
              },
              {
                latitude: baselineForJump.coords.latitude,
                longitude: baselineForJump.coords.longitude,
                accuracy: baselineForJump.coords.accuracy,
                timestamp: baselineForJump.timestamp,
              },
              {
                maxOutlierSpeedMps: CONSTANTS.DEFAULTS.GPS_OUTLIER_SPEED_MPS || 50,
                windowMs: CONSTANTS.DEFAULTS.GPS_OUTLIER_WINDOW_MS || 2000,
                coarseAccuracyThreshold: CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS || 50,
              }
            );

            if (jumpEval.isJump || newCoords.isSignalOutlier) {
              const highAccSpoofLimit = CONSTANTS.DEFAULTS.GPS_HIGH_ACCURACY_SPOOF_THRESHOLD_METERS || 35;
              const isHighAccPair = newCoords.accuracy <= highAccSpoofLimit && baselineForJump.coords.accuracy <= highAccSpoofLimit;

              if (jumpEval.isCoarseJump || newCoords.isSignalOutlier || !isHighAccPair) {
                this.totalRejectedOutliers += 1;
                logger.warn('GPSService', 'Rejected noisy BTS jump from watcher pool:', {
                  jumpMeters: jumpEval.jumpMeters,
                  accuracy: newCoords.accuracy,
                });
                return;
              }

              // First high-accuracy spike -> hold transiently instead of immediate GPS_003
              if (!this.pendingSingleHighJump) {
                this.pendingSingleHighJump = { ...newCoords, timestamp: nowMs };
                this.totalRejectedOutliers += 1;
                return;
              }

              // Second consistent high-accuracy jump -> confirm Fake GPS GPS_003
              const confirmedMock: GPSCoordinates = {
                ...newCoords,
                isMock: true,
                mockReason: 'SUSTAINED_HIGH_ACCURACY_JUMP',
              };
              this.pendingSingleHighJump = null;
              this.notifyLiveWatchSubscribers(confirmedMock, {
                type: 'MOCK_DETECTED',
                accuracy: newCoords.accuracy,
                error: getErrorDefinition('GPS_003'),
              });
              return;
            }
          }

          this.pendingSingleHighJump = null;

          // 3. Track consecutive Android "Lokasi Perkiraan" (> 150m)
          const approxThreshold = CONSTANTS.DEFAULTS.GPS_APPROXIMATE_ACCURACY_THRESHOLD_METERS || 150;
          if (newCoords.accuracy > approxThreshold) {
            this.consecutiveCoarseCount += 1;
          } else {
            this.consecutiveCoarseCount = 0;
          }

          const isApprox = this.consecutiveCoarseCount >= 2 || newCoords.accuracy > approxThreshold;
          const enriched: GPSCoordinates = {
            ...newCoords,
            isApproximateLocation: isApprox,
            rejectedOutliers: this.totalRejectedOutliers,
            staleFiltered: this.totalStaleFiltered,
          };

          // Maintain rolling fresh watch pool (up to 6 entries within maxAgeMs)
          this.recentWatchPool = [
            ...this.recentWatchPool.filter((item) => nowMs - item.timestamp <= maxAge),
            { ...enriched, timestamp: nowMs },
          ].slice(-6);

          // Update cachedFix ONLY if it improves accuracy or previous fix expired (Safeguard #3)
          this.updateCachedFixIfBetter(enriched, maxAge, nowMs);

          this.notifyLiveWatchSubscribers(
            enriched,
            isApprox
              ? { type: 'COARSE_APPROXIMATE', accuracy: enriched.accuracy, error: getErrorDefinition('GPS_005') }
              : undefined
          );
        },
        (err) => {
          logger.warn('GPSService', 'GPS watchPosition error:', err.message);
          this.liveSubscribers.forEach((sub) => sub.onError?.(err.message));
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: CONSTANTS.DEFAULTS.GPS_HARD_TIMEOUT_MS || 10000,
        }
      );
    } catch (e) {
      logger.warn('GPSService', 'Failed to start watchPosition:', e);
    }
  }

  private static notifyLiveWatchSubscribers(
    coords: GPSCoordinates,
    alert?: { type: 'COARSE_APPROXIMATE' | 'MOCK_DETECTED'; accuracy: number; error?: ErrorDefinition }
  ): void {
    const meta: LivePositionMeta = {
      rejectedOutliers: this.totalRejectedOutliers,
      staleFiltered: this.totalStaleFiltered,
      consecutiveCoarseCount: this.consecutiveCoarseCount,
      isApproximateLocation: this.consecutiveCoarseCount >= 2,
    };

    const settings = this.getGeofenceSettings();
    this.liveSubscribers.forEach((sub) => {
      const bMax = this.resolveCompensationLimit(sub.mode, sub.maxCompensationMeters);
      const rawDist = calculateDistanceMeters(coords.latitude, coords.longitude, settings.lat, settings.lng);
      const comp = calculateCompensatedDistance(rawDist, coords.accuracy, bMax);
      sub.onUpdate(
        {
          ...coords,
          rawDistanceMeters: comp.rawDistanceMeters,
          compensationMeters: comp.compensationMeters,
          distanceMeters: comp.effectiveDistanceMeters,
        },
        meta
      );
      if (alert) {
        sub.onSignalAlert?.(alert);
      }
    });
  }

  /**
   * Pre-warms GPS watcher while a scan or biometric modal is open.
   * Always returns a cleanup function that stops watching when no consumers remain.
   */
  public static subscribeLivePosition(options: LivePositionListenerOptions): () => void {
    this.liveSubscribers.add(options);
    this.ensureSharedWatcherRunning(options.geolocationProvider);

    return () => {
      this.liveSubscribers.delete(options);
      if (this.liveSubscribers.size === 0 && !this.backgroundWarmUpActive) {
        this.stopSharedWatcher();
      }
    };
  }

  private static stopSharedWatcher(): void {
    const geo =
      this.activeWatchProvider ??
      (typeof navigator !== 'undefined' && navigator.geolocation ? navigator.geolocation : null);
    if (geo && this.watchId !== null) {
      try {
        geo.clearWatch(this.watchId);
      } catch {
        // ignore
      }
    }
    this.watchId = null;
    this.activeWatchProvider = null;
  }

  /**
   * Starts background GPS position warming up via watchPosition.
   * Called when App/Dashboard is opened to pre-heat coordinates in background.
   */
  public static startBackgroundWarmUp(): void {
    this.backgroundWarmUpActive = true;
    this.ensureSharedWatcherRunning();
  }

  /**
   * Stops background GPS warm-up watcher when no modal subscribers are active.
   */
  public static stopBackgroundWarmUp(): void {
    this.backgroundWarmUpActive = false;
    if (this.liveSubscribers.size === 0) {
      this.stopSharedWatcher();
    }
  }

  /**
   * Returns warm cached GPS fix if age <= maxAgeMs and accuracy <= maxAccuracyMeters.
   */
  public static getWarmCachedFix(
    maxAgeMs = CONSTANTS.DEFAULTS.GPS_CACHE_MAX_AGE_MS,
    maxAccuracyMeters = CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS
  ): GPSCoordinates | null {
    if (!this.cachedFix) return null;
    const age = Date.now() - this.cachedFix.timestamp;
    if (age <= maxAgeMs && this.cachedFix.coords.accuracy <= maxAccuracyMeters && !this.cachedFix.coords.isMock) {
      logger.info(
        'GPSService',
        `Using warm cached GPS fix (age: ${age}ms <= ${maxAgeMs}ms, accuracy: ${this.cachedFix.coords.accuracy}m <= ${maxAccuracyMeters}m):`,
        this.cachedFix.coords
      );
      return this.cachedFix.coords;
    }
    return null;
  }

  /**
   * Returns latest cached GPS coordinates regardless of age
   */
  public static getLatestCoords(): GPSCoordinates | null {
    return this.cachedFix ? this.cachedFix.coords : null;
  }

  /**
   * Helper method to report current GPS Health Status for Dashboard pre-scan UI indicator (0 emoji)
   */
  public static getGPSHealthStatus(): { status: 'READY' | 'REFINING' | 'OFF' | 'INVALID'; text: string; accuracy?: number } {
    if (!this.cachedFix) {
      return { status: 'REFINING', text: 'Mengukur lokasi GPS...' };
    }
    if (this.cachedFix.coords.isMock) {
      return { status: 'INVALID', text: 'Fake GPS Terdeteksi!' };
    }
    const age = Date.now() - this.cachedFix.timestamp;
    if (age <= 30000) {
      const acc = Math.round(this.cachedFix.coords.accuracy);
      const maxAcc = CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS || 50;
      if (acc <= CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS) {
        return { status: 'READY', text: `GPS Siap (${acc}m)`, accuracy: acc };
      } else if (acc <= maxAcc) {
        return { status: 'READY', text: `Sinyal Cukup (${acc}m)`, accuracy: acc };
      } else if (acc > 150) {
        return { status: 'REFINING', text: `Lokasi Perkiraan (${acc}m) - Aktifkan Lokasi Akurat`, accuracy: acc };
      }
      return { status: 'REFINING', text: `Akurasi Lemah (${acc}m > ${maxAcc}m)...`, accuracy: acc };
    }
    return { status: 'REFINING', text: 'Memperbarui GPS...' };
  }

  /**
   * Reads configured geofence settings from localStorage or fallback defaults
   */
  public static getGeofenceSettings(): { lat: number; lng: number; radius: number } {
    try {
      if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
        const saved = localStorage.getItem('smart_absensi_system_settings');
        if (saved) {
          const parsed = JSON.parse(saved);
          const sanitized = sanitizeSchoolCoordinates(parsed.geofence_lat, parsed.geofence_lng);
          const rawRadius = parseInt(parsed.geofence_radius, 10);
          const radius = !isNaN(rawRadius) && rawRadius > 0 ? Math.max(rawRadius, 500) : CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS;

          return {
            lat: sanitized.lat,
            lng: sanitized.lng,
            radius,
          };
        }
      }
    } catch {
      // Ignore non-browser or storage parse errors
    }
    return {
      lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      radius: CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
    };
  }

  /**
   * Fetches latest system settings from provider backend and caches to localStorage
   */
  public static async syncGeofenceSettings(): Promise<{ lat: number; lng: number; radius: number }> {
    try {
      const provider = ProviderFactory.getProvider();
      const settings = await provider.getSettings();
      if (settings && typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
        const existing = localStorage.getItem('smart_absensi_system_settings');
        const parsed = existing ? JSON.parse(existing) : {};
        const sanitized = sanitizeSchoolCoordinates(settings.geofence_lat, settings.geofence_lng);
        const updated = {
          ...parsed,
          ...settings,
          geofence_lat: sanitized.lat,
          geofence_lng: sanitized.lng,
          geofence_radius: Math.max(settings.geofence_radius || 500, 500),
        };
        localStorage.setItem('smart_absensi_system_settings', JSON.stringify(updated));
      }
    } catch (e) {
      logger.warn('GPSService', 'Failed to sync geofence settings from provider:', e);
    }
    return this.getGeofenceSettings();
  }

  /**
   * Captures a single high-accuracy position sample bounded by a hard timeout.
   */
  private static takeSingleRawPosition(
    geo: GeolocationLike,
    timeoutMs: number
  ): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(new Error('GPS single sample timeout'));
        }
      }, timeoutMs);

      geo.getCurrentPosition(
        (pos) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            resolve(pos);
          }
        },
        (err) => {
          if (!settled) {
            settled = true;
            clearTimeout(timer);
            reject(err);
          }
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0,
        }
      );
    });
  }

  /**
   * Collects multi-sampled GPS fixes (3-5 samples) within a bounded window & hard timeout:
   * - Discards stale OS/BTS cache (> 10s, with clock-skew auto-calibration)
   * - Discards impossible BTS jumps (> 50 m/s in < 2s)
   * - Selects cluster median or best accuracy sample (never blind first fix)
   * - Supports injectable timing/geolocationProvider for fast deterministic tests
   */
  public static async getCurrentPosition(
    targetLat?: number,
    targetLng?: number,
    options?: GetGPSPositionOptions
  ): Promise<GPSCoordinates> {
    const mode = options?.mode ?? 'DEFAULT';
    const bMax = this.resolveCompensationLimit(mode, options?.maxCompensationMeters);
    const maxAgeMs = options?.maxAgeMs ?? (CONSTANTS.DEFAULTS.GPS_SAMPLE_MAX_AGE_MS || 10000);
    const minSamples = options?.minSamples ?? (CONSTANTS.DEFAULTS.GPS_MULTISAMPLE_MIN_COUNT || 3);
    const maxSamples = Math.max(minSamples, options?.maxSamples ?? (CONSTANTS.DEFAULTS.GPS_MULTISAMPLE_MAX_COUNT || 5));
    const sampleWindowMs = options?.sampleWindowMs ?? (CONSTANTS.DEFAULTS.GPS_MULTISAMPLE_WINDOW_MS || 4500);
    const sampleIntervalMs = options?.sampleIntervalMs ?? 550;
    const hardTimeoutMs = options?.hardTimeoutMs ?? (CONSTANTS.DEFAULTS.GPS_HARD_TIMEOUT_MS || 10000);
    const nowFn = options?.nowFn ?? (() => Date.now());
    const useGlobalWatchPool = !options?.geolocationProvider;

    const settings = this.getGeofenceSettings();
    const schoolLat = targetLat !== undefined ? targetLat : settings.lat;
    const schoolLng = targetLng !== undefined ? targetLng : settings.lng;

    // 1. Check warm multi-sample watch pool if already converged with >= 2 fresh consistent samples
    if (useGlobalWatchPool) {
      const now = nowFn();
      const freshPool = this.recentWatchPool.filter((s) => now - s.timestamp <= maxAgeMs && !s.isMock);
      if (freshPool.length >= 2) {
        const bestFromPool = selectBestGpsSample(freshPool);
        if (bestFromPool && bestFromPool.accuracy <= CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS) {
          const rawDist = calculateDistanceMeters(bestFromPool.latitude, bestFromPool.longitude, schoolLat, schoolLng);
          const comp = calculateCompensatedDistance(rawDist, bestFromPool.accuracy, bMax);
          return {
            ...bestFromPool,
            rawDistanceMeters: comp.rawDistanceMeters,
            compensationMeters: comp.compensationMeters,
            distanceMeters: comp.effectiveDistanceMeters,
            sampleCount: freshPool.length,
            rejectedOutliers: this.totalRejectedOutliers,
            staleFiltered: this.totalStaleFiltered,
          };
        }
      }
    }

    const geo: GeolocationLike | undefined =
      options?.geolocationProvider ?? (typeof navigator !== 'undefined' ? navigator.geolocation : undefined);

    if (!geo) {
      logger.error('GPSService', 'Geolocation API is not supported by browser');
      throw getErrorDefinition('GPS_001');
    }

    logger.info('GPSService', `Starting multi-sample GPS acquisition (min=${minSamples}, max=${maxSamples}, mode=${mode})...`);

    const tracker = useGlobalWatchPool ? this.globalSkewTracker : this.createFreshTracker();
    const validSamples: Array<GPSCoordinates & { timestamp: number }> = [];
    let rejectedOutliers = 0;
    let staleFiltered = 0;
    let coarseConsecutive = 0;
    let confirmedMockCoords: GPSCoordinates | null = null;
    let pendingHighJump: (GPSCoordinates & { timestamp: number }) | null = null;
    let lastError: unknown = null;

    const startTime = nowFn();
    const perSampleTimeoutMs = Math.max(50, Math.min(4500, Math.floor(hardTimeoutMs / 2)));

    for (let i = 0; i < maxSamples; i++) {
      const elapsed = nowFn() - startTime;
      if (elapsed >= hardTimeoutMs) break;
      if (i >= minSamples && elapsed >= sampleWindowMs && validSamples.length > 0) break;

      try {
        const remainingBudget = Math.max(50, hardTimeoutMs - elapsed);
        const rawPos = await this.takeSingleRawPosition(geo, Math.min(perSampleTimeoutMs, remainingBudget));
        const receivedAt = nowFn();

        const freshness = this.checkFreshnessWithClockSkew(rawPos, receivedAt, maxAgeMs, tracker);
        const baseline = validSamples.length > 0 ? validSamples[validSamples.length - 1] : null;
        const candidate = this.buildCoordsFromPosition(
          rawPos,
          schoolLat,
          schoolLng,
          bMax,
          baseline && baseline.accuracy <= 35 ? { coords: baseline, timestamp: baseline.timestamp } : null,
          receivedAt
        );

        if (candidate.isMock && candidate.mockReason && !candidate.mockReason.startsWith('IMPOSSIBLE_SPEED_JUMP')) {
          confirmedMockCoords = candidate;
          break;
        }

        if (freshness.isStale) {
          staleFiltered += 1;
          if (i < maxSamples - 1 && sampleIntervalMs > 0) {
            await new Promise((r) => setTimeout(r, Math.min(sampleIntervalMs, Math.max(0, hardTimeoutMs - (nowFn() - startTime)))));
          }
          continue;
        }

        // Physical speed jump / BTS outlier check
        if (baseline) {
          const jump = evaluateCoordinateJump(
            { latitude: candidate.latitude, longitude: candidate.longitude, accuracy: candidate.accuracy, timestamp: receivedAt },
            { latitude: baseline.latitude, longitude: baseline.longitude, accuracy: baseline.accuracy, timestamp: baseline.timestamp },
            {
              maxOutlierSpeedMps: CONSTANTS.DEFAULTS.GPS_OUTLIER_SPEED_MPS || 50,
              windowMs: CONSTANTS.DEFAULTS.GPS_OUTLIER_WINDOW_MS || 2000,
              coarseAccuracyThreshold: CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS || 50,
            }
          );

          if (jump.isJump || candidate.isSignalOutlier) {
            const spoofThreshold = CONSTANTS.DEFAULTS.GPS_HIGH_ACCURACY_SPOOF_THRESHOLD_METERS || 35;
            const highAccPair = candidate.accuracy <= spoofThreshold && baseline.accuracy <= spoofThreshold;

            if (jump.isCoarseJump || candidate.isSignalOutlier || !highAccPair) {
              rejectedOutliers += 1;
              if (i < maxSamples - 1 && sampleIntervalMs > 0) {
                await new Promise((r) => setTimeout(r, Math.min(sampleIntervalMs, Math.max(0, hardTimeoutMs - (nowFn() - startTime)))));
              }
              continue;
            }

            if (!pendingHighJump) {
              // Single momentary jump held out; let next sample verify whether it returns or stays spoofed
              pendingHighJump = { ...candidate, timestamp: receivedAt };
              rejectedOutliers += 1;
              if (i < maxSamples - 1 && sampleIntervalMs > 0) {
                await new Promise((r) => setTimeout(r, Math.min(sampleIntervalMs, Math.max(0, hardTimeoutMs - (nowFn() - startTime)))));
              }
              continue;
            }

            // Two consecutive high-accuracy teleport samples confirm Fake GPS GPS_003
            confirmedMockCoords = {
              ...candidate,
              isMock: true,
              mockReason: 'SUSTAINED_HIGH_ACCURACY_JUMP',
            };
            break;
          }
        }

        pendingHighJump = null;

        if (candidate.accuracy > (CONSTANTS.DEFAULTS.GPS_APPROXIMATE_ACCURACY_THRESHOLD_METERS || 150)) {
          coarseConsecutive += 1;
        } else {
          coarseConsecutive = 0;
        }

        validSamples.push({ ...candidate, timestamp: receivedAt });

        // Early convergence when >= 2 consistent samples achieved high precision
        const preciseCount = validSamples.filter((s) => s.accuracy <= 25).length;
        if (preciseCount >= 2 && validSamples.length >= Math.min(minSamples, 3)) {
          break;
        }

        if (i < maxSamples - 1 && sampleIntervalMs > 0) {
          const remainingForWait = hardTimeoutMs - (nowFn() - startTime);
          if (remainingForWait > 0) {
            await new Promise((r) => setTimeout(r, Math.min(sampleIntervalMs, remainingForWait)));
          }
        }
      } catch (err) {
        lastError = err;
        logger.warn('GPSService', `GPS sample ${i + 1} failed:`, err);
      }
    }

    if (confirmedMockCoords) {
      return confirmedMockCoords;
    }

    const finalPool = validSamples;

    if (finalPool.length === 0) {
      if (useGlobalWatchPool && this.cachedFix) {
        const cachedAge = nowFn() - this.cachedFix.timestamp;
        if (cachedAge <= maxAgeMs * 2 && !this.cachedFix.coords.isMock) {
          logger.info('GPSService', 'Falling back to recent cached fix:', this.cachedFix.coords);
          return this.cachedFix.coords;
        }
      }
      logger.error('GPSService', 'All GPS samples failed, last error:', lastError);
      throw getErrorDefinition('GPS_001');
    }

    const bestCluster = selectBestGpsSample(finalPool);
    if (!bestCluster) {
      throw getErrorDefinition('GPS_001');
    }

    const rawDist = calculateDistanceMeters(bestCluster.latitude, bestCluster.longitude, schoolLat, schoolLng);
    const comp = calculateCompensatedDistance(rawDist, bestCluster.accuracy, bMax);
    const approxThreshold = CONSTANTS.DEFAULTS.GPS_APPROXIMATE_ACCURACY_THRESHOLD_METERS || 150;
    const isApproximate = coarseConsecutive >= 2 || bestCluster.accuracy > approxThreshold;

    const finalCoords: GPSCoordinates = {
      ...bestCluster,
      rawDistanceMeters: comp.rawDistanceMeters,
      compensationMeters: comp.compensationMeters,
      distanceMeters: comp.effectiveDistanceMeters,
      sampleCount: finalPool.length,
      rejectedOutliers,
      staleFiltered,
      isApproximateLocation: isApproximate,
    };

    if (useGlobalWatchPool) {
      this.updateCachedFixIfBetter(finalCoords, maxAgeMs, nowFn());
    }

    return finalCoords;
  }

  /**
   * Validates coordinates against allowed school geofence radius, GPS accuracy limit,
   * Android coarse/approximate location threshold, and Fake GPS detection.
   */
  public static validateGeofenceRadius(
    coords: GPSCoordinates,
    allowedRadiusMeters?: number,
    options?: {
      maxAllowedAccuracy?: number;
      maxCompensationMeters?: number;
      mode?: GPSAttendanceMode;
    }
  ): GPSValidationResult {
    // 1. Fake GPS / Mock Location Check (NEVER bypassed)
    if (coords.isMock) {
      logger.warn('GPSService', 'Geofence validation failed: Mock location detected', coords.mockReason);
      return {
        isValid: false,
        coords,
        error: getErrorDefinition('GPS_003'),
      };
    }

    // 2. Coarse / Android Approximate Location Check (> 150m repeated)
    const approxLimit = CONSTANTS.DEFAULTS.GPS_APPROXIMATE_ACCURACY_THRESHOLD_METERS || 150;
    if (coords.isApproximateLocation || coords.accuracy > approxLimit) {
      logger.warn('GPSService', `Geofence validation failed: Approximate/coarse GPS signal (${coords.accuracy}m > ${approxLimit}m)`);
      return {
        isValid: false,
        coords: { ...coords, isApproximateLocation: true },
        error: getErrorDefinition('GPS_005'),
      };
    }

    // 3. Signal Accuracy Limit Check (> 50m strict default, or mode-specific e.g. 90m/100m)
    const maxAllowedAccuracy =
      options?.maxAllowedAccuracy ??
      (options?.mode === 'QR_SCAN'
        ? CONSTANTS.DEFAULTS.GPS_QR_MAX_ALLOWED_ACCURACY_METERS
        : options?.mode === 'BIOMETRIC'
        ? CONSTANTS.DEFAULTS.GPS_BIOMETRIC_MAX_ALLOWED_ACCURACY_METERS
        : CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS || 50);

    if (coords.accuracy > maxAllowedAccuracy) {
      logger.warn('GPSService', `Geofence validation failed: GPS accuracy too low (${coords.accuracy}m > ${maxAllowedAccuracy}m)`);
      return {
        isValid: false,
        coords,
        error: getErrorDefinition('GPS_004'),
      };
    }

    // 4. Allowed Geofence Distance Radius Check (with bounded B_max when rawDistanceMeters is present)
    const configuredRadius = allowedRadiusMeters ?? this.getGeofenceSettings().radius;
    const radius = getEffectiveAllowedRadius(configuredRadius);

    let effectiveDistanceToCheck = coords.distanceMeters;
    if (
      typeof coords.rawDistanceMeters === 'number' &&
      Number.isFinite(coords.rawDistanceMeters) &&
      (options?.maxCompensationMeters !== undefined || options?.mode !== undefined)
    ) {
      const bMax = this.resolveCompensationLimit(options.mode ?? 'DEFAULT', options.maxCompensationMeters);
      effectiveDistanceToCheck = calculateCompensatedDistance(
        coords.rawDistanceMeters,
        coords.accuracy,
        bMax
      ).effectiveDistanceMeters;
    }

    if (effectiveDistanceToCheck > radius) {
      return {
        isValid: false,
        coords,
        error: getErrorDefinition('GPS_002'),
      };
    }

    return {
      isValid: true,
      coords,
    };
  }
}
