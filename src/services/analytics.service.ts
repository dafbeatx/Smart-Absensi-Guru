import type { AttendanceRecord, LeaveRequest, UserProfile } from '../types/database.types';
import { evaluateAttendanceStatus } from '../utils/time.utils';

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
   * Calculates real-time daily attendance metrics and statistics
   */
  public static calculateDailySummary(
    dateStr: string,
    allTeachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[]
  ): DailyAttendanceSummary {
    const totalTeachers = allTeachers.length;
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

    userAttendanceMap.forEach((rec) => {
      const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, '07:15', rec.status);
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
    const totalUnabsented = Math.max(0, totalTeachers - totalAccountedFor);

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
   * Identifies list of teachers who have not checked in yet today
   */
  public static getUnabsentedTeachers(
    dateStr: string,
    allTeachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[]
  ): UserProfile[] {
    const activeUserIds = new Set<string>();

    for (const rec of attendanceRecords) {
      if (rec.date === dateStr) {
        const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, '07:15', rec.status);
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

    return allTeachers.filter((t) => t.is_active && !activeUserIds.has(t.id));
  }
}
