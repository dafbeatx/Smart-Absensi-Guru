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
} from '../grademaster-sync.service';
import { ExamCorrectionRepository } from '../../repositories/ExamCorrectionRepository';
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
