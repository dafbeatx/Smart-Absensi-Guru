/**
 * SMART ABSENSI GURU - ADMINISTRATION MODULES & ACADEMIC YEAR TYPES
 */

export type AdministrationCategory =
  | 'UJIAN'
  | 'PERANGKAT_AJAR'
  | 'KESISWAAN'
  | 'AGENDA_REKAP'
  | 'CUSTOM';

export interface AdministrationModuleItem {
  id: string;
  title: string;
  category: AdministrationCategory;
  description: string;
  icon: string; // Emoji or Lucide icon identifier
  colorClass: string;
  badge?: string;
  actionId: string;
  customUrl?: string;
  isEnabled: boolean;
  order: number;
}

export interface AcademicYearOption {
  year: string; // e.g. '2026/2027'
  label: string;
  isActive: boolean;
}

export type SemesterType = 'GANJIL' | 'GENAP';

export interface AdministrationSettings {
  activeAcademicYear: string;
  activeSemester: SemesterType;
  enabledModuleIds: string[];
  customModules: AdministrationModuleItem[];
  updatedAt: string;
}

export const AVAILABLE_ACADEMIC_YEARS: AcademicYearOption[] = [
  { year: '2026/2027', label: '2026/2027 (Tahun Aktif)', isActive: true },
  { year: '2025/2026', label: '2025/2026 (Arsip)', isActive: false },
  { year: '2024/2025', label: '2024/2025 (Arsip)', isActive: false },
  { year: '2027/2028', label: '2027/2028 (Mendatang)', isActive: false },
];

export const DEFAULT_ADMINISTRATION_MODULES: AdministrationModuleItem[] = [
  // --- KATEGORI: UJIAN & EVALUASI ---
  {
    id: 'exam_correction',
    title: 'Koreksi Lembar Ujian',
    category: 'UJIAN',
    description: 'Aplikasi koreksi otomatis & manual lembar jawaban ujian siswa',
    icon: '📝',
    colorClass: 'from-[#023246] to-[#18536B]',
    badge: 'Ujian',
    actionId: 'koreksi_soal',
    isEnabled: true,
    order: 1,
  },
  {
    id: 'exam_cards',
    title: 'Cetak Kartu Ujian & Barcode',
    category: 'UJIAN',
    description: 'Generator kartu peserta ujian dan barcode NISN siswa otomatis (A4)',
    icon: '🏷️',
    colorClass: 'from-amber-600 to-yellow-800',
    badge: 'Format A4',
    actionId: 'exam_card',
    isEnabled: true,
    order: 2,
  },
  {
    id: 'exam_schedule',
    title: 'Jadwal & Agenda Ujian',
    category: 'UJIAN',
    description: 'Jadwal pelaksanaan PTS, PAS, dan asesmen sumatif semester',
    icon: '📋',
    colorClass: 'from-rose-700 to-red-900',
    actionId: 'exam_schedule',
    isEnabled: true,
    order: 3,
  },

  // --- KATEGORI: PERANGKAT AJAR & KBM ---
  {
    id: 'teaching_materials',
    title: 'Modul & Bahan Ajar KBM',
    category: 'PERANGKAT_AJAR',
    description: 'Bank materi pembelajaran, modul ajar, RPP, dan silabus kurikulum',
    icon: '📚',
    colorClass: 'from-indigo-700 to-violet-900',
    badge: 'RPP/Modul',
    actionId: 'materials',
    isEnabled: true,
    order: 4,
  },
  {
    id: 'teaching_schedule',
    title: 'Jadwal Mengajar KBM',
    category: 'PERANGKAT_AJAR',
    description: 'Distribusi jam mengajar guru per kelas dan ruang rombel',
    icon: '🗓️',
    colorClass: 'from-cyan-700 to-blue-900',
    actionId: 'jadwal',
    isEnabled: true,
    order: 5,
  },

  // --- KATEGORI: KESISWAAN & KELAS ---
  {
    id: 'classrooms',
    title: 'Ruang Kelas & Data Rombel',
    category: 'KESISWAAN',
    description: 'Struktur rombongan belajar, wali kelas, dan inventaris ruang kelas',
    icon: '🏫',
    colorClass: 'from-teal-700 to-emerald-900',
    actionId: 'classroom',
    isEnabled: true,
    order: 6,
  },
  {
    id: 'student_directory',
    title: 'Buku Induk & Direktori Siswa',
    category: 'KESISWAAN',
    description: 'Data master siswa, NISN, kontak orang tua/wali, dan kartu RFID',
    icon: '🎓',
    colorClass: 'from-blue-700 to-indigo-900',
    actionId: 'direktori_siswa',
    isEnabled: true,
    order: 7,
  },
  {
    id: 'homeroom_studies',
    title: 'Ruang Wali Kelas (Studi Lanjut)',
    category: 'KESISWAAN',
    description: 'Pemantauan dan verifikasi rencana studi siswa kelas 9',
    icon: '🎯',
    colorClass: 'from-purple-700 to-indigo-900',
    badge: 'Kelas 9',
    actionId: 'homeroom_plan',
    isEnabled: true,
    order: 8,
  },

  // --- KATEGORI: AGENDA & REKAP ---
  {
    id: 'academic_calendar',
    title: 'Kalender Akademik Sekolah',
    category: 'AGENDA_REKAP',
    description: 'Agenda tahunan, hari efektif belajar, libur nasional, dan cuti bersama',
    icon: '📅',
    colorClass: 'from-amber-700 to-orange-900',
    actionId: 'kalender',
    isEnabled: true,
    order: 9,
  },
  {
    id: 'attendance_recap',
    title: 'Rekapitulasi Kehadiran & Jam Kerja',
    category: 'AGENDA_REKAP',
    description: 'Laporan rekapitulasi presensi, ketepatan waktu, dan total jam mengajar',
    icon: '📊',
    colorClass: 'from-[#023246] to-[#287094]',
    actionId: 'rekap',
    isEnabled: true,
    order: 10,
  },
];
