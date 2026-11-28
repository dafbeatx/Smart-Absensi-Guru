import React, { useEffect, useState } from 'react';
import type { UserProfile } from '../../../types/database.types';
import type { TeacherLeaderboardItem } from '../../../utils/teacher-appreciation.utils';
import { getDisciplinePeriodMetadata } from '../../../utils/teacher-appreciation.utils';
import { ArrowRight, X } from 'lucide-react';
import {
  SagaChallengeTrophyIcon,
  SagaDeviceShieldIcon,
  SagaMedalRankIcon,
  SagaPrinterIcon,
  SagaSparkAiIcon,
} from '../../../components/ui/SagaServiceIcons';
import { TeacherExcellenceCertificateModal } from './TeacherExcellenceCertificateModal';

interface TopDisciplineCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenLeaderboard: () => void;
  rank: number;
  totalPoints: number;
  user: UserProfile | null;
  teacherData?: TeacherLeaderboardItem | null;
  topTeachers?: TeacherLeaderboardItem[] | null;
  onOpenCertificate?: () => void;
  periodMonthYear?: string;
}

export const TopDisciplineCelebrationModal: React.FC<TopDisciplineCelebrationModalProps> = ({
  isOpen,
  onClose,
  onOpenLeaderboard,
  rank,
  totalPoints,
  user,
  teacherData,
  topTeachers,
  onOpenCertificate,
  periodMonthYear,
}) => {
  const [isCertificateOpen, setIsCertificateOpen] = useState(false);
  const defaultPeriod = React.useMemo(() => getDisciplinePeriodMetadata('CURRENT_MONTH').label, []);
  const effectivePeriod = periodMonthYear || defaultPeriod;

  useEffect(() => {
    if (!isOpen || rank < 1 || rank > 3) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen, rank]);

  if (!isOpen || rank < 1 || rank > 3) return null;

  const isRank1 = rank === 1;
  const isRank2 = rank === 2;
  const isRank3 = rank === 3;

  const rankTitle = isRank1
    ? 'Juara 1 Teladan Utama Kepsek'
    : isRank2
    ? 'Peringkat 2 Pendidik Terdisiplin'
    : isRank3
    ? 'Peringkat 3 Pendidik Terdisiplin'
    : `Peringkat #${rank} Pendidik Terdisiplin`;

  const rankTheme = isRank1
    ? {
        border: 'sm:border-amber-300',
        cardBorder: 'border-amber-300/80',
      }
    : isRank2
    ? {
        border: 'sm:border-slate-300',
        cardBorder: 'border-slate-300/80',
      }
    : {
        border: 'sm:border-amber-200',
        cardBorder: 'border-amber-300/60',
      };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70"
      role="dialog"
      aria-modal="true"
      aria-label="Apresiasi Kedisiplinan Guru"
    >
      {/* Backdrop */}
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Fullscreen Infinix Note 8 / Centered Desktop Container */}
      <div
        className={`relative w-full h-dvh sm:h-auto sm:max-h-[92dvh] sm:max-w-md bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border-2 ${rankTheme.border} flex flex-col overflow-hidden z-10`}
      >
        {/* 1. Sticky Top Header */}
        <header className="shrink-0 bg-white border-b border-slate-100 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center shrink-0">
              <SagaMedalRankIcon rank={rank} className="w-6 h-6" />
            </div>
            <div className="min-w-0 text-left">
              <h2 className="text-sm font-bold text-slate-900 truncate leading-tight">
                Apresiasi Pendidik Terdisiplin
              </h2>
              <p className="text-xs text-slate-500 font-medium truncate">
                Periode {effectivePeriod}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 2. Scrollable Body */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 text-center">
          {/* Trophy Emblem */}
          <div className="relative flex justify-center">
            <div className="relative inline-block">
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-3xl bg-[#0D5C46] text-white flex items-center justify-center shadow-md border-2 border-amber-300 mx-auto">
                <SagaChallengeTrophyIcon tone="dark" className="w-11 h-11" />
              </div>

              <span className="absolute -bottom-2 -right-2 w-9 h-9 rounded-full bg-white flex items-center justify-center shadow-sm border-2 border-amber-400">
                <SagaMedalRankIcon rank={rank} className="w-6 h-6" />
              </span>
            </div>
          </div>

          {/* Celebratory Title */}
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold uppercase tracking-wide">
              <SagaSparkAiIcon className="w-3.5 h-3.5" />
              <span>Apresiasi Resmi Kepala Sekolah</span>
            </div>

            <h3 className="text-xl sm:text-2xl font-bold text-slate-900 leading-tight">
              Selamat, {user?.full_name || 'Bapak/Ibu Guru'}!
            </h3>

            <p className="text-sm font-medium text-slate-600">
              Anda berhasil meraih{' '}
              <span className="text-[#0D5C46] font-bold underline decoration-amber-400">
                {rankTitle}
              </span>{' '}
              Bulan Ini
            </p>
          </div>

          {/* Score & Recognition Card */}
          <div
            className={`rounded-2xl border ${rankTheme.cardBorder} bg-[#F8FAFC] p-3.5 sm:p-4 text-left space-y-3`}
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <SagaMedalRankIcon rank={rank} className="w-5 h-5" />
                <span className="text-xs font-bold text-slate-700">Akumulasi Kedisiplinan</span>
              </div>
              <span className="text-xs font-bold text-[#0D5C46] bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                {totalPoints} Poin
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                  Posisi Sekolah
                </span>
                <span className="text-sm font-bold text-slate-900">
                  Peringkat #{rank}
                </span>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                <span className="text-[11px] font-semibold text-slate-500 block uppercase">
                  Ketepatan Waktu
                </span>
                <span className="text-sm font-bold text-[#0D5C46]">
                  {teacherData?.hadirTepatWaktuCount || '100%'} On-Time
                </span>
              </div>
            </div>

            {/* Klasemen Transparan 3 Besar Sekolah */}
            {topTeachers && topTeachers.length > 0 && (
              <div className="pt-2 border-t border-slate-200 space-y-1.5 text-left">
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                  <span>Klasemen 3 Besar Bulan Ini</span>
                  <span className="text-[#0D5C46]">Terverifikasi Realtime</span>
                </div>
                <div className="space-y-1.5">
                  {topTeachers.slice(0, 3).map((item, idx) => {
                    const isCurrentItem = item.isCurrentUser || (user?.id && item.id === user.id);
                    return (
                      <div
                        key={item.id || idx}
                        className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 border ${
                          isCurrentItem
                            ? 'bg-amber-50 border-amber-300 font-bold text-slate-900'
                            : 'bg-white border-slate-200 text-slate-700 font-medium'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <SagaMedalRankIcon rank={idx + 1} className="w-5 h-5 shrink-0" />
                          <span className="truncate text-xs font-bold">
                            {item.name} {isCurrentItem ? '(Anda)' : ''}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 text-right">
                          <span className="text-[11px] text-slate-500 font-semibold hidden sm:inline">
                            {item.hadirTepatWaktuCount} On-Time
                          </span>
                          <span className={`text-xs font-bold ${isCurrentItem ? 'text-amber-900' : 'text-slate-900'}`}>
                            {item.totalPoints} Poin
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Pesan Inspiratif */}
            <div className="pt-2 text-xs text-slate-600 leading-relaxed italic border-t border-slate-200">
              &ldquo;Keteladanan waktu dan dedikasi bapak/ibu adalah cermin kebaikan bagi seluruh murid di
              sekolah. Pertahankan prestasi dan integritas mulia ini.&rdquo;
              <span className="block not-italic font-bold text-slate-800 mt-1">
                — Farhan Sopian Sahid, S.Pd.I (Kepala Sekolah)
              </span>
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 font-medium">
            <SagaDeviceShieldIcon className="w-4 h-4 shrink-0" />
            <span>Terverifikasi Otomatis oleh Sistem Keamanan Absensi</span>
          </div>
        </div>

        {/* 3. Sticky Bottom Action Bar */}
        <div className="shrink-0 bg-white border-t border-slate-100 p-4 pb-[max(14px,env(safe-area-inset-bottom))] space-y-2 z-10">
          {rank <= 3 && (
            <button
              type="button"
              onClick={() => {
                if (onOpenCertificate) {
                  onOpenCertificate();
                } else {
                  setIsCertificateOpen(true);
                }
              }}
              className={`w-full min-h-12 px-4 rounded-2xl active:scale-[0.99] text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer ${
                isRank1
                  ? 'bg-amber-400 hover:bg-amber-300 text-slate-950'
                  : isRank2
                  ? 'bg-slate-200 hover:bg-slate-300 text-slate-900 border border-slate-300'
                  : 'bg-amber-700 hover:bg-amber-800 text-white'
              }`}
            >
              <SagaPrinterIcon tone={isRank3 ? 'dark' : 'light'} className="w-5 h-5 shrink-0" />
              <span>Lihat &amp; Cetak Piagam Juara {rank} (PDF)</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenLeaderboard();
            }}
            className="w-full min-h-12 px-4 rounded-2xl bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.99] text-white text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <span>Buka Layer Penjelasan &amp; Peringkat</span>
            <ArrowRight className="w-4 h-4 text-emerald-200" />
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-full min-h-11 text-xs font-bold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
          >
            Terima Kasih, Lanjut ke Beranda
          </button>
        </div>
      </div>

      {/* Modal Pratinjau Piagam Penghargaan Resmi */}
      <TeacherExcellenceCertificateModal
        isOpen={isCertificateOpen}
        onClose={() => setIsCertificateOpen(false)}
        user={user}
        periodMonthYear={effectivePeriod}
        totalPoints={totalPoints}
        rank={rank}
      />
    </div>
  );
};
