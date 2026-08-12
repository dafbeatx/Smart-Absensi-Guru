import type { AttendanceRecord, HolidayRecord, LeaveRequest, SystemSettings, UserProfile } from '../types/database.types';
import { evaluateAttendanceStatus, isDateOffDay } from '../utils/time.utils';
import { CONSTANTS } from '../config/constants';

export interface DailyAttendanceSummary {
  date: string;
  totalTeachers: number;
  totalPresent: number;
  totalLate: number;
  totalLeave: number;
  totalSick: number;
  totalOfficialDuty: number;
  totalUnabsented: number;
  attendancePercentage: number;
}

export interface AttendanceTrendPoint {
  label: string; // e.g. "Senin", "Minggu 1", or "Tgl 01"
  presentCount: number;
  lateCount: number;
  absentCount: number;
  percentage: number;
}

export interface ExecutiveDashboardAnalytics {
  dailySummary: DailyAttendanceSummary;
  weeklyTrend: AttendanceTrendPoint[];
  monthlyPercentage: number;
  pendingApprovalsCount: number;
  unabsentedTeachers: UserProfile[];
}

export class AnalyticsService {
  /**
   * Helper to filter active teachers expected to take daily attendance
   * (is_active !== false && (role === 'GURU' || !role))
   */
  public static getAttendanceEligibleUsers(allTeachers: UserProfile[]): UserProfile[] {
    return (allTeachers || []).filter(
      (t) => t.is_active !== false && (t.role === 'GURU' || (!t.role as boolean))
    );
  }

  /**
   * Calculates real-time daily attendance metrics and statistics
   */
  public static calculateDailySummary(
    dateStr: string,
    allTeachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    systemSettings?: SystemSettings | null,
    holidays?: HolidayRecord[] | null
  ): DailyAttendanceSummary {
    const activeTeachers = this.getAttendanceEligibleUsers(allTeachers);
    const totalTeachers = activeTeachers.length;
    let totalPresent = 0;
    let totalLate = 0;
    let totalLeave = 0;
    let totalSick = 0;
    let totalOfficialDuty = 0;

    const userAttendanceMap = new Map<string, AttendanceRecord>();

    for (const rec of attendanceRecords) {
      if (rec.date === dateStr) {
        userAttendanceMap.set(rec.user_id, rec);
      }
    }

    const checkinEnd = systemSettings?.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

    userAttendanceMap.forEach((rec) => {
      const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, checkinEnd, rec.status);
      if (effectiveStatus === 'HADIR') totalPresent++;
      else if (effectiveStatus === 'TERLAMBAT') totalLate++;
      else if (effectiveStatus === 'IZIN') totalLeave++;
      else if (effectiveStatus === 'SAKIT') totalSick++;
      else if (effectiveStatus === 'DINAS_LUAR') totalOfficialDuty++;
    });

    for (const leave of leaveRequests) {
      if (leave.approval_status === 'APPROVED' && !userAttendanceMap.has(leave.user_id)) {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const target = new Date(dateStr);

        if (target >= start && target <= end) {
          if (leave.leave_type === 'SAKIT') totalSick++;
          else if (leave.leave_type === 'IZIN') totalLeave++;
          else if (leave.leave_type === 'DINAS_LUAR') totalOfficialDuty++;
        }
      }
    }

    const totalAccountedFor = totalPresent + totalLate + totalSick + totalLeave + totalOfficialDuty;
    const offCheck = isDateOffDay(dateStr, systemSettings, holidays);
    
    // On Weekend / Holiday, unabsented is 0 because there is no expectation of attendance
    const totalUnabsented = offCheck.isOff ? 0 : Math.max(0, totalTeachers - totalAccountedFor);

    const rawPercentage = totalTeachers > 0
      ? Math.round(((totalPresent + totalLate) / totalTeachers) * 1000) / 10
      : 0;

    const attendancePercentage = Math.min(100, Math.max(0, rawPercentage));

    return {
      date: dateStr,
      totalTeachers,
      totalPresent,
      totalLate,
      totalLeave,
      totalSick,
      totalOfficialDuty,
      totalUnabsented,
      attendancePercentage,
    };
  }

  /**
   * Identifies list of teachers who have not checked in yet today.
   * Returns empty array [] on Weekends (Sabtu/Minggu) or Holidays.
   */
  public static getUnabsentedTeachers(
    dateStr: string,
    allTeachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    systemSettings?: SystemSettings | null,
    holidays?: HolidayRecord[] | null
  ): UserProfile[] {
    const offCheck = isDateOffDay(dateStr, systemSettings, holidays);
    if (offCheck.isOff) {
      return [];
    }

    const activeUserIds = new Set<string>();
    const checkinEnd = systemSettings?.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

    for (const rec of attendanceRecords) {
      if (rec.date === dateStr) {
        const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, checkinEnd, rec.status);
        if (rec.check_in_time || effectiveStatus === 'HADIR' || effectiveStatus === 'TERLAMBAT' || effectiveStatus === 'IZIN' || effectiveStatus === 'SAKIT' || effectiveStatus === 'DINAS_LUAR') {
          activeUserIds.add(rec.user_id);
        }
      }
    }

    for (const leave of leaveRequests) {
      if (leave.approval_status === 'APPROVED') {
        const start = new Date(leave.start_date);
        const end = new Date(leave.end_date);
        const target = new Date(dateStr);
        if (target >= start && target <= end) {
          activeUserIds.add(leave.user_id);
        }
      }
    }

    const activeTeachers = this.getAttendanceEligibleUsers(allTeachers);
    return activeTeachers.filter((t) => !activeUserIds.has(t.id));
  }
}
