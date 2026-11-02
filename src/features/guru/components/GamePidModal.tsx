import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Trophy,
  Sparkles,
  Target,
  Zap,
  Flame,
  ArrowLeft,
  X,
  Lock,
  CheckCircle2,
  Info,
  Clock,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';

export interface GamePidModalProps {
  isOpen: boolean;
  onClose: () => void;
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

export const GamePidModal: React.FC<GamePidModalProps> = ({
  isOpen,
  onClose,
  user,
  totalPoints = 0,
}) => {
  const [activeCategory, setActiveCategory] = useState<GameModeTab>('ALL');

  // Prevent background scroll on mobile Infinix Note 8
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

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
    // BACKDROP: Full-screen di mobile, blur backdrop di Desktop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 md:p-4 md:backdrop-blur-sm animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="game-pid-modal-title"
    >
      {/* MAIN CONTAINER: 100dvh di mobile (Infinix Note 8 20.5:9), rounded-2xl di desktop */}
      <div className="w-full h-dvh md:h-auto md:max-h-[92vh] md:max-w-2xl bg-white md:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* 1. STICKY HEADER */}
        <header className="h-14 sm:h-16 px-4 bg-white/95 backdrop-blur-md border-b border-slate-200 flex items-center justify-between shrink-0 sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={onClose}
              aria-label="Kembali"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="w-9 h-9 rounded-xl bg-linear-to-br from-violet-600 to-indigo-800 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h1
                  id="game-pid-modal-title"
                  className="text-sm sm:text-base font-black text-slate-900 truncate leading-tight tracking-tight"
                >
                  Game PID
                </h1>
                <span className="px-1.5 py-0.2 rounded-md bg-violet-100 text-violet-800 text-[9px] font-black tracking-wider uppercase shrink-0 border border-violet-200">
                  Staging
                </span>
              </div>
              <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate mt-0.5">
                Pekan Inovasi Digital • SMP Terpadu Al-Ittihadiyah
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 hidden md:flex items-center justify-center transition-all cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* 2. SCROLLABLE WORKSPACE */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {/* Banner Hero Arena */}
          <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-violet-900 via-indigo-950 to-[#023246] p-4 sm:p-5 text-white shadow-md border border-violet-800/40">
            <div className="absolute -top-10 -right-10 w-36 h-36 rounded-full bg-violet-500/20 blur-2xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full bg-indigo-500/20 blur-2xl pointer-events-none" />

            <div className="relative z-10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] font-extrabold uppercase tracking-wider backdrop-blur-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Ruang Gamifikasi Edukasi</span>
                </div>
                <span className="text-[10px] font-bold text-violet-200 bg-violet-800/60 px-2 py-0.5 rounded-md border border-violet-700/50">
                  Fase Persiapan
                </span>
              </div>

              <div>
                <h2 className="text-base sm:text-lg font-black text-white leading-tight">
                  Selamat Datang di Wadah Game PID
                </h2>
                <p className="text-xs text-indigo-100/90 mt-1 leading-relaxed">
                  Wahana permainan edukatif dan kuis interaktif sekolah berbasis karakter, ketangkasan kognitif, dan apresiasi kedisiplinan guru &amp; siswa SMP Terpadu Al-Ittihadiyah.
                </p>
              </div>

              <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[11px] text-indigo-200">
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-amber-300" />
                  <span>Status: Area penampung game siap</span>
                </span>
                <span className="font-bold text-amber-300">
                  Engine: Next Update
                </span>
              </div>
            </div>
          </div>

          {/* Profil Pemain & Akumulasi Poin SAGA */}
          <div className="bg-slate-50 rounded-2xl p-3.5 sm:p-4 border border-slate-200 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center font-black text-sm shrink-0 border border-slate-300 shadow-2xs">
                {user?.full_name ? user.full_name.charAt(0) : 'G'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-black text-slate-900 truncate">
                  {user?.full_name || 'Bapak/Ibu Pendidik'}
                </p>
                <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                  {user?.nip ? `NPP: ${user.nip}` : 'Pendidik SMPT Al-Ittihadiyah'}
                </p>
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs font-black shadow-2xs">
                ⭐ {totalPoints} PTS
              </div>
              <span className="text-[9px] font-semibold text-slate-500 block mt-0.5">
                Poin Disiplin SAGA
              </span>
            </div>
          </div>

          {/* Filter Kategori Tab */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => setActiveCategory('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategory === 'ALL'
                  ? 'bg-[#023246] text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Semua Mode ({gamePlans.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('QUIZ')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategory === 'QUIZ'
                  ? 'bg-violet-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Kuis Interaktif
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('CHALLENGE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategory === 'CHALLENGE'
                  ? 'bg-rose-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Misi Karakter
            </button>
            <button
              type="button"
              onClick={() => setActiveCategory('LEAGUE')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                activeCategory === 'LEAGUE'
                  ? 'bg-indigo-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Liga Kelas
            </button>
          </div>

          {/* Daftar Rencana Mode Permainan */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
              Rencana Mode Game ({filteredPlans.length})
            </h3>

            {filteredPlans.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl p-3.5 sm:p-4 border border-slate-200 shadow-2xs hover:border-slate-300 transition-all flex flex-col justify-between gap-3 group"
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl bg-linear-to-br ${item.accentColor} text-white flex items-center justify-center shrink-0 shadow-2xs`}
                    >
                      <IconComp className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[10px] font-extrabold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-md border border-violet-200">
                          {item.badgeCategory}
                        </span>
                        <span
                          className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${
                            item.status === 'COMING_SOON'
                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                              : 'bg-slate-100 text-slate-600 border border-slate-200'
                          }`}
                        >
                          {item.statusLabel}
                        </span>
                      </div>
                      <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-snug">
                        {item.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        {item.description}
                      </p>
                    </div>
                  </div>

                  <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs">
                    <span className="text-[10.5px] font-bold text-emerald-700 flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      <span>Estimasi Reward: +{item.rewardPoints} PTS</span>
                    </span>
                    <button
                      type="button"
                      disabled
                      className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-400 text-[10px] font-bold inline-flex items-center gap-1 cursor-not-allowed select-none"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Belum Dibuka</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Status Kesiapan Arsitektur SAGA */}
          <div className="bg-indigo-50/70 rounded-2xl p-3.5 sm:p-4 border border-indigo-100 space-y-2.5">
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4 text-indigo-700 shrink-0" />
              <h4 className="text-xs font-black text-indigo-950">
                Status Kesiapan Fondasi Game PID
              </h4>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[10.5px]">
              <div className="bg-white/80 rounded-xl p-2 border border-indigo-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-700 font-medium truncate">Wadah Modul Siap</span>
              </div>
              <div className="bg-white/80 rounded-xl p-2 border border-indigo-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-700 font-medium truncate">Integrasi Akun Pendidik</span>
              </div>
              <div className="bg-white/80 rounded-xl p-2 border border-indigo-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span className="text-slate-700 font-medium truncate">Layout Infinix Note 8</span>
              </div>
              <div className="bg-white/80 rounded-xl p-2 border border-indigo-100 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span className="text-slate-700 font-medium truncate">Mekanik Permainan (Next)</span>
              </div>
            </div>
          </div>
        </div>

        {/* 3. STICKY ACTION BAR */}
        <footer className="p-3.5 sm:p-4 bg-white/95 backdrop-blur-md border-t border-slate-200 shrink-0 sticky bottom-0 z-20 pb-[max(14px,env(safe-area-inset-bottom))]">
          <button
            type="button"
            onClick={onClose}
            className="h-11 sm:h-12 w-full rounded-xl font-bold bg-[#023246] hover:bg-[#03445e] active:scale-[0.99] text-white flex items-center justify-center gap-2 cursor-pointer transition-all shadow-xs text-xs sm:text-sm"
          >
            <span>Kembali ke Beranda</span>
          </button>
        </footer>
      </div>
    </div>
  );
};
