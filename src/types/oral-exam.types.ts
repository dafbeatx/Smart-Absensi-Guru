/**
 * SMART ABSENSI GURU - ORAL EXAM (UJIAN LISAN) TYPES
 * Mendukung 2 Format Standar Resmi:
 * 1. BTQ & Hafalan (Model Nilai Langsung 0-100 & Predikat A/B/C/D)
 * 2. Bahasa Inggris & Bahasa Arab (Model Checklist 15 Butir Soal Lisan & Konversi Nilai)
 */

export type OralExamTemplateType = 'BTQ_HAFALAN' | 'BAHASA_INGGRIS_ARAB' | 'CUSTOM';

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

  // --- Format Model 1: BTQ & Hafalan (Nilai Langsung) ---
  btqScore?: number | null;
  btqPredicate?: OralExamGrade | null;
  hafalanScore?: number | null;
  hafalanPredicate?: OralExamGrade | null;

  // --- Format Model 2: Bahasa Inggris & Bahasa Arab (Checklist 15 Butir Soal) ---
  englishChecklist?: boolean[]; // Array boolean 15 elemen
  englishCorrectCount?: number;
  englishScore?: number; // Konversi ke skala 0-100
  englishPredicate?: OralExamGrade | null;

  arabicChecklist?: boolean[]; // Array boolean 15 elemen
  arabicCorrectCount?: number;
  arabicScore?: number; // Konversi ke skala 0-100
  arabicPredicate?: OralExamGrade | null;

  notes?: string;
}

export interface OralExamSession {
  id: string;
  templateType: OralExamTemplateType;
  title: string;
  academicYear: string; // e.g. '2026/2027'
  semester: 'GANJIL' | 'GENAP';
  examinerName: string; // e.g. 'Ibu Mira Nurdianti, S.Pd' / 'Ibu Septi Nur Aeni, S.E'
  roomNumber?: string; // e.g. 'Ruang 01'
  className: string; // e.g. '7A', '7B', '8A', '9A'
  date: string; // YYYY-MM-DD
  totalQuestions: number; // Default 15 untuk model bahasa
  students: OralExamStudentRecord[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Kriteria Standar Penilaian BTQ & Hafalan (Berdasarkan Dokumen Fisik Resmi):
 * A: 91 - 100 (Sangat Baik)
 * B: 81 - 90 (Baik)
 * C: 61 - 80 (Cukup)
 * D: 0 - 60 (Perlu Bimbingan)
 */
export const KRITERIA_BTQ_HAFALAN: OralExamGradeKriteria[] = [
  { grade: 'A', min: 91, max: 100, label: 'Sangat Baik', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { grade: 'B', min: 81, max: 90, label: 'Baik', colorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  { grade: 'C', min: 61, max: 80, label: 'Cukup', colorClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  { grade: 'D', min: 0, max: 60, label: 'Perlu Bimbingan', colorClass: 'bg-rose-100 text-rose-800 border-rose-300' },
];

/**
 * Kriteria Standar Penilaian Ujian Lisan Bahasa (Berdasarkan 15 Soal Benar):
 * A: 14 - 15 jawaban benar (Sangat Baik)
 * B: 11 - 13 jawaban benar (Baik)
 * C: 6 - 10 jawaban benar (Cukup - Minimal 6 jawaban benar)
 * D: 0 - 5 jawaban benar (Perlu Bimbingan)
 */
export const KRITERIA_BAHASA_CHECKLIST: OralExamGradeKriteria[] = [
  { grade: 'A', min: 14, max: 15, label: 'Sangat Baik (14-15 Benar)', colorClass: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  { grade: 'B', min: 11, max: 13, label: 'Baik (11-13 Benar)', colorClass: 'bg-blue-100 text-blue-800 border-blue-300' },
  { grade: 'C', min: 6, max: 10, label: 'Cukup (6-10 Benar)', colorClass: 'bg-amber-100 text-amber-800 border-amber-300' },
  { grade: 'D', min: 0, max: 5, label: 'Perlu Bimbingan (0-5 Benar)', colorClass: 'bg-rose-100 text-rose-800 border-rose-300' },
];
