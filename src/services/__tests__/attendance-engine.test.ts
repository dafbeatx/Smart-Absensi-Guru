/**
 * SMART ABSENSI GURU - ATTENDANCE ENGINE TEST SUITE
 * Unit tests verifying State Machine, QR Validation, Geofence Radius, & Error Codes
 */

import { QRValidationService } from '../qr-validation.service';
import { GPSService } from '../gps.service';
import type { GPSCoordinates } from '../gps.service';
import { AttendanceEngine } from '../attendance-engine.service';
import { CONSTANTS } from '../../config/constants';

export const runAttendanceEngineTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  // Test 1: QR Freshness Validation (Valid Seed)
  const validQR = QRValidationService.validateQRFreshness('SAG_SEED_VALID_2026');
  assert('QR Validation - Valid Seed', validQR.isValid === true);

  // Test 2: QR Freshness Validation (Invalid/Empty Seed)
  const invalidQR = QRValidationService.validateQRFreshness('');
  assert('QR Validation - Invalid Empty Seed', invalidQR.isValid === false && invalidQR.error?.code === 'QR_002');

  // Test 3: GPS Geofence Radius Validation (Inside 50m)
  const insideCoords: GPSCoordinates = {
    latitude: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    longitude: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    accuracy: 5,
    distanceMeters: 12,
  };
  const insideGeofence = GPSService.validateGeofenceRadius(insideCoords);
  assert('GPS Geofence - Inside 50m Radius', insideGeofence.isValid === true);

  // Test 4: GPS Geofence Radius Validation (Outside 50m)
  const outsideCoords: GPSCoordinates = {
    latitude: CONSTANTS.DEFAULTS.GEOFENCE_LAT + 0.01,
    longitude: CONSTANTS.DEFAULTS.GEOFENCE_LNG + 0.01,
    accuracy: 5,
    distanceMeters: 1500, // 1.5 km away
  };
  const outsideGeofence = GPSService.validateGeofenceRadius(outsideCoords);
  assert('GPS Geofence - Outside 50m Radius Ditolak', outsideGeofence.isValid === false && outsideGeofence.error?.code === 'GPS_002');

  // Test 5: Attendance Engine State Machine Pipeline Execution
  const pipelineResult = await AttendanceEngine.executeAttendancePipeline(
    'SAG_TEST_SEED_2026',
    'usr_uuid_1001',
    'DEV_JWT_TOKEN',
    'dev_device_uuid'
  );
  assert('Attendance Engine - Full State Machine Pipeline Execution', pipelineResult.success === true && pipelineResult.step === 'SUCCESS');

  return { passed, failed, results };
};
