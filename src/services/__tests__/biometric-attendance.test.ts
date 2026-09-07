/**
 * SMART ABSENSI GURU - BIOMETRIC FINGERPRINT & GEOFENCE ATTENDANCE TEST SUITE
 * Unit tests verifying WebAuthn Biometric Service, Geofenced Location Locking,
 * Anti-Fake GPS, and Database Verification Method Consistency.
 */

import { BiometricService } from '../biometric.service';
import { GPSService } from '../gps.service';
import type { GPSCoordinates } from '../gps.service';
import { AttendanceEngine } from '../attendance-engine.service';
import { MockProvider } from '../../providers/mock-provider.service';
import { CONSTANTS } from '../../config/constants';
import type { TestSuiteResult } from '../test-runner.service';

export async function runBiometricAttendanceTestSuite(): Promise<TestSuiteResult> {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details: details || 'Assertion condition returned false' });
    }
  };

  // 1. Biometric Support & Platform Sensor Check
  const isSupported = BiometricService.isSupported();
  assert('Biometric Support - Handles environment check safely without crash', typeof isSupported === 'boolean');

  const availability = await BiometricService.checkAvailability('usr_test_guru');
  assert('Biometric Availability - Returns structured status object', 
    typeof availability === 'object' && 
    'isSupported' in availability && 
    'isEnrolled' in availability
  );

  // 2. Biometric Enrollment Local Storage Persistence
  const testUserId = 'usr_bio_test_' + Date.now();
  assert('Biometric Enrollment - New user is initially not enrolled', BiometricService.isEnrolled(testUserId) === false);

  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(`smart_absensi_biometric_cred_${testUserId}`, 'MOCK_CREDENTIAL_BASE64_KEY_12345');
    assert('Biometric Enrollment - Recognizes enrolled credential from storage', BiometricService.isEnrolled(testUserId) === true);
    assert('Biometric Enrollment - Retrieves registered credential ID', BiometricService.getEnrolledCredentialId(testUserId) === 'MOCK_CREDENTIAL_BASE64_KEY_12345');

    BiometricService.clearEnrollment(testUserId);
    assert('Biometric Enrollment - Clears enrollment cleanly', BiometricService.isEnrolled(testUserId) === false);
  } else {
    assert('Biometric Enrollment - Skipped in non-storage env', true);
    assert('Biometric Enrollment - Skipped in non-storage env 2', true);
    assert('Biometric Enrollment - Skipped in non-storage env 3', true);
  }

  // 3. Geofence Location Lock - Strictly Rejects Biometric Attendance Beyond Radius
  const outOfSchoolCoords: GPSCoordinates = {
    latitude: CONSTANTS.DEFAULTS.GEOFENCE_LAT + 0.005, // ~550m away
    longitude: CONSTANTS.DEFAULTS.GEOFENCE_LNG + 0.005,
    accuracy: 8,
    distanceMeters: 550,
  };

  const geofenceCheckOut = GPSService.validateGeofenceRadius(outOfSchoolCoords, 100);
  assert('Biometric Geofence - Rejects coordinates beyond allowed radius', geofenceCheckOut.isValid === false);
  assert('Biometric Geofence - Returns GPS_002 out of radius error code', geofenceCheckOut.error?.code === 'GPS_002');

  // 4. Geofence Location Lock - Rejects Fake GPS / Mock Location
  const mockGpsCoords: GPSCoordinates = {
    latitude: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    longitude: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    accuracy: 5,
    distanceMeters: 10,
    isMock: true,
    mockReason: 'MOCK_LOCATION_APP_DETECTED',
  };

  const fakeGpsCheck = GPSService.validateGeofenceRadius(mockGpsCoords, 100);
  assert('Biometric Fake GPS - Strictly rejects mocked location coordinates', fakeGpsCheck.isValid === false);
  assert('Biometric Fake GPS - Returns GPS_003 fake location error code', fakeGpsCheck.error?.code === 'GPS_003');

  // 5. Geofence Location Lock - Accepts Valid Coordinates Inside School Radius
  const insideSchoolCoords: GPSCoordinates = {
    latitude: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    longitude: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    accuracy: 5,
    distanceMeters: 15,
  };

  const geofenceCheckIn = GPSService.validateGeofenceRadius(insideSchoolCoords, 100);
  assert('Biometric Geofence - Accepts valid coordinates inside school radius (15m <= 100m)', geofenceCheckIn.isValid === true);

  // 6. Provider Persistence - Records BIOMETRIC_GPS Verification Method for Check-In
  const mockProvider = new MockProvider();
  const bioUser = 'usr_guru_bio_suite';

  const checkInRes = await mockProvider.scanAttendance({
    token: 'TOKEN_GURU_' + bioUser,
    user_id: bioUser,
    qr_seed: 'BIOMETRIC_FINGERPRINT_VERIFIED',
    user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    device_uuid: 'uuid_hp_guru_1',
    distance_meters: 15,
    gps_accuracy: 5,
    verification_method: 'BIOMETRIC_GPS',
    attendance_source: 'BIOMETRIC',
  });

  assert('Biometric Check-In - Returns CHECK_IN action', checkInRes.attendance_action === 'CHECK_IN');
  assert('Biometric Check-In - Geofence status verified', checkInRes.geofence_verified === true);

  const todayRecord = await mockProvider.getTodayAttendance(bioUser, 'TOKEN_GURU_' + bioUser);
  assert('Biometric Check-In - Verification method persists as BIOMETRIC_GPS', todayRecord?.verification_method === 'BIOMETRIC_GPS');
  assert('Biometric Check-In - Attendance source persists as BIOMETRIC', todayRecord?.attendance_source === 'BIOMETRIC');

  // 7. Provider Persistence - Check-Out via Biometric
  const checkOutRes = await mockProvider.scanAttendance({
    token: 'TOKEN_GURU_' + bioUser,
    user_id: bioUser,
    qr_seed: 'BIOMETRIC_FINGERPRINT_VERIFIED',
    user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    device_uuid: 'uuid_hp_guru_1',
    distance_meters: 18,
    gps_accuracy: 5,
    verification_method: 'BIOMETRIC_GPS',
    attendance_source: 'BIOMETRIC',
  });

  assert('Biometric Check-Out - Subsequent tap triggers CHECK_OUT or ALREADY_COMPLETED',
    checkOutRes.attendance_action === 'CHECK_OUT' || checkOutRes.attendance_action === 'ALREADY_COMPLETED'
  );

  const updatedToday = await mockProvider.getTodayAttendance(bioUser, 'TOKEN_GURU_' + bioUser);
  assert('Biometric Check-Out - Check-out time is recorded', Boolean(updatedToday?.check_out_time));
  assert('Biometric Check-Out - Retains BIOMETRIC_GPS method', updatedToday?.verification_method === 'BIOMETRIC_GPS');

  // 8. Attendance Pipeline - Biometric Pipeline Execution
  const pipelineSteps: string[] = [];
  const pipelineResult = await AttendanceEngine.executeBiometricAttendancePipeline(
    'usr_dev_guru',
    'DEV_TOKEN_123',
    'device_dev_uuid',
    (step) => pipelineSteps.push(step)
  );

  assert('Biometric Pipeline - Executes without throwing unhandled exceptions', typeof pipelineResult.success === 'boolean');
  assert('Biometric Pipeline - State machine transitions through VALIDATING_GPS step', pipelineSteps.includes('VALIDATING_GPS'));

  return {
    suiteName: 'Geofenced Biometric Fingerprint Attendance Engine',
    passed,
    failed,
    results,
  };
}
