/**
 * SMART ABSENSI GURU - AUTO ATTENDANCE RULE TEST SUITE
 * Memverifikasi aturan baru: jika ada guru yang tidak absen pada hari kerja,
 * sistem melakukan auto absen dengan status TERLAMBAT tetapi mendapat 0 Poin.
 */

import { MockProvider } from '../../providers/mock-provider.service';
import { ProviderFactory } from '../../providers/provider-factory';
import { AttendancePolicyService } from '../attendance-policy.service';
import { TeacherPointReconciliationService } from '../teacher-point-reconciliation.service';
import { calculateTeacherAppreciationScore } from '../../utils/teacher-appreciation.utils';
import {
  validateAttendanceTimeWindow,
  getTodayDateInJakarta,
  generateRandomLateCheckInTime,
  resolveAutoCheckoutTimeHhMm,
} from '../../utils/time.utils';
import { DEFAULT_SYSTEM_SETTINGS, useSettingsStore } from '../../store/useSettingsStore';
import { useAuthStore } from '../../store/useAuthStore';
import { setServerSupabaseClient, resetServerSupabaseClient } from '../../../api/_shared/session-auth';
import { runAutoCheckout } from '../../../api/_shared/auto-checkout';
import cronHandler from '../../../api/cron-attendance-alerts';
import type { AttendanceRecord, HolidayRecord, LeaveRequest, UserProfile } from '../../types/database.types';

export const runAutoAttendanceRuleTestSuite = async (): Promise<{
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

  const mockProvider = new MockProvider();
  ProviderFactory.setProvider(mockProvider);

  const testTeacher1: UserProfile = {
    id: 'usr_auto_guru_01',
    nip: '198701012020011001',
    npp: 'NPP-870101',
    full_name: 'Drs. H. Mulyadi, M.Pd',
    phone_number: '081234567891',
    role: 'GURU',
    position: 'Guru Matematika',
    avatar_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };

  const testTeacher2: UserProfile = {
    id: 'usr_auto_guru_02',
    nip: '199002022022022002',
    npp: 'NPP-900202',
    full_name: 'Siti Rahmawati, S.Pd',
    phone_number: '081234567892',
    role: 'GURU',
    position: 'Guru Bahasa Indonesia',
    avatar_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };

  const testTeacherLeave: UserProfile = {
    id: 'usr_auto_guru_leave',
    nip: '199203032023033003',
    npp: 'NPP-920303',
    full_name: 'Budi Santoso, S.Kom',
    phone_number: '081234567893',
    role: 'GURU',
    position: 'Guru Informatika',
    avatar_url: null,
    is_active: true,
    created_at: '2026-01-01T00:00:00Z',
  };

  const activeDate = '2026-11-25'; // Rabu (hari kerja)

  // ── Test 1: autoAttendTeacher with mode: CHECK_IN creates record with status TERLAMBAT, random check_in_time (> 07:30 and <= 08:00), check_out_time null, 0 points
  const autoRecord = await mockProvider.autoAttendTeacher({
    user_id: testTeacher1.id,
    date: activeDate,
    teacher_name: testTeacher1.full_name,
    mode: 'CHECK_IN',
  });

  const checkInMin = autoRecord.check_in_time
    ? parseInt(autoRecord.check_in_time.split(':')[0], 10) * 60 + parseInt(autoRecord.check_in_time.split(':')[1], 10)
    : 0;

  assert(
    'AutoAttendance 1: autoAttendTeacher with CHECK_IN creates record with status TERLAMBAT, SYSTEM_AUTO source, check_in_time randomized > 07:30 and <= 08:00, check_out null',
    autoRecord.status === 'TERLAMBAT' &&
      autoRecord.verification_method === 'SYSTEM_AUTO' &&
      autoRecord.attendance_source === 'SYSTEM_AUTO' &&
      autoRecord.is_auto_attendance === true &&
      Boolean(autoRecord.check_in_time) &&
      checkInMin >= 7 * 60 + 31 &&
      checkInMin <= 8 * 60 &&
      !autoRecord.check_out_time &&
      autoRecord.notes?.includes('0 Poin') === true,
    `Status: ${autoRecord.status}, In: ${autoRecord.check_in_time}, Out: ${autoRecord.check_out_time}, Notes: ${autoRecord.notes}`
  );

  // ── Test 1b: Verify check-in time across different teachers is randomized and NOT serentak 07:30
  const autoRecordT2 = await mockProvider.autoAttendTeacher({
    user_id: 'usr_auto_guru_rnd',
    date: activeDate,
    teacher_name: 'Guru Random Test',
    mode: 'CHECK_IN',
  });

  assert(
    'AutoAttendance 1b: Auto attendance check-in times are non-serentak (randomized > 07:30:00 and <= 08:00:00)',
    autoRecord.check_in_time !== '07:30:00' &&
      autoRecordT2.check_in_time !== '07:30:00' &&
      autoRecord.check_in_time !== autoRecordT2.check_in_time &&
      autoRecord.check_in_time! > '07:30:00' &&
      autoRecord.check_in_time! <= '08:00:00' &&
      autoRecordT2.check_in_time! > '07:30:00' &&
      autoRecordT2.check_in_time! <= '08:00:00',
    `Teacher 1: ${autoRecord.check_in_time}, Teacher 2: ${autoRecordT2.check_in_time}`
  );

  // ── Test 2: Point ledger records 0 points for auto-late attendance
  const pointLogs = await mockProvider.getTeacherPointHistory(testTeacher1.id);
  const autoPointLog = pointLogs.find(
    (p) => p.date === activeDate && p.activity_type === 'CHECK_IN_LATE' && p.points === 0
  );

  assert(
    'AutoAttendance 2: Point ledger awards exactly 0 PTS (CHECK_IN_LATE) for auto-late attendance',
    Boolean(autoPointLog && autoPointLog.points === 0 && autoPointLog.title?.includes('0 Poin')),
    autoPointLog ? `Points: ${autoPointLog.points}, Title: ${autoPointLog.title}` : 'Point log not found'
  );

  // ── Test 3: Idempotency protection (Re-running autoAttendTeacher with CHECK_IN does not duplicate records or points)
  const reRunRecord = await mockProvider.autoAttendTeacher({
    user_id: testTeacher1.id,
    date: activeDate,
    teacher_name: testTeacher1.full_name,
    mode: 'CHECK_IN',
  });

  const pointLogsAfterReRun = await mockProvider.getTeacherPointHistory(testTeacher1.id);
  const matchingLogs = pointLogsAfterReRun.filter(
    (p) => p.date === activeDate && p.activity_type === 'CHECK_IN_LATE'
  );

  assert(
    'AutoAttendance 3: Idempotency check prevents duplicate attendance record and point ledger entries',
    reRunRecord.id === autoRecord.id && matchingLogs.length === 1,
    `Record ID match: ${reRunRecord.id === autoRecord.id}, Logs count: ${matchingLogs.length}`
  );

  // ── Test 4: calculateTeacherAppreciationScore awards 0 points for auto-late, while normal late gets 5 pts + 10 checkout
  // Regular late attendance record
  const normalLateRecord: AttendanceRecord = {
    id: 'att_normal_late_01',
    user_id: testTeacher2.id,
    date: '2026-11-24',
    status: 'TERLAMBAT',
    check_in_time: '07:40:00',
    check_out_time: '15:00:00',
    check_in_lat: -6.613144,
    check_in_lng: 106.684975,
    check_in_distance_meters: 10,
    verification_method: 'QR_GPS',
    attendance_source: 'QR',
    is_offline: false,
    created_at: '2026-11-24T00:40:00Z',
  };

  const autoLateHistory: AttendanceRecord[] = [autoRecord];
  const normalLateHistory: AttendanceRecord[] = [normalLateRecord];

  const scoreAuto = calculateTeacherAppreciationScore(autoLateHistory, [], null, testTeacher1.id);
  const scoreNormal = calculateTeacherAppreciationScore(normalLateHistory, [], null, testTeacher2.id);

  assert(
    'AutoAttendance 4: calculateTeacherAppreciationScore gives 0 pts for auto-late CHECK_IN vs 15 pts for normal late + checkout',
    scoreAuto.totalPoints === 0 && scoreNormal.totalPoints === 15,
    `Auto Points: ${scoreAuto.totalPoints}, Normal Points: ${scoreNormal.totalPoints}`
  );

  // ── Test 5: TeacherPointReconciliationService reconciles auto-late with 0 pts
  const reconciledLogs = await TeacherPointReconciliationService.reconcilePoints(
    testTeacher1.id,
    testTeacher1.full_name,
    [autoRecord],
    [],
    [] // empty initial point logs to force reconciliation
  );

  const reconciledCheckIn = reconciledLogs.find(
    (l) => l.date === activeDate && l.activity_type === 'CHECK_IN_LATE'
  );

  assert(
    'AutoAttendance 5: TeacherPointReconciliationService reconciles auto-late record with expectedPoints: 0',
    Boolean(reconciledCheckIn && reconciledCheckIn.points === 0),
    reconciledCheckIn ? `Reconciled pts: ${reconciledCheckIn.points}` : 'No reconciled log found'
  );

  // ── Test 6: autoAttendTeacher with mode: CHECK_OUT records checkout time and keeps existing check-in
  const checkoutRecord = await mockProvider.autoAttendTeacher({
    user_id: testTeacher1.id,
    date: activeDate,
    teacher_name: testTeacher1.full_name,
    mode: 'CHECK_OUT',
  });

  assert(
    'AutoAttendance 6: autoAttendTeacher with CHECK_OUT sets check_out_time and preserves existing check_in_time',
    Boolean(checkoutRecord.check_out_time) &&
      checkoutRecord.check_in_time === autoRecord.check_in_time &&
      checkoutRecord.status === 'TERLAMBAT',
    `Check In: ${checkoutRecord.check_in_time}, Check Out: ${checkoutRecord.check_out_time}, Status: ${checkoutRecord.status}`
  );

  // ── Test 7: autoAttendTeacher with mode: BOTH sets both check_in_time and check_out_time
  const bothRecord = await mockProvider.autoAttendTeacher({
    user_id: 'usr_auto_guru_both',
    date: activeDate,
    teacher_name: 'Guru Pengajar Both',
    mode: 'BOTH',
  });

  assert(
    'AutoAttendance 7: autoAttendTeacher with BOTH sets both check_in_time and check_out_time with TERLAMBAT status',
    bothRecord.status === 'TERLAMBAT' &&
      Boolean(bothRecord.check_in_time) &&
      Boolean(bothRecord.check_out_time) &&
      bothRecord.is_auto_attendance === true,
    `In: ${bothRecord.check_in_time}, Out: ${bothRecord.check_out_time}, Status: ${bothRecord.status}`
  );

  // ── Test 8: autoAttendUnabsentedTeachers auto-attends unabsented and skips excused leave & holidays
  const approvedLeave: LeaveRequest = {
    id: 'leave_budi_01',
    user_id: testTeacherLeave.id,
    leave_type: 'SAKIT',
    start_date: activeDate,
    end_date: activeDate,
    reason: 'Sakit demam',
    attachment_url: null,
    approval_status: 'APPROVED',
    approval_deadline: `${activeDate}T12:00:00Z`,
    created_at: `${activeDate}T06:00:00Z`,
  };

  const holidayList: HolidayRecord[] = [
    {
      id: 'hol_1',
      date: '2026-11-26', // Thursday holiday
      name: 'Hari Libur Nasional Uji',
      type: 'NATIONAL_HOLIDAY',
      category_type: 'HOLIDAY',
      is_holiday: true,
      created_at: '2026-11-01T00:00:00Z',
    },
  ];

  // Batch auto attendance on activeDate with mode 'BOTH'
  const batchResults = await AttendancePolicyService.autoAttendUnabsentedTeachers(
    activeDate,
    [testTeacher1, testTeacher2, testTeacherLeave],
    [autoRecord], // Teacher 1 already auto-attended
    [approvedLeave], // Teacher Leave has approved leave
    'BOTH',
    null,
    holidayList
  );

  // Only Teacher 2 should be auto-attended in this batch
  const attendedIds = batchResults.map((r) => r.user_id);
  assert(
    'AutoAttendance 8: autoAttendUnabsentedTeachers auto-attends only unabsented personnel and skips approved leaves',
    batchResults.length === 1 && attendedIds.includes(testTeacher2.id) && !attendedIds.includes(testTeacherLeave.id),
    `Batch attended count: ${batchResults.length}, IDs: ${attendedIds.join(', ')}`
  );

  // On holiday date (Nov 26), auto-attendance should skip entirely
  const holidayBatchResults = await AttendancePolicyService.autoAttendUnabsentedTeachers(
    '2026-11-26',
    [testTeacher1, testTeacher2],
    [],
    [],
    'BOTH',
    null,
    holidayList
  );

  assert(
    'AutoAttendance 9: autoAttendUnabsentedTeachers strictly skips scheduled school/national holidays',
    holidayBatchResults.length === 0,
    `Holiday attended count: ${holidayBatchResults.length}`
  );

  // ── Test 10: Checkout Auto Preserves Physical QR Check-in Identity & Real Late Points
  const prevAuthState = {
    user: useAuthStore.getState().user,
    token: useAuthStore.getState().token,
  };
  const todayStr = getTodayDateInJakarta();

  try {
    const qrLateUser: UserProfile = {
      id: 'usr_auto_qr_late_preserve',
      nip: '199104042024041004',
      npp: 'NPP-910404',
      full_name: 'Hendra Wijaya, S.Pd',
      phone_number: '081234567894',
      role: 'GURU',
      position: 'Guru Fisika',
      avatar_url: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    useAuthStore.setState({ user: qrLateUser, token: 'MOCK_GURU_TOKEN' });

    await mockProvider.scanAttendance({
      token: 'MOCK_GURU_TOKEN',
      user_id: qrLateUser.id,
      qr_seed: 'SMART_ABSENSI_OFFICIAL_QR_2026',
      user_lat: -6.613144,
      user_lng: 106.684975,
      device_uuid: 'dev_qr_late',
      timestamp: `${todayStr}T07:40:00+07:00`,
    });

    const autoOutOnly = await mockProvider.autoAttendTeacher({
      user_id: qrLateUser.id,
      date: todayStr,
      teacher_name: qrLateUser.full_name,
      mode: 'CHECK_OUT',
    });

    const scoreQrLateWithAutoOut = calculateTeacherAppreciationScore([autoOutOnly], [], null, qrLateUser.id);
    assert(
      'AutoAttendance 10: autoAttend CHECK_OUT preserves physical QR_GPS check-in source and late appreciation points',
      autoOutOnly.verification_method === 'QR_GPS' &&
        autoOutOnly.attendance_source === 'QR' &&
        autoOutOnly.is_auto_attendance === false &&
        Boolean(autoOutOnly.check_out_time) &&
        scoreQrLateWithAutoOut.totalPoints === 15,
      `Method=${autoOutOnly.verification_method}, Source=${autoOutOnly.attendance_source}, Points=${scoreQrLateWithAutoOut.totalPoints}`
    );

    // ── Test 11: Guru yang sudah dicatat SYSTEM_AUTO (BOTH) tetap bisa tiba-tiba Absen Masuk mandiri sebelum jam pulang
    const overrideTeacher: UserProfile = {
      id: 'usr_auto_override_checkin',
      nip: '199305052024051005',
      npp: 'NPP-930505',
      full_name: 'Rina Kusuma, M.Pd',
      phone_number: '081234567895',
      role: 'GURU',
      position: 'Guru Kimia',
      avatar_url: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    useAuthStore.setState({ user: overrideTeacher, token: 'MOCK_GURU_TOKEN' });

    const preAutoBoth = await mockProvider.autoAttendTeacher({
      user_id: overrideTeacher.id,
      date: todayStr,
      teacher_name: overrideTeacher.full_name,
      mode: 'BOTH',
    });

    const windowOverrideRes = validateAttendanceTimeWindow({
      checkInTime: preAutoBoth.check_in_time,
      checkOutTime: preAutoBoth.check_out_time,
      timestamp: `${todayStr}T07:15:00+07:00`,
      isFriday: false,
      isAutoCheckIn: true,
      isAutoCheckOut: true,
    });

    const manualScanRes = await mockProvider.scanAttendance({
      token: 'MOCK_GURU_TOKEN',
      user_id: overrideTeacher.id,
      qr_seed: 'SMART_ABSENSI_OFFICIAL_QR_2026',
      user_lat: -6.613144,
      user_lng: 106.684975,
      device_uuid: 'dev_override_in',
      timestamp: `${todayStr}T07:15:00+07:00`,
    });

    const replacedRec = await mockProvider.getTodayAttendance(overrideTeacher.id, 'MOCK_GURU_TOKEN');
    const overridePoints = await mockProvider.getTeacherPointHistory(overrideTeacher.id);
    const hasNonZeroCheckInPt = overridePoints.some(
      (p) =>
        p.date === todayStr &&
        (p.activity_type === 'CHECK_IN_ON_TIME' || p.activity_type === 'CHECK_IN_LATE') &&
        Number(p.points) > 0
    );

    assert(
      'AutoAttendance 11: Guru with SYSTEM_AUTO BOTH can still scan physical CHECK_IN, clearing stale auto checkout and replacing 0-point placeholder',
      windowOverrideRes.isValid === true &&
        windowOverrideRes.action === 'CHECK_IN' &&
        windowOverrideRes.isOverrideAutoCheckIn === true &&
        manualScanRes.attendance_action === 'CHECK_IN' &&
        replacedRec?.verification_method === 'QR_GPS' &&
        replacedRec?.check_out_time === null &&
        replacedRec?.is_auto_attendance === false &&
        hasNonZeroCheckInPt,
      `Action=${manualScanRes.attendance_action}, Method=${replacedRec?.verification_method}, Out=${replacedRec?.check_out_time}, HasPts=${hasNonZeroCheckInPt}`
    );

    // ── Test 12: Guru with Auto Pulang can override checkout with physical scan during checkout window
    await mockProvider.autoAttendTeacher({
      user_id: overrideTeacher.id,
      date: todayStr,
      teacher_name: overrideTeacher.full_name,
      mode: 'CHECK_OUT',
    });
    const physicalCheckoutOverride = await mockProvider.scanAttendance({
      token: 'MOCK_GURU_TOKEN',
      user_id: overrideTeacher.id,
      qr_seed: 'SMART_ABSENSI_OFFICIAL_QR_2026',
      user_lat: -6.613144,
      user_lng: 106.684975,
      device_uuid: 'dev_override_in',
      timestamp: `${todayStr}T14:25:00+07:00`,
      attempt_action: 'CHECK_OUT',
    });
    const finalPhysicalRec = await mockProvider.getTodayAttendance(overrideTeacher.id, 'MOCK_GURU_TOKEN');
    assert(
      'AutoAttendance 12: Guru with Auto Pulang can replace checkout timestamp via physical scan in checkout window',
      physicalCheckoutOverride.attendance_action === 'CHECK_OUT' &&
        Boolean(finalPhysicalRec?.check_out_time) &&
        !String(finalPhysicalRec?.notes || '').includes('Auto Pulang'),
      `Action=${physicalCheckoutOverride.attendance_action}, Notes=${finalPhysicalRec?.notes}`
    );

    // ── Test 13: Guru with SYSTEM_AUTO BOTH submits SAKIT leave -> Kepsek approves -> voids stale auto points & clears SYSTEM_AUTO
    const leaveOverrideUser: UserProfile = {
      id: 'usr_auto_leave_override',
      nip: '199406062024062006',
      npp: 'NPP-940606',
      full_name: 'Dewi Anggraini, S.Pd',
      phone_number: '081234567896',
      role: 'GURU',
      position: 'Guru Biologi',
      avatar_url: null,
      is_active: true,
      created_at: '2026-01-01T00:00:00Z',
    };
    useAuthStore.setState({ user: leaveOverrideUser, token: 'MOCK_GURU_TOKEN' });

    await mockProvider.autoAttendTeacher({
      user_id: leaveOverrideUser.id,
      date: todayStr,
      teacher_name: leaveOverrideUser.full_name,
      mode: 'BOTH',
    });

    const submittedLeave = await mockProvider.submitLeave({
      token: 'MOCK_GURU_TOKEN',
      leave_type: 'SAKIT',
      start_date: todayStr,
      end_date: todayStr,
      reason: 'Demam tinggi mendadak setelah jadwal pagi sehingga harus beristirahat di klinik.',
      duty_teacher_notes: 'Tugas latihan LKS halaman 24 diserahkan ke kelas.',
    });

    useAuthStore.setState({
      user: { ...leaveOverrideUser, id: 'usr_kepsek_test', role: 'KEPSEK', full_name: 'Kepala Sekolah' },
      token: 'MOCK_KEPSEK_TOKEN',
    });
    await mockProvider.approveLeave(submittedLeave.id, 'APPROVED', 'Disetujui, lekas sembuh.', 'MOCK_KEPSEK_TOKEN');

    const postLeaveRec = await mockProvider.getTodayAttendance(leaveOverrideUser.id, 'MOCK_KEPSEK_TOKEN');
    const postLeavePoints = await mockProvider.getTeacherPointHistory(leaveOverrideUser.id);
    const activeAutoPoints = postLeavePoints.filter(
      (p) =>
        p.date === todayStr &&
        p.status !== 'VOIDED' &&
        (p.title?.includes('Otomatis Sistem') || p.description?.includes('otomatis') || p.description?.includes('Auto Pulang'))
    );

    assert(
      'AutoAttendance 13: Approved SAKIT/IZIN leave cleanly overrides existing SYSTEM_AUTO attendance and voids stale auto points',
      postLeaveRec?.status === 'SAKIT' &&
        postLeaveRec?.verification_method === 'MANUAL_OPERATOR' &&
        postLeaveRec?.attendance_source === 'MANUAL' &&
        postLeaveRec?.is_auto_attendance === false &&
        postLeaveRec?.check_in_time === null &&
        postLeaveRec?.check_out_time === null &&
        activeAutoPoints.length === 0,
      `Status=${postLeaveRec?.status}, Method=${postLeaveRec?.verification_method}, ActiveAutoPts=${activeAutoPoints.length}`
    );

    // ── Test 14: Server-Side Auto Check-Out Only (Hanya Pulang) & Auth Guard
    const prevCronSecret = process.env.CRON_SECRET;
    process.env.CRON_SECRET = 'test_cron_secret_wave_auto_checkout';

    const fakeAttendanceRows: any[] = [
      {
        id: 'att_u_checkedin_only_2026-11-26',
        user_id: 'u_checkedin_only',
        date: '2026-11-26',
        status: 'HADIR',
        check_in_time: '07:05:00',
        check_out_time: null,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        notes: null,
      },
      {
        id: 'att_u_qr_late_2026-11-26',
        user_id: 'u_qr_late',
        date: '2026-11-26',
        status: 'TERLAMBAT',
        check_in_time: '07:42:00',
        check_out_time: null,
        verification_method: 'BIOMETRIC_GPS',
        attendance_source: 'BIOMETRIC',
        notes: null,
      },
      {
        id: 'att_u_already_out_2026-11-26',
        user_id: 'u_already_out',
        date: '2026-11-26',
        status: 'HADIR',
        check_in_time: '06:55:00',
        check_out_time: '13:15:00',
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        notes: null,
      },
      {
        id: 'att_u_on_leave_2026-11-26',
        user_id: 'u_on_leave',
        date: '2026-11-26',
        status: 'HADIR',
        check_in_time: '07:10:00',
        check_out_time: null,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        notes: null,
      },
    ];
    const fakePointRows: any[] = [];
    const fakeHolidays: any[] = [
      { id: 'h_test_off', date: '2026-11-27', name: 'Libur Uji', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true },
    ];
    const fakeLeaves: any[] = [
      { id: 'lv_sakit_1', user_id: 'u_on_leave', type: 'SAKIT', status: 'APPROVED', start_date: '2026-11-26', end_date: '2026-11-26', reason: 'Sakit' },
    ];
    const fakeUsers: any[] = [
      { id: 'u_checkedin_only', full_name: 'Guru Hadir Belum Pulang', role: 'GURU', account_status: 'ACTIVE' },
      { id: 'u_qr_late', full_name: 'Guru Telat Sidik Jari', role: 'GURU', account_status: 'ACTIVE' },
      { id: 'u_already_out', full_name: 'Guru Sudah Pulang', role: 'GURU', account_status: 'ACTIVE' },
      { id: 'u_never_checkedin', full_name: 'Guru Belum Absen Masuk', role: 'GURU', account_status: 'ACTIVE' },
      { id: 'u_on_leave', full_name: 'Guru Izin Sakit', role: 'GURU', account_status: 'ACTIVE' },
    ];

    const fakeCronSupabase = {
      from: (table: string) => {
        const filters: Record<string, any> = {};
        let lteDate: string | null = null;
        let gteDate: string | null = null;
        let updatePayload: any = null;

        const execSelect = () => {
          if (table === 'system_settings') {
            return {
              data: [
                { key: 'saturday_is_holiday', value: 'true' },
                { key: 'sunday_is_holiday', value: 'true' },
                { key: 'work_checkout_start', value: '12:00' },
                { key: 'friday_checkout_start', value: '10:00' },
              ],
              error: null,
            };
          }
          if (table === 'holidays') {
            return { data: fakeHolidays.filter((h) => !filters.date || h.date === filters.date), error: null };
          }
          if (table === 'users') {
            return { data: fakeUsers, error: null };
          }
          if (table === 'leaves') {
            return {
              data: fakeLeaves.filter((l) => (!lteDate || l.start_date <= lteDate) && (!gteDate || l.end_date >= gteDate)),
              error: null,
            };
          }
          if (table === 'attendance') {
            return {
              data: fakeAttendanceRows.filter((a) => !filters.date || a.date === filters.date),
              error: null,
            };
          }
          if (table === 'teacher_point_history') {
            const matched = fakePointRows.filter(
              (p) =>
                (!filters.user_id || p.user_id === filters.user_id) &&
                (!filters.date || p.date === filters.date) &&
                (!filters.activity_type || p.activity_type === filters.activity_type)
            );
            return { data: matched, error: null };
          }
          return { data: [], error: null };
        };

        const chain: any = {
          select: () => chain,
          eq: (col: string, val: any) => {
            filters[col] = val;
            if (updatePayload && table === 'attendance' && col === 'id') {
              const idx = fakeAttendanceRows.findIndex((r) => r.id === val);
              if (idx >= 0) {
                fakeAttendanceRows[idx] = { ...fakeAttendanceRows[idx], ...updatePayload };
              }
              return Promise.resolve({ error: null });
            }
            return chain;
          },
          lte: (_col: string, val: any) => {
            lteDate = val;
            return chain;
          },
          gte: (_col: string, val: any) => {
            gteDate = val;
            return chain;
          },
          update: (payload: any) => {
            updatePayload = payload;
            return chain;
          },
          insert: (payload: any) => {
            if (table === 'teacher_point_history') {
              fakePointRows.push(payload);
            }
            return Promise.resolve({ data: payload, error: null });
          },
          maybeSingle: async () => {
            const res = execSelect();
            return { data: res.data?.[0] || null, error: null };
          },
          then: (resolve: any, reject?: any) => Promise.resolve(execSelect()).then(resolve, reject),
        };
        return chain;
      },
    };

    try {
      setServerSupabaseClient(fakeCronSupabase);

      // 14a: Unauthenticated request rejected 401
      const unauthHeaders: Record<string, string> = {};
      let unauthStatus = 200;
      const unauthRes = {
        setHeader: (k: string, v: string) => { unauthHeaders[k.toLowerCase()] = v; },
        status: (code: number) => { unauthStatus = code; return unauthRes; },
        json: (_b: any) => unauthRes,
        end: () => unauthRes,
      };
      await cronHandler({ method: 'GET', query: { type: 'auto-checkout' }, headers: {} }, unauthRes);

      // 14b: Run server auto-checkout for active workday 2026-11-26
      const cronRes = await runAutoCheckout(fakeCronSupabase, { targetDateStr: '2026-11-26' });
      const u1Row = fakeAttendanceRows.find((r) => r.user_id === 'u_checkedin_only');
      const u2Row = fakeAttendanceRows.find((r) => r.user_id === 'u_qr_late');
      const u3Row = fakeAttendanceRows.find((r) => r.user_id === 'u_already_out');
      const u4Row = fakeAttendanceRows.find((r) => r.user_id === 'u_never_checkedin');
      const u5Row = fakeAttendanceRows.find((r) => r.user_id === 'u_on_leave');

      // 14c: Authorized Cron Endpoint HTTP 200 test + Holiday skip test
      let cronHttpStatus = 0;
      let cronHttpBody: any = null;
      const authRes = {
        setHeader: () => {},
        status: (code: number) => { cronHttpStatus = code; return authRes; },
        json: (body: any) => { cronHttpBody = body; return authRes; },
        end: () => authRes,
      };
      await cronHandler(
        {
          method: 'POST',
          query: { type: 'auto-checkout' },
          headers: { authorization: 'Bearer test_cron_secret_wave_auto_checkout' },
        },
        authRes
      );

      const holidayRes = await runAutoCheckout(fakeCronSupabase, { targetDateStr: '2026-11-27' });

      assert(
        'AutoAttendance 14: Server auto-checkout ONLY checks out checked-in teachers, skips unabsented/leave/holiday, preserves QR/Biometric identity, and enforces auth',
        unauthStatus === 401 &&
          cronHttpStatus === 200 &&
          cronHttpBody?.ok === true &&
          cronRes.processedCount === 2 &&
          cronRes.updatedUserIds.includes('u_checkedin_only') &&
          cronRes.updatedUserIds.includes('u_qr_late') &&
          !u4Row && // Unabsented teacher MUST NOT get auto checked-in!
          u1Row?.check_out_time === '12:00:00' &&
          u1Row?.verification_method === 'QR_GPS' &&
          u2Row?.check_out_time === '12:00:00' &&
          u2Row?.verification_method === 'BIOMETRIC_GPS' &&
          u2Row?.attendance_source === 'BIOMETRIC' &&
          u3Row?.check_out_time === '13:15:00' &&
          u5Row?.check_out_time === null &&
          fakePointRows.length === 2 &&
          holidayRes.skippedReason === 'HOLIDAY' &&
          holidayRes.processedCount === 0,
        `unauth=${unauthStatus}, processed=${cronRes.processedCount}, holiday=${holidayRes.skippedReason}, u4=${Boolean(u4Row)}, pts=${fakePointRows.length}`
      );
    } finally {
      resetServerSupabaseClient();
      if (prevCronSecret === undefined) delete process.env.CRON_SECRET;
      else process.env.CRON_SECRET = prevCronSecret;
    }

    // ── Test 15–19: Complete Admin Auto Absen Configuration Suite ─────────────
    try {
      const customAutoSettings = {
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: true,
        auto_checkout_enabled: false,
        auto_checkin_mode: 'MANUAL_ONLY' as const,
        auto_checkout_time_mode: 'CUSTOM' as const,
        auto_checkout_custom_time: '15:15',
        auto_checkout_custom_friday_time: '11:45',
        auto_checkout_trigger_time: '17:00',
        auto_checkin_time_min: '08:05',
        auto_checkin_time_max: '08:15',
        auto_checkin_points: 2,
        auto_checkout_points: 6,
        auto_attendance_skip_holidays: false,
        auto_attendance_skip_leaves: false,
        auto_attendance_allow_override_scan: false,
        auto_attendance_allow_override_leave: false,
        auto_checkout_preserve_checkin_source: false,
      };
      await mockProvider.updateSettings(customAutoSettings, 'MOCK_ADMIN_TOKEN');
      const reloadedAutoSettings = await mockProvider.getSettings();

      const customTimeVal = generateRandomLateCheckInTime('cfg_seed_1', '08:05', '08:15');
      const resolvedThuCustom = resolveAutoCheckoutTimeHhMm(false, reloadedAutoSettings);
      const resolvedFriCustom = resolveAutoCheckoutTimeHhMm(true, reloadedAutoSettings);
      const resolvedThuSchedule = resolveAutoCheckoutTimeHhMm(false, DEFAULT_SYSTEM_SETTINGS);

      assert(
        'AutoAttendance 15: All 16 auto_attendance settings persist via getSettings/updateSettings and helpers resolve custom ranges & times',
        reloadedAutoSettings.auto_attendance_enabled === true &&
          reloadedAutoSettings.auto_checkout_enabled === false &&
          reloadedAutoSettings.auto_checkin_mode === 'MANUAL_ONLY' &&
          reloadedAutoSettings.auto_checkout_time_mode === 'CUSTOM' &&
          reloadedAutoSettings.auto_checkout_custom_time === '15:15' &&
          reloadedAutoSettings.auto_checkout_custom_friday_time === '11:45' &&
          reloadedAutoSettings.auto_checkout_trigger_time === '17:00' &&
          reloadedAutoSettings.auto_checkin_time_min === '08:05' &&
          reloadedAutoSettings.auto_checkin_time_max === '08:15' &&
          reloadedAutoSettings.auto_checkin_points === 2 &&
          reloadedAutoSettings.auto_checkout_points === 6 &&
          reloadedAutoSettings.auto_attendance_skip_holidays === false &&
          reloadedAutoSettings.auto_attendance_skip_leaves === false &&
          reloadedAutoSettings.auto_attendance_allow_override_scan === false &&
          reloadedAutoSettings.auto_attendance_allow_override_leave === false &&
          reloadedAutoSettings.auto_checkout_preserve_checkin_source === false &&
          customTimeVal >= '08:05:00' &&
          customTimeVal <= '08:15:00' &&
          resolvedThuCustom === '15:15' &&
          resolvedFriCustom === '11:45' &&
          resolvedThuSchedule === DEFAULT_SYSTEM_SETTINGS.work_checkout_start,
        `in=${customTimeVal}, thu=${resolvedThuCustom}, fri=${resolvedFriCustom}, sched=${resolvedThuSchedule}`
      );

      // ── Test 16: autoAttendTeacher & autoAttendUnabsentedTeachers enforce master off, check-in disabled, & custom time/points
      await mockProvider.updateSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: false,
      }, 'MOCK_ADMIN_TOKEN');

      let disabledThrew = false;
      try {
        await mockProvider.autoAttendTeacher({
          user_id: 'usr_cfg_disabled',
          date: '2026-11-25',
          teacher_name: 'Guru Nonaktif',
          mode: 'CHECK_OUT',
        });
      } catch {
        disabledThrew = true;
      }
      const batchDisabled = await AttendancePolicyService.autoAttendUnabsentedTeachers(
        '2026-11-25',
        [testTeacher1],
        [],
        [],
        'CHECK_OUT',
        { ...DEFAULT_SYSTEM_SETTINGS, auto_attendance_enabled: false }
      );

      await mockProvider.updateSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: true,
        auto_checkin_mode: 'DISABLED',
        auto_checkout_time_mode: 'CUSTOM',
        auto_checkout_custom_time: '14:40',
        auto_checkin_points: 2,
        auto_checkout_points: 6,
      }, 'MOCK_ADMIN_TOKEN');

      let checkInDisabledThrew = false;
      try {
        await mockProvider.autoAttendTeacher({
          user_id: 'usr_cfg_no_in',
          date: '2026-11-25',
          teacher_name: 'Guru No Auto Masuk',
          mode: 'CHECK_IN',
        });
      } catch {
        checkInDisabledThrew = true;
      }

      const checkOutStillAllowed = await mockProvider.autoAttendTeacher({
        user_id: 'usr_cfg_only_out',
        date: '2026-11-25',
        teacher_name: 'Guru Hanya Auto Pulang',
        mode: 'CHECK_OUT',
      });

      await mockProvider.updateSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: true,
        auto_checkin_mode: 'MANUAL_ONLY',
        auto_checkin_time_min: '08:05',
        auto_checkin_time_max: '08:15',
        auto_checkin_points: 2,
        auto_checkout_points: 6,
      }, 'MOCK_ADMIN_TOKEN');

      const customCheckInRec = await mockProvider.autoAttendTeacher({
        user_id: 'usr_cfg_custom_in',
        date: '2026-11-25',
        teacher_name: 'Guru Poin Kustom',
        mode: 'CHECK_IN',
      });

      assert(
        'AutoAttendance 16: Master toggle, auto_checkin_mode=DISABLED, custom check-in range, and custom points are enforced',
        disabledThrew &&
          batchDisabled.length === 0 &&
          checkInDisabledThrew &&
          checkOutStillAllowed.check_out_time === '14:40:00' &&
          checkOutStillAllowed.points_awarded === 6 &&
          Boolean(customCheckInRec.check_in_time) &&
          customCheckInRec.check_in_time! >= '08:05:00' &&
          customCheckInRec.check_in_time! <= '08:15:00' &&
          customCheckInRec.points_awarded === 2,
        `disabledThrew=${disabledThrew}, inDisThrew=${checkInDisabledThrew}, outTime=${checkOutStillAllowed.check_out_time}, outPts=${checkOutStillAllowed.points_awarded}, inTime=${customCheckInRec.check_in_time}, inPts=${customCheckInRec.points_awarded}`
      );

      // ── Test 17: Exception toggles skip_holidays & skip_leaves
      await mockProvider.updateSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: true,
        auto_attendance_skip_holidays: false,
        auto_attendance_skip_leaves: false,
      }, 'MOCK_ADMIN_TOKEN');

      const cfgHolTeacher: UserProfile = { ...testTeacher1, id: 'usr_cfg_hol_skip' };
      const cfgLeaveTeacher: UserProfile = { ...testTeacherLeave, id: 'usr_cfg_leave_skip' };
      const cfgHolidays: HolidayRecord[] = [
        {
          id: 'hol_cfg_test',
          date: '2026-11-26',
          name: 'Hari Libur Uji Pengaturan',
          type: 'NATIONAL_HOLIDAY',
          category_type: 'HOLIDAY',
          is_holiday: true,
          created_at: '2026-11-01T00:00:00Z',
        },
      ];
      const cfgLeaves: LeaveRequest[] = [
        {
          id: 'leave_cfg_test',
          user_id: cfgLeaveTeacher.id,
          leave_type: 'IZIN',
          start_date: '2026-11-25',
          end_date: '2026-11-25',
          reason: 'Keperluan keluarga',
          attachment_url: null,
          approval_status: 'APPROVED',
          approval_deadline: '2026-11-25T12:00:00Z',
          created_at: '2026-11-25T06:00:00Z',
        },
      ];

      const skippedHolRes = await AttendancePolicyService.autoAttendUnabsentedTeachers(
        '2026-11-26',
        [cfgHolTeacher],
        [],
        [],
        'CHECK_IN',
        { ...DEFAULT_SYSTEM_SETTINGS, auto_attendance_enabled: true, auto_attendance_skip_holidays: true },
        cfgHolidays
      );
      const allowedHolRes = await AttendancePolicyService.autoAttendUnabsentedTeachers(
        '2026-11-26',
        [cfgHolTeacher],
        [],
        [],
        'CHECK_IN',
        { ...DEFAULT_SYSTEM_SETTINGS, auto_attendance_enabled: true, auto_attendance_skip_holidays: false },
        cfgHolidays
      );
      const skippedLeaveRes = await AttendancePolicyService.autoAttendUnabsentedTeachers(
        '2026-11-25',
        [cfgLeaveTeacher],
        [],
        cfgLeaves,
        'CHECK_IN',
        { ...DEFAULT_SYSTEM_SETTINGS, auto_attendance_enabled: true, auto_attendance_skip_leaves: true },
        []
      );
      const allowedLeaveRes = await AttendancePolicyService.autoAttendUnabsentedTeachers(
        '2026-11-25',
        [cfgLeaveTeacher],
        [],
        cfgLeaves,
        'CHECK_IN',
        { ...DEFAULT_SYSTEM_SETTINGS, auto_attendance_enabled: true, auto_attendance_skip_leaves: false },
        []
      );

      assert(
        'AutoAttendance 17: skip_holidays=false and skip_leaves=false allow Auto Absen while true strictly skips both',
        skippedHolRes.length === 0 &&
          allowedHolRes.length === 1 &&
          skippedLeaveRes.length === 0 &&
          allowedLeaveRes.length === 1,
        `hol=(${skippedHolRes.length}->${allowedHolRes.length}), leave=(${skippedLeaveRes.length}->${allowedLeaveRes.length})`
      );

      // ── Test 18: Override toggle auto_attendance_allow_override_scan
      const overrideCfgUser: UserProfile = {
        ...testTeacher1,
        id: 'usr_cfg_override_scan',
        full_name: 'Guru Override Pengaturan',
      };
      useAuthStore.setState({ user: overrideCfgUser, token: 'MOCK_GURU_TOKEN' });

      await mockProvider.updateSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: true,
        auto_attendance_allow_override_scan: false,
      }, 'MOCK_ADMIN_TOKEN');

      await mockProvider.autoAttendTeacher({
        user_id: overrideCfgUser.id,
        date: todayStr,
        teacher_name: overrideCfgUser.full_name,
        mode: 'BOTH',
      });

      const blockedOverrideScan = await mockProvider.scanAttendance({
        token: 'MOCK_GURU_TOKEN',
        user_id: overrideCfgUser.id,
        qr_seed: 'SMART_ABSENSI_OFFICIAL_QR_2026',
        user_lat: -6.613144,
        user_lng: 106.684975,
        device_uuid: 'dev_cfg_override',
        timestamp: `${todayStr}T07:10:00+07:00`,
      });

      await mockProvider.updateSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: true,
        auto_attendance_allow_override_scan: true,
      }, 'MOCK_ADMIN_TOKEN');

      const allowedOverrideScan = await mockProvider.scanAttendance({
        token: 'MOCK_GURU_TOKEN',
        user_id: overrideCfgUser.id,
        qr_seed: 'SMART_ABSENSI_OFFICIAL_QR_2026',
        user_lat: -6.613144,
        user_lng: 106.684975,
        device_uuid: 'dev_cfg_override',
        timestamp: `${todayStr}T07:10:00+07:00`,
      });

      assert(
        'AutoAttendance 18: auto_attendance_allow_override_scan=false blocks QR override of SYSTEM_AUTO while true permits it',
        blockedOverrideScan.attendance_action === 'ALREADY_COMPLETED' &&
          allowedOverrideScan.attendance_action === 'CHECK_IN' &&
          allowedOverrideScan.status === 'HADIR',
        `blocked=${blockedOverrideScan.attendance_action}, allowed=${allowedOverrideScan.attendance_action}:${allowedOverrideScan.status}`
      );

      // ── Test 19: Server runAutoCheckout & MockProvider.runServerAutoCheckout respect all configured rules
      const buildCfgCronSupabase = (
        settingsRows: Array<{ key: string; value: string }>,
        attRows: any[],
        ptRows: any[]
      ) => ({
        from: (table: string) => {
          const filters: Record<string, any> = {};
          let updatePayload: any = null;
          const execSelect = () => {
            if (table === 'system_settings') return { data: settingsRows, error: null };
            if (table === 'holidays') {
              return {
                data: [{ id: 'hol_fri_cfg', date: '2026-11-27', name: 'Libur Uji Jumat', type: 'NATIONAL_HOLIDAY', is_holiday: true }],
                error: null,
              };
            }
            if (table === 'users') {
              return { data: [{ id: 'u_cfg_1', full_name: 'Guru Cron Config', role: 'GURU', account_status: 'ACTIVE' }], error: null };
            }
            if (table === 'leaves') {
              return {
                data: [{ id: 'lv_cfg_1', user_id: 'u_cfg_1', type: 'IZIN', status: 'APPROVED', start_date: '2026-11-27', end_date: '2026-11-27', reason: 'Izin' }],
                error: null,
              };
            }
            if (table === 'attendance') {
              return { data: attRows.filter((r) => !filters.date || r.date === filters.date), error: null };
            }
            if (table === 'teacher_point_history') {
              return {
                data: ptRows.filter((p) => (!filters.user_id || p.user_id === filters.user_id) && (!filters.date || p.date === filters.date) && (!filters.activity_type || p.activity_type === filters.activity_type)),
                error: null,
              };
            }
            return { data: [], error: null };
          };
          const chain: any = {
            select: () => chain,
            eq: (col: string, val: any) => {
              filters[col] = val;
              if (updatePayload && table === 'attendance' && col === 'id') {
                const idx = attRows.findIndex((r) => r.id === val);
                if (idx >= 0) attRows[idx] = { ...attRows[idx], ...updatePayload };
                return Promise.resolve({ error: null });
              }
              return chain;
            },
            lte: () => chain,
            gte: () => chain,
            update: (payload: any) => { updatePayload = payload; return chain; },
            insert: (payload: any) => {
              if (table === 'teacher_point_history') ptRows.push(payload);
              return Promise.resolve({ data: payload, error: null });
            },
            maybeSingle: async () => {
              const res = execSelect();
              return { data: res.data?.[0] || null, error: null };
            },
            then: (resolve: any, reject?: any) => Promise.resolve(execSelect()).then(resolve, reject),
          };
          return chain;
        },
      });

      const masterOffCron = await runAutoCheckout(
        buildCfgCronSupabase([{ key: 'auto_attendance_enabled', value: 'false' }], [], []),
        { targetDateStr: '2026-11-25' }
      );
      const coOffCron = await runAutoCheckout(
        buildCfgCronSupabase(
          [
            { key: 'auto_attendance_enabled', value: 'true' },
            { key: 'auto_checkout_enabled', value: 'false' },
          ],
          [],
          []
        ),
        { targetDateStr: '2026-11-25' }
      );

      const forceRows = [
        {
          id: 'att_cfg_fri',
          user_id: 'u_cfg_1',
          date: '2026-11-27',
          status: 'HADIR',
          check_in_time: '07:10:00',
          check_out_time: null,
          verification_method: 'QR_GPS',
          attendance_source: 'QR',
          notes: '',
        },
      ];
      const forcePts: any[] = [];
      const customForceCron = await runAutoCheckout(
        buildCfgCronSupabase(
          [
            { key: 'auto_attendance_enabled', value: 'true' },
            { key: 'auto_checkout_enabled', value: 'false' },
            { key: 'auto_checkout_time_mode', value: 'CUSTOM' },
            { key: 'auto_checkout_custom_friday_time', value: '11:25' },
            { key: 'auto_checkout_points', value: '5' },
            { key: 'auto_attendance_skip_holidays', value: 'false' },
            { key: 'auto_attendance_skip_leaves', value: 'false' },
            { key: 'auto_checkout_preserve_checkin_source', value: 'false' },
          ],
          forceRows,
          forcePts
        ),
        { targetDateStr: '2026-11-27', forceRun: true }
      );

      await mockProvider.updateSettings({
        ...DEFAULT_SYSTEM_SETTINGS,
        auto_attendance_enabled: false,
      }, 'MOCK_ADMIN_TOKEN');
      const mockRunDisabled = await mockProvider.runServerAutoCheckout('2026-11-25', 'MOCK_ADMIN_TOKEN');

      assert(
        'AutoAttendance 19: Server runAutoCheckout & MockProvider honor master/checkout switches, forceRun, CUSTOM Friday time, skip flags, points, and preserve_source=false',
        masterOffCron.skippedReason === 'DISABLED_BY_SETTINGS' &&
          coOffCron.skippedReason === 'AUTO_CHECKOUT_DISABLED' &&
          customForceCron.processedCount === 1 &&
          customForceCron.checkoutTimeApplied === '11:25:00' &&
          customForceCron.pointsAwardedPerTeacher === 5 &&
          forceRows[0].check_out_time === '11:25:00' &&
          forceRows[0].verification_method === 'SYSTEM_AUTO' &&
          forceRows[0].attendance_source === 'SYSTEM_AUTO' &&
          forcePts[0]?.points === 5 &&
          mockRunDisabled.skippedReason === 'DISABLED_BY_SETTINGS',
        `master=${masterOffCron.skippedReason}, co=${coOffCron.skippedReason}, out=${forceRows[0].check_out_time}, pts=${forcePts[0]?.points}, mockDis=${mockRunDisabled.skippedReason}`
      );

      // ── Test 20: Dedicated section save via useSettingsStore preserves non-auto settings while persisting Auto Absen rules
      await useSettingsStore.getState().updateSettings(
        {
          ...DEFAULT_SYSTEM_SETTINGS,
          geofence_radius: 750,
          work_checkin_start: '06:15',
        },
        'MOCK_ADMIN_TOKEN'
      );
      const currentBase = useSettingsStore.getState().settings;
      await useSettingsStore.getState().updateSettings(
        {
          ...currentBase,
          auto_checkout_time_mode: 'CUSTOM',
          auto_checkout_custom_time: '15:30',
          auto_checkout_points: 4,
          auto_attendance_allow_override_scan: false,
        },
        'MOCK_ADMIN_TOKEN'
      );
      const afterPartialSave = await mockProvider.getSettings();
      assert(
        'AutoAttendance 20: Section save via useSettingsStore updates Auto Absen rules without losing geofence or work schedule settings',
        afterPartialSave.geofence_radius === 750 &&
          afterPartialSave.work_checkin_start === '06:15' &&
          afterPartialSave.auto_checkout_time_mode === 'CUSTOM' &&
          afterPartialSave.auto_checkout_custom_time === '15:30' &&
          afterPartialSave.auto_checkout_points === 4 &&
          afterPartialSave.auto_attendance_allow_override_scan === false,
        `radius=${afterPartialSave.geofence_radius}, in=${afterPartialSave.work_checkin_start}, co=${afterPartialSave.auto_checkout_custom_time}, pts=${afterPartialSave.auto_checkout_points}`
      );
    } finally {
      await useSettingsStore.getState().updateSettings({ ...DEFAULT_SYSTEM_SETTINGS }, 'MOCK_ADMIN_TOKEN');
    }
  } finally {
    useAuthStore.setState(prevAuthState);
  }

  return { passed, failed, results };
};
