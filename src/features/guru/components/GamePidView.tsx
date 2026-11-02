import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Trophy,
  Sparkles,
  Target,
  Zap,
  Flame,
  ArrowLeft,
  CheckCircle2,
  Info,
  Clock,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Save,
  RotateCcw,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import {
  getGamePidPlatformUrl,
  setGamePidPlatformUrl,
  DEFAULT_GAME_PID_URL,
} from '../../../config/game-pid.config';

export interface GamePidViewProps {
  onBack: () => void;
  backLabel?: string;
  user?: UserProfile | null;
  totalPoints?: number;
}

type GameModeTab = 'ALL' | 'QUIZ' | 'CHALLENGE' | 'LEAGUE';

interface GamePlanItem {
  id: string;
  title: string;
  category: 'QUIZ' | 'CHALLENGE' | 'LEAGUE';
  badgeCategory: string;
  description: string;
  status: 'COMING_SOON' | 'IN_DESIGN' | 'PLANNED';
  statusLabel: string;
  rewardPoints: number;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}

export const GamePidView: React.FC<GamePidViewProps> = ({
  onBack,
  backLabel = 'Kembali ke Beranda',
  user,
  totalPoints = 0,
}) => {
  const [activeCategory, setActiveCategory] = useState<GameModeTab>('ALL');
  const [platformUrl, setPlatformUrl] = useState<string>(() => getGamePidPlatformUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editUrlInput, setEditUrlInput] = useState<string>(platformUrl);
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    const handleUrlUpdated = () => {
      const current = getGamePidPlatformUrl();
      setPlatformUrl(current);
      setEditUrlInput(current);
    };
    window.addEventListener('smart_absensi_game_pid_url_updated', handleUrlUpdated);
    return () => {
      window.removeEventListener('smart_absensi_game_pid_url_updated', handleUrlUpdated);
    };
  }, []);

  const handleCopyLink = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(platformUrl);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    }
  };

  const handleSaveCustomUrl = () => {
    const trimmed = editUrlInput.trim();
    if (!trimmed) {
      setGamePidPlatformUrl(DEFAULT_GAME_PID_URL);
      setPlatformUrl(DEFAULT_GAME_PID_URL);
      setEditUrlInput(DEFAULT_GAME_PID_URL);
    } else {
      let finalUrl = trimmed;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      setGamePidPlatformUrl(finalUrl);
      setPlatformUrl(finalUrl);
      setEditUrlInput(finalUrl);
    }
    setIsEditingUrl(false);
  };

  const handleResetDefaultUrl = () => {
    setGamePidPlatformUrl(DEFAULT_GAME_PID_URL);
    setPlatformUrl(DEFAULT_GAME_PID_URL);
    setEditUrlInput(DEFAULT_GAME_PID_URL);
    setIsEditingUrl(false);
  };

  const handleLaunchPlatform = () => {
    if (typeof window !== 'undefined') {
      window.open(platformUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const gamePlans: GamePlanItem[] = [
    {
      id: 'pid_quiz_quick',
      title: 'Kuis Kilat Edukasi PID',
      category: 'QUIZ',
      badgeCategory: 'Kuis Interaktif',
      description:
        'Tantangan kuis cepat 10 soal seputar wawasan Kurikulum Merdeka, sains terpadu, dan nilai keteladanan Islam.',
      status: 'COMING_SOON',
      statusLabel: 'Segera Hadir',
      rewardPoints: 15,
      icon: Zap,
      accentColor: 'from-amber-500 to-orange-600',
    },
    {
      id: 'pid_discipline_quest',
      title: 'Misi Keteladanan Fajar',
      category: 'CHALLENGE',
      badgeCategory: 'Misi Karakter',
      description:
        'Misi harian menjaga ritme presensi on-time sebelum 07:00 WIB dan keteladanan keaktifan kegiatan sekolah.',
      status: 'IN_DESIGN',
      statusLabel: 'Tahap Desain',
      rewardPoints: 25,
      icon: Flame,
      accentColor: 'from-rose-500 to-pink-600',
    },
    {
      id: 'pid_classroom_league',
      title: 'Liga Rombel Cerdas Cermat',
      category: 'LEAGUE',
      badgeCategory: 'Turnamen Kelas',
      description:
        'Kolaborasi antar-siswa dan wali kelas dalam kompetisi poin kebaikan dan kebersihan rombel per semester.',
      status: 'PLANNED',
      statusLabel: 'Rencana Rilis',
      rewardPoints: 50,
      icon: Trophy,
      accentColor: 'from-violet-600 to-indigo-700',
    },
    {
      id: 'pid_memory_match',
      title: 'Teka-Teki Glosarium Guru',
      category: 'QUIZ',
      badgeCategory: 'Ketangkasan Kognitif',
      description:
        'Asah ingatan istilah pedagogik dan instrumen asesmen KBM dalam simulasi kartu bergambar interaktif.',
      status: 'IN_DESIGN',
      statusLabel: 'Tahap Desain',
      rewardPoints: 10,
      icon: Target,
      accentColor: 'from-cyan-600 to-blue-700',
    },
  ];

  const filteredPlans =
    activeCategory === 'ALL'
      ? gamePlans
      : gamePlans.filter((p) => p.category === activeCategory);

  return (
    <div className="w-full space-y-4 animate-in fade-in duration-200">
      {/* 1. TOP NAVIGATION BAR (BUKAN POPUP, FULL PAGE VIEW) */}
      <div className="bg-white rounded-3xl p-3 sm:p-4 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-[#023246] transition-all cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{backLabel}</span>
        </button>

        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-600 animate-pulse" />
          <span className="text-[11px] font-black text-violet-950 uppercase tracking-wider">
            Platform Game PID
          </span>
        </div>
      </div>

      {/* 2. HERO ARENA & DIRECT PLATFORM LAUNCHER */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-violet-900 via-indigo-950 to-[#023246] p-4.5 sm:p-6 text-white shadow-md border border-violet-800/40 space-y-4">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-violet-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-44 h-44 rounded-full bg-indigo-500/25 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] sm:text-xs font-extrabold uppercase tracking-wider backdrop-blur-xs">
              <Gamepad2 className="w-4 h-4 text-amber-300" />
              <span>Pekan Inovasi Digital (PID)</span>
            </div>
            <span className="text-[10px] font-bold text-violet-200 bg-violet-800/70 px-2.5 py-0.5 rounded-full border border-violet-600/50">
              SMP Terpadu Al-Ittihadiyah
            </span>
          </div>

          <div>
            <h1 className="text-lg sm:text-2xl font-black text-white leading-tight">
              Platform Gamifikasi &amp; Edukasi Interaktif
            </h1>
            <p className="text-xs sm:text-sm text-indigo-100/90 mt-1.5 leading-relaxed max-w-2xl">
              Pusat arena kuis interaktif, tantangan ketangkasan, dan misi keteladanan karakter sekolah. Terbuka bagi seluruh dewan guru dan murid untuk memperkuat digitalisasi pembelajaran yang menyenangkan.
            </p>
          </div>

          {/* 🔗 DIRECT LINK PLATFORM GAME PID CARD */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-violet-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Tautan Langsung Platform Game PID:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-[10.5px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer border border-white/15"
                  title="Salin tautan ke clipboard"
                >
                  {isCopied ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-400" />
                      <span className="text-emerald-300">Tersalin</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 text-slate-300" />
                      <span>Salin Link</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setIsEditingUrl(!isEditingUrl)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-[10.5px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer border border-white/15"
                  title="Sesuaikan URL platform"
                >
                  <Edit2 className="w-3 h-3 text-amber-300" />
                  <span>Ubah URL</span>
                </button>
              </div>
            </div>

            {/* Input URL Editor jika mode edit aktif */}
            {isEditingUrl ? (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={editUrlInput}
                    onChange={(e) => setEditUrlInput(e.target.value)}
                    placeholder="https://..."
                    className="flex-1 bg-white/95 text-slate-900 px-3 py-1.5 rounded-xl text-xs font-mono border border-white/40 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomUrl}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefaultUrl}
                    className="p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl transition-all cursor-pointer"
                    title="Reset ke default resmi"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-indigo-200">
                  Masukkan tautan web platform game sekolah (misal web app mandiri, Quizizz, Wordwall, atau domain PID sekolah).
                </p>
              </div>
            ) : (
              <div className="bg-black/30 rounded-xl px-3 py-2 border border-white/10 flex items-center justify-between gap-2 min-w-0">
                <span className="font-mono text-xs text-amber-300 truncate select-all">
                  {platformUrl}
                </span>
                <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-500/30 shrink-0">
                  Online
                </span>
              </div>
            )}

            {/* TOMBOL UTAMA: BUKA PLATFORM GAME PID LANGSUNG */}
            <button
              type="button"
              onClick={handleLaunchPlatform}
              className="w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-linear-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 hover:brightness-105 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 stroke-[2.5]" />
              <span>Buka Platform Game PID Sekarang 🚀</span>
            </button>
          </div>

          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-amber-300" />
              <span>Akses Penuh: Terbuka untuk seluruh guru &amp; siswa</span>
            </span>
            <span className="font-bold text-amber-300">
              SAGA Terpadu Hub
            </span>
          </div>
        </div>
      </div>

      {/* 3. PROFIL PEMAIN & INTEGRASI POIN SAGA */}
      <div className="bg-white rounded-3xl p-4 sm:p-4.5 border border-slate-200/90 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-linear-to-br from-[#023246] to-[#18536B] text-white flex items-center justify-center font-black text-sm shrink-0 border border-slate-200 shadow-2xs">
            {user?.full_name ? user.full_name.charAt(0) : 'G'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs sm:text-sm font-black text-slate-900 truncate">
                {user?.full_name || 'Bapak/Ibu Pendidik'}
              </p>
              <span className="px-1.5 py-0.2 bg-violet-100 text-violet-800 text-[8.5px] font-black rounded-md border border-violet-200 shrink-0">
                Pemain Aktif
              </span>
            </div>
            <p className="text-[10.5px] text-slate-500 font-medium truncate mt-0.5">
              {user?.nip ? `NPP: ${user.nip}` : 'Pendidik SMPT Al-Ittihadiyah'}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <div className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-2xs">
            ⭐ {totalPoints} PTS
          </div>
          <span className="text-[9.5px] font-semibold text-slate-500 block mt-0.5">
            Akumulasi Disiplin SAGA
          </span>
        </div>
      </div>

      {/* 4. FILTER TAB KATEGORI PERMAINAN */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <button
          type="button"
          onClick={() => setActiveCategory('ALL')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeCategory === 'ALL'
              ? 'bg-[#023246] text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Semua Mode ({gamePlans.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('QUIZ')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeCategory === 'QUIZ'
              ? 'bg-violet-700 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Kuis Interaktif
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('CHALLENGE')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeCategory === 'CHALLENGE'
              ? 'bg-rose-700 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Misi Karakter
        </button>
        <button
          type="button"
          onClick={() => setActiveCategory('LEAGUE')}
          className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
            activeCategory === 'LEAGUE'
              ? 'bg-indigo-700 text-white shadow-2xs'
              : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
          }`}
        >
          Liga Rombel
        </button>
      </div>

      {/* 5. DAFTAR RENCANA MODE GAME */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
            Daftar Arena &amp; Mode Game PID ({filteredPlans.length})
          </h2>
          <span className="text-[10px] font-semibold text-slate-400">
            Terhubung ke Platform PID
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {filteredPlans.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3 group"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl bg-linear-to-br ${item.accentColor} text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform`}
                  >
                    <IconComp className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-1.5 mb-1">
                      <span className="text-[10px] font-black text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200 truncate">
                        {item.badgeCategory}
                      </span>
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          item.status === 'COMING_SOON'
                            ? 'bg-amber-100 text-amber-900 border border-amber-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                    </div>
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                      {item.title}
                    </h3>
                    <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                      {item.description}
                    </p>
                  </div>
                </div>

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-[10.5px] font-bold text-emerald-700 flex items-center gap-1">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                    <span>Reward: +{item.rewardPoints} PTS</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleLaunchPlatform}
                    className="px-2.5 py-1 rounded-xl bg-violet-50 hover:bg-violet-100 text-violet-800 text-[10px] font-extrabold inline-flex items-center gap-1 border border-violet-200 cursor-pointer active:scale-95 transition-all"
                  >
                    <span>Mainkan</span>
                    <ExternalLink className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 6. STATUS KESIAPAN ARSITEKTUR & PANDUAN */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-indigo-100 space-y-3 shadow-xs">
        <div className="flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-700 shrink-0" />
          <h3 className="text-xs sm:text-sm font-black text-indigo-950">
            Kesiapan Platform &amp; Integrasi Digital
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[10.5px]">
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-semibold truncate">Tautan Platform Siap</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-semibold truncate">Non-Popup Page View</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-semibold truncate">Sinkron Poin SAGA</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-semibold truncate">Responsif Layar HP</span>
          </div>
        </div>
      </div>

      {/* 7. BOTTOM RETURN BUTTON */}
      <button
        type="button"
        onClick={onBack}
        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 border border-slate-200/90 shadow-xs text-xs font-bold text-[#023246] flex items-center justify-center gap-2 transition-all cursor-pointer min-h-12"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{backLabel}</span>
      </button>
    </div>
  );
};
