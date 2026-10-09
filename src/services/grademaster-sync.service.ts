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
  SyncBehaviorsToGradeMasterDTO,
  SyncBehaviorsToGradeMasterResult,
  GradeMasterBehaviorItem,
  BulkSyncSessionsOptions,
  BulkSyncSessionDetail,
  BulkSyncSessionsResult,
} from '../types/database.types';
import {
  normalizeAcademicYearString,
  isAcademicYearMatch,
  resolveSessionAcademicYear,
} from '../utils/academic-year.utils';
import { normalizeClassCode, areClassCodesEqual } from '../utils/class.utils';
import { normalizeSubjectName } from '../config/school-subjects.config';
import { AdministrationRepository } from '../repositories/AdministrationRepository';
import { logger } from '../utils/logger.utils';

export type SyncScoresParams = SyncScoresToGradeMasterDTO;
export type SyncBehaviorsParams = SyncBehaviorsToGradeMasterDTO;

/**
 * Memeriksa apakah semester pada sesi cocok dengan filter semester target
 */
export function isSemesterMatch(
  session: { semester?: string | null; session_name?: string | null },
  targetSemester?: string | null
): boolean {
  if (!targetSemester || targetSemester === 'ALL' || targetSemester === 'SEMUA') return true;
  const targetClean = targetSemester.trim().toLowerCase();
  const sessionSemester = (session.semester || '').trim().toLowerCase();
  const sessionName = (session.session_name || '').toLowerCase();

  const isTargetGenap = targetClean.includes('genap') || targetClean === '2';
  const isTargetGanjil = targetClean.includes('ganjil') || targetClean === '1';

  if (isTargetGenap) {
    if (sessionSemester.includes('genap') || sessionSemester === '2') return true;
    if (sessionName.includes('genap') || sessionName.includes('asas') || sessionName.includes('pat')) return true;
    return false;
  }

  if (isTargetGanjil) {
    if (sessionSemester.includes('ganjil') || sessionSemester === '1') return true;
    if (sessionName.includes('ganjil') || sessionName.includes('asts') || sessionName.includes('pts') || sessionName.includes('pas')) return true;
    // Default fallback to Ganjil if semester is not marked as Genap
    if (!sessionSemester && !sessionName.includes('genap')) return true;
    return false;
  }

  return true;
}

/**
 * Sinkronisasi data nilai siswa ke Portal Siswa GradeMaster via HTTP API Bridge
 */
export async function syncScoresToGradeMaster(payload: {
  className: string;
  subject: string;
  academicYear?: string;
  semester?: string;
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
  const cleanSemester = payload.semester?.trim();
  const cleanExamType = payload.examType ? payload.examType.trim().toUpperCase() : 'HARIAN';
  const cleanTeacher = payload.teacherName?.trim() || 'Guru Pengampu';
  const cleanKkm = Number(payload.kkm) || 75;

  const formattedScores = (payload.scores || []).map((s) => ({
    studentName: s.studentName.trim(),
    score: Number(s.score),
    originalScore: s.originalScore !== undefined ? Number(s.originalScore) : Number(s.score),
  }));

  const bodyData: Record<string, any> = {
    className: cleanClass,
    subject: cleanSubject,
    academicYear: cleanYear,
    examType: cleanExamType,
    teacherName: cleanTeacher,
    kkm: cleanKkm,
    scores: formattedScores,
  };

  if (cleanSemester) {
    bodyData.semester = cleanSemester;
  }

  logger.info(
    'GradeMasterSyncService',
    `Mengirim ${formattedScores.length} nilai via HTTP API Bridge ke: ${apiUrl} (Kelas: ${cleanClass}, Mapel: ${cleanSubject}, TA: ${cleanYear}${cleanSemester ? `, Semester: ${cleanSemester}` : ''})`
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
    semester: session.semester,
    examType: session.exam_type || 'HARIAN',
    teacherName: session.teacher,
    kkm: Number(session.kkm) || 75,
    scores,
  });
}

/**
 * Sinkronisasi seluruh sesi penilaian / seluruh mata pelajaran langsung ke Portal Siswa GradeMaster
 * secara cerdas, otomatis mencegah duplikasi sesi dan duplikasi nilai siswa,
 * serta menyaring tahun ajaran & semester yang tepat sasaran.
 */
export async function syncAllSessionsToGradeMaster(
  options: BulkSyncSessionsOptions = {},
  token?: string
): Promise<BulkSyncSessionsResult> {
  const provider = ProviderFactory.getProvider();

  // 1. Target Academic Year & Semester
  const targetYear = options.academicYear && options.academicYear !== 'ALL'
    ? normalizeAcademicYearString(options.academicYear) || '2026/2027'
    : (AdministrationRepository.getActiveAcademicYear() || '2026/2027');

  const activeSem = AdministrationRepository.getActiveSemester() === 'GENAP' ? 'Genap' : 'Ganjil';
  const targetSemester = options.semester && options.semester !== 'ALL'
    ? (options.semester.trim().toLowerCase().includes('genap') ? 'Genap' : 'Ganjil')
    : activeSem;

  const targetClass = options.className && options.className !== 'ALL'
    ? normalizeClassCode(options.className)
    : 'ALL';

  // 2. Ambil seluruh sesi ujian
  const allSessions = await provider.getExamSessions(token);

  // 3. Saring sesi berdasarkan tahun ajaran, semester, dan kelas
  const matchedSessions = (allSessions || []).filter((s) => {
    // Check Academic Year
    if (options.academicYear !== 'ALL') {
      const matchYear = isAcademicYearMatch(s, targetYear);
      if (!matchYear) return false;
    }

    // Check Semester
    if (options.semester !== 'ALL') {
      const matchSem = isSemesterMatch(s, targetSemester);
      if (!matchSem) return false;
    }

    // Check Class
    if (targetClass !== 'ALL') {
      if (!areClassCodesEqual(s.class_name, targetClass)) return false;
    }

    return true;
  })
    .sort((a, b) => {
      const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
      const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
      return timeB - timeA;
    });

  const details: BulkSyncSessionDetail[] = [];
  let totalProcessed = 0;
  let totalSkipped = 0;
  let totalScoresSynced = 0;

  if (matchedSessions.length === 0) {
    return {
      success: true,
      totalFound: 0,
      totalProcessed: 0,
      totalSkipped: 0,
      totalScoresSynced: 0,
      academicYear: targetYear,
      semester: targetSemester,
      details: [],
      message: `Tidak ditemukan sesi ujian untuk Tahun Ajaran ${targetYear} dan Semester ${targetSemester}.`,
    };
  }

  // 4. Kumpulkan nilai siswa dan lakukan Anti-Duplikasi Cerdas
  // Kunci deduplikasi unik: [KELAS]:::[MAPEL]:::[JENIS_UJIAN]:::[TAHUN]:::[SEMESTER]
  interface DeduplicatedSessionGroup {
    primarySession: (typeof matchedSessions)[0];
    allSessionIds: string[];
    uniqueStudentsMap: Map<string, { studentName: string; score: number; originalScore: number; timestamp: number }>;
  }

  const dedupGroups = new Map<string, DeduplicatedSessionGroup>();

  for (const session of matchedSessions) {
    const graded = await provider.getGradedStudents(session.id, token);

    if (!graded || graded.length === 0) {
      details.push({
        sessionId: session.id,
        sessionName: session.session_name,
        subject: session.subject,
        className: session.class_name,
        academicYear: session.academic_year || targetYear,
        semester: session.semester || targetSemester,
        studentCount: 0,
        status: 'SKIPPED',
        message: 'Diabaikan: Belum ada nilai siswa yang diinput.',
      });
      totalSkipped++;
      continue;
    }

    const normClass = normalizeClassCode(session.class_name);
    const normSubj = normalizeSubjectName(session.subject).toUpperCase();
    const normExamType = (session.exam_type || 'HARIAN').trim().toUpperCase();
    const sessionYear = resolveSessionAcademicYear(session.academic_year, session.session_name, session.created_at, targetYear);
    const sessionSem = session.semester?.trim() || targetSemester;

    const groupKey = `${normClass}:::${normSubj}:::${normExamType}:::${sessionYear}:::${sessionSem.toUpperCase()}`;

    if (!dedupGroups.has(groupKey)) {
      dedupGroups.set(groupKey, {
        primarySession: session,
        allSessionIds: [session.id],
        uniqueStudentsMap: new Map(),
      });
    } else {
      const grp = dedupGroups.get(groupKey)!;
      grp.allSessionIds.push(session.id);
      grp.primarySession = session;
    }

    const group = dedupGroups.get(groupKey)!;
    const sessionTime = new Date(session.updated_at || session.created_at || 0).getTime();

    // Masukkan siswa dengan deduplikasi (mengambil nilai terbaru)
    for (const st of graded) {
      const cleanName = (st?.name || '').trim();
      if (!cleanName) continue;
      const studentKey = cleanName.toUpperCase();
      const finalScore = Number(st.final_score) || 0;
      const origScore = Number(st.original_score !== undefined ? st.original_score : st.final_score) || 0;
      const stTime = new Date(st.updated_at || st.created_at || 0).getTime() || sessionTime || Date.now();

      // Karena sesi diproses dari yang paling baru ke yang paling lama,
      // entri pertama yang ditemukan merupakan rekaman paling mutakhir
      if (!group.uniqueStudentsMap.has(studentKey)) {
        group.uniqueStudentsMap.set(studentKey, {
          studentName: cleanName,
          score: finalScore,
          originalScore: origScore,
          timestamp: stTime,
        });
      }
    }
  }

  // 5. Jalankan sinkronisasi untuk setiap sesi unik ke GradeMaster HTTP API Bridge
  const uniqueGroupsArray = Array.from(dedupGroups.values());
  const totalToSync = uniqueGroupsArray.length;

  for (let i = 0; i < totalToSync; i++) {
    const grp = uniqueGroupsArray[i];
    const session = grp.primarySession;
    const scores = Array.from(grp.uniqueStudentsMap.values()).map((s) => ({
      studentName: s.studentName,
      score: s.score,
      originalScore: s.originalScore,
    }));

    if (options.onProgress) {
      options.onProgress({
        current: i + 1,
        total: totalToSync,
        currentSubject: session.subject,
        currentClass: session.class_name,
        status: 'IN_PROGRESS',
      });
    }

    try {
      const res = await syncScoresToGradeMaster({
        className: session.class_name,
        subject: session.subject,
        academicYear: session.academic_year || targetYear,
        semester: session.semester || targetSemester,
        examType: session.exam_type || 'HARIAN',
        teacherName: session.teacher || options.teacherName || 'Guru Pengampu',
        kkm: Number(session.kkm) || 75,
        scores,
      });

      totalProcessed++;
      totalScoresSynced += (res.count ?? scores.length);

      const isMerged = grp.allSessionIds.length > 1;
      details.push({
        sessionId: session.id,
        sessionName: session.session_name,
        subject: session.subject,
        className: session.class_name,
        academicYear: session.academic_year || targetYear,
        semester: session.semester || targetSemester,
        studentCount: scores.length,
        status: 'SUCCESS',
        message: isMerged
          ? `Berhasil tersinkron (${scores.length} siswa, digabung dari ${grp.allSessionIds.length} sesi duplikat)`
          : `Berhasil tersinkron (${scores.length} siswa)`,
      });
    } catch (syncErr: any) {
      logger.error('GradeMasterBulkSync', `Gagal menyinkronkan ${session.session_name}:`, syncErr);
      details.push({
        sessionId: session.id,
        sessionName: session.session_name,
        subject: session.subject,
        className: session.class_name,
        academicYear: session.academic_year || targetYear,
        semester: session.semester || targetSemester,
        studentCount: scores.length,
        status: 'FAILED',
        message: `Gagal: ${syncErr?.message || 'Kesalahan jaringan API'}`,
      });
    }
  }

  if (options.onProgress) {
    options.onProgress({
      current: totalToSync,
      total: totalToSync,
      currentSubject: 'Selesai',
      currentClass: '',
      status: 'DONE',
    });
  }

  const success = totalProcessed > 0 || (matchedSessions.length > 0 && totalSkipped === matchedSessions.length);

  return {
    success,
    totalFound: matchedSessions.length,
    totalProcessed,
    totalSkipped,
    totalScoresSynced,
    academicYear: targetYear,
    semester: targetSemester,
    details,
    message: totalProcessed > 0
      ? `Berhasil menyinkronkan ${totalProcessed} sesi mata pelajaran (${totalScoresSynced} nilai siswa) untuk TA ${targetYear} Semester ${targetSemester} ke GradeMaster OS!`
      : `Tidak ada sesi yang berhasil disinkronkan (${totalSkipped} sesi diabaikan karena kosong).`,
  };
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

/**
 * Sinkronisasi data catatan sikap / perilaku (Behavior) siswa ke GradeMaster via HTTP API Bridge
 */
export async function syncBehaviorsToGradeMaster(payload: {
  className: string;
  academicYear?: string;
  teacherName?: string;
  behaviors: Array<{
    studentName: string;
    type: 'GOOD' | 'BAD';
    pointsDelta: number;
    reason: string;
    date: string;
  }>;
}): Promise<SyncBehaviorsToGradeMasterResult> {
  const apiUrl =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRADEMASTER_API_URL) ||
    'https://web-input-nilai.vercel.app/api/grademaster/sync-from-smart-absensi';

  const syncKey =
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GRADEMASTER_SYNC_KEY) ||
    'gm_sync_smart_absensi_2026';

  if (!payload.className || !payload.className.trim()) {
    throw new Error('INVALID_PAYLOAD: className wajib diisi.');
  }

  const cleanClass = payload.className.trim();
  const cleanYear = normalizeAcademicYearString(payload.academicYear || '2026/2027') || '2026/2027';
  const cleanTeacher = payload.teacherName?.trim() || 'Guru Pengampu';

  const formattedBehaviors: GradeMasterBehaviorItem[] = (payload.behaviors || []).map((b) => ({
    studentName: b.studentName.trim(),
    type: (b.type === 'GOOD' ? 'GOOD' : 'BAD') as 'GOOD' | 'BAD',
    pointsDelta: Math.abs(Number(b.pointsDelta) || 0),
    reason: b.reason?.trim() || (b.type === 'GOOD' ? 'Catatan Kebaikan' : 'Catatan Kedisiplinan'),
    date: b.date?.trim() || new Date().toISOString().split('T')[0],
  }));

  const bodyData = {
    className: cleanClass,
    academicYear: cleanYear,
    teacherName: cleanTeacher,
    behaviors: formattedBehaviors,
  };

  logger.info(
    'GradeMasterSyncService',
    `Mengirim ${formattedBehaviors.length} catatan perilaku via HTTP API Bridge ke: ${apiUrl} (Kelas: ${cleanClass}, TA: ${cleanYear})`
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
    const errorMsg =
      resJson.error ||
      resJson.message ||
      `HTTP ${response.status}: Gagal melakukan sinkronisasi catatan sikap ke Web Input Nilai`;
    logger.error('GradeMasterSyncService', 'Gagal memanggil HTTP API Bridge (Behavior):', errorMsg);
    throw new Error(errorMsg);
  }

  logger.info(
    'GradeMasterSyncService',
    `Sinkronisasi perilaku berhasil: ${resJson.message || 'OK'} (Diproses: ${resJson.processedCount ?? formattedBehaviors.length})`
  );

  return {
    success: true,
    message: resJson.message || 'Berhasil sinkronisasi catatan sikap siswa ke Portal Siswa',
    count: resJson.processedCount !== undefined ? Number(resJson.processedCount) : formattedBehaviors.length,
  };
}

/**
 * Sinkronisasi seluruh catatan perilaku siswa suatu kelas ke GradeMaster via HTTP API Bridge
 */
export async function syncClassBehaviorsToGradeMaster(
  className: string,
  academicYear = '2026/2027',
  teacherName = 'Guru Pengampu',
  token?: string
): Promise<SyncBehaviorsToGradeMasterResult> {
  const { StudentBehaviorRepository } = await import('../repositories/StudentBehaviorRepository');
  const records = await StudentBehaviorRepository.getBehaviors(className, academicYear, token);

  const behaviors: GradeMasterBehaviorItem[] = [];

  for (const rec of records) {
    for (const log of rec.behavior_logs || []) {
      if (log.voided_at) continue; // Jangan kirim log yang dibatalkan
      const dateStr =
        (log.occurred_at || log.violation_date || log.timestamp || '').split('T')[0] ||
        new Date().toISOString().split('T')[0];
      behaviors.push({
        studentName: rec.student_name,
        type: log.type === 'GOOD' ? 'GOOD' : 'BAD',
        pointsDelta: Math.abs(log.points),
        reason: log.reason,
        date: dateStr,
      });
    }
  }

  if (behaviors.length === 0) {
    return {
      success: true,
      count: 0,
      message: `Tidak ada catatan sikap aktif untuk kelas ${className} pada TA ${academicYear}.`,
    };
  }

  return await syncBehaviorsToGradeMaster({
    className,
    academicYear,
    teacherName,
    behaviors,
  });
}
