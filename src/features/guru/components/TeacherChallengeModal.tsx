import React, { useState } from 'react';
import type { TeacherStreakInfo, TeacherDailyQuest } from '../../../services/teacher-challenge.service';
import type { UserProfile, TeacherAppreciationScore } from '../../../types/database.types';
import { X, HelpCircle, Share2, Printer, ExternalLink } from 'lucide-react';
import { useToastStore } from '../../../store/useToastStore';
import { TeacherExcellenceCertificateModal } from './TeacherExcellenceCertificateModal';
import { openPrintableCertificate } from '../../../lib/certificate-generator.lib';

interface TeacherChallengeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  streakInfo: TeacherStreakInfo;
  quests: TeacherDailyQuest[];
  appreciationScore: TeacherAppreciationScore;
  userRank?: number;
  totalTeachers?: number;
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
}) => {
  const [activeTab, setActiveTab] = useState<'QUESTS' | 'REWARDS' | 'RULES'>('QUESTS');
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const { showToast } = useToastStore();

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

          {/* TAB 2: TEMPLATE PIAGAM PENGHARGAAN RESMI (JUARA 1 TELADAN UTAMA - TOP #1) */}
          {activeTab === 'REWARDS' && (
            <div className="space-y-3">
              {/* Highlight Card Juara 1 Sesuai Spesifikasi Persis User */}
              <div className="p-4 rounded-2xl bg-linear-to-b from-[#fffefc] to-[#faf7ee] border-2 border-amber-300 shadow-sm relative overflow-hidden space-y-3">
                {/* Header Juara 1 & Predikat */}
                <div className="flex items-start justify-between gap-2 border-b border-amber-200/80 pb-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-2xl">🥇</span>
                    <div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                        Juara 1 Disiplin (Pendidik Teladan Utama)
                      </h4>
                      <p className="text-[10.5px] text-amber-900 font-bold">
                        Apresiasi Kehormatan Tertinggi Guru &amp; Tenaga Kependidikan
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 font-black text-xs shadow-2xs shrink-0">
                    Top #1
                  </span>
                </div>

                {/* 3 Hak Istimewa Resmi yang Diminta User */}
                <div className="space-y-2">
                  <div className="flex items-start gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-amber-200/70 shadow-2xs">
                    <span className="text-base shrink-0">📜</span>
                    <span className="font-semibold leading-relaxed">
                      Piagam Penghargaan Resmi bertanda tangan Kepala Sekolah.
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-slate-700 bg-white p-2.5 rounded-xl border border-amber-200/70 shadow-2xs">
                    <span className="text-base shrink-0">🖼️</span>
                    <span className="font-semibold leading-relaxed">
                      Foto Profil dipajang di Papan Mading Digital Sekolah.
                    </span>
                  </div>

                  <div className="flex items-start gap-2 text-xs text-amber-950 bg-amber-100/60 p-2.5 rounded-xl border border-amber-300/80 shadow-2xs">
                    <span className="text-base shrink-0">⭐</span>
                    <span className="font-bold leading-relaxed">
                      Hak Istimewa: Prioritas pemilihan jadwal piket semester depan.
                    </span>
                  </div>
                </div>

                {/* Info Tanda Tangan & Stempel */}
                <div className="pt-1 flex items-center justify-between text-[11px] text-slate-500 border-t border-amber-200/60">
                  <span className="italic">Tertanda: Farhan Sopian Sahid, S.Pd.I</span>
                  <span className="font-bold text-amber-800">Format Resmi A4</span>
                </div>

                {/* Action Buttons: Cetak & Pratinjau */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsCertificateModalOpen(true)}
                    className="min-h-11 px-3 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 active:scale-95 text-slate-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5 text-slate-600" />
                    <span>Lihat Template</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      openPrintableCertificate({
                        recipientName: teacherName,
                        recipientNipOrNpp: user?.nip || '199001012015011001',
                        recipientPosition: user?.position || 'Guru Mata Pelajaran',
                        periodMonthYear: 'September 2026',
                        totalPoints,
                        rank: userRank,
                      });
                    }}
                    className="min-h-11 px-3 rounded-xl bg-[#023246] hover:bg-[#03445e] active:scale-95 text-white text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md"
                  >
                    <Printer className="w-3.5 h-3.5 text-amber-300" />
                    <span>Cetak Piagam (PDF)</span>
                  </button>
                </div>
              </div>
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
        rank={userRank}
      />
    </div>
  );
};
