import { CONSTANTS } from '../config/constants';
import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';
import { calculateDistanceMeters } from './geofence.utils';

export interface ValidationResult {
  isValid: boolean;
  error?: ErrorDefinition;
}

export const validatePIN = (pin: string): ValidationResult => {
  if (!pin || pin.trim().length === 0) {
    return { isValid: false, error: getErrorDefinition('AUTH_001') };
  }
  if (pin.length !== 6 || !/^\d+$/.test(pin)) {
    return { isValid: false, error: getErrorDefinition('AUTH_002') };
  }
  return { isValid: true };
};

export const validateIdentity = (identity: string): ValidationResult => {
  if (!identity || identity.trim().length === 0) {
    return { isValid: false, error: getErrorDefinition('AUTH_001') };
  }
  return { isValid: true };
};

export const validateGPSGeofence = (
  userLat: number,
  userLng: number,
  schoolLat: number = CONSTANTS.DEFAULTS.GEOFENCE_LAT,
  schoolLng: number = CONSTANTS.DEFAULTS.GEOFENCE_LNG,
  allowedRadiusMeters: number = CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS
): ValidationResult & { distanceMeters: number } => {
  if (!userLat || !userLng || isNaN(userLat) || isNaN(userLng)) {
    return { isValid: false, error: getErrorDefinition('GPS_001'), distanceMeters: 99999 };
  }

  const distance = calculateDistanceMeters(userLat, userLng, schoolLat, schoolLng);

  if (distance > allowedRadiusMeters) {
    return {
      isValid: false,
      error: getErrorDefinition('GPS_002'),
      distanceMeters: distance,
    };
  }

  return { isValid: true, distanceMeters: distance };
};
