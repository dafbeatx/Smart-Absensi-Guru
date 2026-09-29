import type { TestSuiteResult } from '../test-runner.service';
import {
  validateAttendanceTimeWindow,
  getJakartaDayOfWeek,
  getTimeInJakarta,
} from '../../utils/time.utils';
import { MockProvider } from '../../providers/mock-provider.service';
import { CONSTANTS } from '../../config/constants';

export async function runAttendanceTimeWindowTestSuite(): Promise<TestSuiteResult> {
  const results: TestSuiteResult['results'] = [];

  const assert = (name: string, condition: boolean, details?: string) => {
    results.push({
      testName: name,
      status: condition ? 'PASS' : 'FAIL',
      details,
    });
  };

  try {
    // ── 1. UNIT TESTS: getJakartaDayOfWeek & getTimeInJakarta ───────────
    const fridayIso = '2026-10-02T08:00:00+07:00'; // 2 Okt 2026 is Friday
    assert('DayOfWeek - Correctly identifies Friday (Day 5)', getJakartaDayOfWeek(fridayIso) === 5);

    const mondayIso = '2026-10-05T08:00:00+07:00'; // 5 Okt 2026 is Monday
    assert('DayOfWeek - Correctly identifies Monday (Day 1)', getJakartaDayOfWeek(mondayIso) === 1);

    const jakartaTime = getTimeInJakarta('2026-10-02T06:15:30+07:00');
    assert('TimeInJakarta - Extracts accurate Jakarta time', jakartaTime === '06:15:30');

    // ── 2. UNIT TESTS: Check-In Window (>= 06:00 WIB) ───────────────────
    // Before 06:00 WIB (e.g. 05:45 WIB)
    const earlyCheckInRes = validateAttendanceTimeWindow({
      checkInTime: null,
      timestamp: '2026-10-05T05:45:00+07:00',
    });
    assert(
      'Check-In Window - Reject check-in before 06:00 WIB',
      earlyCheckInRes.isValid === false &&
      earlyCheckInRes.rejectionCode === 'BEFORE_CHECKIN_START' &&
      Boolean(earlyCheckInRes.errorMessage?.includes('06:00') || earlyCheckInRes.errorMessage?.includes('06.00'))
    );

    // At or after 06:00 WIB (e.g. 06:05 WIB)
    const validCheckInRes = validateAttendanceTimeWindow({
      checkInTime: null,
      timestamp: '2026-10-05T06:05:00+07:00',
    });
    assert(
      'Check-In Window - Accept check-in at 06:05 WIB',
      validCheckInRes.isValid === true && validCheckInRes.action === 'CHECK_IN'
    );

    // ── 3. UNIT TESTS: Double Attendance Prevention & Check-Out Window ──
    // Scenario A: Regular day (Monday-Thursday, Saturday, Sunday)
    // Teacher checked in at 06:15 WIB. Tries to scan again at 07:00 WIB (absen 2x / double scan)
    const repeatScanMorning = validateAttendanceTimeWindow({
      checkInTime: '06:15:00',
      timestamp: '2026-10-05T07:00:00+07:00', // Monday 07:00 WIB
      isFriday: false,
    });
    assert(
      'Double Attendance - Reject 2nd scan at 07:00 WIB on regular day',
      repeatScanMorning.isValid === false &&
      repeatScanMorning.rejectionCode === 'CHECKOUT_TOO_EARLY' &&
      Boolean(repeatScanMorning.errorMessage?.includes('12:00') || repeatScanMorning.errorMessage?.includes('12.00')) &&
      Boolean(repeatScanMorning.errorMessage?.includes('harus melakukan absensi pulang nanti'))
    );

    // Teacher checked in at 06:15 WIB. Tries to scan again at 11:45 WIB (< 12:00 WIB)
    const repeatScanBeforeNoon = validateAttendanceTimeWindow({
      checkInTime: '06:15:00',
      timestamp: '2026-10-05T11:45:00+07:00', // Monday 11:45 WIB
      isFriday: false,
    });
    assert(
      'Double Attendance - Reject 2nd scan at 11:45 WIB (< 12:00 WIB)',
      repeatScanBeforeNoon.isValid === false &&
      repeatScanBeforeNoon.rejectionCode === 'CHECKOUT_TOO_EARLY'
    );

    // Teacher scans at 12:05 WIB on regular day (>= 12:00 WIB)
    const validCheckoutRegular = validateAttendanceTimeWindow({
      checkInTime: '06:15:00',
      timestamp: '2026-10-05T12:05:00+07:00', // Monday 12:05 WIB
      isFriday: false,
    });
    assert(
      'Check-Out Window - Accept check-out at 12:05 WIB on regular day',
      validCheckoutRegular.isValid === true && validCheckoutRegular.action === 'CHECK_OUT'
    );

    // ── 4. UNIT TESTS: Friday Rule (Kepulangan Mulai 10:00 WIB) ─────────
    // On Friday, teacher checked in at 06:15 WIB. Tries to scan at 09:45 WIB (< 10:00 WIB)
    const fridayEarlyCheckout = validateAttendanceTimeWindow({
      checkInTime: '06:15:00',
      timestamp: '2026-10-02T09:45:00+07:00', // Friday 09:45 WIB
      isFriday: true,
    });
    assert(
      'Friday Window - Reject check-out at 09:45 WIB (< 10:00 WIB on Friday)',
      fridayEarlyCheckout.isValid === false &&
      fridayEarlyCheckout.rejectionCode === 'CHECKOUT_TOO_EARLY' &&
      Boolean(fridayEarlyCheckout.errorMessage?.includes('10:00') || fridayEarlyCheckout.errorMessage?.includes('10.00')) &&
      Boolean(fridayEarlyCheckout.errorMessage?.includes("Jum'at"))
    );

    // On Friday, teacher scans at 10:05 WIB (>= 10:00 WIB)
    const fridayValidCheckout = validateAttendanceTimeWindow({
      checkInTime: '06:15:00',
      timestamp: '2026-10-02T10:05:00+07:00', // Friday 10:05 WIB
      isFriday: true,
    });
    assert(
      'Friday Window - Accept check-out at 10:05 WIB (>= 10:00 WIB on Friday)',
      fridayValidCheckout.isValid === true && fridayValidCheckout.action === 'CHECK_OUT'
    );

    // ── 5. UNIT TESTS: Complete Daily Attendance Protection ─────────────
    // Teacher has already completed both check-in (06:15) and check-out (12:30). Scans 3rd time at 12:45
    const tripleScanRes = validateAttendanceTimeWindow({
      checkInTime: '06:15:00',
      checkOutTime: '12:30:00',
      timestamp: '2026-10-05T12:45:00+07:00',
    });
    assert(
      'Double Attendance - Reject scan when both check-in and check-out are already recorded',
      tripleScanRes.isValid === false &&
      tripleScanRes.rejectionCode === 'ALREADY_COMPLETED' &&
      Boolean(tripleScanRes.errorMessage?.includes('absensi ganda') || tripleScanRes.errorMessage?.includes('lengkap'))
    );

    // ── 6. INTEGRATION TESTS: MockProvider.scanAttendance Pipeline ──────
    const provider = new MockProvider();
    const testUserId = 'usr_time_window_test_' + Date.now();

    // Step 1: Scan before 06:00 WIB should be REJECTED
    let earlyErrorCaught = false;
    try {
      await provider.scanAttendance({
        token: 'TOKEN_TIME_TEST',
        user_id: testUserId,
        qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
        user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
        user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
        device_uuid: 'device_time_test',
        timestamp: '2026-10-05T05:30:00+07:00', // 05:30 WIB
      });
    } catch (e: any) {
      earlyErrorCaught = true;
      assert(
        'Integration - scanAttendance rejects check-in before 06:00 WIB',
        e.message.startsWith('Absensi Ditolak!') &&
        Boolean(e.message.includes('06:00') || e.message.includes('06.00'))
      );
    }
    assert('Integration - Early check-in error was thrown', earlyErrorCaught);

    // Step 2: Valid check-in at 06:20 WIB should SUCCEED
    const checkInResult = await provider.scanAttendance({
      token: 'TOKEN_TIME_TEST',
      user_id: testUserId,
      qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
      user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      device_uuid: 'device_time_test',
      timestamp: '2026-10-05T06:20:00+07:00', // 06:20 WIB
    });
    assert('Integration - scanAttendance accepts valid check-in at 06:20 WIB', checkInResult.attendance_action === 'CHECK_IN');

    // Step 3: Repeated scan at 06:25 WIB (< 12:00 WIB) should be REJECTED
    let duplicateErrorCaught = false;
    try {
      await provider.scanAttendance({
        token: 'TOKEN_TIME_TEST',
        user_id: testUserId,
        qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
        user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
        user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
        device_uuid: 'device_time_test',
        timestamp: '2026-10-05T06:25:00+07:00', // 06:25 WIB
      });
    } catch (e: any) {
      duplicateErrorCaught = true;
      assert(
        'Integration - scanAttendance rejects double scan at 06:25 WIB with popup guidance',
        e.message.startsWith('Absensi Ditolak!') &&
        Boolean(e.message.includes('harus melakukan absensi pulang nanti'))
      );
    }
    assert('Integration - Duplicate scan error was thrown', duplicateErrorCaught);

    // Step 4: Valid check-out at 12:15 WIB (>= 12:00 WIB) should SUCCEED
    const checkOutResult = await provider.scanAttendance({
      token: 'TOKEN_TIME_TEST',
      user_id: testUserId,
      qr_seed: CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED,
      user_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      user_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      device_uuid: 'device_time_test',
      timestamp: '2026-10-05T12:15:00+07:00', // 12:15 WIB
    });
    assert('Integration - scanAttendance records check-out at 12:15 WIB', checkOutResult.attendance_action === 'CHECK_OUT');

  } catch (globalErr: any) {
    assert('Global Time Window Suite Execution', false, globalErr.message);
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    suiteName: 'Attendance Jakarta Time Window & Double Attendance Prevention (Phase 5.0)',
    passed,
    failed,
    results,
  };
}
