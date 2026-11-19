import React, { useState, useEffect } from 'react';
import {
  Gamepad2,
  Sparkles,
  ArrowLeft,
  CheckCircle2,
  Info,
  ExternalLink,
  Copy,
  Check,
  Edit2,
  Save,
  RotateCcw,
  Box,
  Play,
  FileSpreadsheet,
  Download,
  X,
  Maximize2,
  Layers,
  BookOpen,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import {
  getGamePidPlatformUrl,
  setGamePidPlatformUrl,
  DEFAULT_GAME_PID_URL,
  getSchoolSlice3dUrl,
  setSchoolSlice3dUrl,
  DEFAULT_SCHOOL_SLICE_3D_URL,
} from '../../../config/game-pid.config';
import { useBackHandler, BACK_PRIORITIES } from '../../../hooks/useBackNavigation';

export interface GamePidViewProps {
  onBack: () => void;
  backLabel?: string;
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

const SAMPLE_CSV_CONTENT = `npcName,npcRole,storyIntro,question,optionA,optionB,optionC,optionD,correctIndex,explanation
Pak Budi (Guru TIK),Guru Informatika,Selamat pagi! Mari kita uji pemahaman dasar komputer hari ini.,Langkah-langkah sistematis dan logis untuk menyelesaikan masalah disebut...,Algoritma,Perangkat Keras,Jaringan Lokal,Basis Data,0,Algoritma adalah urutan langkah logis untuk menyelesaikan masalah.
Siti (Ketua Kelas),Teman Sebangku,Hai! Bisa bantu aku menjawab soal TIK ini sebelum bel masuk?,Manakah yang termasuk perangkat masukan (input device)?,Monitor,Printer,Papan Ketik (Keyboard),Speaker,2,Papan ketik digunakan untuk memasukkan perintah dan teks ke komputer.
Raka (Pengurus OSIS),Sekretaris Kelas,Aku sedang merapikan arsip digital sekolah. Coba tebak soal ini!,Satuan terkecil dalam penyimpanan data digital adalah...,Byte,Bit,Kilobyte,Megabyte,1,Bit merupakan satuan terkecil data biner (0 atau 1).
Bu Ratna (Pustakawan),Pembina Pojok Baca,Selamat datang di pojok baca! Jawab tantangan literasi digital ini ya.,Menjaga kerahasiaan kata sandi di internet termasuk aspek...,Keamanan Digital,Desain Grafis,Pemrograman Web,Pengolahan Angka,0,Menjaga kerahasiaan akun dan kata sandi merupakan praktik keamanan digital.`;

export const GamePidView: React.FC<GamePidViewProps> = ({
  onBack,
  backLabel = 'Kembali ke Beranda',
  user,
  totalPoints = 0,
}) => {
  // State platform umum Nawasena PID
  const [platformUrl, setPlatformUrl] = useState<string>(() => getGamePidPlatformUrl());
  const [isEditingUrl, setIsEditingUrl] = useState(false);
  const [editUrlInput, setEditUrlInput] = useState<string>(platformUrl);
  const [isCopied, setIsCopied] = useState(false);

  // State khusus School Slice 3D
  const [schoolSliceUrl, setSchoolSliceUrl] = useState<string>(() => getSchoolSlice3dUrl());
  const [isEditingSchoolUrl, setIsEditingSchoolUrl] = useState(false);
  const [editSchoolUrlInput, setEditSchoolUrlInput] = useState<string>(schoolSliceUrl);
  const [showEmbeddedPlayer, setShowEmbeddedPlayer] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isCsvCopied, setIsCsvCopied] = useState(false);

  // Sync state dengan event update
  useEffect(() => {
    const handleUrlUpdated = () => {
      const current = getGamePidPlatformUrl();
      setPlatformUrl(current);
      setEditUrlInput(current);
    };
    const handleSchoolUrlUpdated = () => {
      const current = getSchoolSlice3dUrl();
      setSchoolSliceUrl(current);
      setEditSchoolUrlInput(current);
    };

    window.addEventListener('smart_absensi_game_pid_url_updated', handleUrlUpdated);
    window.addEventListener('smart_absensi_school_slice_3d_url_updated', handleSchoolUrlUpdated);

    return () => {
      window.removeEventListener('smart_absensi_game_pid_url_updated', handleUrlUpdated);
      window.removeEventListener('smart_absensi_school_slice_3d_url_updated', handleSchoolUrlUpdated);
    };
  }, []);

  // Back Navigation Handlers untuk modal interaktif
  useBackHandler({
    id: 'game-pid-embedded-player',
    isOpen: showEmbeddedPlayer,
    priority: BACK_PRIORITIES.MODAL + 5,
    title: 'School Slice 3D Player',
    onBack: () => {
      setShowEmbeddedPlayer(false);
      return true;
    },
  });

  useBackHandler({
    id: 'game-pid-guide-modal',
    isOpen: showGuideModal,
    priority: BACK_PRIORITIES.MODAL + 4,
    title: 'Panduan Soal Guru 3D',
    onBack: () => {
      setShowGuideModal(false);
      return true;
    },
  });

  useBackHandler({
    id: 'game-pid-edit-school-url',
    isOpen: isEditingSchoolUrl,
    priority: BACK_PRIORITIES.SUB_LAYER,
    title: 'Edit URL School Slice 3D',
    onBack: () => {
      setIsEditingSchoolUrl(false);
      return true;
    },
  });

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

  const handleSaveCustomSchoolUrl = () => {
    const trimmed = editSchoolUrlInput.trim();
    if (!trimmed) {
      setSchoolSlice3dUrl(DEFAULT_SCHOOL_SLICE_3D_URL);
      setSchoolSliceUrl(DEFAULT_SCHOOL_SLICE_3D_URL);
      setEditSchoolUrlInput(DEFAULT_SCHOOL_SLICE_3D_URL);
    } else {
      let finalUrl = trimmed;
      if (!/^https?:\/\//i.test(finalUrl)) {
        finalUrl = `https://${finalUrl}`;
      }
      setSchoolSlice3dUrl(finalUrl);
      setSchoolSliceUrl(finalUrl);
      setEditSchoolUrlInput(finalUrl);
    }
    setIsEditingSchoolUrl(false);
  };

  const handleResetDefaultSchoolUrl = () => {
    setSchoolSlice3dUrl(DEFAULT_SCHOOL_SLICE_3D_URL);
    setSchoolSliceUrl(DEFAULT_SCHOOL_SLICE_3D_URL);
    setEditSchoolUrlInput(DEFAULT_SCHOOL_SLICE_3D_URL);
    setIsEditingSchoolUrl(false);
  };

  const handleLaunchPlatform = () => {
    if (typeof window !== 'undefined') {
      window.open(platformUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleLaunchSchoolSlice = () => {
    if (typeof window !== 'undefined') {
      window.open(schoolSliceUrl, '_blank', 'noopener,noreferrer');
    }
  };

  const handleDownloadCsvTemplate = () => {
    const blob = new Blob([SAMPLE_CSV_CONTENT], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'template-soal-school-slice-3d.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleCopyCsvTemplate = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(SAMPLE_CSV_CONTENT);
      setIsCsvCopied(true);
      setTimeout(() => setIsCsvCopied(false), 2000);
    }
  };

  const gamePlans: GamePlanItem[] = [
    {
      id: 'pid_school_slice_3d',
      title: 'School Slice 3D: Kehidupan Sekolah',
      category: 'QUIZ',
      badgeCategory: 'Gim 3D Cel-Shaded PID',
      description:
        'Jelajahi kelas dan lingkungan 3D cel-shaded SMP Terpadu Al-Ittihadiyah, interaksi tap-to-move dengan karakter siswa dan guru resmi, nikmati mode split-screen 2 pemain kejar-kejaran, dan selesaikan tantangan bank soal terintegrasi.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 35,
      icon: Box,
      accentColor: 'from-[#8C5A3C] via-[#C85A32] to-[#2F5D50]',
      actionUrl: schoolSliceUrl,
      thumbnailUrl: '/games/school-slice-3d/thumbnail.jpg',
      is3d: true,
    },
  ];

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

        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[11px] font-black text-slate-900 uppercase tracking-wider">
            Game PID &amp; 3D Showcase
          </span>
        </div>
      </div>

      {/* 2. PREMIER SHOWCASE: SCHOOL SLICE 3D (GIM UNGGULAN PEKAN INOVASI DIGITAL) */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-[#1E293B] via-[#0F172A] to-[#023246] p-4.5 sm:p-6 text-white shadow-xl border border-amber-500/30 space-y-4">
        {/* Decorative glows */}
        <div className="absolute -top-16 -right-16 w-56 h-56 rounded-full bg-[#C85A32]/25 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 rounded-full bg-[#2F5D50]/30 blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-3.5">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-linear-to-r from-amber-500/20 to-orange-500/20 border border-amber-400/40 text-amber-300 text-[10px] sm:text-xs font-black uppercase tracking-wider backdrop-blur-xs">
              <Box className="w-4 h-4 text-amber-400" />
              <span>Gim 3D Unggulan PID 2026</span>
            </div>
            <span className="text-[10px] font-bold text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded-full border border-emerald-500/40">
              ⚡ WebGL Cel-Shaded 3D Ready
            </span>
          </div>

          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-xl sm:text-2xl font-black text-white leading-tight">
                School Slice 3D: Kehidupan Sekolah
              </h1>
              <span className="px-2 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[10px] tracking-wide uppercase">
                +35 PTS SAGA
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed max-w-2xl">
              Simulasi ruang kelas 3D cel-shaded interaktif dengan palet hangat kayu &amp; papan tulis sekolah. Guru dapat mengimpor bank soal kustom (CSV/JSON), berinteraksi dengan NPC siswa/guru menggunakan kontrol <span className="font-semibold text-amber-300">Tap-to-Move</span>, dan menguji pemahaman KBM secara seru.
            </p>
          </div>

          {/* PALET ORGANIK & HIGHLIGHT FITUR 3D */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 text-[11px]">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#EDE4D3] shrink-0 border border-white/40" />
              <span className="text-slate-200 font-medium truncate">Krem Hangat (#EDE4D3)</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#8C5A3C] shrink-0" />
              <span className="text-slate-200 font-medium truncate">Kayu Mahoni (#8C5A3C)</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#2F5D50] shrink-0" />
              <span className="text-slate-200 font-medium truncate">Papan Tulis (#2F5D50)</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-2.5 border border-white/10 flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#C85A32] shrink-0" />
              <span className="text-slate-200 font-medium truncate">Aksen Bata (#C85A32)</span>
            </div>
          </div>

          {/* TOMBOL AKSI UTAMA SCHOOL SLICE 3D */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-amber-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Tautan Gim School Slice 3D:</span>
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsEditingSchoolUrl(!isEditingSchoolUrl)}
                  className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 active:scale-95 text-[10.5px] font-bold text-white transition-all flex items-center gap-1 cursor-pointer border border-white/15"
                  title="Sesuaikan URL server School Slice 3D (misal localhost saat testing)"
                >
                  <Edit2 className="w-3 h-3 text-amber-300" />
                  <span>Ubah URL Gim</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 text-[10.5px] font-bold text-emerald-300 transition-all flex items-center gap-1 cursor-pointer border border-emerald-400/30"
                  title="Lihat format CSV/JSON pembuatan soal kuis guru"
                >
                  <BookOpen className="w-3 h-3 text-emerald-300" />
                  <span>Panduan Bank Soal</span>
                </button>
              </div>
            </div>

            {/* Input URL Editor jika mode edit aktif */}
            {isEditingSchoolUrl && (
              <div className="space-y-2 animate-in fade-in duration-150">
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    value={editSchoolUrlInput}
                    onChange={(e) => setEditSchoolUrlInput(e.target.value)}
                    placeholder="/games/school-slice-3d/index.html atau http://localhost:5173"
                    className="flex-1 bg-white/95 text-slate-900 px-3 py-1.5 rounded-xl text-xs font-mono border border-white/40 focus:outline-hidden focus:ring-2 focus:ring-amber-400"
                  />
                  <button
                    type="button"
                    onClick={handleSaveCustomSchoolUrl}
                    className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer transition-all"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>Simpan</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleResetDefaultSchoolUrl}
                    className="p-1.5 bg-white/10 hover:bg-white/20 active:scale-95 text-white rounded-xl transition-all cursor-pointer"
                    title="Reset ke URL default"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="text-[10px] text-amber-200/80">
                  Tip Pengembang: Jika Anda menjalankan proyek <code>school-slice-3d-starter</code> di laptop via Vite lokal, masukkan <code>http://localhost:5173</code>.
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              {/* Tombol 1: Buka Player Interaktif di Dalam Aplikasi */}
              <button
                type="button"
                onClick={() => setShowEmbeddedPlayer(true)}
                className="w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-linear-to-r from-emerald-400 via-teal-300 to-emerald-500 text-slate-950 hover:brightness-105 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <Play className="w-4 h-4 fill-slate-950 stroke-none" />
                <span>Mainkan di Aplikasi (In-App 3D)</span>
              </button>

              {/* Tombol 2: Buka di Tab Baru */}
              <button
                type="button"
                onClick={handleLaunchSchoolSlice}
                className="w-full py-3 px-4 rounded-xl font-black text-xs sm:text-sm bg-white/15 hover:bg-white/25 active:scale-[0.99] text-white border border-white/30 transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Buka Tab Baru (Layar Penuh) ↗</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 3. HERO ARENA & DIRECT PLATFORM LAUNCHER NAWASENA PI */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-violet-900 via-indigo-950 to-[#023246] p-4.5 sm:p-6 text-white shadow-md border border-violet-800/40 space-y-4">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-white text-[10px] sm:text-xs font-extrabold uppercase tracking-wider backdrop-blur-xs">
              <Gamepad2 className="w-4 h-4 text-amber-300" />
              <span>Portal Terpadu Nawasena PI</span>
            </div>
            <span className="text-[10px] font-bold text-violet-200 bg-violet-800/70 px-2.5 py-0.5 rounded-full border border-violet-600/50">
              SMP Terpadu Al-Ittihadiyah
            </span>
          </div>

          <div>
            <h2 className="text-base sm:text-xl font-black text-white leading-tight">
              Portal Induk Pekan Inovasi Digital
            </h2>
            <p className="text-xs sm:text-sm text-indigo-100/90 mt-1 leading-relaxed max-w-2xl">
              Platform pusat yang menaungi seluruh ragam game edukasi, kuis kilat, dan tantangan digital guru serta murid.
            </p>
          </div>

          {/* 🔗 DIRECT LINK PLATFORM GAME PID CARD */}
          <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 sm:p-4 border border-white/20 space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-[10.5px] font-bold text-violet-200 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Tautan Platform Induk:</span>
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
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-black/25 px-3 py-2 rounded-xl border border-white/15">
                <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                <span className="text-xs font-mono text-amber-200 truncate flex-1">
                  {platformUrl}
                </span>
              </div>
            )}

            <button
              type="button"
              onClick={handleLaunchPlatform}
              className="w-full py-2.5 px-4 rounded-xl font-black text-xs sm:text-sm bg-linear-to-r from-amber-400 via-amber-300 to-yellow-400 text-slate-950 hover:brightness-105 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <ExternalLink className="w-4 h-4 stroke-[2.5]" />
              <span>Buka Portal Nawasena PI 🚀</span>
            </button>
          </div>
        </div>
      </div>

      {/* 4. PROFIL PEMAIN & INTEGRASI POIN SAGA */}
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

      {/* 5. GIM UTAMA: SCHOOL SLICE 3D (FEATURED ARENA DENGAN THUMBNAIL) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-[#023246]" />
            <span>Gim Edukasi Resmi PID</span>
          </h2>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Aktif &amp; Terintegrasi
          </span>
        </div>

        {gamePlans.map((item) => {
          const IconComp = item.icon;
          return (
            <div
              key={item.id}
              className="bg-white rounded-3xl border-2 border-amber-300 ring-4 ring-amber-400/10 shadow-md overflow-hidden transition-all group"
            >
              {/* THUMBNAIL BANNER HERO */}
              <div className="relative w-full aspect-16/9 sm:aspect-21/9 bg-slate-950 overflow-hidden">
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
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/25 to-black/10" />

                {/* Badges on top of thumbnail */}
                <div className="absolute top-3 left-3 right-3 flex items-center justify-between gap-2 pointer-events-none">
                  <span className="text-[10px] sm:text-xs font-black px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md text-amber-300 border border-amber-300/40 shadow-xs flex items-center gap-1.5">
                    <IconComp className="w-3.5 h-3.5" />
                    <span>{item.badgeCategory}</span>
                  </span>
                  <span className="text-[9.5px] sm:text-xs font-bold px-2.5 py-1 rounded-xl bg-emerald-500/90 text-white shadow-xs backdrop-blur-md flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                    <span>{item.statusLabel}</span>
                  </span>
                </div>

                {/* Floating Bottom Info on thumbnail */}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2 pointer-events-none">
                  <div className="text-white drop-shadow-md">
                    <h3 className="text-sm sm:text-lg font-black leading-tight drop-shadow-sm">
                      {item.title}
                    </h3>
                    <p className="text-[10.5px] sm:text-xs text-amber-200 font-semibold drop-shadow-sm flex items-center gap-1 mt-0.5">
                      <Sparkles className="w-3 h-3 text-amber-300" />
                      <span>Mode Split-Screen 2 Pemain • Kejar-kejaran KBM</span>
                    </p>
                  </div>
                  <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-md shrink-0">
                    ⭐ +{item.rewardPoints} PTS
                  </div>
                </div>
              </div>

              {/* CARD CONTENT & ACTIONS */}
              <div className="p-4 sm:p-5 space-y-4">
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {item.description}
                </p>

                {/* Action Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setShowEmbeddedPlayer(true)}
                    className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer min-h-11"
                  >
                    <Play className="w-4 h-4 fill-white stroke-none" />
                    <span>Main di Aplikasi (In-App)</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleLaunchSchoolSlice}
                    className="py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer min-h-11"
                  >
                    <span>Buka Tab Baru Penuh</span>
                    <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleDownloadCsvTemplate}
                    className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Unduh Format CSV Soal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Panduan Integrasi Soal Guru</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* 7. STATUS KESIAPAN ARSITEKTUR & PANDUAN */}
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
            <span className="text-slate-700 font-semibold truncate">Gim 3D Cel-Shaded Siap</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-semibold truncate">In-App WebGL Player</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-semibold truncate">Format CSV Soal Guru</span>
          </div>
          <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-200 flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span className="text-slate-700 font-semibold truncate">Responsif Infinix Note 8</span>
          </div>
        </div>
      </div>

      {/* 8. BOTTOM RETURN BUTTON */}
      <button
        type="button"
        onClick={onBack}
        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 border border-slate-200/90 shadow-xs text-xs font-bold text-[#023246] flex items-center justify-center gap-2 transition-all cursor-pointer min-h-12"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{backLabel}</span>
      </button>

      {/* =========================================================================
          MODAL 1: IN-APP EMBEDDED PLAYER FOR SCHOOL SLICE 3D
          Mematuhi INFINIX_NOTE_8_FULLSCREEN_RULE.md (100dvh, thumb-friendly)
         ========================================================================= */}
      {showEmbeddedPlayer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="School Slice 3D In-App Player"
        >
          <div className="w-full h-dvh md:h-[94vh] md:max-w-5xl md:rounded-3xl bg-slate-950 flex flex-col overflow-hidden shadow-2xl border border-slate-800">
            {/* Header Player */}
            <div className="h-14 sm:h-16 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 text-white pt-[env(safe-area-inset-top)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowEmbeddedPlayer(false)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                  aria-label="Tutup Player"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-[#8C5A3C] to-[#C85A32] flex items-center justify-center shrink-0">
                  <Box className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white truncate">
                    School Slice 3D: Kehidupan Sekolah
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-amber-300 font-mono truncate">
                    {schoolSliceUrl}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleLaunchSchoolSlice}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="Buka di tab baru (layar penuh)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tab Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowEmbeddedPlayer(false)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-rose-900/60 text-slate-400 hover:text-rose-300 flex items-center justify-center transition-all cursor-pointer"
                  aria-label="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Iframe Viewport Container */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              <iframe
                src={schoolSliceUrl}
                title="School Slice 3D Game"
                className="w-full h-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; xr-spatial-tracking"
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
              />

              {/* Tips overlay bantuan WebGL & Tab Baru */}
              <div className="pointer-events-none absolute bottom-3 left-3 right-3 sm:left-auto sm:right-3 max-w-md bg-slate-900/90 backdrop-blur-md rounded-2xl p-3 border border-slate-700/80 text-[10.5px] text-slate-300 space-y-1 shadow-lg">
                <div className="flex items-center gap-1.5 text-amber-300 font-bold">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Koneksi Gim WebGL Internal:</span>
                </div>
                <p className="leading-snug">
                  Gim 3D berjalan langsung secara internal (offline-ready). Anda juga dapat membuka mode layar penuh mandiri melalui tombol <strong>Tab Baru</strong> di kanan atas.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: PANDUAN BANK SOAL & TEMPLATE CSV GURU
         ========================================================================= */}
      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan Bank Soal School Slice 3D"
        >
          <div className="w-full h-dvh md:h-auto md:max-h-[90vh] md:max-w-2xl md:rounded-3xl bg-white flex flex-col overflow-hidden shadow-2xl">
            {/* Header Modal */}
            <div className="h-14 sm:h-16 px-4 bg-white border-b border-slate-200 flex items-center justify-between shrink-0 pt-[env(safe-area-inset-top)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setShowGuideModal(false)}
                  className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 transition-all cursor-pointer shrink-0"
                  aria-label="Kembali"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-slate-900 truncate">
                    Panduan &amp; Template Bank Soal KBM
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-slate-500 font-medium truncate">
                    Format CSV/JSON untuk Gim School Slice 3D
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="w-10 h-10 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 hidden sm:flex items-center justify-center transition-all cursor-pointer"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Konten Scrollable */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3.5 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-900 font-black text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Dukungan Kuis Fleksibel untuk Guru</span>
                </div>
                <p className="text-xs text-emerald-800 leading-relaxed">
                  Bapak/Ibu Pendidik dapat menyusun soal ujian, kuis harian, atau studi kasus karakter secara mandiri menggunakan spreadsheet (Excel/Google Sheets) kemudian menyimpannya sebagai file <strong>.csv</strong>.
                </p>
              </div>

              {/* Penjelasan Kolom CSV */}
              <div className="space-y-2">
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Struktur Kolom CSV yang Wajib Ada:</span>
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">npcName</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">Nama karakter NPC (misal: <em>Pak Budi (Guru TIK)</em>)</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">npcRole</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">Peran NPC di kelas (misal: <em>Guru Informatika</em>, <em>Ketua Kelas</em>)</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">storyIntro</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">Kalimat sapaan/narasi sebelum memunculkan soal</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">question</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">Teks pertanyaan kuis pilihan ganda</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">optionA..D</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">Pilihan jawaban (kolom optionA, optionB, optionC, optionD)</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">correctIndex</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">Kunci jawaban: <code>0</code>=A, <code>1</code>=B, <code>2</code>=C, <code>3</code>=D</p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 sm:col-span-2">
                    <span className="font-mono font-bold text-indigo-700 text-[11px]">explanation</span>
                    <p className="text-[10.5px] text-slate-600 mt-0.5">Penjelasan edukatif yang ditampilkan saat pemain selesai memilih jawaban</p>
                  </div>
                </div>
              </div>

              {/* Preview Cuplikan CSV */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Contoh Isi File CSV:</span>
                  <button
                    type="button"
                    onClick={handleCopyCsvTemplate}
                    className="text-[11px] font-bold text-indigo-700 hover:text-indigo-900 inline-flex items-center gap-1 cursor-pointer"
                  >
                    {isCsvCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Tersalin ke Clipboard</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Format</span>
                      </>
                    )}
                  </button>
                </div>
                <div className="p-3 bg-slate-900 text-slate-100 rounded-2xl font-mono text-[10.5px] overflow-x-auto border border-slate-800 leading-relaxed max-h-40">
                  <pre>{SAMPLE_CSV_CONTENT}</pre>
                </div>
              </div>
            </div>

            {/* Footer Aksi Modal */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={handleDownloadCsvTemplate}
                className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-xs transition-all"
              >
                <Download className="w-4 h-4" />
                <span>Unduh Template CSV</span>
              </button>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="py-2.5 px-4 rounded-xl bg-white hover:bg-slate-100 active:scale-95 text-slate-700 border border-slate-300 font-bold text-xs cursor-pointer transition-all"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
