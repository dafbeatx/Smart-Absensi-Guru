import { ExcelReportGenerator } from '../lib/excel-generator.lib';
import type { MultiSheetReportPayload } from '../lib/excel-generator.lib';
import { AnalyticsService } from './analytics.service';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog } from '../types/database.types';
import { getTodayDateInJakarta } from '../utils/time.utils';

export class ReportService {
  private static preparePayload(
    month: string,
    year: string,
    teachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    auditLogs: AuditLog[]
  ): MultiSheetReportPayload {
    const todayStr = getTodayDateInJakarta();
    const summary = AnalyticsService.calculateDailySummary(
      todayStr,
      teachers,
      attendanceRecords,
      leaveRequests
    );

    return {
      month,
      year,
      summary,
      teachers,
      attendanceRecords,
      leaveRequests,
      auditLogs,
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
