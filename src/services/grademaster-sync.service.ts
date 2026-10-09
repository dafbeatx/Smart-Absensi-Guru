/**
 * SMART ABSENSI GURU — GRADEMASTER SCORE SYNCHRONIZATION SERVICE
 * Menyinkronkan nilai ujian / penilaian harian guru langsung ke skema GradeMaster OS (Supabase)
 * Memastikan keterbacaan 100% pada Portal Siswa:
 * - gm_sessions: academic_year dengan format slash 'YYYY/YYYY', is_public = true, student_list array
 * - gm_students: is_deleted = false, original_score = final_score, remedial_status = 'NONE' | 'PASSED'
 * - Provider Pattern Abstraction: Seluruh mutasi lewat ProviderFactory.getProvider()
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
 * Sinkronisasi data nilai siswa ke database GradeMaster (Supabase)
 * Memenuhi kriteria join Portal Siswa GradeMaster:
 * - gm_students.name = targetStudentName
 * - gm_students.is_deleted = false
 * - gm_sessions.academic_year = targetAcademicYear ('YYYY/YYYY')
 * - gm_sessions.class_name = targetClassName
 */
export async function syncScoresToGradeMaster({
  className,
  subject,
  academicYear = '2026/2027',
  examType = 'HARIAN',
  teacherName = 'Guru Pengampu',
  kkm = 75,
  scores = [],
}: SyncScoresParams): Promise<SyncScoresToGradeMasterResult> {
  const cleanClass = className.trim();
  const cleanSubject = subject.trim();
  const cleanYear = normalizeAcademicYearString(academicYear) || '2026/2027';
  const cleanExamType = examType.trim().toUpperCase() || 'HARIAN';

  logger.info(
    'GradeMasterSyncService',
    `Memulai sinkronisasi ${scores.length} nilai untuk kelas ${cleanClass}, mapel ${cleanSubject} (${cleanYear})`
  );

  const provider = ProviderFactory.getProvider();
  const result = await provider.syncScoresToGradeMaster({
    className: cleanClass,
    subject: cleanSubject,
    academicYear: cleanYear,
    examType: cleanExamType,
    teacherName,
    kkm,
    scores,
  });

  return result;
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
      message: 'Belum ada nilai siswa yang tersimpan pada sesi ini.',
    };
  }

  // 3. Konversi nilai ke item GradeMaster
  const scores: GradeMasterScoreItem[] = graded.map((s) => ({
    studentName: s.name.trim(),
    score: Number(s.final_score) || 0,
  }));

  // 4. Jalankan sinkronisasi
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
