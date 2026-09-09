import React, { useState, useMemo } from 'react';
import type { TeacherPointLog, UserProfile, TeacherPointActivityType } from '../../../types/database.types';
import {
  X,
  Clock,
  ShieldCheck,
  Sparkles,
  AlertCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Award,
  CheckCircle2,
  Calendar,
} from 'lucide-react';

function parseDateParts(dateStr: string): { dayName: string; dayNum: string; monthShort: string; fullYear: string } {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const dayName = d.toLocaleDateString('id-ID', { weekday: 'short' });
      const dayNum = String(day).padStart(2, '0');
      const monthShort = d.toLocaleDateString('id-ID', { month: 'short' });
      return { dayName, dayNum, monthShort, fullYear: String(year) };
    }
  } catch {
    // fallback
  }
  return { dayName: 'Hari', dayNum: '01', monthShort: 'Bln', fullYear: '2026' };
}

export interface TeacherPointHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  teacher: {
    id: string;
    full_name?: string;
    name?: string;
    nip?: string | null;
    position?: string;
    avatar_url?: string | null;
    totalPoints?: number;
    level?: string;
  } | UserProfile | null;
  pointHistory: TeacherPointLog[];
  isLoading?: boolean;
}

type FilterType = 'ALL' | 'ON_TIME' | 'LATE' | 'DUTY' | 'OTHER';

export const TeacherPointHistoryModal: React.FC<TeacherPointHistoryModalProps> = ({
  isOpen,
  onClose,
  teacher,
  pointHistory = [],
  isLoading = false,
}) => {
  const [filterType, setFilterType] = useState<FilterType>('ALL');
  const [isRulesExpanded, setIsRulesExpanded] = useState(false);

  const teacherName = teacher?.full_name || (teacher as any)?.name || 'Guru Pendidik';
  const teacherNpp = teacher?.nip || null;
  const teacherPosition = teacher?.position || 'Tenaga Pendidik';
  const fallbackPoints =
    teacher && 'totalPoints' in teacher && typeof (teacher as any).totalPoints === 'number'
      ? (teacher as any).totalPoints
      : 0;

  const calculatedTotal = useMemo(() => {
    if (pointHistory.length > 0) {
      return Math.max(0, pointHistory.reduce((sum, p) => sum + (p.points || 0), 0));
    }
    return fallbackPoints;
  }, [pointHistory, fallbackPoints]);

  // Evaluasi Tier / Level Disiplin
  const teacherLevel = useMemo(() => {
    if (teacher && 'level' in teacher && teacher.level) {
      return (teacher as any).level;
    }
    if (calculatedTotal >= 65) return '🥇 Level 3: Pendidik Disiplin Emas';
    if (calculatedTotal >= 50) return '🥈 Level 2: Pendidik Berdedikasi';
    return '🥉 Level 1: Pendidik Teladan Pemula';
  }, [calculatedTotal, teacher]);

  const levelProgress = useMemo(() => {
    if (calculatedTotal >= 65) {
      const progress = Math.min(100, Math.round(((calculatedTotal - 65) / 15) * 100));
      return { percent: progress, label: 'Level Maksimal Tercapai' };
    }
    if (calculatedTotal >= 50) {
      const progress = Math.min(100, Math.round(((calculatedTotal - 50) / 15) * 100));
      return { percent: progress, label: `${65 - calculatedTotal} poin lagi ke Level Emas` };
    }
    const progress = Math.min(100, Math.round((calculatedTotal / 50) * 100));
    return { percent: progress, label: `${50 - calculatedTotal} poin lagi ke Level 2` };
  }, [calculatedTotal]);

  const filteredLogs = useMemo(() => {
    return pointHistory.filter((log) => {
      if (filterType === 'ALL') return true;
      if (filterType === 'ON_TIME') return log.activity_type === 'CHECK_IN_ON_TIME';
      if (filterType === 'LATE') return log.activity_type === 'CHECK_IN_LATE';
      if (filterType === 'DUTY') return log.activity_type === 'DUTY_PIKET';
      if (filterType === 'OTHER') {
        return (
          log.activity_type !== 'CHECK_IN_ON_TIME' &&
          log.activity_type !== 'CHECK_IN_LATE' &&
          log.activity_type !== 'DUTY_PIKET'
        );
      }
      return true;
    });
  }, [pointHistory, filterType]);

  // Statistik ringkasan
  const stats = useMemo(() => {
    const onTimeCount = pointHistory.filter((l) => l.activity_type === 'CHECK_IN_ON_TIME').length;
    const lateCount = pointHistory.filter((l) => l.activity_type === 'CHECK_IN_LATE').length;
    const dutyCount = pointHistory.filter((l) => l.activity_type === 'DUTY_PIKET').length;
    return {
      onTime: { count: onTimeCount, points: onTimeCount * 15 },
      late: { count: lateCount, points: lateCount * 5 },
      duty: { count: dutyCount, points: dutyCount * 10 },
    };
  }, [pointHistory]);

  if (!isOpen) return null;

  const getActivityBadge = (type: TeacherPointActivityType, points: number) => {
    switch (type) {
      case 'CHECK_IN_ON_TIME':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-emerald-600" />,
          categoryLabel: 'Presensi Tepat Waktu',
          defaultTitle: 'Presensi Masuk Tepat Waktu',
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200/80',
          pointsText: `+${points} Poin`,
          pointsClass: 'bg-emerald-50 text-emerald-900 border-emerald-300 ring-1 ring-emerald-400/30',
        };
      case 'CHECK_IN_LATE':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
          categoryLabel: 'Presensi Terlambat',
          defaultTitle: 'Presensi Masuk Terlambat',
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200/80',
          pointsText: `+${points} Poin`,
          pointsClass: 'bg-amber-50 text-amber-900 border-amber-300 ring-1 ring-amber-400/30',
        };
      case 'DUTY_PIKET':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-[#18536B]" />,
          categoryLabel: 'Tugas Piket Harian',
          defaultTitle: 'Tugas Piket Sekolah Terlaksana',
          badgeClass: 'bg-cyan-50 text-[#18536B] border-cyan-200/80',
          pointsText: `+${points} Poin`,
          pointsClass: 'bg-cyan-50 text-[#023246] border-cyan-300 ring-1 ring-cyan-400/30',
        };
      case 'PENALTY_ALFA':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
          categoryLabel: 'Penalti Tidak Hadir',
          defaultTitle: 'Penalti Ketidakhadiran (ALFA)',
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-200/80',
          pointsText: `${points} Poin`,
          pointsClass: 'bg-rose-50 text-rose-900 border-rose-300 ring-1 ring-rose-400/30',
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-indigo-600" />,
          categoryLabel: 'Apresiasi Khusus',
          defaultTitle: 'Penyesuaian Poin Disiplin',
          badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200/80',
          pointsText: points >= 0 ? `+${points} Poin` : `${points} Poin`,
          pointsClass: 'bg-indigo-50 text-indigo-900 border-indigo-300 ring-1 ring-indigo-400/30',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-200 overflow-hidden">
      {/* Layer 0: Backdrop Click to Dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Layer 1: Main Sheet / Mobile-Optimized Modal Container */}
      <div
        className="relative w-full max-w-125 bg-[#F8FAFC] rounded-t-[30px] sm:rounded-[28px] shadow-2xl border-t sm:border border-slate-200/80 flex flex-col max-h-[92vh] sm:max-h-[88vh] z-10 overflow-hidden transition-all duration-300"
        role="dialog"
        aria-modal="true"
        aria-labelledby="point-history-title"
      >
        {/* Mobile Pull-down Pill Handle (Spesifik Infinix Note 8 Touch Ergonomics) */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0 bg-white">
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Layer 2: Elevated Sticky Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-[#023246] to-[#18536B] text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-slate-100">
                <Sparkles className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="point-history-title"
                  className="text-sm sm:text-base font-black text-[#023246] tracking-tight truncate leading-tight"
                >
                  Riwayat Pendapatan Poin
                </h3>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  Buku Catatan Ledger Disiplin &amp; Apresiasi Guru
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label="Tutup Riwayat Poin"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Multi-Layer Content Stage */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 overscroll-contain">
          {/* Layer 3: The Teacher Identity & Vault Hero Card (Multi-level Depth) */}
          <div className="rounded-2xl sm:rounded-3xl bg-linear-to-br from-[#023246] via-[#0A4158] to-[#012230] text-white p-4 sm:p-4.5 border border-[#18536B]/60 shadow-md relative overflow-hidden space-y-3.5">
            {/* Background Accent Lines */}
            <div className="absolute -right-8 -top-8 w-36 h-36 rounded-full bg-white/5 blur-2xl pointer-events-none" />
            <div className="absolute right-4 bottom-2 opacity-10 pointer-events-none text-white">
              <Award className="w-24 h-24" />
            </div>

            {/* Level 3A: Top Identity Row */}
            <div className="relative flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-white/10 ring-2 ring-amber-400/40 border border-white/20 text-white flex items-center justify-center font-black text-lg shrink-0 overflow-hidden shadow-xs">
                  {teacher?.avatar_url ? (
                    <img src={teacher.avatar_url} alt={teacherName} className="w-full h-full object-cover" />
                  ) : (
                    <span>{teacherName.charAt(0) || 'G'}</span>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded-md bg-white/15 text-[9.5px] font-extrabold tracking-wide uppercase text-cyan-200">
                      Pendidik Resmi
                    </span>
                    <span className="inline-flex items-center gap-0.5 text-[9px] text-emerald-300 font-bold">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Aktif
                    </span>
                  </div>
                  <h4 className="text-sm sm:text-base font-black text-white truncate leading-tight mt-1">
                    {teacherName}
                  </h4>
                  <div className="flex items-center gap-2 text-[10.5px] text-slate-300 font-mono mt-0.5 truncate">
                    <span>NPP: {teacherNpp || '-'}</span>
                    <span>•</span>
                    <span className="text-cyan-200 font-sans truncate">{teacherPosition}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Level 3B: Inner Recessed Point Vault Chamber */}
            <div className="relative bg-black/25 backdrop-blur-md rounded-2xl p-3 sm:p-3.5 border border-white/10 flex items-center justify-between gap-3 shadow-inner">
              <div className="min-w-0 flex-1">
                <span className="text-[9.5px] font-extrabold tracking-wider uppercase text-amber-300 flex items-center gap-1">
                  <span>👑</span>
                  <span>Peringkat Disiplin</span>
                </span>
                <p className="text-xs sm:text-[13px] font-black text-white truncate mt-0.5">
                  {teacherLevel}
                </p>
                {/* Progress bar to next level */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full bg-white/20 overflow-hidden">
                    <div
                      className="h-full bg-linear-to-r from-amber-400 to-amber-300 rounded-full transition-all duration-500"
                      style={{ width: `${levelProgress.percent}%` }}
                    />
                  </div>
                  <span className="text-[9px] font-mono text-amber-200 font-bold shrink-0">
                    {levelProgress.label}
                  </span>
                </div>
              </div>

              <div className="text-right shrink-0 pl-3 border-l border-white/10">
                <span className="text-[9px] font-bold text-slate-300 block uppercase tracking-wide">
                  Total Saldo
                </span>
                <div className="text-2xl sm:text-3xl font-black text-amber-300 tracking-tight flex items-baseline justify-end gap-1">
                  <span>{calculatedTotal}</span>
                  <span className="text-xs text-amber-200 font-bold">PTS</span>
                </div>
              </div>
            </div>
          </div>

          {/* Layer 4: 3-Tier Multi-Depth Metric Inset Cards */}
          <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
            {/* On-Time Tile */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-emerald-200/90 shadow-2xs flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black uppercase text-emerald-800 tracking-wide">
                  On-Time
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[9px] font-black">
                  +15
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 leading-tight pt-0.5">
                {stats.onTime.count}
                <span className="text-[10px] font-bold text-slate-500 ml-0.5">x</span>
              </div>
              <span className="text-[9.5px] font-bold text-emerald-700">
                +{stats.onTime.points} Poin
              </span>
            </div>

            {/* Late Tile */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-amber-200/90 shadow-2xs flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black uppercase text-amber-800 tracking-wide">
                  Telat
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[9px] font-black">
                  +5
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 leading-tight pt-0.5">
                {stats.late.count}
                <span className="text-[10px] font-bold text-slate-500 ml-0.5">x</span>
              </div>
              <span className="text-[9.5px] font-bold text-amber-700">
                +{stats.late.points} Poin
              </span>
            </div>

            {/* Duty Tile */}
            <div className="bg-white rounded-2xl p-2.5 sm:p-3 border border-cyan-200/90 shadow-2xs flex flex-col justify-between space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[9.5px] font-black uppercase text-[#18536B] tracking-wide">
                  Piket
                </span>
                <span className="px-1.5 py-0.5 rounded-md bg-cyan-100 text-[#023246] text-[9px] font-black">
                  +10
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-slate-900 leading-tight pt-0.5">
                {stats.duty.count}
                <span className="text-[10px] font-bold text-slate-500 ml-0.5">x</span>
              </div>
              <span className="text-[9.5px] font-bold text-[#18536B]">
                +{stats.duty.points} Poin
              </span>
            </div>
          </div>

          {/* Layer 5: Interactive Rules Drawer Accordion */}
          <div className="rounded-2xl bg-white border border-slate-200/85 overflow-hidden shadow-2xs">
            <button
              type="button"
              onClick={() => setIsRulesExpanded(!isRulesExpanded)}
              className="w-full px-3.5 py-2.5 flex items-center justify-between text-left hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-cyan-700" />
                <span className="text-xs font-bold text-[#023246]">
                  Bagaimana Cara Memperoleh Poin Disiplin?
                </span>
              </div>
              {isRulesExpanded ? (
                <ChevronUp className="w-4 h-4 text-slate-400" />
              ) : (
                <ChevronDown className="w-4 h-4 text-slate-400" />
              )}
            </button>

            {isRulesExpanded && (
              <div className="px-3.5 pb-3.5 pt-1 text-[11px] text-slate-600 space-y-2 border-t border-slate-100 bg-slate-50/50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-start gap-2">
                    <span className="text-base">⏰</span>
                    <div>
                      <strong className="text-slate-800 block">Presensi On-Time (+15 Poin)</strong>
                      <span className="text-[10px] text-slate-500">
                        Scan QR masuk sebelum/pada 07:30 WIB di radius sekolah.
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-start gap-2">
                    <span className="text-base">⚠️</span>
                    <div>
                      <strong className="text-slate-800 block">Presensi Terlambat (+5 Poin)</strong>
                      <span className="text-[10px] text-slate-500">
                        Scan QR setelah 07:30 WIB. Tetap dihargai atas dedikasi hadir.
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-start gap-2">
                    <span className="text-base">🛡️</span>
                    <div>
                      <strong className="text-slate-800 block">Tugas Piket Harian (+10 Poin)</strong>
                      <span className="text-[10px] text-slate-500">
                        Hadir bertugas sesuai jadwal piket hari Senin s/d Jumat.
                      </span>
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-white border border-slate-200 flex items-start gap-2">
                    <span className="text-base">🚫</span>
                    <div>
                      <strong className="text-slate-800 block">Penalti ALFA (-10 Poin)</strong>
                      <span className="text-[10px] text-slate-500">
                        Tidak hadir tanpa surat izin/sakit yang sah.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Layer 6: Segmented Filter Control Bar (Island Architecture) */}
          <div className="bg-slate-200/70 p-1 rounded-2xl flex items-center gap-1 overflow-x-auto scrollbar-none">
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-xl text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'ALL'
                  ? 'bg-white text-[#023246] shadow-xs font-black border border-slate-300/60'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua ({pointHistory.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('ON_TIME')}
              className={`px-3 py-1.5 rounded-xl text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'ON_TIME'
                  ? 'bg-emerald-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              On-Time ({stats.onTime.count})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('LATE')}
              className={`px-3 py-1.5 rounded-xl text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'LATE'
                  ? 'bg-amber-600 text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Terlambat ({stats.late.count})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('DUTY')}
              className={`px-3 py-1.5 rounded-xl text-[10.5px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'DUTY'
                  ? 'bg-[#18536B] text-white shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Piket ({stats.duty.count})
            </button>
          </div>

          {/* Layer 7: The Ledger Transaction Feed (Multi-Tier Individual Cards) */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-extrabold text-slate-500 uppercase tracking-wider">
                Daftar Riwayat Transaksi
              </span>
              <span className="text-[10.5px] font-mono text-slate-400">
                {filteredLogs.length} Catatan
              </span>
            </div>

            {isLoading ? (
              <div className="py-12 text-center space-y-3 bg-white rounded-2xl border border-slate-200">
                <div className="w-8 h-8 mx-auto border-3 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-xs text-slate-600 font-bold">Memuat riwayat transaksi poin...</p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 space-y-2.5">
                <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center text-xl">
                  <Calendar className="w-6 h-6 text-slate-400" />
                </div>
                <h4 className="text-xs font-bold text-slate-800">Belum Ada Transaksi Poin Tercatat</h4>
                <p className="text-[11px] text-slate-500 leading-relaxed max-w-xs mx-auto">
                  Poin otomatis dicatat ke buku besar sistem saat Anda memindai QR presensi masuk atau melaksanakan tugas piket sekolah.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLogs.map((log) => {
                  const badge = getActivityBadge(log.activity_type, log.points);
                  const { dayName, dayNum, monthShort } = parseDateParts(log.date);
                  const timeStr = log.created_at
                    ? new Date(log.created_at).toLocaleTimeString('id-ID', {
                        hour: '2-digit',
                        minute: '2-digit',
                      }) + ' WIB'
                    : '';

                  return (
                    <div
                      key={log.id}
                      className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 hover:shadow-xs transition-all flex items-center justify-between gap-3 group"
                    >
                      {/* Left Sub-Layer: Calendar Badge Tile */}
                      <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center shrink-0 shadow-3xs group-hover:border-slate-300 group-hover:bg-slate-100/70 transition-colors">
                        <span className="text-[8.5px] font-extrabold text-slate-400 uppercase tracking-wide leading-none">
                          {monthShort}
                        </span>
                        <span className="text-base font-black text-slate-900 leading-tight mt-0.5">
                          {dayNum}
                        </span>
                        <span className="text-[8px] font-bold text-slate-500 leading-none">
                          {dayName}
                        </span>
                      </div>

                      {/* Middle Sub-Layer: Content & Context */}
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[9.5px] font-extrabold border ${badge.badgeClass}`}
                          >
                            {badge.icon}
                            <span>{badge.categoryLabel}</span>
                          </span>
                          {timeStr && (
                            <span className="text-[10px] font-mono text-slate-400">
                              • {timeStr}
                            </span>
                          )}
                        </div>

                        <h5 className="text-xs sm:text-[13px] font-extrabold text-slate-900 truncate leading-snug">
                          {log.title || badge.defaultTitle}
                        </h5>

                        {log.description && (
                          <p className="text-[10.5px] text-slate-500 font-medium truncate leading-tight">
                            {log.description}
                          </p>
                        )}
                      </div>

                      {/* Right Sub-Layer: Point Award Capsule Chip */}
                      <div className="shrink-0 text-right">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-xs font-black border shadow-2xs ${badge.pointsClass}`}
                        >
                          <span>{badge.pointsText}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Layer 8: Fixed Elevated Footer (Thumb Ergonomic for Mobile HP) */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200/80 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-[10px] text-slate-500 min-w-0 flex-1">
            <span className="text-emerald-600 text-xs shrink-0">🔒</span>
            <span className="truncate">Sistem Buku Besar Poin Otomatis &amp; Terenkripsi</span>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="min-h-11 sm:min-h-11.5 px-6 rounded-2xl bg-[#023246] hover:bg-[#03445e] active:scale-[0.98] text-white font-black text-xs transition-all cursor-pointer shadow-xs shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
