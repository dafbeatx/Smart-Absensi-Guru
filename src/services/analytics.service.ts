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
   * Helper to filter active users expected to take daily attendance
   * (is_active !== false && (role === 'GURU' || role === 'KEPSEK' || role === 'ADMIN' || !role))
   */
  public static getAttendanceEligibleUsers(allTeachers: UserProfile[]): UserProfile[] {
    return (allTeachers || []).filter(
      (t) =>
        t.is_active !== false &&
        (t.role === 'GURU' || t.role === 'KEPSEK' || t.role === 'ADMIN' || (!t.role as boolean))
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

    const accountedUserIds = new Set<string>();

    // 1. Process Approved Leaves FIRST (Highest Priority for accounting)
    for (const leave of leaveRequests) {
      const isApproved =
        leave.approval_status === 'APPROVED' || (leave as any).status === 'APPROVED';
      if (isApproved) {
        const startStr = (leave.start_date || '').substring(0, 10);
        const endStr = (leave.end_date || '').substring(0, 10);

        if (startStr <= dateStr && dateStr <= endStr) {
          accountedUserIds.add(leave.user_id);
          if (leave.leave_type === 'SAKIT') {
            totalSick++;
          } else if (leave.leave_type === 'DINAS_LUAR') {
            totalOfficialDuty++;
          } else if (leave.leave_type === 'KOREKSI_ABSEN') {
            const reasonText = leave.reason || '';
            if (reasonText.includes('menjadi SAKIT')) {
              totalSick++;
            } else if (reasonText.includes('menjadi DINAS_LUAR')) {
              totalOfficialDuty++;
            } else if (reasonText.includes('menjadi IZIN')) {
              totalLeave++;
            } else {
              totalPresent++;
            }
          } else {
            totalLeave++;
          }
        }
      }
    }

    // 2. Process remaining attendance records for personnel without approved leaves
    const checkinEnd =
      systemSettings?.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

    userAttendanceMap.forEach((rec, uId) => {
      if (accountedUserIds.has(uId)) return;

      const effectiveStatus = evaluateAttendanceStatus(
        rec.check_in_time,
        checkinEnd,
        rec.status
      );

      if (effectiveStatus === 'HADIR') {
        totalPresent++;
        accountedUserIds.add(uId);
      } else if (effectiveStatus === 'TERLAMBAT') {
        totalLate++;
        accountedUserIds.add(uId);
      } else if (effectiveStatus === 'IZIN') {
        totalLeave++;
        accountedUserIds.add(uId);
      } else if (effectiveStatus === 'SAKIT') {
        totalSick++;
        accountedUserIds.add(uId);
      } else if (effectiveStatus === 'DINAS_LUAR') {
        totalOfficialDuty++;
        accountedUserIds.add(uId);
      }
    });

    const totalAccountedFor = accountedUserIds.size;
    const offCheck = isDateOffDay(dateStr, systemSettings, holidays);

    // On Weekend / Holiday, unabsented is 0 because there is no expectation of attendance
    const totalUnabsented = offCheck.isOff
      ? 0
      : Math.max(0, totalTeachers - totalAccountedFor);

    const rawPercentage =
      totalTeachers > 0
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

    // 1. Account for Approved Leaves (Guru yang izin/sakit/dinasnya disetujui BUKAN belum absen!)
    for (const leave of leaveRequests) {
      const isApproved =
        leave.approval_status === 'APPROVED' || (leave as any).status === 'APPROVED';
      if (isApproved) {
        const startStr = (leave.start_date || '').substring(0, 10);
        const endStr = (leave.end_date || '').substring(0, 10);
        if (startStr <= dateStr && dateStr <= endStr) {
          activeUserIds.add(leave.user_id);
        }
      }
    }

    // 2. Account for Scanned Attendance Records
    const checkinEnd =
      systemSettings?.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

    for (const rec of attendanceRecords) {
      if (rec.date === dateStr) {
        const effectiveStatus = evaluateAttendanceStatus(
          rec.check_in_time,
          checkinEnd,
          rec.status
        );
        if (
          rec.check_in_time ||
          effectiveStatus === 'HADIR' ||
          effectiveStatus === 'TERLAMBAT' ||
          effectiveStatus === 'IZIN' ||
          effectiveStatus === 'SAKIT' ||
          effectiveStatus === 'DINAS_LUAR'
        ) {
          activeUserIds.add(rec.user_id);
        }
      }
    }

    const activeTeachers = this.getAttendanceEligibleUsers(allTeachers);
    return activeTeachers.filter((t) => !activeUserIds.has(t.id));
  }
}
