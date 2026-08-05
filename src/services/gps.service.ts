import { CONSTANTS } from '../config/constants';
import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';
import { calculateDistanceMeters } from '../utils/geofence.utils';
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

export class GPSService {
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
   * Reads browser location and calculates distance against configured school geofence
   */
  public static async getCurrentPosition(
    targetLat?: number,
    targetLng?: number
  ): Promise<GPSCoordinates> {
    const settings = this.getGeofenceSettings();
    const schoolLat = targetLat !== undefined ? targetLat : settings.lat;
    const schoolLng = targetLng !== undefined ? targetLng : settings.lng;

    logger.info('GPSService', 'Requesting GPS location from browser...');

    return new Promise((resolve, reject) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        logger.error('GPSService', 'Geolocation API is not supported by browser');
        reject(getErrorDefinition('GPS_001'));
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 8000,
        maximumAge: 30000,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy || 0;

          const rawDistance = calculateDistanceMeters(
            lat,
            lng,
            schoolLat,
            schoolLng
          );

          const accuracyBuffer = Math.min(Math.round(accuracy / 2), 30);
          const effectiveDistance = Math.max(0, rawDistance - accuracyBuffer);

          logger.info('GPSService', 'GPS location retrieved successfully:', {
            lat,
            lng,
            accuracy,
            effectiveDistance,
          });

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy,
            distanceMeters: effectiveDistance,
          });
        },
        (error) => {
          logger.error('GPSService', `Geolocation Error (Code ${error.code}): ${error.message}`, error);
          reject(getErrorDefinition('GPS_001'));
        },
        options
      );
    });
  }

  /**
   * Validates coordinates against allowed school geofence radius
   */
  public static validateGeofenceRadius(
    coords: GPSCoordinates,
    allowedRadiusMeters?: number
  ): GPSValidationResult {
    const radius = allowedRadiusMeters ?? this.getGeofenceSettings().radius;

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
