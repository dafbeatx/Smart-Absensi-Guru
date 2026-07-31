import { ExcelReportGenerator } from '../lib/excel-generator.lib';
import type { MultiSheetReportPayload } from '../lib/excel-generator.lib';
import { AnalyticsService } from './analytics.service';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog } from '../types/database.types';

export class ReportService {
  private static preparePayload(
    month: string,
    year: string,
    teachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    auditLogs: AuditLog[]
  ): MultiSheetReportPayload {
    const todayStr = new Date().toISOString().split('T')[0];
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
   * Generates and triggers download for Native 5-Sheet Excel (.xlsx) Report
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
   * Generates and opens a styled printable PDF Report in a popup window
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
}
