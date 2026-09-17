/**
 * SMART ABSENSI GURU - ATTENDANCE ENGINE TEST SUITE
 * Unit tests verifying State Machine, QR Validation, Geofence Radius, & Error Codes
 */

import { QRValidationService } from '../qr-validation.service';
import { GPSService } from '../gps.service';
import type { GPSCoordinates } from '../gps.service';
import { AttendanceEngine } from '../attendance-engine.service';
import { AttendanceRepository } from '../../repositories/AttendanceRepository';
import { CONSTANTS } from '../../config/constants';
import { ProviderFactory } from '../../providers/provider-factory';

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

  // Test 6: Attendance Correction API Execution
  try {
    const { useAuthStore } = await import('../../store/useAuthStore');
    useAuthStore.setState({
      user: {
        id: 'usr_admin_1001',
        nip: '199501012020011001',
        full_name: 'Admin Test',
        phone_number: '081234567890',
        role: 'ADMIN',
        position: 'Admin IT',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    });

    const correctRes = await AttendanceRepository.correctAttendance({
      token: 'MOCK_TOKEN',
      target_user_id: 'usr_uuid_1001',
      date: '2026-08-05',
      status: 'HADIR',
      check_in_time: '07:15:00',
      reason: 'Koreksi karena HP mati',
    });
    assert('Attendance Repository - Correct Attendance Execution', correctRes === true);

    const provider = ProviderFactory.getProvider();
    const pastDaily = await provider.getDailyAttendance('2026-08-05', 'MOCK_TOKEN');
    const pastRec = pastDaily.find((r) => r.user_id === 'usr_uuid_1001');
    assert('Attendance Date Isolation - Past date record updated in daily attendance', pastRec?.status === 'HADIR' && pastRec?.date === '2026-08-05');

    const todayRec = await provider.getTodayAttendance('usr_uuid_1001', 'MOCK_TOKEN');
    assert('Attendance Date Isolation - Today attendance is NOT contaminated by yesterday correction', todayRec === null || todayRec.date !== '2026-08-05');
  } catch (err) {
    assert('Attendance Repository - Correct Attendance Execution', false, String(err));
  }

  // Test 7: SDC-AIR Intent Reconciliation (Guru submits morning correction, then scans checkout in afternoon)
  try {
    const { useAuthStore } = await import('../../store/useAuthStore');
    const { getTodayDateInJakarta } = await import('../../utils/time.utils');
    const testUserId = 'usr_sdc_air_test';
    useAuthStore.setState({
      user: {
        id: testUserId,
        nip: '199501012020011099',
        full_name: 'Guru SDC Test',
        phone_number: '081234567899',
        role: 'GURU',
        position: 'Guru Matematika',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    });

    const todayStr = getTodayDateInJakarta();
    const provider = ProviderFactory.getProvider();

    // 1. Guru mengajukan koreksi absen masuk pagi hari ini via LeaveRepository
    const { LeaveRepository } = await import('../../repositories/LeaveRepository');
    await LeaveRepository.submitLeave({
      token: 'MOCK_TOKEN',
      leave_type: 'KOREKSI_ABSEN',
      start_date: todayStr,
      end_date: todayStr,
      reason: `[Pengajuan Koreksi Absen ${todayStr} [Target Koreksi: Jam Masuk (07:05 WIB)] menjadi HADIR]: Lupa absen masuk saat piket pagi`,
    });

    // 2. Di jam kepulangan, guru melakukan scan pulang dengan intent CHECK_OUT
    const scanResult = await provider.scanAttendance({
      token: 'MOCK_TOKEN',
      user_id: testUserId,
      qr_seed: 'SAG_PULANG_SEED_2026',
      user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      device_uuid: 'dev_sdc_test_device',
      attempt_action: 'CHECK_OUT',
      verification_method: 'QR_GPS',
      attendance_source: 'QR',
    });

    // 3. Verifikasi sistem merekonsiliasi transaksi ini sebagai CHECK_OUT, bukan CHECK_IN terlambat
    const todayRecord = await provider.getTodayAttendance(testUserId, 'MOCK_TOKEN');

    const isActionCheckout = scanResult.attendance_action === 'CHECK_OUT';
    const isCheckInPopulated = todayRecord?.check_in_time === '07:05:00';
    const isCheckOutPopulated = Boolean(todayRecord?.check_out_time);
    const isStatusHadir = todayRecord?.status === 'HADIR';

    assert(
      'SDC-AIR - Rekonsiliasi Otomatis Scan Pulang Saat Koreksi Masuk Diajukan',
      isActionCheckout && isCheckInPopulated && isCheckOutPopulated && isStatusHadir,
      `Action: ${scanResult.attendance_action}, In: ${todayRecord?.check_in_time}, Out: ${todayRecord?.check_out_time}, Status: ${todayRecord?.status}`
    );
  } catch (err) {
    assert('SDC-AIR - Rekonsiliasi Otomatis Scan Pulang Saat Koreksi Masuk Diajukan', false, String(err));
  }

  return { passed, failed, results };
};
