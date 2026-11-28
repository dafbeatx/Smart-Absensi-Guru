import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import {
  X,
  RotateCcw,
  Check,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';
import {
  SagaAdminHubIcon,
  SagaAspirationIcon,
  SagaBimtekIcon,
  SagaBookMaterialIcon,
  SagaCalendarAgendaIcon,
  SagaCheckBadgeIcon,
  SagaClassroomIcon,
  SagaClockStatusIcon,
  SagaCounselingIcon,
  SagaCreateExamIcon,
  SagaEditPencilIcon,
  SagaEmergencySosIcon,
  SagaExamCardIcon,
  SagaFingerprintIcon,
  SagaGamePidIcon,
  SagaGradingIcon,
  SagaHistoryIcon,
  SagaHomeroomIcon,
  SagaLeavePermitIcon,
  SagaMapPinIcon,
  SagaMoodFaceIcon,
  SagaMoreAppsIcon,
  SagaNotulenIcon,
  SagaOralExamIcon,
  SagaRfidKioskIcon,
  SagaSarprasIcon,
  SagaScheduleIcon,
  SagaSparkAiIcon,
  SagaStudentsIcon,
} from '../../../components/ui/SagaServiceIcons';
import type { UserProfile } from '../../../types/database.types';
import { isUserSarprasOfficer } from '../../sarpras/utils/sarpras-access.utils';

const MoodQuickIcon: React.FC<{ className?: string }> = ({ className = 'w-6 h-6' }) => (
  <SagaMoodFaceIcon mood="VERY_HAPPY" className={className} />
);

export interface QuickIconItem {
  id: string;
  title: string;
  category: 'Presensi & Waktu' | 'Akademik & Nilai' | 'Kesiswaan & Rombel' | 'Bantuan & Komunikasi';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  colorClass: string;
}

export const ALL_QUICK_ICONS: QuickIconItem[] = [
  {
    id: 'presensi',
    title: 'Presensi',
    category: 'Presensi & Waktu',
    description: 'Pilihan metode presensi masuk dan pulang (QR / Biometrik)',
    icon: SagaFingerprintIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'izin_cuti',
    title: 'Izin Cuti',
    category: 'Presensi & Waktu',
    description: 'Pengajuan surat permohonan izin, sakit, dan dinas luar',
    icon: SagaLeavePermitIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'jadwal',
    title: 'Jadwal KBM',
    category: 'Presensi & Waktu',
    description: 'Jadwal jam mengajar harian dan ruangan kelas',
    icon: SagaScheduleIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'rekap',
    title: 'Rekap',
    category: 'Presensi & Waktu',
    description: 'Rekapitulasi riwayat presensi bulanan dan ketepatan waktu',
    icon: SagaHistoryIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'riwayat',
    title: 'Riwayat',
    category: 'Presensi & Waktu',
    description: 'Catatan log presensi masuk, pulang, dan status bulanan',
    icon: SagaHistoryIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'koreksi',
    title: 'Koreksi Absen',
    category: 'Presensi & Waktu',
    description: 'Pengajuan koreksi presensi jika lupa atau kendala GPS',
    icon: SagaEditPencilIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'location',
    title: 'Peta Lokasi',
    category: 'Presensi & Waktu',
    description: 'Pantau koordinat GPS gerbang sekolah dan radius presensi',
    icon: SagaMapPinIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'survey_hasil',
    title: 'Hasil Survey',
    category: 'Presensi & Waktu',
    description: 'Hasil survey anonim seluruh guru, grafik TAM, & rekomendasi solusi',
    icon: SagaCheckBadgeIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'kalender',
    title: 'Kalender Agenda',
    category: 'Akademik & Nilai',
    description: 'Kalender akademik sekolah, hari libur nasional, dan ujian',
    icon: SagaCalendarAgendaIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'materials',
    title: 'Bahan Ajar',
    category: 'Akademik & Nilai',
    description: 'Bank materi modul pembelajaran & referensi KBM',
    icon: SagaBookMaterialIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'classroom',
    title: 'Ruang Kelas',
    category: 'Kesiswaan & Rombel',
    description: 'Daftar rombongan belajar dan ruangan kelas sekolah',
    icon: SagaClassroomIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'koreksi_soal',
    title: 'Koreksi Soal',
    category: 'Akademik & Nilai',
    description: 'Aplikasi koreksi lembar ujian & rekap nilai siswa',
    icon: SagaGradingIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'buat_soal_ai',
    title: 'Buat Soal',
    category: 'Akademik & Nilai',
    description: 'Pembuat naskah soal, kisi-kisi, dan kunci jawaban ujian',
    icon: SagaCreateExamIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'administrasi',
    title: 'Administrasi',
    category: 'Akademik & Nilai',
    description: 'Pusat administrasi KBM, ujian, modul ajar, dan berkas sekolah',
    icon: SagaAdminHubIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'exam_card',
    title: 'Kartu Ujian',
    category: 'Akademik & Nilai',
    description: 'Cetak kartu peserta ujian & barcode NISN siswa otomatis (A4)',
    icon: SagaExamCardIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'oral_exam',
    title: 'Ujian Lisan',
    category: 'Akademik & Nilai',
    description: 'Penilaian Ujian Lisan Bahasa & BTQ sesuai penempatan penguji dari Admin',
    icon: SagaOralExamIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'jadwal_ujian_ngawas',
    title: 'Jadwal Ujian & Ngawas',
    category: 'Akademik & Nilai',
    description: 'Jadwal ujian ASTS/ASAS & pembagian tugas pengawas guru berbasis AI (Hak Panitia)',
    icon: SagaScheduleIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'notulen',
    title: 'Notulen',
    category: 'Akademik & Nilai',
    description: 'Notulen rapat AI & arsip risalah rapat sekolah untuk seluruh guru',
    icon: SagaNotulenIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'bimtek',
    title: 'Bimtek & Diklat',
    category: 'Akademik & Nilai',
    description: 'Pencatatan bimbingan teknis, diklat, workshop, JP, dan sertifikat resmi guru',
    icon: SagaBimtekIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'game_pid',
    title: 'Game PID',
    category: 'Akademik & Nilai',
    description: 'Arena permainan edukasi & kuis interaktif digital sekolah (PID)',
    icon: SagaGamePidIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'counseling_bk',
    title: 'Catatan BK',
    category: 'Kesiswaan & Rombel',
    description: 'Catatan bimbingan konseling siswa terintegrasi dengan Nawasena Platform Siswa',
    icon: SagaCounselingIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'direktori_siswa',
    title: 'Direktori Siswa',
    category: 'Kesiswaan & Rombel',
    description: 'Database siswa, rombel kelas, kontak wali, dan kartu RFID',
    icon: SagaStudentsIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'homeroom_plan',
    title: 'Ruang Wali Kelas',
    category: 'Kesiswaan & Rombel',
    description: 'Pemantauan dan verifikasi rencana studi siswa kelas 9',
    icon: SagaHomeroomIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'student_kiosk',
    title: 'Kiosk RFID',
    category: 'Kesiswaan & Rombel',
    description: 'Terminal pemindaian tap kartu RFID siswa untuk guru piket',
    icon: SagaRfidKioskIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'student_good',
    title: '+ Kebaikan',
    category: 'Kesiswaan & Rombel',
    description: 'Poin apresiasi prestasi & perilaku terpuji siswa',
    icon: SagaSparkAiIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'student_discipline',
    title: '- Disiplin',
    category: 'Kesiswaan & Rombel',
    description: 'Poin pelanggaran tata tertib & kedisiplinan siswa',
    icon: SagaClockStatusIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'emergency',
    title: 'Darurat SOS',
    category: 'Bantuan & Komunikasi',
    description: 'Panggilan bantuan darurat kelas instan ke Guru Piket & UKS',
    icon: SagaEmergencySosIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'complaint',
    title: 'Kotak Aspirasi',
    category: 'Bantuan & Komunikasi',
    description: 'Sampaikan aspirasi & masukan secara anonim ke Kepala Sekolah',
    icon: SagaAspirationIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'mood',
    title: 'Mood Harian',
    category: 'Bantuan & Komunikasi',
    description: 'Catat kesiapan energi dan suasana hati sebelum mengajar',
    icon: MoodQuickIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'lainnya',
    title: 'Lainnya',
    category: 'Bantuan & Komunikasi',
    description: 'Daftar lengkap seluruh fitur dan pengaturan sekolah',
    icon: SagaMoreAppsIcon,
    colorClass: 'bg-white border-slate-200',
  },
  {
    id: 'sarpras_inventory',
    title: 'Sarpras',
    category: 'Presensi & Waktu',
    description: 'Inventaris sarana & prasarana sekolah (Wakasek Sarpras)',
    icon: SagaSarprasIcon,
    colorClass: 'bg-white border-slate-200',
  },
];

export const DEFAULT_8_QUICK_ICONS = [
  'presensi',
  'izin_cuti',
  'jadwal',
  'rekap',
  'oral_exam',
  'exam_card',
  'koreksi_soal',
  'kalender',
];

export function getEffectiveQuickIcons(currentUser?: UserProfile | null): QuickIconItem[] {
  const isOfficer = isUserSarprasOfficer(currentUser);
  if (isOfficer) return ALL_QUICK_ICONS;
  return ALL_QUICK_ICONS.filter((icon) => icon.id !== 'sarpras_inventory');
}

/**
 * 5 Grup Terstruktur (Masing-masing 3 atau 4 Card):
 * Menghindari 1 layer bertumpuk panjang agar pas di layar HP Infinix Note 8
 */
export interface QuickIconStep {
  id: number;
  title: string;
  category: string;
  itemIds: string[];
}

export const QUICK_ICON_STEPS: QuickIconStep[] = [
  {
    id: 1,
    title: 'Presensi Inti',
    category: 'Presensi & Waktu',
    itemIds: ['presensi', 'izin_cuti', 'jadwal', 'rekap', 'riwayat'],
  },
  {
    id: 2,
    title: 'Presensi & Fasilitas',
    category: 'Presensi & Waktu',
    itemIds: ['koreksi', 'location', 'kalender', 'sarpras_inventory'], // sarpras_inventory hanya muncul untuk Wakasek Sarpras
  },
  {
    id: 3,
    title: 'Akademik & KBM',
    category: 'Akademik & Nilai',
    itemIds: ['administrasi', 'exam_card', 'oral_exam', 'jadwal_ujian_ngawas', 'buat_soal_ai', 'materials', 'classroom', 'koreksi_soal'],
  },
  {
    id: 4,
    title: 'Kesiswaan & Rombel',
    category: 'Kesiswaan & Rombel',
    itemIds: ['direktori_siswa', 'homeroom_plan', 'student_kiosk', 'student_good', 'student_discipline'],
  },
  {
    id: 5,
    title: 'Bantuan & Kesejahteraan',
    category: 'Bantuan & Komunikasi',
    itemIds: ['emergency', 'complaint', 'mood', 'lainnya'],
  },
];

export function getEffectiveQuickIconSteps(currentUser?: UserProfile | null): QuickIconStep[] {
  const isOfficer = isUserSarprasOfficer(currentUser);
  return QUICK_ICON_STEPS.map((step) => ({
    ...step,
    itemIds: isOfficer ? step.itemIds : step.itemIds.filter((id) => id !== 'sarpras_inventory'),
  }));
}

export function sanitizeQuickIconIds(
  rawIds: unknown,
  allowSarpras: boolean,
  fallbackIds: readonly string[] = DEFAULT_8_QUICK_ICONS
): string[] {
  const validSet = new Set(
    ALL_QUICK_ICONS.filter((item) => item.id !== 'sarpras_inventory' || allowSarpras).map(
      (item) => item.id
    )
  );
  const result: string[] = [];

  if (Array.isArray(rawIds)) {
    for (const raw of rawIds) {
      if (typeof raw !== 'string') continue;
      const normalized = raw === 'sarpras_inventory' && !allowSarpras ? 'kalender' : raw;
      if (validSet.has(normalized) && !result.includes(normalized)) {
        result.push(normalized);
      }
      if (result.length >= 8) break;
    }
  }

  for (const candidate of [...fallbackIds, ...DEFAULT_8_QUICK_ICONS]) {
    if (result.length >= 8) break;
    if (validSet.has(candidate) && !result.includes(candidate)) {
      result.push(candidate);
    }
  }

  return result.slice(0, 8);
}

interface CustomizeQuickIconsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIconIds: string[];
  onSave: (newIconIds: string[]) => void;
  currentUser?: UserProfile | null;
}

export const CustomizeQuickIconsModal: React.FC<CustomizeQuickIconsModalProps> = ({
  isOpen,
  onClose,
  currentIconIds,
  onSave,
  currentUser,
}) => {
  const isOfficer = isUserSarprasOfficer(currentUser);
  const allowedIcons = ALL_QUICK_ICONS.filter(
    (icon) => icon.id !== 'sarpras_inventory' || isOfficer
  );

  const effectiveSteps = QUICK_ICON_STEPS.map((step) => ({
    ...step,
    itemIds: isOfficer ? step.itemIds : step.itemIds.filter((id) => id !== 'sarpras_inventory'),
  }));
  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    sanitizeQuickIconIds(currentIconIds, isOfficer)
  );
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(sanitizeQuickIconIds(currentIconIds, isOfficer));
      setCurrentStepIndex(0);
    }
  }, [isOpen, currentIconIds, isOfficer]);

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  const handleToggle = (id: string) => {
    if (id === 'sarpras_inventory' && !isOfficer) return;
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return; // minimal 1 item
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 8) {
        // Ganti slot terakhir jika sudah terisi penuh 8
        setSelectedIds([...selectedIds.slice(0, 7), id]);
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const handleRemoveSlot = (index: number) => {
    if (selectedIds.length <= 1) return;
    const newArr = [...selectedIds];
    newArr.splice(index, 1);
    setSelectedIds(newArr);
  };

  const handleReset = () => {
    setSelectedIds(DEFAULT_8_QUICK_ICONS);
  };

  const handleSave = () => {
    onSave(sanitizeQuickIconIds(selectedIds, isOfficer));
    onClose();
  };

  if (!isOpen) return null;

  const currentStep = effectiveSteps[currentStepIndex] || effectiveSteps[0];
  const currentStepItems = currentStep.itemIds
    .map((id) => allowedIcons.find((icon) => icon.id === id))
    .filter((item): item is QuickIconItem => item !== undefined);

  const totalSteps = effectiveSteps.length;
  const isLastStep = currentStepIndex === totalSteps - 1;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70"
      role="dialog"
      aria-modal="true"
      aria-label="Kustomisasi Menu Utama Guru"
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full h-dvh sm:h-auto sm:max-h-[92dvh] sm:max-w-120 bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 flex flex-col overflow-hidden z-10">
        {/* ── 1. STICKY HEADER ──────────────────────────────────────────────── */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-9 h-9 rounded-xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center shrink-0">
                <SagaMoreAppsIcon className="w-5 h-5" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-slate-900 truncate leading-tight">
                  Kustomisasi Menu Utama Guru
                </h3>
                <p className="text-xs text-slate-500 font-medium truncate">
                  Pilih 8 ikon favorit untuk menu dashboard
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-700 font-bold transition-colors cursor-pointer shrink-0"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Status Bar Slot Dashboard */}
          <div className="flex items-center justify-between mt-2.5 px-3 py-2 bg-[#F8FAFC] rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-slate-700">Slot Terpilih:</span>
              <span
                className={`px-2 py-0.5 rounded-md font-bold text-xs ${
                  selectedIds.length === 8
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-amber-100 text-amber-900'
                }`}
              >
                {selectedIds.length} / 8 Ikon
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-xs font-bold text-[#0D5C46] hover:underline flex items-center gap-1 cursor-pointer min-h-8 px-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Default</span>
            </button>
          </div>
        </div>

        {/* ── 2. SCROLLABLE BODY ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3.5 space-y-3.5">
          {/* Pratinjau 8 Slot Dashboard (2 Baris x 4 Kolom) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3.5 h-3.5 text-[#0D5C46]" />
                Pratinjau Dashboard (2 Baris × 4 Kolom)
              </span>
              <span className="text-[11px] font-semibold text-slate-500">
                Tap ikon untuk hapus
              </span>
            </div>

            <div className="p-2.5 bg-[#F8FAFC] rounded-2xl border border-slate-200 grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }).map((_, index) => {
                const iconId = selectedIds[index];
                const item = allowedIcons.find((i) => i.id === iconId);

                if (!item) {
                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center justify-center p-1.5 rounded-xl border border-dashed border-slate-300 min-h-16 text-slate-400"
                    >
                      <span className="text-[11px] font-bold">Slot {index + 1}</span>
                    </div>
                  );
                }

                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRemoveSlot(index)}
                    className="flex flex-col items-center justify-start text-center p-1 rounded-xl cursor-pointer hover:bg-white active:scale-95 transition-colors group"
                    title={`Klik untuk menghapus ${item.title} dari Slot #${index + 1}`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs shrink-0 relative">
                      <IconComponent className="w-6 h-6" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#0D5C46] text-white rounded-full flex items-center justify-center text-[9px] font-bold border border-white">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-[11px] font-bold text-slate-800 group-hover:text-rose-700 truncate w-full mt-1">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── MULTI-STEP NAVIGATION BAR (3 / 4 Card Per Halaman) ─────────── */}
          <div className="space-y-2.5 pt-1">
            {/* Step Pills & Title */}
            <div className="bg-[#F8FAFC] p-2 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-2 py-0.5 rounded-md bg-[#0D5C46] text-white text-[10px] font-bold tracking-wide">
                    BAGIAN {currentStep.id} / {totalSteps}
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {currentStep.title}
                  </span>
                </div>
                <span className="text-[11px] font-semibold text-slate-500">
                  {currentStepItems.length} Pilihan Menu
                </span>
              </div>

              {/* 5 Step Indicator Pills (Bisa Diklik Langsung) */}
              <div className="grid grid-cols-5 gap-1">
                {QUICK_ICON_STEPS.map((st, idx) => {
                  const isActive = idx === currentStepIndex;
                  const selectedInStepCount = st.itemIds.filter((id) =>
                    selectedIds.includes(id)
                  ).length;

                  return (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => setCurrentStepIndex(idx)}
                      className={`min-h-9 py-1 px-1 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                        isActive
                          ? 'bg-[#0D5C46] text-white'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
                      }`}
                      title={`Ke Bagian ${st.id}: ${st.title}`}
                    >
                      <span>Hal {st.id}</span>
                      {selectedInStepCount > 0 && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-amber-300' : 'bg-[#0D5C46]'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card List */}
            <div className="space-y-2">
              {currentStepItems.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const selectedIndex = selectedIds.indexOf(item.id);
                const IconComponent = item.icon;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleToggle(item.id)}
                    className={`w-full p-3 rounded-2xl border text-left flex items-center justify-between gap-3 transition-colors cursor-pointer min-h-16 ${
                      isSelected
                        ? 'bg-emerald-50 border-emerald-300'
                        : 'bg-white hover:bg-slate-50 border-slate-200 active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-11 h-11 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <IconComponent className="w-7 h-7" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-sm font-bold text-slate-900 leading-tight truncate">
                            {item.title}
                          </p>
                          <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md shrink-0">
                            {item.category.split('&')[0].trim()}
                          </span>
                        </div>
                        <p className="text-xs text-slate-600 font-normal line-clamp-1 mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isSelected ? (
                        <span className="px-2.5 py-1.5 rounded-xl bg-[#0D5C46] text-white text-xs font-bold flex items-center gap-1">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Slot #{selectedIndex + 1}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold border border-slate-200">
                          + Pasang
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Navigasi Prev / Next */}
            <div className="flex items-center justify-between pt-1 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                className="flex-1 min-h-11 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border-slate-200 flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </Button>

              <span className="text-xs font-bold text-slate-500 shrink-0 px-1">
                Hal {currentStepIndex + 1} / {totalSteps}
              </span>

              {isLastStep ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                  className="flex-1 min-h-11 rounded-xl text-xs font-bold bg-[#0D5C46] hover:bg-[#094736] text-white flex items-center justify-center gap-1"
                >
                  <Check className="w-4 h-4" />
                  <span>Selesai</span>
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="primary"
                  onClick={() =>
                    setCurrentStepIndex((prev) =>
                      Math.min(QUICK_ICON_STEPS.length - 1, prev + 1)
                    )
                  }
                  className="flex-1 min-h-11 rounded-xl text-xs font-bold bg-[#0D5C46] hover:bg-[#094736] text-white flex items-center justify-center gap-1"
                >
                  <span>Lanjut</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. STICKY FOOTER ──────────────────────────────────────────────── */}
        <div className="shrink-0 bg-white border-t border-slate-200 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center gap-2.5">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 text-slate-700 hover:bg-slate-100 font-bold text-sm min-h-12 rounded-xl cursor-pointer border border-slate-200"
            onClick={onClose}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-2 bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.99] text-white font-bold text-sm min-h-12 rounded-xl cursor-pointer flex items-center justify-center gap-1.5"
            onClick={handleSave}
          >
            <Check className="w-4 h-4" />
            <span>Simpan Susunan (8 Ikon)</span>
          </Button>
        </div>
      </div>
    </div>
  );
};

