import { ExcelReportGenerator } from '../lib/excel-generator.lib';
import type { MultiSheetReportPayload } from '../lib/excel-generator.lib';
import { AnalyticsService } from './analytics.service';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog } from '../types/database.types';
import { getTodayDateInJakarta, getMonthWorkingDays, parseIndonesianMonth } from '../utils/time.utils';

export class ReportService {
  public static preparePayload(
    month: string,
    year: string,
    teachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    auditLogs: AuditLog[]
  ): MultiSheetReportPayload {
    const workingDaysInfo = getMonthWorkingDays(month, year, true);
    const monthNumber = parseIndonesianMonth(month);
    const monthPrefix = `${year}-${String(monthNumber).padStart(2, '0')}`;

    const activeTeachers = AnalyticsService.getAttendanceEligibleUsers(teachers);
    const totalTeachers = activeTeachers.length;
    const effectiveDays = Math.max(1, workingDaysInfo.effectiveWorkingDays);
    const totalExpectedCapacity = totalTeachers * effectiveDays;

    const monthlyAttendance = attendanceRecords.filter(
      (r) => r.date && r.date.startsWith(monthPrefix)
    );

    let totalPresent = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalSick = 0;
    let totalOfficialDuty = 0;

    for (const rec of monthlyAttendance) {
      if (rec.status === 'HADIR') totalPresent++;
      else if (rec.status === 'TERLAMBAT') totalLate++;
      else if (rec.status === 'IZIN') totalLeave++;
      else if (rec.status === 'SAKIT') totalSick++;
      else if (rec.status === 'DINAS_LUAR') totalOfficialDuty++;
    }

    const totalActualMasuk = totalPresent + totalLate;
    const totalAccounted = totalActualMasuk + totalLeave + totalSick + totalOfficialDuty;
    const totalUnabsented = Math.max(0, totalExpectedCapacity - totalAccounted);
    const attendancePercentage =
      totalExpectedCapacity > 0
        ? Math.min(100, Math.round((totalActualMasuk / totalExpectedCapacity) * 1000) / 10)
        : 0;

    const summary = {
      date: getTodayDateInJakarta(),
      totalTeachers,
      totalPresent,
      totalLate,
      totalLeave,
      totalSick,
      totalOfficialDuty,
      totalUnabsented,
      attendancePercentage,
    };

    return {
      month,
      year,
      summary,
      teachers,
      attendanceRecords,
      leaveRequests,
      auditLogs,
      workingDaysInfo,
    };
  }

  /**
   * Generates and triggers download for Native 5-Sheet Excel (.xlsx) Report (Master School)
   */
  public static async generateAndDownloadMonthlyReport(
    month: string,
    year: string,
    teachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    auditLogs: AuditLog[]
  ): Promise<boolean> {
    const payload = this.preparePayload(month, year, teachers, attendanceRecords, leaveRequests, auditLogs);
    ExcelReportGenerator.generateMultiSheetXLSX(payload);
    return true;
  }

  /**
   * Generates and opens a styled printable PDF Report in a popup window (Master School)
   */
  public static async generateAndPrintPDFReport(
    month: string,
    year: string,
    teachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    auditLogs: AuditLog[]
  ): Promise<boolean> {
    const payload = this.preparePayload(month, year, teachers, attendanceRecords, leaveRequests, auditLogs);
    ExcelReportGenerator.generatePrintablePDF(payload);
    return true;
  }

  /**
   * Generates Individual Teacher Attendance Report in PDF
   */
  public static async generateAndPrintIndividualPDFReport(
    teacher: UserProfile,
    month: string,
    year: string,
    attendanceRecords: AttendanceRecord[]
  ): Promise<boolean> {
    ExcelReportGenerator.generateIndividualTeacherPDF(teacher, month, year, attendanceRecords);
    return true;
  }

  /**
   * Generates Individual Teacher Attendance Report in Excel (.xlsx)
   */
  public static async generateAndDownloadIndividualReport(
    teacher: UserProfile,
    month: string,
    year: string,
    attendanceRecords: AttendanceRecord[]
  ): Promise<boolean> {
    ExcelReportGenerator.generateIndividualTeacherXLSX(teacher, month, year, attendanceRecords);
    return true;
  }
}
