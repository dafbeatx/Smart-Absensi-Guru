import React, { useState, useMemo } from 'react';
import type { TeacherStreakInfo, TeacherDailyQuest } from '../../../services/teacher-challenge.service';
import type { UserProfile, TeacherAppreciationScore } from '../../../types/database.types';
import {
  X,
  HelpCircle,
  Share2,
  Printer,
  ExternalLink,
  Lock,
  Clock,
  Sparkles,
  HeartHandshake,
} from 'lucide-react';
import { useToastStore } from '../../../store/useToastStore';
import { TeacherExcellenceCertificateModal } from './TeacherExcellenceCertificateModal';
import { openPrintableCertificate } from '../../../lib/certificate-generator.lib';
import { evaluateDisciplinePeriodTiming } from '../../../utils/time.utils';

interface TeacherChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  streakInfo: TeacherStreakInfo;
  quests: TeacherDailyQuest[];
  appreciationScore: TeacherAppreciationScore;
  userRank?: number;
  totalTeachers?: number;
  selectedMonth?: number;
  selectedYear?: number;
}

export const TeacherChallengeModal: React.FC<TeacherChallengeModalProps> = ({
  isOpen,
  onClose,
  user,
  streakInfo,
  quests,
  appreciationScore,
  userRank = 1,
  totalTeachers = 12,
  selectedMonth,
  selectedYear,
}) => {
  const [activeTab, setActiveTab] = useState<'QUESTS' | 'REWARDS' | 'RULES'>('QUESTS');
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [selectedCertificateRank, setSelectedCertificateRank] = useState(1);
  const [kepsekReward, setKepsekReward] = useState<string | null>(null);
  const { showToast } = useToastStore();

  const timing = useMemo(() => {
    return evaluateDisciplinePeriodTiming(new Date(), selectedYear || 2026, selectedMonth || 9);
  }, [selectedYear, selectedMonth]);

  const [simulateEndOfMonth, setSimulateEndOfMonth] = useState<boolean>(() => {
    try {
      return localStorage.getItem('smart_absensi_simulate_end_of_month') === 'true';
    } catch {
      return false;
    }
  });

  const isEndOfMonth = timing.isEndOfMonth || simulateEndOfMonth;
  const isTop3Winner = userRank >= 1 && userRank <= 3;

  React.useEffect(() => {
    if (!isOpen) return;
    try {
      const stored = localStorage.getItem('smart_absensi_kepsek_reward_champion_September_2026');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.rewardText) setKepsekReward(parsed.rewardText);
      }
    } catch {
      // Ignored
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const teacherName = user?.full_name || 'Bapak/Ibu Guru';
  const totalPoints = appreciationScore?.totalPoints ?? 0;

  const handleShareAchievement = async () => {
    const text = `🔥 Saya telah mempertahankan ${streakInfo.currentStreak} Hari Beruntun Kehadiran Tepat Waktu dengan ${totalPoints} Poin di Smart Absensi Guru! 🏆`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Pencapaian Disiplin Pendidik',
          text,
        });
        showToast('success', 'Berhasil Dibagikan!', 'Pencapaian Anda telah dibagikan.');
      } catch {
        // User cancelled or failed
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('success', 'Teks Disalin!', 'Status pencapaian disalin ke clipboard.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-200 overflow-hidden">
      {/* Backdrop */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Main Container */}
      <div
        className="relative w-full max-w-125 bg-[#F8FAFC] rounded-t-[30px] sm:rounded-[28px] shadow-2xl border-t sm:border border-slate-200/80 flex flex-col max-h-[92vh] sm:max-h-[88vh] z-10 overflow-hidden animate-scale-up"
        role="dialog"
        aria-modal="true"
      >
        {/* Mobile Pull Handle */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0 bg-white">
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-white border-b border-slate-200/80 shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 text-white flex items-center justify-center shadow-xs text-xl shrink-0">
              🔥
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-black text-[#023246] tracking-tight truncate leading-tight">
                Papan Tantangan &amp; Rekor Disiplin
              </h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Misi Harian &amp; Dedikasi • {teacherName}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 flex items-center justify-center transition-all cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-3.5 sm:p-5 space-y-3.5 overscroll-contain">
          {/* Hero Streak Vault */}
          <div className="rounded-2xl sm:rounded-3xl bg-linear-to-br from-[#023246] via-[#0A4158] to-[#18536B] text-white p-4 sm:p-5 shadow-md relative overflow-hidden space-y-3">
            <div className="absolute right-3 top-3 opacity-10 pointer-events-none text-white text-7xl">
              🔥
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="px-2.5 py-0.5 rounded-full bg-amber-400/20 text-amber-300 border border-amber-400/30 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                <span>🔥</span>
                <span>{streakInfo.streakStatusLabel}</span>
              </span>

              <span className="text-[11px] font-mono text-cyan-200 font-bold">
                Peringkat #{userRank} dari {totalTeachers} Guru
              </span>
            </div>

            <div className="flex items-baseline justify-between gap-3 pt-1">
              <div>
                <h4 className="text-2xl sm:text-3xl font-black text-white leading-none">
                  {streakInfo.currentStreak} Hari
                </h4>
                <p className="text-xs text-slate-300 font-medium mt-1">
                  Rekor beruntun hadir tepat waktu (≤ 07:30 WIB)
                </p>
              </div>

              <div className="text-right shrink-0">
                <span className="text-[9.5px] uppercase font-bold text-slate-300 block">Poin Bulan Ini</span>
                <span className="text-xl sm:text-2xl font-black text-amber-300">
                  {totalPoints} <span className="text-xs text-amber-200">PTS</span>
                </span>
              </div>
            </div>

            {/* Weekly Days Bar */}
            <div className="bg-black/25 backdrop-blur-xs rounded-xl p-2.5 border border-white/10 flex items-center justify-between gap-1">
              {streakInfo.streakDaysThisWeek.map((day) => (
                <div key={day.dayName} className="text-center flex-1">
                  <span className="text-[9px] font-extrabold uppercase text-slate-300 block">
                    {day.dayName.substring(0, 3)}
                  </span>
                  <div
                    className={`w-7 h-7 mx-auto rounded-lg mt-1 flex items-center justify-center text-xs font-bold transition-all ${
                      day.isCompleted
                        ? 'bg-amber-400 text-slate-950 shadow-xs'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {day.isCompleted ? '🔥' : '○'}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Segmented Navigation */}
          <div className="bg-slate-200/70 p-1 rounded-2xl flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab('QUESTS')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === 'QUESTS'
                  ? 'bg-white text-[#023246] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎯 Misi Harian
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('REWARDS')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === 'REWARDS'
                  ? 'bg-white text-[#023246] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🎁 Hadiah &amp; Piagam
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RULES')}
              className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                activeTab === 'RULES'
                  ? 'bg-white text-[#023246] shadow-xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📖 Panduan
            </button>
          </div>

          {/* TAB 1: QUESTS */}
          {activeTab === 'QUESTS' && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-black text-slate-500 uppercase tracking-wider">
                  Daftar Tantangan Hari Ini
                </span>
                <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                  Siklus 24 Jam
                </span>
              </div>

              {quests.map((q) => {
                const isDone = q.status === 'COMPLETED';
                const isFailed = q.status === 'FAILED';

                return (
                  <div
                    key={q.id}
                    className={`p-3 rounded-2xl bg-white border shadow-2xs flex items-center justify-between gap-3 ${
                      isDone
                        ? 'border-emerald-200/90'
                        : isFailed
                        ? 'border-rose-200/70 opacity-80'
                        : 'border-slate-200/90'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xl shrink-0">
                      {q.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <h5 className="text-xs font-extrabold text-slate-900 truncate">
                          {q.title}
                        </h5>
                        {isDone && (
                          <span className="px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 text-[9.5px] font-black">
                            Tuntas ✓
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-0.5">
                        {q.description}
                      </p>
                    </div>

                    <div className="shrink-0 text-right">
                      <span className="px-2 py-1 rounded-xl bg-amber-50 text-amber-900 border border-amber-200 font-black text-xs block">
                        +{q.rewardPoints} PTS
                      </span>
                    </div>
                  </div>
                );
              })}

              {/* Nightly Duolingo-style encouragement badge */}
              <div className="p-3.5 rounded-2xl bg-linear-to-r from-cyan-50 via-blue-50 to-indigo-50 border border-blue-200/80 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm">🦉</span>
                  <strong className="text-xs text-[#023246] font-black">Tips Guru Disiplin</strong>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
                  Setiap malam sekitar pukul 19:30 WIB, Anda akan menerima pesan evaluasi dan pengingat misi esok hari. Pastikan istirahat tepat waktu untuk menyambut pagi dengan energi penuh!
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: HADIAH & PIAGAM PENGHARGAAN RESMI */}
          {activeTab === 'REWARDS' && (
            <div className="space-y-3">
              {/* KONDISI A: BELUM AKHIR BULAN (Piagam Belum Diterbitkan, Tampilkan Progres & Penyemangat) */}
              {!isEndOfMonth ? (
                <div className="space-y-3">
                  {/* Status Banner: Periode Berjalan */}
                  <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200 text-amber-950 space-y-1.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 font-black text-xs text-amber-900">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Periode Berjalan ({timing.periodLabel})</span>
                      </div>
                      <span className="px-2 py-0.5 rounded-md bg-amber-200/80 text-amber-950 text-[9.5px] font-extrabold uppercase shrink-0">
                        Hari ke-{timing.currentDay} dari {timing.totalDaysInMonth}
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900/90 font-medium">
                      Piagam Penghargaan Resmi dan penetapan final Juara 1, 2, dan 3 akan <strong>diterbitkan otomatis pada akhir bulan</strong> setelah seluruh rekapitulasi poin ditutup.
                    </p>
                  </div>

                  {/* Card Hadiah yang Disiapkan Kepala Sekolah untuk Juara 1 */}
                  <div className="p-3.5 sm:p-4 rounded-2xl bg-linear-to-b from-[#fffefc] to-[#faf7ee] border-2 border-amber-300/80 shadow-sm relative overflow-hidden space-y-2.5">
                    <div className="flex items-start justify-between gap-2 border-b border-amber-200/80 pb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">🎁</span>
                        <div>
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                            Hadiah Juara 1 dari Kepala Sekolah
                          </h4>
                          <p className="text-[10.5px] text-amber-900 font-bold">
                            Disiapkan oleh Farhan Sopian Sahid, S.Pd.I
                          </p>
                        </div>
                      </div>
                      <span className="px-2 py-0.5 rounded-lg bg-amber-100 border border-amber-300 text-amber-900 font-black text-[10px] flex items-center gap-1 shrink-0">
                        <Lock className="w-3 h-3 text-amber-700" />
                        <span>Buka Akhir Bulan</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300/80 text-xs text-amber-950 space-y-1">
                      <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-amber-900 uppercase">
                        <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                        <span>Hadiah Apresiasi untuk Juara 1 Terpilih:</span>
                      </div>
                      <p className="text-xs font-semibold leading-relaxed text-slate-800">
                        {kepsekReward || 'Sedang dirumuskan langsung oleh Kepala Sekolah Farhan Sopian Sahid, S.Pd.I.'}
                      </p>
                    </div>

                    <p className="text-[10.5px] text-slate-500 italic leading-relaxed">
                      💡 Selain hadiah di atas, Juara 1, 2, dan 3 juga akan dianugerahi Piagam Penghargaan Resmi bertanda tangan basah Kepala Sekolah &amp; Stempel Sekolah sah.
                    </p>
                  </div>

                  {/* Card Posisi Sementara Anda Saat Ini */}
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200/90 shadow-2xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#023246] text-white flex items-center justify-center font-black text-xs shrink-0">
                          #{userRank}
                        </div>
                        <div>
                          <h5 className="text-xs font-extrabold text-slate-900 leading-tight">
                            Posisi Peringkat Sementara Anda
                          </h5>
                          <p className="text-[10px] text-slate-500 font-medium">
                            Peringkat #{userRank} dari {totalTeachers} Guru ({totalPoints} PTS)
                          </p>
                        </div>
                      </div>
                      {isTop3Winner ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black border border-emerald-300 shrink-0">
                          Zona Podium 🏆
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-cyan-50 text-cyan-800 text-[10px] font-black border border-cyan-200 shrink-0">
                          Zona Berjuang 💪
                        </span>
                      )}
                    </div>

                    {/* Pesan Motivasi Dinamis Sesuai Posisi */}
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 text-[11px] text-slate-700 leading-relaxed font-medium">
                      {userRank === 1 ? (
                        <span>
                          🥇 <strong>Luar biasa!</strong> Anda saat ini memimpin di puncak Peringkat 1. Terus pertahankan presensi On-Time dan kumpulkan bonus Teladan Fajar (≤ 07:00) untuk mengunci gelar Juara 1 di akhir bulan!
                        </span>
                      ) : userRank <= 3 ? (
                        <span>
                          🥈 <strong>Pencapaian Mantap!</strong> Anda berada di zona podium Juara #{userRank}. Selisih poin sangat tipis, tetap konsisten hadir tepat waktu untuk mempertahankan posisi hingga penutupan akhir bulan!
                        </span>
                      ) : (
                        <span>
                          💪 <strong>Tetap Semangat!</strong> Masih ada <strong>{timing.daysRemainingInMonth} hari kerja</strong> tersisa di bulan ini. Kumpulkan +15 PTS On-Time dan +5 PTS Teladan Fajar setiap hari untuk menyalip ke podium Juara 1–3 sebelum akhir bulan!
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ringkasan 3 Gelar Piagam yang Disediakan */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10.5px] font-black uppercase tracking-wider text-slate-500 px-1 block">
                      Katalog Piagam yang Diterbitkan Akhir Bulan
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200 text-center space-y-1">
                        <span className="text-lg">🥇</span>
                        <strong className="text-[11px] text-slate-900 block font-black leading-tight">Juara 1</strong>
                        <span className="text-[9.5px] text-slate-600 block leading-tight">Piagam Teladan Utama + Hadiah Kepsek</span>
                        <span className="inline-block px-1.5 py-0.2 rounded bg-amber-200/80 text-amber-900 text-[8.5px] font-bold">🔒 Akhir Bulan</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-center space-y-1">
                        <span className="text-lg">🥈</span>
                        <strong className="text-[11px] text-slate-900 block font-black leading-tight">Juara 2</strong>
                        <span className="text-[9.5px] text-slate-600 block leading-tight">Piagam Pendidik Disiplin Emas</span>
                        <span className="inline-block px-1.5 py-0.2 rounded bg-slate-200 text-slate-800 text-[8.5px] font-bold">🔒 Akhir Bulan</span>
                      </div>
                      <div className="p-2.5 rounded-xl bg-amber-50/40 border border-amber-200/60 text-center space-y-1">
                        <span className="text-lg">🥉</span>
                        <strong className="text-[11px] text-slate-900 block font-black leading-tight">Juara 3</strong>
                        <span className="text-[9.5px] text-slate-600 block leading-tight">Piagam Pendidik Disiplin Perak</span>
                        <span className="inline-block px-1.5 py-0.2 rounded bg-amber-100 text-amber-900 text-[8.5px] font-bold">🔒 Akhir Bulan</span>
                      </div>
                    </div>
                  </div>

                  {/* Testing / Preview Switch for End-of-Month State */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-400">
                    <span>💡 Ingin melihat pratinjau saat akhir bulan tiba?</span>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !simulateEndOfMonth;
                        setSimulateEndOfMonth(next);
                        try {
                          localStorage.setItem('smart_absensi_simulate_end_of_month', String(next));
                        } catch {}
                        showToast(
                          'info',
                          next ? 'Mode Akhir Bulan Diaktifkan 🧪' : 'Mode Periode Berjalan ⏳',
                          next
                            ? 'Menampilkan pratinjau piagam resmi / kartu semangat akhir bulan.'
                            : 'Kembali ke tampilan periode berjalan.'
                        );
                      }}
                      className="text-cyan-700 hover:text-cyan-900 font-bold underline cursor-pointer"
                    >
                      {simulateEndOfMonth ? 'Kembali ke Periode Berjalan' : 'Simulasi Akhir Bulan 🧪'}
                    </button>
                  </div>
                </div>
              ) : (
                /* KONDISI B: SUDAH AKHIR BULAN */
                <div className="space-y-3">
                  {/* Cek apakah guru yang membuka adalah Juara 1, 2, atau 3 */}
                  {isTop3Winner ? (
                    <div className="space-y-3">
                      {/* Banner Pemenang Resmi */}
                      <div className="p-3 rounded-2xl bg-linear-to-r from-amber-50 via-amber-100/60 to-yellow-50 border border-amber-300 text-amber-950 flex items-center gap-2.5 shadow-2xs">
                        <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center text-xl font-black shrink-0 shadow-xs">
                          {userRank === 1 ? '🥇' : userRank === 2 ? '🥈' : '🥉'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                            Selamat! Anda Meraih Juara {userRank} Disiplin
                          </h4>
                          <p className="text-[10.5px] text-amber-900 font-semibold mt-0.5">
                            Rekapitulasi akhir bulan telah final. Piagam resmi telah diterbitkan khusus untuk Anda!
                          </p>
                        </div>
                      </div>

                      {/* Tampilan Khusus Juara 1 (+ Hadiah Kepala Sekolah) */}
                      {userRank === 1 && (
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-linear-to-b from-[#fffefc] to-[#faf7ee] border-2 border-amber-300 shadow-sm relative overflow-hidden space-y-2.5">
                          <div className="flex items-start justify-between gap-2 border-b border-amber-200/80 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">🥇</span>
                              <div>
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                                  Juara 1 Disiplin (Pendidik Teladan Utama)
                                </h4>
                                <p className="text-[10.5px] text-amber-900 font-bold">
                                  Piagam Resmi &amp; Hadiah Khusus Kepala Sekolah
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shadow-2xs shrink-0">
                              Top #1
                            </span>
                          </div>

                          {/* Hadiah Khusus yang Ditetapkan Kepala Sekolah */}
                          <div className="p-2.5 rounded-xl bg-amber-100/70 border border-amber-300/80 text-xs text-amber-950 space-y-1">
                            <div className="flex items-center gap-1.5 font-extrabold text-[11px] text-amber-900 uppercase">
                              <span>🎁</span>
                              <span>Hadiah Apresiasi dari Kepala Sekolah:</span>
                            </div>
                            <p className="text-xs font-semibold leading-relaxed">
                              {kepsekReward || 'Sedang disiapkan langsung oleh Kepala Sekolah Farhan Sopian Sahid, S.Pd.I.'}
                            </p>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed italic">
                            &ldquo;Piagam Penghargaan Resmi A4 bertanda tangan Kepala Sekolah &amp; Stempel Sekolah Sah.&rdquo;
                          </p>

                          {/* Tombol Cetak / Lihat Piagam Juara 1 */}
                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCertificateRank(1);
                                setIsCertificateModalOpen(true);
                              }}
                              className="min-h-10 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 active:scale-95 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                              <span>Lihat Piagam 🥇</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                openPrintableCertificate({
                                  recipientName: teacherName,
                                  recipientNipOrNpp: user?.nip || undefined,
                                  recipientPosition: user?.position || 'Guru Mata Pelajaran',
                                  periodMonthYear: timing.periodLabel,
                                  totalPoints,
                                  rank: 1,
                                });
                              }}
                              className="min-h-10 px-3 rounded-xl bg-[#023246] hover:bg-[#03445e] active:scale-95 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-300" />
                              <span>Cetak PDF 🥇</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tampilan Khusus Juara 2 */}
                      {userRank === 2 && (
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-slate-300 shadow-sm space-y-2.5">
                          <div className="flex items-start justify-between gap-2 border-b border-slate-200 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">🥈</span>
                              <div>
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                                  Juara 2 Disiplin (Pendidik Disiplin Emas)
                                </h4>
                                <p className="text-[10.5px] text-slate-600 font-bold">
                                  Piagam Penghargaan Resmi Kepala Sekolah
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-xl bg-slate-200 text-slate-900 font-black text-xs shadow-2xs shrink-0">
                              Top #2
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            Selamat! Dedikasi dan kepatuhan waktu Anda diakui resmi melalui Piagam Penghargaan Pendidik Disiplin Emas.
                          </p>

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCertificateRank(2);
                                setIsCertificateModalOpen(true);
                              }}
                              className="min-h-10 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 active:scale-95 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                              <span>Lihat Piagam 🥈</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openPrintableCertificate({
                                  recipientName: teacherName,
                                  recipientNipOrNpp: user?.nip || undefined,
                                  recipientPosition: user?.position || 'Guru Mata Pelajaran',
                                  periodMonthYear: timing.periodLabel,
                                  totalPoints,
                                  rank: 2,
                                });
                              }}
                              className="min-h-10 px-3 rounded-xl bg-[#023246] hover:bg-[#03445e] active:scale-95 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-300" />
                              <span>Cetak PDF 🥈</span>
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Tampilan Khusus Juara 3 */}
                      {userRank === 3 && (
                        <div className="p-3.5 sm:p-4 rounded-2xl bg-white border-2 border-amber-200 shadow-sm space-y-2.5">
                          <div className="flex items-start justify-between gap-2 border-b border-amber-100 pb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">🥉</span>
                              <div>
                                <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                                  Juara 3 Disiplin (Pendidik Disiplin Perak)
                                </h4>
                                <p className="text-[10.5px] text-amber-900 font-bold">
                                  Piagam Penghargaan Resmi Kepala Sekolah
                                </p>
                              </div>
                            </div>
                            <span className="px-2.5 py-1 rounded-xl bg-amber-100 text-amber-900 font-black text-xs shadow-2xs shrink-0">
                              Top #3
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-600 leading-relaxed">
                            Selamat! Keteladanan disiplin harian Anda dianugerahi Piagam Penghargaan Pendidik Disiplin Perak resmi bertanda tangan Kepala Sekolah.
                          </p>

                          <div className="grid grid-cols-2 gap-2 pt-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedCertificateRank(3);
                                setIsCertificateModalOpen(true);
                              }}
                              className="min-h-10 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 active:scale-95 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                            >
                              <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                              <span>Lihat Piagam 🥉</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                openPrintableCertificate({
                                  recipientName: teacherName,
                                  recipientNipOrNpp: user?.nip || undefined,
                                  recipientPosition: user?.position || 'Guru Mata Pelajaran',
                                  periodMonthYear: timing.periodLabel,
                                  totalPoints,
                                  rank: 3,
                                });
                              }}
                              className="min-h-10 px-3 rounded-xl bg-[#023246] hover:bg-[#03445e] active:scale-95 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                            >
                              <Printer className="w-3.5 h-3.5 text-amber-300" />
                              <span>Cetak PDF 🥉</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* KONDISI B2: GURU TIDAK MASUK JUARA 1-3 (TIDAK ADA PIAGAM, BERIKAN SEMANGAT) */
                    <div className="p-4 sm:p-5 rounded-3xl bg-linear-to-br from-emerald-50/60 via-white to-teal-50/40 border-2 border-emerald-200/90 shadow-sm space-y-3.5 text-center">
                      <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center mx-auto shadow-md">
                        <HeartHandshake className="w-7 h-7 text-emerald-100" />
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-sm sm:text-base font-black text-slate-900 leading-tight">
                          Tetap Semangat &amp; Terima Kasih atas Pengabdian Anda!
                        </h4>
                        <p className="text-[11px] text-emerald-800 font-bold">
                          Perjuangan Mendidik &amp; Membina Siswa Tak Ternilai Harganya
                        </p>
                      </div>

                      {/* Box Rekapitulasi Akhir Bulan */}
                      <div className="p-3 rounded-2xl bg-white border border-emerald-200/80 grid grid-cols-2 gap-2 text-left">
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">Peringkat Akhir Bulan</span>
                          <strong className="text-xs sm:text-sm font-black text-slate-900 block">
                            #{userRank} dari {totalTeachers} Guru
                          </strong>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 font-medium block">Total Poin Terkumpul</span>
                          <strong className="text-xs sm:text-sm font-black text-emerald-700 block">
                            {totalPoints} PTS
                          </strong>
                        </div>
                      </div>

                      {/* Pesan Hangat Penyemangat dari Kepala Sekolah */}
                      <div className="p-3.5 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-left space-y-1.5 text-emerald-950">
                        <div className="flex items-center gap-1.5 text-xs font-black text-emerald-900">
                          <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                          <span>Pesan Apresiasi Kepala Sekolah:</span>
                        </div>
                        <p className="text-[11px] leading-relaxed text-emerald-900/90 italic">
                          &ldquo;Bapak dan Ibu Guru yang kami muliakan, terima kasih atas ketulusan dan perjuangan mengajar di sekolah kita. Walaupun bulan ini belum berkesempatan masuk podium Juara 1–3, kami sangat mengapresiasi setiap keteladanan yang Bapak/Ibu berikan.
                          <br /><br />
                          Jangan berkecil hati! Pada tanggal 1 awal bulan depan, seluruh poin akan direset ke 0 dan kesempatan meraih Juara 1, 2, dan 3 terbuka kembali secara adil untuk seluruh guru. Mari kita sambut bulan baru dengan semangat yang lebih segar!&rdquo;
                        </p>
                        <p className="text-[10px] font-bold text-emerald-800 text-right pt-0.5">
                          — Farhan Sopian Sahid, S.Pd.I (Kepala Sekolah)
                        </p>
                      </div>

                      {/* Tips Sukses Bulan Depan */}
                      <div className="p-2.5 rounded-2xl bg-white border border-slate-200 text-left space-y-1">
                        <span className="text-[10.5px] font-extrabold text-slate-700 uppercase tracking-wide block">
                          💡 Tips Meraih Podium Juara Bulan Depan:
                        </span>
                        <ul className="text-[10.5px] text-slate-600 space-y-1 pl-1">
                          <li>🌅 <strong>Teladan Fajar:</strong> Hadir sebelum 07:00 WIB untuk bonus +5 PTS setiap hari.</li>
                          <li>⏰ <strong>On-Time Konsisten:</strong> Pertahankan hadir tepat waktu untuk mengunci streak +10 PTS.</li>
                          <li>🛡️ <strong>Tugas Piket:</strong> Tuntaskan piket harian untuk tambahan +10 PTS per tugas.</li>
                        </ul>
                      </div>
                    </div>
                  )}

                  {/* Toggle back to current period mode */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-[10px] text-slate-400">
                    <span>🧪 Mode pratinjau akhir bulan sedang aktif</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSimulateEndOfMonth(false);
                        try {
                          localStorage.setItem('smart_absensi_simulate_end_of_month', 'false');
                        } catch {}
                        showToast('info', 'Mode Periode Berjalan ⏳', 'Kembali ke tampilan periode berjalan.');
                      }}
                      className="text-cyan-700 hover:text-cyan-900 font-bold underline cursor-pointer"
                    >
                      Kembali ke Periode Berjalan
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: RULES & PHILOSOPHY */}
          {activeTab === 'RULES' && (
            <div className="space-y-2 text-[11.5px] text-slate-600 leading-relaxed bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200 shadow-2xs">
              <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                <HelpCircle className="w-4 h-4 text-[#18536B]" />
                Aturan &amp; Siklus Tantangan Disiplin
              </h5>
              <div className="space-y-2 pt-1 border-t border-slate-100">
                <p>
                  <strong>1. Siklus Bulanan &amp; Kesempatan Baru:</strong> Seluruh poin dan peringkat dihitung murni per bulan kalender. Setiap tanggal 1 awal bulan, saldo direset ke 0 agar seluruh guru memiliki peluang juara yang sama.
                </p>
                <p>
                  <strong>2. Cara Memperoleh Poin:</strong>
                </p>
                <ul className="list-disc list-inside pl-1 space-y-0.5 text-[11px]">
                  <li>Presensi Masuk Tepat Waktu (≤ 07:30 WIB): <strong>+15 Poin</strong></li>
                  <li>Presensi Masuk Terlambat (&gt; 07:30 WIB): <strong>+5 Poin</strong></li>
                  <li>Presensi Pulang Sesuai Jam Dinas: <strong>+10 Poin</strong></li>
                  <li>Tugas Piket Harian Sekolah: <strong>+10 Poin</strong></li>
                  <li>Penalti Tidak Absen Pulang (TAP) / Alfa: <strong>-10 Poin</strong></li>
                </ul>
                <p>
                  <strong>3. Notifikasi Malam Pengingat:</strong> Notifikasi motivasi otomatis dikirimkan setiap malam untuk menjaga semangat Anda menyambut tantangan esok hari.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200/80 shrink-0 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleShareAchievement}
            className="min-h-11 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
          >
            <Share2 className="w-4 h-4 text-slate-600" />
            <span className="hidden xs:inline">Bagikan Rekor</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="min-h-11 px-6 rounded-2xl bg-[#023246] hover:bg-[#03445e] active:scale-[0.98] text-white font-black text-xs transition-all cursor-pointer shadow-xs shrink-0 ml-auto"
          >
            Tutup
          </button>
        </div>
      </div>

      {/* Modal Pratinjau Piagam Penghargaan Resmi Juara 1 Disiplin */}
      <TeacherExcellenceCertificateModal
        isOpen={isCertificateModalOpen}
        onClose={() => setIsCertificateModalOpen(false)}
        user={user}
        periodMonthYear="September 2026"
        totalPoints={totalPoints}
        rank={selectedCertificateRank}
      />
    </div>
  );
};
