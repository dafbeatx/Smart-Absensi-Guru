import { ExcelReportGenerator, isTeacherLeaveMatch, isTeacherRecordMatch } from '../lib/excel-generator.lib';
import type { MultiSheetReportPayload } from '../lib/excel-generator.lib';
import { AnalyticsService } from './analytics.service';
import type { AttendanceRecord, LeaveRequest, UserProfile, AuditLog } from '../types/database.types';
import { getTodayDateInJakarta, getMonthWorkingDays, parseIndonesianMonth, isDateOffDay } from '../utils/time.utils';

export class ReportService {
  public static preparePayload(
    month: string,
    year: string,
    teachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[] = [],
    auditLogs: AuditLog[] = []
  ): MultiSheetReportPayload {
    const workingDaysInfo = getMonthWorkingDays(month, year, true);
    const monthNumber = parseIndonesianMonth(month);
    const yearNum = parseInt(year, 10) || new Date().getFullYear();
    const todayDateStr = getTodayDateInJakarta();

    const activeTeachers = AnalyticsService.getAttendanceEligibleUsers(teachers);
    const totalTeachers = activeTeachers.length;
    const effectiveDays = Math.max(1, workingDaysInfo.effectiveWorkingDays);
    const totalExpectedCapacity = totalTeachers * effectiveDays;

    // Gather all leaves from arguments and localStorage if available
    const allLeaves: LeaveRequest[] = [...leaveRequests];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_leaves');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (!allLeaves.some((existing) => existing.id === item.id)) {
                allLeaves.push(item);
              }
            }
          }
        }
      } catch (e) {}
    }

    let totalPresent = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalSick = 0;
    let totalOfficialDuty = 0;
    let totalAlfa = 0;
    let totalPendingLeave = 0;

    // Days in Month for accurate day-by-day calculation
    const daysInMonth = new Date(yearNum, monthNumber, 0).getDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${yearNum}-${String(monthNumber).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const offCheck = isDateOffDay(dateStr);
      if (offCheck.isOff || dateStr > todayDateStr) {
        continue; // Skip holidays, weekends, and future days
      }

      for (const teacher of activeTeachers) {
        const rec = attendanceRecords.find((r) => r.date === dateStr && isTeacherRecordMatch(teacher, r));
        const leave = allLeaves.find((l) => {
          if (!isTeacherLeaveMatch(teacher, l)) return false;
          const start = (l.start_date || '').substring(0, 10);
          const end = (l.end_date || '').substring(0, 10);
          return start <= dateStr && dateStr <= end;
        });

        if (rec) {
          if (rec.status === 'HADIR') totalPresent++;
          else if (rec.status === 'TERLAMBAT') totalLate++;
          else if (rec.status === 'SAKIT') totalSick++;
          else if (rec.status === 'DINAS_LUAR') totalOfficialDuty++;
          else if (rec.status === 'IZIN') totalLeave++;
          else if (rec.status === 'ALFA') totalAlfa++;
        } else if (leave) {
          if (leave.approval_status === 'PENDING' || leave.approval_status === 'SUBMITTED' || leave.approval_status === 'UNDER_REVIEW') {
            totalPendingLeave++;
          }
          if (leave.leave_type === 'SAKIT') totalSick++;
          else if (leave.leave_type === 'DINAS_LUAR') totalOfficialDuty++;
          else if (leave.leave_type === 'CUTI' || leave.leave_type === 'IZIN') totalLeave++;
          else if (leave.leave_type === 'KOREKSI_ABSEN') totalPresent++;
        } else {
          totalAlfa++;
        }
      }
    }

    const totalActualMasuk = totalPresent + totalLate;
    const totalAccounted = totalActualMasuk + totalLeave + totalSick + totalOfficialDuty;
    const totalUnabsented = Math.max(0, totalExpectedCapacity - totalAccounted);
    const attendancePercentage =
      totalExpectedCapacity > 0
        ? Math.min(100, Math.round((totalActualMasuk / totalExpectedCapacity) * 1000) / 10)
        : 0;

    const summary = {
      date: todayDateStr,
      totalTeachers,
      totalPresent,
      totalLate,
      totalLeave,
      totalSick,
      totalOfficialDuty,
      totalPendingLeave,
      totalAlfa,
      totalUnabsented,
      attendancePercentage,
    };

    return {
      month,
      year,
      summary,
      teachers: activeTeachers.length > 0 ? activeTeachers : teachers,
      attendanceRecords,
      leaveRequests: allLeaves,
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
    leaveRequests: LeaveRequest[] = [],
    auditLogs: AuditLog[] = []
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
    leaveRequests: LeaveRequest[] = [],
    auditLogs: AuditLog[] = []
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
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[] = []
  ): Promise<boolean> {
    ExcelReportGenerator.generateIndividualTeacherPDF(teacher, month, year, attendanceRecords, leaveRequests);
    return true;
  }

  /**
   * Generates Individual Teacher Attendance Report in Excel (.xlsx)
   */
  public static async generateAndDownloadIndividualReport(
    teacher: UserProfile,
    month: string,
    year: string,
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[] = []
  ): Promise<boolean> {
    ExcelReportGenerator.generateIndividualTeacherXLSX(teacher, month, year, attendanceRecords, leaveRequests);
    return true;
  }
}
