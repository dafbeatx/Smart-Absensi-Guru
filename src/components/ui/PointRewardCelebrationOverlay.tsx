import React, { useEffect, useState, useMemo } from 'react';
import { ArrowRight } from 'lucide-react';
import {
  SagaChallengeTrophyIcon,
  SagaCheckBadgeIcon,
  SagaClockStatusIcon,
  SagaDeviceShieldIcon,
  SagaSparkAiIcon,
} from './SagaServiceIcons';
import { SoundService } from '../../services/audio.service';
import { SpeechService } from '../../services/speech.service';

export interface PointRewardData {
  id?: string;
  dedupeKey?: string;
  points: number;
  status: 'HADIR' | 'TERLAMBAT' | string;
  reason: string;
  breakdown?: {
    attendance?: number;
    piket?: number;
    checkout?: number;
  };
  teacherName: string;
  timestamp?: string;
}

export interface PointRewardCelebrationOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  data: PointRewardData | null;
}

interface Particle {
  id: number;
  left: number;
  top: number;
  size: number;
  color: string;
  shape: 'star' | 'diamond' | 'dot';
}

export const PointRewardCelebrationOverlay: React.FC<PointRewardCelebrationOverlayProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);

  // Confetti SVG geometris statis yang tenang & ringan (nol emoji)
  const particles: Particle[] = useMemo(() => {
    const shapes: Array<'star' | 'diamond' | 'dot'> = ['star', 'diamond', 'dot'];
    const colors = ['#FDE047', '#4ADE80', '#60A5FA', '#FB923C', '#FDA4AF'];

    return Array.from({ length: 18 }).map((_, idx) => ({
      id: idx,
      left: ((idx * 19 + 7) % 88) + 6,
      top: ((idx * 23 + 9) % 82) + 6,
      size: 10 + (idx % 3) * 3,
      color: colors[idx % colors.length],
      shape: shapes[idx % shapes.length],
    }));
  }, []);

  // Trigger sound, voice, and auto-dismiss countdown
  useEffect(() => {
    if (!isOpen || !data) return;

    // 1. Play Golden Chime & AI Voice announcement
    SoundService.playPointRewardSound();
    const isDutyToday = (data.breakdown?.piket ?? 0) > 0;
    SpeechService.speakPointReward(data.points, data.teacherName, data.reason, isDutyToday);

    // 2. Countdown timer 5s auto-dismiss
    setSecondsLeft(5);
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
    };
  }, [isOpen, data, onClose]);

  if (!isOpen || !data) return null;

  const cleanName = data.teacherName.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\.|S\.E\.|G\.r/g, '').trim();
  const isOnTime = data.status === 'HADIR' || data.reason.includes('Tepat Waktu');
  const isCheckout = data.reason.includes('Pulang') || (data.breakdown?.checkout ?? 0) > 0;
  const hasDutyBonus = (data.breakdown?.piket ?? 0) > 0;
  const hasCheckoutBonus = (data.breakdown?.checkout ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none cursor-pointer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Apresiasi Poin Kedisiplinan"
    >
      {/* Confetti SVG geometris bersih (nol emoji, nol halo blur) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <svg
            key={p.id}
            viewBox="0 0 12 12"
            width={p.size}
            height={p.size}
            className="absolute opacity-80"
            style={{ left: `${p.left}%`, top: `${p.top}%` }}
            aria-hidden="true"
          >
            {p.shape === 'star' && (
              <path
                d="M6 0.8 7.3 4.7 11.2 6 7.3 7.3 6 11.2 4.7 7.3 0.8 6 4.7 4.7Z"
                fill={p.color}
              />
            )}
            {p.shape === 'diamond' && (
              <polygon points="6,1 11,6 6,11 1,6" fill={p.color} />
            )}
            {p.shape === 'dot' && <circle cx="6" cy="6" r="3.5" fill={p.color} />}
          </svg>
        ))}
      </div>

      {/* Reward Celebration Panel */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm sm:max-w-md w-full px-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Emblem Piala Resmi */}
        <div className="relative flex items-center justify-center mb-3">
          <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-[#0D5C46] flex items-center justify-center border-2 border-amber-300 shadow-lg">
            <SagaChallengeTrophyIcon tone="dark" className="w-14 h-14" />
          </div>
        </div>

        {/* 2. Tagline */}
        <div className="flex items-center gap-1.5 text-amber-300 text-xs sm:text-sm font-bold uppercase tracking-wider mt-1">
          <SagaSparkAiIcon tone="dark" className="w-4 h-4 shrink-0" />
          <span>Apresiasi Kedisiplinan Sekolah</span>
        </div>

        {/* 3. Points Badge */}
        <div className="flex items-baseline justify-center gap-2 mt-1.5">
          <span className="text-5xl sm:text-6xl font-bold text-amber-300 tracking-tight">
            +{data.points}
          </span>
          <span className="text-2xl sm:text-3xl font-bold text-white uppercase tracking-wider">
            POIN
          </span>
        </div>

        {/* 4. Pill Keterangan */}
        <div className="mt-3 flex flex-col items-center gap-2 max-w-xs sm:max-w-sm w-full">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 border border-white/25 text-amber-100 text-xs sm:text-sm font-bold">
            {isOnTime || isCheckout ? (
              <SagaClockStatusIcon tone="dark" className="w-4 h-4 shrink-0" />
            ) : (
              <SagaCheckBadgeIcon tone="dark" className="w-4 h-4 shrink-0" />
            )}
            <span>{data.reason}</span>
          </div>

          {hasDutyBonus && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#0D5C46] border border-emerald-300/40 text-emerald-100 text-xs font-semibold">
              <SagaDeviceShieldIcon tone="dark" className="w-4 h-4 shrink-0" />
              <span>Termasuk Bonus Tugas Piket (+{data.breakdown?.piket} Poin)</span>
            </div>
          )}

          {hasCheckoutBonus && (
            <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-slate-800 border border-white/25 text-slate-100 text-xs font-semibold">
              <SagaDeviceShieldIcon tone="dark" className="w-4 h-4 shrink-0" />
              <span>Tuntas Jam Dinas Sekolah (+{data.breakdown?.checkout} Poin)</span>
            </div>
          )}
        </div>

        {/* 5. Pesan Ucapan */}
        <div className="mt-4 text-center max-w-sm px-2 space-y-1">
          <h4 className="text-white font-bold text-base sm:text-lg">
            Selamat, {cleanName}!
          </h4>
          <p className="text-slate-200 text-sm leading-relaxed font-normal">
            {isCheckout
              ? 'Terima kasih atas dedikasi dan pengabdian Anda bertugas di sekolah hari ini. Selamat beristirahat.'
              : isOnTime
              ? 'Kehadiran tepat waktu Anda menjadi inspirasi dan keteladanan hidup bagi seluruh murid.'
              : 'Terima kasih atas dedikasi dan komitmen Anda bertugas di sekolah hari ini.'}
          </p>
        </div>

        {/* 6. Tombol Lanjutkan */}
        <div className="mt-6 flex flex-col items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-amber-400 hover:bg-amber-300 active:scale-[0.99] text-slate-950 font-bold text-sm tracking-wide transition-colors cursor-pointer flex items-center justify-center gap-2 min-h-12"
          >
            <span>Lanjutkan ke Beranda</span>
            <ArrowRight className="w-4 h-4" />
          </button>

          {/* Auto-dismiss text */}
          <p className="text-[11px] text-slate-400 font-medium">
            Ketuk di mana saja untuk menutup (otomatis dalam {secondsLeft} detik)
          </p>
        </div>
      </div>
    </div>
  );
};
