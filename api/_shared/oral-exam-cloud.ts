// api/_shared/oral-exam-cloud.ts
// Server-side Supabase persistence for Oral Exam sessions (BTQ, Hafalan, & Bahasa Checklist).
// Writes via service_role (`serverSupabase`) after strict session authentication and RBAC/ownership checks.
// Uses dedicated `public.oral_exam_sessions` table, and seamlessly persists inside `public.system_settings`
// (`oral_exam_session_*`) if Migration 73 has not been executed yet, ensuring zero data loss and zero localStorage.

import type { AuthSuccessContext } from './session-auth.js';
import { serverSupabase } from './session-auth.js';

const STAFF_ADMIN_ROLES = new Set(['ADMIN', 'OPERATOR', 'SUPERADMIN']);
const READ_ALL_ROLES = new Set(['ADMIN', 'OPERATOR', 'KEPSEK', 'SUPERADMIN']);

function sanitizeKeySegment(value: unknown, fallback = ''): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return fallback;
  return raw.replace(/[^\w.-]/g, '_');
}

function isMissingTableError(error: any): boolean {
  if (!error) return false;
  const code = String(error.code || '');
  const msg = String(error.message || '').toLowerCase();
  return (
    code === '42P01' ||
    code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('schema cache')
  );
}

function normalizePersonName(name: unknown): string {
  return String(name || '')
    .toLowerCase()
    .replace(/^(ust\.?|ustadz\.?|ibu|bapak|pak|bu|dr\.?|drs\.?|h\.?|hj\.?)\s+/i, '')
    .split(',')[0]
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\b(muhammad|muhamad|mohammad|mohamad|mochamad)\b/g, 'muhamad')
    .replace(/\s+/g, ' ')
    .trim();
}

function isMatchingExaminerPerson(nameA: unknown, nameB: unknown): boolean {
  const normA = normalizePersonName(nameA);
  const normB = normalizePersonName(nameB);
  if (!normA || !normB) return false;
  const compactA = normA.replace(/\s+/g, '');
  const compactB = normB.replace(/\s+/g, '');
  if (normA === normB || normA.includes(normB) || normB.includes(normA) || compactA === compactB) {
    return true;
  }
  const tokensA = normA.split(' ').filter((t) => t.length >= 3);
  const tokensB = normB.split(' ').filter((t) => t.length >= 3);
  const matched = tokensA.filter((ta) =>
    tokensB.some((tb) => tb === ta || (ta.length >= 5 && tb.length >= 5 && ta.slice(0, 5) === tb.slice(0, 5)))
  );
  return matched.length >= 2;
}

function mapDbRowToOralSession(row: any) {
  return {
    id: String(row.id),
    templateType: row.template_type === 'BAHASA_INGGRIS_ARAB' ? 'BAHASA_INGGRIS_ARAB' : 'BTQ_HAFALAN',
    ...(row.subject_scope ? { subjectScope: row.subject_scope } : {}),
    ...(row.group_id !== undefined && row.group_id !== null ? { groupId: String(row.group_id) } : {}),
    title: String(row.title || ''),
    academicYear: String(row.academic_year || '2026/2027'),
    semester: row.semester === 'GENAP' ? 'GENAP' : 'GANJIL',
    examinerUserId: row.examiner_user_id ? String(row.examiner_user_id) : null,
    examinerName: String(row.examiner_name || ''),
    examinerNpp: row.examiner_npp ? String(row.examiner_npp) : null,
    roomNumber: String(row.room_number || 'Ruang 01'),
    className: String(row.class_name || '7'),
    date: String(row.exam_date || ''),
    totalQuestions: Number(row.total_questions) || 15,
    students: Array.isArray(row.students) ? row.students : [],
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

async function getTeacherAssignedGroupIds(auth: AuthSuccessContext, academicYear: string): Promise<Set<string>> {
  const cleanYear = sanitizeKeySegment(academicYear || '2026/2027', '2026_2027').replace(/\./g, '_');
  const key = `exam_oral_assignments_${cleanYear}`;
  const groupIds = new Set<string>();
  try {
    const { data, error } = await serverSupabase
      .from('system_settings')
      .select('value')
      .eq('key', key)
      .maybeSingle();

    if (!error && data?.value) {
      const parsed = JSON.parse(data.value);
      if (Array.isArray(parsed)) {
        for (const a of parsed) {
          if (!a || a.isActive === false) continue;
          const byId = Boolean(a.examinerUserId && a.examinerUserId === auth.userId);
          const byName = Boolean(!a.examinerUserId && isMatchingExaminerPerson(a.examinerName, auth.user?.full_name));
          if (byId || byName) {
            if (a.id) groupIds.add(String(a.id));
          }
        }
      }
    }
  } catch {
    // Non-blocking fallback
  }
  return groupIds;
}

async function isActiveCommitteeMember(auth: AuthSuccessContext, academicYear: string): Promise<boolean> {
  try {
    const { data, error } = await serverSupabase
      .from('exam_committees')
      .select('id, academic_year, is_active')
      .eq('user_id', auth.userId)
      .eq('is_active', true);

    if (!error && Array.isArray(data) && data.length > 0) {
      const matching = data.filter((r: any) => !r.academic_year || r.academic_year === academicYear);
      if (matching.length > 0) return true;
    }
  } catch {
    // ignore missing table
  }
  return false;
}

async function fetchAllCloudOralSessions(academicYear?: string): Promise<{ sessions: any[]; tableAvailable: boolean }> {
  const sessionMap = new Map<string, any>();
  let tableAvailable = true;

  try {
    let query = serverSupabase
      .from('oral_exam_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (academicYear) {
      query = query.eq('academic_year', academicYear);
    }

    const { data, error } = await query;
    if (error) {
      if (isMissingTableError(error)) {
        tableAvailable = false;
      } else {
        throw new Error(error.message);
      }
    } else if (Array.isArray(data)) {
      for (const row of data) {
        const mapped = mapDbRowToOralSession(row);
        sessionMap.set(mapped.id, mapped);
      }
    }
  } catch {
    tableAvailable = false;
    // Will merge from system_settings below
  }

  // Always check pre-migration system_settings keys (`oral_exam_session_%`) so nothing is ever lost across migrations
  try {
    const { data: kvRows, error: kvErr } = await serverSupabase
      .from('system_settings')
      .select('key, value')
      .like('key', 'oral_exam_session_%');

    if (!kvErr && Array.isArray(kvRows)) {
      for (const row of kvRows) {
        if (!row?.value) continue;
        try {
          const parsed = JSON.parse(row.value);
          if (parsed && parsed.id) {
            if (academicYear && parsed.academicYear !== academicYear) continue;
            if (!sessionMap.has(parsed.id)) {
              sessionMap.set(parsed.id, parsed);
            }
          }
        } catch {
          // skip corrupt JSON entry
        }
      }
    }
  } catch {
    // ignore
  }

  const list = Array.from(sessionMap.values()).sort((a, b) =>
    String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))
  );
  return { sessions: list, tableAvailable };
}

export async function handleListOralExamSessions(academicYear: string | undefined, auth: AuthSuccessContext) {
  const roleUpper = String(auth.user?.role || auth.role || '').trim().toUpperCase();
  const targetYear = (academicYear || '').trim() || undefined;

  const { sessions } = await fetchAllCloudOralSessions(targetYear);

  if (READ_ALL_ROLES.has(roleUpper) || (await isActiveCommitteeMember(auth, targetYear || '2026/2027'))) {
    return { status: 200, body: { success: true, sessions } };
  }

  if (roleUpper === 'GURU') {
    const assignedGroupIds = await getTeacherAssignedGroupIds(auth, targetYear || '2026/2027');
    const teacherSessions = sessions.filter((s) => {
      if (s.examinerUserId && s.examinerUserId === auth.userId) return true;
      if (s.groupId && assignedGroupIds.has(String(s.groupId))) return true;
      if (isMatchingExaminerPerson(s.examinerName, auth.user?.full_name)) return true;
      return false;
    });
    return { status: 200, body: { success: true, sessions: teacherSessions } };
  }

  return {
    status: 403,
    body: {
      success: false,
      errorCode: 'AUTH_FORBIDDEN',
      errorMessage: 'Peran Anda tidak berwenang mengakses data penilaian ujian lisan.',
    },
  };
}

export async function handleSaveOralExamSession(body: any, auth: AuthSuccessContext) {
  const roleUpper = String(auth.user?.role || auth.role || '').trim().toUpperCase();
  if (roleUpper === 'KEPSEK') {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'READ_ONLY_ACCESS',
        errorMessage: 'Akun Kepala Sekolah hanya memiliki hak akses peninjauan (read-only).',
      },
    };
  }

  const raw = body?.session;
  if (!raw || typeof raw.id !== 'string' || !raw.id.trim() || !Array.isArray(raw.students)) {
    return {
      status: 400,
      body: {
        success: false,
        errorCode: 'VALIDATION_ERROR',
        errorMessage: 'Data sesi ujian lisan (session.id dan session.students) wajib valid.',
      },
    };
  }

  const cleanId = sanitizeKeySegment(raw.id);
  const academicYear = String(raw.academicYear || '2026/2027').trim() || '2026/2027';
  const isAdminOrCommittee =
    STAFF_ADMIN_ROLES.has(roleUpper) || (await isActiveCommitteeMember(auth, academicYear));

  // Verify existing session & examiner ownership for non-admin GURU
  const { sessions: existingSessions } = await fetchAllCloudOralSessions(academicYear);
  const existing = existingSessions.find((s) => s.id === cleanId) || null;

  if (!isAdminOrCommittee) {
    if (roleUpper !== 'GURU') {
      return {
        status: 403,
        body: {
          success: false,
          errorCode: 'AUTH_FORBIDDEN',
          errorMessage: 'Peran Anda tidak berwenang menyimpan nilai ujian lisan.',
        },
      };
    }

    const assignedGroupIds = await getTeacherAssignedGroupIds(auth, academicYear);
    const targetGroupId = raw.groupId ?? existing?.groupId ?? null;
    const ownsExisting = Boolean(
      existing &&
        ((existing.examinerUserId && existing.examinerUserId === auth.userId) ||
          (existing.groupId && assignedGroupIds.has(String(existing.groupId))) ||
          isMatchingExaminerPerson(existing.examinerName, auth.user?.full_name))
    );
    const ownsRequested = Boolean(
      (targetGroupId && assignedGroupIds.has(String(targetGroupId))) ||
        raw.examinerUserId === auth.userId ||
        isMatchingExaminerPerson(raw.examinerName, auth.user?.full_name)
    );

    if (existing && !ownsExisting) {
      return {
        status: 403,
        body: {
          success: false,
          errorCode: 'AUTH_FORBIDDEN',
          errorMessage: 'Anda tidak berwenang mengubah sesi ujian lisan milik penguji lain.',
        },
      };
    }

    if (!existing && !ownsRequested) {
      return {
        status: 403,
        body: {
          success: false,
          errorCode: 'AUTH_FORBIDDEN',
          errorMessage: 'Anda hanya dapat menyimpan penilaian pada kelompok penguji yang ditugaskan kepada Anda.',
        },
      };
    }
  }

  const nowIso = new Date().toISOString();
  const resolvedExaminerUserId =
    raw.examinerUserId ||
    existing?.examinerUserId ||
    (!isAdminOrCommittee ? auth.userId : null);

  const normalizedSession = {
    id: cleanId,
    templateType: raw.templateType === 'BAHASA_INGGRIS_ARAB' ? 'BAHASA_INGGRIS_ARAB' : 'BTQ_HAFALAN',
    ...(raw.subjectScope ? { subjectScope: String(raw.subjectScope) } : {}),
    ...(raw.groupId !== undefined ? { groupId: raw.groupId ? String(raw.groupId) : null } : {}),
    title: String(raw.title || 'Penilaian Ujian Lisan').trim(),
    academicYear,
    semester: raw.semester === 'GENAP' ? 'GENAP' : 'GANJIL',
    examinerUserId: resolvedExaminerUserId,
    examinerName: String(raw.examinerName || auth.user?.full_name || 'Guru Penguji').trim(),
    examinerNpp: raw.examinerNpp ?? existing?.examinerNpp ?? null,
    roomNumber: String(raw.roomNumber || 'Ruang 01').trim(),
    className: String(raw.className || '7').trim(),
    date: String(raw.date || nowIso.slice(0, 10)).trim(),
    totalQuestions: Number(raw.totalQuestions) || 15,
    students: raw.students,
    createdAt: existing?.createdAt || raw.createdAt || nowIso,
    updatedAt: nowIso,
  };

  // Try dedicated `public.oral_exam_sessions` table first
  const dbRow = {
    id: normalizedSession.id,
    academic_year: normalizedSession.academicYear,
    semester: normalizedSession.semester,
    template_type: normalizedSession.templateType,
    subject_scope: normalizedSession.subjectScope || null,
    group_id: normalizedSession.groupId ?? null,
    title: normalizedSession.title,
    examiner_user_id: normalizedSession.examinerUserId,
    examiner_name: normalizedSession.examinerName,
    examiner_npp: normalizedSession.examinerNpp,
    room_number: normalizedSession.roomNumber,
    class_name: normalizedSession.className,
    exam_date: normalizedSession.date,
    total_questions: normalizedSession.totalQuestions,
    students: normalizedSession.students,
    created_by: existing?.examinerUserId || auth.userId,
    created_at: normalizedSession.createdAt,
    updated_at: normalizedSession.updatedAt,
  };

  const { error: relErr } = await serverSupabase
    .from('oral_exam_sessions')
    .upsert(dbRow, { onConflict: 'id' });

  if (relErr) {
    if (!isMissingTableError(relErr)) {
      return {
        status: 500,
        body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: relErr.message },
      };
    }

    // Pre-migration persistent fallback inside Supabase `public.system_settings`
    const kvKey = `oral_exam_session_${cleanId}`;
    const { error: kvErr } = await serverSupabase
      .from('system_settings')
      .upsert(
        { key: kvKey, value: JSON.stringify(normalizedSession), updated_at: nowIso },
        { onConflict: 'key' }
      );

    if (kvErr) {
      return {
        status: 500,
        body: { success: false, errorCode: 'DB_WRITE_FAILED', errorMessage: kvErr.message },
      };
    }
  } else {
    // Keep system_settings mirror removed once saved to relational table so no stale duplicate remains
    try {
      await serverSupabase.from('system_settings').delete().eq('key', `oral_exam_session_${cleanId}`);
    } catch {
      // ignore cleanup error
    }
  }

  return { status: 200, body: { success: true, session: normalizedSession } };
}

export async function handleDeleteOralExamSession(body: any, auth: AuthSuccessContext) {
  const roleUpper = String(auth.user?.role || auth.role || '').trim().toUpperCase();
  const isAdmin = STAFF_ADMIN_ROLES.has(roleUpper);
  if (!isAdmin) {
    return {
      status: 403,
      body: {
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Akses Ditolak: Hanya Admin/Operator yang berwenang menghapus sesi penilaian ujian lisan.',
      },
    };
  }

  const sessionId = sanitizeKeySegment(body?.sessionId || body?.id);
  if (!sessionId) {
    return {
      status: 400,
      body: { success: false, errorCode: 'VALIDATION_ERROR', errorMessage: 'Field sessionId wajib diisi.' },
    };
  }

  const { error: delErr } = await serverSupabase
    .from('oral_exam_sessions')
    .delete()
    .eq('id', sessionId);

  if (delErr && !isMissingTableError(delErr)) {
    return {
      status: 500,
      body: { success: false, errorCode: 'DB_DELETE_FAILED', errorMessage: delErr.message },
    };
  }

  try {
    await serverSupabase.from('system_settings').delete().eq('key', `oral_exam_session_${sessionId}`);
  } catch {
    // ignore
  }

  return { status: 200, body: { success: true, deletedId: sessionId } };
}
