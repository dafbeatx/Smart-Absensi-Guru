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
} from 'lucide-react';

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
    id: 'koreksi_soal',
    title: 'Koreksi Soal',
    category: 'Akademik & Nilai',
    description: 'Aplikasi koreksi lembar ujian & rekap nilai siswa (Link)',
    icon: ClipboardCheck,
    colorClass: 'from-[#18536B] to-[#023246]',
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
    id: 'kalender',
    title: 'Kalender Agenda',
    category: 'Akademik & Nilai',
    description: 'Kalender akademik sekolah, hari libur nasional, dan ujian',
    icon: CalendarDays,
    colorClass: 'from-amber-700 to-orange-900',
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
    id: 'materials',
    title: 'Bahan Ajar',
    category: 'Akademik & Nilai',
    description: 'Bank materi modul pembelajaran & referensi KBM',
    icon: BookOpen,
    colorClass: 'from-indigo-700 to-violet-900',
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
    id: 'location',
    title: 'Peta Lokasi',
    category: 'Presensi & Waktu',
    description: 'Pantau koordinat GPS gerbang sekolah dan radius presensi',
    icon: MapPin,
    colorClass: 'from-slate-700 to-slate-900',
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
];

export const DEFAULT_8_QUICK_ICONS = [
  'presensi',
  'izin_cuti',
  'jadwal',
  'rekap',
  'koreksi',
  'koreksi_soal',
  'direktori_siswa',
  'kalender',
];

interface CustomizeQuickIconsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentIconIds: string[];
  onSave: (newIconIds: string[]) => void;
}

export const CustomizeQuickIconsModal: React.FC<CustomizeQuickIconsModalProps> = ({
  isOpen,
  onClose,
  currentIconIds,
  onSave,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(
    currentIconIds.length === 8 ? currentIconIds : DEFAULT_8_QUICK_ICONS
  );

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(currentIconIds.length === 8 ? currentIconIds : DEFAULT_8_QUICK_ICONS);
    }
  }, [isOpen, currentIconIds]);

  const handleToggle = (id: string) => {
    if (selectedIds.includes(id)) {
      if (selectedIds.length <= 1) return; // minimal 1
      setSelectedIds(selectedIds.filter((item) => item !== id));
    } else {
      if (selectedIds.length >= 8) {
        // Ganti yang terakhir jika sudah 8
        setSelectedIds([...selectedIds.slice(0, 7), id]);
      } else {
        setSelectedIds([...selectedIds, id]);
      }
    }
  };

  const handleReset = () => {
    setSelectedIds(DEFAULT_8_QUICK_ICONS);
  };

  const handleSave = () => {
    // Pastikan tepat 8 item (jika kurang dari 8, lengkapi dengan default)
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

  const categories = Array.from(new Set(ALL_QUICK_ICONS.map((i) => i.category)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-fade-in">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-115 bg-white rounded-2xl sm:rounded-3xl shadow-2xl border border-slate-200/90 flex flex-col max-h-[85vh] sm:max-h-[88vh] overflow-hidden z-10 animate-scale-up">
        {/* ── 1. STICKY HEADER ──────────────────────────────────────────────── */}
        <div className="shrink-0 bg-white border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-8 h-8 rounded-xl bg-linear-to-br from-[#18536B] to-[#023246] text-white flex items-center justify-center shrink-0 shadow-2xs font-bold text-sm">
                <Settings2 className="w-4 h-4 text-amber-300" />
              </span>
              <div className="min-w-0">
                <h3 className="text-sm font-black text-slate-900 truncate leading-tight">
                  Kustomisasi Menu Utama Guru
                </h3>
                <p className="text-[10px] text-slate-500 font-bold truncate">
                  Pilih 8 ikon favorit untuk ditampilkan di dashboard
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

          {/* Slot Status Bar */}
          <div className="flex items-center justify-between mt-2.5 px-1 py-1.5 bg-slate-50 rounded-xl border border-slate-200/80 text-[11px]">
            <span className="font-extrabold text-slate-700">
              Slot Terpilih: <strong className="text-emerald-700">{selectedIds.length}</strong> / 8 Ikon
            </span>
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
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3.5">
          {/* Live Preview 8 Slot Terpilih (2 Baris x 4 Kolom) */}
          <div className="space-y-1.5">
            <span className="text-[10.5px] font-black text-slate-600 uppercase tracking-wider block px-0.5">
              Pratinjau Tampilan Dashboard (2 Baris x 4 Kolom)
            </span>
            <div className="p-3 bg-slate-50/80 rounded-2xl border border-slate-200/90 grid grid-cols-4 gap-2">
              {Array.from({ length: 8 }).map((_, index) => {
                const iconId = selectedIds[index];
                const item = ALL_QUICK_ICONS.find((i) => i.id === iconId);

                if (!item) {
                  return (
                    <div
                      key={index}
                      className="flex flex-col items-center justify-center p-2 rounded-xl border border-dashed border-slate-300 min-h-16 text-slate-300"
                    >
                      <span className="text-xs font-bold">Slot {index + 1}</span>
                    </div>
                  );
                }

                const IconComponent = item.icon;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleToggle(item.id)}
                    className="flex flex-col items-center justify-start text-center p-1 rounded-xl cursor-pointer hover:bg-white transition-all group"
                    title="Klik untuk menghapus dari slot"
                  >
                    <div
                      className={`w-10 h-10 rounded-xl bg-linear-to-b ${item.colorClass} text-white flex items-center justify-center shadow-xs shrink-0 relative`}
                    >
                      <IconComponent className="w-5 h-5 stroke-[1.8]" />
                      <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white rounded-full flex items-center justify-center text-[9px] font-black shadow-2xs border border-white">
                        {index + 1}
                      </span>
                    </div>
                    <span className="text-[9.5px] font-bold text-slate-800 group-hover:text-emerald-700 truncate w-full mt-1">
                      {item.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Daftar Katalog Semua Fitur (Berdasarkan Kategori) */}
          <div className="space-y-3 pt-1">
            <span className="text-[10.5px] font-black text-slate-600 uppercase tracking-wider block px-0.5">
              Pilih dari Seluruh Fitur Sistem:
            </span>

            {categories.map((cat) => (
              <div key={cat} className="space-y-1.5">
                <p className="text-[11px] font-black text-slate-800 px-0.5 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-600" />
                  <span>{cat}</span>
                </p>

                <div className="space-y-1">
                  {ALL_QUICK_ICONS.filter((i) => i.category === cat).map((item) => {
                    const isSelected = selectedIds.includes(item.id);
                    const selectedIndex = selectedIds.indexOf(item.id);
                    const IconComponent = item.icon;

                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => handleToggle(item.id)}
                        className={`w-full p-2 rounded-xl border text-left flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-emerald-50/90 border-emerald-300 shadow-2xs'
                            : 'bg-white hover:bg-slate-50 border-slate-200/80'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1">
                          <div
                            className={`w-8 h-8 rounded-xl bg-linear-to-b ${item.colorClass} text-white flex items-center justify-center shrink-0 shadow-2xs`}
                          >
                            <IconComponent className="w-4 h-4 stroke-[1.8]" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-black text-slate-900 leading-tight truncate">
                              {item.title}
                            </p>
                            <p className="text-[9.5px] text-slate-500 font-medium truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>

                        <div className="shrink-0 flex items-center gap-1.5">
                          {isSelected ? (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-600 text-white text-[10px] font-black flex items-center gap-1 shadow-2xs">
                              <Check className="w-3 h-3" />
                              <span>Slot #{selectedIndex + 1}</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-[10px] font-bold border border-slate-200">
                              + Tambah
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
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
