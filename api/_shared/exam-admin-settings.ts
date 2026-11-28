// api/_shared/exam-admin-settings.ts
// Shared server-side persistence handlers for exam schedules, exam periods, and SK Panitia Ujian.
// Enforces role / committee authorization and allowlisted system_settings key prefixes via serverSupabase.

import type { AuthSuccessContext } from './session-auth.js';
import { serverSupabase } from './session-auth.js';

const STAFF_ADMIN_ROLES = new Set(['ADMIN', 'OPERATOR', 'KEPSEK', 'SUPERADMIN']);

function sanitizeKeySegment(value: unknown, fallback = ''): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  return raw.replace(/[^\w]/g, '_');
}

function normalizeLevel(value: unknown): 'SMP' | 'SMA' | undefined {
  const upper = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (upper === 'SMP' || upper === 'SMA') return upper;
  return undefined;
}

/**
 * Verifies whether the authenticated user is an admin/operator/kepsek
 * OR an active member of the official exam committee for the academic year.
 */
export async function isAuthorizedAdminOrCommittee(
  auth: AuthSuccessContext,
  academicYear?: string
): Promise<boolean> {
  const roleUpper = String(auth.user?.role || auth.role || '').trim().toUpperCase();
  if (STAFF_ADMIN_ROLES.has(roleUpper)) {
    return true;
  }

  const targetYear = (academicYear || '').trim();

  // 1. Check relational public.exam_committees table
  try {
    let query = serverSupabase
      .from('exam_committees')
      .select('id, user_id, academic_year, is_active')
      .eq('user_id', auth.userId)
      .eq('is_active', true);

    if (targetYear) {
      query = query.eq('academic_year', targetYear);
    }

    const { data, error } = await query.limit(1);
    if (!error && Array.isArray(data) && data.length > 0) {
      return true;
    }
  } catch {
    // Fallback to system_settings KV check if relational table unavailable
  }

  // 2. Check KV keys exam_committee_<year> and smart_absensi_exam_committee
  try {
    const candidateKeys = targetYear
      ? [`exam_committee_${targetYear}`, 'smart_absensi_exam_committee']
      : ['smart_absensi_exam_committee'];

    const { data: rows } = await serverSupabase
      .from('system_settings')
      .select('key, value')
      .in('key', candidateKeys);

    for (const row of rows || []) {
      if (!row?.value) continue;
      try {
        const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
        if (!Array.isArray(parsed)) continue;
        const matched = parsed.some((member: any) => {
          if (!member || member.isActive === false) return false;
          if (member.userId !== auth.userId) return false;
          if (targetYear && member.academicYear && member.academicYear !== targetYear) return false;
          return true;
        });
        if (matched) return true;
      } catch {
        // Ignore malformed JSON row
      }
    }
  } catch {
    // Ignore KV check errors
  }

  return false;
}

export async function handleSaveExamCommittee(body: any, auth: AuthSuccessContext) {
  const roleUpper = String(auth.user?.role || auth.role || '').trim().toUpperCase();
  if (!STAFF_ADMIN_ROLES.has(roleUpper)) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Hanya Admin, Operator, atau Kepala Sekolah yang dapat menetapkan SK Panitia Ujian.',
      },
    };
  }

  const academicYear = String(body?.academicYear || '2026/2027').trim() || '2026/2027';
  const members = Array.isArray(body?.members) ? body.members : null;
  if (!members) {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Daftar anggota panitia (members) wajib berupa array.',
      },
    };
  }

  const sanitizedMembers = members
    .filter((m: any) => m && typeof m.userId === 'string' && m.userId.trim())
    .map((m: any) => ({
      id: typeof m.id === 'string' && m.id.trim() ? m.id.trim() : `comm_${m.userId.trim()}_${Date.now()}`,
      userId: String(m.userId).trim(),
      fullName: String(m.fullName || 'Anggota Panitia').trim(),
      npp: m.npp ? String(m.npp).trim() : undefined,
      role: String(m.role || 'ANGGOTA').trim().toUpperCase(),
      academicYear,
      isActive: m.isActive !== false,
      createdAt: m.createdAt || new Date().toISOString(),
    }));

  const nowIso = new Date().toISOString();
  const settingKey = `exam_committee_${academicYear}`;

  const { error: yearErr } = await serverSupabase
    .from('system_settings')
    .upsert({ key: settingKey, value: JSON.stringify(sanitizedMembers), updated_at: nowIso }, { onConflict: 'key' });

  if (yearErr) {
    return {
      status: 500,
      body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: yearErr.message },
    };
  }

  const { error: globalErr } = await serverSupabase
    .from('system_settings')
    .upsert(
      { key: 'smart_absensi_exam_committee', value: JSON.stringify(sanitizedMembers), updated_at: nowIso },
      { onConflict: 'key' }
    );

  if (globalErr) {
    return {
      status: 500,
      body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: globalErr.message },
    };
  }

  // Sync relational table public.exam_committees if present
  try {
    const { error: delErr } = await serverSupabase
      .from('exam_committees')
      .delete()
      .eq('academic_year', academicYear);

    if (!delErr && sanitizedMembers.length > 0) {
      const relationalRows = sanitizedMembers.map((m: any) => ({
        id: m.id,
        academic_year: academicYear,
        user_id: m.userId,
        full_name: m.fullName,
        npp: m.npp || null,
        role: m.role,
        is_active: m.isActive,
        updated_at: nowIso,
      }));
      await serverSupabase.from('exam_committees').upsert(relationalRows, { onConflict: 'id' });
    }
  } catch {
    // Non-fatal if relational table not yet provisioned
  }

  return {
    status: 200,
    body: { success: true, academicYear, count: sanitizedMembers.length },
  };
}

export async function handleSaveExamSchedule(body: any, auth: AuthSuccessContext) {
  const schedule = body?.schedule;
  const academicYear = String(schedule?.config?.academicYear || '').trim();
  const examType = String(schedule?.config?.examType || '').trim();

  if (!schedule || !academicYear || !examType) {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Data jadwal ujian (config.academicYear dan config.examType) wajib diisi.',
      },
    };
  }

  const authorized = await isAuthorizedAdminOrCommittee(auth, academicYear);
  if (!authorized) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Akses Ditolak: Hanya Admin, Operator, Kepala Sekolah, atau Panitia Ujian aktif yang berwenang menyimpan jadwal ujian.',
      },
    };
  }

  const cleanYear = sanitizeKeySegment(academicYear);
  const cleanType = sanitizeKeySegment(examType);
  const effectiveLevel = normalizeLevel(body?.level || schedule?.config?.educationLevel || schedule?.educationLevel);
  const levelSuffix = effectiveLevel ? `_${effectiveLevel.toLowerCase()}` : '';
  const storageKey = `exam_schedule_${cleanYear}_${cleanType}${levelSuffix}`;
  const nowIso = new Date().toISOString();
  const serialized = JSON.stringify(schedule);

  const { error } = await serverSupabase
    .from('system_settings')
    .upsert({ key: storageKey, value: serialized, updated_at: nowIso }, { onConflict: 'key' });

  if (error) {
    return {
      status: 500,
      body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: error.message },
    };
  }

  if (effectiveLevel === 'SMP') {
    const legacyKey = `exam_schedule_${cleanYear}_${cleanType}`;
    const { error: legacyErr } = await serverSupabase
      .from('system_settings')
      .upsert({ key: legacyKey, value: serialized, updated_at: nowIso }, { onConflict: 'key' });
    if (legacyErr) {
      return {
        status: 500,
        body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: legacyErr.message },
      };
    }
  }

  return { status: 200, body: { success: true, key: storageKey } };
}

export async function handleDeleteExamSchedule(params: any, auth: AuthSuccessContext) {
  const academicYear = String(params?.academicYear || '').trim();
  const examType = String(params?.examType || '').trim();
  const level = normalizeLevel(params?.level);

  if (!academicYear || !examType) {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Parameter academicYear dan examType wajib diisi untuk menghapus jadwal ujian.',
      },
    };
  }

  const authorized = await isAuthorizedAdminOrCommittee(auth, academicYear);
  if (!authorized) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Akses Ditolak: Hanya Admin, Operator, Kepala Sekolah, atau Panitia Ujian aktif yang berwenang menghapus jadwal ujian.',
      },
    };
  }

  const cleanYear = sanitizeKeySegment(academicYear);
  const cleanType = sanitizeKeySegment(examType);
  const levelSuffix = level ? `_${level.toLowerCase()}` : '';
  const storageKey = `exam_schedule_${cleanYear}_${cleanType}${levelSuffix}`;

  const { error } = await serverSupabase
    .from('system_settings')
    .delete()
    .eq('key', storageKey);

  if (error) {
    return {
      status: 500,
      body: { success: false, errorCode: 'DB_DELETE_FAILED', errorMessage: error.message },
    };
  }

  if (level === 'SMP' || !level) {
    const { error: legacyErr } = await serverSupabase
      .from('system_settings')
      .delete()
      .eq('key', `exam_schedule_${cleanYear}_${cleanType}`);
    if (legacyErr) {
      return {
        status: 500,
        body: { success: false, errorCode: 'DB_DELETE_FAILED', errorMessage: legacyErr.message },
      };
    }
  }

  return { status: 200, body: { success: true, key: storageKey } };
}

export async function handleSaveExamPeriod(body: any, auth: AuthSuccessContext) {
  const settings = body?.settings;
  const academicYear = String(settings?.academicYear || '2026/2027').trim() || '2026/2027';

  if (!settings || typeof settings !== 'object') {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Payload pengaturan periode ujian tidak valid.',
      },
    };
  }

  const authorized = await isAuthorizedAdminOrCommittee(auth, academicYear);
  if (!authorized) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Akses Ditolak: Hanya Admin, Operator, Kepala Sekolah, atau Panitia Ujian aktif yang berwenang mengatur periode ujian.',
      },
    };
  }

  const cleanYear = sanitizeKeySegment(academicYear);
  const storageKey = `exam_period_${cleanYear}`;

  const { error } = await serverSupabase
    .from('system_settings')
    .upsert(
      { key: storageKey, value: JSON.stringify(settings), updated_at: new Date().toISOString() },
      { onConflict: 'key' }
    );

  if (error) {
    return {
      status: 500,
      body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: error.message },
    };
  }

  return { status: 200, body: { success: true, key: storageKey } };
}

export async function handleSaveOralExamAssignments(body: any, auth: AuthSuccessContext) {
  const academicYear = String(body?.academicYear || '2026/2027').trim() || '2026/2027';
  const rawAssignments = Array.isArray(body?.assignments) ? body.assignments : null;

  if (!rawAssignments) {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Daftar penugasan penguji ujian lisan (assignments) wajib berupa array.',
      },
    };
  }

  const authorized = await isAuthorizedAdminOrCommittee(auth, academicYear);
  if (!authorized) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Akses Ditolak: Hanya Admin, Operator, Kepala Sekolah, atau Panitia Ujian aktif yang berwenang mengatur penempatan penguji ujian lisan.',
      },
    };
  }

  const nowIso = new Date().toISOString();
  const sanitized = rawAssignments
    .filter((a: any) => a && typeof a.examinerName === 'string' && a.examinerName.trim())
    .map((a: any, idx: number) => {
      const tracks = Array.isArray(a.examTracks)
        ? a.examTracks.filter((t: string) => t === 'BAHASA' || t === 'BTQ')
        : [];
      const bahasaScope = ['ENGLISH_ONLY', 'ARABIC_ONLY', 'BOTH'].includes(a.bahasaScope)
        ? a.bahasaScope
        : 'ENGLISH_ONLY';
      const btqScope = ['BTQ_ONLY', 'HAFALAN_ONLY', 'BOTH'].includes(a.btqScope)
        ? a.btqScope
        : 'BOTH';
      const students = Array.isArray(a.students)
        ? a.students
            .filter((s: any) => s && typeof s.studentName === 'string' && s.studentName.trim())
            .map((s: any, sIdx: number) => ({
              studentId: typeof s.studentId === 'string' && s.studentId.trim()
                ? s.studentId.trim()
                : `oral_std_${idx + 1}_${sIdx + 1}`,
              studentName: String(s.studentName).trim(),
              ...(s.nisn ? { nisn: String(s.nisn).trim() } : {}),
              ...(s.className ? { className: String(s.className).trim() } : {}),
            }))
        : [];

      const bahasaCriteria = Array.isArray(a.bahasaCriteria)
        ? [
            String(a.bahasaCriteria[0] || '').trim() || 'Pelafalan',
            String(a.bahasaCriteria[1] || '').trim() || 'Kelancaran',
            String(a.bahasaCriteria[2] || '').trim() || 'Pemahaman & Kosakata',
          ]
        : ['Pelafalan', 'Kelancaran', 'Pemahaman & Kosakata'];
      const btqCriteria = Array.isArray(a.btqCriteria)
        ? [
            String(a.btqCriteria[0] || '').trim() || 'Tajwid & Makhraj',
            String(a.btqCriteria[1] || '').trim() || 'Kelancaran Bacaan',
            String(a.btqCriteria[2] || '').trim() || 'Hafalan & Adab',
          ]
        : ['Tajwid & Makhraj', 'Kelancaran Bacaan', 'Hafalan & Adab'];

      return {
        id: typeof a.id === 'string' && a.id.trim() ? a.id.trim() : `oral_grp_${Date.now()}_${idx + 1}`,
        examinerUserId: typeof a.examinerUserId === 'string' && a.examinerUserId.trim() ? a.examinerUserId.trim() : null,
        examinerName: String(a.examinerName).trim(),
        examinerNpp: typeof a.examinerNpp === 'string' && a.examinerNpp.trim() ? a.examinerNpp.trim() : null,
        roomNumber: String(a.roomNumber || 'Ruang 01').trim(),
        className: String(a.className || '7').trim(),
        examTracks: tracks.length > 0 ? tracks : ['BAHASA', 'BTQ'],
        bahasaScope,
        btqScope,
        bahasaCriteria,
        btqCriteria,
        students,
        academicYear,
        isActive: a.isActive !== false,
        updatedAt: nowIso,
      };
    });

  const cleanYear = sanitizeKeySegment(academicYear);
  const storageKey = `exam_oral_assignments_${cleanYear}`;

  const { error } = await serverSupabase
    .from('system_settings')
    .upsert(
      { key: storageKey, value: JSON.stringify(sanitized), updated_at: nowIso },
      { onConflict: 'key' }
    );

  if (error) {
    return {
      status: 500,
      body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: error.message },
    };
  }

  return { status: 200, body: { success: true, key: storageKey, count: sanitized.length } };
}
