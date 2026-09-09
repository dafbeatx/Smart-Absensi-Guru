import React, { useState, useMemo } from 'react';
import type { AttendanceRecord, UserProfile } from '../../../types/database.types';
import { Badge } from '../../../components/ui/Badge';
import { LocationAddressBadge } from '../../../components/ui/LocationAddressBadge';
import { timeToMinutes, getMonthWorkingDays } from '../../../utils/time.utils';

interface AttendanceRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceRecords: AttendanceRecord[];
  user: UserProfile;
  onOpenExportModal?: () => void;
  onOpenCorrectionModal?: (targetDate?: string) => void;
}

type RecapStep = 0 | 1 | 2; // 0: Ringkasan, 1: Analisis, 2: Riwayat

export const AttendanceRecapModal: React.FC<AttendanceRecapModalProps> = ({
  isOpen,
  onClose,
  attendanceRecords,
  user,
  onOpenExportModal,
  onOpenCorrectionModal,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activeStep, setActiveStep] = useState<RecapStep>(0);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // 1. Raw records for selected month & year
  const rawMonthRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      if (!rec.date) return false;
      const [yearStr, monthStr] = rec.date.split('-');
      return parseInt(yearStr, 10) === selectedYear && parseInt(monthStr, 10) === selectedMonth;
    }).sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [attendanceRecords, selectedMonth, selectedYear]);

  // 2. Filtered records for Step 3 (Riwayat)
  const filteredRecords = useMemo(() => {
    if (filterStatus === 'ALL') return rawMonthRecords;
    return rawMonthRecords.filter((rec) => {
      if (filterStatus === 'IZIN') {
        return rec.status === 'IZIN' || rec.status === 'SAKIT' || rec.status === 'DINAS_LUAR';
      }
      return rec.status === filterStatus;
    });
  }, [rawMonthRecords, filterStatus]);

  // 3. Working days & general stats calculation
  const stats = useMemo(() => {
    const workingDaysInfo = getMonthWorkingDays(selectedMonth, selectedYear, true);
    const totalHariKerja = Math.max(workingDaysInfo.totalMonthWorkingDays, rawMonthRecords.length, 20);

    const hadir = rawMonthRecords.filter((r) => r.status === 'HADIR').length;
    const terlambat = rawMonthRecords.filter((r) => r.status === 'TERLAMBAT').length;
    const izin = rawMonthRecords.filter(
      (r) => r.status === 'IZIN' || r.status === 'SAKIT' || r.status === 'DINAS_LUAR'
    ).length;
    const alfa = rawMonthRecords.filter((r) => r.status === 'ALFA').length;
    const totalPresensi = hadir + terlambat;
    const persentase = totalHariKerja > 0 ? Math.min(100, Math.round((totalPresensi / totalHariKerja) * 100)) : 0;

    let predicate = 'Perlu Ditingkatkan';
    let predicateColor = 'text-rose-600 bg-rose-50 border-rose-200';
    if (persentase >= 90) {
      predicate = 'Disiplin Prima (Sangat Baik)';
      predicateColor = 'text-emerald-700 bg-emerald-50 border-emerald-200';
    } else if (persentase >= 75) {
      predicate = 'Disiplin Baik (Konsisten)';
      predicateColor = 'text-blue-700 bg-blue-50 border-blue-200';
    }

    return {
      hadir,
      terlambat,
      izin,
      alfa,
      totalPresensi,
      totalHariKerja,
      persentase,
      predicate,
      predicateColor,
    };
  }, [rawMonthRecords, selectedMonth, selectedYear]);

  // 4. In-depth timing & discipline analytics for Step 2
  const timingAnalytics = useMemo(() => {
    const checkInTimes: number[] = [];
    const checkOutTimes: number[] = [];
    let totalLateMinutes = 0;
    const standardCheckInCutoff = 7 * 60; // 07:00 WIB

    rawMonthRecords.forEach((rec) => {
      if (rec.check_in_time) {
        const mins = timeToMinutes(rec.check_in_time);
        if (mins > 0) {
          checkInTimes.push(mins);
          if (mins > standardCheckInCutoff) {
            totalLateMinutes += (mins - standardCheckInCutoff);
          }
        }
      }
      if (rec.check_out_time) {
        const mins = timeToMinutes(rec.check_out_time);
        if (mins > 0) checkOutTimes.push(mins);
      }
    });

    const formatAvgTime = (minutesArray: number[], fallback: string) => {
      if (minutesArray.length === 0) return fallback;
      const avg = Math.round(minutesArray.reduce((a, b) => a + b, 0) / minutesArray.length);
      const h = Math.floor(avg / 60);
      const m = avg % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} WIB`;
    };

    const avgIn = formatAvgTime(checkInTimes, '--:--');
    const avgOut = formatAvgTime(checkOutTimes, '--:--');

    // Weekly consistency breakdown (5 blocks)
    const totalDaysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const weeks = [
      { name: 'Minggu 1', start: 1, end: Math.min(7, totalDaysInMonth) },
      { name: 'Minggu 2', start: 8, end: Math.min(14, totalDaysInMonth) },
      { name: 'Minggu 3', start: 15, end: Math.min(21, totalDaysInMonth) },
      { name: 'Minggu 4', start: 22, end: Math.min(28, totalDaysInMonth) },
      { name: 'Minggu 5', start: 29, end: totalDaysInMonth },
    ].filter((w) => w.start <= totalDaysInMonth);

    const weeklyProgress = weeks.map((w) => {
      const recordsInWeek = rawMonthRecords.filter((r) => {
        const d = parseInt(r.date.split('-')[2], 10);
        return d >= w.start && d <= w.end;
      });
      const attended = recordsInWeek.filter((r) => r.status === 'HADIR' || r.status === 'TERLAMBAT').length;
      return {
        name: w.name,
        range: `${w.start}-${w.end} ${monthNames[selectedMonth - 1].substring(0, 3)}`,
        attended,
        total: recordsInWeek.length || 5,
        ratio: Math.min(100, Math.round((attended / Math.max(recordsInWeek.length, 5)) * 100)),
      };
    });

    // Discipline estimated points earned this month
    const onTimePoints = stats.hadir * 15;
    const latePoints = stats.terlambat * 5;
    const estPoints = onTimePoints + latePoints;

    return {
      avgIn,
      avgOut,
      totalLateMinutes,
      weeklyProgress,
      estPoints,
      checkInCount: checkInTimes.length,
      checkOutCount: checkOutTimes.length,
    };
  }, [rawMonthRecords, selectedMonth, selectedYear, stats.hadir, stats.terlambat, monthNames]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      {/* Container dioptimalkan untuk mobile Infinix Note 8 (max-w-120, padding seimbang) */}
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col h-[92vh] sm:h-auto sm:max-h-[90vh]">
        
        {/* ── 1. HEADER MODAL (STICKY) ─────────────────────────────────────── */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0 shadow-xs">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-lg shadow-inner shrink-0">
              📊
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate text-white">
                Rekap & Statistik Presensi
              </h3>
              <p className="text-[11px] text-emerald-300 font-medium truncate">
                {user.full_name}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-full text-slate-200 transition-all cursor-pointer text-sm font-bold shrink-0"
            aria-label="Tutup modal"
          >
            ✕
          </button>
        </div>

        {/* ── 2. STEPPER BAR (NAVIGASI LAYER BERTINGKAT: ADA NEXT-NEXTNYA) ─── */}
        <div className="bg-slate-50 border-b border-slate-200/90 px-4 py-2.5 shrink-0">
          <div className="flex items-center justify-between gap-1 relative">
            {/* Connecting line */}
            <div className="absolute top-1/2 left-6 right-6 h-0.5 bg-slate-200 -translate-y-1/2 z-0" />
            
            {/* Step 1: Ringkasan */}
            <button
              type="button"
              onClick={() => setActiveStep(0)}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                activeStep === 0
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                activeStep === 0 ? 'bg-emerald-400 text-slate-900 font-black' : 'bg-slate-100 text-slate-500'
              }`}>
                1
              </span>
              <span>Ringkasan</span>
            </button>

            {/* Step 2: Analisis */}
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                activeStep === 1
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                activeStep === 1 ? 'bg-emerald-400 text-slate-900 font-black' : 'bg-slate-100 text-slate-500'
              }`}>
                2
              </span>
              <span>Analisis</span>
            </button>

            {/* Step 3: Riwayat */}
            <button
              type="button"
              onClick={() => setActiveStep(2)}
              className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer active:scale-95 ${
                activeStep === 2
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
              }`}
            >
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] ${
                activeStep === 2 ? 'bg-emerald-400 text-slate-900 font-black' : 'bg-slate-100 text-slate-500'
              }`}>
                3
              </span>
              <span>Riwayat</span>
            </button>
          </div>
        </div>

        {/* ── 3. FILTER BULAN & TAHUN (RINGKAS & BERSIH) ───────────────────── */}
        <div className="p-3 px-4 bg-white border-b border-slate-100 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-slate-500">Periode:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-[#023246]"
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="text-xs font-bold text-slate-800 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer focus:ring-1 focus:ring-[#023246]"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {onOpenExportModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenExportModal();
              }}
              className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
              title="Unduh Laporan"
            >
              <span>📥</span>
              <span className="hidden min-[380px]:inline">Unduh</span>
            </button>
          )}
        </div>

        {/* ── 4. KONTEN UTAMA STEPPER (SCROLLABLE DENGAN RUANG LEGA) ───────── */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1 bg-slate-50/50">
          
          {/* ═══════════════════════════════════════════════════════════════════
              LAYER 1: RINGKASAN & SKOR KEHADIRAN (OVERVIEW)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeStep === 0 && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Hero Card: Tingkat Kehadiran Bulanan */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400 block">
                      Tingkat Kehadiran
                    </span>
                    <h4 className="text-xl font-black text-[#023246] mt-0.5">
                      {monthNames[selectedMonth - 1]} {selectedYear}
                    </h4>
                  </div>
                  
                  {/* Radial / Progress Meter */}
                  <div className="w-14 h-14 rounded-2xl bg-emerald-50 border-2 border-emerald-500/30 flex flex-col items-center justify-center text-center shrink-0">
                    <span className="text-base font-black text-emerald-800 leading-none">
                      {stats.persentase}%
                    </span>
                    <span className="text-[9px] font-bold text-emerald-600 mt-0.5">Skor</span>
                  </div>
                </div>

                {/* Status Predikat */}
                <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${stats.predicateColor}`}>
                  <span className="flex items-center gap-1.5">
                    <span>🎖️</span>
                    <span>Predikat:</span>
                  </span>
                  <span className="font-extrabold">{stats.predicate}</span>
                </div>

                {/* Progress bar visual */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-semibold text-slate-500">
                    <span>Kehadiran Efektif</span>
                    <span>{stats.totalPresensi} dari {stats.totalHariKerja} Hari Kerja</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                    <div
                      className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, stats.persentase)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* 2x2 Grid Metrik Lega (Pas di Layar HP Infinix Note 8) */}
              <div className="grid grid-cols-2 gap-2.5">
                {/* 1. Hadir Tepat */}
                <div className="bg-white p-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                      Hadir Tepat
                    </span>
                    <span className="text-[10px] font-bold bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded-md">
                      {stats.totalHariKerja > 0 ? Math.round((stats.hadir / stats.totalHariKerja) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-2xl font-black text-emerald-800 font-mono">
                    {stats.hadir} <span className="text-xs font-semibold text-emerald-600">Hari</span>
                  </p>
                  <span className="text-[10px] text-slate-400 block">Sesuai jam kerja</span>
                </div>

                {/* 2. Terlambat */}
                <div className="bg-white p-3.5 rounded-2xl border border-amber-200/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                      Terlambat
                    </span>
                    <span className="text-[10px] font-bold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-md">
                      {stats.totalHariKerja > 0 ? Math.round((stats.terlambat / stats.totalHariKerja) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-2xl font-black text-amber-800 font-mono">
                    {stats.terlambat} <span className="text-xs font-semibold text-amber-600">Hari</span>
                  </p>
                  <span className="text-[10px] text-slate-400 block">Lewat jam toleransi</span>
                </div>

                {/* 3. Izin / Sakit */}
                <div className="bg-white p-3.5 rounded-2xl border border-blue-200/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      Izin / Sakit
                    </span>
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded-md">
                      {stats.totalHariKerja > 0 ? Math.round((stats.izin / stats.totalHariKerja) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-2xl font-black text-blue-800 font-mono">
                    {stats.izin} <span className="text-xs font-semibold text-blue-600">Hari</span>
                  </p>
                  <span className="text-[10px] text-slate-400 block">Pengajuan cuti/surat</span>
                </div>

                {/* 4. Tanpa Keterangan / Alfa */}
                <div className="bg-white p-3.5 rounded-2xl border border-rose-200/80 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-rose-800 flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                      Alfa / Kosong
                    </span>
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-700 px-1.5 py-0.5 rounded-md">
                      {stats.totalHariKerja > 0 ? Math.round((stats.alfa / stats.totalHariKerja) * 100) : 0}%
                    </span>
                  </div>
                  <p className="text-2xl font-black text-rose-800 font-mono">
                    {stats.alfa} <span className="text-xs font-semibold text-rose-600">Hari</span>
                  </p>
                  <span className="text-[10px] text-slate-400 block">Tidak absen masuk</span>
                </div>
              </div>

              {/* Informational Guidance */}
              <div className="p-3 bg-white rounded-2xl border border-slate-200 text-slate-600 text-xs flex items-center gap-2.5 shadow-2xs">
                <span className="text-xl">💡</span>
                <p className="text-[11px] leading-relaxed">
                  Ketuk tombol <strong className="text-[#023246]">Lanjut ke Analisis</strong> di bawah untuk memeriksa rata-rata jam presensi dan ketepatan waktu Anda.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              LAYER 2: ANALISIS KEDISIPLINAN & WAKTU (ANALYTICS)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeStep === 1 && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Rata-Rata Waktu Presensi */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                  Rata-Rata Waktu Presensi
                </h4>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 block">
                      Jam Masuk Fisik
                    </span>
                    <span className="font-mono text-base font-black text-[#023246] block">
                      {timingAnalytics.avgIn}
                    </span>
                    <span className="text-[10px] text-emerald-600 font-semibold block">
                      Tercatat: {timingAnalytics.checkInCount} hari
                    </span>
                  </div>

                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 block">
                      Jam Pulang Fisik
                    </span>
                    <span className="font-mono text-base font-black text-[#023246] block">
                      {timingAnalytics.avgOut}
                    </span>
                    <span className="text-[10px] text-blue-600 font-semibold block">
                      Tercatat: {timingAnalytics.checkOutCount} hari
                    </span>
                  </div>
                </div>

                {timingAnalytics.totalLateMinutes > 0 ? (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-xs font-bold text-amber-800 flex items-center justify-between">
                    <span>⏱️ Akumulasi Menit Terlambat:</span>
                    <span className="font-mono font-black">{timingAnalytics.totalLateMinutes} Menit</span>
                  </div>
                ) : (
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                    <span>✨</span>
                    <span>Luar biasa! Tidak ada akumulasi menit keterlambatan bulan ini.</span>
                  </div>
                )}
              </div>

              {/* Konsistensi Kehadiran Mingguan */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
                    Tren Kehadiran Mingguan
                  </h4>
                  <span className="text-[10px] font-bold text-slate-400">5 Siklus</span>
                </div>

                <div className="space-y-2">
                  {timingAnalytics.weeklyProgress.map((w, idx) => (
                    <div key={idx} className="space-y-1">
                      <div className="flex justify-between text-[11px] font-bold text-slate-700">
                        <span>{w.name} ({w.range})</span>
                        <span className="font-mono text-emerald-700">{w.attended} Hari Hadir</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-[#023246] h-full rounded-full transition-all duration-300"
                          style={{ width: `${w.ratio}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Estimasi Perolehan Poin Kedisiplinan */}
              <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏆</span>
                    <div>
                      <h5 className="text-xs font-extrabold text-[#023246]">Poin Disiplin Presensi</h5>
                      <span className="text-[10px] text-slate-400">Estimasi reward presensi bulan ini</span>
                    </div>
                  </div>
                  <span className="text-lg font-black text-emerald-700 font-mono">
                    +{timingAnalytics.estPoints} Pts
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 bg-slate-50 p-2 rounded-xl border border-slate-100">
                  +15 poin setiap hari hadir tepat waktu. Pastikan selalu melakukan presensi pulang agar terhindar dari penalti TAP (-10 poin).
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              LAYER 3: RIWAYAT DETAIL HARIAN & FILTER (LOGS)
             ═══════════════════════════════════════════════════════════════════ */}
          {activeStep === 2 && (
            <div className="space-y-3.5 animate-fadeIn">
              {/* Status Filter Chips */}
              <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200 text-[10px] font-bold overflow-x-auto scrollbar-none">
                {[
                  { id: 'ALL', label: `Semua (${rawMonthRecords.length})` },
                  { id: 'HADIR', label: `Hadir (${stats.hadir})` },
                  { id: 'TERLAMBAT', label: `Terlambat (${stats.terlambat})` },
                  { id: 'IZIN', label: `Izin (${stats.izin})` },
                  { id: 'ALFA', label: `Alfa (${stats.alfa})` },
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFilterStatus(item.id)}
                    className={`flex-1 min-w-16.25 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap text-center ${
                      filterStatus === item.id
                        ? 'bg-white text-[#023246] shadow-xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* List Records */}
              {filteredRecords.length === 0 ? (
                <div className="p-8 text-center bg-white border border-slate-200 rounded-2xl space-y-2">
                  <span className="text-3xl block">📋</span>
                  <p className="text-xs font-bold text-slate-800">Tidak Ada Rekaman</p>
                  <p className="text-[11px] text-slate-400">
                    Tidak ditemukan rekaman presensi pada kategori filter ini di bulan {monthNames[selectedMonth - 1]} {selectedYear}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredRecords.map((rec) => {
                    const checkIn = rec.check_in_time ? rec.check_in_time.substring(0, 5) : '--:--';
                    const checkOut = rec.check_out_time ? rec.check_out_time.substring(0, 5) : '--:--';

                    return (
                      <div
                        key={rec.id}
                        className="p-3.5 bg-white rounded-2xl border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-black text-[#023246] flex items-center gap-1.5">
                            <span>📅</span>
                            <span>{rec.date}</span>
                          </span>
                          <Badge status={rec.status}>
                            {rec.status === 'HADIR'
                              ? '✓ Hadir Tepat'
                              : rec.status === 'TERLAMBAT'
                              ? '⚠️ Terlambat'
                              : rec.status}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Jam Masuk</span>
                            <span className="font-mono font-black text-slate-900 text-xs">{checkIn} WIB</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-bold text-slate-400 block">Jam Pulang</span>
                            <span className="font-mono font-black text-slate-900 text-xs">{checkOut} WIB</span>
                          </div>
                        </div>

                        {/* Location Address & Quick Correction */}
                        <div className="pt-0.5 flex items-center justify-between text-slate-500 text-[10px] gap-2">
                          {rec.check_in_lat && rec.check_in_lng ? (
                            <LocationAddressBadge
                              lat={rec.check_in_lat}
                              lng={rec.check_in_lng}
                              distanceMeters={rec.check_in_distance_meters || undefined}
                              shortOnly
                            />
                          ) : (
                            <span className="text-slate-400 italic">Lokasi tidak tercatat</span>
                          )}

                          {onOpenCorrectionModal && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenCorrectionModal(rec.date);
                              }}
                              className="text-[10px] font-extrabold text-[#0D7A5F] hover:underline cursor-pointer shrink-0 ml-auto"
                            >
                              Koreksi →
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── 5. BOTTOM ACTION BAR (PERSISTEN & NEXT-NEXT CONTROLS) ─────────── */}
        <div className="p-3 px-4 bg-white border-t border-slate-200 flex items-center justify-between gap-2 shrink-0">
          {activeStep === 0 && (
            <button
              type="button"
              onClick={() => setActiveStep(1)}
              className="w-full h-11 bg-[#023246] hover:bg-[#03445e] active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>Lanjut ke Analisis Disiplin</span>
              <span>➔</span>
            </button>
          )}

          {activeStep === 1 && (
            <>
              <button
                type="button"
                onClick={() => setActiveStep(0)}
                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>← Ringkasan</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveStep(2)}
                className="flex-2 h-11 bg-[#023246] hover:bg-[#03445e] active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>Lihat Riwayat Harian</span>
                <span>➔</span>
              </button>
            </>
          )}

          {activeStep === 2 && (
            <>
              <button
                type="button"
                onClick={() => setActiveStep(1)}
                className="flex-1 h-11 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 text-xs font-extrabold rounded-xl transition-all flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>← Analisis</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="flex-2 h-11 bg-[#023246] hover:bg-[#03445e] active:scale-98 text-white text-xs font-black rounded-xl transition-all shadow-xs flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>Selesai & Tutup</span>
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  );
};
