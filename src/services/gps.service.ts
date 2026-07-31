import { CONSTANTS } from '../config/constants';
import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';
import { calculateDistanceMeters } from '../utils/geofence.utils';

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
   * Reads browser location and validates against school geofence
   */
  public static async getCurrentPosition(): Promise<GPSCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(getErrorDefinition('GPS_001'));
        return;
      }

      const options: PositionOptions = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      };

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = position.coords.accuracy;

          const distance = calculateDistanceMeters(
            lat,
            lng,
            CONSTANTS.DEFAULTS.GEOFENCE_LAT,
            CONSTANTS.DEFAULTS.GEOFENCE_LNG
          );

          resolve({
            latitude: lat,
            longitude: lng,
            accuracy,
            distanceMeters: distance,
          });
        },
        (error) => {
          console.error('Geolocation Error:', error);
          if (error.code === error.PERMISSION_DENIED) {
            reject(getErrorDefinition('GPS_001'));
          } else {
            reject(getErrorDefinition('GPS_001'));
          }
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
    allowedRadiusMeters: number = CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS
  ): GPSValidationResult {
    if (coords.distanceMeters > allowedRadiusMeters) {
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
