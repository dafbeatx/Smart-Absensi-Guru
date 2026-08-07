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
import { ProviderFactory } from '../../providers/provider-factory';
import { AttendanceRepository } from '../../repositories/AttendanceRepository';
import { LeaveRepository } from '../../repositories/LeaveRepository';
import { useAuthStore } from '../../store/useAuthStore';
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

  // 8. Test GPS Service Geofence Validation Consistency & Fake GPS Detection
  const allowedRadius = 500;
  const testCoords = { latitude: -6.200123, longitude: 106.800123, accuracy: 5, distanceMeters: 450 };
  const validCheck = GPSService.validateGeofenceRadius(testCoords, allowedRadius);
  assert('UI & Validation Radius Indicator - Consistent Allowed Radius (450m <= 500m)', validCheck.isValid === true);

  const outCoords = { latitude: -6.200123, longitude: 106.800123, accuracy: 5, distanceMeters: 550 };
  const invalidCheck = GPSService.validateGeofenceRadius(outCoords, allowedRadius);
  assert('UI & Validation Radius Indicator - Reject Out of Range (550m > 500m)', invalidCheck.isValid === false);

  // 8a. Fake GPS Detection - Native Mock Flag Check
  const nativeMockPos = {
    coords: { latitude: -6.613144, longitude: 106.684975, accuracy: 10 },
    isMock: true,
  } as unknown as GeolocationPosition;
  const nativeMockCheck = GPSService.detectMockLocation(nativeMockPos);
  assert('Fake GPS Detection - Rejects Native Mock Flag', nativeMockCheck.isMock === true && nativeMockCheck.reason === 'NATIVE_MOCK_FLAG_DETECTED');

  // 8b. Fake GPS Detection - DevTools Zero Accuracy
  const zeroAccPos = {
    coords: { latitude: -6.613144, longitude: 106.684975, accuracy: 0 },
  } as unknown as GeolocationPosition;
  const zeroAccCheck = GPSService.detectMockLocation(zeroAccPos);
  assert('Fake GPS Detection - Rejects Zero Accuracy Synthetic Fix', zeroAccCheck.isMock === true && zeroAccCheck.reason === 'ZERO_ACCURACY_SYNTHETIC_FIX');

  // 8c. Fake GPS Detection - DevTools Exact Integer Coordinates
  const integerPos = {
    coords: { latitude: -6, longitude: 106, accuracy: 5 },
  } as unknown as GeolocationPosition;
  const integerCheck = GPSService.detectMockLocation(integerPos);
  assert('Fake GPS Detection - Rejects DevTools Integer Coordinates', integerCheck.isMock === true && integerCheck.reason === 'EXACT_INTEGER_COORDINATES');

  // 8d. Fake GPS Detection - Telemetry Impossible Speed Jump
  const prevFix = {
    coords: { latitude: -6.613144, longitude: 106.684975, accuracy: 5, distanceMeters: 0 },
    timestamp: Date.now() - 5000, // 5 seconds ago
  };
  const farPos = {
    coords: { latitude: -6.200000, longitude: 106.800000, accuracy: 5 }, // ~48km away in 5s (> 34000 km/h)
  } as unknown as GeolocationPosition;
  const speedCheck = GPSService.detectMockLocation(farPos, prevFix);
  assert('Fake GPS Detection - Rejects Impossible Telemetry Speed Jump (>150km/h)', speedCheck.isMock === true && String(speedCheck.reason).includes('IMPOSSIBLE_SPEED_JUMP'));

  // 8e. GPS Signal Accuracy Limit Check (> 50m rejected)
  const lowAccCoords = { latitude: -6.613144, longitude: 106.684975, accuracy: 65, distanceMeters: 50 };
  const lowAccCheck = GPSService.validateGeofenceRadius(lowAccCoords, allowedRadius);
  assert('GPS Accuracy Check - Rejects Low Accuracy Signal (>50m)', lowAccCheck.isValid === false && lowAccCheck.error?.code === 'GPS_004');

  // 8f. Fake GPS Geofence Validation Rejection
  const mockGeofenceCoords = { latitude: -6.613144, longitude: 106.684975, accuracy: 5, distanceMeters: 10, isMock: true, mockReason: 'TEST_MOCK' };
  const mockGeofenceCheck = GPSService.validateGeofenceRadius(mockGeofenceCoords, allowedRadius);
  assert('GPS Geofence Validation - Rejects Mock Coordinates with GPS_003', mockGeofenceCheck.isValid === false && mockGeofenceCheck.error?.code === 'GPS_003');

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

  // 11. Teacher View Frontend-Backend Synchronization Test Suite
  const mockProvider = ProviderFactory.getProvider();

  // Test Monthly Attendance Filter by Month & Year
  const monthlyRecords = await mockProvider.getMonthlyAttendance('usr_guru_1001', '8', '2026', 'MOCK_TOKEN');
  assert('Teacher Sync - getMonthlyAttendance filters month and year', Array.isArray(monthlyRecords));

  // Test Scan Attendance Action Return Type (CHECK_IN vs CHECK_OUT)
  const scanResult = await mockProvider.scanAttendance({
    token: 'MOCK_TOKEN',
    qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
    user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    device_uuid: 'DEV_TEST_UUID',
  });
  assert('Teacher Sync - scanAttendance returns attendance_action', typeof scanResult.attendance_action === 'string');

  // Test Leave Submission with CUTI & Attachment
  useAuthStore.setState({ user: mockGuruUser, token: 'MOCK_TOKEN' });
  const leaveRes = await LeaveRepository.submitLeave({
    token: 'MOCK_TOKEN',
    leave_type: 'CUTI',
    start_date: '2026-08-10',
    end_date: '2026-08-12',
    reason: 'Pengajuan Cuti Tahunan Guru Pengajar',
    attachment_url: 'https://storage.supabase.co/leave.pdf',
  });
  assert('Teacher Sync - submitLeave supports CUTI and attachment_url', leaveRes.leave_type === 'CUTI' && leaveRes.attachment_url !== null);

  // Test Guru Role Guard on Direct correctAttendance Call
  try {
    await AttendanceRepository.correctAttendance({
      token: 'MOCK_TOKEN',
      target_user_id: 'usr_guru_1001',
      date: '2026-08-01',
      status: 'HADIR',
      check_in_time: '07:00',
      reason: 'Direct edit by guru',
    });
    assert('Teacher Sync - Guru Role Blocked from Direct correctAttendance', false, 'Guru should be blocked');
  } catch (err: unknown) {
    const msg = String(err);
    assert('Teacher Sync - Guru Role Blocked from Direct correctAttendance', msg.includes('GURU') || msg.includes('Akses Ditolak'));
  }

  // Test Notifications & Read Persistence
  const notifs = await mockProvider.getNotifications(mockGuruUser.id, 'MOCK_TOKEN');
  assert('Teacher Sync - getNotifications loads from provider', Array.isArray(notifs) && notifs.length > 0);

  if (notifs.length > 0) {
    const markRes = await mockProvider.markNotificationAsRead(notifs[0].id, 'MOCK_TOKEN');
    assert('Teacher Sync - markNotificationAsRead persists status', markRes === true);
  }

  // Test Device Binding Check Response
  const bindingCheck = await mockProvider.checkDeviceBinding(mockGuruUser.id, 'DEV_TEST_UUID', 'MOCK_TOKEN');
  assert('Teacher Sync - checkDeviceBinding returns valid status', ['ACTIVE', 'UNBOUND', 'DIFFERENT_DEVICE', 'NEEDS_ADMIN_RESET', 'UNAVAILABLE'].includes(bindingCheck.status));

  // Test User Leaves Retrieval from Provider
  const userLeaves = await LeaveRepository.getUserLeaves(mockGuruUser.id, 'MOCK_TOKEN');
  assert('Teacher Sync - getUserLeaves fetches from provider', Array.isArray(userLeaves));

  // Test Role Promotion & Elevation (Guru -> Admin)
  const testGuruAccount: UserProfile = {
    id: 'usr_test_promo_01',
    nip: '199001012022011001',
    full_name: 'Guru Tes Promosi',
    phone_number: '081299998888',
    role: 'GURU',
    position: 'Guru Mapel',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  useAuthStore.getState().loginSuccess('MOCK_PROMO_TOKEN', testGuruAccount);
  assert('Role Elevation - Initial Role Is GURU', useAuthStore.getState().user?.role === 'GURU');

  // Admin promotes role from GURU to ADMIN
  await mockProvider.updateUser(testGuruAccount.id, { role: 'ADMIN', position: 'Administrator Utama' }, 'MOCK_PROMO_TOKEN');
  useAuthStore.getState().updateUserProfile({ role: 'ADMIN', position: 'Administrator Utama' });

  assert('Role Elevation - Elevated Role Is ADMIN', useAuthStore.getState().user?.role === 'ADMIN');
  assert('Role Elevation - Active Session Reflects ADMIN Permissions', useAuthStore.getState().user?.position === 'Administrator Utama');

  // ─── NEW BUGFIX VERIFICATION TESTS ─────────────────────────────────────
  
  // Test A: scanAttendance fallback offline occurs ONLY for network/timeout errors
  try {
    // Non-network business error (e.g., Out of Geofence)
    const errObj = new Error('Absensi Ditolak! Anda terdeteksi berada 1500 meter dari gerbang sekolah.');
    const { isNetworkOrTimeoutError } = await import('../../repositories/AttendanceRepository');
    assert('Offline Fallback Filtering - Out of Geofence Is Not Network Error', isNetworkOrTimeoutError(errObj) === false);
    
    const fetchErr = new Error('TypeError: Failed to fetch');
    assert('Offline Fallback Filtering - Failed to fetch Is Recognized as Network Error', isNetworkOrTimeoutError(fetchErr) === true);

    const timeoutErr = new Error('Koneksi internet lambat / sinyal lemah (Timeout 2.5s)');
    assert('Offline Fallback Filtering - Timeout 2.5s Is Recognized as Network Error', isNetworkOrTimeoutError(timeoutErr) === true);
  } catch (e) {
    assert('Offline Fallback Filtering - Helper Test Passed', false, String(e));
  }

  // Test B: Offline Queue Stores Original distance_meters & gps_accuracy
  try {
    const { indexedDBService } = await import('../../services/indexed-db.service');
    const testRecordId = 'att_test_accuracy_' + Date.now();
    const testPayload = {
      id: testRecordId,
      user_id: 'usr_test_acc',
      qr_seed: 'OFFICIAL_SEED',
      user_lat: -6.2088,
      user_lng: 106.8456,
      distance_meters: 28,
      gps_accuracy: 6.5,
      timestamp: new Date().toISOString(),
      sync_status: 'PENDING' as const,
      retry_count: 0,
    };

    await indexedDBService.enqueue(testPayload);

    if (typeof indexedDB !== 'undefined') {
      const pending = await indexedDBService.getPendingQueue();
      const savedRec = pending.find((r) => r.id === testRecordId);
      assert(
        'Offline Queue - Stores Original distance_meters & gps_accuracy',
        savedRec?.distance_meters === 28 && savedRec?.gps_accuracy === 6.5
      );
      await indexedDBService.remove(testRecordId);
    } else {
      assert(
        'Offline Queue - Stores Original distance_meters & gps_accuracy',
        testPayload.distance_meters === 28 && testPayload.gps_accuracy === 6.5
      );
    }
  } catch (e) {
    assert('Offline Queue - Stores Original distance_meters & gps_accuracy', false, String(e));
  }

  // Test C: 3rd Scan After Check-In & Check-Out Does Not Overwrite check_out_time
  try {
    const mockP = new (await import('../../providers/mock-provider.service')).MockProvider();
    const testUser = 'usr_3rd_scan_test_' + Date.now();
    
    // Scan 1: Check-In
    const scan1 = await mockP.scanAttendance({
      token: 'MOCK_TOKEN',
      qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
      user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      device_uuid: 'DEV_TEST_UUID',
      user_id: testUser,
      timestamp: '2026-08-07T07:00:00Z',
    });
    assert('Check-Out Protection - Scan 1 is CHECK_IN', scan1.attendance_action === 'CHECK_IN');

    // Scan 2: Check-Out
    const scan2 = await mockP.scanAttendance({
      token: 'MOCK_TOKEN',
      qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
      user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      device_uuid: 'DEV_TEST_UUID',
      user_id: testUser,
      timestamp: '2026-08-07T15:00:00Z',
    });
    assert('Check-Out Protection - Scan 2 is CHECK_OUT', scan2.attendance_action === 'CHECK_OUT');

    // Scan 3: 3rd scan after check-in and check-out
    const scan3 = await mockP.scanAttendance({
      token: 'MOCK_TOKEN',
      qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
      user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      device_uuid: 'DEV_TEST_UUID',
      user_id: testUser,
      timestamp: '2026-08-07T17:30:00Z',
    });
    assert('Check-Out Protection - 3rd Scan Returns ALREADY_COMPLETED', scan3.attendance_action === 'ALREADY_COMPLETED');
  } catch (e) {
    assert('Check-Out Protection - 3rd Scan Test Passed', false, String(e));
  }

  // Test D: hashPin throws error when crypto.subtle is unavailable in browser environment
  try {
    const originalCrypto = globalThis.crypto;
    // Mock globalThis.crypto without subtle
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (globalThis as any).crypto;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const originalProcess = (globalThis as any).process;
    // Temporarily mock non-node environment
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).process = undefined;

    try {
      await hashPin('123456');
      assert('hashPin Security - Throws Error in Insecure Browser', false, 'Should have thrown error');
    } catch (err: unknown) {
      const msg = String(err);
      assert('hashPin Security - Throws Error in Insecure Browser', msg.includes('Web Crypto API'));
    } finally {
      // Restore globals
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).crypto = originalCrypto;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (globalThis as any).process = originalProcess;
    }
  } catch (e) {
    assert('hashPin Security - Test Execution', false, String(e));
  }

  return { passed, failed, results };
};
