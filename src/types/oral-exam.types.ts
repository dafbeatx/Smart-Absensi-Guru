/**
 * SMART ABSENSI GURU - ORAL EXAM (UJIAN LISAN) TYPES
 * Mendukung 2 Jalur Penilaian Lisan Resmi Berbasis 3 Kriteria Langsung (Skala 0-100 & Predikat A/B/C/D):
 * 1. Ujian Bahasa (Bahasa Inggris & Bahasa Arab — 3 Kriteria: Pelafalan, Kelancaran, Pemahaman & Kosakata)
 * 2. Ujian BTQ & Hafalan (3 Kriteria: Tajwid & Makhraj, Kelancaran Bacaan, Hafalan & Adab)
 */

export const ORAL_EXAM_SCHEDULE_START = '2026-11-30';
export const ORAL_EXAM_SCHEDULE_END = '2026-12-04';
export const ORAL_EXAM_SCHEDULE_LABEL = '30 November – 04 Desember 2026';

export interface OralExamScheduleDay {
  dayNumber: number;
  dayName: string;
  shortLabel: string;
  date: string; // YYYY-MM-DD
}

export const ORAL_EXAM_SCHEDULE_DAYS: OralExamScheduleDay[] = [
  { dayNumber: 1, dayName: 'Senin', shortLabel: 'Sen, 30 Nov', date: '2026-11-30' },
  { dayNumber: 2, dayName: 'Selasa', shortLabel: 'Sel, 01 Des', date: '2026-12-01' },
  { dayNumber: 3, dayName: 'Rabu', shortLabel: 'Rab, 02 Des', date: '2026-12-02' },
  { dayNumber: 4, dayName: 'Kamis', shortLabel: 'Kam, 03 Des', date: '2026-12-03' },
  { dayNumber: 5, dayName: 'Jumat', shortLabel: 'Jum, 04 Des', date: '2026-12-04' },
];

export type OralExamTemplateType = 'BTQ_HAFALAN' | 'BAHASA_INGGRIS_ARAB' | 'CUSTOM';

export type OralExamTrack = 'BAHASA' | 'BTQ';

export type OralExamSubjectScope =
  | 'BOTH'
  | 'ENGLISH_ONLY'
  | 'ARABIC_ONLY'
  | 'BTQ_ONLY'
  | 'HAFALAN_ONLY';

export type OralExamBahasaScope = 'ENGLISH_ONLY' | 'ARABIC_ONLY' | 'BOTH';
export type OralExamBtqScope = 'BTQ_ONLY' | 'HAFALAN_ONLY' | 'BOTH';

export type OralExamCriteriaLabels = [string, string, string];
export type OralExamCriteriaScores = [number | null, number | null, number | null];

export type OralExamCriteriaScoreField =
  | 'englishCriteria'
  | 'arabicCriteria'
  | 'btqCriteria'
  | 'hafalanCriteria';

export type OralExamSubjectScoreKey = 'english' | 'arabic' | 'btq' | 'hafalan';

export const DEFAULT_BAHASA_CRITERIA: OralExamCriteriaLabels = [
  'Pelafalan',
  'Kelancaran',
  'Pemahaman & Kosakata',
];

export const DEFAULT_BAHASA_CRITERIA_HELPERS: OralExamCriteriaLabels = [
  'Ketepatan pengucapan / pronunciation / makhraj kata',
  'Alur berbicara, intonasi & kepercayaan diri menjawab',
  'Pemahaman pertanyaan & ketepatan pilihan kosakata',
];

export const DEFAULT_BTQ_CRITERIA: OralExamCriteriaLabels = [
  'Tajwid & Makhraj',
  'Kelancaran Bacaan',
  'Hafalan & Adab',
];

export const DEFAULT_BTQ_CRITERIA_HELPERS: OralExamCriteriaLabels = [
  'Kaidah hukum tajwid & ketepatan tempat keluarnya huruf',
  'Kefasihan membaca ayat, panjang-pendek (mad) & waqaf',
  'Ketepatan hafalan surat/doa serta adab saat mengaji',
];

export interface OralExamAssignmentStudent {
  studentId: string;
  studentName: string;
  nisn?: string;
  className?: string;
}

export interface OralExamAssignment {
  id: string;
  examinerUserId?: string | null;
  examinerName: string;
  examinerNpp?: string | null;
  roomNumber: string;
  className: string;
  examTracks: OralExamTrack[];
  bahasaScope: OralExamBahasaScope;
  btqScope: OralExamBtqScope;
  bahasaCriteria?: OralExamCriteriaLabels;
  btqCriteria?: OralExamCriteriaLabels;
  students: OralExamAssignmentStudent[];
  academicYear?: string;
  isActive: boolean;
  updatedAt: string;
}

export type OralExamGrade = 'A' | 'B' | 'C' | 'D';

export interface OralExamGradeKriteria {
  grade: OralExamGrade;
  min: number;
  max: number;
  label: string;
  colorClass: string;
}

export interface OralExamStudentRecord {
  studentId: string;
  studentName: string;
  nisn?: string;
  className?: string;

  // --- Jalur BTQ & Hafalan (3 Kriteria Langsung 0-100 & Rata-rata Nilai Akhir) ---
  btqCriteria?: OralExamCriteriaScores;
  btqScore?: number | null;
  btqPredicate?: OralExamGrade | null;
  hafalanCriteria?: OralExamCriteriaScores;
  hafalanScore?: number | null;
  hafalanPredicate?: OralExamGrade | null;

  // --- Jalur Bahasa Inggris & Bahasa Arab (3 Kriteria Langsung 0-100 & Rata-rata Nilai Akhir) ---
  englishCriteria?: OralExamCriteriaScores;
  englishScore?: number | null; // Rata-rata 3 kriteria pada skala 0-100 (null jika belum dinilai)
  englishPredicate?: OralExamGrade | null;
  englishAssessed?: boolean;

  arabicCriteria?: OralExamCriteriaScores;
  arabicScore?: number | null; // Rata-rata 3 kriteria pada skala 0-100 (null jika belum dinilai)
  arabicPredicate?: OralExamGrade | null;
  arabicAssessed?: boolean;

  /** @deprecated Legacy 15-soal checklist read-compatibility only */
  englishChecklist?: boolean[];
  /** @deprecated Legacy 15-soal count read-compatibility only */
  englishCorrectCount?: number | null;
  /** @deprecated Legacy 15-soal checklist read-compatibility only */
  arabicChecklist?: boolean[];
  /** @deprecated Legacy 15-soal count read-compatibility only */
  arabicCorrectCount?: number | null;

  notes?: string;
}

export interface OralExamSession {
  id: string;
  templateType: OralExamTemplateType;
  subjectScope?: OralExamSubjectScope;
  criteriaLabels?: OralExamCriteriaLabels;
  groupId?: string | null;
  title: string;
  academicYear: string; // e.g. '2026/2027'
  semester: 'GANJIL' | 'GENAP';
  examinerUserId?: string | null;
  examinerName: string; // e.g. 'Ibu Mira Nurdianti, S.Pd' / 'Ibu Septi Nur Aeni, S.E'
  examinerNpp?: string | null;
  roomNumber?: string; // e.g. 'Ruang 01'
  className: string; // e.g. '7A', '7B', '8A', '9A', 'SMA'
  date: string; // YYYY-MM-DD
  totalQuestions: number; // Default 3 (3 kriteria penilaian langsung); kompatibel dengan sesi lama
  students: OralExamStudentRecord[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Mengelompokkan sesi menjadi dua kategori terpisah: Ujian Bahasa vs Ujian BTQ & Hafalan.
 */
export function getOralExamSessionTrack(
  templateOrSession: OralExamTemplateType | Pick<OralExamSession, 'templateType'>
): OralExamTrack {
  const tpl = typeof templateOrSession === 'string' ? templateOrSession : templateOrSession.templateType;
  return tpl === 'BAHASA_INGGRIS_ARAB' ? 'BAHASA' : 'BTQ';
}

/**
 * Mengembalikan 3 nama kriteria bawaan untuk jalur Bahasa atau BTQ.
 */
export function getDefaultCriteriaLabels(
  trackOrTemplate: OralExamTrack | OralExamTemplateType
): OralExamCriteriaLabels {
  const isBahasa = trackOrTemplate === 'BAHASA' || trackOrTemplate === 'BAHASA_INGGRIS_ARAB';
  return isBahasa ? [...DEFAULT_BAHASA_CRITERIA] : [...DEFAULT_BTQ_CRITERIA];
}

/**
 * Mengembalikan 3 deskripsi panduan kriteria bawaan untuk membantu penguji.
 */
export function getDefaultCriteriaHelpers(
  trackOrTemplate: OralExamTrack | OralExamTemplateType
): OralExamCriteriaLabels {
  const isBahasa = trackOrTemplate === 'BAHASA' || trackOrTemplate === 'BAHASA_INGGRIS_ARAB';
  return isBahasa ? [...DEFAULT_BAHASA_CRITERIA_HELPERS] : [...DEFAULT_BTQ_CRITERIA_HELPERS];
}

/**
 * Menormalkan 3 label kriteria (mengisi fallback bawaan jika kosong/kurang dari 3).
 */
export function resolveCriteriaLabels(
  customLabels: ReadonlyArray<string | null | undefined> | null | undefined,
  trackOrTemplate: OralExamTrack | OralExamTemplateType
): OralExamCriteriaLabels {
  const defaults = getDefaultCriteriaLabels(trackOrTemplate);
  if (!Array.isArray(customLabels)) return defaults;
  return [
    String(customLabels[0] || '').trim() || defaults[0],
    String(customLabels[1] || '').trim() || defaults[1],
    String(customLabels[2] || '').trim() || defaults[2],
  ];
}

/**
 * Menormalkan cakupan mata uji aktif dari sesi ujian lisan.
 */
export function getEffectiveSubjectScope(
  session: Pick<OralExamSession, 'templateType' | 'subjectScope'>
): OralExamSubjectScope {
  if (session.templateType === 'BAHASA_INGGRIS_ARAB') {
    if (session.subjectScope === 'ENGLISH_ONLY' || session.subjectScope === 'ARABIC_ONLY') {
      return session.subjectScope;
    }
    return 'BOTH';
  }
  if (session.subjectScope === 'BTQ_ONLY' || session.subjectScope === 'HAFALAN_ONLY') {
    return session.subjectScope;
  }
  return 'BOTH';
}

/**
 * Kriteria Standar Nilai Akhir & Predikat Ujian Lisan (3 Kriteria Skala 0 - 100):
 * A: 91 - 100 (Sangat Baik)
 * B: 81 - 90  (Baik)
 * C: 61 - 80  (Cukup)
 * D: 0 - 60   (Perlu Bimbingan)
 */
export const KRITERIA_PENILAIAN_LISAN: OralExamGradeKriteria[] = [
  { grade: 'A', min: 91, max: 100, label: 'Sangat Baik', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { grade: 'B', min: 81, max: 90, label: 'Baik', colorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  { grade: 'C', min: 61, max: 80, label: 'Cukup', colorClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  { grade: 'D', min: 0, max: 60, label: 'Perlu Bimbingan', colorClass: 'bg-rose-100 text-rose-800 border-rose-300' },
];

export const KRITERIA_BTQ_HAFALAN: OralExamGradeKriteria[] = KRITERIA_PENILAIAN_LISAN;
