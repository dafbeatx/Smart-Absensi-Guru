import React, { useState, useMemo } from 'react';
import type { TeacherAppreciationScore, UserProfile } from '../../../types/database.types';
import {
  getTeacherDisciplineLeaderboard,
  type DisciplinePeriodType,
} from '../../../utils/teacher-appreciation.utils';
import {
  Trophy,
  Award,
  ShieldCheck,
  Info,
  X,
} from 'lucide-react';

interface TeacherDisciplineBadgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: UserProfile | null;
  currentUserScore: TeacherAppreciationScore;
}

type TabKey = 'LEADERBOARD' | 'RULES' | 'BADGES' | 'MESSAGE';

export const TeacherDisciplineBadgeModal: React.FC<TeacherDisciplineBadgeModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  currentUserScore,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('LEADERBOARD');
  const [selectedPeriod, setSelectedPeriod] = useState<DisciplinePeriodType>('CURRENT_MONTH');

  const {
    leaderboard,
    topTeacher,
    currentUserRank,
    totalTeachers,
  } = useMemo(() => {
    return getTeacherDisciplineLeaderboard(currentUser, currentUserScore, selectedPeriod);
  }, [currentUser, currentUserScore, selectedPeriod]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Card */}
      <div className="relative w-full max-w-xl bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92dvh] sm:max-h-[90vh] z-10 overflow-hidden animate-scale-up">
        {/* ── HEADER ── */}
        <div className="p-3.5 sm:p-5 border-b border-slate-100 bg-linear-to-b from-slate-50/80 to-white shrink-0">
          <div className="flex items-start justify-between gap-2.5 sm:gap-3">
            <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs shrink-0">
                <Trophy className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-sm sm:text-base font-black text-slate-900 leading-tight break-words">
                  Lencana Penghargaan &amp; Apresiasi Kepsek
                </h3>
                <p className="text-[10px] sm:text-xs font-semibold text-slate-500 truncate mt-0.5">
                  Monitoring Performa Disiplin Internal Sekolah
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Tab Navigation (Responsive: Ringkas di HP, Lengkap di Desktop) */}
          <div className="grid grid-cols-4 gap-1 sm:gap-1.5 mt-3 sm:mt-4 p-1 bg-slate-100/90 rounded-2xl">
            <button
              type="button"
              onClick={() => setActiveTab('LEADERBOARD')}
              className={`py-2 px-1 text-center rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'LEADERBOARD'
                  ? 'bg-white text-[#023246] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🏆</span>
              <span>Peringkat</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('RULES')}
              className={`py-2 px-1 text-center rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'RULES'
                  ? 'bg-white text-[#023246] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📊</span>
              <span className="hidden sm:inline">Sistem </span>
              <span>Poin</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('BADGES')}
              className={`py-2 px-1 text-center rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'BADGES'
                  ? 'bg-white text-[#023246] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>🎖️</span>
              <span>Lencana</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('MESSAGE')}
              className={`py-2 px-1 text-center rounded-xl text-[11px] sm:text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ${
                activeTab === 'MESSAGE'
                  ? 'bg-white text-[#023246] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>📜</span>
              <span>Amanat</span>
              <span className="hidden sm:inline"> Kepsek</span>
            </button>
          </div>
        </div>

        {/* ── TAB CONTENT ── */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-3.5 sm:space-y-4 grow">
          {/* TAB 1: LEADERBOARD / PERINGKAT DISIPLIN */}
          {activeTab === 'LEADERBOARD' && (
            <div className="space-y-3.5">
              {/* 🗓️ FILTER PERIODE BULAN (BULAN BERJALAN vs REKAP FINAL BULAN LALU) */}
              <div className="bg-slate-100 p-1 rounded-2xl flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedPeriod('CURRENT_MONTH')}
                  className={`flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedPeriod === 'CURRENT_MONTH'
                      ? 'bg-white text-[#023246] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <span>September 2026</span>
                  <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">(Hari ke-7)</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedPeriod('PREVIOUS_MONTH')}
                  className={`flex-1 py-2 px-2 rounded-xl text-[11px] sm:text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    selectedPeriod === 'PREVIOUS_MONTH'
                      ? 'bg-white text-[#023246] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <span>🏅</span>
                  <span>Agustus 2026</span>
                  <span className="text-[10px] text-slate-400 font-normal hidden sm:inline">(Final)</span>
                </button>
              </div>

              {/* 👑 HERO CARD: SIAPA POIN PALING BANYAK */}
              <div className="relative overflow-hidden rounded-2xl sm:rounded-3xl border border-amber-300/80 bg-linear-to-br from-amber-50 via-white to-amber-50/40 p-3.5 sm:p-5 shadow-xs">
                <div className="flex items-center justify-between gap-2 mb-2.5">
                  <div className="flex items-center gap-1.5 px-2.5 py-0.5 sm:py-1 rounded-full bg-amber-500/15 border border-amber-400/40 text-amber-900 text-[10px] sm:text-[11px] font-extrabold tracking-wide uppercase">
                    <span>👑</span>
                    <span>
                      {selectedPeriod === 'CURRENT_MONTH'
                        ? 'Poin Terbanyak Bulan Berjalan'
                        : 'Poin Tertinggi Agustus'}
                    </span>
                  </div>
                  <span className="text-[10px] sm:text-[11px] font-bold text-amber-800 bg-amber-100/70 px-2 py-0.5 rounded-lg shrink-0">
                    Peringkat 1
                  </span>
                </div>

                <div className="flex items-start gap-3">
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-[#023246] text-white flex items-center justify-center font-black text-lg sm:text-xl shadow-md border-2 border-amber-300">
                      {topTeacher.name.charAt(0)}
                    </div>
                    <span className="absolute -bottom-1 -right-1 w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-amber-400 text-slate-900 flex items-center justify-center text-[10px] sm:text-xs font-black shadow-xs border border-white">
                      🥇
                    </span>
                  </div>

                  <div className="min-w-0 flex-1">
                    <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug break-words">
                      {topTeacher.name}
                    </h4>
                    <p className="text-[11px] font-semibold text-slate-600 truncate mt-0.5">
                      {topTeacher.position}
                    </p>
                    {topTeacher.nip && (
                      <p className="text-[10px] sm:text-[11px] font-mono text-slate-500 mt-0.5">
                        NPP: {topTeacher.nip}
                      </p>
                    )}

                    <div className="flex items-center gap-1.5 sm:gap-2 mt-2 flex-wrap">
                      <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-amber-400 text-slate-950 text-[11px] sm:text-xs font-black flex items-center gap-1 shadow-2xs shrink-0">
                        <span>⭐</span>
                        <span>{topTeacher.totalPoints} Poin</span>
                      </div>
                      <div className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-xl bg-slate-100 text-slate-700 text-[10px] sm:text-xs font-bold flex items-center gap-1 shrink-0">
                        <span>{topTeacher.topBadge.icon}</span>
                        <span className="truncate max-w-40">{topTeacher.topBadge.title}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Ringkasan Kehadiran Rapi & Bersih 2 Kolom Grid */}
                <div className="mt-3 pt-2.5 border-t border-amber-200/70 grid grid-cols-2 gap-2 text-[11px] text-amber-950">
                  <div className="bg-amber-100/50 rounded-xl p-2 border border-amber-200/60">
                    <span className="text-[10px] text-amber-800 font-semibold block">Ketepatan Waktu</span>
                    <span className="font-extrabold text-xs text-amber-950 block mt-0.5">
                      {topTeacher.hadirTepatWaktuCount} Hari On-Time
                    </span>
                  </div>
                  <div className="bg-amber-100/50 rounded-xl p-2 border border-amber-200/60">
                    <span className="text-[10px] text-amber-800 font-semibold block">Tugas Piket</span>
                    <span className="font-extrabold text-xs text-amber-950 block mt-0.5">
                      {topTeacher.piketCount} Kali Bertugas
                    </span>
                  </div>
                </div>
              </div>

              {/* Posisi Anda Saat Ini */}
              <div className="bg-slate-50 rounded-2xl p-3 sm:p-3.5 border border-slate-200/80 flex items-center justify-between gap-2.5 sm:gap-3">
                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center text-xs sm:text-sm font-black shrink-0">
                    #{currentUserRank}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-extrabold text-slate-900 truncate">
                        {currentUser?.full_name || 'Anda'}
                      </span>
                      <span className="px-1.5 py-0.2 bg-[#023246] text-white text-[9px] font-bold rounded shrink-0">
                        Akun Anda
                      </span>
                    </div>
                    <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate mt-0.5">
                      Peringkat #{currentUserRank} dari {totalTeachers} Guru
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <span className="text-xs font-black text-emerald-700 block">
                    {currentUserScore.totalPoints} Poin
                  </span>
                  <span className="text-[10px] text-slate-500 font-semibold block">
                    {currentUserScore.hadirTepatWaktuCount} Hadir On-Time
                  </span>
                </div>
              </div>

              {/* DAFTAR PERINGKAT SEMUA GURU */}
              <div className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Peringkat Disiplin ({totalTeachers} Guru)
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">
                    Berdasarkan Kehadiran Riil
                  </span>
                </div>

                <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200/90 shadow-2xs overflow-hidden">
                  {leaderboard.map((teacher, idx) => {
                    const rankMedal =
                      teacher.rank === 1
                        ? '🥇'
                        : teacher.rank === 2
                        ? '🥈'
                        : teacher.rank === 3
                        ? '🥉'
                        : `#${teacher.rank}`;

                    return (
                      <div
                        key={teacher.id}
                        className={`p-3 sm:p-3.5 flex items-center justify-between gap-2.5 sm:gap-3 transition-colors ${
                          idx > 0 ? 'border-t border-slate-100' : ''
                        } ${
                          teacher.isCurrentUser ? 'bg-cyan-50/60' : 'hover:bg-slate-50'
                        }`}
                      >
                        {/* Left: Medal & Teacher Info */}
                        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <div
                            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                              teacher.rank === 1
                                ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                : teacher.rank === 2
                                ? 'bg-slate-200 text-slate-800'
                                : teacher.rank === 3
                                ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                : 'bg-slate-100 text-slate-600 border border-slate-200/60'
                            }`}
                          >
                            {rankMedal}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h5 className="text-xs font-extrabold text-slate-900 leading-snug break-words">
                                {teacher.name}
                              </h5>
                              {teacher.isCurrentUser && (
                                <span className="px-1.5 py-0.2 bg-[#023246] text-white text-[9px] font-bold rounded shrink-0">
                                  Anda
                                </span>
                              )}
                              {teacher.topBadge.icon === '🏖️' && (
                                <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[9px] font-extrabold rounded border border-amber-200 shrink-0">
                                  Sedang Cuti
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] sm:text-[11px] text-slate-500 truncate mt-0.5">
                              {teacher.position}
                              {teacher.hadirTepatWaktuCount > 0 ? ` • ${teacher.hadirTepatWaktuCount} Hadir` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Right: Points & Badge */}
                        <div className="text-right shrink-0">
                          <span className={`text-xs font-black block ${teacher.totalPoints === 0 ? 'text-slate-400' : 'text-slate-900'}`}>
                            {teacher.totalPoints} Poin
                          </span>
                          <span className="text-[10px] text-slate-500 flex items-center justify-end gap-1 font-medium mt-0.5">
                            <span>{teacher.topBadge.icon}</span>
                            <span className="truncate max-w-20 sm:max-w-28 text-[9px] sm:text-[10px]">
                              {teacher.topBadge.icon === '🏖️' ? 'Sedang Cuti' : teacher.topBadge.title.split(' ')[0] + ' ' + (teacher.topBadge.title.split(' ')[1] || '')}
                            </span>
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: RULES / SISTEM PERHITUNGAN POIN */}
          {activeTab === 'RULES' && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-2 text-[#023246]">
                  <Info className="w-4 h-4 text-cyan-600" />
                  <h4 className="text-xs font-bold uppercase tracking-wider">
                    Transparansi Sistem Poin Disiplin
                  </h4>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Poin performa kedisiplinan dihitung secara otomatis setiap hari kerja berdasarkan
                  waktu kedatangan, kepulangan, keaktifan tugas piket, dan komitmen evaluasi
                  kesejahteraan.
                </p>
              </div>

              {/* Item Bobot Poin */}
              <div className="space-y-2 sm:space-y-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block px-1">
                  Rincian Penilaian Poin Harian
                </span>

                {/* 1. Hadir Tepat Waktu */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center font-bold shrink-0 text-sm sm:text-base">
                      ⏰
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-extrabold text-slate-900 leading-snug">
                        Kehadiran Masuk Tepat Waktu (≤ 07:30 WIB)
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">
                        Scan QR Code atau Sidik Jari tepat waktu di sekolah
                      </p>
                    </div>
                  </div>
                  <span className="px-2 sm:px-2.5 py-1 rounded-xl bg-emerald-50 text-emerald-800 text-[11px] sm:text-xs font-black shrink-0 border border-emerald-200">
                    +15 Poin
                  </span>
                </div>

                {/* 2. Kehadiran Terlambat */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-amber-100 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center font-bold shrink-0 text-sm sm:text-base">
                      ⚠️
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-extrabold text-slate-900 leading-snug">
                        Kehadiran Masuk Terlambat (&gt; 07:30 WIB)
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">
                        Tetap hadir bertugas, mendapat poin dasar kedatangan
                      </p>
                    </div>
                  </div>
                  <span className="px-2 sm:px-2.5 py-1 rounded-xl bg-amber-50 text-amber-800 text-[11px] sm:text-xs font-black shrink-0 border border-amber-200">
                    +5 Poin
                  </span>
                </div>

                {/* 3. Tugas Piket Sekolah */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-cyan-50 text-cyan-700 flex items-center justify-center font-bold shrink-0 text-sm sm:text-base">
                      🛡️
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-extrabold text-slate-900 leading-snug">
                        Melaksanakan Tugas Piket Sekolah
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">
                        Hadir di sekolah bertugas mendampingi RFID siswa
                      </p>
                    </div>
                  </div>
                  <span className="px-2 sm:px-2.5 py-1 rounded-xl bg-cyan-50 text-cyan-800 text-[11px] sm:text-xs font-black shrink-0 border border-cyan-200">
                    +10 Poin
                  </span>
                </div>

                {/* 4. Status Sakit & Izin Resmi */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center font-bold shrink-0 text-sm sm:text-base">
                      📋
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-extrabold text-slate-900 leading-snug">
                        Status Izin &amp; Sakit Resmi
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">
                        Pengajuan sah disetujui, tidak ada penambahan poin fisik
                      </p>
                    </div>
                  </div>
                  <span className="px-2 sm:px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-[11px] sm:text-xs font-black shrink-0 border border-slate-200">
                    0 Poin
                  </span>
                </div>

                {/* 5. Status Cuti Resmi */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-white border border-slate-200/90 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-50 text-amber-800 flex items-center justify-center font-bold shrink-0 text-sm sm:text-base">
                      🏖️
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-extrabold text-slate-900 leading-snug">
                        Status Cuti Resmi (Melahirkan / Tahunan)
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-slate-500 leading-tight mt-0.5">
                        Tercatat cuti resmi, tidak ada akumulasi poin harian
                      </p>
                    </div>
                  </div>
                  <span className="px-2 sm:px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-[11px] sm:text-xs font-black shrink-0 border border-slate-200">
                    0 Poin
                  </span>
                </div>

                {/* 6. Pengecualian Status ALFA (Disetel Admin) */}
                <div className="p-3 sm:p-3.5 rounded-2xl bg-rose-50/60 border border-rose-200/80 flex items-center justify-between gap-2.5 sm:gap-3 shadow-2xs">
                  <div className="flex items-center gap-2.5 sm:gap-3 min-w-0 flex-1">
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center font-bold shrink-0 text-sm sm:text-base">
                      🚫
                    </div>
                    <div className="min-w-0 flex-1">
                      <h5 className="text-xs font-extrabold text-rose-950 leading-snug">
                        Pengecualian Status ALFA (Disetel Admin)
                      </h5>
                      <p className="text-[10px] sm:text-[11px] text-rose-800 leading-tight mt-0.5">
                        Tidak masuk tanpa kabar/izin yang disetujui Admin
                      </p>
                    </div>
                  </div>
                  <span className="px-2 sm:px-2.5 py-1 rounded-xl bg-rose-100 text-rose-900 text-[11px] sm:text-xs font-black shrink-0 border border-rose-300">
                    -10 Poin
                  </span>
                </div>
              </div>

              {/* Tier Level */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-3">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider block">
                  Jenjang Level Apresiasi Pendidik (Berdasarkan Kehadiran Nyata)
                </span>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                    <span className="font-extrabold text-slate-800 block">Level 1: Berkomitmen</span>
                    <span className="text-[11px] text-slate-500">1 – 49 Poin</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                    <span className="font-extrabold text-slate-800 block">Level 2: Berdedikasi</span>
                    <span className="text-[11px] text-slate-500">50 – 64 Poin</span>
                  </div>
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200/70">
                    <span className="font-extrabold text-amber-700 block">Level 3: Disiplin Emas</span>
                    <span className="text-[11px] text-slate-500">65 – 79 Poin</span>
                  </div>
                  <div className="p-2.5 rounded-xl border border-amber-300 bg-amber-50/40">
                    <span className="font-extrabold text-amber-900 block">Level 4: Teladan Utama</span>
                    <span className="text-[11px] text-amber-800">80+ Poin</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: BADGES / KATALOG LENCANA APRESIASI KEPSEK */}
          {activeTab === 'BADGES' && (
            <div className="space-y-3">
              <div className="bg-amber-50/80 rounded-2xl p-3.5 border border-amber-200/80 flex items-center gap-3">
                <Award className="w-5 h-5 text-amber-700 shrink-0" />
                <p className="text-xs text-amber-900 font-medium leading-relaxed">
                  Lencana merupakan tanda kehormatan resmi dari Kepala Sekolah yang tersemat pada profil
                  Anda dan disinkronkan secara transparan di sistem sekolah.
                </p>
              </div>

              {/* Lencana Spesial Poin Tertinggi */}
              <div className="p-4 rounded-2xl bg-linear-to-r from-amber-50 via-white to-amber-50 border-2 border-amber-300 shadow-2xs space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">🏆</span>
                    <div>
                      <h4 className="text-xs font-black text-slate-900">
                        Lencana Pendidik Teladan Utama Kepsek
                      </h4>
                      <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md">
                        Penghargaan Tertinggi Kepala Sekolah
                      </span>
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Diberikan secara eksklusif kepada guru dengan perolehan akumulasi poin kedisiplinan
                  tertinggi di sekolah. Saat ini dipegang oleh: <strong>{topTeacher.name}</strong> ({topTeacher.totalPoints} Poin).
                </p>
              </div>

              {/* Daftar Lencana Personal Guru */}
              <div className="space-y-2.5">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider block px-1">
                  Status Lencana Anda Bulan Ini
                </span>

                {currentUserScore.badges.map((badge) => (
                  <div
                    key={badge.id}
                    className={`p-3.5 rounded-2xl border transition-all ${
                      badge.isUnlocked
                        ? 'bg-white border-emerald-200 shadow-2xs'
                        : 'bg-slate-50/70 border-slate-200/60 opacity-85'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2.5 sm:gap-3">
                      <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                        <span className="text-2xl shrink-0 mt-0.5">{badge.icon}</span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                            <h5 className="text-xs font-extrabold text-slate-900 leading-snug">
                              {badge.title}
                            </h5>
                            {badge.isUnlocked ? (
                              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] font-bold rounded-md bg-emerald-100 text-emerald-800 shrink-0">
                                Aktif
                              </span>
                            ) : (
                              <span className="px-1.5 sm:px-2 py-0.5 text-[9px] font-bold rounded-md bg-slate-200 text-slate-600 shrink-0">
                                Progres {badge.progressPercent}%
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-[11px] text-slate-500 mt-1 leading-relaxed">
                            {badge.description}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mt-3 w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${
                          badge.isUnlocked ? 'bg-emerald-500' : 'bg-cyan-600'
                        }`}
                        style={{ width: `${badge.progressPercent}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 4: MESSAGE / AMANAT KEPALA SEKOLAH */}
          {activeTab === 'MESSAGE' && (
            <div className="space-y-4">
              <div className="bg-linear-to-br from-[#023246] to-[#18536B] text-white rounded-3xl p-5 shadow-sm space-y-3 relative overflow-hidden">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 backdrop-blur-xs flex items-center justify-center font-black text-xl border border-white/20">
                    FS
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white leading-tight">
                      Farhan Sopian Sahid, S.Pd.I
                    </h4>
                    <p className="text-xs text-cyan-200 font-medium">
                      Kepala Sekolah SMATAS
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/15 text-xs sm:text-sm leading-relaxed text-slate-100 space-y-2">
                  <p>
                    <em>&ldquo;Bapak dan Ibu Pendidik yang kami muliakan,&rdquo;</em>
                  </p>
                  <p>
                    &ldquo;Kedisiplinan di sekolah kita bukan sekadar angka di atas kertas atau rekap jam
                    presensi semata. Disiplin adalah bahasa cinta kita kepada para murid—sebuah
                    keteladanan hidup yang mereka rekam setiap pagi saat melihat para gurunya telah hadir
                    dengan senyum dan kesiapan mendidik.&rdquo;
                  </p>
                  <p>
                    &ldquo;Sistem <strong>Lencana Penghargaan &amp; Apresiasi Kepsek</strong> ini hadir
                    sebagai wujud penghormatan tulus pimpinan kepada bapak/ibu yang telah mendedikasikan
                    waktu, tenaga, dan energinya demi kemajuan peradaban sekolah kita. Selamat kepada
                    seluruh dewan guru, khususnya pemegang poin terdepan atas integritasnya.&rdquo;
                  </p>
                </div>

                <div className="pt-3 border-t border-white/15 flex items-center justify-between text-[11px] text-cyan-200">
                  <span>Disahkan di Tasikmalaya</span>
                  <span>Kepala Sekolah SMATAS</span>
                </div>
              </div>

              {/* Catatan Integritas */}
              <div className="bg-slate-50 rounded-2xl p-4 border border-slate-200/80 space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-1.5 font-bold text-slate-800">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>Komitmen Integritas &amp; Validitas Absensi</span>
                </div>
                <p className="leading-relaxed">
                  Semua perolehan poin diaudit secara berkala melalui sensor GPS geofence, validasi QR
                  Poster, dan integrasi absensi biometrik untuk menjamin transparansi serta keadilan
                  bagi seluruh pendidik.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER ── */}
        <div className="p-3 sm:p-4 border-t border-slate-100 bg-slate-50/90 flex items-center justify-between gap-2.5 shrink-0">
          <div className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate flex-1">
            {activeTab === 'LEADERBOARD' && (
              <span>Poin Terbanyak: <strong>{topTeacher.name.split(',')[0]}</strong> ({topTeacher.totalPoints} Poin)</span>
            )}
            {activeTab === 'RULES' && (
              <span>Hadir: +15 Poin • Telat: +5 Poin • Piket: +10 Poin</span>
            )}
            {activeTab === 'BADGES' && (
              <span>{currentUserScore.badges.filter(b => b.isUnlocked).length} dari {currentUserScore.badges.length} Lencana Terbuka</span>
            )}
            {activeTab === 'MESSAGE' && (
              <span>Apresiasi Resmi Manajemen Sekolah</span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="h-10 sm:h-11 px-5 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-bold transition-all cursor-pointer shadow-xs shrink-0 flex items-center justify-center min-w-[70px]"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
