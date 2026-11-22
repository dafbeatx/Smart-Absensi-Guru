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
  Box,
  Play,
  FileSpreadsheet,
  Download,
  X,
  Maximize2,
  Layers,
  BookOpen,
  Key,
  Compass,
  Landmark,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import {
  getSchoolSlice3dUrl,
  getRumahSunyiUrl,
  getG7kaihUrl,
  getSuuqAlMadinahUrl,
  getLokaNusantara3dUrl,
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
  subject: string;
  subjectCategory: 'ALL' | 'PANCASILA' | 'BAHASA_ARAB' | 'PAI' | 'UMUM' | 'LITERASI';
  subjectIcon: string;
  subjectBadgeColor: string;
  gradeLevel: string;
  curriculumTopic: string;
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
  // State khusus School Slice 3D
  const [schoolSliceUrl, setSchoolSliceUrl] = useState<string>(() => getSchoolSlice3dUrl());

  // State khusus Rumah Sunyi 3D
  const [rumahSunyiUrl, setRumahSunyiUrlState] = useState<string>(() => getRumahSunyiUrl());

  // State khusus G7KAIH 3D
  const [g7kaihUrl, setG7kaihUrlState] = useState<string>(() => getG7kaihUrl());

  // State khusus Suuq Al-Madinah 3D (Bahasa Arab)
  const [suuqAlMadinahUrl, setSuuqAlMadinahUrlState] = useState<string>(() => getSuuqAlMadinahUrl());

  // State khusus Loka Nusantara 3D (Pendidikan Pancasila)
  const [lokaNusantaraUrl, setLokaNusantaraUrlState] = useState<string>(() => getLokaNusantara3dUrl());

  // State Filter Mata Pelajaran PID
  const [selectedSubjectFilter, setSelectedSubjectFilter] = useState<'ALL' | 'PANCASILA' | 'BAHASA_ARAB' | 'PAI' | 'UMUM' | 'LITERASI'>('ALL');

  // Embedded Player Aktif (School Slice 3D, Rumah Sunyi 3D, G7KAIH 3D, Suuq Al-Madinah 3D, atau Loka Nusantara 3D)
  const [embeddedGame, setEmbeddedGame] = useState<{
    id: string;
    title: string;
    url: string;
    badgeCategory: string;
  } | null>(null);

  const [showGuideModal, setShowGuideModal] = useState(false);
  const [isCsvCopied, setIsCsvCopied] = useState(false);

  // Sync state dengan event update
  useEffect(() => {
    const handleSchoolUrlUpdated = () => {
      const current = getSchoolSlice3dUrl();
      setSchoolSliceUrl(current);
    };
    const handleRumahSunyiUrlUpdated = () => {
      const current = getRumahSunyiUrl();
      setRumahSunyiUrlState(current);
    };
    const handleG7kaihUrlUpdated = () => {
      const current = getG7kaihUrl();
      setG7kaihUrlState(current);
    };
    const handleSuuqAlMadinahUrlUpdated = () => {
      const current = getSuuqAlMadinahUrl();
      setSuuqAlMadinahUrlState(current);
    };
    const handleLokaNusantaraUrlUpdated = () => {
      const current = getLokaNusantara3dUrl();
      setLokaNusantaraUrlState(current);
    };

    window.addEventListener('smart_absensi_school_slice_3d_url_updated', handleSchoolUrlUpdated);
    window.addEventListener('smart_absensi_rumah_sunyi_url_updated', handleRumahSunyiUrlUpdated);
    window.addEventListener('smart_absensi_g7kaih_url_updated', handleG7kaihUrlUpdated);
    window.addEventListener('smart_absensi_suuq_al_madinah_url_updated', handleSuuqAlMadinahUrlUpdated);
    window.addEventListener('smart_absensi_loka_nusantara_3d_url_updated', handleLokaNusantaraUrlUpdated);

    return () => {
      window.removeEventListener('smart_absensi_school_slice_3d_url_updated', handleSchoolUrlUpdated);
      window.removeEventListener('smart_absensi_rumah_sunyi_url_updated', handleRumahSunyiUrlUpdated);
      window.removeEventListener('smart_absensi_g7kaih_url_updated', handleG7kaihUrlUpdated);
      window.removeEventListener('smart_absensi_suuq_al_madinah_url_updated', handleSuuqAlMadinahUrlUpdated);
      window.removeEventListener('smart_absensi_loka_nusantara_3d_url_updated', handleLokaNusantaraUrlUpdated);
    };
  }, []);

  // Back Navigation Handlers untuk modal interaktif
  useBackHandler({
    id: 'game-pid-embedded-player',
    isOpen: embeddedGame !== null,
    priority: BACK_PRIORITIES.MODAL + 5,
    title: embeddedGame?.title || 'Game 3D Player',
    onBack: () => {
      setEmbeddedGame(null);
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

  const subjectFilterOptions = [
    { id: 'ALL', label: 'Semua Mapel', icon: '🎯' },
    { id: 'PANCASILA', label: 'Pendidikan Pancasila', icon: '🇮🇩' },
    { id: 'BAHASA_ARAB', label: 'Bahasa Arab', icon: '📖' },
    { id: 'PAI', label: 'Karakter & PAI', icon: '🕌' },
    { id: 'UMUM', label: 'Umum & Bank Soal', icon: '📚' },
    { id: 'LITERASI', label: 'Literasi & Kuis', icon: '🔍' },
  ];

  const gamePlans: GamePlanItem[] = [
    {
      id: 'pid_loka_nusantara_3d',
      title: 'Loka Nusantara 3D: Pendidikan Pancasila',
      category: 'CHALLENGE',
      badgeCategory: 'Gim 3D Pendidikan Pancasila PID',
      subject: 'Pendidikan Pancasila',
      subjectCategory: 'PANCASILA',
      subjectIcon: '🇮🇩',
      subjectBadgeColor: 'bg-rose-100 text-rose-900 border-rose-300',
      gradeLevel: 'Kelas 7, 8, 9 SMP (Fase D)',
      curriculumTopic: 'Kearifan Lokal, Gotong Royong, Balai Desa & 10 Kasus Pancasila',
      description:
        'Jelajahi desa 3D Nusantara gaya visual Roblox: kustomisasi 17 busana adat nusantara, edit warna baju, ekspresi wajah & aksesoris, kelola energi warga, seberangi jembatan lengkung, dan ikuti musyawarah Balai Desa.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 50,
      icon: Landmark,
      accentColor: 'from-[#A63D2F] via-[#B87D32] to-[#2F6146]',
      actionUrl: lokaNusantaraUrl,
      thumbnailUrl: '/games/loka-nusantara-3d/thumbnail.jpg',
      is3d: true,
    },
    {
      id: 'pid_suuq_al_madinah',
      title: 'Suuq Al-Madinah 3D: Petualangan Pasar Arab',
      category: 'CHALLENGE',
      badgeCategory: 'Gim 3D Bahasa Arab PID',
      subject: 'Bahasa Arab',
      subjectCategory: 'BAHASA_ARAB',
      subjectIcon: '📖',
      subjectBadgeColor: 'bg-amber-100 text-amber-900 border-amber-300',
      gradeLevel: 'Kelas 7, 8, 9 SMP',
      curriculumTopic: 'Mufradat Buah, Peralatan Sekolah, Angka Arab & Dinar',
      description:
        'Simulasi pasar tradisional 3D Timur Tengah: layani pembeli NPC dalam bahasa Arab, cari buah dan alat tulis di rak lapak, timbang belanjaan, dan terima pembayaran koin Arab untuk mengumpulkan poin berkah.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 50,
      icon: Sparkles,
      accentColor: 'from-[#C84B31] via-[#D4A373] to-[#1B4D3E]',
      actionUrl: suuqAlMadinahUrl,
      thumbnailUrl: '/games/suuq-al-madinah/thumbnail.jpg',
      is3d: true,
    },
    {
      id: 'pid_school_slice_3d',
      title: 'School Slice 3D: Kehidupan Sekolah',
      category: 'QUIZ',
      badgeCategory: 'Gim 3D Cel-Shaded PID',
      subject: 'Umum & Multi-Mapel',
      subjectCategory: 'UMUM',
      subjectIcon: '📚',
      subjectBadgeColor: 'bg-blue-100 text-blue-900 border-blue-300',
      gradeLevel: 'Semua Tingkat',
      curriculumTopic: 'Bank Soal Multi-Mata Pelajaran Guru & Simulasi Sekolah',
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
    {
      id: 'pid_g7kaih',
      title: 'G7KAIH: Perjalanan ke SMP Terpadu Al-Ittihadiyah',
      category: 'CHALLENGE',
      badgeCategory: 'Gim 3D Simulasi Karakter PID',
      subject: 'Karakter & PAI',
      subjectCategory: 'PAI',
      subjectIcon: '🕌',
      subjectBadgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-300',
      gradeLevel: 'Kelas 7, 8, 9 SMP',
      curriculumTopic: '7 Kebiasaan Anak Indonesia Hebat, Sholat Subuh & Disiplin',
      description:
        'Simulasi POV 3D 7 Kebiasaan Anak Indonesia Hebat: bangun Subuh di rumah 4 kamar, sholat berjamaah di Masjid Al-Ikhlas, perjalanan desa, dan tiba tepat waktu di SMP Terpadu Al-Ittihadiyah.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 45,
      icon: Compass,
      accentColor: 'from-[#2A2119] via-[#8C7056] to-[#3B5946]',
      actionUrl: g7kaihUrl,
      thumbnailUrl: '/games/g7kaih-al-ittihadiyah/thumbnail.jpg',
      is3d: true,
    },
    {
      id: 'pid_rumah_sunyi',
      title: 'Rumah Sunyi: Tiga Kunci',
      category: 'QUIZ',
      badgeCategory: 'Gim Horor Edukasi 3D POV',
      subject: 'Literasi & Kuis',
      subjectCategory: 'LITERASI',
      subjectIcon: '🔍',
      subjectBadgeColor: 'bg-purple-100 text-purple-900 border-purple-300',
      gradeLevel: 'Kelas 7, 8, 9 SMP',
      curriculumTopic: 'Literasi Digital, Problem Solving & Investigasi',
      description:
        'Investigasi first-person 3D di mansion 9 ruangan: cari 3 kunci kuningan di antara 12 laci, selesaikan uji materi kuis guru, hindari tatapan Sosok Bayangan Pucat dengan sembunyi di lemari, dan buka pintu keluar.',
      status: 'AVAILABLE',
      statusLabel: 'Siap Dimainkan',
      rewardPoints: 40,
      icon: Key,
      accentColor: 'from-[#171310] via-[#c99a45] to-[#b52b21]',
      actionUrl: rumahSunyiUrl,
      thumbnailUrl: '/games/rumah-sunyi/thumbnail.jpg',
      is3d: true,
    },
  ];

  const filteredGames =
    selectedSubjectFilter === 'ALL'
      ? gamePlans
      : gamePlans.filter((g) => g.subjectCategory === selectedSubjectFilter);

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

      {/* 2. PROFIL PEMAIN & INTEGRASI POIN SAGA */}
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

      {/* 3. FILTER MATA PELAJARAN UNTUK GURU */}
      <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-base">🏷️</span>
            <h2 className="text-xs sm:text-sm font-black text-slate-900">
              Filter Mata Pelajaran PID
            </h2>
          </div>
          <span className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2.5 py-1 rounded-xl">
            Menampilkan {filteredGames.length} dari {gamePlans.length} gim
          </span>
        </div>

        {/* Tab Buttons Filter - Touch friendly for Infinix Note 8 */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {subjectFilterOptions.map((f) => {
            const isActive = selectedSubjectFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => setSelectedSubjectFilter(f.id as typeof selectedSubjectFilter)}
                className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer flex items-center gap-2 active:scale-95 min-h-11 ${
                  isActive
                    ? 'bg-[#023246] text-white shadow-md'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200'
                }`}
              >
                <span className="text-sm">{f.icon}</span>
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. DAFTAR GIM EDUKASI SESUAI MAPEL */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-2">
            <Gamepad2 className="w-4 h-4 text-[#023246]" />
            <span>Katalog Gim Edukasi ({filteredGames.length})</span>
          </h2>
          <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
            Aktif &amp; Terintegrasi
          </span>
        </div>

        {filteredGames.length === 0 ? (
          <div className="bg-white rounded-3xl p-8 border border-slate-200 text-center space-y-2">
            <p className="text-2xl">🔍</p>
            <p className="text-sm font-bold text-slate-800">Tidak ada gim untuk filter ini</p>
            <button
              type="button"
              onClick={() => setSelectedSubjectFilter('ALL')}
              className="text-xs text-indigo-600 font-bold hover:underline"
            >
              Reset ke Semua Mapel
            </button>
          </div>
        ) : (
          filteredGames.map((item) => {
            const IconComp = item.icon;
            return (
              <div
                key={item.id}
                className="bg-white rounded-3xl border-2 border-amber-300 ring-4 ring-amber-400/10 shadow-md overflow-hidden transition-all group"
              >
                {/* THUMBNAIL BANNER HERO */}
                <div className="relative w-full aspect-video sm:aspect-21/9 bg-slate-950 overflow-hidden">
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
                  <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/25 to-black/10" />

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
                        <span>
                          {item.id === 'pid_loka_nusantara_3d'
                            ? 'Desa 3D Nusantara • Musyawarah Balai Desa & Gotong Royong 5 Sila'
                            : item.id === 'pid_suuq_al_madinah'
                            ? 'Pasar 3D Arab • Belanja Koin Dinar & Mufradat'
                            : item.id === 'pid_school_slice_3d'
                            ? 'Mode Split-Screen 2 Pemain • Kejar-kejaran KBM'
                            : item.id === 'pid_g7kaih'
                            ? 'POV 3D Rumah & Desa • Sholat Subuh & 7 Karakter'
                            : 'Eksplorasi Mansion 9 Ruangan • 3 Kunci & Lemari Sembunyi'}
                        </span>
                      </p>
                    </div>
                    <div className="px-2.5 py-1 rounded-xl bg-amber-400 text-slate-950 text-xs sm:text-sm font-black shadow-md shrink-0">
                      ⭐ +{item.rewardPoints} PTS
                    </div>
                  </div>
                </div>

                {/* CARD CONTENT & ACTIONS */}
                <div className="p-4 sm:p-5 space-y-3.5">
                  {/* Subject & Grade Level Badge */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black border ${item.subjectBadgeColor}`}
                    >
                      <span>{item.subjectIcon}</span>
                      <span>Mata Pelajaran: {item.subject}</span>
                    </span>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                      🎯 {item.gradeLevel}
                    </span>
                  </div>

                  {/* Curriculum Topic Box */}
                  <div className="p-2.5 sm:p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs text-slate-700 leading-relaxed">
                    <span className="font-black text-slate-900">Topik Kurikulum: </span>
                    <span className="font-medium text-slate-600">{item.curriculumTopic}</span>
                  </div>

                  <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                    {item.description}
                  </p>

                  {/* Action Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() =>
                        setEmbeddedGame({
                          id: item.id,
                          title: item.title,
                          url: item.actionUrl || '',
                          badgeCategory: item.badgeCategory,
                        })
                      }
                      className="py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.99] text-white font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer min-h-11"
                    >
                      <Play className="w-4 h-4 fill-white stroke-none" />
                      <span>Main di Aplikasi (In-App)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== 'undefined' && item.actionUrl) {
                          window.open(item.actionUrl, '_blank', 'noopener,noreferrer');
                        }
                      }}
                      className="py-3 px-4 rounded-2xl bg-amber-400 hover:bg-amber-500 active:scale-[0.99] text-slate-950 font-black text-xs sm:text-sm shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer min-h-11"
                    >
                      <span>Buka Tab Baru Penuh</span>
                      <ExternalLink className="w-4 h-4 stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Secondary Context Actions per Game */}
                  {item.id === 'pid_school_slice_3d' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={handleDownloadCsvTemplate}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-11"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Unduh Format CSV Soal</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setShowGuideModal(true)}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-11"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Panduan Integrasi Soal Guru</span>
                      </button>
                    </div>
                  )}

                  {item.id === 'pid_loka_nusantara_3d' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.open('/games/loka-nusantara-3d/index.html', '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-11"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-rose-600" />
                        <span>Mode Mandiri (1 Berkas HTML)</span>
                      </button>

                      <div className="py-2 px-3 rounded-xl bg-rose-50/80 border border-rose-200 text-[11px] font-semibold text-rose-900 flex items-center gap-1.5 justify-center min-h-11">
                        <Sparkles className="w-3.5 h-3.5 text-rose-700 shrink-0" />
                        <span>Kustomisasi Kostum, Ekspresi &amp; Baju Adat</span>
                      </div>
                    </div>
                  )}

                  {item.id === 'pid_suuq_al_madinah' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.open('/games/suuq-al-madinah/index.html', '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-11"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-amber-600" />
                        <span>Mode Mandiri (1 Berkas HTML)</span>
                      </button>

                      <div className="py-2 px-3 rounded-xl bg-amber-50/80 border border-amber-200 text-[11px] font-semibold text-amber-900 flex items-center gap-1.5 justify-center min-h-11">
                        <Sparkles className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>Mufradat Arab, Koin Dinar &amp; Buah 3D</span>
                      </div>
                    </div>
                  )}

                  {item.id === 'pid_rumah_sunyi' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.open(
                              '/games/rumah-sunyi/standalone/rumah_sunyi_tiga_kunci_standalone.html',
                              '_blank',
                              'noopener,noreferrer'
                            );
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-11"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-purple-600" />
                        <span>Mode Mandiri (1 Berkas HTML)</span>
                      </button>

                      <div className="py-2 px-3 rounded-xl bg-purple-50/70 border border-purple-200/60 text-[11px] font-semibold text-purple-900 flex items-center gap-1.5 justify-center min-h-11">
                        <Key className="w-3.5 h-3.5 text-purple-700 shrink-0" />
                        <span>5 Paket Kuis Mapel &amp; Editor Guru</span>
                      </div>
                    </div>
                  )}

                  {item.id === 'pid_g7kaih' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          if (typeof window !== 'undefined') {
                            window.open('/games/g7kaih-al-ittihadiyah/index.html', '_blank', 'noopener,noreferrer');
                          }
                        }}
                        className="py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 active:scale-98 text-slate-700 text-xs font-bold border border-slate-200/90 flex items-center justify-center gap-1.5 transition-all cursor-pointer min-h-11"
                      >
                        <ExternalLink className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Mode Mandiri (1 Berkas HTML)</span>
                      </button>

                      <div className="py-2 px-3 rounded-xl bg-emerald-50/80 border border-emerald-200 text-[11px] font-semibold text-emerald-900 flex items-center gap-1.5 justify-center min-h-11">
                        <Compass className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>7 Kebiasaan Hebat &amp; Sholat Subuh 3D</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* 5. STATUS KESIAPAN ARSITEKTUR & PANDUAN */}
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

      {/* 6. BOTTOM RETURN BUTTON */}
      <button
        type="button"
        onClick={onBack}
        className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 border border-slate-200/90 shadow-xs text-xs font-bold text-[#023246] flex items-center justify-center gap-2 transition-all cursor-pointer min-h-12"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>{backLabel}</span>
      </button>

      {/* =========================================================================
          MODAL 1: IN-APP EMBEDDED PLAYER FOR SCHOOL SLICE 3D & RUMAH SUNYI 3D
          Mematuhi INFINIX_NOTE_8_FULLSCREEN_RULE.md (100dvh, thumb-friendly)
         ========================================================================= */}
      {embeddedGame && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          role="dialog"
          aria-modal="true"
          aria-label={`${embeddedGame.title} In-App Player`}
        >
          <div className="w-full h-dvh md:h-[94vh] md:max-w-5xl md:rounded-3xl bg-slate-950 flex flex-col overflow-hidden shadow-2xl border border-slate-800">
            {/* Header Player */}
            <div className="h-14 sm:h-16 px-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0 text-white pt-[env(safe-area-inset-top)]">
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  onClick={() => setEmbeddedGame(null)}
                  className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 flex items-center justify-center text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
                  aria-label="Tutup Player"
                >
                  <ArrowLeft className="w-5 h-5" />
                </button>
                <div className="w-8 h-8 rounded-xl bg-linear-to-br from-amber-600 to-amber-800 flex items-center justify-center shrink-0">
                  <Gamepad2 className="w-4 h-4 text-white" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xs sm:text-sm font-black text-white truncate">
                    {embeddedGame.title}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-amber-300 font-mono truncate">
                    {embeddedGame.url}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      window.open(embeddedGame.url, '_blank', 'noopener,noreferrer');
                    }
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
                  title="Buka di tab baru (layar penuh)"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Tab Baru</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEmbeddedGame(null)}
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
                src={embeddedGame.url}
                title={embeddedGame.title}
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
