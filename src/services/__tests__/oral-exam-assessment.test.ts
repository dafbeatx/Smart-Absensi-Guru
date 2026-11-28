/**
 * SMART ABSENSI GURU - ORAL EXAM (PENILAIAN UJIAN LISAN) TEST SUITE
 * Suite 52: Verifikasi lengkap kalkulasi penilaian, kriteria predikat resmi,
 * persistensi repositori, dan generator ekspor HTML cetak fisik.
 */

import {
  calculateDirectScorePredicate,
  calculateCriteriaAverageAndPredicate,
  calculateOralExamSummaryStats,
  getOralExamPeriodStatus,
  isStudentOralExamCompleted,
  resolveDefaultOralExamDate,
} from '../../utils/oral-exam-scoring.utils';
import { OralExamRepository } from '../../repositories/OralExamRepository';
import { OralExamAssignmentRepository } from '../../repositories/OralExamAssignmentRepository';
import { OralExamExportService } from '../../lib/oral-exam-export.lib';
import {
  ORAL_EXAM_OFFICIAL_GROUPS,
  findMatchingOfficialOralGroup,
  getDefaultOralExamAssignments,
  findAssignmentsForTeacher,
  hydrateOralExamAssignmentsWithTeachers,
  resolveAssignmentDisplayForUser,
} from '../../data/oral-exam-groups';
import { ProviderFactory } from '../../providers/provider-factory';
import { MockProvider } from '../../providers/mock-provider.service';
import { setServerSupabaseClient, resetServerSupabaseClient } from '../../../api/_shared/session-auth';
import { handleSaveOralExamAssignments } from '../../../api/_shared/exam-admin-settings';
import {
  handleListOralExamSessions,
  handleSaveOralExamSession,
  handleDeleteOralExamSession,
} from '../../../api/_shared/oral-exam-cloud';
import {
  getEffectiveSubjectScope,
  getOralExamSessionTrack,
  ORAL_EXAM_SCHEDULE_DAYS,
  ORAL_EXAM_SCHEDULE_LABEL,
  type OralExamSession,
  type OralExamAssignment,
} from '../../types/oral-exam.types';
import type { UserProfile } from '../../types/database.types';
import type { TestResultItem } from '../test-runner.service';

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
  // Test 2: Penilaian Langsung 3 Kriteria (Rata-rata Skala 0-100 & Predikat A/B/C/D)
  // =========================================================================
  const critA = calculateCriteriaAverageAndPredicate([95, 92, 90]); // sum 277 / 3 = 92.33 -> 92 (A)
  assert(
    '3 Kriteria: Nilai [95, 92, 90] menghasilkan Rata-rata 92, Predikat A, dan lengkap 3/3',
    critA.isComplete && critA.filledCount === 3 && critA.averageScore === 92 && critA.predicate === 'A',
    `Complete: ${critA.isComplete}, Avg: ${critA.averageScore}, Pred: ${critA.predicate}`
  );

  const critB = calculateCriteriaAverageAndPredicate([85, 85, 80]); // sum 250 / 3 = 83.33 -> 83 (B)
  assert(
    '3 Kriteria: Nilai [85, 85, 80] menghasilkan Rata-rata 83 dan Predikat B',
    critB.isComplete && critB.averageScore === 83 && critB.predicate === 'B',
    `Avg: ${critB.averageScore}, Pred: ${critB.predicate}`
  );

  const critC = calculateCriteriaAverageAndPredicate([70, 75, 65]); // 70 (C)
  assert(
    '3 Kriteria: Nilai [70, 75, 65] menghasilkan Rata-rata 70 dan Predikat C',
    critC.isComplete && critC.averageScore === 70 && critC.predicate === 'C',
    `Avg: ${critC.averageScore}, Pred: ${critC.predicate}`
  );

  const critD = calculateCriteriaAverageAndPredicate([50, 55, 60]); // 55 (D)
  assert(
    '3 Kriteria: Nilai [50, 55, 60] menghasilkan Rata-rata 55 dan Predikat D',
    critD.isComplete && critD.averageScore === 55 && critD.predicate === 'D',
    `Avg: ${critD.averageScore}, Pred: ${critD.predicate}`
  );

  const critPartial = calculateCriteriaAverageAndPredicate([90, 80, null]);
  assert(
    '3 Kriteria Parsial: [90, 80, null] menghitung sementara 85 (B) dan menandai belum lengkap (2/3)',
    !critPartial.isComplete &&
      critPartial.filledCount === 2 &&
      critPartial.averageScore === 85 &&
      critPartial.predicate === 'B',
    `Complete: ${critPartial.isComplete}, Filled: ${critPartial.filledCount}, Avg: ${critPartial.averageScore}`
  );

  const critClamped = calculateCriteriaAverageAndPredicate([120, -10, 90]); // clamped [100, 0, 90] -> avg 63 (C)
  const critEmpty = calculateCriteriaAverageAndPredicate([null, undefined, null]);
  assert(
    '3 Kriteria Batas & Null: Input di luar rentang 0-100 dijaga [0..100] dan kosong aman mengembalikan null',
    critClamped.isComplete &&
      critClamped.scores[0] === 100 &&
      critClamped.scores[1] === 0 &&
      critClamped.averageScore === 63 &&
      critClamped.predicate === 'C' &&
      critEmpty.filledCount === 0 &&
      critEmpty.averageScore === null &&
      critEmpty.predicate === null,
    `ClampedAvg: ${critClamped.averageScore}, EmptyAvg: ${critEmpty.averageScore}`
  );

  // =========================================================================
  // Test 3–13: Repository Cloud Persistence via ProviderFactory, Admin Setup,
  // Guru Siap Pakai, Staff Sync, & Supabase API RBAC Verification
  // =========================================================================
  const prevProvider = ProviderFactory.getProvider();
  const mockProv = new MockProvider();
  ProviderFactory.setProvider(mockProv);

  try {
    const testSession: OralExamSession = {
      id: `session_test_${Date.now()}`,
      templateType: 'BTQ_HAFALAN',
      criteriaLabels: ['Tajwid & Makhraj', 'Kelancaran Bacaan', 'Hafalan & Adab'],
      title: 'Ujian Lisan BTQ & Tahfidz Terpadu',
      academicYear: '2026/2027',
      semester: 'GANJIL',
      examinerName: 'Ibu Mira Nurdianti, S.Pd',
      roomNumber: 'Ruang 01',
      className: '7A',
      date: '2026-10-12',
      totalQuestions: 3,
      students: [
        {
          studentId: 'st_1',
          studentName: 'Muhammad Nabiel Alqarani',
          className: '7A',
          btqCriteria: [94, 92, 90],
          btqScore: 92,
          btqPredicate: 'A',
          hafalanCriteria: [85, 86, 84],
          hafalanScore: 85,
          hafalanPredicate: 'B',
        },
        {
          studentId: 'st_2',
          studentName: 'Sela Mutia Nur Azimah',
          className: '7A',
          btqCriteria: [78, 80, 76],
          btqScore: 78,
          btqPredicate: 'C',
          hafalanCriteria: [60, 62, 58],
          hafalanScore: 60,
          hafalanPredicate: 'D',
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await OralExamRepository.saveSession(testSession, 'MOCK_TOKEN');
    assert(
      'Repository: Berhasil menyimpan sesi penilaian ujian lisan melalui Provider Cloud',
      saved.id === testSession.id,
      `Saved ID: ${saved.id}`
    );

    const found = await OralExamRepository.getSessionById(testSession.id, '2026/2027', 'MOCK_TOKEN');
    assert(
      'Repository: Berhasil mengambil sesi berdasarkan ID secara akurat',
      found !== null && found.students.length === 2 && found.students[0].btqScore === 92,
      `Found student count: ${found?.students.length}`
    );

    const allFiltered = await OralExamRepository.getAllSessions('2026/2027', 'MOCK_TOKEN');
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
      'Generator HTML BTQ 3 Kriteria: Memuat Kop Resmi, Nama Penguji, 3 Kriteria BTQ, Skala 0-100, dan Siswa',
      printHtmlBtq.includes('SMP TERPADU AL-ITTIHADIYAH') &&
        printHtmlBtq.includes('Ibu Mira Nurdianti, S.Pd') &&
        printHtmlBtq.includes('Muhammad Nabiel Alqarani') &&
        printHtmlBtq.includes('KRITERIA PENILAIAN UJIAN LISAN (3 KRITERIA • SKALA 0 – 100)') &&
        printHtmlBtq.includes('Tajwid &amp; Makhraj') &&
        printHtmlBtq.includes('Kelancaran Bacaan') &&
        printHtmlBtq.includes('Hafalan &amp; Adab') &&
        printHtmlBtq.includes('Mengetahui'),
      'Template HTML BTQ 3 kriteria terverifikasi'
    );

    const bahasaSession: OralExamSession = {
      ...testSession,
      id: `session_bahasa_${Date.now()}`,
      templateType: 'BAHASA_INGGRIS_ARAB',
      criteriaLabels: ['Pelafalan', 'Kelancaran', 'Pemahaman & Kosakata'],
      examinerName: 'Ibu Septi Nur Aeni, S.E',
      students: [
        {
          studentId: 'st_1',
          studentName: 'Adiba Khansa Az-Zahra',
          className: '7A',
          englishCriteria: [95, 92, 95],
          englishScore: 94,
          englishPredicate: 'A',
          englishAssessed: true,
          arabicCriteria: [84, 85, 86],
          arabicScore: 85,
          arabicPredicate: 'B',
          arabicAssessed: true,
        },
      ],
    };

    const printHtmlBahasa = OralExamExportService.generatePrintHtml(bahasaSession);
    assert(
      'Generator HTML Bahasa 3 Kriteria: Memuat 3 Kriteria Bahasa Inggris & Arab tanpa kolom 15 butir soal',
      printHtmlBahasa.includes('BAHASA INGGRIS (3 KRITERIA)') &&
        printHtmlBahasa.includes('BAHASA ARAB (3 KRITERIA)') &&
        printHtmlBahasa.includes('Pelafalan') &&
        printHtmlBahasa.includes('Kelancaran') &&
        printHtmlBahasa.includes('Pemahaman &amp; Kosakata') &&
        !printHtmlBahasa.includes('15 BUTIR SOAL') &&
        !printHtmlBahasa.includes('14 – 15 Benar') &&
        printHtmlBahasa.includes('Ibu Septi Nur Aeni, S.E'),
      'Template HTML Bahasa 3 kriteria terverifikasi'
    );

    // Cleanup test session
    await OralExamRepository.deleteSession(testSession.id, 'MOCK_TOKEN');
    await OralExamRepository.deleteSession(bahasaSession.id, 'MOCK_TOKEN');

    assert(
      'Repository: Berhasil menghapus sesi pengujian secara bersih',
      (await OralExamRepository.getSessionById(testSession.id, '2026/2027', 'MOCK_TOKEN')) === null,
      'Session cleanup verified'
    );

    // =========================================================================
    // Test 6: 12 Kelompok Penguji Resmi (144 Peserta) & Auto-Matching Penguji
    // =========================================================================
    const totalOfficialGroupStudents = ORAL_EXAM_OFFICIAL_GROUPS.reduce(
      (acc, grp) => acc + grp.students.length,
      0
    );
    const matchAdi = findMatchingOfficialOralGroup('Adi Prastyo, S.Pd');
    const matchAsrof = findMatchingOfficialOralGroup('Qodiatul Asrof Ramadhoni, S.E., G.r');
    const matchFarhan = findMatchingOfficialOralGroup('Farhan Sopian Sahid, S.Pd.I');

    assert(
      'Official Groups: 12 kelompok penguji memuat total tepat 144 siswa (termasuk Ruang SMA) dan mencocokkan penguji login',
      ORAL_EXAM_OFFICIAL_GROUPS.length === 12 &&
        totalOfficialGroupStudents === 144 &&
        Boolean(matchAdi && matchAdi.roomNumber === 'Ruang 01' && matchAdi.students.length === 11) &&
        Boolean(matchAsrof && matchAsrof.className === 'SMA' && matchAsrof.students.length === 13) &&
        Boolean(matchFarhan && matchFarhan.className === 'SMA' && matchFarhan.students.length === 11),
      `Groups=${ORAL_EXAM_OFFICIAL_GROUPS.length}, Total=${totalOfficialGroupStudents}, Adi=${matchAdi?.students.length}, Asrof=${matchAsrof?.className}`
    );

    // =========================================================================
    // Test 7: Pemisahan Track BAHASA vs BTQ & Scope Terpisah (ENGLISH_ONLY / BTQ_ONLY)
    // =========================================================================
    const englishOnlySession = await OralExamRepository.createNewSession(
      {
        templateType: 'BAHASA_INGGRIS_ARAB',
        subjectScope: 'ENGLISH_ONLY',
        groupId: 'oral_grp_11_asrof',
        title: 'Ujian Lisan Bahasa Inggris - SMA',
        academicYear: '2026/2027',
        semester: 'GANJIL',
        examinerName: 'Qodiatul Asrof Ramadoni, S.E',
        roomNumber: 'Ruang SMA',
        className: 'SMA',
        date: '2026-11-27',
        students: [
          { studentId: 'sma_1', studentName: 'Arnesta Hadiwinata', className: 'SMA' },
          { studentId: 'sma_2', studentName: 'Muhamad Tahfidz', className: 'SMA' },
        ],
      },
      'MOCK_TOKEN'
    );

    // Nilai hanya Bahasa Inggris 3 kriteria lengkap pada siswa 1; siswa 2 baru isi 2/3 kriteria pada Arab
    englishOnlySession.students[0].englishCriteria = [95, 90, 92];
    englishOnlySession.students[0].englishScore = 92;
    englishOnlySession.students[0].englishPredicate = 'A';
    englishOnlySession.students[0].englishAssessed = true;
    // Walaupun siswa 2 memiliki arabicAssessed, di scope ENGLISH_ONLY tidak dihitung selesai
    englishOnlySession.students[1].arabicCriteria = [80, 80, 80];
    englishOnlySession.students[1].arabicAssessed = true;
    englishOnlySession.students[1].arabicScore = 80;
    await OralExamRepository.saveSession(englishOnlySession, 'MOCK_TOKEN');

    const engScopeStats = calculateOralExamSummaryStats(
      englishOnlySession.students,
      true,
      getEffectiveSubjectScope(englishOnlySession)
    );
    const btqOnlySession = await OralExamRepository.createNewSession(
      {
        templateType: 'BTQ_HAFALAN',
        subjectScope: 'BTQ_ONLY',
        title: 'Ujian Lisan BTQ - Kelas 7',
        academicYear: '2026/2027',
        semester: 'GANJIL',
        examinerName: 'Adi Prastyo, S.Pd',
        roomNumber: 'Ruang 01',
        className: '7',
        date: '2026-11-27',
        students: [
          { studentId: 'k7_1', studentName: 'Afhtar Shakil', className: '7' },
          { studentId: 'k7_2', studentName: 'Akbar Azhi Mughni', className: '7' },
        ],
      },
      'MOCK_TOKEN'
    );
    btqOnlySession.students[0].btqCriteria = [94, 96, 92];
    btqOnlySession.students[0].btqScore = 94;
    btqOnlySession.students[0].btqPredicate = 'A';
    // Siswa kedua baru 2 dari 3 kriteria -> belum terhitung lengkap
    btqOnlySession.students[1].btqCriteria = [88, 90, null];
    btqOnlySession.students[1].btqScore = 89;
    btqOnlySession.students[1].btqPredicate = 'B';
    await OralExamRepository.saveSession(btqOnlySession, 'MOCK_TOKEN');

    assert(
      'Track Separation: BAHASA vs BTQ terpisah tegas, dan ENGLISH_ONLY / BTQ_ONLY mewajibkan 3/3 kriteria lengkap',
      getOralExamSessionTrack(englishOnlySession) === 'BAHASA' &&
        getOralExamSessionTrack(btqOnlySession) === 'BTQ' &&
        isStudentOralExamCompleted(englishOnlySession.students[0], 'BAHASA_INGGRIS_ARAB', 'ENGLISH_ONLY') === true &&
        isStudentOralExamCompleted(englishOnlySession.students[1], 'BAHASA_INGGRIS_ARAB', 'ENGLISH_ONLY') === false &&
        engScopeStats.completedStudents === 1 &&
        engScopeStats.averageScore1 === 92 &&
        isStudentOralExamCompleted(btqOnlySession.students[0], 'BTQ_HAFALAN', 'BTQ_ONLY') === true &&
        isStudentOralExamCompleted(btqOnlySession.students[1], 'BTQ_HAFALAN', 'BTQ_ONLY') === false,
      `TrackEng=${getOralExamSessionTrack(englishOnlySession)}, TrackBtq=${getOralExamSessionTrack(btqOnlySession)}, Completed=${engScopeStats.completedStudents}`
    );

    // =========================================================================
    // Test 8: Ekspor HTML Fokus Scope & Dukungan Kelas SMA
    // =========================================================================
    const engOnlyHtml = OralExamExportService.generatePrintHtml(englishOnlySession);
    const btqOnlyHtml = OralExamExportService.generatePrintHtml(btqOnlySession);

    await OralExamRepository.deleteSession(englishOnlySession.id, 'MOCK_TOKEN');
    await OralExamRepository.deleteSession(btqOnlySession.id, 'MOCK_TOKEN');

    assert(
      'Export Focused Scope & SMA: HTML ENGLISH_ONLY tidak memuat kolom Arab + memakai Ruang SMA; HTML BTQ_ONLY tidak memuat kolom Hafalan',
      engOnlyHtml.includes('BAHASA INGGRIS') &&
        !engOnlyHtml.includes('BAHASA ARAB') &&
        engOnlyHtml.includes('Ruang SMA') &&
        engOnlyHtml.includes('SMA TERPADU AS SALAAM') &&
        engOnlyHtml.includes(ORAL_EXAM_SCHEDULE_LABEL) &&
        btqOnlyHtml.includes('BTQ') &&
        !btqOnlyHtml.includes('HAFALAN'),
      `HasEng=${engOnlyHtml.includes('BAHASA INGGRIS')}, NoArab=${!engOnlyHtml.includes('BAHASA ARAB')}, HasSma=${engOnlyHtml.includes('SMA TERPADU AS SALAAM')}, NoHaf=${!btqOnlyHtml.includes('HAFALAN')}`
    );
    // 9a: Default 12 assignments from official groups
    const defaultAssignments = getDefaultOralExamAssignments('2026/2027');

    // 9b: Server endpoint RBAC check + DB upsert verification
    const upsertedKv: Array<{ key: string; value: string }> = [];
    const fakeServerDb = {
      from: (table: string) => {
        const chain: any = {
          select: () => chain,
          eq: () => chain,
          in: () => chain,
          limit: () => Promise.resolve({ data: [], error: null }),
          upsert: (row: { key: string; value: string }) => {
            if (table === 'system_settings') upsertedKv.push(row);
            return Promise.resolve({ error: null });
          },
          then: (resolve: any, reject?: any) => Promise.resolve({ data: [], error: null }).then(resolve, reject),
        };
        return chain;
      },
    };

    let forbiddenStatus = 0;
    let adminSaveStatus = 0;
    try {
      setServerSupabaseClient(fakeServerDb);
      const guruAttempt = await handleSaveOralExamAssignments(
        { academicYear: '2026/2027', assignments: defaultAssignments },
        {
          ok: true,
          userId: 'usr_guru_only',
          role: 'GURU',
          sessionId: 'sess_test_guru',
          user: {
            id: 'usr_guru_only',
            nip: null,
            full_name: 'Guru Penguji',
            role: 'GURU',
            position: 'Guru',
            avatar_url: null,
            phone_number: null,
          },
        }
      );
      forbiddenStatus = guruAttempt.status;

      const adminAttempt = await handleSaveOralExamAssignments(
        { academicYear: '2026/2027', assignments: defaultAssignments },
        {
          ok: true,
          userId: 'usr_admin_1',
          role: 'ADMIN',
          sessionId: 'sess_test_admin',
          user: {
            id: 'usr_admin_1',
            nip: null,
            full_name: 'Administrator',
            role: 'ADMIN',
            position: 'Admin',
            avatar_url: null,
            phone_number: null,
          },
        }
      );
      adminSaveStatus = adminAttempt.status;
    } finally {
      resetServerSupabaseClient();
    }

    // 9c: Repository round-trip via MockProvider
    const customAssignment: OralExamAssignment = {
      id: 'assign_custom_uji',
      examinerUserId: 'usr_guru_khusus_99',
      examinerName: 'Ust. Ahmad Fauzi, M.Pd',
      examinerNpp: '19880101',
      roomNumber: 'Ruang 07',
      className: '8B',
      examTracks: ['BAHASA'],
      bahasaScope: 'ENGLISH_ONLY',
      btqScope: 'BOTH',
      bahasaCriteria: ['Pronunciation', 'Fluency', 'Comprehension'],
      btqCriteria: ['Tajwid', 'Makhraj', 'Adab'],
      students: [
        { studentId: 'st_a1', studentName: 'Abila Yazid Rizaki', className: '8B' },
        { studentId: 'st_a2', studentName: 'Adrian Putra Nugraha', className: '8B' },
      ],
      academicYear: '2026/2027',
      isActive: true,
      updatedAt: new Date().toISOString(),
    };
    const inactiveAssignment: OralExamAssignment = {
      ...customAssignment,
      id: 'assign_inactive_uji',
      examinerUserId: 'usr_guru_nonaktif',
      examinerName: 'Guru Nonaktif',
      isActive: false,
    };

    await OralExamAssignmentRepository.saveAssignments(
      [...defaultAssignments, customAssignment, inactiveAssignment],
      '2026/2027',
      'MOCK_TOKEN'
    );
    const reloadedAssignments = await OralExamAssignmentRepository.getAssignments('2026/2027');

    assert(
      'Admin Placement & Cloud Auth: Endpoint server menolak role GURU (403), menyimpan untuk ADMIN (200), dan Repository sinkron lewat Provider',
      forbiddenStatus === 403 &&
        adminSaveStatus === 200 &&
        upsertedKv.some((k) => k.key === 'exam_oral_assignments_2026_2027') &&
        reloadedAssignments.length === 14 &&
        reloadedAssignments.some((a) => a.id === 'assign_custom_uji' && a.roomNumber === 'Ruang 07'),
      `forbidden=${forbiddenStatus}, admin=${adminSaveStatus}, kvCount=${upsertedKv.length}, total=${reloadedAssignments.length}`
    );

    // Test 10: Pencocokan penugasan guru (ID exact, fallback nama, nonaktif/kosong terisolasi)
    const matchedById = findAssignmentsForTeacher(reloadedAssignments, {
      id: 'usr_guru_khusus_99',
      full_name: 'Nama Lain Sama Sekali',
    });
    const matchedByName = findAssignmentsForTeacher(reloadedAssignments, {
      id: 'usr_adi_login',
      full_name: 'Adi Prastyo, S.Pd',
    });
    const matchedUnassigned = findAssignmentsForTeacher(reloadedAssignments, {
      id: 'usr_random_teacher',
      full_name: 'Guru Tidak Bertugas',
    });
    const matchedInactive = findAssignmentsForTeacher(reloadedAssignments, {
      id: 'usr_guru_nonaktif',
      full_name: 'Guru Nonaktif',
    });

    assert(
      'Teacher Placement Matching: Akun guru dicocokkan via User ID atau nama resmi, dan guru nonaktif / tidak ditugaskan tidak bocor',
      matchedById.length === 1 &&
        matchedById[0].id === 'assign_custom_uji' &&
        matchedByName.length === 1 &&
        matchedByName[0].roomNumber === 'Ruang 01' &&
        matchedUnassigned.length === 0 &&
        matchedInactive.length === 0,
      `byId=${matchedById.length}, byName=${matchedByName.length}, unreg=${matchedUnassigned.length}, inactive=${matchedInactive.length}`
    );

    // Test 11: Siap Pakai Guru (openOrSyncAssignedSession) membuat sesi instan & menjaga nilai lama saat Admin tambah siswa
    const firstReady = await OralExamRepository.openOrSyncAssignedSession(
      {
        assignment: customAssignment,
        track: 'BAHASA',
        academicYear: '2026/2027',
        semester: 'GANJIL',
        examinerNpp: '19880101',
        date: '2026-11-27',
      },
      'MOCK_TOKEN'
    );

    // Simulasi guru menilai siswa pertama dengan 3 kriteria sebelum Admin mengedit penempatan
    firstReady.students[0].englishCriteria = [96, 94, 98];
    firstReady.students[0].englishScore = 96;
    firstReady.students[0].englishPredicate = 'A';
    firstReady.students[0].englishAssessed = true;
    await OralExamRepository.saveSession(firstReady, 'MOCK_TOKEN');

    const updatedByAdmin: OralExamAssignment = {
      ...customAssignment,
      roomNumber: 'Ruang 09',
      bahasaScope: 'BOTH',
      bahasaCriteria: ['Pelafalan Khusus', 'Kelancaran Khusus', 'Kosakata Khusus'],
      students: [
        ...customAssignment.students,
        { studentId: 'st_a3', studentName: 'Siswa Tambahan Admin', className: '8B' },
      ],
    };
    const resyncedSession = await OralExamRepository.openOrSyncAssignedSession(
      {
        assignment: updatedByAdmin,
        track: 'BAHASA',
        academicYear: '2026/2027',
        semester: 'GANJIL',
        examinerNpp: '19880101',
        date: '2026-11-27',
      },
      'MOCK_TOKEN'
    );

    await OralExamRepository.deleteSession(resyncedSession.id, 'MOCK_TOKEN');

    assert(
      'Guru Siap Pakai Sync: openOrSyncAssignedSession menyinkronkan 3 kriteria & menjaga nilai 3 kriteria lama saat Admin update',
      firstReady.students.length === 2 &&
        firstReady.criteriaLabels?.[0] === 'Pronunciation' &&
        resyncedSession.id === firstReady.id &&
        resyncedSession.roomNumber === 'Ruang 09' &&
        resyncedSession.subjectScope === 'BOTH' &&
        resyncedSession.criteriaLabels?.[0] === 'Pelafalan Khusus' &&
        resyncedSession.students.length === 3 &&
        resyncedSession.students[0].englishScore === 96 &&
        resyncedSession.students[0].englishCriteria?.[2] === 98 &&
        resyncedSession.students[2].studentName === 'Siswa Tambahan Admin',
      `room=${resyncedSession.roomNumber}, crit0=${resyncedSession.criteriaLabels?.[0]}, count=${resyncedSession.students.length}, preserved=${resyncedSession.students[0].englishScore}`
    );

    // Test 11b: Ceklis Massal Penguji Admin (openOrSyncBatchSessions anti-duplikasi & jaga nilai)
    const batchTargets = defaultAssignments.slice(0, 3);
    const firstPass = await OralExamRepository.openOrSyncBatchSessions(
      {
        assignments: [batchTargets[0]],
        track: 'BAHASA',
        academicYear: '2026/2027',
        semester: 'GANJIL',
        date: '2026-11-28',
      },
      'MOCK_TOKEN'
    );
    if (firstPass.sessions[0]) {
      firstPass.sessions[0].students[0].englishCriteria = [90, 92, 88];
      firstPass.sessions[0].students[0].englishScore = 90;
      firstPass.sessions[0].students[0].englishPredicate = 'B';
      firstPass.sessions[0].students[0].englishAssessed = true;
      await OralExamRepository.saveSession(firstPass.sessions[0], 'MOCK_TOKEN');
    }

    const secondPass = await OralExamRepository.openOrSyncBatchSessions(
      {
        assignments: batchTargets,
        track: 'BAHASA',
        academicYear: '2026/2027',
        semester: 'GANJIL',
        date: '2026-11-28',
        subjectScopeOverride: 'ENGLISH_ONLY',
      },
      'MOCK_TOKEN'
    );
    const batchPreservedScore = secondPass.sessions[0]?.students[0]?.englishScore;
    for (const bs of secondPass.sessions) {
      await OralExamRepository.deleteSession(bs.id, 'MOCK_TOKEN');
    }

    assert(
      'Batch Examiner Checklist: openOrSyncBatchSessions membuat sesi baru untuk penguji lain & menyinkronkan sesi lama tanpa duplikasi',
      firstPass.createdCount === 1 &&
        secondPass.sessions.length === 3 &&
        secondPass.createdCount === 2 &&
        secondPass.syncedCount === 1 &&
        batchPreservedScore === 90,
      `created=${secondPass.createdCount}, synced=${secondPass.syncedCount}, preserved=${batchPreservedScore}`
    );

    // Test 12: Sinkronisasi Nama Penguji dari Data Manajemen Guru & Staf
    const prevGetAllUsers = mockProv.getAllUsers.bind(mockProv);
    const mockStaffFromManagement: UserProfile[] = [
      {
        id: 'usr_mgm_adi',
        nip: '1991041201',
        full_name: 'Adi Prasetyo, S.Pd., M.Pd',
        phone_number: '0811111111',
        role: 'GURU',
        position: 'Guru Bahasa Inggris',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_mgm_dafa',
        nip: '1995020102',
        full_name: 'Dafa Maulana, S.Pd',
        phone_number: '0822222222',
        role: 'GURU',
        position: 'Guru PJOK',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_mgm_nonaktif',
        nip: '1980010100',
        full_name: 'Staf Resign Nonaktif',
        phone_number: '0833333333',
        role: 'GURU',
        position: 'Guru',
        avatar_url: null,
        is_active: false,
        created_at: new Date().toISOString(),
      },
    ];

    let staffDir: UserProfile[] = [];
    try {
      (mockProv as any).getAllUsers = async () => mockStaffFromManagement;
      staffDir = await OralExamAssignmentRepository.getStaffDirectory('MOCK_TOKEN');
    } finally {
      (mockProv as any).getAllUsers = prevGetAllUsers;
    }

    const hydratedDefaults = getDefaultOralExamAssignments('2026/2027', staffDir);
    const grpAdi = hydratedDefaults.find((g) => g.id === 'oral_grp_01_adi');
    const grpDafa = hydratedDefaults.find((g) => g.id === 'oral_grp_06_dafa');

    // Simulasi nama di Manajemen Guru & Staf diedit menjadi bergelar baru -> wajib ikut terbarui
    const renamedHydrated = hydrateOralExamAssignmentsWithTeachers(hydratedDefaults, [
      {
        ...mockStaffFromManagement[1],
        full_name: 'Dafa Maulana, M.Pd',
      },
    ]);
    const grpDafaRenamed = renamedHydrated.find((g) => g.id === 'oral_grp_06_dafa');

    const guruDisplayResolved = resolveAssignmentDisplayForUser(
      defaultAssignments.find((g) => g.id === 'oral_grp_03_nurul')!,
      {
        id: 'usr_nurul_official',
        full_name: 'Nurul Farhiyah, S.Pd., Gr',
        nip: '1993050503',
      }
    );

    assert(
      'Manajemen Guru & Staf Sync: getStaffDirectory memfilter staf nonaktif, menautkan ID/NPP & nama resmi terbaru otomatis ke penugasan',
      staffDir.length === 2 &&
        staffDir[0].full_name === 'Adi Prasetyo, S.Pd., M.Pd' &&
        grpAdi?.examinerUserId === 'usr_mgm_adi' &&
        grpAdi?.examinerName === 'Adi Prasetyo, S.Pd., M.Pd' &&
        grpAdi?.examinerNpp === '1991041201' &&
        grpDafa?.examinerUserId === 'usr_mgm_dafa' &&
        grpDafaRenamed?.examinerName === 'Dafa Maulana, M.Pd' &&
        guruDisplayResolved.examinerName === 'Nurul Farhiyah, S.Pd., Gr' &&
        guruDisplayResolved.examinerNpp === '1993050503',
      `staff=${staffDir.length}, adiId=${grpAdi?.examinerUserId}, renamed=${grpDafaRenamed?.examinerName}, resolved=${guruDisplayResolved.examinerName}`
    );

    // Test 13: Supabase Cloud Oral Exam Sessions Endpoint (RBAC, Relational + Pre-Migration Fallback, Zero localStorage)
    const relationalRows = new Map<string, any>();
    const kvRows = new Map<string, any>();
    let simulateMissingTable = true;

    const fakeCloudDb = {
      from: (table: string) => {
        const filters: Record<string, any> = {};
        let likePattern = '';
        const makeResult = () => {
          if (table === 'oral_exam_sessions') {
            if (simulateMissingTable) {
              return { data: null, error: { code: '42P01', message: 'relation "public.oral_exam_sessions" does not exist' } };
            }
            let arr = Array.from(relationalRows.values());
            if (filters.academic_year) arr = arr.filter((r) => r.academic_year === filters.academic_year);
            return { data: arr, error: null };
          }
          if (table === 'system_settings') {
            let arr = Array.from(kvRows.values());
            if (filters.key) arr = arr.filter((r) => r.key === filters.key);
            if (likePattern) {
              const prefix = likePattern.replace(/%$/g, '');
              arr = arr.filter((r) => String(r.key).startsWith(prefix));
            }
            return { data: arr, error: null };
          }
          return { data: [], error: null };
        };

        const chain: any = {
          select: () => chain,
          eq: (col: string, val: any) => {
            filters[col] = val;
            return chain;
          },
          like: (_col: string, pat: string) => {
            likePattern = pat;
            return chain;
          },
          in: () => chain,
          order: () => chain,
          limit: () => Promise.resolve(makeResult()),
          maybeSingle: () => {
            const res = makeResult();
            return Promise.resolve({ data: res.data?.[0] ?? null, error: res.error });
          },
          upsert: (row: any) => {
            if (table === 'oral_exam_sessions') {
              if (simulateMissingTable) {
                return Promise.resolve({
                  error: { code: '42P01', message: 'relation "public.oral_exam_sessions" does not exist' },
                });
              }
              relationalRows.set(row.id, row);
              return Promise.resolve({ error: null });
            }
            if (table === 'system_settings') {
              kvRows.set(row.key, row);
              return Promise.resolve({ error: null });
            }
            return Promise.resolve({ error: null });
          },
          delete: () => ({
            eq: (_col: string, val: any) => {
              if (table === 'oral_exam_sessions') relationalRows.delete(val);
              if (table === 'system_settings') kvRows.delete(val);
              return Promise.resolve({ error: null });
            },
          }),
          then: (resolve: any, reject?: any) => Promise.resolve(makeResult()).then(resolve, reject),
        };
        return chain;
      },
    };

    const guruAdiAuth = {
      ok: true as const,
      userId: 'usr_adi_cloud',
      role: 'GURU',
      sessionId: 'sess_adi_1',
      user: {
        id: 'usr_adi_cloud',
        nip: '1991041201',
        full_name: 'Adi Prastyo, S.Pd',
        role: 'GURU',
        position: 'Guru',
        avatar_url: null,
        phone_number: null,
      },
    };
    const guruOtherAuth = {
      ok: true as const,
      userId: 'usr_other_99',
      role: 'GURU',
      sessionId: 'sess_other_1',
      user: {
        id: 'usr_other_99',
        nip: null,
        full_name: 'Guru Lain Bukan Penguji',
        role: 'GURU',
        position: 'Guru',
        avatar_url: null,
        phone_number: null,
      },
    };
    const kepsekAuth = {
      ok: true as const,
      userId: 'usr_kepsek_ro',
      role: 'KEPSEK',
      sessionId: 'sess_kepsek_1',
      user: {
        id: 'usr_kepsek_ro',
        nip: null,
        full_name: 'Kepala Sekolah',
        role: 'KEPSEK',
        position: 'Kepsek',
        avatar_url: null,
        phone_number: null,
      },
    };
    const adminAuth = {
      ok: true as const,
      userId: 'usr_admin_cloud',
      role: 'ADMIN',
      sessionId: 'sess_admin_1',
      user: {
        id: 'usr_admin_cloud',
        nip: null,
        full_name: 'Administrator',
        role: 'ADMIN',
        position: 'Admin',
        avatar_url: null,
        phone_number: null,
      },
    };

    const cloudSessionPayload = {
      id: 'oral_session_cloud_test_1',
      templateType: 'BTQ_HAFALAN',
      subjectScope: 'BTQ_ONLY',
      criteriaLabels: ['Tajwid & Makhraj', 'Kelancaran Bacaan', 'Hafalan & Adab'],
      groupId: 'oral_grp_01_adi',
      title: 'Ujian Lisan BTQ - Kelas 7',
      academicYear: '2026/2027',
      semester: 'GANJIL',
      examinerUserId: 'usr_adi_cloud',
      examinerName: 'Adi Prastyo, S.Pd',
      examinerNpp: '1991041201',
      roomNumber: 'Ruang 01',
      className: '7',
      date: '2026-11-27',
      totalQuestions: 3,
      students: [
        {
          studentId: 'k7_1',
          studentName: 'Afhtar Shakil',
          btqCriteria: [95, 94, 96],
          btqScore: 95,
          btqPredicate: 'A',
        },
      ],
    };

    let kvSaveStatus = 0;
    let kvSavedBeforeMigration = false;
    let relSaveStatus = 0;
    let relCleanedLegacyKv = false;
    let otherGuruForbidden = 0;
    let kepsekForbidden = 0;
    let guruDeleteForbidden = 0;
    let adiVisibleCount = 0;
    let otherVisibleCount = 0;
    let kepsekVisibleCount = 0;
    let adminVisibleCount = 0;
    let adminDeleteStatus = 0;

    try {
      setServerSupabaseClient(fakeCloudDb);
      // 13a: Sebelum migrasi 73 dijalankan (42P01), nilai tetap tersimpan di Supabase system_settings
      const kvRes = await handleSaveOralExamSession({ session: cloudSessionPayload }, guruAdiAuth);
      kvSaveStatus = kvRes.status;
      kvSavedBeforeMigration = kvRows.has(`oral_exam_session_${cloudSessionPayload.id}`);

      // 13b: Setelah migrasi 73 dijalankan, nilai tersimpan langsung di tabel relational oral_exam_sessions
      simulateMissingTable = false;
      const relRes = await handleSaveOralExamSession(
        {
          session: {
            ...cloudSessionPayload,
            students: [{ studentId: 'k7_1', studentName: 'Afhtar Shakil', btqScore: 98, btqPredicate: 'A' }],
          },
        },
        guruAdiAuth
      );
      relSaveStatus = relRes.status;
      relCleanedLegacyKv = !kvRows.has(`oral_exam_session_${cloudSessionPayload.id}`);

      // 13c: RBAC enforcement (Guru lain & Kepsek ditolak mutasi)
      otherGuruForbidden = (await handleSaveOralExamSession({ session: cloudSessionPayload }, guruOtherAuth)).status;
      kepsekForbidden = (await handleSaveOralExamSession({ session: cloudSessionPayload }, kepsekAuth)).status;
      guruDeleteForbidden = (await handleDeleteOralExamSession({ sessionId: cloudSessionPayload.id }, guruAdiAuth)).status;

      // 13d: Transparansi Baca: Semua peran (Penguji, Guru lain, Kepsek, & Admin) dapat melihat hasil penilaian,
      // sedangkan mutasi tetap dikunci strictly per penguji/admin
      adiVisibleCount = (await handleListOralExamSessions('2026/2027', guruAdiAuth)).body.sessions?.length || 0;
      otherVisibleCount = (await handleListOralExamSessions('2026/2027', guruOtherAuth)).body.sessions?.length || 0;
      kepsekVisibleCount = (await handleListOralExamSessions('2026/2027', kepsekAuth)).body.sessions?.length || 0;
      adminVisibleCount = (await handleListOralExamSessions('2026/2027', adminAuth)).body.sessions?.length || 0;

      // 13e: Admin delete cleans relational & fallback
      adminDeleteStatus = (await handleDeleteOralExamSession({ sessionId: cloudSessionPayload.id }, adminAuth)).status;
    } finally {
      resetServerSupabaseClient();
    }

    assert(
      'Supabase Cloud Sessions: Semua Guru, Kepsek & Admin dapat memantau hasil (read-all), sedangkan mutasi RBAC tetap ketat per penguji',
      kvSaveStatus === 200 &&
        kvSavedBeforeMigration &&
        relSaveStatus === 200 &&
        relCleanedLegacyKv &&
        otherGuruForbidden === 403 &&
        kepsekForbidden === 403 &&
        guruDeleteForbidden === 403 &&
        adiVisibleCount === 1 &&
        otherVisibleCount === 1 &&
        kepsekVisibleCount === 1 &&
        adminVisibleCount === 1 &&
        adminDeleteStatus === 200 &&
        relationalRows.size === 0,
      `kv=${kvSaveStatus}(${kvSavedBeforeMigration}), rel=${relSaveStatus}(clean=${relCleanedLegacyKv}), other403=${otherGuruForbidden}, ro403=${kepsekForbidden}, del403=${guruDeleteForbidden}, lists=${adiVisibleCount}/${otherVisibleCount}/${kepsekVisibleCount}/${adminVisibleCount}`
    );

    await OralExamAssignmentRepository.resetToOfficialDefaults('2026/2027', 'MOCK_TOKEN');

    // =========================================================================
    // Test 14: Jadwal Resmi Pelaksanaan Ujian Lisan (30 Nov - 04 Des 2026)
    // =========================================================================
    const upcomingStatus = getOralExamPeriodStatus('2026-11-28');
    const ongoingDay3Status = getOralExamPeriodStatus('2026-12-02');
    const completedStatus = getOralExamPeriodStatus('2026-12-05');

    assert(
      'Jadwal Pelaksanaan 30 Nov - 04 Des 2026: Rentang 5 hari, default date clamp, & status periode akurat',
      ORAL_EXAM_SCHEDULE_DAYS.length === 5 &&
        ORAL_EXAM_SCHEDULE_DAYS[0].date === '2026-11-30' &&
        ORAL_EXAM_SCHEDULE_DAYS[4].date === '2026-12-04' &&
        resolveDefaultOralExamDate('2026-11-28') === '2026-11-30' &&
        resolveDefaultOralExamDate('2026-12-02') === '2026-12-02' &&
        resolveDefaultOralExamDate('2026-12-10') === '2026-12-04' &&
        upcomingStatus.phase === 'UPCOMING' &&
        ongoingDay3Status.phase === 'ONGOING' &&
        ongoingDay3Status.activeDayNumber === 3 &&
        completedStatus.phase === 'COMPLETED',
      `days=${ORAL_EXAM_SCHEDULE_DAYS.length}, before=${resolveDefaultOralExamDate('2026-11-28')}, mid=${resolveDefaultOralExamDate('2026-12-02')}, after=${resolveDefaultOralExamDate('2026-12-10')}, phases=${upcomingStatus.phase}/${ongoingDay3Status.phase}(d${ongoingDay3Status.activeDayNumber})/${completedStatus.phase}`
    );
  } finally {
    ProviderFactory.setProvider(prevProvider);
  }

  return { passed, failed, results };
};
