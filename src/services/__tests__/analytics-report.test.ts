/**
 * SMART ABSENSI GURU - ANALYTICS & REPORT ENGINE TEST SUITE
 */

import { AnalyticsService } from '../analytics.service';
import { ExcelReportGenerator } from '../../lib/excel-generator.lib';
import type { MultiSheetReportPayload } from '../../lib/excel-generator.lib';
import { DashboardCacheService } from '../dashboard-cache.service';
import type { UserProfile, AttendanceRecord, LeaveRequest, AuditLog } from '../../types/database.types';

export const runAnalyticsReportTestSuite = async (): Promise<{
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

  const mockTeachers: UserProfile[] = [
    { id: 'usr_1', nip: '198501', full_name: 'Ahmad Hidayat', phone_number: '081', role: 'GURU', position: 'Matematika', avatar_url: null, is_active: true, created_at: '' },
    { id: 'usr_2', nip: '198502', full_name: 'Budi Santoso', phone_number: '082', role: 'GURU', position: 'Fisika', avatar_url: null, is_active: true, created_at: '' },
    { id: 'usr_3', nip: '198503', full_name: 'Siti Rahma', phone_number: '083', role: 'GURU', position: 'Biologi', avatar_url: null, is_active: true, created_at: '' },
  ];

  const mockAttendance: AttendanceRecord[] = [
    { id: 'att_1', user_id: 'usr_1', date: '2026-07-30', check_in_time: '06:55', check_out_time: null, status: 'HADIR', check_in_lat: -6.2, check_in_lng: 106.8, check_in_distance_meters: 12, verification_method: 'QR_GPS', attendance_source: 'QR', is_offline: false, created_at: '' },
    { id: 'att_2', user_id: 'usr_2', date: '2026-07-30', check_in_time: '07:45', check_out_time: null, status: 'TERLAMBAT', check_in_lat: -6.2, check_in_lng: 106.8, check_in_distance_meters: 15, verification_method: 'QR_GPS', attendance_source: 'QR', is_offline: false, created_at: '' },
  ];

  const mockLeave: LeaveRequest[] = [];
  const mockAudit: AuditLog[] = [];

  // Test 1: Daily Summary Analytics Calculation
  const summary = AnalyticsService.calculateDailySummary('2026-07-30', mockTeachers, mockAttendance, mockLeave);
  assert(
    'Analytics - Calculate Daily Attendance Metrics',
    summary.totalTeachers === 3 && summary.totalPresent === 1 && summary.totalLate === 1 && summary.totalUnabsented === 1 && summary.attendancePercentage === 66.7
  );

  // Test 2: Unabsented Teachers List Filtering
  const unabsented = AnalyticsService.getUnabsentedTeachers('2026-07-30', mockTeachers, mockAttendance, mockLeave);
  assert(
    'Analytics - Filter Unabsented Teachers Correctly',
    unabsented.length === 1 && unabsented[0].id === 'usr_3'
  );

  // Test 2b: Exclude Inactive Teachers and Non-Attendance Roles (OPERATOR) from Unabsented Calculation
  const mixedTeachers: UserProfile[] = [
    ...mockTeachers,
    { id: 'usr_inactive', nip: '198504', full_name: 'Guru Nonaktif', phone_number: '084', role: 'GURU', position: 'IPS', avatar_url: null, is_active: false, created_at: '' },
    { id: 'usr_operator', nip: '198505', full_name: 'Operator System', phone_number: '085', role: 'OPERATOR', position: 'IT Operator', avatar_url: null, is_active: true, created_at: '' },
    { id: 'usr_admin', nip: '198506', full_name: 'Admin Web', phone_number: '086', role: 'ADMIN', position: 'IT Admin', avatar_url: null, is_active: true, created_at: '' },
  ];
  const mockAttendanceWithAdmin: AttendanceRecord[] = [
    ...mockAttendance,
    { id: 'att_admin', user_id: 'usr_admin', date: '2026-07-30', check_in_time: '07:15:00', check_out_time: null, status: 'HADIR', check_in_lat: -6.2, check_in_lng: 106.8, check_in_distance_meters: 10, verification_method: 'QR_GPS', attendance_source: 'QR', is_offline: false, created_at: '' },
  ];
  const unabsentedMixed = AnalyticsService.getUnabsentedTeachers('2026-07-30', mixedTeachers, mockAttendanceWithAdmin, mockLeave);
  assert(
    'Analytics - Excludes Inactive & Non-Guru Users from Unabsented List',
    unabsentedMixed.length === 1 && unabsentedMixed[0].id === 'usr_3'
  );

  // Test 3: 5-Sheet Excel Data Generation & Signatory Official Sync
  const reportPayload: MultiSheetReportPayload = {
    month: 'Juli',
    year: '2026',
    summary,
    teachers: mockTeachers,
    attendanceRecords: mockAttendance,
    leaveRequests: mockLeave,
    auditLogs: mockAudit,
  };
  const csvContent = ExcelReportGenerator.generateMultiSheetCSVData(reportPayload);
  assert(
    'Report Engine - 5-Sheet CSV Multi-Sheet Formatting',
    csvContent.includes('SHEET 1: DASHBOARD RINGKASAN') &&
    csvContent.includes('SHEET 2: REKAP KEHADIRAN GURU') &&
    csvContent.includes('SHEET 3: DETAIL HARIAN TRANSAKSI') &&
    csvContent.includes('SHEET 4: PENGAJUAN IZIN') &&
    csvContent.includes('SHEET 5: AUDIT LOG RINGKAS') &&
    csvContent.includes('Farhan Sopian Sahid, S.Pd.I') &&
    csvContent.includes('Mira Nurdianti, S.Pd')
  );

  // Test 4: Dashboard Cache Expiration Rule
  DashboardCacheService.set('TEST_METRIC', { present: 42 }, 0.001); // ~0.06 seconds TTL
  const activeCache = DashboardCacheService.get<{ present: number }>('TEST_METRIC');
  assert('Dashboard Cache - Set and Instant Fetch', activeCache?.present === 42);

  // Test 5: Admin Corrected Attendance with Status IZIN Sync
  const correctedAttendance: AttendanceRecord[] = [
    ...mockAttendance,
    { id: 'att_3', user_id: 'usr_3', date: '2026-07-30', check_in_time: null, check_out_time: null, status: 'IZIN', check_in_lat: 0, check_in_lng: 0, check_in_distance_meters: 0, verification_method: 'MANUAL_OPERATOR', attendance_source: 'MANUAL', is_offline: false, created_at: '' }
  ];
  const summaryCorrected = AnalyticsService.calculateDailySummary('2026-07-30', mockTeachers, correctedAttendance, mockLeave);
  const unabsentedCorrected = AnalyticsService.getUnabsentedTeachers('2026-07-30', mockTeachers, correctedAttendance, mockLeave);
  assert(
    'Analytics - Admin Corrected Attendance Status IZIN Sync',
    summaryCorrected.totalLeave === 1 && summaryCorrected.totalUnabsented === 0 && unabsentedCorrected.length === 0
  );

  return { passed, failed, results };
};
