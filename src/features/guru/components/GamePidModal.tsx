import React, { useEffect } from 'react';
import {
  Gamepad2,
  Sparkles,
  ArrowLeft,
  X,
  CheckCircle2,
  Info,
  Clock,
  ExternalLink,
  Box,
  Play,
  Key,
  Compass,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import {
  getGamePidPlatformUrl,
  getSchoolSlice3dUrl,
  getRumahSunyiUrl,
  getG7kaihUrl,
} from '../../../config/game-pid.config';

export interface GamePidModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile | null;
  totalPoints?: number;
}

interface GamePlanItem {
  id: string;
  title: string;
  category: 'QUIZ' | 'CHALLENGE' | 'LEAGUE';
  badgeCategory: string;
  description: string;
  status: 'COMING_SOON' | 'IN_DESIGN' | 'PLANNED' | 'AVAILABLE';
  statusLabel: string;
  rewardPoints: number;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  actionUrl?: string;
  is3d?: boolean;
  thumbnailUrl?: string;
}

export const GamePidModal: React.FC<GamePidModalProps> = ({
  isOpen,
  onClose,
  user,
  totalPoints = 0,
}) => {
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
      id: 'pid_school_slice_3d',
      title: 'School Slice 3D: Kehidupan Sekolah',
      category: 'QUIZ',
      badgeCategory: 'Gim 3D Cel-Shaded PID',
      description:
        'Jelajahi kelas dan lingkungan 3D cel-shaded SMP Terpadu Al-Ittihadiyah, interaksi tap-to-move dengan karakter siswa dan guru, nikmati mode split-screen 2 pemain, dan selesaikan tantangan bank soal terintegrasi.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 35,
      icon: Box,
      accentColor: 'from-[#8C5A3C] via-[#C85A32] to-[#2F5D50]',
      actionUrl: getSchoolSlice3dUrl(),
      thumbnailUrl: '/games/school-slice-3d/thumbnail.jpg',
      is3d: true,
    },
    {
      id: 'pid_rumah_sunyi',
      title: 'Rumah Sunyi: Tiga Kunci',
      category: 'QUIZ',
      badgeCategory: 'Gim Horor Edukasi 3D POV',
      description:
        'Investigasi POV 3D mansion 9 ruangan: temukan 3 kunci kuningan di antara 12 laci, selesaikan uji materi kuis guru, bersembunyi di lemari dari Sosok Bayangan Pucat, dan buka pintu keluar.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 40,
      icon: Key,
      accentColor: 'from-[#171310] via-[#c99a45] to-[#b52b21]',
      actionUrl: getRumahSunyiUrl(),
      thumbnailUrl: '/games/rumah-sunyi/thumbnail.jpg',
      is3d: true,
    },
    {
      id: 'pid_g7kaih',
      title: 'G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah',
      category: 'CHALLENGE',
      badgeCategory: 'Gim 3D Simulasi Karakter PID',
      description:
        'Simulasi POV 3D 7 Kebiasaan Anak Indonesia Hebat: bangun Subuh di rumah 4 kamar, sholat berjamaah di Masjid Al-Ikhlas, perjalanan desa, dan tiba tepat waktu di SMP Terpadu Al-Ittihadiyah.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 45,
      icon: Compass,
      accentColor: 'from-[#2A2119] via-[#8C7056] to-[#3B5946]',
      actionUrl: getG7kaihUrl(),
      thumbnailUrl: '/games/g7kaih-al-ittihadiyah/thumbnail.jpg',
      is3d: true,
    },
  ];

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

              {/* Direct Launch Link Button */}
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined') {
                    window.open(getGamePidPlatformUrl(), '_blank', 'noopener,noreferrer');
                  }
                }}
                className="w-full py-2.5 px-3 rounded-xl font-black text-xs bg-linear-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 hover:brightness-105 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
              >
                <ExternalLink className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Buka Platform Game PID Langsung 🚀</span>
              </button>
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

          {/* Game Pilihan Utama: School Slice 3D */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Gim Terintegrasi Resmi ({gamePlans.length})
              </h3>
              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                Siap Dimainkan
              </span>
            </div>

            {gamePlans.map((item) => {
              const IconComp = item.icon;
              return (
                <div
                  key={item.id}
                  className="bg-white rounded-2xl border-2 border-amber-300 ring-4 ring-amber-400/10 shadow-md overflow-hidden transition-all group"
                >
                  {/* THUMBNAIL BANNER */}
                  <div className="relative w-full aspect-video bg-slate-950 overflow-hidden">
                    <img
                      src={item.thumbnailUrl || '/games/school-slice-3d/thumbnail.jpg'}
                      alt={item.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      onError={(e) => {
                        const target = e.currentTarget;
                        if (!target.src.endsWith('/games/school-slice-3d-thumbnail.jpg')) {
                          target.src = '/games/school-slice-3d-thumbnail.jpg';
                        }
                      }}
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/25 to-black/10" />

                    {/* Badges on thumbnail */}
                    <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-2 pointer-events-none">
                      <span className="text-[9.5px] font-black px-2 py-0.5 rounded-lg bg-black/60 backdrop-blur-md text-amber-300 border border-amber-300/40 flex items-center gap-1">
                        <IconComp className="w-3 h-3" />
                        <span>{item.badgeCategory}</span>
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-lg bg-emerald-500/90 text-white backdrop-blur-md flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
                        <span>{item.statusLabel}</span>
                      </span>
                    </div>

                    <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between gap-2 pointer-events-none">
                      <div className="text-white drop-shadow-md">
                        <h4 className="text-xs sm:text-sm font-black leading-tight drop-shadow-sm">
                          {item.title}
                        </h4>
                        <p className="text-[10px] text-amber-200 font-medium drop-shadow-sm mt-0.5">
                          Mode Split-Screen 2 Pemain • Kejar-kejaran KBM
                        </p>
                      </div>
                      <div className="px-2 py-0.5 rounded-lg bg-amber-400 text-slate-950 text-xs font-black shadow-md shrink-0">
                        ⭐ +{item.rewardPoints} PTS
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-4 space-y-3">
                    <p className="text-[11.5px] text-slate-600 leading-relaxed">
                      {item.description}
                    </p>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined') {
                          window.open(item.actionUrl || getSchoolSlice3dUrl(), '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs inline-flex items-center justify-center gap-2 cursor-pointer active:scale-95 transition-all shadow-md"
                    >
                      <Play className="w-3.5 h-3.5 fill-slate-950 stroke-none" />
                      <span>Mainkan {item.title} Sekarang ↗</span>
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
