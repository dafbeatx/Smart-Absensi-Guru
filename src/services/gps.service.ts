import { CONSTANTS } from '../config/constants';
import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';
import { calculateDistanceMeters, getEffectiveAllowedRadius } from '../utils/geofence.utils';
import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger.utils';

export interface GPSCoordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  distanceMeters: number;
  isMock?: boolean;
  mockReason?: string;
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

export class GPSService {
  private static cachedFix: CachedGPSFix | null = null;
  private static watchId: number | null = null;

  /**
   * Evaluates if a given position fix exhibits signs of mock location / location spoofing
   * or DevTools geolocation override manipulation.
   */
  public static detectMockLocation(
    position: GeolocationPosition,
    previousFix?: CachedGPSFix | null
  ): { isMock: boolean; reason?: string } {
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

    // 3. Telemetry Jump Check (Impossible Speed > 150 km/h)
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
        const maxSpeed = CONSTANTS.DEFAULTS.GPS_MOCK_SUSPICIOUS_SPEED_KMH || 150;
        if (speedKmh > maxSpeed && distanceMoved > 100) {
          logger.warn('GPSService', `Suspicious speed jump detected: ${speedKmh.toFixed(1)} km/h over ${timeDeltaSec.toFixed(1)}s`);
          return { isMock: true, reason: `IMPOSSIBLE_SPEED_JUMP_${Math.round(speedKmh)}KMH` };
        }
      }

      // 4. Zero-Variance Synthetic Fix Check (DevTools Fixed Location Override)
      if (
        timeDeltaSec >= 2 &&
        Math.abs(coords.latitude - previousFix.coords.latitude) < 1e-12 &&
        Math.abs(coords.longitude - previousFix.coords.longitude) < 1e-12 &&
        coords.accuracy === previousFix.coords.accuracy &&
        coords.altitude === previousFix.coords.altitude
      ) {
        return { isMock: true, reason: 'ZERO_VARIANCE_SYNTHETIC_OVERRIDE' };
      }
    }

    return { isMock: false };
  }

  /**
   * Starts background GPS position warming up via watchPosition.
   * Called as soon as App/Dashboard is opened to pre-heat GPS coordinates in background.
   */
  public static startBackgroundWarmUp(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    if (this.watchId !== null) return;

    const settings = this.getGeofenceSettings();

    try {
      this.watchId = navigator.geolocation.watchPosition(
        (position) => {
          const mockCheck = GPSService.detectMockLocation(position, this.cachedFix);
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;
          const rawDistance = calculateDistanceMeters(lat, lng, settings.lat, settings.lng);
          const accuracyBuffer = Math.min(Math.round(accuracy / 2), 30);
          const effectiveDistance = Math.max(0, rawDistance - accuracyBuffer);

          const newCoords: GPSCoordinates = {
            latitude: lat,
            longitude: lng,
            accuracy,
            distanceMeters: effectiveDistance,
            isMock: mockCheck.isMock,
            mockReason: mockCheck.reason,
            speed: position.coords.speed,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
          };

          // Progressive settling: prefer higher accuracy fixes over coarse fixes
          if (
            !this.cachedFix ||
            accuracy <= this.cachedFix.coords.accuracy ||
            accuracy <= CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS ||
            Date.now() - this.cachedFix.timestamp > 15000
          ) {
            this.cachedFix = {
              coords: newCoords,
              timestamp: Date.now(),
            };
          }
          logger.info('GPSService', 'Background GPS warm-up fix updated:', this.cachedFix.coords);
        },
        (err) => {
          logger.warn('GPSService', 'Background GPS warm-up error:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0, // Force fresh satellite/device reading, avoid stale iOS cellular cache
          timeout: 15000,
        }
      );
    } catch (e) {
      logger.warn('GPSService', 'Failed to start watchPosition warm-up:', e);
    }
  }

  /**
   * Stops background GPS warm-up watcher.
   */
  public static stopBackgroundWarmUp(): void {
    if (typeof navigator !== 'undefined' && navigator.geolocation && this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Returns warm cached GPS fix if age <= maxAgeMs and accuracy <= maxAccuracyMeters.
   * Thresholds are configurable from CONSTANTS.DEFAULTS or override parameters.
   */
  public static getWarmCachedFix(
    maxAgeMs = CONSTANTS.DEFAULTS.GPS_CACHE_MAX_AGE_MS,
    maxAccuracyMeters = CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS
  ): GPSCoordinates | null {
    if (!this.cachedFix) return null;
    const age = Date.now() - this.cachedFix.timestamp;
    if (age <= maxAgeMs && this.cachedFix.coords.accuracy <= maxAccuracyMeters && !this.cachedFix.coords.isMock) {
      logger.info('GPSService', `Using warm cached GPS fix (age: ${age}ms <= ${maxAgeMs}ms, accuracy: ${this.cachedFix.coords.accuracy}m <= ${maxAccuracyMeters}m):`, this.cachedFix.coords);
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
   * Helper method to report current GPS Health Status for Dashboard pre-scan UI indicator
   */
  public static getGPSHealthStatus(): { status: 'READY' | 'REFINING' | 'OFF' | 'INVALID'; text: string; accuracy?: number } {
    if (!this.cachedFix) {
      return { status: 'REFINING', text: '📍 Mengukur lokasi GPS...' };
    }
    if (this.cachedFix.coords.isMock) {
      return { status: 'INVALID', text: '⚠️ Fake GPS Terdeteksi!' };
    }
    const age = Date.now() - this.cachedFix.timestamp;
    if (age <= 30000) {
      const acc = Math.round(this.cachedFix.coords.accuracy);
      const maxAcc = CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS || 50;
      if (acc <= CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS) {
        return { status: 'READY', text: `🟢 GPS Siap (${acc}m)`, accuracy: acc };
      } else if (acc <= maxAcc) {
        return { status: 'READY', text: `🟡 Sinyal Cukup (${acc}m)`, accuracy: acc };
      } else if (acc > 500) {
        return { status: 'REFINING', text: `🔴 Lokasi Kasar (${acc}m) - Cek "Lokasi Tepat"`, accuracy: acc };
      }
      return { status: 'REFINING', text: `🔴 Akurasi Lemah (${acc}m > ${maxAcc}m)...`, accuracy: acc };
    }
    return { status: 'REFINING', text: '📍 Memperbarui GPS...' };
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
          let lat = parseFloat(parsed.geofence_lat);
          let lng = parseFloat(parsed.geofence_lng);
          const radius = parseInt(parsed.geofence_radius, 10);

          if (lat === -6.200000 || lat === -6.2 || (lat > -6.21 && lat < -6.19 && lng > 106.81 && lng < 106.82)) {
            lat = CONSTANTS.DEFAULTS.GEOFENCE_LAT;
            lng = CONSTANTS.DEFAULTS.GEOFENCE_LNG;
          }

          return {
            lat: !isNaN(lat) ? lat : CONSTANTS.DEFAULTS.GEOFENCE_LAT,
            lng: !isNaN(lng) ? lng : CONSTANTS.DEFAULTS.GEOFENCE_LNG,
            radius: !isNaN(radius) && radius > 0 ? radius : CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
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
        const updated = {
          ...parsed,
          ...settings,
        };
        localStorage.setItem('smart_absensi_system_settings', JSON.stringify(updated));
      }
    } catch (e) {
      logger.warn('GPSService', 'Failed to sync geofence settings from provider:', e);
    }
    return this.getGeofenceSettings();
  }

  /**
   * Takes a single raw geolocation sample with hardware GPS priority and wraps it as a Promise.
   */
  private static takeSingleSample(
    schoolLat: number,
    schoolLng: number,
    timeoutMs = 8000
  ): Promise<GPSCoordinates> {
    return new Promise((resolve, reject) => {
      // Stage 1: High Accuracy (Hardware Satellite GNSS GPS) with maximumAge = 0 to prevent stale cellular cache on iOS
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const mockCheck = GPSService.detectMockLocation(position, this.cachedFix);
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;

          const rawDistance = calculateDistanceMeters(lat, lng, schoolLat, schoolLng);
          const accuracyBuffer = Math.min(Math.round(accuracy / 2), 30);
          const effectiveDistance = Math.max(0, rawDistance - accuracyBuffer);

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy,
            distanceMeters: effectiveDistance,
            isMock: mockCheck.isMock,
            mockReason: mockCheck.reason,
            speed: position.coords.speed,
            altitude: position.coords.altitude,
            heading: position.coords.heading,
          });
        },
        (primaryErr) => {
          logger.warn('GPSService', 'High-accuracy GPS sample attempt failed/timed out:', primaryErr?.message || primaryErr);
          
          // Re-attempt once with high accuracy if primary timed out (do not fallback to low-accuracy coarse cell-tower)
          navigator.geolocation.getCurrentPosition(
            (retryPos) => {
              const mockCheck = GPSService.detectMockLocation(retryPos, this.cachedFix);
              const lat = retryPos.coords.latitude;
              const lng = retryPos.coords.longitude;
              const accuracy = retryPos.coords.accuracy || 0;

              const rawDistance = calculateDistanceMeters(lat, lng, schoolLat, schoolLng);
              const accuracyBuffer = Math.min(Math.round(accuracy / 2), 30);
              const effectiveDistance = Math.max(0, rawDistance - accuracyBuffer);

              resolve({
                latitude: lat,
                longitude: lng,
                accuracy,
                distanceMeters: effectiveDistance,
                isMock: mockCheck.isMock,
                mockReason: mockCheck.reason,
                speed: retryPos.coords.speed,
                altitude: retryPos.coords.altitude,
                heading: retryPos.coords.heading,
              });
            },
            (retryErr) => {
              reject(retryErr || primaryErr);
            },
            {
              enableHighAccuracy: true,
              timeout: timeoutMs + 2000,
              maximumAge: 0,
            }
          );
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 0, // Never return stale cached BTS/Cell Tower coordinate
        }
      );
    });
  }

  /**
   * Reads browser location using parallel warm-cache + fast sample strategy:
   * - First checks warm cached GPS fix (< 15s age, <= 40m accuracy) for instant response (< 5ms)
   * - If not ready or accuracy needs settling, takes progressive high-accuracy sample
   */
  public static async getCurrentPosition(
    targetLat?: number,
    targetLng?: number
  ): Promise<GPSCoordinates> {
    // 1. Instant check: Use pre-heated warm cached fix if available with good accuracy
    const warmFix = this.getWarmCachedFix();
    if (warmFix && warmFix.accuracy <= CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS) {
      return warmFix;
    }

    const settings = this.getGeofenceSettings();
    const schoolLat = targetLat !== undefined ? targetLat : settings.lat;
    const schoolLng = targetLng !== undefined ? targetLng : settings.lng;

    const SAMPLE_COUNT = 2;
    const SAMPLE_TIMEOUT_MS = 8000; // per sample (sufficient for iOS GNSS satellite lock)
    const INTERVAL_MS = 600;        // delay between samples for progressive satellite convergence

    logger.info('GPSService', `Requesting high-accuracy GPS location (${SAMPLE_COUNT} samples)...`);

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      logger.error('GPSService', 'Geolocation API is not supported by browser');
      throw getErrorDefinition('GPS_001');
    }

    const samples: GPSCoordinates[] = [];
    let lastError: unknown = null;

    for (let i = 0; i < SAMPLE_COUNT; i++) {
      try {
        const sample = await this.takeSingleSample(schoolLat, schoolLng, SAMPLE_TIMEOUT_MS);
        samples.push(sample);
        logger.info('GPSService', `GPS sample ${i + 1}/${SAMPLE_COUNT}:`, {
          accuracy: sample.accuracy,
          distanceMeters: sample.distanceMeters,
          isMock: sample.isMock,
        });

        // Update cached fix if this sample is better or first
        if (!this.cachedFix || sample.accuracy <= this.cachedFix.coords.accuracy) {
          this.cachedFix = { coords: sample, timestamp: Date.now() };
        }

        // Stop early if high-accuracy (< 25m) satellite lock obtained
        if (sample.accuracy <= 25 && !sample.isMock) {
          logger.info('GPSService', 'High-accuracy satellite lock obtained early, stopping collection.');
          break;
        }

        if (i < SAMPLE_COUNT - 1) {
          await new Promise((r) => setTimeout(r, INTERVAL_MS));
        }
      } catch (err) {
        lastError = err;
        logger.warn('GPSService', `GPS sample ${i + 1} failed:`, err);
      }
    }

    if (samples.length === 0) {
      if (this.cachedFix) {
        logger.info('GPSService', 'Falling back to latest cached fix:', this.cachedFix.coords);
        return this.cachedFix.coords;
      }
      logger.error('GPSService', 'All GPS samples failed, last error:', lastError);
      throw getErrorDefinition('GPS_001');
    }

    const best = samples.reduce((prev, curr) => (curr.accuracy < prev.accuracy ? curr : prev));
    return best;
  }

  /**
   * Validates coordinates against allowed school geofence radius, GPS accuracy limit, and Fake GPS detection.
   */
  public static validateGeofenceRadius(
    coords: GPSCoordinates,
    allowedRadiusMeters?: number
  ): GPSValidationResult {
    // 1. Fake GPS / Mock Location Check
    if (coords.isMock) {
      logger.warn('GPSService', 'Geofence validation failed: Mock location detected', coords.mockReason);
      return {
        isValid: false,
        coords,
        error: getErrorDefinition('GPS_003'),
      };
    }

    // 2. Signal Accuracy Limit Check (> 50 meters rejected)
    const maxAllowedAccuracy = CONSTANTS.DEFAULTS.GPS_MAX_ALLOWED_ACCURACY_METERS || 50;
    if (coords.accuracy > maxAllowedAccuracy) {
      logger.warn('GPSService', `Geofence validation failed: GPS accuracy too low (${coords.accuracy}m > ${maxAllowedAccuracy}m)`);
      return {
        isValid: false,
        coords,
        error: getErrorDefinition('GPS_004'),
      };
    }

    // 3. Allowed Geofence Distance Radius Check
    const configuredRadius = allowedRadiusMeters ?? this.getGeofenceSettings().radius;
    const radius = getEffectiveAllowedRadius(configuredRadius);

    if (coords.distanceMeters > radius) {
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
