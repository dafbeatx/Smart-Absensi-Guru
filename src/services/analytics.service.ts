import type { AttendanceRecord, HolidayRecord, LeaveRequest, SystemSettings, UserProfile } from '../types/database.types';
import { evaluateAttendanceStatus, isDateOffDay, getTodayDateInJakarta } from '../utils/time.utils';
import { CONSTANTS } from '../config/constants';

export interface DailyAttendanceSummary {
  date: string;
  totalTeachers: number;
  totalPresent: number;
  totalLate: number;
  totalLeave: number;
  totalSick: number;
  totalOfficialDuty: number;
  totalPendingLeave: number;
  totalAlfa: number;
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

export interface HistoricalUnabsentedRecord {
  date: string;
  dayName: string;
  dateFormatted: string;
  teacher: UserProfile;
  status: 'BELUM_ABSEN' | 'ALFA';
  notes?: string;
  record?: AttendanceRecord;
}

// Helper to match personnel with leave request
const isTeacherLeaveMatch = (t: UserProfile, leave: LeaveRequest): boolean => {
  if (leave.user_id === t.id || (t.nip && leave.user_id === t.nip) || leave.user_id === t.full_name) return true;
  if (leave.user_name && (leave.user_name === t.full_name || leave.user_name === t.id)) return true;
  if (leave.teacher_name && (leave.teacher_name === t.full_name || leave.teacher_name === t.id)) return true;
  if (leave.user_id === 'usr_guru_010' && (t.full_name.includes('Mawar') || t.id.includes('1001'))) return true;
  return false;
};

// Helper to match personnel with attendance record
const isTeacherRecordMatch = (t: UserProfile, rec: AttendanceRecord): boolean => {
  if (rec.user_id === t.id || (t.nip && rec.user_id === t.nip) || rec.user_id === t.full_name) return true;
  if (rec.user_id === 'usr_guru_010' && (t.full_name.includes('Mawar') || t.id.includes('1001'))) return true;
  return false;
};

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
    let totalPendingLeave = 0;
    let totalAlfa = 0;

    const userAttendanceMap = new Map<string, AttendanceRecord>();
    for (const rec of attendanceRecords) {
      if (rec.date === dateStr) {
        userAttendanceMap.set(rec.user_id, rec);
      }
    }

    const accountedUserIds = new Set<string>();

    // 1. Process Approved & Pending Leaves FIRST (Highest Priority for accounting)
    for (const leave of leaveRequests) {
      const startStr = (leave.start_date || '').substring(0, 10);
      const endStr = (leave.end_date || '').substring(0, 10);

      if (startStr && endStr && startStr <= dateStr && dateStr <= endStr) {
        const isApproved =
          leave.approval_status === 'APPROVED' || (leave as any).status === 'APPROVED';
        const isPending =
          leave.approval_status === 'PENDING' ||
          leave.approval_status === 'SUBMITTED' ||
          leave.approval_status === 'UNDER_REVIEW' ||
          !leave.approval_status;

        if (isApproved) {
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
            } else if (reasonText.includes('menjadi IZIN') || reasonText.includes('menjadi CUTI')) {
              totalLeave++;
            } else if (reasonText.includes('menjadi ALFA')) {
              totalAlfa++;
            } else {
              totalPresent++;
            }
          } else {
            totalLeave++;
          }
        } else if (isPending) {
          accountedUserIds.add(leave.user_id);
          totalPendingLeave++;
          // Also classify pending into respective category for comprehensive view
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
            } else if (reasonText.includes('menjadi ALFA')) {
              totalAlfa++;
            } else {
              totalLeave++;
            }
          } else {
            totalLeave++;
          }
        }
      }
    }

    // 2. Process remaining attendance records for personnel without leaves
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
      } else if (effectiveStatus === 'ALFA') {
        totalAlfa++;
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
      totalPendingLeave,
      totalAlfa,
      totalUnabsented,
      attendancePercentage,
    };
  }

  /**
   * Identifies list of teachers who have not checked in yet on a given date.
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

    const activeTeachers = this.getAttendanceEligibleUsers(allTeachers);

    return activeTeachers.filter((t) => {
      // 1. Account for Approved & Pending Leaves
      const hasLeave = leaveRequests.some((l) => {
        const isApprovedOrPending =
          l.approval_status === 'APPROVED' ||
          (l as any).status === 'APPROVED' ||
          l.approval_status === 'PENDING' ||
          l.approval_status === 'SUBMITTED' ||
          l.approval_status === 'UNDER_REVIEW' ||
          !l.approval_status;

        if (!isApprovedOrPending) return false;
        if (!isTeacherLeaveMatch(t, l)) return false;
        const startStr = (l.start_date || '').substring(0, 10);
        const endStr = (l.end_date || '').substring(0, 10);
        return startStr <= dateStr && dateStr <= endStr;
      });

      if (hasLeave) return false;

      // 2. Account for Scanned or Recorded Attendance
      const hasRecord = attendanceRecords.some((rec) => {
        return rec.date === dateStr && isTeacherRecordMatch(t, rec);
      });

      if (hasRecord) return false;

      return true;
    });
  }

  /**
   * Retrieves historical unabsented & ALFA personnel records across all working days
   * in the current month (or specified lookback scope).
   * Strictly ignores holidays (tanggal merah) and weekends.
   */
  public static getHistoricalUnabsentedTeachers(
    allTeachers: UserProfile[],
    attendanceRecords: AttendanceRecord[],
    leaveRequests: LeaveRequest[],
    systemSettings?: SystemSettings | null,
    holidays?: HolidayRecord[] | null,
    scopeOrDaysBack: number | 'FULL_MONTH' = 'FULL_MONTH',
    targetDateStr?: string
  ): HistoricalUnabsentedRecord[] {
    const results: HistoricalUnabsentedRecord[] = [];
    const activeTeachers = this.getAttendanceEligibleUsers(allTeachers);
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const monthNames = [
      'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
      'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
    ];

    const todayStr = getTodayDateInJakarta();
    const anchorDateStr = targetDateStr || todayStr;
    const [anchorYear, anchorMonth, anchorDay] = anchorDateStr.split('-').map((v) => parseInt(v, 10));

    const datesToCheck: string[] = [];

    if (scopeOrDaysBack === 'FULL_MONTH') {
      const currentYear = parseInt(todayStr.substring(0, 4), 10);
      const currentMonth = parseInt(todayStr.substring(5, 7), 10);
      const currentDay = parseInt(todayStr.substring(8, 10), 10);

      const isCurrentMonth = anchorYear === currentYear && anchorMonth === currentMonth;
      const maxDay = isCurrentMonth ? currentDay : new Date(anchorYear, anchorMonth, 0).getDate();

      // Check all days from 1st of month up to today (or end of month if past month)
      for (let d = maxDay; d >= 1; d--) {
        const dStr = `${anchorYear}-${String(anchorMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        datesToCheck.push(dStr);
      }
    } else {
      const daysCount = typeof scopeOrDaysBack === 'number' ? scopeOrDaysBack : 7;
      for (let i = 0; i <= daysCount; i++) {
        const dObj = new Date(anchorYear, anchorMonth - 1, anchorDay - i);
        const y = dObj.getFullYear();
        const m = String(dObj.getMonth() + 1).padStart(2, '0');
        const d = String(dObj.getDate()).padStart(2, '0');
        datesToCheck.push(`${y}-${m}-${d}`);
      }
    }

    for (const dateStr of datesToCheck) {
      // 1. Strict Holiday & Weekend Check: NEVER treat holidays/weekends as unabsented or Alfa!
      const offCheck = isDateOffDay(dateStr, systemSettings, holidays);
      if (offCheck.isOff) {
        continue;
      }

      const [y, m, d] = dateStr.split('-').map(Number);
      const targetDate = new Date(y, m - 1, d);
      const dayName = dayNames[targetDate.getDay()];
      const dayNum = targetDate.getDate();
      const monthName = monthNames[targetDate.getMonth()];
      const dateFormatted = `${dayName}, ${dayNum} ${monthName} ${targetDate.getFullYear()}`;

      // 2. Identify unabsented teachers for this working date
      const unabsentedForDate = this.getUnabsentedTeachers(
        dateStr,
        activeTeachers,
        attendanceRecords,
        leaveRequests,
        systemSettings,
        holidays
      );

      unabsentedForDate.forEach((t) => {
        results.push({
          date: dateStr,
          dayName: dateStr === todayStr ? 'Hari Ini' : dayName,
          dateFormatted,
          teacher: t,
          status: 'BELUM_ABSEN',
        });
      });

      // 3. Identify recorded ALFA teachers for this date (only on valid working days)
      attendanceRecords.forEach((rec) => {
        if (rec.date === dateStr && rec.status === 'ALFA') {
          const teacher = activeTeachers.find((t) => isTeacherRecordMatch(t, rec));
          if (teacher && !results.some((r) => r.teacher.id === teacher.id && r.date === dateStr)) {
            results.push({
              date: dateStr,
              dayName: dateStr === todayStr ? 'Hari Ini' : dayName,
              dateFormatted,
              teacher,
              status: 'ALFA',
              notes: rec.notes || 'Tanpa Keterangan (Alpha)',
              record: rec,
            });
          }
        }
      });
    }

    return results;
  }
}
