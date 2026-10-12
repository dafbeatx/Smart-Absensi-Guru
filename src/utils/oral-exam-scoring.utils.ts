/**
 * SMART ABSENSI GURU - ORAL EXAM SCORING UTILITY
 * Berisi kalkulator skor, konversi checklist ke skala 100, dan pemetaan predikat resmi A/B/C/D.
 */

import type {
  OralExamGrade,
  OralExamStudentRecord,
} from '../types/oral-exam.types';

/**
 * Menghitung predikat untuk nilai angka langsung (BTQ & Hafalan)
 * Rentang Kriteria:
 * - 91 - 100: A (Sangat Baik)
 * - 81 - 90:  B (Baik)
 * - 61 - 80:  C (Cukup)
 * - 0 - 60:   D (Perlu Bimbingan)
 */
export function calculateDirectScorePredicate(score: number | null | undefined): OralExamGrade | null {
  if (score === null || score === undefined || isNaN(score)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 91) return 'A';
  if (clamped >= 81) return 'B';
  if (clamped >= 61) return 'C';
  return 'D';
}

/**
 * Menghitung skor dan predikat dari array checklist butir soal lisan (Bahasa Inggris & Arab)
 * Rentang Kriteria (Berdasarkan 15 Soal):
 * - 14 - 15 Benar: A (Sangat Baik)
 * - 11 - 13 Benar: B (Baik)
 * - 6 - 10 Benar:  C (Cukup)
 * - 0 - 5 Benar:   D (Perlu Bimbingan)
 *
 * Konversi Skor: (Jumlah Benar / Total Soal) * 100 (Dibulatkan ke integer terdekat)
 */
export function calculateChecklistScoreAndPredicate(
  checklist: boolean[] | undefined,
  totalQuestions = 15
): {
  correctCount: number;
  score: number;
  predicate: OralExamGrade;
} {
  const safeChecklist = checklist || [];
  const correctCount = safeChecklist.filter(Boolean).length;
  const safeTotal = totalQuestions > 0 ? totalQuestions : 15;
  const score = Math.round((correctCount / safeTotal) * 100);

  let predicate: OralExamGrade = 'D';
  if (correctCount >= 14) {
    predicate = 'A';
  } else if (correctCount >= 11) {
    predicate = 'B';
  } else if (correctCount >= 6) {
    predicate = 'C';
  } else {
    predicate = 'D';
  }

  return {
    correctCount,
    score: Math.min(100, Math.max(0, score)),
    predicate,
  };
}

/**
 * Helper pewarnaan badge predikat (sesuai tema aplikasi & anti-slop design system)
 */
export function getOralExamPredicateBadgeStyle(grade: OralExamGrade | null | undefined): {
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeLabel: string;
} {
  switch (grade) {
    case 'A':
      return {
        bgClass: 'bg-emerald-50',
        textClass: 'text-emerald-800',
        borderClass: 'border-emerald-300',
        badgeLabel: 'A (Sangat Baik)',
      };
    case 'B':
      return {
        bgClass: 'bg-blue-50',
        textClass: 'text-blue-800',
        borderClass: 'border-blue-300',
        badgeLabel: 'B (Baik)',
      };
    case 'C':
      return {
        bgClass: 'bg-amber-50',
        textClass: 'text-amber-800',
        borderClass: 'border-amber-300',
        badgeLabel: 'C (Cukup)',
      };
    case 'D':
      return {
        bgClass: 'bg-rose-50',
        textClass: 'text-rose-800',
        borderClass: 'border-rose-300',
        badgeLabel: 'D (Perlu Bimbingan)',
      };
    default:
      return {
        bgClass: 'bg-slate-100',
        textClass: 'text-slate-500',
        borderClass: 'border-slate-200',
        badgeLabel: '-',
      };
  }
}

/**
 * Menghitung ringkasan statistik sesi ujian lisan (rata-rata, persentase kelulusan/kategori)
 */
export function calculateOralExamSummaryStats(
  students: OralExamStudentRecord[],
  isChecklistMode: boolean
) {
  const totalStudents = students.length;
  if (totalStudents === 0) {
    return {
      totalStudents: 0,
      completedStudents: 0,
      averageScore1: 0,
      averageScore2: 0,
      gradeDistribution: { A: 0, B: 0, C: 0, D: 0 },
    };
  }

  let completedStudents = 0;
  let totalScore1 = 0;
  let countScore1 = 0;
  let totalScore2 = 0;
  let countScore2 = 0;
  const gradeDistribution: Record<OralExamGrade, number> = { A: 0, B: 0, C: 0, D: 0 };

  for (const s of students) {
    if (isChecklistMode) {
      if (s.englishScore !== undefined || s.arabicScore !== undefined) {
        completedStudents++;
      }
      if (s.englishScore !== undefined) {
        totalScore1 += s.englishScore;
        countScore1++;
      }
      if (s.arabicScore !== undefined) {
        totalScore2 += s.arabicScore;
        countScore2++;
      }
      if (s.englishPredicate) gradeDistribution[s.englishPredicate]++;
      if (s.arabicPredicate) gradeDistribution[s.arabicPredicate]++;
    } else {
      if (s.btqScore !== null && s.btqScore !== undefined) {
        completedStudents++;
        totalScore1 += s.btqScore;
        countScore1++;
        if (s.btqPredicate) gradeDistribution[s.btqPredicate]++;
      }
      if (s.hafalanScore !== null && s.hafalanScore !== undefined) {
        totalScore2 += s.hafalanScore;
        countScore2++;
        if (s.hafalanPredicate) gradeDistribution[s.hafalanPredicate]++;
      }
    }
  }

  return {
    totalStudents,
    completedStudents,
    averageScore1: countScore1 > 0 ? Math.round(totalScore1 / countScore1) : 0,
    averageScore2: countScore2 > 0 ? Math.round(totalScore2 / countScore2) : 0,
    gradeDistribution,
  };
}
