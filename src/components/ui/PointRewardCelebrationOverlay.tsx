import React, { useEffect, useState, useMemo } from 'react';
import { Sparkles, Trophy, ShieldCheck, Clock, Award, ArrowRight } from 'lucide-react';
import { SoundService } from '../../services/audio.service';
import { SpeechService } from '../../services/speech.service';

export interface PointRewardData {
  points: number;
  status: 'HADIR' | 'TERLAMBAT' | string;
  reason: string;
  breakdown?: {
    attendance: number;
    piket?: number;
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
  delay: number;
  duration: number;
  symbol: string;
}

export const PointRewardCelebrationOverlay: React.FC<PointRewardCelebrationOverlayProps> = ({
  isOpen,
  onClose,
  data,
}) => {
  const [secondsLeft, setSecondsLeft] = useState(5);

  // Generate festive floating confetti particles
  const particles: Particle[] = useMemo(() => {
    const symbols = ['⭐', '✨', '✦', '🎖️', '💫', '⚡'];
    const colors = [
      'text-amber-300',
      'text-yellow-400',
      'text-emerald-300',
      'text-cyan-300',
      'text-amber-200',
    ];

    return Array.from({ length: 22 }).map((_, idx) => ({
      id: idx,
      left: Math.floor(Math.random() * 92) + 4,
      top: Math.floor(Math.random() * 85) + 5,
      size: Math.floor(Math.random() * 12) + 14,
      color: colors[idx % colors.length],
      delay: (idx * 0.18) % 2.5,
      duration: 2.5 + (idx % 3) * 0.8,
      symbol: symbols[idx % symbols.length],
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
  const hasDutyBonus = (data.breakdown?.piket ?? 0) > 0;

  return (
    <div
      className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in select-none cursor-pointer"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Apresiasi Poin Kedisiplinan"
    >
      {/* 🌟 Floating Background Glowing Sunburst Halo */}
      <div className="absolute w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-linear-to-tr from-amber-500/25 via-yellow-400/20 to-transparent blur-3xl pointer-events-none animate-pulse-glow" />
      <div className="absolute w-64 h-64 sm:w-72 sm:h-72 rounded-full bg-linear-to-bl from-emerald-500/15 via-amber-400/10 to-transparent blur-2xl pointer-events-none" />

      {/* 🌟 Sparkling Floating Particles (Confetti Stars) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((p) => (
          <div
            key={p.id}
            className={`absolute ${p.color} transition-all drop-shadow-md`}
            style={{
              left: `${p.left}%`,
              top: `${p.top}%`,
              fontSize: `${p.size}px`,
              animation: `float-gentle ${p.duration}s ease-in-out infinite`,
              animationDelay: `${p.delay}s`,
            }}
          >
            {p.symbol}
          </div>
        ))}
      </div>

      {/* 🌟 CARDLESS FLOATING AWARD CELEBRATION (TANPA KOTAK CARD) */}
      <div
        className="relative z-10 flex flex-col items-center justify-center text-center max-w-sm sm:max-w-md w-full px-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 1. Floating Animated 3D Trophy & Rotating Halo */}
        <div className="relative animate-float-gentle flex items-center justify-center mb-2">
          {/* Subtle rotating sunbeam aura */}
          <div className="absolute w-36 h-36 sm:w-44 sm:h-44 rounded-full border border-amber-300/30 bg-radial from-amber-400/20 via-transparent to-transparent animate-spin-slow pointer-events-none" />

          {/* Floating Trophy Emblem */}
          <div className="relative w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-linear-to-br from-amber-300 via-yellow-500 to-amber-600 flex items-center justify-center shadow-[0_0_60px_rgba(251,191,36,0.65)] border-2 border-amber-100 ring-8 ring-amber-400/25">
            <Trophy className="w-12 h-12 sm:w-14 sm:h-14 text-slate-950 drop-shadow-md" />
            <span className="absolute -top-3 -right-2 text-2xl sm:text-3xl animate-bounce">
              ✨
            </span>
            <span className="absolute -bottom-2 -left-2 text-xl sm:text-2xl animate-pulse">
              🌟
            </span>
          </div>
        </div>

        {/* 2. Floating Tagline */}
        <div className="flex items-center gap-1.5 text-amber-300 text-xs sm:text-sm font-black uppercase tracking-widest drop-shadow-[0_2px_10px_rgba(251,191,36,0.7)] mt-1">
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
          <span>APRESIASI KEDISIPLINAN GURU</span>
          <Sparkles className="w-3.5 h-3.5 text-amber-300" />
        </div>

        {/* 3. Giant Glowing Points Badge */}
        <div className="flex items-baseline justify-center gap-2 mt-1 drop-shadow-[0_0_35px_rgba(251,191,36,0.9)]">
          <span className="text-6xl sm:text-7xl font-black text-transparent bg-clip-text bg-linear-to-b from-yellow-100 via-amber-300 to-amber-500 tracking-tight">
            +{data.points}
          </span>
          <span className="text-2xl sm:text-3xl font-black text-amber-300 uppercase tracking-wider">
            POIN
          </span>
        </div>

        {/* 4. Translucent Floating Pills (No Card Box) */}
        <div className="mt-3 flex flex-col items-center gap-2 max-w-xs sm:max-w-sm">
          {/* Main Reason Pill */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-amber-300/40 text-amber-100 text-xs sm:text-sm font-bold shadow-lg">
            {isOnTime ? (
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <Award className="w-4 h-4 text-amber-400 shrink-0" />
            )}
            <span>{data.reason}</span>
          </div>

          {/* Duty Bonus Pill if applicable */}
          {hasDutyBonus && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-950/60 backdrop-blur-md border border-emerald-400/40 text-emerald-200 text-xs font-bold shadow-md">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span>Termasuk Bonus Tugas Piket (+{data.breakdown?.piket} Poin)</span>
            </div>
          )}
        </div>

        {/* 5. Personal Congratulatory Message */}
        <div className="mt-4 text-center max-w-sm px-4 space-y-1">
          <h4 className="text-white font-extrabold text-base sm:text-lg drop-shadow-md">
            Selamat, {cleanName}!
          </h4>
          <p className="text-slate-200 text-xs sm:text-sm leading-relaxed drop-shadow-sm font-medium">
            {isOnTime
              ? 'Kehadiran tepat waktu Anda menjadi inspirasi dan keteladanan hidup bagi seluruh murid.'
              : 'Terima kasih atas dedikasi dan komitmen Anda bertugas mendidik di sekolah hari ini.'}
          </p>
        </div>

        {/* 6. Floating Action Button (Glowing Pill) */}
        <div className="mt-6 flex flex-col items-center gap-2.5 w-full">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-8 py-3.5 rounded-2xl bg-linear-to-r from-amber-400 via-yellow-400 to-amber-500 hover:from-amber-300 hover:to-yellow-400 active:scale-95 text-slate-950 font-black text-xs sm:text-sm tracking-wider uppercase transition-all shadow-[0_0_30px_rgba(251,191,36,0.6)] cursor-pointer flex items-center justify-center gap-2 min-h-12"
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
