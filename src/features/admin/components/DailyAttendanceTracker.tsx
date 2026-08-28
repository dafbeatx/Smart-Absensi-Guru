import React, { useState, useMemo, useEffect } from 'react';
import type { UserProfile, AttendanceRecord, LeaveRequest, AttendanceStatus, SystemSettings, RoleCode, HolidayRecord } from '../../../types/database.types';
import { AnalyticsService } from '../../../services/analytics.service';
import { FeatureGate } from '../../../components/ui/FeatureGate';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { evaluateAttendanceStatus, isDateOffDay } from '../../../utils/time.utils';
import { CONSTANTS } from '../../../config/constants';
import { ProviderFactory } from '../../../providers/provider-factory';
import { AttendanceResetModal } from './AttendanceResetModal';
import { LocationAddressBadge } from '../../../components/ui/LocationAddressBadge';

export interface DailyAttendanceTrackerProps {
  teachers: UserProfile[];
  attendanceRecords?: AttendanceRecord[];
  leaveRequests?: LeaveRequest[];
  onOpenCorrectionModal?: (teacher?: UserProfile, date?: string) => void;
}

type StatusFilter = 'ALL' | 'HADIR' | 'TERLAMBAT' | 'IZIN_SAKIT' | 'PENDING_APPROVAL' | 'ALFA' | 'BELUM_ABSEN';
type RoleFilter = 'ALL' | 'GURU' | 'PIMPINAN_ADMIN';

export const DailyAttendanceTracker: React.FC<DailyAttendanceTrackerProps> = ({
  teachers,
  attendanceRecords = [],
  leaveRequests = [],
  onOpenCorrectionModal,
}) => {
  const { token } = useAuthStore();
  const { showToast } = useToastStore();

  const todayStr = useMemo(() => new Date().toISOString().substring(0, 10), []);
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [holidays, setHolidays] = useState<HolidayRecord[]>([]);

  const [resetModalTeacher, setResetModalTeacher] = useState<UserProfile | null>(null);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  // Quick Review & Decision Modal for Pending Leave Requests
  const [selectedReviewLeave, setSelectedReviewLeave] = useState<LeaveRequest | null>(null);
  const [selectedReviewTeacher, setSelectedReviewTeacher] = useState<UserProfile | null>(null);
  const [reviewNotes, setReviewNotes] = useState<string>('');
  const [isReviewLoading, setIsReviewLoading] = useState<boolean>(false);
  const [reviewErrorMsg, setReviewErrorMsg] = useState<string | null>(null);

  // Attachment Preview Modal
  const [selectedPreviewAttachment, setSelectedPreviewAttachment] = useState<{
    url: string;
    title: string;
  } | null>(null);

  useEffect(() => {
    const fetchSettings = () => {
      ProviderFactory.getProvider()
        .getSettings()
        .then((st) => {
          if (st) setSystemSettings(st);
        })
        .catch(() => {});
    };
    const fetchHolidays = () => {
      ProviderFactory.getProvider()
        .getHolidays()
        .then((h) => {
          if (h) setHolidays(h);
        })
        .catch(() => {});
    };

    fetchSettings();
    fetchHolidays();

    window.addEventListener('smart_absensi_settings_updated', fetchSettings);
    window.addEventListener('smart_absensi_holidays_updated', fetchHolidays);
    return () => {
      window.removeEventListener('smart_absensi_settings_updated', fetchSettings);
      window.removeEventListener('smart_absensi_holidays_updated', fetchHolidays);
    };
  }, []);

  const checkinEnd = systemSettings?.work_checkin_end ? systemSettings.work_checkin_end.slice(0, 5) : CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

  // Filter active eligible personnel (Guru, Kepsek, Admin) expected to take daily attendance
  const activeEligiblePersonnel = useMemo(() => {
    return AnalyticsService.getAttendanceEligibleUsers(teachers);
  }, [teachers]);

  // Gather all leave requests from props & localStorage
  const allLeavesToEvaluate = useMemo(() => {
    const list = [...leaveRequests];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_leaves');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            // Deduplicate by ID
            for (const item of parsed) {
              if (!list.some((existing) => existing.id === item.id)) {
                list.push(item);
              }
            }
          }
        }
      } catch (e) {}
    }
    return list;
  }, [leaveRequests]);

  // Check if selectedDate is weekend or holiday
  const isOffDayCheck = useMemo(() => {
    return isDateOffDay(selectedDate, systemSettings, holidays);
  }, [selectedDate, systemSettings, holidays]);

  // 1. Calculate Daily Analytics Stats (100% Synchronized with holidays)
  const summary = useMemo(() => {
    return AnalyticsService.calculateDailySummary(
      selectedDate,
      activeEligiblePersonnel,
      attendanceRecords,
      allLeavesToEvaluate,
      systemSettings,
      holidays
    );
  }, [selectedDate, activeEligiblePersonnel, attendanceRecords, allLeavesToEvaluate, systemSettings, holidays]);

  const [unabsentedScope, setUnabsentedScope] = useState<'FULL_MONTH' | 7 | 14 | 30>('FULL_MONTH');

  // Historical Unabsented & ALFA records (Bulan Berjalan / Seluruh Hari Kerja Efektif)
  const historicalUnabsented = useMemo(() => {
    return AnalyticsService.getHistoricalUnabsentedTeachers(
      teachers,
      attendanceRecords,
      allLeavesToEvaluate,
      systemSettings,
      holidays,
      unabsentedScope,
      selectedDate
    );
  }, [teachers, attendanceRecords, allLeavesToEvaluate, systemSettings, holidays, unabsentedScope, selectedDate]);

  // 2. Identify attendance state map for each personnel for selectedDate
  const teacherAttendanceMap = useMemo(() => {
    const map = new Map<string, {
      record?: AttendanceRecord;
      leave?: LeaveRequest;
      status: AttendanceStatus | 'BELUM_ABSEN';
      leaveApprovalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED';
      checkInTime?: string;
      checkOutTime?: string;
      notes?: string;
      attachmentUrl?: string | null;
    }>();

    // Helper to match personnel with leave request
    const isTeacherLeaveMatch = (t: UserProfile, leave: LeaveRequest) => {
      if (leave.user_id === t.id || (t.nip && leave.user_id === t.nip) || leave.user_id === t.full_name) return true;
      if (leave.user_name && (leave.user_name === t.full_name || leave.user_name === t.id)) return true;
      if (leave.teacher_name && (leave.teacher_name === t.full_name || leave.teacher_name === t.id)) return true;
      if (leave.user_id === 'usr_guru_010' && (t.full_name.includes('Mawar') || t.id.includes('1001'))) return true;
      return false;
    };

    const isTeacherRecordMatch = (t: UserProfile, rec: AttendanceRecord) => {
      if (rec.user_id === t.id || (t.nip && rec.user_id === t.nip) || rec.user_id === t.full_name) return true;
      if (rec.user_id === 'usr_guru_010' && (t.full_name.includes('Mawar') || t.id.includes('1001'))) return true;
      return false;
    };

    for (const teacher of activeEligiblePersonnel) {
      // 1. Check if personnel has an APPROVED leave for selectedDate (High Priority)
      const approvedLeave = allLeavesToEvaluate.find((l) => {
        const isApproved =
          l.approval_status === 'APPROVED' || (l as any).status === 'APPROVED';
        if (!isApproved) return false;
        if (!isTeacherLeaveMatch(teacher, l)) return false;
        const startStr = (l.start_date || '').substring(0, 10);
        const endStr = (l.end_date || '').substring(0, 10);
        return startStr <= selectedDate && selectedDate <= endStr;
      });

      // 2. Check if personnel has a PENDING leave application for selectedDate
      const pendingLeave = allLeavesToEvaluate.find((l) => {
        const isPending =
          l.approval_status === 'PENDING' ||
          l.approval_status === 'SUBMITTED' ||
          l.approval_status === 'UNDER_REVIEW' ||
          !l.approval_status;
        if (!isPending) return false;
        if (!isTeacherLeaveMatch(teacher, l)) return false;
        const startStr = (l.start_date || '').substring(0, 10);
        const endStr = (l.end_date || '').substring(0, 10);
        return startStr <= selectedDate && selectedDate <= endStr;
      });

      // 3. Check if personnel has explicit attendance record for selectedDate
      const record = attendanceRecords.find(
        (r) => r.date === selectedDate && isTeacherRecordMatch(teacher, r)
      );

      // Case 1: Approved Leave
      if (approvedLeave) {
        let status: AttendanceStatus = 'IZIN';
        let checkInTime: string | undefined = undefined;
        let checkOutTime: string | undefined = undefined;

        if (approvedLeave.leave_type === 'KOREKSI_ABSEN') {
          const reasonText = approvedLeave.reason || '';
          if (
            reasonText.includes('menjadi HADIR') ||
            reasonText.includes('Target Koreksi') ||
            !reasonText.includes('menjadi ')
          ) {
            status = 'HADIR';
          } else if (reasonText.includes('menjadi SAKIT')) {
            status = 'SAKIT';
          } else if (reasonText.includes('menjadi DINAS_LUAR')) {
            status = 'DINAS_LUAR';
          } else if (reasonText.includes('menjadi ALFA')) {
            status = 'ALFA';
          }
          const inMatch = reasonText.match(/Masuk\s*\(([0-2]?[0-9]:[0-5][0-9])/i);
          if (inMatch) checkInTime = inMatch[1];
          const outMatch = reasonText.match(/Pulang\s*\(([0-2]?[0-9]:[0-5][0-9])/i);
          if (outMatch) checkOutTime = outMatch[1];
        } else {
          status =
            approvedLeave.leave_type === 'SAKIT'
              ? 'SAKIT'
              : approvedLeave.leave_type === 'DINAS_LUAR'
              ? 'DINAS_LUAR'
              : 'IZIN';
        }

        map.set(teacher.id, {
          record,
          leave: approvedLeave,
          status,
          leaveApprovalStatus: 'APPROVED',
          checkInTime: record?.check_in_time ? record.check_in_time.substring(0, 5) : checkInTime,
          checkOutTime: record?.check_out_time ? record.check_out_time.substring(0, 5) : checkOutTime,
          notes:
            approvedLeave.leave_type === 'KOREKSI_ABSEN'
              ? `Koreksi Disetujui: ${approvedLeave.reason}`
              : `Izin Disetujui: ${approvedLeave.reason}`,
          attachmentUrl: approvedLeave.attachment_url,
        });
        continue;
      }

      // Case 2: Pending Leave Application (Guru yang mengajukan izin/sakit/cuti)
      if (pendingLeave) {
        const leaveType = pendingLeave.leave_type;
        const status: AttendanceStatus =
          leaveType === 'SAKIT'
            ? 'SAKIT'
            : leaveType === 'DINAS_LUAR'
            ? 'DINAS_LUAR'
            : 'IZIN';

        map.set(teacher.id, {
          record,
          leave: pendingLeave,
          status,
          leaveApprovalStatus: 'PENDING',
          checkInTime: record?.check_in_time ? record.check_in_time.substring(0, 5) : undefined,
          checkOutTime: record?.check_out_time ? record.check_out_time.substring(0, 5) : undefined,
          notes: `Pengajuan ${leaveType}: ${pendingLeave.reason}`,
          attachmentUrl: pendingLeave.attachment_url,
        });
        continue;
      }

      // Case 3: Explicit Scanned / Recorded Attendance
      if (record) {
        const effectiveStatus = evaluateAttendanceStatus(
          record.check_in_time,
          checkinEnd,
          record.status
        );
        map.set(teacher.id, {
          record,
          status: effectiveStatus,
          checkInTime: record.check_in_time ? record.check_in_time.substring(0, 5) : undefined,
          checkOutTime: record.check_out_time ? record.check_out_time.substring(0, 5) : undefined,
          notes: record.notes,
        });
        continue;
      }

      // Case 4: Default to BELUM_ABSEN
      map.set(teacher.id, {
        status: 'BELUM_ABSEN',
      });
    }

    return map;
  }, [selectedDate, activeEligiblePersonnel, attendanceRecords, allLeavesToEvaluate, checkinEnd]);

  // 3. Filtered & Priority-Sorted list of personnel based on search, status filter, and role filter
  const filteredTeachers = useMemo(() => {
    const list = activeEligiblePersonnel.filter((teacher) => {
      // Search query filter (Name, NIP, Position)
      const query = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !query ||
        teacher.full_name.toLowerCase().includes(query) ||
        (teacher.nip ? teacher.nip.includes(query) : false) ||
        (teacher.position && teacher.position.toLowerCase().includes(query));

      if (!matchesSearch) return false;

      // Role Filter
      if (roleFilter === 'GURU' && teacher.role !== 'GURU' && teacher.role) return false;
      if (roleFilter === 'PIMPINAN_ADMIN' && teacher.role !== 'KEPSEK' && teacher.role !== 'ADMIN') return false;

      // Status filter
      const item = teacherAttendanceMap.get(teacher.id);
      const status = item?.status || 'BELUM_ABSEN';
      const isPending = item?.leaveApprovalStatus === 'PENDING';

      if (statusFilter === 'ALL') return true;
      if (statusFilter === 'HADIR') return status === 'HADIR';
      if (statusFilter === 'TERLAMBAT') return status === 'TERLAMBAT';
      if (statusFilter === 'IZIN_SAKIT') return status === 'IZIN' || status === 'SAKIT' || status === 'DINAS_LUAR';
      if (statusFilter === 'PENDING_APPROVAL') return isPending;
      if (statusFilter === 'ALFA') return status === 'ALFA';
      if (statusFilter === 'BELUM_ABSEN') return status === 'BELUM_ABSEN' && !isPending;

      return true;
    });

    // Pinned Priority Sorting: KEPSEK (1) -> ADMIN (2) -> GURU/Others (3), then alphabetically by name
    return list.sort((a, b) => {
      const getPriority = (role?: RoleCode) => {
        if (role === 'KEPSEK') return 1;
        if (role === 'ADMIN') return 2;
        return 3;
      };
      const priorityDiff = getPriority(a.role) - getPriority(b.role);
      if (priorityDiff !== 0) return priorityDiff;
      return a.full_name.localeCompare(b.full_name, 'id');
    });
  }, [activeEligiblePersonnel, teacherAttendanceMap, searchQuery, statusFilter, roleFilter]);

  // Status Badge Builder with full support for Pending and Approved Leaves
  const getStatusBadge = (
    status: AttendanceStatus | 'BELUM_ABSEN',
    leave?: LeaveRequest,
    leaveApprovalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED'
  ) => {
    // 1. Pending Leave Application (Menunggu Approval)
    if (leaveApprovalStatus === 'PENDING' && leave) {
      const typeLabel =
        leave.leave_type === 'SAKIT'
          ? '🤒 Pengajuan Sakit'
          : leave.leave_type === 'CUTI'
          ? '🏖️ Pengajuan Cuti'
          : leave.leave_type === 'DINAS_LUAR'
          ? '💼 Pengajuan Dinas'
          : leave.leave_type === 'KOREKSI_ABSEN'
          ? '✏️ Pengajuan Koreksi'
          : '📝 Pengajuan Izin';

      return (
        <span className="px-2.5 py-1 bg-amber-100/90 text-amber-900 text-xs font-black rounded-full border border-amber-300 shadow-2xs flex items-center gap-1.5 animate-pulse">
          <span>⏳</span>
          <span>{typeLabel} (Menunggu Approval)</span>
        </span>
      );
    }

    // 2. Approved Leave
    if (leaveApprovalStatus === 'APPROVED' && leave) {
      const typeLabel =
        leave.leave_type === 'SAKIT'
          ? '🏥 Sakit (Disetujui)'
          : leave.leave_type === 'CUTI'
          ? '🏖️ Cuti (Disetujui)'
          : leave.leave_type === 'DINAS_LUAR'
          ? '💼 Dinas Luar (Disetujui)'
          : leave.leave_type === 'KOREKSI_ABSEN'
          ? '✏️ Koreksi Hadir (Disetujui)'
          : '📝 Izin (Disetujui)';

      return (
        <span className="px-2.5 py-1 bg-blue-100 text-blue-900 text-xs font-bold rounded-full border border-blue-200 shadow-2xs flex items-center gap-1">
          <span>{typeLabel}</span>
        </span>
      );
    }

    switch (status) {
      case 'HADIR':
        return <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 text-xs font-bold rounded-full border border-emerald-200">✅ Hadir Tepat Waktu</span>;
      case 'TERLAMBAT':
        return <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-xs font-bold rounded-full border border-amber-200">⚠️ Terlambat</span>;
      case 'IZIN':
      case 'SAKIT':
      case 'DINAS_LUAR':
        return <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-xs font-bold rounded-full border border-blue-200">📝 {status}</span>;
      case 'ALFA':
        return <span className="px-2.5 py-1 bg-rose-100 text-rose-800 text-xs font-bold rounded-full border border-rose-300">🚫 Tanpa Keterangan (Alfa)</span>;
      case 'BELUM_ABSEN':
      default:
        return isOffDayCheck.isOff ? (
          <span className="px-2.5 py-1 bg-sky-100 text-sky-800 text-xs font-bold rounded-full border border-sky-200">🏖️ Libur Sekolah</span>
        ) : (
          <span className="px-2.5 py-1 bg-red-100 text-red-700 text-xs font-bold rounded-full border border-red-200">⏳ Belum Absen</span>
        );
    }
  };

  const getRoleBadge = (role?: RoleCode) => {
    switch (role) {
      case 'KEPSEK':
        return (
          <span className="px-2.5 py-0.5 bg-linear-to-r from-amber-500 to-amber-600 text-white font-extrabold text-[10px] rounded-full shadow-xs flex items-center gap-1 border border-amber-400/50">
            👑 Kepala Sekolah
          </span>
        );
      case 'ADMIN':
        return (
          <span className="px-2.5 py-0.5 bg-linear-to-r from-indigo-600 to-violet-600 text-white font-extrabold text-[10px] rounded-full shadow-xs flex items-center gap-1 border border-indigo-400/50">
            🛡️ Administrator
          </span>
        );
      case 'OPERATOR':
        return (
          <span className="px-2.5 py-0.5 bg-slate-700 text-white font-bold text-[10px] rounded-full">
            💻 Operator
          </span>
        );
      case 'GURU':
      default:
        return (
          <span className="px-2 py-0.5 bg-slate-100 text-slate-700 font-bold text-[10px] rounded-full border border-slate-200">
            👨‍🏫 Guru
          </span>
        );
    }
  };

  const getCardStyle = (role?: RoleCode, leaveApprovalStatus?: 'APPROVED' | 'PENDING' | 'REJECTED') => {
    if (leaveApprovalStatus === 'PENDING') {
      return 'border-l-4 border-l-amber-500 bg-amber-50/30 border-y border-r border-amber-200/90 shadow-xs hover:shadow-md';
    }
    if (leaveApprovalStatus === 'APPROVED') {
      return 'border-l-4 border-l-blue-500 bg-blue-50/20 border-y border-r border-blue-200/80 shadow-xs hover:shadow-md';
    }
    if (role === 'KEPSEK') {
      return 'border-l-4 border-l-amber-500 bg-amber-50/20 border-y border-r border-amber-200/80 shadow-xs hover:shadow-md';
    }
    if (role === 'ADMIN') {
      return 'border-l-4 border-l-indigo-500 bg-indigo-50/20 border-y border-r border-indigo-200/80 shadow-xs hover:shadow-md';
    }
    return 'border border-slate-200 bg-white hover:border-blue-200 hover:shadow-md';
  };

  const getAvatarBg = (role?: RoleCode) => {
    if (role === 'KEPSEK') return 'bg-linear-to-br from-amber-500 to-amber-700 text-white ring-2 ring-amber-400/50 shadow-xs';
    if (role === 'ADMIN') return 'bg-linear-to-br from-indigo-600 to-violet-700 text-white ring-2 ring-indigo-400/50 shadow-xs';
    return 'bg-slate-900 text-white';
  };

  // Handle Approve / Reject Leave from Live Tracking Modal
  const handleQuickDecision = async (decision: 'APPROVED' | 'REJECTED') => {
    if (!selectedReviewLeave) return;
    setReviewErrorMsg(null);
    setIsReviewLoading(true);

    try {
      await LeaveRepository.approveLeave(
        selectedReviewLeave.id,
        decision,
        reviewNotes,
        token || 'MOCK_TOKEN'
      );

      showToast(
        'success',
        decision === 'APPROVED' ? 'Pengajuan Izin Disetujui! ✅' : 'Pengajuan Izin Ditolak ❌',
        `Permohonan izin ${selectedReviewTeacher?.full_name || 'Guru'} telah berhasil diproses.`
      );

      setIsReviewLoading(false);
      setSelectedReviewLeave(null);
      setSelectedReviewTeacher(null);
      setReviewNotes('');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('smart_absensi_leave_updated'));
        window.dispatchEvent(new Event('smart_absensi_records_updated'));
      }
    } catch (err: unknown) {
      setIsReviewLoading(false);
      const msg = err instanceof Error ? err.message : 'Gagal memproses persetujuan izin';
      setReviewErrorMsg(msg);
    }
  };

  return (
    <div className="space-y-6">
      {/* Real-time Summary Metrics Card */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 font-bold text-[11px] rounded-full">
                📍 Executive & Admin Tracking
              </span>
              <span className="text-xs text-slate-400 font-medium">Real-time Monitoring</span>
            </div>
            <h2 className="text-lg font-black text-slate-900 mt-1">Status Kehadiran Guru & Staf Pimpinan</h2>
          </div>

          {/* Date Selector */}
          <div className="flex items-center gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <span className="text-xs font-bold text-slate-600 pl-1">📅 Tanggal:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Attendance Rate & Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between items-center text-xs">
            <span className="font-bold text-slate-700">Persentase Kehadiran ({selectedDate})</span>
            <span className="font-black text-lg text-emerald-600">{summary.attendancePercentage}%</span>
          </div>
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalPresent / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`Hadir Tepat Waktu: ${summary.totalPresent}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalLate / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-amber-400 transition-all duration-500"
              title={`Terlambat: ${summary.totalLate}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (Math.max(0, summary.totalLeave + summary.totalSick + summary.totalOfficialDuty - summary.totalPendingLeave) / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-blue-500 transition-all duration-500"
              title={`Izin / Sakit / Dinas Disetujui: ${Math.max(0, summary.totalLeave + summary.totalSick + summary.totalOfficialDuty - summary.totalPendingLeave)}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalPendingLeave / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-amber-500 transition-all duration-500"
              title={`Pengajuan Izin Menunggu Approval: ${summary.totalPendingLeave}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalAlfa / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`Tanpa Keterangan (Alfa): ${summary.totalAlfa}`}
            />
            <div
              style={{ width: `${summary.totalTeachers > 0 ? (summary.totalUnabsented / summary.totalTeachers) * 100 : 0}%` }}
              className="bg-red-400 transition-all duration-500"
              title={`Belum Absen: ${summary.totalUnabsented}`}
            />
          </div>
        </div>

        {/* Quick Stat Cards (Fully Clickable to Filter) */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3 pt-1">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`p-3 rounded-2xl bg-slate-50 border text-center space-y-0.5 transition-all cursor-pointer active:scale-95 ${
              statusFilter === 'ALL' ? 'border-slate-800 ring-2 ring-slate-400/30 shadow-xs' : 'border-slate-200 hover:border-slate-400 hover:shadow-xs'
            }`}
          >
            <span className="text-xl font-black text-slate-800">{summary.totalTeachers}</span>
            <p className="text-[10px] font-bold text-slate-500">Total Personel</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('HADIR')}
            className={`p-3 rounded-2xl bg-emerald-50 border text-center space-y-0.5 transition-all cursor-pointer active:scale-95 ${
              statusFilter === 'HADIR' ? 'border-emerald-600 ring-2 ring-emerald-400/40 shadow-xs' : 'border-emerald-200 hover:border-emerald-400 hover:shadow-xs'
            }`}
          >
            <span className="text-xl font-black text-emerald-700">{summary.totalPresent}</span>
            <p className="text-[10px] font-bold text-emerald-800">Hadir Tepat</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('TERLAMBAT')}
            className={`p-3 rounded-2xl bg-amber-50 border text-center space-y-0.5 transition-all cursor-pointer active:scale-95 ${
              statusFilter === 'TERLAMBAT' ? 'border-amber-600 ring-2 ring-amber-400/40 shadow-xs' : 'border-amber-200 hover:border-amber-400 hover:shadow-xs'
            }`}
          >
            <span className="text-xl font-black text-amber-700">{summary.totalLate}</span>
            <p className="text-[10px] font-bold text-amber-800">Terlambat</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('IZIN_SAKIT')}
            className={`p-3 rounded-2xl bg-blue-50 border text-center space-y-0.5 transition-all cursor-pointer active:scale-95 ${
              statusFilter === 'IZIN_SAKIT' ? 'border-blue-600 ring-2 ring-blue-400/40 shadow-xs' : 'border-blue-200 hover:border-blue-400 hover:shadow-xs'
            }`}
          >
            <span className="text-xl font-black text-blue-700">{summary.totalSick + summary.totalLeave + summary.totalOfficialDuty}</span>
            <p className="text-[10px] font-bold text-blue-800">
              Izin / Sakit
              {summary.totalPendingLeave > 0 ? (
                <span className="block text-[9px] text-amber-700 font-extrabold">
                  ({summary.totalPendingLeave} Menunggu)
                </span>
              ) : null}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('ALFA')}
            className={`p-3 rounded-2xl bg-rose-50 border text-center space-y-0.5 transition-all cursor-pointer active:scale-95 ${
              statusFilter === 'ALFA' ? 'border-rose-600 ring-2 ring-rose-400/40 shadow-xs' : 'border-rose-200 hover:border-rose-400 hover:shadow-xs'
            }`}
          >
            <span className="text-xl font-black text-rose-700">{summary.totalAlfa}</span>
            <p className="text-[10px] font-bold text-rose-800">Tanpa Keterangan</p>
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('BELUM_ABSEN')}
            className={`p-3 rounded-2xl bg-red-50 border text-center space-y-0.5 transition-all cursor-pointer active:scale-95 ${
              statusFilter === 'BELUM_ABSEN' ? 'border-red-600 ring-2 ring-red-400/40 shadow-xs' : 'border-red-200 hover:border-red-400 hover:shadow-xs'
            }`}
          >
            <span className="text-xl font-black text-red-700">{summary.totalUnabsented}</span>
            <p className="text-[10px] font-bold text-red-800">Belum Absen</p>
          </button>
        </div>
      </div>

      {/* Interactive Controls & Filters */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="🔍 Cari nama guru, Kepsek, Admin, NPP, atau posisi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-3.5 pr-4 py-2 bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer"
              >
                ✕
              </button>
            )}
          </div>

          {/* Role Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl shrink-0 self-start lg:self-auto">
            {[
              { id: 'ALL', label: 'Semua Peran' },
              { id: 'GURU', label: '👨‍🏫 Guru' },
              { id: 'PIMPINAN_ADMIN', label: '👑 Kepsek & Admin' },
            ].map((rf) => (
              <button
                key={rf.id}
                onClick={() => setRoleFilter(rf.id as RoleFilter)}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer ${
                  roleFilter === rf.id
                    ? 'bg-white text-slate-900 shadow-xs border border-slate-200/60'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {rf.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status Filter Tab Buttons */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
          {[
            { id: 'ALL', label: `Semua (${activeEligiblePersonnel.length})` },
            { id: 'HADIR', label: `Hadir Tepat (${summary.totalPresent})` },
            { id: 'TERLAMBAT', label: `Terlambat (${summary.totalLate})` },
            { id: 'IZIN_SAKIT', label: `Izin / Sakit (${summary.totalSick + summary.totalLeave + summary.totalOfficialDuty})` },
            ...(summary.totalPendingLeave > 0 ? [{ id: 'PENDING_APPROVAL', label: `⏳ Menunggu Approval (${summary.totalPendingLeave})` }] : []),
            { id: 'ALFA', label: `Tanpa Keterangan (${summary.totalAlfa})` },
            { id: 'BELUM_ABSEN', label: `Belum Absen (${summary.totalUnabsented})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as StatusFilter)}
              className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Personnel Attendance List */}
        <div className="divide-y divide-slate-100">
          {filteredTeachers.length === 0 ? (
            <div className="p-8 text-center text-slate-400 space-y-1">
              <span className="text-3xl block">🔍</span>
              <p className="font-bold text-slate-600 text-xs">Tidak ada data personel yang cocok dengan filter</p>
              <p className="text-[11px]">Coba ubah tanggal, peran, atau kata kunci pencarian.</p>
            </div>
          ) : (
            filteredTeachers.map((teacher) => {
              const item = teacherAttendanceMap.get(teacher.id);
              const status = item?.status || 'BELUM_ABSEN';
              const record = item?.record;
              const leave = item?.leave;
              const leaveApprovalStatus = item?.leaveApprovalStatus;
              const isPendingLeave = leaveApprovalStatus === 'PENDING';
              const isExecutiveRole = teacher.role === 'KEPSEK' || teacher.role === 'ADMIN';

              return (
                <div
                  key={teacher.id}
                  onClick={() => {
                    if (isPendingLeave && leave) {
                      setSelectedReviewLeave(leave);
                      setSelectedReviewTeacher(teacher);
                    } else if (onOpenCorrectionModal) {
                      onOpenCorrectionModal(teacher, selectedDate);
                    }
                  }}
                  className={`p-3.5 sm:p-4 rounded-2xl transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 my-1.5 cursor-pointer active:scale-[0.99] ${getCardStyle(teacher.role, leaveApprovalStatus)}`}
                  title={isPendingLeave ? 'Klik untuk meninjau dan memproses persetujuan izin guru ini' : 'Klik untuk melihat / mengoreksi absensi personel ini'}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 overflow-hidden ${getAvatarBg(teacher.role)}`}>
                      {teacher.avatar_url ? (
                        <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full object-cover" />
                      ) : teacher.role === 'KEPSEK' ? (
                        <span className="text-amber-100 text-base">👑</span>
                      ) : teacher.role === 'ADMIN' ? (
                        <span className="text-indigo-100 text-base">🛡️</span>
                      ) : (
                        teacher.full_name.charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-slate-900 text-xs sm:text-sm truncate">{teacher.full_name}</h4>
                        {getRoleBadge(teacher.role)}
                        {isExecutiveRole && (
                          <span className="text-[9px] px-1.5 py-0.5 bg-amber-100/70 text-amber-900 font-extrabold rounded-md border border-amber-300/60">
                            📌 Pinned
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                        NPP: {teacher.nip && !teacher.nip.startsWith('NIP_') ? teacher.nip : '-'} • {teacher.position || (teacher.role === 'KEPSEK' ? 'Kepala Sekolah' : teacher.role === 'ADMIN' ? 'Administrator Sekolah' : 'Tenaga Pendidik')}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-right">
                      {getStatusBadge(status, leave, leaveApprovalStatus)}
                      {item?.checkInTime && (
                        <p className="text-[11px] font-mono font-bold text-slate-700 mt-1">
                          Masuk: {item.checkInTime} {item.checkOutTime ? `• Pulang: ${item.checkOutTime}` : ''}
                        </p>
                      )}
                      {(record?.notes || item?.notes) && (
                        <p className={`text-[10px] font-semibold mt-0.5 px-2 py-0.5 rounded-md border inline-block max-w-xs truncate ${
                          isPendingLeave ? 'bg-amber-100 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-800 border-slate-200'
                        }`}>
                          💬 {record?.notes || item?.notes}
                        </p>
                      )}
                      {item?.attachmentUrl && (
                        <div className="pt-0.5">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedPreviewAttachment({
                                url: item.attachmentUrl!,
                                title: `Lampiran Bukti Izin - ${teacher.full_name}`,
                              });
                            }}
                            className="text-[10px] text-emerald-800 bg-emerald-50 hover:bg-emerald-100 font-bold px-2 py-0.5 rounded-md border border-emerald-200 flex items-center gap-1 cursor-pointer ml-auto"
                            title="Klik untuk melihat dokumen / surat dokter terlampir"
                          >
                            <span>📎</span> Lihat Surat/Bukti
                          </button>
                        </div>
                      )}
                      {record?.check_in_lat && record?.check_in_lng ? (
                        <div className="pt-0.5">
                          <LocationAddressBadge
                            lat={record.check_in_lat}
                            lng={record.check_in_lng}
                            distanceMeters={record.check_in_distance_meters}
                            shortOnly
                          />
                        </div>
                      ) : record?.check_in_distance_meters !== undefined ? (
                        <p className="text-[10px] text-slate-400 font-medium">
                          📍 Jarak: {record.check_in_distance_meters}m • {record.verification_method || 'QR_GPS'}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Action Review Izin for Pending Leave Request */}
                      {isPendingLeave && leave && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedReviewLeave(leave);
                            setSelectedReviewTeacher(teacher);
                          }}
                          className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer"
                          title="Tinjau dan proses permohonan izin/sakit guru ini"
                        >
                          <span>☑️</span> Review Izin
                        </button>
                      )}

                      {/* Action WhatsApp Reminder for Unabsented without pending/approved leaves */}
                      {status === 'BELUM_ABSEN' && !isPendingLeave && (
                        <FeatureGate flag="ENABLE_WHATSAPP">
                          <a
                            href={`https://wa.me/62${String(teacher.phone_number || '').replace(/^0/, '')}?text=Assalamu'alaikum%20Bapak/Ibu%20${encodeURIComponent(teacher.full_name)},%20mohon%20konfirmasi%20kehadiran%20hari%20ini.`}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm flex items-center gap-1 cursor-pointer active:scale-95"
                            title="Kirim Pesan Pengingat Absen via WhatsApp"
                          >
                            <span>💬</span> Remind WA
                          </a>
                        </FeatureGate>
                      )}

                      {/* Manual Correction Shortcut for Admin */}
                      {onOpenCorrectionModal && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenCorrectionModal(teacher, selectedDate);
                          }}
                          className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95"
                          title="Koreksi Manual Absensi Personel Ini"
                        >
                          ✏️ Koreksi
                        </button>
                      )}

                      {/* Reset Presensi Shortcut for Admin */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setResetModalTeacher(teacher);
                          setIsResetModalOpen(true);
                        }}
                        className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 text-xs font-bold rounded-xl transition-colors cursor-pointer active:scale-95 flex items-center gap-1"
                        title="Reset Harian Absensi Personel Ini (Diperlukan Password Admin)"
                      >
                        <span>🔄</span> Reset
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── REKAP GURU BELUM ABSEN & ALFA SATU BULAN BERJALAN ─────────────────── */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-card space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[11px] rounded-full">
                ⚠️ Rekap Satu Bulan
              </span>
              <span className="text-xs text-slate-400 font-medium">
                {unabsentedScope === 'FULL_MONTH' ? 'Semua Hari Kerja Bulan Berjalan (Tgl 1 s/d Hari Ini)' : `${unabsentedScope} Hari Terakhir`}
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                🏖️ Libur Kalender Dikecualikan
              </span>
            </div>
            <h3 className="font-extrabold text-slate-900 text-sm sm:text-base mt-1">
              Rekap Personel Belum Absen &amp; Tanpa Keterangan (Satu Bulan)
            </h3>
            <p className="text-xs text-slate-500">
              Daftar seluruh guru/staf yang belum melakukan absensi atau dialfakan pada hari kerja efektif bulan ini. Hari libur resmi sekolah otomatis tidak dihitung sebagai alfa.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap self-start sm:self-auto">
            {/* Scope Toggle */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl text-xs font-bold text-slate-700">
              <button
                type="button"
                onClick={() => setUnabsentedScope('FULL_MONTH')}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  unabsentedScope === 'FULL_MONTH' ? 'bg-[#023246] text-white shadow-xs' : 'hover:bg-slate-200'
                }`}
              >
                📅 Seluruh Bulan
              </button>
              <button
                type="button"
                onClick={() => setUnabsentedScope(7)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  unabsentedScope === 7 ? 'bg-[#023246] text-white shadow-xs' : 'hover:bg-slate-200'
                }`}
              >
                ⏱️ 7 Hari
              </button>
              <button
                type="button"
                onClick={() => setUnabsentedScope(30)}
                className={`px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  unabsentedScope === 30 ? 'bg-[#023246] text-white shadow-xs' : 'hover:bg-slate-200'
                }`}
              >
                🗓️ 30 Hari
              </button>
            </div>
            <span className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-extrabold text-xs shrink-0">
              Total {historicalUnabsented.length} Catatan
            </span>
          </div>
        </div>

        {historicalUnabsented.length === 0 ? (
          <div className="p-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
            <span className="text-3xl block">🎉</span>
            <p className="font-bold text-emerald-900 text-sm">Semua Kehadiran Bulan Ini Tertib &amp; Lengkap</p>
            <p className="text-xs text-emerald-700">
              Tidak ada guru yang terlewat absen tanpa keterangan pada seluruh hari kerja efektif periode ini.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[500px] overflow-y-auto pr-1">
            {historicalUnabsented.map((item, idx) => (
              <div
                key={`${item.teacher.id}_${item.date}_${idx}`}
                className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2 transition-all ${
                  item.status === 'ALFA'
                    ? 'bg-rose-50/40 border-rose-200/80 hover:border-rose-300'
                    : 'bg-amber-50/30 border-amber-200/80 hover:border-amber-300'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#023246] text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      {item.teacher.full_name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 text-xs truncate">{item.teacher.full_name}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        NPP: {item.teacher.nip && !item.teacher.nip.startsWith('NIP_') ? item.teacher.nip : '-'} • {item.teacher.position || 'Guru Pengajar'}
                      </p>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 border ${
                      item.status === 'ALFA'
                        ? 'bg-rose-100 text-rose-800 border-rose-300'
                        : 'bg-red-100 text-red-700 border-red-200'
                    }`}
                  >
                    {item.status === 'ALFA' ? '🚫 Tanpa Keterangan' : '⏳ Belum Absen'}
                  </span>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/60 text-xs">
                  <span className="text-[11px] font-bold text-slate-600 flex items-center gap-1">
                    <span>📅</span> {item.dateFormatted} ({item.dayName})
                  </span>

                  {onOpenCorrectionModal && (
                    <button
                      onClick={() => onOpenCorrectionModal(item.teacher, item.date)}
                      className="px-2.5 py-1 bg-amber-100 hover:bg-amber-200 text-amber-900 font-extrabold text-[10px] rounded-lg transition-all cursor-pointer active:scale-95 border border-amber-300"
                    >
                      ✏️ Koreksi / Isi Alasan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal Quick Review & Approval Permohonan Izin Guru */}
      <Modal
        isOpen={Boolean(selectedReviewLeave && selectedReviewTeacher)}
        onClose={() => {
          setSelectedReviewLeave(null);
          setSelectedReviewTeacher(null);
          setReviewNotes('');
          setReviewErrorMsg(null);
        }}
        title="📋 Review Pengajuan Izin / Sakit Guru"
      >
        <div className="space-y-4">
          {reviewErrorMsg && (
            <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold border border-red-200">
              ⚠️ {reviewErrorMsg}
            </div>
          )}

          {selectedReviewLeave && selectedReviewTeacher && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Pemohon:</span>
                <span className="font-extrabold px-2.5 py-0.5 rounded-full text-[10px] bg-amber-100 text-amber-900 border border-amber-300">
                  ⏳ Menunggu Approval
                </span>
              </div>
              <p className="font-black text-slate-900 text-sm">
                {selectedReviewTeacher.full_name}
              </p>
              <p className="text-[11px] text-slate-500">
                NPP: {selectedReviewTeacher.nip && !selectedReviewTeacher.nip.startsWith('NIP_') ? selectedReviewTeacher.nip : '-'} • {selectedReviewTeacher.position || 'Tenaga Pendidik'}
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1 text-slate-700">
                <span className="font-bold px-2 py-0.5 bg-blue-100 text-blue-900 rounded text-[10px]">
                  {selectedReviewLeave.leave_type}
                </span>
                <span className="font-bold">
                  📅 {selectedReviewLeave.start_date} s/d {selectedReviewLeave.end_date}
                </span>
              </div>

              <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Alasan / Keterangan:</span>
                <p className="text-slate-800 italic">"{selectedReviewLeave.reason}"</p>
              </div>

              {selectedReviewLeave.attachment_url && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPreviewAttachment({
                        url: selectedReviewLeave.attachment_url!,
                        title: `Lampiran Bukti Izin - ${selectedReviewTeacher.full_name}`,
                      });
                    }}
                    className="w-full py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl font-bold text-xs border border-emerald-200 flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>📎</span> Buka Lampiran Surat Dokter / Dokumen
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              Catatan Persetujuan / Alasan Penolakan
            </label>
            <textarea
              rows={3}
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Tuliskan catatan opsional atau alasan bila ditolak..."
              className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="secondary"
              className="w-1/3"
              onClick={() => {
                setSelectedReviewLeave(null);
                setSelectedReviewTeacher(null);
                setReviewNotes('');
                setReviewErrorMsg(null);
              }}
            >
              Batal
            </Button>
            <Button
              variant="danger"
              className="w-1/3"
              isLoading={isReviewLoading}
              onClick={() => handleQuickDecision('REJECTED')}
            >
              Tolak
            </Button>
            <Button
              variant="primary"
              className="w-1/3"
              isLoading={isReviewLoading}
              onClick={() => handleQuickDecision('APPROVED')}
            >
              Setujui
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Preview Berkas Lampiran Surat Dokter / Dokumen */}
      <Modal
        isOpen={Boolean(selectedPreviewAttachment)}
        onClose={() => setSelectedPreviewAttachment(null)}
        title={selectedPreviewAttachment?.title || '📎 Lampiran Dokumen'}
      >
        <div className="space-y-4">
          {selectedPreviewAttachment?.url && (
            <div className="max-h-[70vh] overflow-auto rounded-2xl border border-slate-200 bg-slate-50 flex items-center justify-center p-2">
              {selectedPreviewAttachment.url.startsWith('data:application/pdf') || selectedPreviewAttachment.url.toLowerCase().endsWith('.pdf') ? (
                <iframe
                  src={selectedPreviewAttachment.url}
                  title="Lampiran PDF"
                  className="w-full h-96 rounded-xl border border-slate-200"
                />
              ) : (
                <img
                  src={selectedPreviewAttachment.url}
                  alt="Lampiran Surat Bukti"
                  className="max-w-full max-h-96 object-contain rounded-xl shadow-xs"
                />
              )}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="secondary" onClick={() => setSelectedPreviewAttachment(null)}>
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Modal Reset Presensi Harian dengan Password Admin */}
      <AttendanceResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        teachers={teachers}
        selectedTeacherId={resetModalTeacher?.id}
        selectedDate={selectedDate}
        onSuccess={() => {
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('smart_absensi_records_updated'));
          }
        }}
      />
    </div>
  );
};
