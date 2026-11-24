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

  // ── Test 1: autoAttendTeacher with mode: CHECK_IN creates record with status TERLAMBAT, check_in_time set, check_out_time null, 0 points
  const autoRecord = await mockProvider.autoAttendTeacher({
    user_id: testTeacher1.id,
    date: activeDate,
    teacher_name: testTeacher1.full_name,
    mode: 'CHECK_IN',
  });

  assert(
    'AutoAttendance 1: autoAttendTeacher with CHECK_IN creates record with status TERLAMBAT, SYSTEM_AUTO source, check_in_time set, check_out null',
    autoRecord.status === 'TERLAMBAT' &&
      autoRecord.verification_method === 'SYSTEM_AUTO' &&
      autoRecord.attendance_source === 'SYSTEM_AUTO' &&
      autoRecord.is_auto_attendance === true &&
      Boolean(autoRecord.check_in_time) &&
      !autoRecord.check_out_time &&
      autoRecord.notes?.includes('0 Poin') === true,
    `Status: ${autoRecord.status}, In: ${autoRecord.check_in_time}, Out: ${autoRecord.check_out_time}, Notes: ${autoRecord.notes}`
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

  return { passed, failed, results };
};
