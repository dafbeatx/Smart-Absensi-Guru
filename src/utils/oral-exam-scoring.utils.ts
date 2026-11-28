/**
 * SMART ABSENSI GURU - ORAL EXAM SCORING UTILITY
 * Kalkulator penilaian ujian lisan berbasis 3 kriteria (skala 0-100),
 * perhitungan rata-rata otomatis menjadi Nilai Akhir, dan pemetaan predikat resmi A/B/C/D.
 */

import {
  getEffectiveSubjectScope,
  ORAL_EXAM_SCHEDULE_DAYS,
  ORAL_EXAM_SCHEDULE_END,
  ORAL_EXAM_SCHEDULE_LABEL,
  ORAL_EXAM_SCHEDULE_START,
  type OralExamCriteriaScores,
  type OralExamGrade,
  type OralExamStudentRecord,
  type OralExamSubjectScope,
  type OralExamTemplateType,
} from '../types/oral-exam.types';
import { getTodayDateInJakarta } from './time.utils';

/**
 * Menghitung predikat untuk nilai akhir skala 0 - 100
 * Rentang Kriteria:
 * - 91 - 100: A (Sangat Baik)
 * - 81 - 90:  B (Baik)
 * - 61 - 80:  C (Cukup)
 * - 0 - 60:   D (Perlu Bimbingan)
 */
export function calculateDirectScorePredicate(score: number | null | undefined): OralExamGrade | null {
  if (score === null || score === undefined || Number.isNaN(score) || !Number.isFinite(score)) {
    return null;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  if (clamped >= 91) return 'A';
  if (clamped >= 81) return 'B';
  if (clamped >= 61) return 'C';
  return 'D';
}

/**
 * Menormalkan array nilai 3 kriteria menjadi tuple tetap [K1, K2, K3] bernilai 0-100 atau null.
 */
export function normalizeCriteriaScores(
  criteria: ReadonlyArray<number | null | undefined> | null | undefined
): OralExamCriteriaScores {
  const out: OralExamCriteriaScores = [null, null, null];
  if (!Array.isArray(criteria)) return out;
  for (let i = 0; i < 3; i++) {
    const val = criteria[i];
    if (typeof val === 'number' && !Number.isNaN(val) && Number.isFinite(val)) {
      out[i] = Math.round(Math.max(0, Math.min(100, val)) * 100) / 100;
    }
  }
  return out;
}

/**
 * Menghitung rata-rata Nilai Akhir & Predikat (A/B/C/D) dari 3 kriteria penilaian langsung.
 * Nilai Akhir dibulatkan ke bilangan bulat 0-100 dari kriteria yang telah terisi,
 * sedangkan status lengkap (`isComplete`) bernilai true bila ketiga kriteria terisi.
 */
export function calculateCriteriaAverageAndPredicate(
  criteria: ReadonlyArray<number | null | undefined> | null | undefined
): {
  scores: OralExamCriteriaScores;
  filledCount: number;
  isComplete: boolean;
  averageScore: number | null;
  predicate: OralExamGrade | null;
} {
  const scores = normalizeCriteriaScores(criteria);
  const filledValues = scores.filter((v): v is number => v !== null);
  const filledCount = filledValues.length;
  const isComplete = filledCount === 3;

  if (filledCount === 0) {
    return {
      scores,
      filledCount: 0,
      isComplete: false,
      averageScore: null,
      predicate: null,
    };
  }

  const sum = filledValues.reduce((acc, v) => acc + v, 0);
  const averageScore = Math.round(sum / filledCount);
  const predicate = calculateDirectScorePredicate(averageScore);

  return {
    scores,
    filledCount,
    isComplete,
    averageScore,
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
 * Memeriksa apakah 1 mata uji (Inggris/Arab/BTQ/Hafalan) sudah selesai dinilai:
 * - Jika menggunakan input 3 kriteria (minimal 1 kriteria diisi): lengkap hanya jika ketiga kriteria diisi.
 * - Jika data lama (belum memiliki rincian kriteria): memakai kompatibilitas mundur nilai langsung / flag assessed.
 */
export function isOralSubjectAssessed(
  score: number | null | undefined,
  criteria: ReadonlyArray<number | null | undefined> | undefined,
  legacyChecklist?: boolean[],
  legacyAssessedFlag?: boolean,
  allowLegacyZeroWithoutFlag = true
): boolean {
  const calc = calculateCriteriaAverageAndPredicate(criteria);
  if (calc.filledCount > 0) {
    return calc.isComplete;
  }

  if (legacyAssessedFlag === false) return false;
  if (score === null || score === undefined || Number.isNaN(score)) return false;
  if (legacyAssessedFlag === true) return true;
  if (allowLegacyZeroWithoutFlag) return true;
  if (score > 0) return true;
  return Boolean(legacyChecklist && legacyChecklist.some(Boolean));
}

/**
 * Memeriksa apakah siswa sudah dinilai sesuai template dan cakupan mata uji sesi.
 */
export function isStudentOralExamCompleted(
  student: OralExamStudentRecord,
  templateType: OralExamTemplateType,
  subjectScope?: OralExamSubjectScope
): boolean {
  const scope = getEffectiveSubjectScope({ templateType, subjectScope });
  if (templateType === 'BAHASA_INGGRIS_ARAB') {
    const checkEng = scope !== 'ARABIC_ONLY';
    const checkAra = scope !== 'ENGLISH_ONLY';
    const engDone =
      checkEng &&
      isOralSubjectAssessed(
        student.englishScore,
        student.englishCriteria,
        student.englishChecklist,
        student.englishAssessed,
        false
      );
    const araDone =
      checkAra &&
      isOralSubjectAssessed(
        student.arabicScore,
        student.arabicCriteria,
        student.arabicChecklist,
        student.arabicAssessed,
        false
      );
    if (scope === 'ENGLISH_ONLY') return engDone;
    if (scope === 'ARABIC_ONLY') return araDone;
    return engDone || araDone;
  }

  const checkBtq = scope !== 'HAFALAN_ONLY';
  const checkHaf = scope !== 'BTQ_ONLY';
  const hasBtq =
    checkBtq &&
    isOralSubjectAssessed(student.btqScore, student.btqCriteria, undefined, undefined, true);
  const hasHaf =
    checkHaf &&
    isOralSubjectAssessed(student.hafalanScore, student.hafalanCriteria, undefined, undefined, true);
  if (scope === 'BTQ_ONLY') return hasBtq;
  if (scope === 'HAFALAN_ONLY') return hasHaf;
  return hasBtq || hasHaf;
}

/**
 * Menghitung ringkasan statistik sesi ujian lisan (rata-rata & distribusi predikat A/B/C/D).
 */
export function calculateOralExamSummaryStats(
  students: OralExamStudentRecord[],
  isBahasaTemplate: boolean,
  subjectScope: OralExamSubjectScope = 'BOTH'
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

  const includeFirst = isBahasaTemplate ? subjectScope !== 'ARABIC_ONLY' : subjectScope !== 'HAFALAN_ONLY';
  const includeSecond = isBahasaTemplate ? subjectScope !== 'ENGLISH_ONLY' : subjectScope !== 'BTQ_ONLY';

  for (const s of students) {
    if (isBahasaTemplate) {
      const engDone =
        includeFirst &&
        isOralSubjectAssessed(s.englishScore, s.englishCriteria, s.englishChecklist, s.englishAssessed, false);
      const arabDone =
        includeSecond &&
        isOralSubjectAssessed(s.arabicScore, s.arabicCriteria, s.arabicChecklist, s.arabicAssessed, false);

      if (engDone || arabDone) {
        completedStudents++;
      }
      if (engDone && s.englishScore !== null && s.englishScore !== undefined && !Number.isNaN(s.englishScore)) {
        totalScore1 += s.englishScore;
        countScore1++;
        const pred = s.englishPredicate || calculateDirectScorePredicate(s.englishScore);
        if (pred) gradeDistribution[pred]++;
      }
      if (arabDone && s.arabicScore !== null && s.arabicScore !== undefined && !Number.isNaN(s.arabicScore)) {
        totalScore2 += s.arabicScore;
        countScore2++;
        const pred = s.arabicPredicate || calculateDirectScorePredicate(s.arabicScore);
        if (pred) gradeDistribution[pred]++;
      }
    } else {
      const hasBtq =
        includeFirst &&
        isOralSubjectAssessed(s.btqScore, s.btqCriteria, undefined, undefined, true);
      const hasHaf =
        includeSecond &&
        isOralSubjectAssessed(s.hafalanScore, s.hafalanCriteria, undefined, undefined, true);
      if (hasBtq || hasHaf) {
        completedStudents++;
      }
      if (hasBtq && s.btqScore !== null && s.btqScore !== undefined && !Number.isNaN(s.btqScore)) {
        totalScore1 += s.btqScore;
        countScore1++;
        const pred = s.btqPredicate || calculateDirectScorePredicate(s.btqScore);
        if (pred) gradeDistribution[pred]++;
      }
      if (hasHaf && s.hafalanScore !== null && s.hafalanScore !== undefined && !Number.isNaN(s.hafalanScore)) {
        totalScore2 += s.hafalanScore;
        countScore2++;
        const pred = s.hafalanPredicate || calculateDirectScorePredicate(s.hafalanScore);
        if (pred) gradeDistribution[pred]++;
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

/**
 * Mengembalikan tanggal default sesi ujian lisan yang diselaraskan ke periode resmi
 * pelaksanaan (30 November - 04 Desember 2026).
 */
export function resolveDefaultOralExamDate(
  todayIso: string = getTodayDateInJakarta()
): string {
  if (!todayIso || todayIso < ORAL_EXAM_SCHEDULE_START) {
    return ORAL_EXAM_SCHEDULE_START;
  }
  if (todayIso > ORAL_EXAM_SCHEDULE_END) {
    return ORAL_EXAM_SCHEDULE_END;
  }
  return todayIso;
}

export interface OralExamPeriodStatusInfo {
  phase: 'UPCOMING' | 'ONGOING' | 'COMPLETED';
  badgeText: string;
  detailText: string;
  activeDayNumber: number | null;
  periodLabel: string;
}

/**
 * Menghitung status pelaksanaan Ujian Lisan berdasarkan rentang resmi 30 Nov - 04 Des 2026.
 */
export function getOralExamPeriodStatus(
  todayIso: string = getTodayDateInJakarta()
): OralExamPeriodStatusInfo {
  if (!todayIso || todayIso < ORAL_EXAM_SCHEDULE_START) {
    return {
      phase: 'UPCOMING',
      badgeText: 'Mulai 30 Nov 2026',
      detailText: `Pelaksanaan dimulai Senin, 30 November s.d. 04 Desember 2026 (5 hari).`,
      activeDayNumber: null,
      periodLabel: ORAL_EXAM_SCHEDULE_LABEL,
    };
  }

  if (todayIso <= ORAL_EXAM_SCHEDULE_END) {
    const matchedDay = ORAL_EXAM_SCHEDULE_DAYS.find((d) => d.date === todayIso) || null;
    const dayNumber = matchedDay?.dayNumber ?? 1;
    const dayName = matchedDay?.dayName ?? 'Hari Pelaksanaan';
    return {
      phase: 'ONGOING',
      badgeText: `Berlangsung • Hari ke-${dayNumber}/5`,
      detailText: `Hari ke-${dayNumber} (${dayName}) dari periode ${ORAL_EXAM_SCHEDULE_LABEL}.`,
      activeDayNumber: dayNumber,
      periodLabel: ORAL_EXAM_SCHEDULE_LABEL,
    };
  }

  return {
    phase: 'COMPLETED',
    badgeText: 'Periode Selesai',
    detailText: `Pelaksanaan utama (${ORAL_EXAM_SCHEDULE_LABEL}) telah selesai; nilai & rekap tetap dapat dilihat/dilengkapi.`,
    activeDayNumber: null,
    periodLabel: ORAL_EXAM_SCHEDULE_LABEL,
  };
}
