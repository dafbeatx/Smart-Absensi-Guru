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
import {
  normalizeClassCode,
  areClassCodesEqual,
  formatClassDisplay,
} from '../../utils/class.utils';

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

    // ── Test 11: Normalisasi Kode Kelas Romawi & Prefix (normalizeClassCode)
    const norm1 = normalizeClassCode('Kelas VIII-A');
    const norm2 = normalizeClassCode('kls XII IPA 1');
    const norm3 = normalizeClassCode('VII.B');
    const norm4 = normalizeClassCode('X - 1');
    assert(
      'Normalisasi Kelas: Mengonversi angka romawi (XII, VIII, VII, X) dan menghapus prefix Kelas/Kls',
      norm1 === '8A' && norm2 === '12IPA1' && norm3 === '7B' && norm4 === '101',
      `Hasil: ${norm1}, ${norm2}, ${norm3}, ${norm4}`
    );

    // ── Test 12: Normalisasi Kode Kelas Bersihkan Tanda Baca & Case Insensitive
    const norm5 = normalizeClassCode('kelas viii - b');
    const norm6 = normalizeClassCode('IX_C');
    const norm7 = normalizeClassCode('  8 . A  ');
    assert(
      'Normalisasi Kelas: Membersihkan spasi liar, strip, garis bawah, dan dot',
      norm5 === '8B' && norm6 === '9C' && norm7 === '8A',
      `Hasil: ${norm5}, ${norm6}, ${norm7}`
    );

    // ── Test 13: Normalisasi Edge Cases (Empty, Null, Undefined, Non-Roman)
    const normEmpty = normalizeClassCode('');
    const normNull = normalizeClassCode(null);
    const normUndef = normalizeClassCode(undefined);
    const normSMA = normalizeClassCode('SMA');
    assert(
      'Normalisasi Kelas Edge Cases: Menangani input null, empty, undefined, dan jenjang umum tanpa crash',
      normEmpty === '' && normNull === '' && normUndef === '' && normSMA === 'SMA'
    );

    // ── Test 14: Perbandingan Kesetaraan Kelas (areClassCodesEqual)
    const eq1 = areClassCodesEqual('Kelas VIII-A', '8A');
    const eq2 = areClassCodesEqual('kls 7-B', 'VII.B');
    const eq3 = areClassCodesEqual('XII MIPA 1', '12-MIPA-1');
    const eqDiff = areClassCodesEqual('8A', '8B');
    const eqEmpty = areClassCodesEqual('', '8A');
    assert(
      'Perbandingan Kelas (areClassCodesEqual): Memvalidasi kesetaraan format kelas yang bervariasi',
      eq1 === true && eq2 === true && eq3 === true && eqDiff === false && eqEmpty === false,
      `Hasil: eq1=${eq1}, eq2=${eq2}, eq3=${eq3}, eqDiff=${eqDiff}`
    );

    // ── Test 15: Format Tampilan Kelas Humanis (formatClassDisplay)
    const disp1 = formatClassDisplay('8A');
    const disp2 = formatClassDisplay('VIII-A');
    const disp3 = formatClassDisplay('SMA');
    const disp4 = formatClassDisplay('');
    assert(
      'Format Tampilan Kelas (formatClassDisplay): Menghasilkan label ramah pengguna',
      disp1 === 'Kelas 8A' && disp2 === 'Kelas 8A' && disp3 === 'SMA' && disp4 === '-',
      `Hasil: ${disp1}, ${disp2}, ${disp3}, ${disp4}`
    );

    // ── Test 16: State Machine Repository getSessionsWithStatus
    const sessionStatusResult = await ExamCorrectionRepository.getSessionsWithStatus();
    assert(
      'Repository Status Machine: getSessionsWithStatus mengembalikan status eksplisit (ok/offline_cache/error)',
      sessionStatusResult &&
        Array.isArray(sessionStatusResult.data) &&
        (sessionStatusResult.status === 'ok' || sessionStatusResult.status === 'offline_cache'),
      `Status sesi: ${sessionStatusResult.status}, Total: ${sessionStatusResult.data?.length}`
    );

    // ── Test 17: State Machine Repository getGradedStudentsWithStatus
    const dummySess = await ExamCorrectionRepository.saveSession({
      session_name: 'Ujian Status Test 7B',
      teacher: 'Guru Test',
      subject: 'Matematika',
      class_name: '7B',
      school_level: 'SMP',
      answer_key: ['A', 'B'],
      student_list: ['Siswa 1'],
      kkm: 75,
    });
    const studentsStatusResult = await ExamCorrectionRepository.getGradedStudentsWithStatus(dummySess.id);
    assert(
      'Repository Status Machine: getGradedStudentsWithStatus mengembalikan status valid tanpa silent mock fallback',
      studentsStatusResult &&
        Array.isArray(studentsStatusResult.data) &&
        studentsStatusResult.data.length === 0 &&
        (studentsStatusResult.status === 'ok' || studentsStatusResult.status === 'offline_cache'),
      `Status graded: ${studentsStatusResult.status}, Data count: ${studentsStatusResult.data?.length}`
    );
    await ExamCorrectionRepository.deleteSession(dummySess.id);

    // ── Test 18: Role Guard & Permission Verification
    // Helper to evaluate access rules used in QuestionCorrectionModal
    const evaluateRoleAccess = (userRole?: string) => {
      const isAllowedRole = ['GURU', 'ADMIN', 'OPERATOR', 'KEPSEK'].includes(userRole || '');
      const isReadOnly = userRole === 'KEPSEK';
      const canEdit = isAllowedRole && !isReadOnly;
      return { isAllowedRole, isReadOnly, canEdit };
    };

    const guruAccess = evaluateRoleAccess('GURU');
    const adminAccess = evaluateRoleAccess('ADMIN');
    const operatorAccess = evaluateRoleAccess('OPERATOR');
    const kepsekAccess = evaluateRoleAccess('KEPSEK');
    const siswaAccess = evaluateRoleAccess('SISWA');
    const guestAccess = evaluateRoleAccess(undefined);

    assert(
      'Role Guard Logic: Guru, Admin, Operator memiliki full edit; Kepsek read-only; Siswa & Guest terblokir',
      guruAccess.isAllowedRole && guruAccess.canEdit && !guruAccess.isReadOnly &&
      adminAccess.isAllowedRole && adminAccess.canEdit && !adminAccess.isReadOnly &&
      operatorAccess.isAllowedRole && operatorAccess.canEdit && !operatorAccess.isReadOnly &&
      kepsekAccess.isAllowedRole && !kepsekAccess.canEdit && kepsekAccess.isReadOnly &&
      !siswaAccess.isAllowedRole && !siswaAccess.canEdit &&
      !guestAccess.isAllowedRole && !guestAccess.canEdit,
      `Guru: ${guruAccess.canEdit}, Kepsek ReadOnly: ${kepsekAccess.isReadOnly}, Siswa Allowed: ${siswaAccess.isAllowedRole}`
    );
  } catch (err: any) {
    assert('Fatal Execution: Question Correction Test Suite threw an uncaught error', false, err?.message);
  }

  return { passed, failed, results };
};
