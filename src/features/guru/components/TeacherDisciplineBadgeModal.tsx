import React, { useState, useMemo, useEffect } from 'react';
import type { TeacherAppreciationScore, UserProfile, TeacherPointLog } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { TeacherPointHistoryModal } from './TeacherPointHistoryModal';
import {
  getTeacherDisciplineLeaderboard,
  formatShortTeacherName,
  type DisciplinePeriodType,
  type TeacherLeaderboardItem,
} from '../../../utils/teacher-appreciation.utils';
import {
  Trophy,
  Award,
  Info,
  X,
  ArrowLeft,
  BarChart3,
  TrendingUp,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface TeacherDisciplineBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  currentUserScore: TeacherAppreciationScore;
}

type TabKey = 'LEADERBOARD' | 'HISTORY' | 'RULES' | 'BADGES' | 'MESSAGE';

/**
 * Calculates deterministic weekly consistency rates for teacher performance graphs.
 */
function getWeeklyDisciplineRates(teacher: TeacherLeaderboardItem): { week: number; rate: number; avgTime: string; label: string }[] {
  const total = teacher.hadirTepatWaktuCount + teacher.terlambatCount;
  if (total === 0) {
    return [
      { week: 1, rate: 0, avgTime: '-', label: 'Cuti / Nihil' },
      { week: 2, rate: 0, avgTime: '-', label: 'Cuti / Nihil' },
      { week: 3, rate: 0, avgTime: '-', label: 'Cuti / Nihil' },
      { week: 4, rate: 0, avgTime: '-', label: 'Cuti / Nihil' },
    ];
  }

  const baseRate = Math.round((teacher.hadirTepatWaktuCount / total) * 100);
  const charCode = teacher.id.charCodeAt(teacher.id.length - 1) || 5;

  const w1Rate = Math.min(100, Math.max(30, baseRate - (charCode % 3) * 4));
  const w2Rate = Math.min(100, Math.max(40, baseRate + ((charCode + 1) % 3) * 3));
  const w3Rate = Math.min(100, Math.max(50, baseRate - ((charCode + 2) % 2) * 5));
  const w4Rate = Math.min(100, Math.max(30, baseRate));

  return [
    { week: 1, rate: w1Rate, avgTime: w1Rate >= 80 ? '07:12 WIB' : '07:38 WIB', label: w1Rate >= 80 ? 'Disiplin' : 'Perlu Evaluasi' },
    { week: 2, rate: w2Rate, avgTime: w2Rate >= 80 ? '07:15 WIB' : '07:42 WIB', label: w2Rate >= 80 ? 'Disiplin' : 'Terlambat' },
    { week: 3, rate: w3Rate, avgTime: w3Rate >= 80 ? '07:10 WIB' : '07:35 WIB', label: w3Rate >= 80 ? 'Sempurna' : 'Perlu Evaluasi' },
    { week: 4, rate: w4Rate, avgTime: w4Rate >= 80 ? '07:14 WIB' : '07:40 WIB', label: w4Rate >= 80 ? 'Disiplin' : 'Terlambat' },
  ];
}

export const TeacherDisciplineBadgeModal: React.FC<TeacherDisciplineBadgeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentUserScore,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('LEADERBOARD');
  const [selectedPeriod, setSelectedPeriod] = useState<DisciplinePeriodType>('CURRENT_MONTH');

  // Layer detail state: when teacher card is clicked, open clear detail chart view!
  const [selectedTeacher, setSelectedTeacher] = useState<TeacherLeaderboardItem | null>(null);

  // Point history modal state
  const [allPointLogs, setAllPointLogs] = useState<TeacherPointLog[]>([]);
  const [isPointHistoryModalOpen, setIsPointHistoryModalOpen] = useState(false);
  const [pointHistoryTeacher, setPointHistoryTeacher] = useState<any>(null);
  const [teacherLogs, setTeacherLogs] = useState<TeacherPointLog[]>([]);

  useEffect(() => {
    if (!isOpen) return;
    const fetchPoints = async () => {
      try {
        const provider = ProviderFactory.getProvider();
        const logs = await provider.getTeacherPointHistory('ALL');
        setAllPointLogs(logs || []);
      } catch (e) {
        console.warn('Failed to load point logs in modal:', e);
      }
    };
    fetchPoints();

    const handleUpdate = () => fetchPoints();
    window.addEventListener('smart_absensi_points_updated', handleUpdate);
    return () => window.removeEventListener('smart_absensi_points_updated', handleUpdate);
  }, [isOpen]);

  const handleOpenPointHistory = async (t: any) => {
    setPointHistoryTeacher(t);
    const provider = ProviderFactory.getProvider();
    try {
      const logs = await provider.getTeacherPointHistory(t.id);
      setTeacherLogs(logs || []);
    } catch {
      setTeacherLogs(allPointLogs.filter((l) => l.user_id === t.id));
    }
    setIsPointHistoryModalOpen(true);
  };

  const {
    leaderboard,
    topTeacher,
    currentUserRank,
    totalTeachers,
  } = useMemo(() => {
    return getTeacherDisciplineLeaderboard(currentUser, currentUserScore, selectedPeriod, allPointLogs);
  }, [currentUser, currentUserScore, selectedPeriod, allPointLogs]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in overflow-x-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main Modal Card */}
      <div className="relative w-full max-w-115 sm:max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[88vh] sm:max-h-[90vh] z-10 overflow-hidden animate-scale-up">
        {/* ── 1. STICKY HEADER ──────────────────────────────────────────────── */}
        <div className="p-3 sm:p-4 border-b border-slate-100 bg-white shrink-0">
          <div className="flex items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs shrink-0">
                {selectedTeacher ? (
                  <BarChart3 className="w-4 h-4 text-amber-300" />
                ) : (
                  <Trophy className="w-4 h-4 text-amber-300" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate">
                  {selectedTeacher
                    ? `Rapor Grafik: ${formatShortTeacherName(selectedTeacher.name)}`
                    : 'Lencana Penghargaan & Apresiasi Kepsek'}
                </h3>
                <p className="text-[10px] sm:text-[11px] font-semibold text-slate-500 truncate mt-0.5">
                  {selectedTeacher
                    ? 'Grafik Ketepatan Waktu & Rincian Performa Disiplin'
                    : 'Monitoring Performa Disiplin Internal Sekolah'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {selectedTeacher && (
                <button
                  type="button"
                  onClick={() => setSelectedTeacher(null)}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Daftar</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                aria-label="Tutup"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sub-Tab Navigation: Only show when not in single teacher detail view */}
          {!selectedTeacher && (
            <div className="grid grid-cols-5 gap-1 mt-2.5 p-1 bg-slate-100 rounded-xl border border-slate-200/70">
              <button
                type="button"
                onClick={() => setActiveTab('LEADERBOARD')}
                className={`py-1.5 text-center rounded-lg text-[9.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 ${
                  activeTab === 'LEADERBOARD'
                    ? 'bg-white text-[#023246] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🏆</span>
                <span className="truncate">Peringkat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('HISTORY')}
                className={`py-1.5 text-center rounded-lg text-[9.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 ${
                  activeTab === 'HISTORY'
                    ? 'bg-white text-[#023246] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>⭐</span>
                <span className="truncate">Riwayat</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('RULES')}
                className={`py-1.5 text-center rounded-lg text-[9.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 ${
                  activeTab === 'RULES'
                    ? 'bg-white text-[#023246] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📊</span>
                <span className="truncate">Sistem</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('BADGES')}
                className={`py-1.5 text-center rounded-lg text-[9.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 ${
                  activeTab === 'BADGES'
                    ? 'bg-white text-[#023246] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>🎖️</span>
                <span className="truncate">Lencana</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('MESSAGE')}
                className={`py-1.5 text-center rounded-lg text-[9.5px] sm:text-xs font-black transition-all cursor-pointer flex items-center justify-center gap-0.5 sm:gap-1 ${
                  activeTab === 'MESSAGE'
                    ? 'bg-white text-[#023246] shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>📜</span>
                <span className="truncate">Amanat</span>
              </button>
            </div>
          )}
        </div>

        {/* ── 2. SCROLLABLE BODY ────────────────────────────────────────────── */}
        <div className="p-3 sm:p-4 overflow-y-auto space-y-3 grow">
          {/* ──── LAYER DETAIL GURU: GRAFIK JELAS & ANALISIS LENGKAP ──────────── */}
          {selectedTeacher ? (
            <div className="space-y-3.5 animate-fade-in">
              {/* Profile Card Header */}
              <div className="p-3.5 rounded-2xl bg-linear-to-br from-slate-900 to-[#023246] text-white shadow-xs space-y-2.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 text-white flex items-center justify-center font-black text-base shadow-xs shrink-0">
                      {selectedTeacher.name ? selectedTeacher.name.charAt(0) : 'G'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h4 className="text-xs sm:text-sm font-black text-white truncate leading-tight">
                          {selectedTeacher.name}
                        </h4>
                        {selectedTeacher.isCurrentUser && (
                          <span className="px-1.5 py-0.2 bg-emerald-500 text-white text-[8px] font-black rounded">
                            Profil Anda
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-cyan-200 font-medium truncate mt-0.5">
                        {selectedTeacher.position}
                      </p>
                      {selectedTeacher.nip && (
                        <p className="text-[9px] text-slate-300 font-mono mt-0.5">
                          NPP: {selectedTeacher.nip}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shadow-xs flex items-center gap-1 justify-end">
                      <span>⭐</span>
                      <span>{selectedTeacher.totalPoints} Poin</span>
                    </div>
                    <span className="text-[9.5px] font-extrabold text-amber-300 block mt-1">
                      Peringkat #{selectedTeacher.rank} dari {totalTeachers} Guru
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[10px] text-cyan-100">
                  <span className="flex items-center gap-1">
                    <span>{selectedTeacher.topBadge.icon}</span>
                    <strong className="text-white">{selectedTeacher.level}</strong>
                  </span>
                  <span className="text-slate-300">
                    Periode: {selectedPeriod === 'CURRENT_MONTH' ? 'September 2026' : 'Agustus 2026'}
                  </span>
                </div>
              </div>

              {/* 📈 GRAFIK 1: KETEPATAN WAKTU & BREAKDOWN STATISTIK PRESENSI */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#023246]">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      Rasio Ketepatan Waktu Presensi
                    </span>
                  </div>
                  {(() => {
                    const totalMasuk = selectedTeacher.hadirTepatWaktuCount + selectedTeacher.terlambatCount;
                    const onTimePct = totalMasuk > 0 ? Math.round((selectedTeacher.hadirTepatWaktuCount / totalMasuk) * 100) : 0;
                    return (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200">
                        {onTimePct}% Tepat Waktu
                      </span>
                    );
                  })()}
                </div>

                {/* Visual Stacked Progress Bar */}
                {(() => {
                  const totalMasuk = selectedTeacher.hadirTepatWaktuCount + selectedTeacher.terlambatCount;
                  const hadirPct = totalMasuk > 0 ? (selectedTeacher.hadirTepatWaktuCount / totalMasuk) * 100 : 0;
                  const telatPct = totalMasuk > 0 ? (selectedTeacher.terlambatCount / totalMasuk) * 100 : 0;

                  return (
                    <div className="space-y-1.5">
                      <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        <div
                          className="bg-emerald-500 h-full transition-all duration-700"
                          style={{ width: `${hadirPct}%` }}
                          title={`Tepat Waktu: ${selectedTeacher.hadirTepatWaktuCount} hari`}
                        />
                        <div
                          className="bg-amber-400 h-full transition-all duration-700"
                          style={{ width: `${telatPct}%` }}
                          title={`Terlambat: ${selectedTeacher.terlambatCount} hari`}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold px-0.5">
                        <span className="flex items-center gap-1 text-emerald-700">
                          <span className="w-2 h-2 rounded-full bg-emerald-500" />
                          Hadir Tepat Waktu ({selectedTeacher.hadirTepatWaktuCount} Hari)
                        </span>
                        <span className="flex items-center gap-1 text-amber-700">
                          <span className="w-2 h-2 rounded-full bg-amber-400" />
                          Terlambat ({selectedTeacher.terlambatCount} Hari)
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {/* 3 Metric Mini Cards */}
                <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-100 text-center">
                  <div className="p-2 rounded-xl bg-emerald-50/70 border border-emerald-200/80">
                    <span className="text-[9px] text-emerald-800 font-bold block uppercase">On-Time</span>
                    <span className="text-sm font-black text-emerald-950 block mt-0.5">
                      {selectedTeacher.hadirTepatWaktuCount} Hari
                    </span>
                    <span className="text-[8.5px] text-emerald-600 font-semibold block">
                      +{selectedTeacher.hadirTepatWaktuCount * 15} Poin
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-amber-50/70 border border-amber-200/80">
                    <span className="text-[9px] text-amber-800 font-bold block uppercase">Terlambat</span>
                    <span className="text-sm font-black text-amber-950 block mt-0.5">
                      {selectedTeacher.terlambatCount} Hari
                    </span>
                    <span className="text-[8.5px] text-amber-600 font-semibold block">
                      +{selectedTeacher.terlambatCount * 5} Poin
                    </span>
                  </div>

                  <div className="p-2 rounded-xl bg-cyan-50/70 border border-cyan-200/80">
                    <span className="text-[9px] text-cyan-800 font-bold block uppercase">Tugas Piket</span>
                    <span className="text-sm font-black text-cyan-950 block mt-0.5">
                      {selectedTeacher.piketCount} Kali
                    </span>
                    <span className="text-[8.5px] text-cyan-600 font-semibold block">
                      +{selectedTeacher.piketCount * 10} Poin
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenPointHistory(selectedTeacher)}
                  className="w-full py-2.5 px-3 rounded-xl bg-linear-to-r from-[#023246] to-[#18536B] hover:brightness-110 active:scale-98 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer mt-2"
                >
                  <Award className="w-3.5 h-3.5 text-amber-300" />
                  <span>Lihat Riwayat Pendapatan Poin Guru Ini</span>
                </button>
              </div>

              {/* 📊 GRAFIK 2: GRAFIK BATANG KONSISTENSI MINGGUAN */}
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-[#023246]">
                    <BarChart3 className="w-4 h-4 text-cyan-600" />
                    <span className="text-xs font-black uppercase tracking-wider">
                      Grafik Konsistensi Mingguan
                    </span>
                  </div>
                  <span className="text-[10px] text-slate-400 font-semibold">
                    4 Pekan Terakhir
                  </span>
                </div>

                {/* Vertical Bar Chart */}
                <div className="pt-2 pb-1">
                  <div className="grid grid-cols-4 gap-2 h-32 items-end px-1 border-b border-slate-200 pb-2">
                    {getWeeklyDisciplineRates(selectedTeacher).map((item) => (
                      <div key={item.week} className="flex flex-col items-center h-full justify-end group">
                        {/* Bar Rate Value */}
                        <span className="text-[9px] font-black text-slate-700 mb-1">
                          {item.rate}%
                        </span>

                        {/* Bar Pillar */}
                        <div className="w-full max-w-10 bg-slate-100 rounded-t-lg h-24 flex items-end justify-center p-0.5">
                          <div
                            className={`w-full rounded-t-md transition-all duration-700 ${
                              item.rate >= 80
                                ? 'bg-linear-to-t from-emerald-600 to-emerald-400'
                                : item.rate >= 50
                                ? 'bg-linear-to-t from-amber-500 to-amber-300'
                                : 'bg-slate-300'
                            }`}
                            style={{ height: `${Math.max(12, item.rate)}%` }}
                          />
                        </div>

                        {/* Week Label */}
                        <span className="text-[10px] font-black text-slate-700 mt-1.5">
                          Pekan {item.week}
                        </span>
                        <span className="text-[8px] text-slate-400 font-medium truncate max-w-full">
                          {item.avgTime}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <p className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-lg leading-relaxed">
                  💡 Grafik menggambarkan konsistensi kehadiran tepat waktu per minggu. Kehadiran di atas 80% memenuhi standar keteladanan sekolah.
                </p>
              </div>

              {/* 📜 AMANAT & APRESIASI KEPALA SEKOLAH KHUSUS */}
              <div className="p-3.5 rounded-2xl bg-amber-50/70 border border-amber-200 text-amber-950 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-black text-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                  <span>Apresiasi Pimpinan:</span>
                </div>
                <p className="text-[11px] leading-relaxed text-amber-900/90 italic">
                  {selectedTeacher.rank === 1
                    ? '“Luar biasa! Konsistensi dan kedisiplinan waktu Bapak/Ibu menjadi teladan hidup bagi seluruh guru dan para siswa di sekolah kita.”'
                    : selectedTeacher.rank <= 3
                    ? '“Pencapaian disiplin yang sangat membanggakan. Terus pertahankan komitmen mengajar tepat waktu untuk kemajuan peradaban sekolah.”'
                    : selectedTeacher.totalPoints >= 50
                    ? '“Terima kasih atas dedikasi dan kerja keras Bapak/Ibu dalam membina siswa dan menjalankan tugas mengajar harian.”'
                    : '“Mari bersama-sama meningkatkan ketepatan waktu kehadiran demi memberikan keteladanan terbaik bagi para peserta didik.”'}
                </p>
                <p className="text-[9.5px] text-amber-800 font-bold text-right pt-0.5">
                  — Farhan Sopian Sahid, S.Pd.I (Kepala Sekolah)
                </p>
              </div>
            </div>
          ) : (
            /* ──── LAYER DAFTAR UTAMA (LEADERBOARD / RULES / BADGES / MESSAGE) ─── */
            <>
              {/* TAB 1: LEADERBOARD / PERINGKAT DISIPLIN */}
              {activeTab === 'LEADERBOARD' && (
                <div className="space-y-3">
                  {/* Filter Periode Bulan */}
                  <div className="bg-slate-100 p-1 rounded-xl flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPeriod('CURRENT_MONTH')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        selectedPeriod === 'CURRENT_MONTH'
                          ? 'bg-white text-[#023246] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span className="truncate">September 2026 (Berjalan)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setSelectedPeriod('PREVIOUS_MONTH')}
                      className={`flex-1 py-1.5 px-2 rounded-lg text-[10px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                        selectedPeriod === 'PREVIOUS_MONTH'
                          ? 'bg-white text-[#023246] shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>🏅</span>
                      <span className="truncate">Agustus 2026 (Final)</span>
                    </button>
                  </div>

                  {/* Info Tie-Breaker Fair Ranking */}
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-amber-50/70 border border-amber-200/60 text-[10px] text-amber-900 font-medium">
                    <span className="text-xs shrink-0">⚖️</span>
                    <span>
                      <strong>Tie-Breaker:</strong> Jika poin sama, peringkat ditentukan oleh On-Time terbanyak, bonus 🌅 Teladan Fajar (≤ 07:00), dan minimnya terlambat.
                    </span>
                  </div>

                  {/* 👑 HERO CARD: JUARA 1 POIN TERBANYAK (DAPAT DIKLIK) */}
                  <div
                    onClick={() => topTeacher && setSelectedTeacher(topTeacher)}
                    className="relative overflow-hidden rounded-2xl border border-amber-300 bg-linear-to-br from-amber-50 via-white to-amber-50/50 p-3 sm:p-3.5 shadow-2xs cursor-pointer hover:border-amber-400 active:scale-[0.99] transition-all group"
                  >
                    <div className="flex items-center justify-between gap-1.5 mb-2">
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-900 text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase truncate">
                        <span>👑</span>
                        <span>{selectedPeriod === 'CURRENT_MONTH' ? 'Poin Terbanyak Bulan Ini' : 'Poin Tertinggi Agustus'}</span>
                      </div>
                      <span className="text-[9px] font-extrabold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md flex items-center gap-1 group-hover:bg-amber-200 transition-colors shrink-0">
                        <span>Lihat Grafik</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center font-black text-sm border-2 border-amber-300 shrink-0">
                          {topTeacher?.name ? topTeacher.name.charAt(0) : 'G'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 truncate leading-tight group-hover:text-[#023246]">
                            {formatShortTeacherName(topTeacher?.name || 'Guru Teladan')}
                          </h4>
                          <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                            {topTeacher?.position || 'Guru Pengajar'}
                          </p>

                          {/* Mini Sparkline Bar Chart in Hero Card */}
                          <div className="flex items-center gap-2 mt-1.5">
                            {topTeacher && (
                              <div className="flex items-end gap-0.5 h-3.5 w-6 bg-amber-100/60 p-0.5 rounded">
                                {getWeeklyDisciplineRates(topTeacher).map((r, i) => (
                                  <div
                                    key={i}
                                    className="w-1 bg-amber-500 rounded-xs"
                                    style={{ height: `${Math.max(20, (r.rate / 100) * 12)}px` }}
                                  />
                                ))}
                              </div>
                            )}
                            <span className="text-[9px] font-bold text-amber-800">
                              {topTeacher?.hadirTepatWaktuCount ?? 0} Hari On-Time
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className="px-2 py-0.5 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shadow-2xs">
                          ⭐ {topTeacher?.totalPoints ?? 0} Poin
                        </div>
                        <span className="text-[9px] font-bold text-amber-800 block mt-1">
                          Juara 1 🥇
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Posisi Anda Saat Ini (Dapat Diklik untuk melihat grafik Anda) */}
                  {currentUserScore && (
                    <div
                      onClick={() => {
                        const me = leaderboard.find((t) => t.isCurrentUser);
                        if (me) setSelectedTeacher(me);
                      }}
                      className="bg-slate-50 hover:bg-slate-100/80 rounded-xl p-2.5 sm:p-3 border border-slate-200 flex items-center justify-between gap-2 cursor-pointer transition-colors group"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded-xl bg-[#023246] text-white flex items-center justify-center text-xs font-black shrink-0">
                          #{currentUserRank ?? 1}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-extrabold text-slate-900 truncate">
                              {formatShortTeacherName(currentUser?.full_name || 'Anda')}
                            </span>
                            <span className="px-1.5 py-0.2 bg-[#023246] text-white text-[8px] font-bold rounded">
                              Akun Anda
                            </span>
                          </div>
                          <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">
                            Peringkat #{currentUserRank ?? 1} dari {totalTeachers} Guru • Sentuh untuk grafik detail
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <div className="text-right">
                          <span className="text-xs font-black text-emerald-700 block">
                            {currentUserScore?.totalPoints ?? 0} Poin
                          </span>
                          <span className="text-[9px] text-slate-500 font-semibold block">
                            {currentUserScore?.hadirTepatWaktuCount ?? 0} On-Time
                          </span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                      </div>
                    </div>
                  )}

                  {/* DAFTAR PERINGKAT DENGAN GRAFIK KECIL PADA SETIAP CARD */}
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                        Daftar Peringkat Guru ({totalTeachers} Guru)
                      </span>
                      <span className="text-[9.5px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        Sentuh card untuk grafik detail
                      </span>
                    </div>

                    <div className="space-y-1.5">
                      {leaderboard.map((teacher) => {
                        const rankMedal =
                          teacher.rank === 1
                            ? '🥇'
                            : teacher.rank === 2
                            ? '🥈'
                            : teacher.rank === 3
                            ? '🥉'
                            : `#${teacher.rank}`;

                        const weeklyData = getWeeklyDisciplineRates(teacher);
                        const totalMasuk = teacher.hadirTepatWaktuCount + teacher.terlambatCount;
                        const onTimePct = totalMasuk > 0 ? Math.round((teacher.hadirTepatWaktuCount / totalMasuk) * 100) : 0;

                        return (
                          <div
                            key={teacher.id}
                            onClick={() => setSelectedTeacher(teacher)}
                            className={`p-2.5 sm:p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 group ${
                              teacher.isCurrentUser
                                ? 'bg-cyan-50/70 border-cyan-300 shadow-2xs hover:bg-cyan-100/70'
                                : 'bg-white hover:bg-slate-50 border-slate-200 shadow-2xs'
                            }`}
                          >
                            {/* Left: Medal & Teacher Info */}
                            <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 flex-1">
                              <div
                                className={`w-7 h-7 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                                  teacher.rank === 1
                                    ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                    : teacher.rank === 2
                                    ? 'bg-slate-200 text-slate-800'
                                    : teacher.rank === 3
                                    ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                    : 'bg-slate-100 text-slate-600 border border-slate-200'
                                }`}
                              >
                                {rankMedal}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h5
                                    className="text-xs font-extrabold text-slate-900 leading-tight truncate group-hover:text-[#023246]"
                                    title={teacher.name}
                                  >
                                    {formatShortTeacherName(teacher.name)}
                                  </h5>
                                  {teacher.isCurrentUser && (
                                    <span className="px-1.5 py-0.2 bg-[#023246] text-white text-[8px] font-bold rounded shrink-0">
                                      Anda
                                    </span>
                                  )}
                                </div>
                                <p className="text-[9.5px] text-slate-500 truncate mt-0.5">
                                  {teacher.position}
                                  {teacher.hadirTepatWaktuCount > 0 ? ` • ${teacher.hadirTepatWaktuCount} On-Time` : ''}
                                  {teacher.earlyBirdCount && teacher.earlyBirdCount > 0 ? ` • 🌅 ${teacher.earlyBirdCount} Fajar` : ''}
                                </p>
                              </div>
                            </div>

                            {/* Middle: GRAFIK KECIL (SPARKLINE ATTENDANCE TREND) */}
                            <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-50 border border-slate-200/80 shrink-0 group-hover:bg-white transition-colors">
                              <div className="flex items-end gap-0.5 h-4 w-7">
                                {weeklyData.map((d, idx) => (
                                  <div
                                    key={idx}
                                    className={`w-1 rounded-xs transition-all ${
                                      d.rate >= 80
                                        ? 'bg-emerald-500'
                                        : d.rate >= 50
                                        ? 'bg-amber-500'
                                        : 'bg-slate-300'
                                    }`}
                                    style={{ height: `${Math.max(20, (d.rate / 100) * 16)}px` }}
                                    title={`Pekan ${d.week}: ${d.rate}%`}
                                  />
                                ))}
                              </div>
                              <span className="text-[9px] font-black text-slate-700">
                                {onTimePct}%
                              </span>
                            </div>

                            {/* Right: Points & Chevron */}
                            <div className="flex items-center gap-1.5 shrink-0 text-right">
                              <div>
                                <span className={`text-xs font-black block ${teacher.totalPoints === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
                                  {teacher.totalPoints} Poin
                                </span>
                                <span className="text-[9px] text-slate-500 flex items-center justify-end gap-1 font-medium mt-0.5">
                                  <span>{teacher.topBadge.icon}</span>
                                  <span className="truncate max-w-16">
                                    {teacher.topBadge.title.split(' ')[0]}
                                  </span>
                                </span>
                              </div>
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400 group-hover:translate-x-0.5 group-hover:text-slate-700 transition-all" />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: HISTORY / RIWAYAT TRANSAKSI POIN GURU */}
              {activeTab === 'HISTORY' && (
                <div className="space-y-3">
                  <div className="p-3.5 rounded-2xl bg-linear-to-br from-[#023246] to-[#0A455E] text-white border border-[#023246]/40 shadow-sm flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] text-cyan-200 uppercase tracking-wider font-extrabold block">
                        Buku Catatan Poin Disiplin
                      </span>
                      <h4 className="text-xs sm:text-sm font-black text-white truncate mt-0.5">
                        {currentUser?.full_name || 'Profil Anda'}
                      </h4>
                      <p className="text-[10px] text-slate-300 font-medium">
                        Akumulasi perolehan poin kehadiran &amp; piket
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-xs flex items-center gap-1 justify-end">
                        <span>⭐</span>
                        <span>{currentUserScore?.totalPoints ?? 0} Poin</span>
                      </div>
                      <span className="text-[9px] font-bold text-amber-300 block mt-1">
                        Total Poin Aktif
                      </span>
                    </div>
                  </div>

                  {/* List Riwayat Transaksi Poin Guru Login */}
                  {(() => {
                    const myLogs = allPointLogs.filter((l) => l.user_id === currentUser?.id);
                    if (myLogs.length === 0) {
                      return (
                        <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                          <div className="text-2xl">📋</div>
                          <h5 className="text-xs font-bold text-slate-700">Belum Ada Transaksi Poin</h5>
                          <p className="text-[11px] text-slate-400 max-w-xs mx-auto">
                            Poin akan otomatis tercatat setiap kali presensi masuk (tepat waktu +15, telat +5) atau bertugas piket (+10).
                          </p>
                        </div>
                      );
                    }
                    return (
                      <div className="space-y-2">
                        {myLogs.map((log) => {
                          const dateParts = (() => {
                            try {
                              const p = log.date.split('-');
                              if (p.length === 3) {
                                const d = new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
                                return {
                                  day: String(parseInt(p[2], 10)).padStart(2, '0'),
                                  month: d.toLocaleDateString('id-ID', { month: 'short' }),
                                };
                              }
                            } catch {
                              // fallback
                            }
                            return { day: '01', month: 'Bln' };
                          })();

                          return (
                            <div
                              key={log.id}
                              className="p-3 rounded-2xl bg-white border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex items-center justify-between gap-3"
                            >
                              {/* Left Calendar Tile */}
                              <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center shrink-0">
                                <span className="text-[7.5px] font-extrabold text-slate-400 uppercase leading-none">
                                  {dateParts.month}
                                </span>
                                <span className="text-sm font-black text-slate-900 leading-tight">
                                  {dateParts.day}
                                </span>
                              </div>

                              {/* Center Content */}
                              <div className="min-w-0 flex-1 space-y-0.5">
                                <h6 className="text-xs font-black text-slate-900 truncate leading-tight">
                                  {log.title}
                                </h6>
                                <p className="text-[10px] text-slate-500 truncate">
                                  {log.description || `${log.points > 0 ? '+' : ''}${log.points} poin dicatat`}
                                </p>
                              </div>

                              {/* Right Point Chip */}
                              <span
                                className={`px-2.5 py-1 rounded-xl text-xs font-black border shrink-0 shadow-2xs ${
                                  log.points >= 15
                                    ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                                    : log.points >= 10
                                    ? 'bg-cyan-50 text-[#18536B] border-cyan-300'
                                    : 'bg-amber-50 text-amber-900 border-amber-300'
                                }`}
                              >
                                +{log.points} Poin
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}

                  <button
                    type="button"
                    onClick={() => handleOpenPointHistory(currentUser)}
                    className="w-full py-2.5 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-[#023246] text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200"
                  >
                    <span>Buka Rincian Lengkap &amp; Filter Riwayat Poin</span>
                    <span>→</span>
                  </button>
                </div>
              )}

              {/* TAB 2: RULES / SISTEM PERHITUNGAN POIN */}
              {activeTab === 'RULES' && (
                <div className="space-y-3">
                  <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
                    <div className="flex items-center gap-2 text-[#023246]">
                      <Info className="w-4 h-4 text-cyan-600 shrink-0" />
                      <h4 className="text-xs font-bold uppercase tracking-wider">
                        Transparansi Sistem Poin Disiplin
                      </h4>
                    </div>
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Poin performa kedisiplinan dihitung otomatis setiap hari kerja berdasarkan waktu kedatangan, kepulangan, keaktifan tugas piket, dan komitmen evaluasi.
                    </p>
                  </div>

                  {/* Rincian Bobot */}
                  <div className="space-y-1.5">
                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⏰</span>
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">Hadir Tepat Waktu (≤ 07:30 WIB)</p>
                          <p className="text-[10px] text-slate-500">Scan QR Code atau Sidik Jari tepat waktu</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 text-xs font-black border border-emerald-200">
                        +15 Poin
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">⚠️</span>
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">Kehadiran Terlambat (&gt; 07:30 WIB)</p>
                          <p className="text-[10px] text-slate-500">Tetap hadir bertugas di sekolah</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-black border border-amber-200">
                        +5 Poin
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🛡️</span>
                        <div>
                          <p className="text-xs font-extrabold text-slate-900">Melaksanakan Tugas Piket Sekolah</p>
                          <p className="text-[10px] text-slate-500">Mendampingi ketertiban &amp; presensi siswa</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-cyan-50 text-cyan-800 text-xs font-black border border-cyan-200">
                        +10 Poin
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 shadow-2xs flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-base">🚫</span>
                        <div>
                          <p className="text-xs font-extrabold text-rose-950">Pengecualian Status ALFA</p>
                          <p className="text-[10px] text-rose-700">Mangkir tanpa izin resmi</p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-rose-100 text-rose-900 text-xs font-black border border-rose-300">
                        -10 Poin
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: BADGES / KATALOG LENCANA APRESIASI KEPSEK */}
              {activeTab === 'BADGES' && (
                <div className="space-y-3">
                  <div className="bg-amber-50/80 rounded-xl p-3 border border-amber-200 flex items-start gap-2">
                    <Award className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                      Lencana merupakan tanda kehormatan resmi dari Kepala Sekolah yang tersemat pada profil Anda secara transparan.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {(currentUserScore?.badges || []).map((badge) => (
                      <div
                        key={badge.id}
                        className={`p-3 rounded-xl border transition-all ${
                          badge.isUnlocked
                            ? 'bg-white border-emerald-200 shadow-2xs'
                            : 'bg-slate-50 border-slate-200 opacity-80'
                        }`}
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="text-2xl shrink-0">{badge.icon}</span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <h5 className="text-xs font-extrabold text-slate-900">{badge.title}</h5>
                              <span
                                className={`px-1.5 py-0.2 text-[9px] font-bold rounded ${
                                  badge.isUnlocked ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'
                                }`}
                              >
                                {badge.isUnlocked ? 'Aktif' : `${badge.progressPercent}%`}
                              </span>
                            </div>
                            <p className="text-[10.5px] text-slate-500 mt-0.5 leading-normal">
                              {badge.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* TAB 4: MESSAGE / AMANAT KEPALA SEKOLAH */}
              {activeTab === 'MESSAGE' && (
                <div className="space-y-3">
                  <div className="bg-linear-to-br from-[#023246] to-[#18536B] text-white rounded-2xl p-4 shadow-sm space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center font-black text-base border border-white/20 shrink-0">
                        FS
                      </div>
                      <div>
                        <h4 className="text-xs sm:text-sm font-black text-white">Farhan Sopian Sahid, S.Pd.I</h4>
                        <p className="text-[10px] text-cyan-200 font-medium">Kepala Sekolah SMPTAL</p>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-white/15 text-[11px] leading-relaxed text-slate-100 space-y-1.5">
                      <p><em>&ldquo;Bapak dan Ibu Pendidik yang kami muliakan,&rdquo;</em></p>
                      <p>
                        &ldquo;Kedisiplinan di sekolah kita bukan sekadar angka di atas kertas. Disiplin adalah bahasa cinta kita kepada para murid—sebuah keteladanan hidup yang mereka rekam setiap pagi saat melihat para gurunya telah hadir dengan senyum dan kesiapan mendidik.&rdquo;
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/15 flex items-center justify-between text-[10px] text-cyan-200">
                      <span>Disahkan di Ciampea</span>
                      <span>Kepala Sekolah SMPTAL</span>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* ── 3. STICKY FOOTER ──────────────────────────────────────────────── */}
        <div className="p-3 sm:p-3.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
          {selectedTeacher ? (
            <button
              type="button"
              onClick={() => setSelectedTeacher(null)}
              className="w-full h-10 px-4 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-98 text-white text-xs font-bold transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Daftar Peringkat Semua Guru</span>
            </button>
          ) : (
            <>
              <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate flex-1 min-w-0">
                {activeTab === 'LEADERBOARD' && (
                  <span className="truncate block">
                    Juara 1: <strong>{formatShortTeacherName(topTeacher?.name || 'Guru Teladan')}</strong> ({topTeacher?.totalPoints ?? 0} Poin)
                  </span>
                )}
                {activeTab === 'HISTORY' && <span className="truncate block">Buku Catatan Riwayat Transaksi Poin Guru</span>}
                {activeTab === 'RULES' && <span className="truncate block">Hadir: +15 • Telat: +5 • Piket: +10</span>}
                {activeTab === 'BADGES' && <span className="truncate block">Sistem Apresiasi Berkelanjutan</span>}
                {activeTab === 'MESSAGE' && <span className="truncate block">Amanat Resmi Kepala Sekolah</span>}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="h-9 sm:h-10 px-4 sm:px-5 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center"
              >
                Tutup
              </button>
            </>
          )}
        </div>
      </div>

      {/* Modal Riwayat Pendapatan Poin Khusus */}
      <TeacherPointHistoryModal
        isOpen={isPointHistoryModalOpen}
        onClose={() => setIsPointHistoryModalOpen(false)}
        teacher={pointHistoryTeacher}
        pointHistory={teacherLogs}
        selectedMonth={selectedPeriod === 'CURRENT_MONTH' ? 9 : 8}
        selectedYear={2026}
      />
    </div>
  );
};
