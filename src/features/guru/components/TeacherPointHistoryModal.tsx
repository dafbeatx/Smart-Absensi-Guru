import React, { useState, useMemo } from 'react';
import type { TeacherPointLog, UserProfile, TeacherPointActivityType } from '../../../types/database.types';
import { X, Award, Clock, ShieldCheck, Sparkles, Filter, AlertCircle } from 'lucide-react';

function formatPointDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      return d.toLocaleDateString('id-ID', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
    }
    return dateStr;
  } catch {
    return dateStr;
  }
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
          badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
          pointsText: `+${points} Poin`,
          pointsClass: 'bg-emerald-100 text-emerald-900 border-emerald-300',
        };
      case 'CHECK_IN_LATE':
        return {
          icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
          badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
          pointsText: `+${points} Poin`,
          pointsClass: 'bg-amber-100 text-amber-900 border-amber-300',
        };
      case 'DUTY_PIKET':
        return {
          icon: <ShieldCheck className="w-3.5 h-3.5 text-cyan-600" />,
          badgeClass: 'bg-cyan-50 text-cyan-800 border-cyan-200',
          pointsText: `+${points} Poin`,
          pointsClass: 'bg-cyan-100 text-cyan-900 border-cyan-300',
        };
      case 'PENALTY_ALFA':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5 text-rose-600" />,
          badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
          pointsText: `${points} Poin`,
          pointsClass: 'bg-rose-100 text-rose-900 border-rose-300',
        };
      default:
        return {
          icon: <Sparkles className="w-3.5 h-3.5 text-indigo-600" />,
          badgeClass: 'bg-indigo-50 text-indigo-800 border-indigo-200',
          pointsText: points >= 0 ? `+${points} Poin` : `${points} Poin`,
          pointsClass: 'bg-indigo-100 text-indigo-900 border-indigo-300',
        };
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-x-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main Card */}
      <div className="relative w-full max-w-115 sm:max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[88vh] sm:max-h-[90vh] z-10 overflow-hidden animate-scale-up">
        {/* Header Modal */}
        <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-9 h-9 rounded-xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs shrink-0">
                <Award className="w-4.5 h-4.5 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-black text-[#023246] truncate leading-tight">
                  Riwayat Pendapatan Poin
                </h3>
                <p className="text-[10.5px] sm:text-xs text-slate-500 font-medium truncate">
                  Buku Catatan Ledger Disiplin & Apresiasi Guru
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label="Tutup Modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3.5">
          {/* Guru Profile Identity Card */}
          <div className="p-3.5 rounded-2xl bg-linear-to-br from-[#023246] to-[#0A455E] text-white border border-[#023246]/40 shadow-sm flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-black text-base shadow-xs shrink-0 overflow-hidden">
                {teacher?.avatar_url ? (
                  <img src={teacher.avatar_url} alt={teacherName} className="w-full h-full object-cover" />
                ) : (
                  <span>{teacherName.charAt(0) || 'G'}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs sm:text-sm font-black text-white truncate leading-tight">
                  {teacherName}
                </h4>
                <p className="text-[10px] sm:text-[11px] text-cyan-200 font-medium truncate mt-0.5">
                  {teacherPosition}
                </p>
                {teacherNpp && (
                  <p className="text-[9px] text-slate-300 font-mono mt-0.5">
                    NPP: {teacherNpp}
                  </p>
                )}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-xs flex items-center gap-1 justify-end">
                <span>⭐</span>
                <span>{calculatedTotal} Poin</span>
              </div>
              <span className="text-[9px] font-bold text-amber-300 block mt-1">
                Saldo Akumulasi
              </span>
            </div>
          </div>

          {/* 3 Metric Mini Cards Breakdown */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80">
              <span className="text-[9px] text-emerald-800 font-bold block uppercase tracking-wide">On-Time (15P)</span>
              <span className="text-sm font-black text-emerald-950 block mt-0.5">
                {stats.onTime.count}x
              </span>
              <span className="text-[8.5px] text-emerald-700 font-semibold block">
                +{stats.onTime.points} Poin
              </span>
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-amber-50/80 border border-amber-200/80">
              <span className="text-[9px] text-amber-800 font-bold block uppercase tracking-wide">Telat (5P)</span>
              <span className="text-sm font-black text-amber-950 block mt-0.5">
                {stats.late.count}x
              </span>
              <span className="text-[8.5px] text-amber-700 font-semibold block">
                +{stats.late.points} Poin
              </span>
            </div>

            <div className="p-2 sm:p-2.5 rounded-xl bg-cyan-50/80 border border-cyan-200/80">
              <span className="text-[9px] text-cyan-800 font-bold block uppercase tracking-wide">Piket (10P)</span>
              <span className="text-sm font-black text-cyan-950 block mt-0.5">
                {stats.duty.count}x
              </span>
              <span className="text-[8.5px] text-cyan-700 font-semibold block">
                +{stats.duty.points} Poin
              </span>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
            <Filter className="w-3.5 h-3.5 text-slate-400 shrink-0 ml-0.5" />
            <button
              type="button"
              onClick={() => setFilterType('ALL')}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'ALL'
                  ? 'bg-[#023246] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua ({pointHistory.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('ON_TIME')}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'ON_TIME'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
              }`}
            >
              Tepat Waktu ({stats.onTime.count})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('LATE')}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'LATE'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100'
              }`}
            >
              Terlambat ({stats.late.count})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('DUTY')}
              className={`px-2.5 py-1 rounded-lg text-[10px] sm:text-[11px] font-bold transition-all cursor-pointer shrink-0 ${
                filterType === 'DUTY'
                  ? 'bg-cyan-600 text-white shadow-2xs'
                  : 'bg-cyan-50 text-cyan-700 border border-cyan-200 hover:bg-cyan-100'
              }`}
            >
              Piket ({stats.duty.count})
            </button>
          </div>

          {/* Timeline List of Point Transactions */}
          {isLoading ? (
            <div className="py-10 text-center space-y-2">
              <div className="w-8 h-8 mx-auto border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-500 font-bold">Memuat riwayat poin...</p>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
              <div className="w-10 h-10 mx-auto rounded-full bg-slate-100 text-slate-400 flex items-center justify-center text-lg">
                📋
              </div>
              <h4 className="text-xs font-bold text-slate-700">Belum Ada Transaksi Poin</h4>
              <p className="text-[11px] text-slate-400 leading-relaxed max-w-xs mx-auto">
                Poin akan otomatis tercatat setiap kali presensi masuk (tepat waktu +15 poin, terlambat +5 poin) atau saat bertugas piket (+10 poin).
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredLogs.map((log) => {
                const badge = getActivityBadge(log.activity_type, log.points);
                const formattedDate = formatPointDate(log.date);
                const timeStr = log.created_at
                  ? new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
                  : '';

                return (
                  <div
                    key={log.id}
                    className="p-3 rounded-2xl bg-white border border-slate-200/85 hover:border-slate-300 shadow-2xs hover:shadow-xs transition-all space-y-1.5"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="p-1.5 rounded-lg bg-slate-50 shrink-0 border border-slate-100">
                          {badge.icon}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h5 className="text-xs font-black text-slate-800 truncate leading-tight">
                            {log.title}
                          </h5>
                          <span className="text-[9.5px] text-slate-400 font-medium">
                            {formattedDate} {timeStr && `• ${timeStr}`}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-0.8 rounded-lg text-[10.5px] font-black border shrink-0 shadow-2xs ${badge.pointsClass}`}
                      >
                        {badge.pointsText}
                      </span>
                    </div>

                    {log.description && (
                      <p className="text-[10px] text-slate-500 leading-relaxed pl-8 font-medium">
                        {log.description}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50 shrink-0 flex items-center justify-between gap-2">
          <span className="text-[10px] text-slate-400 font-medium italic">
            💡 Poin tercatat otomatis & tidak dapat dimanipulasi.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-5 rounded-xl bg-slate-800 hover:bg-slate-900 active:scale-95 text-white font-bold text-xs transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
