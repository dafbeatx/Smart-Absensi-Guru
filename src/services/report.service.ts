import { ExcelReportGenerator } from '../lib/excel-generator.lib';
import type { MultiSheetReportPayload } from '../lib/excel-generator.lib';
import { AnalyticsService } from './analytics.service';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog } from '../types/database.types';

export class ReportService {
  /**
   * Generates and triggers download for 5-Sheet Monthly Report
   */
  public static async generateAndDownloadMonthlyReport(
    month: string,
    year: string,
    teachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    auditLogs: AuditLog[]
  ): Promise<boolean> {
    const todayStr = new Date().toISOString().split('T')[0];

    // Calculate Summary via AnalyticsService
    const summary = AnalyticsService.calculateDailySummary(
      todayStr,
      teachers,
      attendanceRecords,
      leaveRequests
    );

    const payload: MultiSheetReportPayload = {
      month,
      year,
      summary,
      teachers,
      attendanceRecords,
      leaveRequests,
      auditLogs,
    };

    const csvContent = ExcelReportGenerator.generateMultiSheetCSVData(payload);
    const fileName = `Laporan_SmartAbsensi_${month}_${year}.csv`;

    ExcelReportGenerator.triggerDownload(csvContent, fileName);
    return true;
  }
}
