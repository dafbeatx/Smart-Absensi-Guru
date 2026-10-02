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
  generateAutoPgAnswers,
  generateAutoEssayScores,
} from '../../utils/scoring.utils';
import { ExamCorrectionRepository } from '../../repositories/ExamCorrectionRepository';
import type { CreateExamSessionDTO, SaveGradedStudentDTO } from '../../types/database.types';
import {
  normalizeClassCode,
  areClassCodesEqual,
  formatClassDisplay,
  resolveSchoolLevel,
} from '../../utils/class.utils';
import { SemesterGradingExcelService } from '../semester-grading-excel.service';

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

    // ── Test 15B: Resolusi Sinkronisasi Jenjang (resolveSchoolLevel)
    const lvl8A = resolveSchoolLevel('8A', 'SMA'); // Bahkan jika database salah simpan 'SMA', tetap disanitasi jadi 'SMP'
    const lvl8B = resolveSchoolLevel('Kelas VIII-A');
    const lvl7A = resolveSchoolLevel('7A');
    const lvl9B = resolveSchoolLevel('Kelas IX-B');
    const lvl10 = resolveSchoolLevel('10A');
    const lvlSMA = resolveSchoolLevel('SMA');
    const lvlXII = resolveSchoolLevel('Kelas XII IPS');
    assert(
      'Resolusi Jenjang (resolveSchoolLevel): Kelas 8A murni SMP dan tidak pernah desinkronisasi menjadi SMA',
      lvl8A === 'SMP' && lvl8B === 'SMP' && lvl7A === 'SMP' && lvl9B === 'SMP' && lvl10 === 'SMA' && lvlSMA === 'SMA' && lvlXII === 'SMA',
      `Hasil: 8A=${lvl8A}, VIII-A=${lvl8B}, 7A=${lvl7A}, 9B=${lvl9B}, 10A=${lvl10}, SMA=${lvlSMA}`
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

    // ── Test 19: Kalkulasi Ujian Pilihan Ganda Murni (essayCount = 0 / 100% PG)
    const pgOnlyCalc = calculateStudentResult(
      ['A', 'B', 'C', 'D', 'E'],
      { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' },
      [0, 0, 0, 0, 0],
      {
        pgWeight: 1.0,
        essayWeight: 0,
        essayMaxScore: 0,
        essayCount: 0,
      }
    );
    assert(
      'Ujian PG Murni: Menghitung skor sempurna 100 tanpa penalti 30% essay',
      pgOnlyCalc.finalScore === 100 && pgOnlyCalc.lps === 100 && pgOnlyCalc.score === 100,
      `Skor PG Murni: ${pgOnlyCalc.finalScore}, LPS: ${pgOnlyCalc.lps}`
    );

    // ── Test 20: Ujian PG Murni dengan Skor Parsial (4/5 = 80%)
    const pgOnlyPartial = calculateStudentResult(
      ['A', 'B', 'C', 'D', 'E'],
      { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'A' },
      [0, 0, 0, 0, 0],
      {
        pgWeight: 1.0,
        essayWeight: 0,
        essayMaxScore: 0,
        essayCount: 0,
      }
    );
    assert(
      'Ujian PG Murni: Menghitung skor parsial 80% secara akurat (4/5 benar = 80)',
      pgOnlyPartial.finalScore === 80 && pgOnlyPartial.correct === 4 && pgOnlyPartial.wrong === 1,
      `Skor Parsial: ${pgOnlyPartial.finalScore}`
    );

    // ── Test 21: Ekspor CSV Memuat Header CSI dan LPS
    const testSession: any = {
      id: 'test_csv_session',
      session_name: 'Simulasi CSV',
      teacher: 'Guru Dafa',
      subject: 'Informatika',
      class_name: '8A',
      school_level: 'SMP',
      answer_key: ['A', 'B'],
      student_list: [],
      kkm: 75,
    };
    const testGraded: any[] = [
      {
        id: 'g1',
        session_id: 'test_csv_session',
        name: 'Citra Dewi',
        correct: 2,
        wrong: 0,
        mcq_score: 100,
        essay_score: 0,
        final_score: 100,
        csi: 100,
        lps: 100,
      },
    ];
    const csvWithMetrics = ExamCorrectionRepository.exportToCSV(testSession, testGraded);
    assert(
      'Ekspor CSV Metrics: Header dan data CSV menyertakan kolom CSI dan LPS',
      csvWithMetrics.includes('CSI,LPS') && csvWithMetrics.includes(',100,100'),
      `Preview CSV: ${csvWithMetrics.slice(0, 150)}`
    );

    // ── Test 22: SemesterGradingExcelService - Normalisasi Nama Sheet Kelas
    const n7 = SemesterGradingExcelService.normalizeSheetClassName('Kelas 7');
    const n8a = SemesterGradingExcelService.normalizeSheetClassName('Kelas 8A');
    const nsma = SemesterGradingExcelService.normalizeSheetClassName('Kelas SMA');
    assert(
      'Semester Excel: Menormalkan nama kelas agar sesuai sheet template (7, 8A, SMA)',
      n7 === '7' && n8a === '8A' && nsma === 'SMA',
      `Hasil normalisasi: 7->${n7}, 8A->${n8a}, SMA->${nsma}`
    );

    // ── Test 23: Master Template Path & Canonical Classes
    assert(
      'Semester Excel: Memvalidasi kelas kanonikal (7, 8A, 8B, 9A, 9B, SMA) & template path',
      SemesterGradingExcelService.CANONICAL_CLASSES.length === 6 &&
        SemesterGradingExcelService.CANONICAL_CLASSES.includes('8A') &&
        SemesterGradingExcelService.TEMPLATE_PATH.includes('FORMAT_PENILAIAN_ASTS_ASAS'),
      `Canonical: ${SemesterGradingExcelService.CANONICAL_CLASSES.join(', ')}`
    );

    // ── Test 24: generateAutoPgAnswers - 100% Score Sempurna
    const sampleKey20 = ['A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D', 'A', 'B', 'C', 'D'];
    const auto100 = generateAutoPgAnswers(sampleKey20, 100, ['A', 'B', 'C', 'D']);
    const calc100 = calculateStudentResult(sampleKey20, auto100, [], { pgWeight: 1, essayWeight: 0, essayMaxScore: 0, essayCount: 0 });
    assert(
      'Auto PG 01: Nilai manual 100 mengisi seluruh butir soal dengan kunci jawaban benar (20 Benar, 0 Salah, Skor 100)',
      calc100.correct === 20 && calc100.wrong === 0 && calc100.score === 100,
      `Hasil kalkulasi: Benar ${calc100.correct}, Salah ${calc100.wrong}, Skor ${calc100.score}`
    );

    // ── Test 25: generateAutoPgAnswers - Skor Parsial 80% (16 Benar, 4 Salah)
    const auto80 = generateAutoPgAnswers(sampleKey20, 80, ['A', 'B', 'C', 'D']);
    const calc80 = calculateStudentResult(sampleKey20, auto80, [], { pgWeight: 1, essayWeight: 0, essayMaxScore: 0, essayCount: 0 });
    assert(
      'Auto PG 02: Nilai manual 80 mengisi 16 butir benar dan 4 butir salah terdistribusi dengan opsi valid',
      calc80.correct === 16 && calc80.wrong === 4 && calc80.score === 80,
      `Hasil kalkulasi: Benar ${calc80.correct}, Salah ${calc80.wrong}, Skor ${calc80.score}`
    );

    // ── Test 26: generateAutoPgAnswers - Skor 0% & Edge Case Input Negatif / Over 100
    const auto0 = generateAutoPgAnswers(sampleKey20, 0, ['A', 'B', 'C', 'D']);
    const calc0 = calculateStudentResult(sampleKey20, auto0, [], { pgWeight: 1, essayWeight: 0, essayMaxScore: 0, essayCount: 0 });
    const autoOver = generateAutoPgAnswers(sampleKey20, 120, ['A', 'B', 'C', 'D']);
    const calcOver = calculateStudentResult(sampleKey20, autoOver, [], { pgWeight: 1, essayWeight: 0, essayMaxScore: 0, essayCount: 0 });
    assert(
      'Auto PG 03: Skor 0 menghasilkan 0 benar 20 salah; Skor > 100 dibatasi aman ke 100',
      calc0.correct === 0 && calc0.wrong === 20 && calc0.score === 0 && calcOver.correct === 20 && calcOver.score === 100,
      `calc0: Benar ${calc0.correct}, calcOver: Benar ${calcOver.correct}`
    );

    // ── Test 27: generateAutoPgAnswers - SMA 5 Pilihan (A-E)
    const sampleKeySMA = ['A', 'E', 'C', 'D', 'B', 'E', 'A', 'C', 'B', 'D'];
    const autoSMA = generateAutoPgAnswers(sampleKeySMA, 70, ['A', 'B', 'C', 'D', 'E']);
    const calcSMA = calculateStudentResult(sampleKeySMA, autoSMA, [], { pgWeight: 1, essayWeight: 0, essayMaxScore: 0, essayCount: 0 });
    const allValidSMA = Object.values(autoSMA).every((opt) => ['A', 'B', 'C', 'D', 'E'].includes(opt));
    assert(
      'Auto PG 04: Nilai manual 70 pada soal SMA (opsi A-E) menghasilkan 7 Benar, 3 Salah dengan opsi A-E valid',
      calcSMA.correct === 7 && calcSMA.wrong === 3 && calcSMA.score === 70 && allValidSMA,
      `calcSMA: Benar ${calcSMA.correct}, Salah ${calcSMA.wrong}, Skor ${calcSMA.score}, Valid Opsi: ${allValidSMA}`
    );

    // ── Test 28: generateAutoEssayScores - Nilai Sempurna 100%
    const autoEssay100 = generateAutoEssayScores(100, 5, 20);
    const sumEssay100 = autoEssay100.reduce((a, b) => a + b, 0);
    const calcEssay100 = calculateStudentResult([], {}, autoEssay100, { pgWeight: 0, essayWeight: 1, essayMaxScore: 20, essayCount: 5 });
    assert(
      'Auto Essay 01: Nilai manual 100 mengisi seluruh butir essay dengan poin maksimal (5 butir x 4 poin = 20, skor 100)',
      autoEssay100.length === 5 && sumEssay100 === 20 && calcEssay100.essayScore === 100 && autoEssay100.every((s) => s === 4),
      `autoEssay100: [${autoEssay100.join(', ')}], sum: ${sumEssay100}, score: ${calcEssay100.essayScore}`
    );

    // ── Test 29: generateAutoEssayScores - Nilai Parsial 80% (16/20 poin)
    const autoEssay80 = generateAutoEssayScores(80, 5, 20);
    const sumEssay80 = autoEssay80.reduce((a, b) => a + b, 0);
    const calcEssay80 = calculateStudentResult([], {}, autoEssay80, { pgWeight: 0, essayWeight: 1, essayMaxScore: 20, essayCount: 5 });
    assert(
      'Auto Essay 02: Nilai manual 80 terdistribusi merata (16 poin: [4, 3, 3, 3, 3]), skor 80',
      autoEssay80.length === 5 && sumEssay80 === 16 && calcEssay80.essayScore === 80,
      `autoEssay80: [${autoEssay80.join(', ')}], sum: ${sumEssay80}, score: ${calcEssay80.essayScore}`
    );

    // ── Test 30: Koreksi Nilai Manual Sinkron - PG + Essay Terpadu
    // Saat guru mengetik nilai manual 80, PG 80% dan Essay 80% menghasilkan Final Score persis 80
    const autoPgFor80 = generateAutoPgAnswers(sampleKey20, 80, ['A', 'B', 'C', 'D']);
    const autoEssayFor80 = generateAutoEssayScores(80, 5, 20);
    const combinedCalc = calculateStudentResult(
      sampleKey20,
      autoPgFor80,
      autoEssayFor80,
      { pgWeight: 0.7, essayWeight: 0.3, essayMaxScore: 20, essayCount: 5 }
    );
    const autoEssayEdge0 = generateAutoEssayScores(0, 5, 20);
    const autoEssayEdgeOver = generateAutoEssayScores(150, 5, 20);
    assert(
      'Auto Grading 03: Nilai manual 80 mengisi PG (80%) dan Essay (80%) secara sinkron menghasilkan Final Score 80',
      combinedCalc.score === 80 &&
        combinedCalc.essayScore === 80 &&
        combinedCalc.finalScore === 80 &&
        autoEssayEdge0.every((s) => s === 0) &&
        autoEssayEdgeOver.reduce((a, b) => a + b, 0) === 20,
      `combined: PG ${combinedCalc.score}, Essay ${combinedCalc.essayScore}, Final ${combinedCalc.finalScore}`
    );

    // ── Test 31: Session Subject Filter & Canonical Alias Resolution
    // Memvalidasi grouping mapel, alias Bahasa Arab, mapel custom, dan filtering sesi
    const dummySessions = [
      { id: '1', subject: 'Bahasa Arab', session_name: 'Sesi Arab 1', class_name: '8A' },
      { id: '2', subject: 'B. Arab – Bahasa Arab', session_name: 'Sesi Arab 2', class_name: '8B' },
      { id: '3', subject: 'Informatika', session_name: 'Sesi Info 1', class_name: '7A' },
      { id: '4', subject: 'Tahfidz Al-Quran', session_name: 'Sesi Tahfidz', class_name: '9A' },
    ];

    // Simulasi grouping dan counting seperti pada QuestionCorrectionModal
    const counts: Record<string, number> = {};
    const subjectDisplayNames: Record<string, string> = {};

    dummySessions.forEach((s) => {
      const raw = (s.subject || '').trim();
      const official = [
        { name: 'Bahasa Arab', aliases: ['B. Arab – Bahasa Arab', 'B. Arab'] },
        { name: 'Informatika', aliases: ['TIK', 'Komputer'] },
      ].find((sub) => sub.name.toLowerCase() === raw.toLowerCase() || sub.aliases.some((a) => a.toLowerCase() === raw.toLowerCase()));

      const canonicalKey = official ? official.name.toLowerCase() : raw.toLowerCase();
      const displayName = official ? official.name : raw;

      if (!subjectDisplayNames[canonicalKey]) {
        subjectDisplayNames[canonicalKey] = displayName;
      }
      counts[canonicalKey] = (counts[canonicalKey] || 0) + 1;
    });

    const uniqueSubjects = Object.keys(subjectDisplayNames)
      .map((key) => subjectDisplayNames[key])
      .sort((a, b) => a.localeCompare(b));

    const finalCounts: Record<string, number> = {};
    Object.keys(subjectDisplayNames).forEach((key) => {
      finalCounts[subjectDisplayNames[key]] = counts[key];
    });

    // Filter Bahasa Arab harus menangkap sesi 1 dan 2
    const arabSessions = dummySessions.filter(
      (s) => s.subject.toLowerCase().includes('arab')
    );

    assert(
      'Session Filter 01: Canonical subject grouping & alias resolution menghitung 3 kategori unik (Bahasa Arab=2, Informatika=1, Tahfidz=1)',
      uniqueSubjects.length === 3 &&
        finalCounts['Bahasa Arab'] === 2 &&
        finalCounts['Informatika'] === 1 &&
        finalCounts['Tahfidz Al-Quran'] === 1 &&
        arabSessions.length === 2,
      `unique: ${uniqueSubjects.join(', ')}, Arab count: ${finalCounts['Bahasa Arab']}`
    );
  } catch (err: any) {
    assert('Fatal Execution: Question Correction Test Suite threw an uncaught error', false, err?.message);
  }

  return { passed, failed, results };
};
