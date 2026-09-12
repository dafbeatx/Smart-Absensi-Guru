/**
 * SMART ABSENSI GURU - ATTENDANCE REPORT IN-PAGE VIEW & AGGREGATION TEST SUITE
 */

import { ReportService } from '../report.service';
import { ExcelReportGenerator, SIGNATORY_OFFICIALS } from '../../lib/excel-generator.lib';
import type { UserProfile, AttendanceRecord, LeaveRequest, HolidayRecord } from '../../types/database.types';

export const runAttendanceReportViewTestSuite = async (): Promise<{
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

  try {
    const mockTeachers: UserProfile[] = [
      {
        id: 'usr_t1',
        nip: '198501012010011001',
        full_name: 'Drs. Suparman, M.Pd.',
        phone_number: '081234567890',
        role: 'GURU',
        position: 'Guru Fisika Senior',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_t2',
        nip: '199002022015022002',
        full_name: 'Siti Aminah, S.Pd.',
        phone_number: '081234567891',
        role: 'GURU',
        position: 'Guru Biologi',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    const mockAttendance: AttendanceRecord[] = [
      {
        id: 'att_1',
        user_id: 'usr_t1',
        date: '2026-09-01',
        check_in_time: '06:55:00',
        check_out_time: '14:05:00',
        status: 'HADIR',
        check_in_lat: -6.123456,
        check_in_lng: 106.123456,
        check_in_distance_meters: 15,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        is_offline: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'att_2',
        user_id: 'usr_t1',
        date: '2026-09-02',
        check_in_time: '07:20:00',
        check_out_time: '14:00:00',
        status: 'TERLAMBAT',
        check_in_lat: -6.123456,
        check_in_lng: 106.123456,
        check_in_distance_meters: 22,
        verification_method: 'QR_GPS',
        attendance_source: 'QR',
        is_offline: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'att_3',
        user_id: 'usr_t2',
        date: '2026-09-01',
        check_in_time: '06:50:00',
        check_out_time: '14:10:00',
        status: 'HADIR',
        check_in_lat: -6.123456,
        check_in_lng: 106.123456,
        check_in_distance_meters: 10,
        verification_method: 'BIOMETRIC_GPS',
        attendance_source: 'BIOMETRIC',
        is_offline: false,
        created_at: new Date().toISOString(),
      },
    ];

    const mockLeaves: LeaveRequest[] = [
      {
        id: 'leave_1',
        user_id: 'usr_t2',
        teacher_name: 'Siti Aminah, S.Pd.',
        leave_type: 'SAKIT',
        start_date: '2026-09-02',
        end_date: '2026-09-03',
        reason: 'Demam dan flu berobat ke klinik',
        attachment_url: null,
        approval_status: 'APPROVED',
        approval_deadline: '2026-09-05T00:00:00Z',
        approved_by: 'Kepala Sekolah',
        created_at: '2026-09-02T07:00:00.000Z',
      },
    ];

    const mockHolidays: HolidayRecord[] = [];

    // Test 1: Monthly payload computation
    const payload = ReportService.preparePayload(
      'September',
      '2026',
      mockTeachers,
      mockAttendance,
      mockLeaves,
      [],
      mockHolidays
    );

    assert(
      'Report View - Computes Monthly Report Payload Accurately',
      payload !== null &&
      payload.month === 'September' &&
      payload.year === '2026' &&
      payload.summary.totalTeachers === 2 &&
      payload.summary.totalPresent >= 2 &&
      payload.summary.totalLate >= 1 &&
      payload.summary.attendancePercentage > 0,
      `Present: ${payload.summary.totalPresent}, Late: ${payload.summary.totalLate}, Pct: ${payload.summary.attendancePercentage}%`
    );

    // Test 2: Signatory officials consistency
    assert(
      'Report View - Formats Official Signatory Officials Correctly',
      SIGNATORY_OFFICIALS.KEPSEK_NAME === 'Farhan Sopian Sahid, S.Pd.I' &&
      SIGNATORY_OFFICIALS.TU_NAME === 'Mira Nurdianti, S.Pd',
      `Kepsek: ${SIGNATORY_OFFICIALS.KEPSEK_NAME}, TU: ${SIGNATORY_OFFICIALS.TU_NAME}`
    );

    // Test 3: Printable PDF HTML with Letterhead & Signatures
    const html = ExcelReportGenerator.getPrintablePDFHTML(payload);
    assert(
      'Report View - Generates Printable PDF HTML Containing Letterhead and Signatures',
      html.includes('Farhan Sopian Sahid, S.Pd.I') &&
      html.includes('Mira Nurdianti, S.Pd') &&
      html.includes('Drs. Suparman, M.Pd.') &&
      html.includes('Siti Aminah, S.Pd.') &&
      html.includes('198501012010011001') &&
      html.includes('September 2026'),
      'Letterhead, teacher list, and official signatures validated'
    );

    // Test 4: Individual Teacher PDF HTML
    const indHtml = ExcelReportGenerator.getIndividualTeacherPDFHTML(
      mockTeachers[0],
      'September',
      '2026',
      mockAttendance,
      mockLeaves,
      mockHolidays
    );

    assert(
      'Report View - Generates Individual Teacher PDF HTML Accurately',
      indHtml.includes('Drs. Suparman, M.Pd.') &&
      indHtml.includes('198501012010011001') &&
      indHtml.includes('LAPORAN PRESENSI INDIVIDU GURU'),
      'Individual teacher name, NPP, and report title verified'
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    assert('Report View - Test Execution Error', false, errMsg);
  }

  return { passed, failed, results };
};
