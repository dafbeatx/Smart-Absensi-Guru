import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';
import { calculateDistanceMeters } from './geofence.utils';
import { GPSService } from '../services/gps.service';

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
  schoolLat?: number,
  schoolLng?: number,
  allowedRadiusMeters?: number,
  accuracy: number = 10,
  isMock?: boolean
): ValidationResult & { distanceMeters: number } => {
  if (!userLat || !userLng || isNaN(userLat) || isNaN(userLng)) {
    return { isValid: false, error: getErrorDefinition('GPS_001'), distanceMeters: 99999 };
  }

  const settings = GPSService.getGeofenceSettings();
  const targetLat = schoolLat !== undefined ? schoolLat : settings.lat;
  const targetLng = schoolLng !== undefined ? schoolLng : settings.lng;

  const distance = calculateDistanceMeters(userLat, userLng, targetLat, targetLng);

  const coords = {
    latitude: userLat,
    longitude: userLng,
    accuracy,
    distanceMeters: distance,
    isMock: isMock === true,
  };

  const validation = GPSService.validateGeofenceRadius(coords, allowedRadiusMeters);

  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.error || getErrorDefinition('GPS_002'),
      distanceMeters: distance,
    };
  }

  return { isValid: true, distanceMeters: distance };
};
