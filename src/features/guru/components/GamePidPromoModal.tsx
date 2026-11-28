import React, { useState } from 'react';
import {
  X,
  Play,
  ExternalLink,
  Copy,
  Check,
  Box,
  Key,
  Compass,
  Share2,
} from 'lucide-react';
import {
  SagaGamePidIcon,
  SagaSparkAiIcon,
} from '../../../components/ui/SagaServiceIcons';
import {
  getDirectGamePidShareUrl,
  getGamePidPlatformUrl,
  markPidPromoShown,
} from '../../../config/game-pid.config';

export interface GamePidPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenPortal: () => void;
  todayDateStr: string;
}

export const GamePidPromoModal: React.FC<GamePidPromoModalProps> = ({
  isOpen,
  onClose,
  onOpenPortal,
  todayDateStr,
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const [dontShowToday, setDontShowToday] = useState(true);

  if (!isOpen) return null;

  const handleClose = () => {
    markPidPromoShown(dontShowToday, todayDateStr);
    onClose();
  };

  const handleOpenPortal = () => {
    markPidPromoShown(dontShowToday, todayDateStr);
    onOpenPortal();
  };

  const handleCopyLink = () => {
    const shareUrl = getDirectGamePidShareUrl();
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2200);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-0 md:p-4 md:backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-pid-promo-title"
    >
      {/* 
        Container Responsif:
        Mobile Infinix Note 8 (20.5:9): Fullscreen 100dvh tanpa margin luar
        Desktop: Centered Modal Elegan rounded-3xl
      */}
      <div className="w-full h-dvh md:h-auto md:max-h-[92vh] md:max-w-xl bg-white md:rounded-3xl shadow-2xl flex flex-col overflow-hidden">
        {/* 1. STICKY HEADER */}
        <header className="min-h-14 sm:min-h-16 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-20 pt-[max(12px,env(safe-area-inset-top))] pb-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0D5C46] text-white flex items-center justify-center shrink-0">
              <SagaGamePidIcon tone="dark" className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1
                  id="game-pid-promo-title"
                  className="text-sm sm:text-base font-bold text-slate-900 truncate leading-tight tracking-tight"
                >
                  Pekan Inovasi Digital
                </h1>
                <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold tracking-wide uppercase shrink-0 border border-amber-200">
                  Resmi Dibuka
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                Wahana Game Edukatif 3D • SMP Terpadu Al-Ittihadiyah
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Tutup Promosi"
            className="w-11 h-11 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 2. SCROLLABLE WORKSPACE */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* POSTER HERO PROMO BANNER */}
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 shadow-sm bg-slate-950 aspect-video group">
            <img
              src="/games/game-pid-promo-poster.jpg"
              alt="Poster Resmi Pekan Inovasi Digital 3D"
              className="w-full h-full object-cover group-hover:scale-[1.01] transition-transform duration-500"
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.endsWith('/games/g7kaih-thumbnail.jpg')) {
                  target.src = '/games/g7kaih-thumbnail.jpg';
                }
              }}
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/30 to-black/15 pointer-events-none" />

            <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900/90 border border-amber-300/40 text-amber-300 text-[10px] font-bold uppercase tracking-wider">
                <SagaSparkAiIcon tone="dark" className="w-3.5 h-3.5" />
                <span>3 Gim 3D Siap Dimainkan</span>
              </span>
              <span className="text-[10px] font-bold text-white bg-[#0D5C46] px-2.5 py-0.5 rounded-md border border-white/20">
                Papan Interaktif Digital (PID)
              </span>
            </div>

            <div className="absolute bottom-3 left-3 right-3 text-white pointer-events-none">
              <h2 className="text-base sm:text-lg font-black leading-tight drop-shadow-md">
                Jelajahi Dunia Gamifikasi Edukasi Sekolah
              </h2>
              <p className="text-[11px] sm:text-xs text-amber-200/90 font-medium mt-0.5 drop-shadow-xs line-clamp-1">
                Eksplorasi 3 wahana permainan karakter, materi pelajaran, dan petualangan 3D.
              </p>
            </div>
          </div>

          {/* SAMBUTAN & DESKRIPSI SINGKAT */}
          <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 space-y-2">
            <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
              Bapak/Ibu Pendidik yang Kami Hormati,
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Telah hadir wahana gamifikasi digital sekolah yang terhubung langsung dengan sistem akun guru, bank soal kuis, serta layar sentuh <strong>Papan Interaktif Digital (PID)</strong> di ruang kelas SMP Terpadu Al-Ittihadiyah.
            </p>
          </div>

          {/* 3 HIGHLIGHT GIM UNGGULAN */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Daftar Wahana Gim 3D Aktif
              </span>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                3 Game Tersedia
              </span>
            </div>

            {/* Game 1: School Slice 3D */}
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#8C5A3C] text-white flex items-center justify-center shrink-0 shadow-2xs">
                  <Box className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900 truncate">
                    1. School Slice 3D: Kehidupan Sekolah
                  </h4>
                  <p className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5">
                    Eksplorasi kelas 3D cel-shaded, interaksi siswa &amp; bank soal kuis.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                +35 PTS
              </span>
            </div>

            {/* Game 2: Rumah Sunyi */}
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#171310] text-amber-400 flex items-center justify-center shrink-0 shadow-2xs">
                  <Key className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900 truncate">
                    2. Rumah Sunyi: Tiga Kunci
                  </h4>
                  <p className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5">
                    Investigasi horor edukasi POV 3D 9 ruangan &amp; uji materi pelajaran.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                +40 PTS
              </span>
            </div>

            {/* Game 3: G7KAIH */}
            <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-2xs flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[#2A2119] text-[#9FD18B] flex items-center justify-center shrink-0 shadow-2xs">
                  <Compass className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs font-black text-slate-900 truncate">
                    3. G7KAIH: Perjalanan ke Sekolah
                  </h4>
                  <p className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5">
                    Simulasi 3D 7 Kebiasaan Anak Indonesia Hebat dari rumah ke sekolah.
                  </p>
                </div>
              </div>
              <span className="text-[10px] font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200 shrink-0">
                +45 PTS
              </span>
            </div>
          </div>

          {/* KOTAK LINK KHUSUS UNTUK DIBAGIKAN KE GURU / SISWA */}
          <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900">
                <Share2 className="w-3.5 h-3.5 text-[#0D5C46]" />
                <span>Link Khusus Akses Portal Game PID</span>
              </div>
              <span className="text-[10px] font-bold text-[#0D5C46] bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                Tautan Instan
              </span>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Tautan ini dapat disimpan di bookmark, dibagikan ke grup guru, atau dibuka langsung pada browser PID kelas:
            </p>

            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={getDirectGamePidShareUrl()}
                className="flex-1 bg-white border border-slate-200 text-slate-700 font-mono text-base sm:text-xs px-3 py-2.5 rounded-xl focus:outline-hidden min-h-11"
              />
              <button
                type="button"
                onClick={handleCopyLink}
                className="px-4 py-2.5 rounded-xl bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.98] text-white font-bold text-xs inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 min-h-11"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-300" />
                    <span>Disalin!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Salin</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* OPSI CHECKBOX JANGAN TAMPILKAN LAGI HARI INI */}
          <label className="flex items-center gap-2.5 px-1 py-1.5 cursor-pointer select-none min-h-11">
            <input
              type="checkbox"
              checked={dontShowToday}
              onChange={(e) => setDontShowToday(e.target.checked)}
              className="w-5 h-5 rounded-md text-[#0D5C46] border-slate-300 focus:ring-[#0D5C46] cursor-pointer"
            />
            <span className="text-sm text-slate-700 font-medium">
              Jangan tampilkan lagi pop-up promosi ini hari ini
            </span>
          </label>
        </div>

        {/* 3. STICKY BOTTOM ACTION BAR (ERGONOMI JEMPOL) */}
        <footer className="p-4 bg-white border-t border-slate-200 flex flex-col sm:flex-row items-center gap-2.5 shrink-0 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={handleOpenPortal}
            className="w-full sm:flex-1 py-3 px-4 rounded-xl font-bold text-sm bg-[#0D5C46] hover:bg-[#094736] text-white active:scale-[0.99] transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer min-h-12"
          >
            <Play className="w-4 h-4 fill-white stroke-none" />
            <span>Buka Portal Game PID Sekarang</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open(getGamePidPlatformUrl(), '_blank', 'noopener,noreferrer');
              }
            }}
            className="w-full sm:w-auto py-3 px-4 rounded-xl font-bold text-sm bg-slate-100 hover:bg-slate-200 text-slate-800 active:scale-[0.99] transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-12"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Buka di Tab Baru</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
