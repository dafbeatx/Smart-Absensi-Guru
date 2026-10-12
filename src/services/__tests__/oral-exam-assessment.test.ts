/**
 * SMART ABSENSI GURU - ORAL EXAM (PENILAIAN UJIAN LISAN) TEST SUITE
 * Suite 52: Verifikasi lengkap kalkulasi penilaian, kriteria predikat resmi,
 * persistensi repositori, dan generator ekspor HTML cetak fisik.
 */

import {
  calculateDirectScorePredicate,
  calculateChecklistScoreAndPredicate,
  calculateOralExamSummaryStats,
} from '../../utils/oral-exam-scoring.utils';
import { OralExamRepository } from '../../repositories/OralExamRepository';
import { OralExamExportService } from '../../lib/oral-exam-export.lib';
import type { TestResultItem } from '../test-runner.service';
import type { OralExamSession } from '../../types/oral-exam.types';

export const runOralExamAssessmentTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: TestResultItem[];
}> => {
  const results: TestResultItem[] = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  // =========================================================================
  // Test 1: Model 1 (BTQ & Hafalan) - Kalkulasi Predikat Nilai Langsung
  // Kriteria: A: 91-100, B: 81-90, C: 61-80, D: 0-60
  // =========================================================================
  assert(
    'Model A: Nilai 95 menghasilkan Predikat A (Sangat Baik)',
    calculateDirectScorePredicate(95) === 'A',
    `Hasil: ${calculateDirectScorePredicate(95)}`
  );

  assert(
    'Model A: Nilai batas 91 menghasilkan Predikat A',
    calculateDirectScorePredicate(91) === 'A',
    `Hasil: ${calculateDirectScorePredicate(91)}`
  );

  assert(
    'Model A: Nilai 85 dan 81 menghasilkan Predikat B (Baik)',
    calculateDirectScorePredicate(85) === 'B' && calculateDirectScorePredicate(81) === 'B',
    `Hasil: ${calculateDirectScorePredicate(85)}, ${calculateDirectScorePredicate(81)}`
  );

  assert(
    'Model A: Nilai 75 dan 61 menghasilkan Predikat C (Cukup)',
    calculateDirectScorePredicate(75) === 'C' && calculateDirectScorePredicate(61) === 'C',
    `Hasil: ${calculateDirectScorePredicate(75)}, ${calculateDirectScorePredicate(61)}`
  );

  assert(
    'Model A: Nilai 60 dan 25 menghasilkan Predikat D (Perlu Bimbingan)',
    calculateDirectScorePredicate(60) === 'D' && calculateDirectScorePredicate(25) === 'D',
    `Hasil: ${calculateDirectScorePredicate(60)}, ${calculateDirectScorePredicate(25)}`
  );

  assert(
    'Model A: Nilai null / undefined aman mengembalikan null',
    calculateDirectScorePredicate(null) === null && calculateDirectScorePredicate(undefined) === null,
    'Null safety checked'
  );

  // =========================================================================
  // Test 2: Model 2 (Bahasa Inggris & Arab) - Checklist 15 Butir Soal Lisan
  // Kriteria: A: 14-15 Benar, B: 11-13 Benar, C: 6-10 Benar, D: 0-5 Benar
  // =========================================================================
  // 15 Soal Benar
  const check15 = new Array(15).fill(true);
  const calc15 = calculateChecklistScoreAndPredicate(check15, 15);
  assert(
    'Model B: 15 Jawaban Benar menghasilkan Skor 100 dan Predikat A',
    calc15.correctCount === 15 && calc15.score === 100 && calc15.predicate === 'A',
    `Count: ${calc15.correctCount}, Score: ${calc15.score}, Pred: ${calc15.predicate}`
  );

  // 14 Soal Benar (14/15 * 100 = 93.3 -> 93)
  const check14 = [...new Array(14).fill(true), false];
  const calc14 = calculateChecklistScoreAndPredicate(check14, 15);
  assert(
    'Model B: 14 Jawaban Benar menghasilkan Skor 93 dan Predikat A',
    calc14.correctCount === 14 && calc14.score === 93 && calc14.predicate === 'A',
    `Count: ${calc14.correctCount}, Score: ${calc14.score}, Pred: ${calc14.predicate}`
  );

  // 12 Soal Benar (12/15 * 100 = 80 -> Predikat B)
  const check12 = [...new Array(12).fill(true), false, false, false];
  const calc12 = calculateChecklistScoreAndPredicate(check12, 15);
  assert(
    'Model B: 12 Jawaban Benar menghasilkan Skor 80 dan Predikat B',
    calc12.correctCount === 12 && calc12.score === 80 && calc12.predicate === 'B',
    `Count: ${calc12.correctCount}, Score: ${calc12.score}, Pred: ${calc12.predicate}`
  );

  // 8 Soal Benar (8/15 * 100 = 53 -> Predikat C)
  const check8 = [...new Array(8).fill(true), ...new Array(7).fill(false)];
  const calc8 = calculateChecklistScoreAndPredicate(check8, 15);
  assert(
    'Model B: 8 Jawaban Benar menghasilkan Skor 53 dan Predikat C (Minimal 6)',
    calc8.correctCount === 8 && calc8.score === 53 && calc8.predicate === 'C',
    `Count: ${calc8.correctCount}, Score: ${calc8.score}, Pred: ${calc8.predicate}`
  );

  // 4 Soal Benar (4/15 * 100 = 27 -> Predikat D)
  const check4 = [...new Array(4).fill(true), ...new Array(11).fill(false)];
  const calc4 = calculateChecklistScoreAndPredicate(check4, 15);
  assert(
    'Model B: 4 Jawaban Benar menghasilkan Skor 27 dan Predikat D',
    calc4.correctCount === 4 && calc4.score === 27 && calc4.predicate === 'D',
    `Count: ${calc4.correctCount}, Score: ${calc4.score}, Pred: ${calc4.predicate}`
  );

  // 0 Soal Benar
  const check0 = new Array(15).fill(false);
  const calc0 = calculateChecklistScoreAndPredicate(check0, 15);
  assert(
    'Model B: 0 Jawaban Benar menghasilkan Skor 0 dan Predikat D',
    calc0.correctCount === 0 && calc0.score === 0 && calc0.predicate === 'D',
    `Count: ${calc0.correctCount}, Score: ${calc0.score}, Pred: ${calc0.predicate}`
  );

  // =========================================================================
  // Test 3: Repository Persistence & Session Management
  // =========================================================================
  const testSession: OralExamSession = {
    id: `session_test_${Date.now()}`,
    templateType: 'BTQ_HAFALAN',
    title: 'Ujian Lisan BTQ & Tahfidz Terpadu',
    academicYear: '2026/2027',
    semester: 'GANJIL',
    examinerName: 'Ibu Mira Nurdianti, S.Pd',
    roomNumber: 'Ruang 01',
    className: '7A',
    date: '2026-10-12',
    totalQuestions: 15,
    students: [
      {
        studentId: 'st_1',
        studentName: 'Muhammad Nabiel Alqarani',
        className: '7A',
        btqScore: 92,
        btqPredicate: 'A',
        hafalanScore: 85,
        hafalanPredicate: 'B',
      },
      {
        studentId: 'st_2',
        studentName: 'Sela Mutia Nur Azimah',
        className: '7A',
        btqScore: 78,
        btqPredicate: 'C',
        hafalanScore: 60,
        hafalanPredicate: 'D',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const saved = OralExamRepository.saveSession(testSession);
  assert(
    'Repository: Berhasil menyimpan sesi penilaian ujian lisan ke penyimpanan lokal',
    saved.id === testSession.id,
    `Saved ID: ${saved.id}`
  );

  const found = OralExamRepository.getSessionById(testSession.id);
  assert(
    'Repository: Berhasil mengambil sesi berdasarkan ID secara akurat',
    found !== null && found.students.length === 2 && found.students[0].btqScore === 92,
    `Found student count: ${found?.students.length}`
  );

  const allFiltered = OralExamRepository.getAllSessions('2026/2027');
  assert(
    'Repository: Filter berdasarkan tahun ajaran 2026/2027 berfungsi',
    allFiltered.some((s) => s.id === testSession.id),
    `Count 2026/2027: ${allFiltered.length}`
  );

  // =========================================================================
  // Test 4: Kalkulasi Statistik Ringkasan Sesi
  // =========================================================================
  const stats = calculateOralExamSummaryStats(testSession.students, false);
  assert(
    'Statistik: Menghitung total siswa, rata-rata BTQ (85) dan Hafalan (73) serta distribusi predikat',
    stats.totalStudents === 2 &&
      stats.completedStudents === 2 &&
      stats.averageScore1 === 85 && // (92 + 78) / 2 = 85
      stats.averageScore2 === 73 && // (85 + 60) / 2 = 72.5 -> 73
      stats.gradeDistribution.A === 1 &&
      stats.gradeDistribution.B === 1 &&
      stats.gradeDistribution.C === 1 &&
      stats.gradeDistribution.D === 1,
    `Avg1: ${stats.averageScore1}, Avg2: ${stats.averageScore2}`
  );

  // =========================================================================
  // Test 5: Generator HTML Cetak Resmi Berstandar Sekolah
  // =========================================================================
  const printHtmlBtq = OralExamExportService.generatePrintHtml(testSession);
  assert(
    'Generator HTML: Memuat Kop Resmi SMP Terpadu Al-Ittihadiyah, Nama Penguji, Kriteria, dan Siswa',
    printHtmlBtq.includes('SMP TERPADU AL-ITTIHADIYAH') &&
      printHtmlBtq.includes('Ibu Mira Nurdianti, S.Pd') &&
      printHtmlBtq.includes('Muhammad Nabiel Alqarani') &&
      printHtmlBtq.includes('KRITERIA PENILAIAN (SKALA 0 – 100)') &&
      printHtmlBtq.includes('Mengetahui'),
    'Template HTML BTQ terverifikasi'
  );

  const checklistSession: OralExamSession = {
    ...testSession,
    id: `session_check_${Date.now()}`,
    templateType: 'BAHASA_INGGRIS_ARAB',
    examinerName: 'Ibu Septi Nur Aeni, S.E',
    students: [
      {
        studentId: 'st_1',
        studentName: 'Adiba Khansa Az-Zahra',
        className: '7A',
        englishChecklist: new Array(15).fill(true),
        englishCorrectCount: 15,
        englishScore: 100,
        englishPredicate: 'A',
        arabicChecklist: [...new Array(11).fill(true), ...new Array(4).fill(false)],
        arabicCorrectCount: 11,
        arabicScore: 73,
        arabicPredicate: 'B',
      },
    ],
  };

  const printHtmlChecklist = OralExamExportService.generatePrintHtml(checklistSession);
  assert(
    'Generator HTML Checklist: Memuat 15 Butir Kolom Soal Bahasa Inggris & Arab serta Kriteria 14-15 Benar',
    printHtmlChecklist.includes('BAHASA INGGRIS') &&
      printHtmlChecklist.includes('BAHASA ARAB') &&
      printHtmlChecklist.includes('KRITERIA PENILAIAN (DARI 15 BUTIR SOAL)') &&
      printHtmlChecklist.includes('A (14 – 15 Benar)') &&
      printHtmlChecklist.includes('Ibu Septi Nur Aeni, S.E'),
    'Template HTML Checklist Bahasa terverifikasi'
  );

  // Cleanup test session
  OralExamRepository.deleteSession(testSession.id);
  OralExamRepository.deleteSession(checklistSession.id);

  assert(
    'Repository: Berhasil menghapus sesi pengujian secara bersih',
    OralExamRepository.getSessionById(testSession.id) === null,
    'Session cleanup verified'
  );

  return { passed, failed, results };
};
