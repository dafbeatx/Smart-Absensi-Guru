/**
 * SMART ABSENSI GURU — GRADEMASTER SCORE SYNC TEST SUITE (HTTP API BRIDGE)
 * Memverifikasi sinkronisasi nilai siswa ke Portal Siswa (GradeMaster OS / Web Input Nilai)
 * melalui HTTP API Bridge:
 * 1. Dispatch ke URL https://web-input-nilai.vercel.app/api/grademaster/sync-from-smart-absensi
 * 2. Header otentikasi x-sync-key: gm_sync_smart_absensi_2026
 * 3. Format payload JSON: className, subject, academicYear (2026/2027), examType, scores
 * 4. Normalisasi academicYear ('2026-2027' -> '2026/2027')
 * 5. Formatting originalScore pada daftar scores
 * 6. Penanganan error API dan validasi input
 * 7. Integrasi helper syncExistingSessionToGradeMaster & ExamCorrectionRepository
 */

import { ProviderFactory } from '../../providers/provider-factory';
import { MockProvider } from '../../providers/mock-provider.service';
import {
  syncScoresToGradeMaster,
  syncExistingSessionToGradeMaster,
  syncAllSessionsToGradeMaster,
  syncBehaviorsToGradeMaster,
  syncClassBehaviorsToGradeMaster,
} from '../grademaster-sync.service';
import { ExamCorrectionRepository } from '../../repositories/ExamCorrectionRepository';
import { StudentBehaviorRepository } from '../../repositories/StudentBehaviorRepository';
import type { TestSuiteResult } from '../test-runner.service';

export async function runGradeMasterScoreSyncTestSuite(): Promise<TestSuiteResult> {
  const results: { testName: string; status: 'PASS' | 'FAIL'; details?: string }[] = [];

  const originalFetch = globalThis.fetch;
  const fetchState: { lastCall: { url: string; options: any } | null } = { lastCall: null };

  let mockFetchResponse: { ok: boolean; status: number; json: () => Promise<any> } = {
    ok: true,
    status: 200,
    json: async () => ({
      success: true,
      message: 'Berhasil sinkronisasi nilai ke Portal Siswa',
      processedCount: 2,
      sessionId: 'sess_gm_mock_123',
    }),
  };

  // Mock global fetch for deterministic testing without external network calls
  globalThis.fetch = (async (url: any, options: any) => {
    fetchState.lastCall = { url: String(url), options };
    return mockFetchResponse;
  }) as any;

  try {
    const mockProvider = new MockProvider();
    ProviderFactory.setProvider(mockProvider);

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 1: syncScoresToGradeMaster mengirim payload ke URL & header yang tepat
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      mockFetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Berhasil sinkronisasi 2 nilai ke Portal Siswa',
          processedCount: 2,
          sessionId: 'sess_test_1',
        }),
      };

      const syncRes = await syncScoresToGradeMaster({
        className: '9A',
        subject: 'Matematika',
        academicYear: '2026/2027',
        examType: 'HARIAN',
        teacherName: 'Budi Santoso, S.Pd.',
        kkm: 75,
        scores: [
          { studentName: 'Ahmad Fauzi', score: 85, originalScore: 85 },
          { studentName: 'Budi Pratama', score: 65, originalScore: 65 },
        ],
      });

      const call = fetchState.lastCall;
      const body = call ? JSON.parse(call.options.body) : null;
      const headers = call?.options?.headers || {};

      const isValid =
        syncRes.success &&
        syncRes.count === 2 &&
        call?.url === 'https://web-input-nilai.vercel.app/api/grademaster/sync-from-smart-absensi' &&
        headers['Content-Type'] === 'application/json' &&
        headers['x-sync-key'] === 'gm_sync_smart_absensi_2026' &&
        body?.className === '9A' &&
        body?.subject === 'Matematika' &&
        body?.academicYear === '2026/2027' &&
        body?.examType === 'HARIAN' &&
        body?.scores?.length === 2 &&
        body?.scores[0].studentName === 'Ahmad Fauzi' &&
        body?.scores[0].score === 85 &&
        body?.scores[0].originalScore === 85;

      results.push({
        testName: 'GradeMaster Sync 01: HTTP API Bridge dipanggil dengan URL, header x-sync-key, & body yang tepat',
        status: isValid ? 'PASS' : 'FAIL',
        details: isValid
          ? `URL: ${call?.url}, Header key: ${headers['x-sync-key']}, Payload valid`
          : `Gagal verifikasi dispatch HTTP: ${JSON.stringify({ call, syncRes })}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 01: HTTP API Bridge dipanggil dengan URL, header x-sync-key, & body yang tepat',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 2: Normalisasi Academic Year dari format strip '2026-2027' ke slash '2026/2027'
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      await syncScoresToGradeMaster({
        className: '9B',
        subject: 'Informatika',
        academicYear: '2026-2027', // format strip
        examType: 'UH',
        teacherName: 'Siti Aminah, M.Kom.',
        scores: [{ studentName: 'Citra Lestari', score: 90 }],
      });

      const call = fetchState.lastCall;
      const body = call ? JSON.parse(call.options.body) : null;
      const isNormalized = body && body.academicYear === '2026/2027';

      results.push({
        testName: 'GradeMaster Sync 02: Normalisasi tahun ajaran otomatis dari "2026-2027" ke slash "2026/2027"',
        status: isNormalized ? 'PASS' : 'FAIL',
        details: isNormalized
          ? `Tahun ajaran dinormalisasi ke: ${body?.academicYear}`
          : `Gagal: academicYear dikirim sebagai: ${body?.academicYear}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 02: Normalisasi tahun ajaran otomatis dari "2026-2027" ke slash "2026/2027"',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 3: Formatting originalScore (otomatis disamakan dengan score jika tidak diset)
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      await syncScoresToGradeMaster({
        className: '8A',
        subject: 'IPA',
        scores: [
          { studentName: 'Dewi Sartika', score: 80 }, // originalScore undefined
          { studentName: 'Eko Prasetyo', score: 60, originalScore: 55 }, // originalScore eksplisit
        ],
      });

      const call = fetchState.lastCall;
      const body = call ? JSON.parse(call.options.body) : null;
      const s1 = body?.scores?.[0];
      const s2 = body?.scores?.[1];

      const isScoresValid =
        s1?.score === 80 &&
        s1?.originalScore === 80 &&
        s2?.score === 60 &&
        s2?.originalScore === 55;

      results.push({
        testName: 'GradeMaster Sync 03: originalScore otomatis terisi dengan benar (fallback ke score atau nilai asli)',
        status: isScoresValid ? 'PASS' : 'FAIL',
        details: isScoresValid
          ? `Dewi: score=80, orig=80; Eko: score=60, orig=55`
          : `Gagal validasi score payload: ${JSON.stringify(body?.scores)}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 03: originalScore otomatis terisi dengan benar (fallback ke score atau nilai asli)',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 4: Penanganan respon error dari API bridge (HTTP 400/500 melempar exception)
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      mockFetchResponse = {
        ok: false,
        status: 401,
        json: async () => ({
          error: 'UNAUTHORIZED_SYNC_KEY: Kunci x-sync-key tidak valid.',
        }),
      };

      let errorCaught = false;
      let errorMsg = '';
      try {
        await syncScoresToGradeMaster({
          className: '7A',
          subject: 'Bahasa Indonesia',
          scores: [{ studentName: 'Fajar', score: 75 }],
        });
      } catch (err: any) {
        errorCaught = true;
        errorMsg = err.message;
      }

      const isErrorHandled = errorCaught && errorMsg.includes('UNAUTHORIZED_SYNC_KEY');

      results.push({
        testName: 'GradeMaster Sync 04: Penanganan respon error dari HTTP API Bridge (melempar pesan kesalahan yang jelas)',
        status: isErrorHandled ? 'PASS' : 'FAIL',
        details: isErrorHandled ? `Pesan error tertangkap: "${errorMsg}"` : 'Gagal: error HTTP tidak dicegat',
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 04: Penanganan respon error dari HTTP API Bridge (melempar pesan kesalahan yang jelas)',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 5: Validasi Parameter Wajib (className & subject tidak boleh kosong)
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
        testName: 'GradeMaster Sync 05: Penolakan parameter tidak lengkap (className kosong memicu error eksplisit)',
        status: errorThrown ? 'PASS' : 'FAIL',
        details: errorThrown ? 'Error berhasil dicegat' : 'Gagal: fungsi tidak menolak parameter kosong',
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 05: Penolakan parameter tidak lengkap (className kosong memicu error eksplisit)',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 6: syncExistingSessionToGradeMaster mengonversi sesi aktif dan kirim via HTTP
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      mockFetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Berhasil sinkronisasi 2 siswa ke Portal Siswa',
          processedCount: 2,
        }),
      };

      // Buat sesi di provider lokal
      const normalSession = await mockProvider.saveExamSession({
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

      await mockProvider.saveGradedStudent({
        session_id: normalSession.id,
        name: 'Hanafi',
        final_score: 88,
        original_score: 88,
      });
      await mockProvider.saveGradedStudent({
        session_id: normalSession.id,
        name: 'Irma',
        final_score: 72,
        original_score: 72,
      });

      const syncRes = await syncExistingSessionToGradeMaster(normalSession.id);

      const call = fetchState.lastCall;
      const body = call ? JSON.parse(call.options.body) : null;
      const isSyncSuccess =
        syncRes.success &&
        syncRes.count === 2 &&
        body?.className === '9A' &&
        body?.subject === 'Seni Budaya' &&
        body?.scores?.length === 2 &&
        body?.scores[0].studentName === 'Hanafi' &&
        body?.scores[0].score === 88;

      results.push({
        testName: 'GradeMaster Sync 06: syncExistingSessionToGradeMaster berhasil membaca sesi lokal & kirim ke HTTP bridge',
        status: isSyncSuccess ? 'PASS' : 'FAIL',
        details: isSyncSuccess
          ? `Berhasil sinkronkan ${syncRes.count} siswa dari sesi ${normalSession.session_name} ke Web Input Nilai`
          : `Gagal sinkronkan: ${JSON.stringify({ syncRes, body })}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 06: syncExistingSessionToGradeMaster berhasil membaca sesi lokal & kirim ke HTTP bridge',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 7: ExamCorrectionRepository.syncSessionToGradeMaster integrasi end-to-end
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      mockFetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Berhasil sinkronisasi nilai ke Portal Siswa',
          processedCount: 1,
        }),
      };

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
        original_score: 92,
      });

      const repoSyncRes = await ExamCorrectionRepository.syncSessionToGradeMaster(session.id);

      const isRepoValid = repoSyncRes.success && repoSyncRes.count === 1;

      results.push({
        testName: 'GradeMaster Sync 07: ExamCorrectionRepository.syncSessionToGradeMaster bekerja end-to-end via bridge',
        status: isRepoValid ? 'PASS' : 'FAIL',
        details: isRepoValid ? `Tersinkron count: ${repoSyncRes.count}` : `Gagal: ${JSON.stringify(repoSyncRes)}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 07: ExamCorrectionRepository.syncSessionToGradeMaster bekerja end-to-end via bridge',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 8: syncBehaviorsToGradeMaster mengirim payload behavior ke HTTP bridge
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      mockFetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Berhasil sinkronisasi 2 catatan sikap ke Portal Siswa',
          processedCount: 2,
        }),
      };

      const syncRes = await syncBehaviorsToGradeMaster({
        className: '9A',
        academicYear: '2026/2027',
        teacherName: 'Guru Pengampu',
        behaviors: [
          {
            studentName: 'Ahmad Rizki',
            type: 'BAD',
            pointsDelta: 10,
            reason: 'Terlambat masuk kelas 15 menit',
            date: '2026-10-09',
          },
          {
            studentName: 'Siti Nurhaliza',
            type: 'GOOD',
            pointsDelta: 5,
            reason: 'Merapikan lab komputer dan membantu guru',
            date: '2026-10-09',
          },
        ],
      });

      const call = fetchState.lastCall;
      const body = call ? JSON.parse(call.options.body) : null;
      const headers = call?.options?.headers || {};

      const isValid =
        syncRes.success &&
        syncRes.count === 2 &&
        call?.url === 'https://web-input-nilai.vercel.app/api/grademaster/sync-from-smart-absensi' &&
        headers['Content-Type'] === 'application/json' &&
        headers['x-sync-key'] === 'gm_sync_smart_absensi_2026' &&
        body?.className === '9A' &&
        body?.academicYear === '2026/2027' &&
        body?.teacherName === 'Guru Pengampu' &&
        body?.behaviors?.length === 2 &&
        body?.behaviors[0].studentName === 'Ahmad Rizki' &&
        body?.behaviors[0].type === 'BAD' &&
        body?.behaviors[0].pointsDelta === 10 &&
        body?.behaviors[0].reason === 'Terlambat masuk kelas 15 menit' &&
        body?.behaviors[0].date === '2026-10-09' &&
        body?.behaviors[1].studentName === 'Siti Nurhaliza' &&
        body?.behaviors[1].type === 'GOOD' &&
        body?.behaviors[1].pointsDelta === 5;

      results.push({
        testName: 'GradeMaster Sync 08: syncBehaviorsToGradeMaster mengirim payload behavior via HTTP bridge',
        status: isValid ? 'PASS' : 'FAIL',
        details: isValid
          ? `URL: ${call?.url}, Count: ${syncRes.count}, Behaviors: ${body?.behaviors?.length}`
          : `Gagal verifikasi: ${JSON.stringify({ syncRes, body })}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 08: syncBehaviorsToGradeMaster mengirim payload behavior via HTTP bridge',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 9: syncBehaviorsToGradeMaster menolak payload jika className kosong
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      let threwError = false;
      try {
        await syncBehaviorsToGradeMaster({
          className: '',
          behaviors: [
            {
              studentName: 'Ahmad Rizki',
              type: 'BAD',
              pointsDelta: 10,
              reason: 'Bolos pelajaran',
              date: '2026-10-09',
            },
          ],
        });
      } catch (err: any) {
        if (err?.message?.includes('className')) {
          threwError = true;
        }
      }

      results.push({
        testName: 'GradeMaster Sync 09: syncBehaviorsToGradeMaster menolak className kosong dengan error eksplisit',
        status: threwError ? 'PASS' : 'FAIL',
        details: threwError ? 'Error tertangkap dengan benar untuk className kosong' : 'Gagal mendeteksi className kosong',
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 09: syncBehaviorsToGradeMaster menolak className kosong dengan error eksplisit',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 10: syncClassBehaviorsToGradeMaster membaca catatan siswa lokal & kirim ke HTTP bridge
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      mockFetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Berhasil sinkronisasi catatan sikap ke Portal Siswa',
          processedCount: 1,
        }),
      };

      mockProvider.setMockStudentBehaviors([
        {
          id: 'stu_9b_bima',
          student_id: 'stu_9b_bima',
          student_name: 'Bima Sakti',
          class_name: '9B',
          academic_year: '2026/2027',
          total_points: 0,
          merits_points: 0,
          demerits_points: 0,
          net_points: 0,
          behavior_logs: [],
          sync_status: 'LOCAL_DRAFT',
        },
      ]);

      await mockProvider.recordStudentBehavior({
        studentId: 'stu_9b_bima',
        studentName: 'Bima Sakti',
        className: '9B',
        academicYear: '2026/2027',
        type: 'GOOD',
        points: 10,
        reason: 'Juara Olimpiade Matematika',
        violationDate: '2026-10-09',
        teacherName: 'Guru Matematika',
      });

      const syncClassRes = await syncClassBehaviorsToGradeMaster('9B', '2026/2027', 'Guru Matematika');
      const call = fetchState.lastCall;
      const body = call ? JSON.parse(call.options.body) : null;

      const isValid =
        syncClassRes.success &&
        (syncClassRes.count ?? 0) >= 1 &&
        body?.className === '9B' &&
        body?.behaviors?.some((b: any) => b.studentName === 'Bima Sakti' && b.type === 'GOOD');

      results.push({
        testName: 'GradeMaster Sync 10: syncClassBehaviorsToGradeMaster membaca catatan siswa lokal & kirim ke HTTP bridge',
        status: isValid ? 'PASS' : 'FAIL',
        details: isValid
          ? `Tersinkron ${syncClassRes.count} catatan sikap siswa untuk kelas 9B`
          : `Gagal: ${JSON.stringify({ syncClassRes, body })}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 10: syncClassBehaviorsToGradeMaster membaca catatan siswa lokal & kirim ke HTTP bridge',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 11: StudentBehaviorRepository.syncClassToGradeMaster integrasi end-to-end
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      mockFetchResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          success: true,
          message: 'Berhasil sinkronisasi catatan sikap ke Portal Siswa',
          processedCount: 1,
        }),
      };

      const repoRes = await StudentBehaviorRepository.syncClassToGradeMaster('9B', '2026/2027', 'Guru Matematika');
      const isRepoValid = repoRes.success && (repoRes.count ?? 0) >= 1;

      results.push({
        testName: 'GradeMaster Sync 11: StudentBehaviorRepository.syncClassToGradeMaster bekerja end-to-end via bridge',
        status: isRepoValid ? 'PASS' : 'FAIL',
        details: isRepoValid ? `Tersinkron count: ${repoRes.count}` : `Gagal: ${JSON.stringify(repoRes)}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 11: StudentBehaviorRepository.syncClassToGradeMaster bekerja end-to-end via bridge',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 12: syncAllSessionsToGradeMaster menyaring Tahun Ajaran & Semester tepat sasaran
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      const sessTarget = await mockProvider.saveExamSession({
        session_name: 'Penilaian Harian Matematika 9A (2026/2027) Ganjil',
        teacher: 'Guru Matematika',
        subject: 'Matematika',
        class_name: '9A',
        school_level: 'SMP',
        student_list: ['Siti Rahma'],
        exam_type: 'HARIAN',
        kkm: 75,
        answer_key: ['A', 'B'],
        academic_year: '2026/2027',
        semester: 'Ganjil',
      });

      await mockProvider.saveGradedStudent({
        session_id: sessTarget.id,
        student_user_id: 'stu_9a_01',
        name: 'Siti Rahma',
        final_score: 100,
        original_score: 100,
      });

      const sessOtherYear = await mockProvider.saveExamSession({
        session_name: 'Ujian IPA 9A (2025/2026) Genap',
        teacher: 'Guru IPA',
        subject: 'IPA',
        class_name: '9A',
        school_level: 'SMP',
        student_list: ['Budi Santoso'],
        exam_type: 'PTS',
        kkm: 75,
        answer_key: ['A'],
        academic_year: '2025/2026',
        semester: 'Genap',
      });

      await mockProvider.saveGradedStudent({
        session_id: sessOtherYear.id,
        student_user_id: 'stu_9a_02',
        name: 'Budi Santoso',
        final_score: 100,
        original_score: 100,
      });

      const bulkRes = await syncAllSessionsToGradeMaster({
        academicYear: '2026/2027',
        semester: 'Ganjil',
        className: '9A',
      });

      const isTargetValid =
        bulkRes.success &&
        bulkRes.academicYear === '2026/2027' &&
        bulkRes.semester === 'Ganjil' &&
        bulkRes.details.some((d) => d.subject === 'Matematika' && d.status === 'SUCCESS') &&
        !bulkRes.details.some((d) => d.subject === 'IPA');

      results.push({
        testName: 'GradeMaster Sync 12: syncAllSessionsToGradeMaster menyaring Tahun Ajaran & Semester tepat sasaran',
        status: isTargetValid ? 'PASS' : 'FAIL',
        details: isTargetValid
          ? `Berhasil menyaring target 2026/2027 Ganjil, total diproses: ${bulkRes.totalProcessed}`
          : `Gagal: ${JSON.stringify(bulkRes)}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 12: syncAllSessionsToGradeMaster menyaring Tahun Ajaran & Semester tepat sasaran',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 13: syncAllSessionsToGradeMaster melewati sesi kosong (tanpa nilai) secara otomatis
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      const sessEmpty = await mockProvider.saveExamSession({
        session_name: 'Draft Bahasa Indonesia 9A (2026/2027)',
        teacher: 'Guru Bahasa',
        subject: 'Bahasa Indonesia',
        class_name: '9A',
        school_level: 'SMP',
        student_list: ['Siswa Belum Dinilai'],
        exam_type: 'HARIAN',
        kkm: 75,
        answer_key: ['A'],
        academic_year: '2026/2027',
        semester: 'Ganjil',
      });

      const bulkRes = await syncAllSessionsToGradeMaster({
        academicYear: '2026/2027',
        semester: 'Ganjil',
        className: '9A',
      });

      const emptyDetail = bulkRes.details.find((d) => d.sessionId === sessEmpty.id);
      const isSkipValid = emptyDetail?.status === 'SKIPPED' && bulkRes.totalSkipped >= 1;

      results.push({
        testName: 'GradeMaster Sync 13: syncAllSessionsToGradeMaster melewati sesi kosong (tanpa nilai) otomatis',
        status: isSkipValid ? 'PASS' : 'FAIL',
        details: isSkipValid
          ? `Sesi kosong dilewati dengan status SKIPPED, total dilewati: ${bulkRes.totalSkipped}`
          : `Gagal: ${JSON.stringify(emptyDetail)}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 13: syncAllSessionsToGradeMaster melewati sesi kosong (tanpa nilai) otomatis',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 14: Anti-Duplikasi Cerdas (menggabungkan sesi duplikat & deduplikasi skor siswa)
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      const sessDupl1 = await mockProvider.saveExamSession({
        session_name: 'Penilaian Harian Bahasa Inggris 8A (Sesi 1)',
        teacher: 'Guru Inggris',
        subject: 'Bahasa Inggris',
        class_name: '8A',
        school_level: 'SMP',
        student_list: ['Rani Permata'],
        exam_type: 'HARIAN',
        kkm: 75,
        answer_key: ['A'],
        academic_year: '2026/2027',
        semester: 'Ganjil',
      });

      await mockProvider.saveGradedStudent({
        session_id: sessDupl1.id,
        student_user_id: 'stu_8a_01',
        name: 'Rani Permata',
        final_score: 80,
      });

      const sessDupl2 = await mockProvider.saveExamSession({
        session_name: 'Penilaian Harian Bahasa Inggris 8A (Sesi 2 Duplikat)',
        teacher: 'Guru Inggris',
        subject: 'Bahasa Inggris',
        class_name: '8A',
        school_level: 'SMP',
        student_list: ['Rani Permata', 'Budi Santoso'],
        exam_type: 'HARIAN',
        kkm: 75,
        answer_key: ['A'],
        academic_year: '2026/2027',
        semester: 'Ganjil',
      });

      // Update nilai Rani Permata menjadi 95 dan tambahkan Budi Santoso
      await mockProvider.saveGradedStudent({
        session_id: sessDupl2.id,
        student_user_id: 'stu_8a_01',
        name: 'Rani Permata',
        final_score: 95,
      });
      await mockProvider.saveGradedStudent({
        session_id: sessDupl2.id,
        student_user_id: 'stu_8a_02',
        name: 'Budi Santoso',
        final_score: 88,
      });

      const bulkRes = await syncAllSessionsToGradeMaster({
        academicYear: '2026/2027',
        semester: 'Ganjil',
        className: '8A',
      });

      const call = fetchState.lastCall;
      const body = call ? JSON.parse(call.options.body) : null;

      // Rani Permata hanya boleh muncul 1 kali di payload, dengan nilai terbaru 95
      const raniEntries = (body?.scores || []).filter(
        (s: any) => s.studentName.toLowerCase() === 'rani permata'
      );

      const isDedupValid =
        bulkRes.success &&
        raniEntries.length === 1 &&
        raniEntries[0].score === 95 &&
        (body?.scores || []).length === 2; // Rani & Budi

      results.push({
        testName: 'GradeMaster Sync 14: Anti-Duplikasi Cerdas berhasil menggabung sesi duplikat & deduplikasi siswa',
        status: isDedupValid ? 'PASS' : 'FAIL',
        details: isDedupValid
          ? `Anti-duplikasi sukses: Skor Rani = ${raniEntries[0]?.score}, total siswa unik = ${body?.scores?.length}`
          : `Gagal: ${JSON.stringify({ raniEntries, scores: body?.scores })}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 14: Anti-Duplikasi Cerdas berhasil menggabung sesi duplikat & deduplikasi siswa',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // Test 15: ExamCorrectionRepository.syncAllSessionsToGradeMaster dengan progress callback
    // ─────────────────────────────────────────────────────────────────────────────
    try {
      const progressLogs: any[] = [];
      const repoBulkRes = await ExamCorrectionRepository.syncAllSessionsToGradeMaster({
        academicYear: '2026/2027',
        semester: 'Ganjil',
        className: '8A',
        onProgress: (info) => {
          progressLogs.push(info);
        },
      });

      const isRepoValid =
        repoBulkRes.success &&
        progressLogs.length > 0 &&
        progressLogs.some((p) => p.status === 'DONE');

      results.push({
        testName: 'GradeMaster Sync 15: ExamCorrectionRepository.syncAllSessionsToGradeMaster dengan onProgress bekerja',
        status: isRepoValid ? 'PASS' : 'FAIL',
        details: isRepoValid
          ? `Berhasil eksekusi bulk sync via repository dengan ${progressLogs.length} event progress`
          : `Gagal: ${JSON.stringify({ repoBulkRes, progressLogs })}`,
      });
    } catch (err: any) {
      results.push({
        testName: 'GradeMaster Sync 15: ExamCorrectionRepository.syncAllSessionsToGradeMaster dengan onProgress bekerja',
        status: 'FAIL',
        details: err?.message || String(err),
      });
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  return {
    suiteName: 'GradeMaster Score Sync Suite (TA 2026/2027 HTTP Bridge)',
    passed,
    failed,
    results,
  };
}
