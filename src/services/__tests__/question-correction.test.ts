/**
 * SMART ABSENSI GURU — QUESTION CORRECTION & GRADING ENGINE TEST SUITE
 * Memvalidasi parsing kunci jawaban, kalkulasi nilai (PG, Essay, CSI, LPS), dan integrasi repository
 */

import {
  parseAnswerKey,
  calculateStudentResult,
  getScoreLabel,
  getCsiLabel,
  getLpsLabel,
} from '../../utils/scoring.utils';
import { ExamCorrectionRepository } from '../../repositories/ExamCorrectionRepository';
import type { CreateExamSessionDTO, SaveGradedStudentDTO } from '../../types/database.types';

export const runQuestionCorrectionTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
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

  try {
    // ── Test 1: parseAnswerKey dengan format bernomor (dot & parenthesis)
    const r1 = parseAnswerKey('1.A 2.B 3.C 4.D 5.E');
    const r2 = parseAnswerKey('1) A 2) B 3) C 4) D');
    assert(
      'Parser Kunci: Mem-parsing format bernomor titik dan kurung akurat',
      r1.length === 5 && r1[0] === 'A' && r1[4] === 'E' && r2.length === 4 && r2[3] === 'D',
      `Hasil: ${r1.join(',')} dan ${r2.join(',')}`
    );

    // ── Test 2: parseAnswerKey dengan format spasi, koma, dan karakter beruntun
    const r3 = parseAnswerKey('A B C D E');
    const r4 = parseAnswerKey('A, B, C, D');
    const r5 = parseAnswerKey('ABCDABCD');
    assert(
      'Parser Kunci: Mem-parsing format spasi, koma, dan karakter string beruntun',
      r3.length === 5 && r4.length === 4 && r5.length === 8 && r5[7] === 'D',
      `Hasil r5: ${r5.length} butir`
    );

    // ── Test 3: Edge Case Parser Input Kosong
    const rEmpty = parseAnswerKey('');
    assert(
      'Parser Kunci: Input kosong menghasilkan array kosong aman tanpa error',
      Array.isArray(rEmpty) && rEmpty.length === 0
    );

    // ── Test 4: Kalkulasi Skor Siswa Sempurna (100% PG + 100% Essay)
    const allKeys = ['A', 'B', 'C', 'D', 'A'];
    const perfectAnswers = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A' };
    const perfectEssay = [4, 4, 4, 4, 4]; // 20 / 20 = 100%
    const perfectCalc = calculateStudentResult(allKeys, perfectAnswers, perfectEssay, {
      pgWeight: 0.7,
      essayWeight: 0.3,
      essayMaxScore: 20,
      essayCount: 5,
    });
    assert(
      'Kalkulasi Nilai: Skor sempurna menghasilkan skor 100 dan CSI/LPS 100',
      perfectCalc.correct === 5 &&
        perfectCalc.wrong === 0 &&
        perfectCalc.score === 100 &&
        perfectCalc.essayScore === 100 &&
        perfectCalc.finalScore === 100 &&
        perfectCalc.csi === 100 &&
        perfectCalc.lps === 100,
      `Skor: ${perfectCalc.finalScore}, CSI: ${perfectCalc.csi}`
    );

    // ── Test 5: Kalkulasi Skor Parsial dan Bobot Komposit
    const partialAnswers = { 1: 'A', 2: 'B', 3: 'C', 4: 'B', 5: 'C' }; // 3 benar, 2 salah -> PG = 60%
    const partialEssay = [2, 2, 2, 2, 2]; // 10 / 20 = 50%
    // Final score: (60 * 0.7) + (50 * 0.3) = 42 + 15 = 57
    const partialCalc = calculateStudentResult(allKeys, partialAnswers, partialEssay, {
      pgWeight: 0.7,
      essayWeight: 0.3,
      essayMaxScore: 20,
      essayCount: 5,
    });
    assert(
      'Kalkulasi Nilai: Skor parsial terhitung tepat sesuai formula bobot 70% PG & 30% Essay',
      partialCalc.correct === 3 &&
        partialCalc.wrong === 2 &&
        partialCalc.score === 60 &&
        partialCalc.essayScore === 50 &&
        partialCalc.finalScore === 57,
      `Hasil final: ${partialCalc.finalScore}`
    );

    // ── Test 6: Label Predikat Kualitatif Skor & CSI
    assert(
      'Predikat Nilai & Kognitif: Memberikan predikat kualitatif yang valid',
      getScoreLabel(95) === 'Sangat Baik' &&
        getScoreLabel(75) === 'Cukup' &&
        getScoreLabel(50) === 'Sangat Kurang' &&
        getCsiLabel(90) === 'Mahir' &&
        getCsiLabel(45) === 'Perlu Bimbingan' &&
        getLpsLabel(90) === 'Di Atas Rata-rata'
    );

    // ── Test 7: Simpan & Muat Sesi Ujian di Repository
    const sessionDTO: CreateExamSessionDTO = {
      session_name: 'PTS Informatika 8A Ganjil 2025/2026',
      teacher: 'Dafa Maulana',
      subject: 'Informatika',
      class_name: '8A',
      school_level: 'SMP',
      answer_key: ['A', 'B', 'C', 'D', 'A'],
      student_list: ['Ahmad', 'Budi', 'Citra'],
      kkm: 75,
      academic_year: '2025/2026',
      semester: 'Ganjil',
      exam_type: 'PTS',
    };
    const createdSession = await ExamCorrectionRepository.saveSession(sessionDTO);
    assert(
      'Sesi Ujian: Sesi baru berhasil disimpan dan memiliki ID valid',
      Boolean(createdSession && createdSession.id && createdSession.session_name === sessionDTO.session_name),
      `Session ID: ${createdSession.id}`
    );

    const allSessions = await ExamCorrectionRepository.getSessions();
    assert(
      'Sesi Ujian: Daftar sesi termuat dari provider dan mencakup sesi yang baru dibuat',
      allSessions.some((s) => s.id === createdSession.id)
    );

    // ── Test 8: Simpan Nilai Siswa & Komputasi Ringkasan Kelas
    const grade1: SaveGradedStudentDTO = {
      session_id: createdSession.id,
      name: 'Ahmad Syarif',
      mcq_answers: { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A' },
      essay_scores: [4, 4, 4, 4, 4],
      mcq_score: 100,
      essay_score: 100,
      final_score: 100,
      csi: 100,
      lps: 100,
      correct: 5,
      wrong: 0,
      answer_key: createdSession.answer_key,
    };

    const grade2: SaveGradedStudentDTO = {
      session_id: createdSession.id,
      name: 'Budi Santoso',
      mcq_answers: { 1: 'A', 2: 'A', 3: 'A', 4: 'A', 5: 'A' },
      essay_scores: [0, 0, 0, 0, 0],
      mcq_score: 40,
      essay_score: 0,
      final_score: 28,
      csi: 40,
      lps: 24,
      correct: 2,
      wrong: 3,
      answer_key: createdSession.answer_key,
    };

    await ExamCorrectionRepository.saveGradedStudent(grade1);
    await ExamCorrectionRepository.saveGradedStudent(grade2);

    const gradedStudents = await ExamCorrectionRepository.getGradedStudents(createdSession.id);
    assert(
      'Penilaian Siswa: Nilai kedua siswa berhasil disimpan ke provider',
      gradedStudents.length >= 2 && gradedStudents.some((s) => s.name === 'Ahmad Syarif')
    );

    const summary = ExamCorrectionRepository.computeClassSummary(gradedStudents, 75, 2);
    assert(
      'Ringkasan Kelas: Statistik rata-rata, tuntas, dan remedial terhitung presisi',
      summary.gradedCount === 2 &&
        summary.highestScore === 100 &&
        summary.lowestScore === 28 &&
        summary.passedCount === 1 &&
        summary.remedialCount === 1 &&
        summary.passRate === 50,
      `Rata-rata: ${summary.averageScore}, Pass rate: ${summary.passRate}%`
    );

    // ── Test 9: Ekspor Rekapitulasi Nilai ke CSV
    const csvContent = ExamCorrectionRepository.exportToCSV(createdSession, gradedStudents);
    assert(
      'Ekspor CSV: Menghasilkan konten CSV valid dengan BOM UTF-8 dan nama siswa terenkapsulasi',
      csvContent.startsWith('\uFEFF') &&
        csvContent.includes('Ahmad Syarif') &&
        csvContent.includes('TUNTAS') &&
        csvContent.includes('REMEDIAL')
    );

    // ── Test 10: Penghapusan Nilai Siswa & Sesi Ujian (Cleanup)
    const targetStudent = gradedStudents.find((s) => s.name === 'Ahmad Syarif');
    if (targetStudent) {
      await ExamCorrectionRepository.deleteGradedStudent(targetStudent.id);
    }
    const afterDeleteStudent = await ExamCorrectionRepository.getGradedStudents(createdSession.id);
    assert(
      'Hapus Nilai: Data siswa berhasil dihapus dari sesi',
      !afterDeleteStudent.some((s) => s.name === 'Ahmad Syarif')
    );

    await ExamCorrectionRepository.deleteSession(createdSession.id);
    const afterDeleteSession = await ExamCorrectionRepository.getSessions();
    assert(
      'Hapus Sesi: Sesi ujian beserta rekap terkait berhasil dihapus',
      !afterDeleteSession.some((s) => s.id === createdSession.id)
    );
  } catch (err: any) {
    assert('Fatal Execution: Question Correction Test Suite threw an uncaught error', false, err?.message);
  }

  return { passed, failed, results };
};
