/**
 * SMART ABSENSI GURU — GRADEMASTER SCORE SYNC TEST SUITE
 * Memverifikasi sinkronisasi nilai siswa ke GradeMaster OS (Supabase) TA 2026/2027:
 * 1. Wadah Sesi (gm_sessions): format slash academic_year '2026/2027', is_public=true, scoring_config, student_list
 * 2. Nilai Siswa (gm_students): is_deleted=false, original_score=final_score, remedial_status ('PASSED'/'NONE')
 * 3. Idempotensi re-sync & anti-duplikasi
 * 4. Helper syncExistingSessionToGradeMaster & ExamCorrectionRepository integrasi
 */

import { ProviderFactory } from '../../providers/provider-factory';
import { MockProvider } from '../../providers/mock-provider.service';
import {
  syncScoresToGradeMaster,
  syncExistingSessionToGradeMaster,
} from '../grademaster-sync.service';
import { ExamCorrectionRepository } from '../../repositories/ExamCorrectionRepository';
import type { TestSuiteResult } from '../test-runner.service';

export async function runGradeMasterScoreSyncTestSuite(): Promise<TestSuiteResult> {
  const results: { testName: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

  const mockProvider = new MockProvider();
  ProviderFactory.setProvider(mockProvider);

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 1: syncScoresToGradeMaster creates session with exact TA 2026/2027 & is_public=true
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const syncRes = await syncScoresToGradeMaster({
      className: '9A',
      subject: 'Matematika',
      academicYear: '2026/2027',
      examType: 'HARIAN',
      teacherName: 'Budi Santoso, S.Pd.',
      kkm: 75,
      scores: [
        { studentName: 'Ahmad Fauzi', score: 85 },
        { studentName: 'Budi Pratama', score: 65 },
      ],
    });

    const sessions = await mockProvider.getExamSessions();
    const createdSession = sessions.find((s) => s.id === syncRes.sessionId);

    const isSessionValid =
      syncRes.success &&
      syncRes.count === 2 &&
      !!createdSession &&
      createdSession.academic_year === '2026/2027' &&
      createdSession.class_name === '9A' &&
      createdSession.subject === 'Matematika' &&
      createdSession.is_public === true &&
      createdSession.kkm === 75 &&
      Array.isArray(createdSession.student_list) &&
      createdSession.student_list.includes('Ahmad Fauzi') &&
      createdSession.student_list.includes('Budi Pratama');

    results.push({
      testName: 'GradeMaster Sync 01: Sesi gm_sessions terbentuk dengan TA 2026/2027, is_public=true & student_list',
      status: isSessionValid ? 'PASS' : 'FAIL',
      details: isSessionValid
        ? `Session ID: ${syncRes.sessionId}, Academic Year: ${createdSession?.academic_year}, is_public: ${createdSession?.is_public}`
        : `Gagal memvalidasi sesi: ${JSON.stringify(createdSession)}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'GradeMaster Sync 01: Sesi gm_sessions terbentuk dengan TA 2026/2027, is_public=true & student_list',
      status: 'FAIL',
      details: err?.message || String(err),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 2: Normalisasi Academic Year dari strip '2026-2027' menjadi slash '2026/2027'
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const syncRes = await syncScoresToGradeMaster({
      className: '9B',
      subject: 'Informatika',
      academicYear: '2026-2027', // sengaja menggunakan format strip
      examType: 'UH',
      teacherName: 'Siti Aminah, M.Kom.',
      scores: [{ studentName: 'Citra Lestari', score: 90 }],
    });

    const sessions = await mockProvider.getExamSessions();
    const session = sessions.find((s) => s.id === syncRes.sessionId);

    const isNormalized = session && session.academic_year === '2026/2027';

    results.push({
      testName: 'GradeMaster Sync 02: Normalisasi tahun ajaran otomatis dari "2026-2027" ke slash "2026/2027"',
      status: isNormalized ? 'PASS' : 'FAIL',
      details: isNormalized
        ? `Format tersimpan: ${session?.academic_year}`
        : `Gagal: academic_year tersimpan sebagai ${session?.academic_year}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'GradeMaster Sync 02: Normalisasi tahun ajaran otomatis dari "2026-2027" ke slash "2026/2027"',
      status: 'FAIL',
      details: err?.message || String(err),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 3: gm_students fields: is_deleted=false, original_score=final_score, remedial_status
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const syncRes = await syncScoresToGradeMaster({
      className: '8A',
      subject: 'IPA',
      academicYear: '2026/2027',
      examType: 'HARIAN',
      kkm: 75,
      scores: [
        { studentName: 'Dewi Sartika', score: 80 }, // >= 75 -> PASSED
        { studentName: 'Eko Prasetyo', score: 60 }, // < 75 -> NONE
      ],
    });

    const gradedStudents = await mockProvider.getGradedStudents(syncRes.sessionId!);
    const dewi = gradedStudents.find((s) => s.name === 'Dewi Sartika');
    const eko = gradedStudents.find((s) => s.name === 'Eko Prasetyo');

    const isDewiValid =
      !!dewi &&
      dewi.is_deleted === false &&
      dewi.final_score === 80 &&
      dewi.original_score === 80 &&
      dewi.mcq_score === 80 &&
      dewi.essay_score === 0 &&
      dewi.remedial_status === 'PASSED';

    const isEkoValid =
      !!eko &&
      eko.is_deleted === false &&
      eko.final_score === 60 &&
      eko.original_score === 60 &&
      eko.mcq_score === 60 &&
      eko.essay_score === 0 &&
      eko.remedial_status === 'NONE';

    const isPassed = isDewiValid && isEkoValid;

    results.push({
      testName: 'GradeMaster Sync 03: gm_students strictly memenuhi is_deleted=false, original_score, & remedial_status',
      status: isPassed ? 'PASS' : 'FAIL',
      details: isPassed
        ? `Dewi (80): is_deleted=${dewi?.is_deleted}, remedial=${dewi?.remedial_status}; Eko (60): remedial=${eko?.remedial_status}`
        : `Validasi gagal: Dewi=${JSON.stringify(dewi)}, Eko=${JSON.stringify(eko)}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'GradeMaster Sync 03: gm_students strictly memenuhi is_deleted=false, original_score, & remedial_status',
      status: 'FAIL',
      details: err?.message || String(err),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 4: Idempotensi Re-sync (Pembaruan nilai tanpa membuat sesi atau baris ganda)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Sync pertama
    const res1 = await syncScoresToGradeMaster({
      className: '7A',
      subject: 'Bahasa Indonesia',
      academicYear: '2026/2027',
      examType: 'HARIAN',
      scores: [{ studentName: 'Fajar Hidayat', score: 70 }],
    });

    // Sync kedua untuk siswa yang sama dengan nilai remedial baru (85)
    const res2 = await syncScoresToGradeMaster({
      className: '7A',
      subject: 'Bahasa Indonesia',
      academicYear: '2026/2027',
      examType: 'HARIAN',
      scores: [
        { studentName: 'Fajar Hidayat', score: 85 },
        { studentName: 'Gita Gutawa', score: 95 },
      ],
    });

    const sessions = await mockProvider.getExamSessions();
    const matchingSessions = sessions.filter(
      (s) => s.class_name === '7A' && s.subject === 'Bahasa Indonesia' && s.academic_year === '2026/2027'
    );

    const graded = await mockProvider.getGradedStudents(res1.sessionId!);
    const fajar = graded.filter((s) => s.name === 'Fajar Hidayat');

    const isIdempotent =
      res1.sessionId === res2.sessionId &&
      matchingSessions.length === 1 &&
      fajar.length === 1 &&
      fajar[0].final_score === 85 &&
      fajar[0].remedial_status === 'PASSED' &&
      graded.length === 2;

    results.push({
      testName: 'GradeMaster Sync 04: Idempotensi re-sync aman (1 sesi tunggal, nilai terbarui ke 85, 0 baris duplikat)',
      status: isIdempotent ? 'PASS' : 'FAIL',
      details: isIdempotent
        ? `Session ID tetap sama, Fajar skor terbarui ke ${fajar[0]?.final_score}, total siswa: ${graded.length}`
        : `Gagal idempotensi: sessions=${matchingSessions.length}, fajarCount=${fajar.length}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'GradeMaster Sync 04: Idempotensi re-sync aman (1 sesi tunggal, nilai terbarui ke 85, 0 baris duplikat)',
      status: 'FAIL',
      details: err?.message || String(err),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 5: syncExistingSessionToGradeMaster mengonversi sesi aktif Smart Absensi
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    // Buat sesi biasa lewat ExamCorrectionRepository
    const normalSession = await ExamCorrectionRepository.saveSession({
      session_name: 'PTS - Seni Budaya - 9A (2026/2027)',
      teacher: 'Hendra Gunawan, S.Sn.',
      subject: 'Seni Budaya',
      class_name: '9A',
      school_level: 'SMP',
      academic_year: '2026/2027',
      exam_type: 'PTS',
      kkm: 75,
      answer_key: ['A', 'B', 'C', 'D'],
      student_list: ['Hanafi', 'Irma'],
    });

    // Simpan nilai untuk sesi ini
    await ExamCorrectionRepository.saveGradedStudent({
      session_id: normalSession.id,
      name: 'Hanafi',
      final_score: 88,
    });
    await ExamCorrectionRepository.saveGradedStudent({
      session_id: normalSession.id,
      name: 'Irma',
      final_score: 72,
    });

    // Panggil syncExistingSessionToGradeMaster
    const syncRes = await syncExistingSessionToGradeMaster(normalSession.id);

    const isSyncSuccess = syncRes.success && syncRes.count === 2;

    results.push({
      testName: 'GradeMaster Sync 05: syncExistingSessionToGradeMaster berhasil mengonversi sesi aktif ke GradeMaster',
      status: isSyncSuccess ? 'PASS' : 'FAIL',
      details: isSyncSuccess
        ? `Berhasil sinkronkan ${syncRes.count} siswa dari sesi ${normalSession.session_name}`
        : `Gagal sinkronkan: ${JSON.stringify(syncRes)}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'GradeMaster Sync 05: syncExistingSessionToGradeMaster berhasil mengonversi sesi aktif ke GradeMaster',
      status: 'FAIL',
      details: err?.message || String(err),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 6: Validasi Parameter Wajib (className & subject tidak boleh kosong)
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    let errorThrown = false;
    try {
      await syncScoresToGradeMaster({
        className: '',
        subject: 'Matematika',
        scores: [{ studentName: 'Test', score: 100 }],
      });
    } catch {
      errorThrown = true;
    }

    results.push({
      testName: 'GradeMaster Sync 06: Penolakan parameter tidak lengkap (className kosong memicu error eksplisit)',
      status: errorThrown ? 'PASS' : 'FAIL',
      details: errorThrown ? 'Error berhasil dicegat' : 'Gagal: fungsi tidak menolak parameter kosong',
    });
  } catch (err: any) {
    results.push({
      testName: 'GradeMaster Sync 06: Penolakan parameter tidak lengkap (className kosong memicu error eksplisit)',
      status: 'FAIL',
      details: err?.message || String(err),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Test 7: ExamCorrectionRepository.syncSessionToGradeMaster integrasi end-to-end
  // ─────────────────────────────────────────────────────────────────────────────
  try {
    const session = await ExamCorrectionRepository.saveSession({
      session_name: 'UAS - Matematika - 8B (2026/2027)',
      teacher: 'Ahmad Guru',
      subject: 'Matematika',
      class_name: '8B',
      school_level: 'SMP',
      academic_year: '2026/2027',
      kkm: 75,
      answer_key: ['A', 'B'],
      student_list: ['Joko'],
    });

    await ExamCorrectionRepository.saveGradedStudent({
      session_id: session.id,
      name: 'Joko',
      final_score: 92,
    });

    const repoSyncRes = await ExamCorrectionRepository.syncSessionToGradeMaster(session.id);

    const isRepoValid = repoSyncRes.success && repoSyncRes.count === 1;

    results.push({
      testName: 'GradeMaster Sync 07: ExamCorrectionRepository.syncSessionToGradeMaster bekerja end-to-end',
      status: isRepoValid ? 'PASS' : 'FAIL',
      details: isRepoValid ? `Tersinkron count: ${repoSyncRes.count}` : `Gagal: ${JSON.stringify(repoSyncRes)}`,
    });
  } catch (err: any) {
    results.push({
      testName: 'GradeMaster Sync 07: ExamCorrectionRepository.syncSessionToGradeMaster bekerja end-to-end',
      status: 'FAIL',
      details: err?.message || String(err),
    });
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    suiteName: 'GradeMaster Score Sync Suite (TA 2026/2027)',
    passed,
    failed,
    results,
  };
}
