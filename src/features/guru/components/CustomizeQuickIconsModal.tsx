import React, { useState, useEffect } from 'react';
import { Button } from '../../../components/ui/Button';
import {
  Fingerprint,
  Clock,
  Calendar,
  BarChart3,
  Edit3,
  ClipboardCheck,
  GraduationCap,
  CalendarDays,
  BookOpen,
  MapPin,
  Radio,
  Sparkles,
  AlertTriangle,
  ShieldAlert,
  MessageSquare,
  Smile,
  X,
  RotateCcw,
  Check,
  Settings2,
  Building2,
  ChevronLeft,
  ChevronRight,
  Layers,
  Boxes,
  QrCode,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import { isUserSarprasOfficer } from '../../sarpras/utils/sarpras-access.utils';

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
    icon: Fingerprint,
    colorClass: 'from-[#18536B] to-[#023246]',
  },
  {
    id: 'izin_cuti',
    title: 'Izin Cuti',
    category: 'Presensi & Waktu',
    description: 'Pengajuan surat permohonan izin, sakit, dan dinas luar',
    icon: Clock,
    colorClass: 'from-[#18536B] to-[#023246]',
  },
  {
    id: 'jadwal',
    title: 'Jadwal KBM',
    category: 'Presensi & Waktu',
    description: 'Jadwal jam mengajar harian dan ruangan kelas',
    icon: Calendar,
    colorClass: 'from-[#18536B] to-[#023246]',
  },
  {
    id: 'rekap',
    title: 'Rekap',
    category: 'Presensi & Waktu',
    description: 'Rekapitulasi riwayat presensi bulanan dan ketepatan waktu',
    icon: BarChart3,
    colorClass: 'from-[#18536B] to-[#023246]',
  },
  {
    id: 'koreksi',
    title: 'Koreksi Absen',
    category: 'Presensi & Waktu',
    description: 'Pengajuan koreksi presensi jika lupa atau kendala GPS',
    icon: Edit3,
    colorClass: 'from-emerald-700 to-teal-900',
  },
  {
    id: 'location',
    title: 'Peta Lokasi',
    category: 'Presensi & Waktu',
    description: 'Pantau koordinat GPS gerbang sekolah dan radius presensi',
    icon: MapPin,
    colorClass: 'from-slate-700 to-slate-900',
  },
  {
    id: 'kalender',
    title: 'Kalender Agenda',
    category: 'Akademik & Nilai',
    description: 'Kalender akademik sekolah, hari libur nasional, dan ujian',
    icon: CalendarDays,
    colorClass: 'from-amber-700 to-orange-900',
  },
  {
    id: 'materials',
    title: 'Bahan Ajar',
    category: 'Akademik & Nilai',
    description: 'Bank materi modul pembelajaran & referensi KBM',
    icon: BookOpen,
    colorClass: 'from-indigo-700 to-violet-900',
  },
  {
    id: 'classroom',
    title: 'Ruang Kelas',
    category: 'Kesiswaan & Rombel',
    description: 'Daftar rombongan belajar dan ruangan kelas sekolah',
    icon: Building2,
    colorClass: 'from-cyan-700 to-blue-900',
  },
  {
    id: 'koreksi_soal',
    title: 'Koreksi Soal',
    category: 'Akademik & Nilai',
    description: 'Aplikasi koreksi lembar ujian & rekap nilai siswa (Link)',
    icon: ClipboardCheck,
    colorClass: 'from-[#18536B] to-[#023246]',
  },
  {
    id: 'exam_card',
    title: 'Kartu Ujian',
    category: 'Akademik & Nilai',
    description: 'Cetak kartu peserta ujian & barcode NISN siswa otomatis (A4)',
    icon: QrCode,
    colorClass: 'from-amber-600 to-yellow-800',
  },
  {
    id: 'direktori_siswa',
    title: 'Direktori Siswa',
    category: 'Kesiswaan & Rombel',
    description: 'Database siswa, rombel kelas, kontak wali, dan kartu RFID',
    icon: GraduationCap,
    colorClass: 'from-blue-700 to-indigo-900',
  },
  {
    id: 'student_kiosk',
    title: 'Kiosk RFID',
    category: 'Kesiswaan & Rombel',
    description: 'Terminal pemindaian tap kartu RFID siswa untuk guru piket',
    icon: Radio,
    colorClass: 'from-purple-700 to-indigo-900',
  },
  {
    id: 'student_good',
    title: '+ Kebaikan',
    category: 'Kesiswaan & Rombel',
    description: 'Poin apresiasi prestasi & perilaku terpuji siswa',
    icon: Sparkles,
    colorClass: 'from-emerald-600 to-teal-800',
  },
  {
    id: 'student_discipline',
    title: '- Disiplin',
    category: 'Kesiswaan & Rombel',
    description: 'Poin pelanggaran tata tertib & kedisiplinan siswa',
    icon: AlertTriangle,
    colorClass: 'from-rose-600 to-red-800',
  },
  {
    id: 'emergency',
    title: 'Darurat SOS',
    category: 'Bantuan & Komunikasi',
    description: 'Panggilan bantuan darurat kelas instan ke Guru Piket & UKS',
    icon: ShieldAlert,
    colorClass: 'from-red-600 to-rose-800',
  },
  {
    id: 'complaint',
    title: 'Kotak Aspirasi',
    category: 'Bantuan & Komunikasi',
    description: 'Sampaikan aspirasi & masukan secara anonim ke Kepala Sekolah',
    icon: MessageSquare,
    colorClass: 'from-cyan-700 to-slate-800',
  },
  {
    id: 'mood',
    title: 'Mood Harian',
    category: 'Bantuan & Komunikasi',
    description: 'Catat kesiapan energi dan suasana hati sebelum mengajar',
    icon: Smile,
    colorClass: 'from-amber-600 to-yellow-800',
  },
  {
    id: 'sarpras_inventory',
    title: 'Sarpras',
    category: 'Presensi & Waktu',
    description: 'Inventaris sarana & prasarana sekolah (Wakasek Sarpras)',
    icon: Boxes,
    colorClass: 'from-[#023246] to-[#18536B]',
  },
];

export const DEFAULT_8_QUICK_ICONS = [
  'presensi',
  'izin_cuti',
  'jadwal',
  'rekap',
  'exam_card',
  'koreksi_soal',
  'direktori_siswa',
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
    itemIds: ['presensi', 'izin_cuti', 'jadwal', 'rekap'], // 4 items
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
    itemIds: ['exam_card', 'materials', 'classroom', 'koreksi_soal'], // 4 items
  },
  {
    id: 4,
    title: 'Kesiswaan & Rombel',
    category: 'Kesiswaan & Rombel',
    itemIds: ['direktori_siswa', 'student_kiosk', 'student_good', 'student_discipline'], // 4 items
  },
  {
    id: 5,
    title: 'Bantuan & Kesejahteraan',
    category: 'Bantuan & Komunikasi',
    itemIds: ['emergency', 'complaint', 'mood'], // 3 items
  },
];

export function getEffectiveQuickIconSteps(currentUser?: UserProfile | null): QuickIconStep[] {
  const isOfficer = isUserSarprasOfficer(currentUser);
  return QUICK_ICON_STEPS.map((step) => ({
    ...step,
    itemIds: isOfficer ? step.itemIds : step.itemIds.filter((id) => id !== 'sarpras_inventory'),
  }));
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
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentIconIds.length === 8 ? currentIconIds : DEFAULT_8_QUICK_ICONS
  );
  const [currentStepIndex, setCurrentStepIndex] = useState<number>(0);

  useEffect(() => {
    if (isOpen) {
      const sanitized = (currentIconIds.length === 8 ? currentIconIds : DEFAULT_8_QUICK_ICONS).filter(
        (id) => id !== 'sarpras_inventory' || isOfficer
      );
      setSelectedIds(sanitized.length === 8 ? sanitized : DEFAULT_8_QUICK_ICONS);
      setCurrentStepIndex(0);
    }
  }, [isOpen, currentIconIds, isOfficer]);

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
    // Pastikan tepat 8 item (jika kurang dari 8, lengkapi dari default)
    let finalIds = [...selectedIds];
    for (const defId of DEFAULT_8_QUICK_ICONS) {
      if (finalIds.length >= 8) break;
      if (!finalIds.includes(defId)) {
        finalIds.push(defId);
      }
    }
    onSave(finalIds.slice(0, 8));
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-115 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden z-10 animate-scale-up">
        {/* ── 1. STICKY HEADER ──────────────────────────────────────────────── */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-sm">
                <Settings2 className="w-4 h-4 text-amber-300" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
                  Kustomisasi Menu Utama Guru
                </h3>
                <p className="text-[10.5px] text-slate-500 font-bold truncate">
                  Pilih 8 ikon favorit untuk menu dashboard
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 flex items-center justify-center text-slate-500 hover:text-slate-800 font-bold transition-all cursor-pointer shrink-0"
              aria-label="Tutup"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Status Bar Slot Dashboard */}
          <div className="flex items-center justify-between mt-2.5 px-2.5 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px]">
            <div className="flex items-center gap-1.5">
              <span className="font-extrabold text-slate-700">Slot Terpilih:</span>
              <span
                className={`px-1.5 py-0.2 rounded-md font-black text-[10.5px] ${
                  selectedIds.length === 8
                    ? 'bg-emerald-100 text-emerald-800'
                    : 'bg-amber-100 text-amber-800'
                }`}
              >
                {selectedIds.length} / 8 Ikon
              </span>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="text-[10px] font-black text-[#023246] hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Default</span>
            </button>
          </div>
        </div>

        {/* ── 2. SCROLLABLE BODY ────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
          {/* Pratinjau 8 Slot Dashboard (2 Baris x 4 Kolom) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider flex items-center gap-1">
                <Layers className="w-3 h-3 text-[#18536B]" />
                Pratinjau Dashboard (2 Baris × 4 Kolom)
              </span>
              <span className="text-[9.5px] font-bold text-slate-400">
                Tap ikon untuk hapus
              </span>
            </div>

            <div className="p-2.5 bg-slate-50/90 rounded-2xl border border-slate-200/90 grid grid-cols-4 gap-1.5">
              {Array.from({ length: 8 }).map((_, index) => {
                const iconId = selectedIds[index];
                const item = allowedIcons.find((i) => i.id === iconId);

                if (!item) {
                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center justify-center p-1.5 rounded-xl border border-dashed border-slate-300 min-h-14 text-slate-300"
                    >
                      <span className="text-[9.5px] font-bold">Slot {index + 1}</span>
                    </div>
                  );
                }

                const IconComponent = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleRemoveSlot(index)}
                    className="flex flex-col items-center justify-start text-center p-1 rounded-xl cursor-pointer hover:bg-white active:scale-95 transition-all group"
                    title={`Klik untuk menghapus ${item.title} dari Slot #${index + 1}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl bg-linear-to-b ${item.colorClass} text-white flex items-center justify-center shadow-2xs shrink-0 relative`}
                    >
                      <IconComponent className="w-4 h-4 stroke-[1.8]" />
                      <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-600 text-white rounded-full flex items-center justify-center text-[8.5px] font-black shadow-2xs border border-white">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-[9px] font-bold text-slate-800 group-hover:text-red-600 truncate w-full mt-0.5">
                      {item.title}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── MULTI-STEP NAVIGATION BAR (3 / 4 Card Per Halaman) ─────────── */}
          <div className="space-y-2 pt-1">
            {/* Step Pills & Title */}
            <div className="bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/80 space-y-1.5">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-1.5">
                  <span className="px-1.5 py-0.5 rounded-md bg-[#18536B] text-white text-[9.5px] font-black tracking-wide">
                    BAGIAN {currentStep.id} / {totalSteps}
                  </span>
                  <span className="text-xs font-black text-slate-800">
                    {currentStep.title}
                  </span>
                </div>
                <span className="text-[10px] font-bold text-slate-500">
                  {currentStepItems.length} Pilihan Card
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
                      className={`py-1 px-1 rounded-xl text-[10px] font-black flex items-center justify-center gap-0.5 transition-all cursor-pointer ${
                        isActive
                          ? 'bg-linear-to-r from-[#18536B] to-[#023246] text-white shadow-2xs ring-1 ring-[#18536B]'
                          : 'bg-white hover:bg-slate-200/70 text-slate-600 border border-slate-200/70'
                      }`}
                      title={`Ke Bagian ${st.id}: ${st.title}`}
                    >
                      <span>Hal {st.id}</span>
                      {selectedInStepCount > 0 && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isActive ? 'bg-amber-300' : 'bg-emerald-500'
                          }`}
                        />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Card List: Tepat 3 atau 4 Card Per Halaman (Anti-Sempit Infinix Note 8) */}
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
                    className={`w-full p-2.5 rounded-2xl border text-left flex items-center justify-between gap-3 transition-all cursor-pointer min-h-16 ${
                      isSelected
                        ? 'bg-emerald-50/90 border-emerald-300 shadow-xs ring-1 ring-emerald-300'
                        : 'bg-white hover:bg-slate-50 border-slate-200/90 active:scale-[0.99]'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl bg-linear-to-b ${item.colorClass} text-white flex items-center justify-center shrink-0 shadow-2xs`}
                      >
                        <IconComponent className="w-5 h-5 stroke-[1.8]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <p className="text-xs font-black text-slate-900 leading-tight truncate">
                            {item.title}
                          </p>
                          <span className="text-[9px] font-bold text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded-md shrink-0">
                            {item.category.split('&')[0].trim()}
                          </span>
                        </div>
                        <p className="text-[10px] text-slate-500 font-medium line-clamp-1 mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      </div>
                    </div>

                    <div className="shrink-0 flex items-center">
                      {isSelected ? (
                        <span className="px-2.5 py-1 rounded-xl bg-emerald-600 text-white text-[10.5px] font-black flex items-center gap-1 shadow-2xs">
                          <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                          <span>Slot #{selectedIndex + 1}</span>
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10.5px] font-bold border border-slate-200/80">
                          + Pasang
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Navigasi Prev / Next (Di Bawah 3/4 Card) */}
            <div className="flex items-center justify-between pt-1 gap-2">
              <Button
                type="button"
                variant="outline"
                disabled={currentStepIndex === 0}
                onClick={() => setCurrentStepIndex((prev) => Math.max(0, prev - 1))}
                className="flex-1 h-10 rounded-xl text-xs font-bold text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed border-slate-200 flex items-center justify-center gap-1"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </Button>

              <span className="text-[10.5px] font-black text-slate-500 shrink-0 px-1">
                Hal {currentStepIndex + 1} / {totalSteps}
              </span>

              {isLastStep ? (
                <Button
                  type="button"
                  variant="primary"
                  onClick={handleSave}
                  className="flex-1 h-10 rounded-xl text-xs font-black bg-linear-to-r from-emerald-600 to-teal-700 hover:brightness-110 text-white flex items-center justify-center gap-1 shadow-xs"
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
                  className="flex-1 h-10 rounded-xl text-xs font-black bg-linear-to-r from-[#18536B] to-[#023246] hover:brightness-110 text-white flex items-center justify-center gap-1 shadow-xs"
                >
                  <span>Lanjut</span>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── 3. STICKY FOOTER ──────────────────────────────────────────────── */}
        <div className="shrink-0 bg-slate-50 border-t border-slate-200/80 px-4 py-2.5 sm:py-3 flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 text-slate-600 hover:bg-slate-200/70 font-bold text-xs h-11 rounded-xl cursor-pointer"
            onClick={onClose}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="primary"
            className="flex-2 bg-linear-to-r from-[#18536B] to-[#023246] hover:brightness-110 active:scale-98 text-white font-black text-xs h-11 rounded-xl shadow-xs cursor-pointer flex items-center justify-center gap-1.5"
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

