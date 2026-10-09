/**
 * SMART ABSENSI GURU — GRADEMASTER SCORE SYNCHRONIZATION SERVICE (HTTP API BRIDGE)
 * Menyinkronkan nilai ujian / penilaian harian guru langsung ke Portal Siswa (GradeMaster OS / Web Input Nilai)
 * Menggunakan endpoint HTTP API Bridge:
 * - URL: https://web-input-nilai.vercel.app/api/grademaster/sync-from-smart-absensi
 * - Header: x-sync-key: gm_sync_smart_absensi_2026
 * - Method: POST (JSON Body)
 */

import { ProviderFactory } from '../providers/provider-factory';
import type {
  SyncScoresToGradeMasterDTO,
  SyncScoresToGradeMasterResult,
  GradeMasterScoreItem,
} from '../types/database.types';
import { normalizeAcademicYearString } from '../utils/academic-year.utils';
import { logger } from '../utils/logger.utils';

export type SyncScoresParams = SyncScoresToGradeMasterDTO;

/**
 * Sinkronisasi data nilai siswa ke Portal Siswa GradeMaster via HTTP API Bridge
 */
export async function syncScoresToGradeMaster(payload: {
  className: string;
  subject: string;
  academicYear?: string;
  examType?: string;
  teacherName?: string;
  kkm?: number;
  scores: Array<{ studentName: string; score: number; originalScore?: number }>;
}): Promise<SyncScoresToGradeMasterResult> {
  const apiUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRADEMASTER_API_URL) ||
    'https://web-input-nilai.vercel.app/api/grademaster/sync-from-smart-absensi';

  const syncKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRADEMASTER_SYNC_KEY) ||
    'gm_sync_smart_absensi_2026';

  if (!payload.className || !payload.className.trim()) {
    throw new Error('INVALID_PAYLOAD: className wajib diisi.');
  }
  if (!payload.subject || !payload.subject.trim()) {
    throw new Error('INVALID_PAYLOAD: subject wajib diisi.');
  }

  const cleanClass = payload.className.trim();
  const cleanSubject = payload.subject.trim();
  const cleanYear = normalizeAcademicYearString(payload.academicYear || '2026/2027') || '2026/2027';
  const cleanExamType = payload.examType ? payload.examType.trim().toUpperCase() : 'HARIAN';
  const cleanTeacher = payload.teacherName?.trim() || 'Guru Pengampu';
  const cleanKkm = Number(payload.kkm) || 75;

  const formattedScores = (payload.scores || []).map((s) => ({
    studentName: s.studentName.trim(),
    score: Number(s.score),
    originalScore: s.originalScore !== undefined ? Number(s.originalScore) : Number(s.score),
  }));

  const bodyData = {
    className: cleanClass,
    subject: cleanSubject,
    academicYear: cleanYear,
    examType: cleanExamType,
    teacherName: cleanTeacher,
    kkm: cleanKkm,
    scores: formattedScores,
  };

  logger.info(
    'GradeMasterSyncService',
    `Mengirim ${formattedScores.length} nilai via HTTP API Bridge ke: ${apiUrl} (Kelas: ${cleanClass}, Mapel: ${cleanSubject}, TA: ${cleanYear})`
  );

  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-sync-key': syncKey,
    },
    body: JSON.stringify(bodyData),
  });

  const resJson = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = resJson.error || resJson.message || `HTTP ${response.status}: Gagal melakukan sinkronisasi ke Web Input Nilai`;
    logger.error('GradeMasterSyncService', 'Gagal memanggil HTTP API Bridge:', errorMsg);
    throw new Error(errorMsg);
  }

  logger.info(
    'GradeMasterSyncService',
    `Sinkronisasi berhasil: ${resJson.message || 'OK'} (Diproses: ${resJson.processedCount ?? formattedScores.length})`
  );

  return {
    success: true,
    message: resJson.message || 'Berhasil sinkronisasi nilai ke Portal Siswa',
    count: resJson.processedCount !== undefined ? Number(resJson.processedCount) : formattedScores.length,
    sessionId: resJson.sessionId,
  };
}

/**
 * Sinkronisasi seluruh nilai dari sesi ujian yang ada di Smart Absensi Guru ke GradeMaster
 */
export async function syncExistingSessionToGradeMaster(
  sessionId: string,
  token?: string
): Promise<SyncScoresToGradeMasterResult> {
  const provider = ProviderFactory.getProvider();

  // 1. Ambil detail sesi
  const sessions = await provider.getExamSessions(token);
  const session = sessions.find((s) => s.id === sessionId);

  if (!session) {
    throw new Error(`Sesi ujian ID ${sessionId} tidak ditemukan.`);
  }

  // 2. Ambil seluruh siswa yang dinilai di sesi ini
  const graded = await provider.getGradedStudents(sessionId, token);

  if (graded.length === 0) {
    return {
      success: true,
      count: 0,
      sessionId,
      message: 'Belum ada nilai siswa yang tersimpan pada sesi ini untuk disinkronkan.',
    };
  }

  // 3. Konversi nilai ke item GradeMaster
  const scores: GradeMasterScoreItem[] = graded.map((s) => ({
    studentName: s.name.trim(),
    score: Number(s.final_score) || 0,
    originalScore: Number(s.original_score !== undefined ? s.original_score : s.final_score) || 0,
  }));

  // 4. Jalankan sinkronisasi ke HTTP API Bridge
  return await syncScoresToGradeMaster({
    className: session.class_name,
    subject: session.subject,
    academicYear: session.academic_year || '2026/2027',
    examType: session.exam_type || 'HARIAN',
    teacherName: session.teacher,
    kkm: Number(session.kkm) || 75,
    scores,
  });
}

/**
 * Opsional: Mengirim manual score ke Web Input Nilai endpoint HTTP
 * (Digunakan jika lingkungan tidak memiliki koneksi direct cloud)
 */
export async function postManualScoreToGradeMasterHttp(params: {
  name: string;
  className: string;
  subject: string;
  score: number;
  academicYear?: string;
  endpointUrl?: string;
}): Promise<{ success: boolean; data?: any; error?: string }> {
  const endpoint =
    params.endpointUrl ||
    'https://web-input-nilai.vercel.app/api/grademaster/data-center/manual-score';

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: params.name.trim(),
        className: params.className.trim(),
        subject: params.subject.trim(),
        score: Number(params.score),
        academicYear: normalizeAcademicYearString(params.academicYear || '2026/2027') || '2026/2027',
      }),
    });

    const data = await response.json().catch(() => null);

    if (!response.ok) {
      return { success: false, error: data?.message || `HTTP ${response.status}` };
    }

    return { success: true, data };
  } catch (err: any) {
    logger.warn('GradeMasterSyncService', 'Gagal memanggil endpoint manual-score HTTP:', err);
    return { success: false, error: err?.message || 'Network error' };
  }
}
