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
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;
          const rawDistance = calculateDistanceMeters(lat, lng, settings.lat, settings.lng);
          const accuracyBuffer = Math.min(Math.round(accuracy / 2), 30);
          const effectiveDistance = Math.max(0, rawDistance - accuracyBuffer);

          this.cachedFix = {
            coords: {
              latitude: lat,
              longitude: lng,
              accuracy,
              distanceMeters: effectiveDistance,
            },
            timestamp: Date.now(),
          };
          logger.info('GPSService', 'Background GPS warm-up fix updated:', this.cachedFix.coords);
        },
        (err) => {
          logger.warn('GPSService', 'Background GPS warm-up error:', err.message);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 10000,
          timeout: 10000,
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
   * Returns warm cached GPS fix if age < 15 seconds and accuracy <= 40 meters.
   */
  public static getWarmCachedFix(maxAgeMs = 15000, maxAccuracyMeters = 40): GPSCoordinates | null {
    if (!this.cachedFix) return null;
    const age = Date.now() - this.cachedFix.timestamp;
    if (age <= maxAgeMs && this.cachedFix.coords.accuracy <= maxAccuracyMeters) {
      logger.info('GPSService', 'Using warm cached GPS fix (< 15s age, high accuracy):', this.cachedFix.coords);
      return this.cachedFix.coords;
    }
    return null;
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
   * Takes a single raw geolocation sample and wraps it as a Promise.
   */
  private static takeSingleSample(
    schoolLat: number,
    schoolLng: number,
    timeoutMs: number
  ): Promise<GPSCoordinates> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;

          const rawDistance = calculateDistanceMeters(lat, lng, schoolLat, schoolLng);

          // Buffer: subtract half of GPS accuracy (capped at 30m) from distance
          const accuracyBuffer = Math.min(Math.round(accuracy / 2), 30);
          const effectiveDistance = Math.max(0, rawDistance - accuracyBuffer);

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy,
            distanceMeters: effectiveDistance,
          });
        },
        (error) => {
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: timeoutMs,
          maximumAge: 10000,
        }
      );
    });
  }

  /**
   * Reads browser location using parallel warm-cache + fast sample strategy:
   * - First checks warm cached GPS fix (< 15s age) for instant response (< 5ms)
   * - If not ready, takes fast single/double sample spaced ~800ms apart
   */
  public static async getCurrentPosition(
    targetLat?: number,
    targetLng?: number
  ): Promise<GPSCoordinates> {
    // 1. Instant check: Use pre-heated warm cached fix if available
    const warmFix = this.getWarmCachedFix();
    if (warmFix) {
      return warmFix;
    }

    const settings = this.getGeofenceSettings();
    const schoolLat = targetLat !== undefined ? targetLat : settings.lat;
    const schoolLng = targetLng !== undefined ? targetLng : settings.lng;

    const SAMPLE_COUNT = 2;
    const SAMPLE_TIMEOUT_MS = 4000; // per sample
    const INTERVAL_MS = 800;        // delay between samples

    logger.info('GPSService', `Requesting fast GPS location (${SAMPLE_COUNT} samples)...`);

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
        });

        // Update cached fix
        this.cachedFix = { coords: sample, timestamp: Date.now() };

        // Stop early if good accuracy
        if (sample.accuracy <= 25) {
          logger.info('GPSService', 'High-accuracy sample obtained early, stopping collection.');
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
   * Validates coordinates against allowed school geofence radius.
   * Uses getEffectiveAllowedRadius for consistent 100m floor enforcement.
   */
  public static validateGeofenceRadius(
    coords: GPSCoordinates,
    allowedRadiusMeters?: number
  ): GPSValidationResult {
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
