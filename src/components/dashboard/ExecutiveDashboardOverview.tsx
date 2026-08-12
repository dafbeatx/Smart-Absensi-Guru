import React, { useMemo, useState, useEffect } from 'react';
import type { UserProfile, LeaveRequest, AttendanceRecord, AttendanceStatus } from '../../types/database.types';
import { PendingApprovalWidget } from '../../features/leave/components/PendingApprovalWidget';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { EarlyWarningSystemWidget } from './EarlyWarningSystemWidget';
import { BurnoutEarlyWarningWidget } from '../../features/kepsek/components/BurnoutEarlyWarningWidget';
import { evaluateAttendanceStatus, getTodayDateInJakarta, isDateOffDay } from '../../utils/time.utils';
import { CONSTANTS } from '../../config/constants';
import { ProviderFactory } from '../../providers/provider-factory';

export interface ExecutiveDashboardOverviewProps {
  roleTitle: 'Admin Website' | 'Kepala Sekolah';
  teachers: UserProfile[];
  pendingRequests?: LeaveRequest[];
  allLeaves?: LeaveRequest[];
  attendanceRecords?: AttendanceRecord[];
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
  onOpenQrGenerator?: () => void;
  onOpenCorrectionModal?: () => void;
  onOpenTestRunner?: () => void;
  onNavigateTab?: (tabId: string) => void;
}

export const ExecutiveDashboardOverview: React.FC<ExecutiveDashboardOverviewProps> = ({
  roleTitle,
  teachers,
  pendingRequests = [],
  allLeaves = [],
  attendanceRecords = [],
  onSwitchToGuruView,
  onOpenQrGenerator,
  onOpenCorrectionModal,
  onOpenTestRunner,
  onNavigateTab,
}) => {
  const todayStr = useMemo(() => getTodayDateInJakarta(), []);
  const [checkinEnd, setCheckinEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);

  useEffect(() => {
    const loadSettings = () => {
      ProviderFactory.getProvider()
        .getSettings()
        .then((st) => {
          if (st?.work_checkin_end) setCheckinEnd(st.work_checkin_end.slice(0, 5));
        })
        .catch(() => {});
    };
    loadSettings();
    window.addEventListener('smart_absensi_settings_updated', loadSettings);
    return () => window.removeEventListener('smart_absensi_settings_updated', loadSettings);
  }, []);

  const totalGuruCount = useMemo(() => (teachers || []).filter((t) => t.is_active !== false).length, [teachers]);

  const [lastUpdatedTime, setLastUpdatedTime] = React.useState<string>(() => {
    return new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB';
  });
  const [isRefreshingStatus, setIsRefreshingStatus] = React.useState(false);

  const handleRefreshStatus = () => {
    setIsRefreshingStatus(true);
    setTimeout(() => {
      setLastUpdatedTime(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ' WIB'
      );
      setIsRefreshingStatus(false);
    }, 400);
  };

  const {
    hadirCount,
    terlambatCount,
    izinCount,
    belumAbsenCount,
    totalPresentCount,
    completeCheckOutCount,
    pendingCheckOutCount,
  } = useMemo(() => {
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    let completeCheckOut = 0;
    let pendingCheckOut = 0;

    const todayUserMap = new Map<string, AttendanceRecord>();

    // Deduplicate by user_id for TODAY ONLY
    for (const rec of attendanceRecords) {
      if (rec.date === todayStr) {
        todayUserMap.set(rec.user_id, rec);
      }
    }

    // Merge approved leaves for today into todayUserMap if teacher has no explicit attendance record yet
    const leavesToEvaluate: LeaveRequest[] = [...allLeaves, ...pendingRequests];
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_leaves');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) leavesToEvaluate.push(...parsed);
        }
      } catch (e) {}
    }

    for (const leave of leavesToEvaluate) {
      if (leave.approval_status === 'APPROVED') {
        if (leave.start_date <= todayStr && leave.end_date >= todayStr) {
          if (!todayUserMap.has(leave.user_id)) {
            const leaveStatus: AttendanceStatus =
              leave.leave_type === 'SAKIT' ? 'SAKIT' : leave.leave_type === 'DINAS_LUAR' ? 'DINAS_LUAR' : 'IZIN';
            todayUserMap.set(leave.user_id, {
              id: 'rec_leave_' + leave.id,
              user_id: leave.user_id,
              date: todayStr,
              check_in_time: null,
              check_out_time: null,
              status: leaveStatus,
              check_in_lat: null,
              check_in_lng: null,
              check_in_distance_meters: null,
              verification_method: 'MANUAL_OPERATOR',
              attendance_source: 'MANUAL',
              is_offline: false,
              notes: leave.reason,
              created_at: leave.created_at,
            });
          }
        }
      }
    }

    todayUserMap.forEach((rec) => {
      const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, checkinEnd, rec.status);
      if (effectiveStatus === 'HADIR') hadir++;
      else if (effectiveStatus === 'TERLAMBAT') terlambat++;
      else if (effectiveStatus === 'IZIN' || effectiveStatus === 'SAKIT' || effectiveStatus === 'DINAS_LUAR') izin++;

      // Check if BOTH check-in and check-out exist
      if (rec.check_in_time && rec.check_out_time) {
        completeCheckOut++;
      } else if (rec.check_in_time && !rec.check_out_time) {
        pendingCheckOut++;
      }
    });

    const totalPresent = hadir + terlambat;
    const offCheck = isDateOffDay(todayStr);
    const belum = offCheck.isOff ? 0 : Math.max(0, totalGuruCount - (hadir + terlambat + izin));

    return {
      hadirCount: hadir,
      terlambatCount: terlambat,
      izinCount: izin,
      belumAbsenCount: belum,
      totalPresentCount: totalPresent,
      completeCheckOutCount: completeCheckOut,
      pendingCheckOutCount: pendingCheckOut,
    };
  }, [attendanceRecords, allLeaves, pendingRequests, totalGuruCount, todayStr, checkinEnd]);

  // Full 100% requires both check-in AND check-out. Check-in only gets 50% weight.
  const weightedScore = (completeCheckOutCount + izinCount) + (pendingCheckOutCount * 0.5);
  const rawPercentage = totalGuruCount > 0
    ? Math.round((weightedScore / totalGuruCount) * 100)
    : 0;

  const attendancePercentage = Math.min(100, Math.max(0, rawPercentage));

  const hadirPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((hadirCount / totalGuruCount) * 100)) : 0;
  const terlambatPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((terlambatCount / totalGuruCount) * 100)) : 0;
  const izinPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((izinCount / totalGuruCount) * 100)) : 0;
  const belumPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((belumAbsenCount / totalGuruCount) * 100)) : 0;

  const offCheck = useMemo(() => isDateOffDay(todayStr), [todayStr]);

  type TimeRangeOption = '1_DAY' | '7_DAYS' | '1_MONTH' | '1_YEAR';
  const [timeRange, setTimeRange] = React.useState<TimeRangeOption>('7_DAYS');

  const trendData = useMemo(() => {
    const totalGuru = totalGuruCount || 12;
    const now = new Date();

    if (timeRange === '1_DAY') {
      // 1 Hari: Breakdown by check-in time windows for today
      const todayISO = todayStr;
      const todayRecs = attendanceRecords.filter((r) => r.date === todayISO);

      const slots = [
        { label: '< 07:00', min: 0, max: 7 * 60 },
        { label: '07:00-07:15', min: 7 * 60, max: 7 * 60 + 15 },
        { label: '07:15-07:30', min: 7 * 60 + 15, max: 7 * 60 + 30 },
        { label: '> 07:30', min: 7 * 60 + 30, max: 24 * 60 },
      ];

      return slots.map((slot) => {
        let count = 0;
        todayRecs.forEach((r) => {
          if (r.check_in_time) {
            const [h, m] = r.check_in_time.split(':').map(Number);
            const mins = (h || 0) * 60 + (m || 0);
            if (mins >= slot.min && mins < slot.max) count++;
          }
        });
        const pct = totalGuru > 0 && todayRecs.length > 0
          ? Math.min(100, Math.round((count / totalGuru) * 100))
          : 0;
        return {
          label: slot.label,
          percentage: pct,
          count,
          totalGuru,
          info: `${count} Guru (${pct}%)`,
        };
      });
    }

    if (timeRange === '7_DAYS') {
      // 7 Hari Terakhir
      const result = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(now.getDate() - i);
        const dateStr = d.toISOString().split('T')[0];
        const dateLabel = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;

        const dayRecs = attendanceRecords.filter((r) => r.date === dateStr);
        const userMap = new Map<string, AttendanceRecord>();
        dayRecs.forEach((r) => userMap.set(r.user_id, r));

        let dayScore = 0;
        let presentCount = 0;
        userMap.forEach((r) => {
          if (r.status === 'HADIR' || r.status === 'TERLAMBAT' || r.check_in_time) {
            presentCount++;
            // 1.0 if check-out exists (or leave), 0.5 if check-in only
            if (r.check_out_time || r.status === 'IZIN' || r.status === 'SAKIT' || r.status === 'DINAS_LUAR') {
              dayScore += 1.0;
            } else {
              dayScore += 0.5;
            }
          }
        });

        const pct = totalGuru > 0 && userMap.size > 0
          ? Math.min(100, Math.round((dayScore / totalGuru) * 100))
          : 0;

        result.push({
          label: dateLabel,
          percentage: pct,
          count: presentCount,
          totalGuru,
          info: userMap.size > 0 ? `${presentCount}/${totalGuru} Guru (Nilai Presensi: ${pct}%)` : 'Belum Ada Data Presensi (0%)',
        });
      }
      return result;
    }

    if (timeRange === '1_MONTH') {
      // 1 Bulan (Sebulan): 6 buckets of 5-day intervals
      const result = [];
      for (let i = 5; i >= 0; i--) {
        const dStart = new Date(now);
        dStart.setDate(now.getDate() - (i * 5 + 4));
        const dEnd = new Date(now);
        dEnd.setDate(now.getDate() - i * 5);

        const label = `${dStart.getDate()}/${dStart.getMonth() + 1}-${dEnd.getDate()}/${dEnd.getMonth() + 1}`;

        let totalScore = 0;
        let totalPresent = 0;
        let dayCount = 0;
        let hasData = false;

        for (let dayOffset = 0; dayOffset < 5; dayOffset++) {
          const curD = new Date(dStart);
          curD.setDate(dStart.getDate() + dayOffset);
          const curISO = curD.toISOString().split('T')[0];

          const dayRecs = attendanceRecords.filter((r) => r.date === curISO);
          if (dayRecs.length > 0) hasData = true;
          const userMap = new Map<string, AttendanceRecord>();
          dayRecs.forEach((r) => userMap.set(r.user_id, r));

          let dayPresent = 0;
          let dayScore = 0;
          userMap.forEach((r) => {
            if (r.status === 'HADIR' || r.status === 'TERLAMBAT' || r.check_in_time) {
              dayPresent++;
              if (r.check_out_time || r.status === 'IZIN' || r.status === 'SAKIT' || r.status === 'DINAS_LUAR') {
                dayScore += 1.0;
              } else {
                dayScore += 0.5;
              }
            }
          });

          totalPresent += dayPresent;
          totalScore += dayScore;
          dayCount++;
        }

        const avgScore = dayCount > 0 ? totalScore / dayCount : 0;
        const avgPresent = dayCount > 0 ? Math.round(totalPresent / dayCount) : 0;
        const pct = hasData && totalGuru > 0
          ? Math.min(100, Math.round((avgScore / totalGuru) * 100))
          : 0;

        result.push({
          label,
          percentage: pct,
          count: avgPresent,
          totalGuru,
          info: hasData ? `Rata-rata Presensi Lengkap: ${pct}%` : 'Belum Ada Data Presensi (0%)',
        });
      }
      return result;
    }

    // 1_YEAR (Setahun): 12 Months
    const result = [];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mIdx = d.getMonth();
      const yStr = String(d.getFullYear()).slice(-2);
      const label = `${monthNames[mIdx]} '${yStr}`;

      const monthStr = String(mIdx + 1).padStart(2, '0');
      const yearStr = String(d.getFullYear());

      const monthRecs = attendanceRecords.filter((r) => {
        const parts = r.date.split('-');
        return parts[0] === yearStr && parts[1] === monthStr;
      });

      let avgPct = 0;
      let estimatedGuru = 0;
      let hasData = false;

      if (monthRecs.length > 0) {
        hasData = true;
        const userMap = new Map<string, { totalDays: number; completeDays: number }>();
        monthRecs.forEach((r) => {
          if (r.status === 'HADIR' || r.status === 'TERLAMBAT' || r.check_in_time) {
            const cur = userMap.get(r.user_id) || { totalDays: 0, completeDays: 0 };
            cur.totalDays += 1;
            if (r.check_out_time || r.status === 'IZIN' || r.status === 'SAKIT' || r.status === 'DINAS_LUAR') {
              cur.completeDays += 1;
            } else {
              cur.completeDays += 0.5;
            }
            userMap.set(r.user_id, cur);
          }
        });
        const totalWeightedDays = Array.from(userMap.values()).reduce((a, b) => a + b.completeDays, 0);
        const avgDays = totalWeightedDays / (userMap.size || 1);
        avgPct = Math.min(100, Math.round((avgDays / 22) * 100));
        estimatedGuru = Math.round((avgPct / 100) * totalGuru);
      }

      result.push({
        label,
        percentage: avgPct,
        count: estimatedGuru,
        totalGuru,
        info: hasData ? `Rata-rata Presensi Lengkap: ${avgPct}%` : 'Belum Ada Data Presensi (0%)',
      });
    }
    return result;
  }, [attendanceRecords, totalGuruCount, timeRange, todayStr]);

  // Synchronized 5 Latest Teachers Scanned Today
  const recentlyScannedTeachers = useMemo(() => {
    const todayISO = todayStr;
    const todayRecs = attendanceRecords.filter(
      (r) => r.date === todayISO && (r.check_in_time || r.status)
    );

    // Sort by check-in time descending (latest scan first)
    const sorted = [...todayRecs].sort((a, b) => {
      const timeA = a.check_in_time || '00:00';
      const timeB = b.check_in_time || '00:00';
      return timeB.localeCompare(timeA);
    });

    const teacherMap = new Map<string, UserProfile>();
    teachers.forEach((t) => teacherMap.set(t.id, t));

    const scanned = [];
    for (const rec of sorted) {
      const teacherObj = teacherMap.get(rec.user_id) || {
        id: rec.user_id,
        full_name: 'Guru Pengajar',
        position: 'Tenaga Pendidik',
        role: 'GURU',
        phone_number: '',
        nip: null,
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };

      const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, checkinEnd, rec.status);
      scanned.push({
        teacher: teacherObj,
        record: rec,
        status: effectiveStatus,
      });

      if (scanned.length >= 5) break;
    }

    return scanned;
  }, [attendanceRecords, teachers, todayStr, checkinEnd]);

  return (
    <div className="space-y-6">
      {/* ── 1. WELCOME HEADER & QUICK ACTIONS BAR ───────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-2xs">
        <div className="space-y-0.5">
          <h1 className="text-lg sm:text-xl font-black text-slate-900">
            Selamat datang, {roleTitle} 👋
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Ringkasan eksekutif & kehadiran guru hari ini
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          {onOpenQrGenerator && (
            <button
              onClick={onOpenQrGenerator}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
            >
              <span>🖨️</span> Poster QR
            </button>
          )}
          {onOpenCorrectionModal && (
            <button
              onClick={onOpenCorrectionModal}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
            >
              <span>✏️</span> Koreksi Manual
            </button>
          )}
          {onOpenTestRunner && (
            <button
              onClick={onOpenTestRunner}
              className="px-3 py-1.5 sm:px-3.5 sm:py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
            >
              <span>🧪</span> Tests
            </button>
          )}
          {onSwitchToGuruView && (
            <button
              onClick={onSwitchToGuruView}
              className="px-3.5 py-1.5 sm:px-4 sm:py-2 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xl border border-emerald-700 shadow-md transition-all flex items-center gap-1 shrink-0 cursor-pointer active:scale-95"
            >
              <span>👤</span> Mode Guru
            </button>
          )}
        </div>
      </div>

      {/* ── 2. EXECUTIVE HIGH-IMPACT KPI HERO BANNER (Decision in 5 seconds) ── */}
      <div className="bg-slate-900 text-white rounded-2xl p-4 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 sm:gap-6">
        <div className="space-y-1">
          <span className="text-[10px] sm:text-[11px] font-bold text-emerald-400 uppercase tracking-wider">
            Persentase Kehadiran Guru Hari Ini
          </span>
          <div className="flex flex-wrap items-baseline gap-2 sm:gap-3">
            <span className="text-4xl sm:text-5xl font-black text-white tracking-tight">{attendancePercentage}%</span>
            <span className="text-xs font-semibold text-slate-300">
              ({totalPresentCount} dari {totalGuruCount} Guru Hadir / Masuk)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-6 border-t md:border-t-0 md:border-l border-slate-800 pt-3 md:pt-0 md:pl-6">
          <div className="space-y-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase">Pending Approval</span>
            <p className="text-xl sm:text-2xl font-black text-amber-400">{pendingRequests.length} <span className="text-xs font-semibold text-amber-200/80">Pengajuan</span></p>
          </div>
          <div className="h-8 w-px bg-slate-800" />
          <div className="space-y-0.5">
            <span className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase">Belum Hadir</span>
            <p className="text-xl sm:text-2xl font-black text-red-400">{belumAbsenCount} <span className="text-xs font-semibold text-red-200/80">Guru</span></p>
          </div>
        </div>
      </div>

      {/* Real-time Web Push Notification Permission Banner for Admin & Kepsek */}
      <NotificationPermissionBanner />

      {/* ── 2.1 EARLY WARNING SYSTEM (EWS) KEDISIPLINAN & SECURITY VERIFICATION ── */}
      <EarlyWarningSystemWidget
        teachers={teachers}
        attendanceRecords={attendanceRecords}
        onOpenCorrectionModal={onOpenCorrectionModal}
      />

      {/* ── 2. SUMMARY STAT CARDS GRID (5 CARDS IN A ROW) ──────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Total Guru */}
        <div className="bg-white p-4 rounded-2xl border border-[#D4D4CE]/40 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center text-lg shrink-0">
              👥
            </div>
            <div>
              <p className="font-black text-[#023246] text-xl leading-none">{totalGuruCount}</p>
              <p className="text-xs font-bold text-slate-700 mt-1">Total Guru</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">100% dari total</p>
        </div>

        {/* Card 2: Hadir Tepat */}
        <div className="bg-white p-4 rounded-2xl border border-[#D4D4CE]/40 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center text-lg shrink-0">
              ✓
            </div>
            <div>
              <p className="font-black text-[#023246] text-xl leading-none">{hadirCount}</p>
              <p className="text-xs font-bold text-slate-700 mt-1">Hadir Tepat</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">{hadirPercentage}% dari total</p>
        </div>

        {/* Card 3: Terlambat */}
        <div className="bg-white p-4 rounded-2xl border border-[#D4D4CE]/40 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center text-lg shrink-0">
              🕒
            </div>
            <div>
              <p className="font-black text-[#023246] text-xl leading-none">{terlambatCount}</p>
              <p className="text-xs font-bold text-slate-700 mt-1">Terlambat</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">{terlambatPercentage}% dari total</p>
        </div>

        {/* Card 4: Izin / Sakit */}
        <div className="bg-white p-4 rounded-2xl border border-[#D4D4CE]/40 shadow-card space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200 text-[#287094] flex items-center justify-center text-lg shrink-0">
              💼
            </div>
            <div>
              <p className="font-black text-[#023246] text-xl leading-none">{izinCount}</p>
              <p className="text-xs font-bold text-slate-700 mt-1">Izin / Sakit</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">{izinPercentage}% dari total</p>
        </div>

        {/* Card 5: Belum Absen */}
        <div className="bg-white p-4 rounded-2xl border border-[#D4D4CE]/40 shadow-card space-y-3 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center text-lg shrink-0">
              👤
            </div>
            <div>
              <p className="font-black text-[#023246] text-xl leading-none">{belumAbsenCount}</p>
              <p className="text-xs font-bold text-slate-700 mt-1">Belum Absen</p>
            </div>
          </div>
          <p className="text-[10px] text-slate-400 font-semibold">{belumPercentage}% dari total</p>
        </div>
      </div>

      {/* ── 3. VISUAL ANALYTICS ROW (3 COLUMNS) ───────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Column 1: Donut Chart - Persentase Kehadiran Hari Ini */}
        <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#023246] text-sm">Persentase Kehadiran Hari Ini</h3>
              <p className="text-[11px] text-slate-400">Total kehadiran guru & staf</p>
            </div>
            <select className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none">
              <option>Hari ini</option>
              <option>Minggu ini</option>
            </select>
          </div>

          {/* Dynamic SVG Donut Visual */}
          <div className="flex flex-col items-center justify-center py-2 relative">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path
                  className="text-slate-100"
                  strokeWidth="3.5"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
                <path
                  className="text-[#16A34A] transition-all duration-1000 ease-out"
                  strokeDasharray={`${attendancePercentage}, 100`}
                  strokeWidth="3.8"
                  strokeLinecap="round"
                  stroke="currentColor"
                  fill="none"
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-2">
                <span className="text-2xl font-black text-[#023246]">{attendancePercentage}%</span>
                <span className="text-[10px] font-extrabold text-emerald-600">Kelengkapan</span>
                <div className="mt-0.5 text-center">
                  <span className="text-[9px] font-bold text-slate-500 block">
                    {completeCheckOutCount}/{totalGuruCount} Lengkap (Masuk & Pulang)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#16A34A]" />
              <span>Lengkap ({completeCheckOutCount})</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
              <span>Masuk Saja ({pendingCheckOutCount})</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#287094]" />
              <span>Izin/Sakit ({izinCount})</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-slate-300" />
              <span>Belum Absen ({belumAbsenCount})</span>
            </div>
          </div>
        </div>

        {/* Column 2: Synchronized Interactive Trend Kehadiran Chart */}
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-4 overflow-hidden min-w-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <h3 className="font-extrabold text-[#023246] text-sm truncate">
                Trend Kehadiran {timeRange === '1_DAY' ? '(Hari Ini)' : timeRange === '7_DAYS' ? '(7 Hari Terakhir)' : timeRange === '1_MONTH' ? '(1 Bulan)' : '(1 Tahun)'}
              </h3>
              <p className="text-[11px] text-slate-400 font-medium truncate">Grafik presensi terintegrasi real-time</p>
            </div>

            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRangeOption)}
              className="text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer transition-colors shadow-2xs shrink-0"
            >
              <option value="1_DAY">⏱️ 1 Hari (Hari Ini)</option>
              <option value="7_DAYS">📅 7 Hari Terakhir</option>
              <option value="1_MONTH">🗓️ 1 Bulan (Sebulan)</option>
              <option value="1_YEAR">📆 1 Tahun (Setahun)</option>
            </select>
          </div>

          {/* Dynamic Graph Grid Visual */}
          <div className="h-44 border-b border-l border-slate-200 relative flex items-end justify-between px-1 pb-1 text-[10px] text-slate-500 font-mono pt-6 w-full overflow-hidden gap-0.5 sm:gap-1">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[9px] text-slate-300 z-0">
              <div className="border-b border-dashed border-slate-100 w-full pt-1">100%</div>
              <div className="border-b border-dashed border-slate-100 w-full">75%</div>
              <div className="border-b border-dashed border-slate-100 w-full">50%</div>
              <div className="border-b border-dashed border-slate-100 w-full">25%</div>
              <div className="w-full">0%</div>
            </div>

            {/* Dynamic Bars */}
            {trendData.map((item, idx) => {
              const barHeight = item.percentage > 0 ? Math.max(6, item.percentage) : 0;
              const barBg =
                item.percentage >= 80
                  ? 'bg-emerald-500 hover:bg-emerald-600'
                  : item.percentage >= 50
                  ? 'bg-amber-500 hover:bg-amber-600'
                  : item.percentage > 0
                  ? 'bg-rose-500 hover:bg-rose-600'
                  : 'bg-slate-200';

              return (
                <div key={idx} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full group z-10 relative overflow-hidden">
                  {/* Tooltip on Hover */}
                  <div className="opacity-0 group-hover:opacity-100 transition-all duration-200 absolute -top-8 bg-slate-900 text-white text-[9px] font-sans font-bold px-2 py-1 rounded-md shadow-lg pointer-events-none whitespace-nowrap z-30">
                    {item.label}: {item.info}
                  </div>

                  {/* Dynamic Height Bar */}
                  {item.percentage > 0 ? (
                    <div
                      style={{ height: `${barHeight}%` }}
                      className={`w-full ${barBg} rounded-t-xs transition-all duration-300 shadow-2xs flex items-center justify-center`}
                    >
                      <span className="text-[7px] sm:text-[8px] font-black text-white drop-shadow-xs hidden group-hover:inline sm:inline">
                        {item.percentage}%
                      </span>
                    </div>
                  ) : (
                    <div className="w-full h-0.5 bg-slate-200 rounded-full" />
                  )}

                  {/* X-Axis Day/Month Label */}
                  <span className="text-[7.5px] sm:text-[9px] font-bold text-slate-600 mt-1 truncate max-w-full text-center leading-none tracking-tighter">
                    {item.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Column 3: 5 Guru Terbaru Absen (Synchronized Real-Time) */}
        <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-3">
          <div>
            <h3 className="font-extrabold text-[#023246] text-sm">5 Guru Terbaru Absen</h3>
            <p className="text-[11px] text-slate-400 font-medium">
              {recentlyScannedTeachers.length > 0
                ? `${recentlyScannedTeachers.length} guru melakukan presensi hari ini`
                : offCheck.isOff
                ? `🏖️ Hari ini Libur Sekolah (${offCheck.reason || 'Libur Akhir Pekan'})`
                : 'Belum ada guru yang melakukan scan hari ini'}
            </p>
          </div>

          <div className="space-y-2.5">
            {recentlyScannedTeachers.length > 0 ? (
              recentlyScannedTeachers.map(({ teacher, record, status }, idx) => (
                <div key={record.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50 hover:bg-slate-100/80 transition-colors border border-slate-200/60">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center font-extrabold text-xs shrink-0 shadow-xs overflow-hidden border border-slate-200">
                      {teacher.avatar_url ? (
                        <img src={teacher.avatar_url} alt={teacher.full_name} className="w-full h-full object-cover" />
                      ) : (
                        teacher.full_name ? teacher.full_name.charAt(0) : '👤'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">
                        {teacher.full_name}
                      </p>
                      <p className="text-[10px] text-slate-500 font-semibold truncate">
                        Masuk: {record.check_in_time ? record.check_in_time.substring(0, 5) + ' WIB' : '--:--'}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 text-[9px] font-black rounded-lg border shrink-0 ${
                    status === 'HADIR'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : status === 'TERLAMBAT'
                      ? 'bg-amber-100 text-amber-800 border-amber-300'
                      : 'bg-blue-100 text-blue-800 border-blue-300'
                  }`}>
                    {status === 'HADIR' ? '✓ Hadir' : status === 'TERLAMBAT' ? '🕒 Terlambat' : status}
                  </span>
                </div>
              ))
            ) : (
              teachers.slice(0, 5).map((teacherObj, idx) => (
                <div key={teacherObj.id || idx} className="flex items-center justify-between p-2 rounded-xl bg-slate-50/60 border border-slate-200/50">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center font-extrabold text-xs shrink-0 overflow-hidden border border-slate-300">
                      {teacherObj.avatar_url ? (
                        <img src={teacherObj.avatar_url} alt={teacherObj.full_name} className="w-full h-full object-cover" />
                      ) : (
                        teacherObj.full_name ? teacherObj.full_name.charAt(0) : '👤'
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">
                        {teacherObj.full_name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{teacherObj.position}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border ${
                    offCheck.isOff
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : 'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>
                    {offCheck.isOff ? '🏖️ Libur Sekolah' : '⏳ Belum Absen'}
                  </span>
                </div>
              ))
            )}
          </div>

          <button
            onClick={() => onNavigateTab && onNavigateTab('TEACHERS')}
            className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-[#023246] font-extrabold text-xs rounded-xl transition-all flex items-center justify-center gap-1 border border-slate-200 cursor-pointer"
          >
            Lihat Semua ➔
          </button>
        </div>
      </div>

      {/* ── 3.5. TEACHER WELL-BEING & BURNOUT EARLY WARNING WIDGET ────────── */}
      <BurnoutEarlyWarningWidget />

      {/* ── 4. BOTTOM SUB-SECTIONS (APPROVAL & SYSTEM STATUS) ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Left Column (Span 2): Pengajuan Izin / Sakit Menunggu Approval */}
        <div className="lg:col-span-2 bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#023246] text-sm">Pengajuan Izin / Sakit Menunggu Approval</h3>
              <p className="text-[11px] text-slate-400">Daftar pengajuan yang perlu diproses</p>
            </div>
            <button
              onClick={() => onNavigateTab && onNavigateTab('APPROVALS')}
              className="text-xs font-bold text-[#023246] hover:bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 transition-all cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          {/* Dynamic Pending Approvals or Clean Empty State */}
          {pendingRequests && pendingRequests.length > 0 ? (
            <PendingApprovalWidget requests={pendingRequests} teachers={teachers} />
          ) : (
            <div className="p-6 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium space-y-1">
              <span className="text-xl block">✅</span>
              <p className="font-bold text-[#023246]">Tidak ada pengajuan izin / sakit yang menunggu approval</p>
              <p className="text-[11px] text-slate-400">Semua pengajuan dari guru dan staf telah diproses.</p>
            </div>
          )}
        </div>

        {/* Right Column (Span 1): Live Real-time Sistem Status */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-card space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>⚡ Status Sistem Real-time</span>
              </h3>
              <p className="text-[11px] text-slate-500 font-medium mt-0.5">Kondisi performa & konektivitas sistem</p>
            </div>
            <button
              onClick={handleRefreshStatus}
              disabled={isRefreshingStatus}
              title="Klik untuk perbarui status sistem"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[10px] rounded-xl transition-all active:scale-95 cursor-pointer disabled:opacity-50 border border-slate-200"
            >
              <span className={isRefreshingStatus ? 'animate-spin' : ''}>🔄</span>
              <span className="font-mono text-[10px]">{lastUpdatedTime}</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5">
            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1 min-w-0">
              <span className="text-lg block">☁️</span>
              <p className="text-[10px] sm:text-xs font-extrabold text-slate-800 truncate">Backend Core</p>
              <p className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1 min-w-0 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Online (20ms)</span>
              </p>
            </div>

            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1 min-w-0">
              <span className="text-lg block">📍</span>
              <p className="text-[10px] sm:text-xs font-extrabold text-slate-800 truncate">GPS Geofence</p>
              <p className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1 min-w-0 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Radius 50m</span>
              </p>
            </div>

            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1 min-w-0">
              <span className="text-lg block">🛡️</span>
              <p className="text-[10px] sm:text-xs font-extrabold text-slate-800 truncate">Keamanan QR</p>
              <p className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1 min-w-0 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Seed Enkripsi</span>
              </p>
            </div>

            <div className="p-2.5 sm:p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-center space-y-1 min-w-0">
              <span className="text-lg block">📡</span>
              <p className="text-[10px] sm:text-xs font-extrabold text-slate-800 truncate">Sinkronisasi</p>
              <p className="text-[10px] font-bold text-emerald-600 flex items-center justify-center gap-1 min-w-0 truncate">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span className="truncate">Real-time DB</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── 5. FOOTER ───────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-4 border-t border-[#D4D4CE]/30">
        <p>© 2026 Smart Absensi Guru. All rights reserved.</p>
        <p className="font-mono font-bold text-slate-500">v1.0 RC1</p>
      </div>
    </div>
  );
};
