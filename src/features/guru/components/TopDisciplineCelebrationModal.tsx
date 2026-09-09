import React, { useState } from 'react';
import type { UserProfile } from '../../../types/database.types';
import type { TeacherLeaderboardItem } from '../../../utils/teacher-appreciation.utils';
import {
  Trophy,
  Award,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  X,
  Printer,
} from 'lucide-react';
import { TeacherExcellenceCertificateModal } from './TeacherExcellenceCertificateModal';

interface TopDisciplineCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLeaderboard: () => void;
  rank: number;
  totalPoints: number;
  user: UserProfile | null;
  teacherData?: TeacherLeaderboardItem | null;
  onOpenCertificate?: () => void;
}

export const TopDisciplineCelebrationModal: React.FC<TopDisciplineCelebrationModalProps> = ({
  isOpen,
  onClose,
  onOpenLeaderboard,
  rank,
  totalPoints,
  user,
  teacherData,
  onOpenCertificate,
}) => {
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  if (!isOpen) return null;

  const isRank1 = rank === 1;
  const isRank2 = rank === 2;

  const rankTitle = isRank1
    ? 'Juara 1 Teladan Utama Kepsek'
    : isRank2
    ? 'Peringkat 2 Pendidik Terdisiplin'
    : 'Peringkat 3 Pendidik Terdisiplin';

  const rankBadgeEmoji = isRank1 ? '🥇' : isRank2 ? '🥈' : '🥉';

  const rankTheme = isRank1
    ? {
        border: 'border-amber-300',
        bg: 'from-amber-500/15 via-white to-amber-50/40',
        badgeBg: 'bg-amber-400 text-slate-950',
        cardBorder: 'border-amber-300/80',
        accentText: 'text-amber-900',
      }
    : isRank2
    ? {
        border: 'border-slate-300',
        bg: 'from-slate-500/10 via-white to-slate-50/40',
        badgeBg: 'bg-slate-300 text-slate-900',
        cardBorder: 'border-slate-300/80',
        accentText: 'text-slate-900',
      }
    : {
        border: 'border-amber-200',
        bg: 'from-amber-600/10 via-white to-amber-50/30',
        badgeBg: 'bg-amber-600/20 text-amber-900',
        cardBorder: 'border-amber-300/60',
        accentText: 'text-amber-900',
      };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div
        className={`relative w-full max-w-md bg-white rounded-3xl shadow-2xl border-2 ${rankTheme.border} p-5 sm:p-6 text-center space-y-4 z-10 overflow-hidden animate-scale-up`}
      >
        {/* Decorative Top Accent Glow */}
        <div
          className={`absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full bg-linear-to-b ${rankTheme.bg} blur-2xl pointer-events-none opacity-60`}
        />

        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-colors cursor-pointer z-20"
          aria-label="Tutup"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Trophy & Sparkles Hero Header */}
        <div className="relative pt-2">
          <div className="relative inline-block">
            {/* Pulsing ring */}
            <div className="absolute inset-0 rounded-3xl bg-amber-400/20 animate-ping" />

            <div className="relative w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-linear-to-br from-[#18536B] to-[#023246] text-amber-300 flex items-center justify-center shadow-lg border-2 border-amber-300/80 mx-auto">
              <Trophy className="w-10 h-10 sm:w-11 sm:h-11 text-amber-300" />
            </div>

            {/* Medal Badge Pill */}
            <span className="absolute -bottom-2 -right-2 w-8 h-8 rounded-full bg-white text-slate-900 flex items-center justify-center text-lg font-black shadow-md border-2 border-amber-400">
              {rankBadgeEmoji}
            </span>
          </div>
        </div>

        {/* Celebratory Title & Badges */}
        <div className="space-y-1.5 relative z-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-800 text-xs font-black uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5 text-amber-600" />
            <span>Apresiasi Resmi Kepala Sekolah</span>
          </div>

          <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
            Selamat, {user?.full_name || 'Bapak/Ibu Guru'}!
          </h3>

          <p className="text-xs sm:text-sm font-bold text-slate-600">
            Anda berhasil meraih{' '}
            <span className="text-amber-800 font-extrabold underline decoration-amber-400">
              {rankTitle}
            </span>{' '}
            Bulan Ini
          </p>
        </div>

        {/* Score & Recognition Card */}
        <div
          className={`rounded-2xl border ${rankTheme.cardBorder} bg-linear-to-br from-slate-50 via-white to-amber-50/30 p-3.5 sm:p-4 text-left space-y-2.5 shadow-2xs relative z-10`}
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-700" />
              <span className="text-xs font-bold text-slate-700">Akumulasi Kedisiplinan</span>
            </div>
            <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
              {totalPoints} Poin
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-white p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Posisi Sekolah
              </span>
              <span className="text-sm font-black text-slate-900">
                Peringkat #{rank}
              </span>
            </div>

            <div className="bg-white p-2.5 rounded-xl border border-slate-100">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">
                Ketepatan Waktu
              </span>
              <span className="text-sm font-black text-emerald-700">
                {teacherData?.hadirTepatWaktuCount || '100%'} On-Time
              </span>
            </div>
          </div>

          {/* Pesan Inspiratif */}
          <div className="pt-1 text-[11px] text-slate-600 leading-relaxed italic border-t border-slate-100/80">
            &ldquo;Keteladanan waktu dan dedikasi bapak/ibu adalah cermin kebaikan bagi seluruh murid di
            sekolah. Pertahankan prestasi dan integritas mulia ini.&rdquo;
            <span className="block not-italic font-bold text-slate-700 mt-1">
              — Farhan Sopian Sahid, S.Pd.I (Kepala Sekolah)
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 pt-1 relative z-10">
          {/* Tombol Khusus Juara 1: Buka & Cetak Piagam Resmi */}
          {isRank1 && (
            <button
              type="button"
              onClick={() => {
                if (onOpenCertificate) {
                  onOpenCertificate();
                } else {
                  setIsCertificateOpen(true);
                }
              }}
              className="w-full h-11 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-[0.98] text-slate-950 text-xs sm:text-sm font-black flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
            >
              <Printer className="w-4 h-4 text-slate-950" />
              <span>🥇 Lihat &amp; Cetak Piagam Resmi (PDF)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLeaderboard();
            }}
            className="w-full h-11 rounded-2xl bg-[#023246] hover:bg-[#034560] active:scale-[0.98] text-white text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <span>Buka Layer Penjelasan &amp; Peringkat</span>
            <ArrowRight className="w-4 h-4 text-cyan-300" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          >
            Terima Kasih, Lanjut ke Beranda
          </button>
        </div>

        {/* Footer Verification Badge */}
        <div className="flex items-center justify-center gap-1 text-[10px] text-slate-400 font-semibold pt-1 border-t border-slate-100">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Terverifikasi Otomatis oleh Sistem Keamanan Absensi</span>
        </div>
      </div>

      {/* Modal Pratinjau Piagam Penghargaan Resmi */}
      <TeacherExcellenceCertificateModal
        isOpen={isCertificateOpen}
        onClose={() => setIsCertificateOpen(false)}
        user={user}
        periodMonthYear="September 2026"
        totalPoints={totalPoints}
        rank={rank}
      />
    </div>
  );
};
