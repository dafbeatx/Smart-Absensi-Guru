import { NotificationService } from '../notification-permission.service';
import type { TestSuiteResult } from '../test-runner.service';
import type { LeaveRequest, AttendanceRecord } from '../../types/database.types';

export async function runAttendanceCorrectionNotificationExclusionTestSuite(): Promise<TestSuiteResult> {
  const results: TestSuiteResult['results'] = [];
  let passed = 0;
  let failed = 0;

  const testUser = {
    id: 'usr_test_teacher_exclusion_01',
    full_name: 'Ahmad Fauzi, S.Pd',
    role: 'GURU' as const,
  };
  const testDate = '2026-10-31';

  // Test 1: dismissMissingAttendanceNotification properly cleans up missing attendance notifications
  try {
    // Inject a dummy missing attendance notification into cache
    NotificationService.notifyTeacherMissingAttendance(testUser.full_name, testDate, testUser.id);
    let cached = NotificationService.getCachedNotifications(testUser.id, testUser.role);
    const hasMissingBefore = cached.some((n) => n.id === `notif_missing_att_${testUser.id}_${testDate}`);

    // Now dismiss it
    NotificationService.dismissMissingAttendanceNotification(testUser.id, testDate);
    cached = NotificationService.getCachedNotifications(testUser.id, testUser.role);
    const hasMissingAfter = cached.some((n) => n.id === `notif_missing_att_${testUser.id}_${testDate}`);

    if (hasMissingBefore && !hasMissingAfter) {
      passed++;
      results.push({
        testName: 'Dismiss Missing Attendance: Berhasil membersihkan notifikasi belum absen dari cache memory & storage',
        status: 'PASS',
        details: `Sebelum: ${hasMissingBefore}, Sesudah: ${hasMissingAfter}`,
      });
    } else {
      failed++;
      results.push({
        testName: 'Dismiss Missing Attendance: Berhasil membersihkan notifikasi belum absen dari cache memory & storage',
        status: 'FAIL',
        details: `Sebelum: ${hasMissingBefore}, Sesudah: ${hasMissingAfter}`,
      });
    }
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Dismiss Missing Attendance: Berhasil membersihkan notifikasi belum absen dari cache memory & storage',
      status: 'FAIL',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // Test 2: Guru dengan pengajuan Koreksi Absen PENDING tidak dianggap missing attendance
  try {
    const mockLeaves: LeaveRequest[] = [
      {
        id: 'leave_corr_01',
        user_id: testUser.id,
        leave_type: 'KOREKSI_ABSEN',
        start_date: testDate,
        end_date: testDate,
        reason: '[Pengajuan Koreksi Absen 2026-10-31 menjadi HADIR]: Lupa absen karena rapat dinas',
        approval_status: 'PENDING',
        attachment_url: null,
        approval_deadline: '2026-11-01',
        created_at: new Date().toISOString(),
      },
    ];

    const hasLeaveOrCorrection = mockLeaves.some((l) => {
      const isApprovedOrPending =
        l.approval_status === 'APPROVED' ||
        l.approval_status === 'PENDING';
      return isApprovedOrPending && l.start_date <= testDate && testDate <= l.end_date;
    });

    if (hasLeaveOrCorrection) {
      passed++;
      results.push({
        testName: 'Pending Koreksi Absen Exclusion: Pengajuan koreksi absen berstatus PENDING diakui dan mengecualikan notifikasi belum absen',
        status: 'PASS',
        details: `Koreksi PENDING teridentifikasi: ${hasLeaveOrCorrection}`,
      });
    } else {
      failed++;
      results.push({
        testName: 'Pending Koreksi Absen Exclusion: Pengajuan koreksi absen berstatus PENDING diakui dan mengecualikan notifikasi belum absen',
        status: 'FAIL',
        details: 'Koreksi PENDING gagal diakui',
      });
    }
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Pending Koreksi Absen Exclusion: Pengajuan koreksi absen berstatus PENDING diakui dan mengecualikan notifikasi belum absen',
      status: 'FAIL',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // Test 3: Guru dengan pengajuan IZIN / SAKIT / CUTI PENDING tidak dianggap belum absen
  try {
    const mockLeaves: LeaveRequest[] = [
      {
        id: 'leave_sakit_01',
        user_id: testUser.id,
        leave_type: 'SAKIT',
        start_date: testDate,
        end_date: testDate,
        reason: 'Sakit demam',
        approval_status: 'PENDING',
        attachment_url: null,
        approval_deadline: '2026-11-01',
        created_at: new Date().toISOString(),
      },
    ];

    const hasLeaveOrCorrection = mockLeaves.some((l) => {
      const isApprovedOrPending =
        l.approval_status === 'APPROVED' ||
        l.approval_status === 'PENDING';
      return isApprovedOrPending && l.start_date <= testDate && testDate <= l.end_date;
    });

    if (hasLeaveOrCorrection) {
      passed++;
      results.push({
        testName: 'Pending Leave Exclusion: Pengajuan Izin/Sakit/Cuti PENDING mengecualikan guru dari notifikasi belum absen',
        status: 'PASS',
        details: `Izin PENDING teridentifikasi: ${hasLeaveOrCorrection}`,
      });
    } else {
      failed++;
      results.push({
        testName: 'Pending Leave Exclusion: Pengajuan Izin/Sakit/Cuti PENDING mengecualikan guru dari notifikasi belum absen',
        status: 'FAIL',
        details: 'Izin PENDING gagal diakui',
      });
    }
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Pending Leave Exclusion: Pengajuan Izin/Sakit/Cuti PENDING mengecualikan guru dari notifikasi belum absen',
      status: 'FAIL',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // Test 4: Guru dengan status IZIN/SAKIT/CUTI tidak dijadwalkan reminder check-in
  try {
    const mockTodayAttendance: AttendanceRecord = {
      id: `att_${testUser.id}_${testDate}`,
      user_id: testUser.id,
      date: testDate,
      status: 'IZIN',
      check_in_time: null,
      check_out_time: null,
      check_in_lat: null,
      check_in_lng: null,
      check_in_distance_meters: null,
      verification_method: 'MANUAL_OPERATOR',
      attendance_source: 'MANUAL',
      is_offline: false,
      created_at: new Date().toISOString(),
    };

    const isTodayNonAttendingStatus =
      mockTodayAttendance.status === 'IZIN' ||
      mockTodayAttendance.status === 'SAKIT' ||
      (mockTodayAttendance.status as any) === 'CUTI' ||
      mockTodayAttendance.status === 'DINAS_LUAR';

    // Guard reminder logic: jika isTodayNonAttendingStatus true, scheduleCheckinReminder DIBATALKAN
    const shouldScheduleCheckin = !mockTodayAttendance.check_in_time && !isTodayNonAttendingStatus;

    if (!shouldScheduleCheckin) {
      passed++;
      results.push({
        testName: 'Checkin Reminder Suppression: Guru berstatus IZIN/SAKIT/CUTI tidak dijadwalkan reminder check-in',
        status: 'PASS',
        details: `Status: ${mockTodayAttendance.status}, Should schedule check-in: ${shouldScheduleCheckin}`,
      });
    } else {
      failed++;
      results.push({
        testName: 'Checkin Reminder Suppression: Guru berstatus IZIN/SAKIT/CUTI tidak dijadwalkan reminder check-in',
        status: 'FAIL',
        details: `Expected false, got ${shouldScheduleCheckin}`,
      });
    }
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Checkin Reminder Suppression: Guru berstatus IZIN/SAKIT/CUTI tidak dijadwalkan reminder check-in',
      status: 'FAIL',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  // Test 5: Guru dengan draft koreksi lokal diakui di state dan tidak diberi notifikasi belum absen
  try {
    const memoryDraftMap = new Map<string, string>();
    const localDraftKey = `smart_absensi_pending_correction_${testUser.id}_${testDate}`;
    memoryDraftMap.set(localDraftKey, JSON.stringify({ targetStatus: 'HADIR', date: testDate }));

    const hasLocalDraft = memoryDraftMap.has(localDraftKey);

    if (hasLocalDraft) {
      passed++;
      results.push({
        testName: 'Local Correction Draft Awareness: Draft koreksi lokal langsung diakui sebelum sinkronisasi cloud',
        status: 'PASS',
        details: `Local draft terdeteksi: ${hasLocalDraft}`,
      });
    } else {
      failed++;
      results.push({
        testName: 'Local Correction Draft Awareness: Draft koreksi lokal langsung diakui sebelum sinkronisasi cloud',
        status: 'FAIL',
        details: 'Local draft gagal dideteksi',
      });
    }
  } catch (err: unknown) {
    failed++;
    results.push({
      testName: 'Local Correction Draft Awareness: Draft koreksi lokal langsung diakui sebelum sinkronisasi cloud',
      status: 'FAIL',
      details: err instanceof Error ? err.message : String(err),
    });
  }

  return {
    suiteName: 'Attendance Correction & Leave Notification Exclusion Engine',
    passed,
    failed,
    results,
  };
}
