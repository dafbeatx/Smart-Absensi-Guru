import React, { useMemo } from 'react';
import type { UserProfile, LeaveRequest, AttendanceRecord } from '../../types/database.types';
import { PendingApprovalWidget } from '../../features/leave/components/PendingApprovalWidget';
import { NotificationPermissionBanner } from './NotificationPermissionBanner';
import { evaluateAttendanceStatus, getTodayDateInJakarta } from '../../utils/time.utils';

export interface ExecutiveDashboardOverviewProps {
  roleTitle: 'Admin Website' | 'Kepala Sekolah';
  teachers: UserProfile[];
  pendingRequests?: LeaveRequest[];
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
  attendanceRecords = [],
  onSwitchToGuruView,
  onOpenQrGenerator,
  onOpenCorrectionModal,
  onOpenTestRunner,
  onNavigateTab,
}) => {
  const todayStr = getTodayDateInJakarta();
  const totalGuruCount = teachers.length > 0 ? teachers.length : 12;

  const { hadirCount, terlambatCount, izinCount, belumAbsenCount, totalPresentCount } = useMemo(() => {
    let hadir = 0;
    let terlambat = 0;
    let izin = 0;
    const todayUserMap = new Map<string, AttendanceRecord>();

    // Deduplicate by user_id for TODAY ONLY
    for (const rec of attendanceRecords) {
      if (rec.date === todayStr) {
        todayUserMap.set(rec.user_id, rec);
      }
    }

    todayUserMap.forEach((rec) => {
      const effectiveStatus = evaluateAttendanceStatus(rec.check_in_time, '07:15', rec.status);
      if (effectiveStatus === 'HADIR') hadir++;
      else if (effectiveStatus === 'TERLAMBAT') terlambat++;
      else if (effectiveStatus === 'IZIN' || effectiveStatus === 'SAKIT' || effectiveStatus === 'DINAS_LUAR') izin++;
    });

    const totalPresent = hadir + terlambat;
    const belum = Math.max(0, totalGuruCount - (hadir + terlambat + izin));

    return {
      hadirCount: hadir,
      terlambatCount: terlambat,
      izinCount: izin,
      belumAbsenCount: belum,
      totalPresentCount: totalPresent,
    };
  }, [attendanceRecords, totalGuruCount, todayStr]);

  const rawPercentage = totalGuruCount > 0
    ? Math.round((totalPresentCount / totalGuruCount) * 100)
    : 0;

  const attendancePercentage = Math.min(100, Math.max(0, rawPercentage));

  const hadirPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((hadirCount / totalGuruCount) * 100)) : 0;
  const terlambatPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((terlambatCount / totalGuruCount) * 100)) : 0;
  const izinPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((izinCount / totalGuruCount) * 100)) : 0;
  const belumPercentage = totalGuruCount > 0 ? Math.min(100, Math.round((belumAbsenCount / totalGuruCount) * 100)) : 0;

  // Teachers list from Users sheet
  const recentTeachers = teachers.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* ── 1. WELCOME HEADER & QUICK ACTIONS BAR ───────────────────────────── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-xs">
        <div className="space-y-1">
          <h1 className="text-xl font-black text-[#023246]">
            Selamat datang, {roleTitle} 👋
          </h1>
          <p className="text-xs text-slate-500 font-medium">
            Ringkasan kehadiran guru & staf hari ini
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[10px] font-extrabold text-[#023246]/60 uppercase tracking-wider hidden xl:inline">
            Quick Actions
          </span>
          {onOpenQrGenerator && (
            <button
              onClick={onOpenQrGenerator}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#023246] text-xs font-bold rounded-xl border border-[#D4D4CE] shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>🖨️</span> Poster QR
            </button>
          )}
          {onOpenCorrectionModal && (
            <button
              onClick={onOpenCorrectionModal}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#023246] text-xs font-bold rounded-xl border border-[#D4D4CE] shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>✏️</span> Koreksi Manual
            </button>
          )}
          {onOpenTestRunner && (
            <button
              onClick={onOpenTestRunner}
              className="px-3.5 py-2 bg-white hover:bg-slate-50 text-[#023246] text-xs font-bold rounded-xl border border-[#D4D4CE] shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>🧪</span> Tests
            </button>
          )}
          {onSwitchToGuruView && (
            <button
              onClick={onSwitchToGuruView}
              className="px-4 py-2 bg-[#287094] hover:bg-[#023246] text-white text-xs font-bold rounded-xl border border-[#287094] shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <span>👤</span> Mode Guru
            </button>
          )}
        </div>
      </div>

      {/* Real-time Web Push Notification Permission Banner for Admin & Kepsek */}
      <NotificationPermissionBanner />

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
                <span className="text-[10px] font-bold text-emerald-600">Kehadiran</span>
                <div className="mt-0.5 text-center">
                  <span className="text-[10px] font-bold text-slate-500 block">{totalPresentCount}/{totalGuruCount} Guru</span>
                </div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#16A34A]" />
              <span>Hadir ({hadirCount})</span>
            </div>
            <div className="flex items-center gap-1.5 font-medium">
              <span className="w-2.5 h-2.5 rounded-xs bg-[#D97706]" />
              <span>Terlambat ({terlambatCount})</span>
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

        {/* Column 2: Line/Bar Chart - Trend Kehadiran (7 Hari Terakhir) */}
        <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#023246] text-sm">Trend Kehadiran (7 Hari Terakhir)</h3>
              <p className="text-[11px] text-slate-400">Perbandingan kehadiran harian</p>
            </div>
            <select className="text-xs font-bold text-slate-600 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 outline-none">
              <option>Hari ini</option>
            </select>
          </div>

          {/* Graph Grid Visual */}
          <div className="h-44 border-b border-l border-slate-200 relative flex items-end justify-between px-2 pb-1 text-[10px] text-slate-400 font-mono">
            {/* Horizontal Grid lines */}
            <div className="absolute inset-0 flex flex-col justify-between pointer-events-none text-[9px] text-slate-300">
              <div className="border-b border-dashed border-slate-100 w-full pt-1">100%</div>
              <div className="border-b border-dashed border-slate-100 w-full">75%</div>
              <div className="border-b border-dashed border-slate-100 w-full">50%</div>
              <div className="border-b border-dashed border-slate-100 w-full">25%</div>
              <div className="w-full">0%</div>
            </div>

            {/* X-Axis Days */}
            {['29/07', '30/07', '31/07', '01/08', '02/08', '03/08', '04/08'].map((day) => (
              <span key={day} className="z-10 bg-white/90 px-0.5">{day}</span>
            ))}
          </div>
        </div>

        {/* Column 3: 5 Guru Terbaru Absen / Belum Absen */}
        <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card flex flex-col justify-between space-y-3">
          <div>
            <h3 className="font-extrabold text-[#023246] text-sm">5 Guru Terbaru Absen</h3>
            <p className="text-[11px] text-slate-400">Belum ada yang absen hari ini</p>
          </div>

          <div className="space-y-2.5">
            {recentTeachers.length > 0 ? (
              recentTeachers.map((teacherObj, idx) => (
                <div key={teacherObj.id || idx} className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-[#023246]/10 text-[#023246] flex items-center justify-center font-extrabold text-xs">
                      {teacherObj.full_name ? teacherObj.full_name.charAt(0) : '👤'}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-800 truncate max-w-36">
                        {teacherObj.full_name}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">{teacherObj.position}</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 text-[10px] font-black rounded-full bg-[#023246] text-white">
                    Belum Absen
                  </span>
                </div>
              ))
            ) : (
              <div className="p-4 text-center text-xs text-slate-400">
                Belum ada data guru terdaftar di sheet Users.
              </div>
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
              onClick={() => onNavigateTab && onNavigateTab('TEACHERS')}
              className="text-xs font-bold text-[#023246] hover:bg-slate-50 px-3 py-1 rounded-lg border border-slate-200 transition-all cursor-pointer"
            >
              Lihat Semua
            </button>
          </div>

          {/* Dynamic Pending Approvals or Clean Empty State */}
          {pendingRequests && pendingRequests.length > 0 ? (
            <PendingApprovalWidget requests={pendingRequests} />
          ) : (
            <div className="p-6 text-center bg-slate-50/70 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium space-y-1">
              <span className="text-xl block">✅</span>
              <p className="font-bold text-[#023246]">Tidak ada pengajuan izin / sakit yang menunggu approval</p>
              <p className="text-[11px] text-slate-400">Semua pengajuan dari guru dan staf telah diproses.</p>
            </div>
          )}
        </div>

        {/* Right Column (Span 1): Sistem Status */}
        <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-extrabold text-[#023246] text-sm">Sistem Status</h3>
              <p className="text-[11px] text-slate-400">Kondisi sistem saat ini</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-slate-400 font-mono">
              <span>Terakhir diperbarui 09:24:15</span>
              <span className="text-xs">🔄</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
              <span className="text-lg block">☁️</span>
              <p className="text-[10px] font-bold text-[#023246]">Backend GAS</p>
              <p className="text-[9px] font-black text-emerald-600">● Online</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
              <span className="text-lg block">📑</span>
              <p className="text-[10px] font-bold text-[#023246]">Database Sheets</p>
              <p className="text-[9px] font-black text-emerald-600">● Tersinkronisasi</p>
            </div>

            <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 text-center space-y-1">
              <span className="text-lg block">🛡️</span>
              <p className="text-[10px] font-bold text-[#023246]">Keamanan QR</p>
              <p className="text-[9px] font-black text-emerald-600">● Aktif</p>
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
