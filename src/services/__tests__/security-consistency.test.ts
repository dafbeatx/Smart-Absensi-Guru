/**
 * SMART ABSENSI GURU - SECURITY & CONSISTENCY TEST SUITE
 * Unit tests verifying GPS security, PIN hashing, Supabase authentication, QR poster validation, logger sensitive field masking, and error handling.
 */

import { GPSService } from '../gps.service';
import { hashPin } from '../../utils/hash.utils';
import { SupabaseProvider } from '../../providers/supabase-provider.service';
import { QRValidationService } from '../qr-validation.service';
import { CONSTANTS } from '../../config/constants';
import { sanitizeMeta } from '../../utils/logger.utils';
import { handleAppError } from '../../utils/error.utils';
import { isDevTestModeEnabled, canAccessDevTestMode } from '../../utils/dev-test.utils';
import { DevTestRunnerService } from '../dev-test-runner.service';
import type { UserProfile } from '../../types/database.types';
import type { LoginDTO } from '../../repositories/AuthRepository';

export const runSecurityConsistencyTestSuite = async (): Promise<{
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

  // 1. Test PIN Hashing Consistency
  const pin1 = '123456';
  const hash1 = await hashPin(pin1);
  const hash2 = await hashPin(pin1);
  assert('PIN Hashing - Deterministic & Consistent Hash', hash1 === hash2 && hash1.length === 64);

  // 2. Test PIN Hashing Non-Plaintext
  const pinRaw = '030501';
  const hashRaw = await hashPin(pinRaw);
  assert('PIN Hashing - Never Stores Plaintext', hashRaw !== pinRaw && hashRaw.length === 64);

  // 3. Test Sensitive Field Masking in Logger Utility
  const sensitiveObj = {
    pin: '123456',
    password: 'secret_password_123',
    token: 'SB_JWT_usr_1001_12345678',
    authorization: 'Bearer secret_jwt_token',
    refresh_token: 'rf_9988776655',
    user_id: 'usr_1001',
  };
  const sanitized = sanitizeMeta(sensitiveObj) as Record<string, unknown>;
  assert('Logger Masking - PIN Field Masked as [REDACTED]', sanitized.pin === '[REDACTED]');
  assert('Logger Masking - Password Field Masked as [REDACTED]', sanitized.password === '[REDACTED]');
  assert('Logger Masking - Token Field Masked as [REDACTED]', sanitized.token === '[REDACTED]');
  assert('Logger Masking - Authorization Field Masked as [REDACTED]', sanitized.authorization === '[REDACTED]');
  assert('Logger Masking - Refresh Token Field Masked as [REDACTED]', sanitized.refresh_token === '[REDACTED]');
  assert('Logger Masking - Non-Sensitive user_id Preserved', sanitized.user_id === 'usr_1001');

  // 4. Test Standard Error Handler Message Sanitization
  const networkErrorMsg = handleAppError(new Error('Failed to fetch data'), 'TestContext', 'Network Test', false);
  assert('Error Handler - Converts Failed to Fetch to Friendly Connection Message', networkErrorMsg.includes('internet'));

  // 5. Test Official Poster QR Validation
  const officialSeed = CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED;
  const officialResult = QRValidationService.validateQRFreshness(officialSeed);
  assert('QR Validation - Official Poster Seed SMART_ABSENSI_OFFICIAL_QR_2026 Is Valid', officialResult.isValid === true);

  // 6. Test Invalid / Random QR Validation
  const invalidResult = QRValidationService.validateQRFreshness('RANDOM_INVALID_QR_CODE_123');
  assert('QR Validation - Random Invalid String Is Rejected', invalidResult.isValid === false && invalidResult.error?.code === 'QR_002');

  const emptyResult = QRValidationService.validateQRFreshness('');
  assert('QR Validation - Empty QR String Is Rejected', emptyResult.isValid === false && emptyResult.error?.code === 'QR_002');

  // 7. Test SupabaseProvider Login PIN Validation (Wrong PIN Rejected)
  const supabaseProvider = new SupabaseProvider();
  try {
    const wrongLoginDto: LoginDTO = {
      identity: '081234567890',
      pin: '999999', // Wrong PIN
      device_uuid: 'DEV_TEST_UUID',
      device_model: 'Web Browser',
    };
    await supabaseProvider.login(wrongLoginDto);
    assert('Supabase Login - Reject Invalid PIN', false, 'Should have thrown error on wrong PIN');
  } catch (err: unknown) {
    const msg = String(err);
    assert('Supabase Login - Reject Invalid PIN', msg.includes('PIN') || msg.includes('tidak ditemukan'));
  }

  // 8. Test GPS Service Geofence Validation Consistency
  const allowedRadius = 500;
  const testCoords = { latitude: -6.2, longitude: 106.8, accuracy: 5, distanceMeters: 450 };
  const validCheck = GPSService.validateGeofenceRadius(testCoords, allowedRadius);
  assert('UI & Validation Radius Indicator - Consistent Allowed Radius (450m <= 500m)', validCheck.isValid === true);

  const outCoords = { latitude: -6.2, longitude: 106.8, accuracy: 5, distanceMeters: 550 };
  const invalidCheck = GPSService.validateGeofenceRadius(outCoords, allowedRadius);
  assert('UI & Validation Radius Indicator - Reject Out of Range (550m > 500m)', invalidCheck.isValid === false);

  // 9. Developer Test Mode Security Guards & Runner
  const devEnabled = isDevTestModeEnabled();
  assert('Dev Test Guard - isDevTestModeEnabled returns boolean', typeof devEnabled === 'boolean');

  const mockAdminUser: UserProfile = {
    id: 'usr_admin',
    nip: '198001012005011001',
    full_name: 'Admin Test',
    phone_number: '081234567890',
    role: 'ADMIN',
    position: 'Administrator',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };
  const mockGuruUser: UserProfile = {
    id: 'usr_guru',
    nip: '198501012010012002',
    full_name: 'Guru Test',
    phone_number: '081234567891',
    role: 'GURU',
    position: 'Guru Matematika',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  assert('Dev Test Guard - ADMIN Allowed when enabled', canAccessDevTestMode(mockAdminUser) === devEnabled);
  assert('Dev Test Guard - GURU Strictly Denied', canAccessDevTestMode(mockGuruUser) === false);
  assert('Dev Test Guard - Guest Strictly Denied', canAccessDevTestMode(null) === false);

  // 10. Developer Test Runner Diagnostics Suite Execution
  const summary = await DevTestRunnerService.runDiagnostics(mockAdminUser);
  assert('Dev Test Runner - Diagnostics Suite Finished', summary.items.length === 10);
  assert('Dev Test Runner - Official QR Validation Item Passed', summary.items.some((i) => i.id === 'test_qr' && i.status === 'passed'));

  const markdownReport = DevTestRunnerService.generateMarkdownReport(summary, mockAdminUser);
  assert('Dev Test Runner - Markdown Report Generated', markdownReport.includes('SMART ABSENSI GURU - LAPORAN DIAGNOSTIK'));

  return { passed, failed, results };
};
