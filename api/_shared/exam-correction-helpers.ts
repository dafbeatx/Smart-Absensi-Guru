// api/_shared/exam-correction-helpers.ts
// Shared ownership authorization and server-side GradeMaster persistence helpers
// for api/exam-correction.ts (runs strictly via serverSupabase service_role).

import crypto from 'node:crypto';
import type { AuthenticatedUser } from './session-auth.js';
import { serverSupabase } from './session-auth.js';

export type SessionOwnershipResult =
  | { ok: true; session: { id: string; owner_user_id?: string | null; teacher?: string | null; kkm?: number | null; answer_key?: string[] | null; scoring_config?: any } }
  | { ok: false; status: number; code: string; message: string };

/**
 * Enforces session ownership for GURU while permitting ADMIN/OPERATOR/KEPSEK supervision.
 * Prevents horizontal privilege escalation / IDOR on both GET audit logs and POST mutations.
 */
export async function verifyExamSessionOwnership(
  sessionId: string,
  callerUser: AuthenticatedUser,
  callerRole: string
): Promise<SessionOwnershipResult> {
  const { data: sess, error: sessErr } = await serverSupabase
    .from('gm_sessions')
    .select('id, owner_user_id, teacher, kkm, answer_key, scoring_config')
    .eq('id', sessionId)
    .maybeSingle();

  if (sessErr || !sess) {
    return {
      ok: false,
      status: 404,
      code: 'SESSION_NOT_FOUND',
      message: 'Sesi ujian tidak ditemukan.',
    };
  }

  const normalizedRole = callerRole.trim().toUpperCase();
  if (normalizedRole === 'GURU') {
    const callerName = String(callerUser.full_name || '').trim().toLowerCase();
    const sessionTeacher = String(sess.teacher || '').trim().toLowerCase();
    const isOwner = sess.owner_user_id
      ? sess.owner_user_id === callerUser.id
      : Boolean(sessionTeacher && callerName && sessionTeacher === callerName);

    if (!isOwner) {
      return {
        ok: false,
        status: 403,
        code: 'SESSION_ACCESS_DENIED',
        message: 'Anda hanya berhak mengakses dan mengubah data sesi ujian milik Anda sendiri.',
      };
    }
  } else if (!['ADMIN', 'OPERATOR', 'KEPSEK', 'SUPERADMIN'].includes(normalizedRole)) {
    return {
      ok: false,
      status: 403,
      code: 'AUTH_FORBIDDEN',
      message: 'Peran akun Anda tidak diizinkan mengakses sesi ujian ini.',
    };
  }

  return { ok: true, session: sess };
}

/**
 * Server-side mirror update ensuring GradeMaster portal fields & student_scores stay synchronized
 * using serverSupabase without exposing direct table writes to anon browsers.
 */
export async function syncStudentGradeMirrorOnServer(
  sessionId: string,
  studentRecord: any,
  inputData: any,
  kkm = 75
): Promise<any> {
  if (!studentRecord?.id) return studentRecord;

  const finalScore =
    inputData?.final_score !== undefined && inputData?.final_score !== null
      ? Math.max(0, Math.min(100, Number(inputData.final_score) || 0))
      : Math.max(0, Math.min(100, Number(studentRecord.final_score) || 0));

  const remedialStatus = finalScore >= kkm ? 'PASSED' : 'NONE';
  const studentUserId = String(inputData?.student_user_id || studentRecord.student_user_id || '').trim();
  const cleanName = String(inputData?.name || studentRecord.name || '').trim();

  try {
    await serverSupabase
      .from('gm_students')
      .update({
        is_deleted: false,
        original_score: finalScore,
        final_score: finalScore,
        mcq_score: inputData?.mcq_score ?? studentRecord.mcq_score ?? finalScore,
        essay_score: inputData?.essay_score ?? studentRecord.essay_score ?? 0,
        remedial_status: remedialStatus,
        updated_at: new Date().toISOString(),
      })
      .eq('id', studentRecord.id);

    studentRecord.final_score = finalScore;
    studentRecord.original_score = finalScore;
    studentRecord.is_deleted = false;
    if (inputData?.mcq_score !== undefined) studentRecord.mcq_score = inputData.mcq_score;
    if (inputData?.essay_score !== undefined) studentRecord.essay_score = inputData.essay_score;
    studentRecord.remedial_status = remedialStatus;
  } catch {
    // Non-fatal mirror patch
  }

  if (studentUserId) {
    try {
      await serverSupabase.from('student_scores').upsert(
        {
          student_id: studentUserId,
          session_id: sessionId,
          score: finalScore,
          answers: {
            session_id: sessionId,
            name: cleanName,
            mcq_answers: inputData?.mcq_answers || studentRecord.mcq_answers || {},
            essay_scores: inputData?.essay_scores || studentRecord.essay_scores || [],
            csi: inputData?.csi ?? studentRecord.csi ?? 0,
            lps: inputData?.lps ?? studentRecord.lps ?? 0,
            correct: inputData?.correct ?? studentRecord.correct ?? 0,
            wrong: inputData?.wrong ?? studentRecord.wrong ?? 0,
          },
          is_completed: true,
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'student_id,session_id' }
      );
    } catch {
      // Non-fatal mirror upsert
    }
  }

  return studentRecord;
}

/**
 * Resilient server-side fallback write when save_exam_grade_v2 SQL function is unavailable.
 */
export async function saveSingleGradeServerFallback(
  sessionId: string,
  sessionRow: { id: string; kkm?: number | null; answer_key?: string[] | null },
  data: any,
  callerUser: AuthenticatedUser,
  callerRole: string,
  changeReason?: string | null,
  source = 'MANUAL_ENTRY'
) {
  const studentUserId = String(data?.student_user_id || data?.id || `std_${Date.now()}`).trim();
  const cleanName = String(data?.name || '').trim();
  const kkm = Number(sessionRow?.kkm) || 75;

  let existingRecord: any = null;
  if (studentUserId) {
    const { data: ex } = await serverSupabase
      .from('gm_students')
      .select('id, revision, created_at')
      .eq('session_id', sessionId)
      .eq('student_user_id', studentUserId)
      .maybeSingle();
    existingRecord = ex;
  }
  if (!existingRecord && data?.id) {
    const { data: ex } = await serverSupabase
      .from('gm_students')
      .select('id, revision, created_at')
      .eq('id', data.id)
      .maybeSingle();
    existingRecord = ex;
  }

  if (
    existingRecord &&
    data?.expected_revision !== undefined &&
    existingRecord.revision !== undefined &&
    existingRecord.revision !== data.expected_revision
  ) {
    throw new Error(
      `CONCURRENCY_CONFLICT: Data siswa ${cleanName} telah diperbarui oleh pengguna lain (revisi saat ini ${existingRecord.revision}, dikirim ${data.expected_revision}).`
    );
  }

  const nextRev = (existingRecord?.revision || 0) + 1;
  const finalScore = Math.max(0, Math.min(100, Number(data?.final_score) || 0));
  const nowIso = new Date().toISOString();

  const studentPayload: any = {
    session_id: sessionId,
    student_user_id: studentUserId,
    name: cleanName,
    mcq_answers: data?.mcq_answers || {},
    essay_scores: data?.essay_scores || [],
    mcq_score: Math.max(0, Math.min(100, Number(data?.mcq_score) || 0)),
    essay_score: Math.max(0, Math.min(100, Number(data?.essay_score) || 0)),
    final_score: finalScore,
    original_score: finalScore,
    csi: Math.max(0, Math.min(100, Number(data?.csi) || 0)),
    lps: Math.max(0, Math.min(100, Number(data?.lps) || 0)),
    correct: Number(data?.correct) || 0,
    wrong: Number(data?.wrong) || 0,
    remedial_status: finalScore >= kkm ? 'PASSED' : 'NONE',
    is_deleted: false,
    source: data?.source || source || 'MANUAL_ENTRY',
    revision: nextRev,
    updated_at: nowIso,
  };

  let savedId = existingRecord?.id || data?.id;
  if (existingRecord) {
    const { error: updErr } = await serverSupabase
      .from('gm_students')
      .update(studentPayload)
      .eq('id', savedId);
    if (updErr) throw new Error(updErr.message);
  } else {
    studentPayload.id = savedId || crypto.randomUUID();
    const { data: insData, error: insErr } = await serverSupabase
      .from('gm_students')
      .insert(studentPayload)
      .select('id')
      .single();
    if (insErr) throw new Error(insErr.message);
    savedId = insData?.id || studentPayload.id;
  }

  // Upsert gm_answers using serverSupabase
  const answerKey = Array.isArray(data?.answer_key) ? data.answer_key : sessionRow?.answer_key;
  if (savedId && Array.isArray(answerKey) && data?.mcq_answers) {
    const normalize = (v?: string) => (v ? String(v).trim().toUpperCase() : '');
    const answerRows = Object.entries(data.mcq_answers).map(([qNum, selected]) => ({
      student_id: savedId,
      question_number: parseInt(qNum, 10),
      selected_answer: String(selected || ''),
      is_correct: normalize(answerKey[parseInt(qNum, 10) - 1]) === normalize(String(selected || '')),
      updated_at: nowIso,
    }));
    if (answerRows.length > 0) {
      await serverSupabase.from('gm_answers').upsert(answerRows, { onConflict: 'student_id,question_number' });
    }
  }

  // Mirror student_scores using serverSupabase
  await serverSupabase.from('student_scores').upsert(
    {
      student_id: studentUserId,
      session_id: sessionId,
      score: finalScore,
      answers: {
        session_id: sessionId,
        name: cleanName,
        mcq_answers: data?.mcq_answers || {},
        essay_scores: data?.essay_scores || [],
        csi: studentPayload.csi,
        lps: studentPayload.lps,
        correct: studentPayload.correct,
        wrong: studentPayload.wrong,
      },
      is_completed: true,
      completed_at: nowIso,
      updated_at: nowIso,
    },
    { onConflict: 'student_id,session_id' }
  );

  // Best-effort audit log entry
  try {
    await serverSupabase.from('gm_grade_audit_logs').insert({
      session_id: sessionId,
      student_user_id: studentUserId,
      student_name: cleanName,
      actor_user_id: callerUser.id,
      actor_name: callerUser.full_name,
      actor_role: callerRole,
      revision: nextRev,
      new_values: { final_score: finalScore, mcq_score: studentPayload.mcq_score, essay_score: studentPayload.essay_score },
      change_reason: changeReason || null,
      source: studentPayload.source,
    });
  } catch {
    // Non-fatal if audit table not yet migrated
  }

  return {
    ...studentPayload,
    id: savedId,
    created_at: existingRecord?.created_at || nowIso,
  };
}

export async function handleDeleteGradedStudentOnServer(
  studentId: string,
  callerUser: AuthenticatedUser,
  callerRole: string
) {
  const { data: studentRow, error: fetchErr } = await serverSupabase
    .from('gm_students')
    .select('id, session_id, student_user_id')
    .eq('id', studentId)
    .maybeSingle();

  if (fetchErr || !studentRow) {
    return { status: 404, body: { success: false, message: 'Data nilai siswa tidak ditemukan.' } };
  }

  const ownership = await verifyExamSessionOwnership(studentRow.session_id, callerUser, callerRole);
  if (!ownership.ok) {
    return { status: ownership.status, body: { success: false, code: ownership.code, message: ownership.message } };
  }

  try {
    await serverSupabase.from('gm_answers').delete().eq('student_id', studentId);
  } catch {}
  if (studentRow.student_user_id) {
    try {
      await serverSupabase
        .from('student_scores')
        .delete()
        .eq('student_id', studentRow.student_user_id)
        .eq('session_id', studentRow.session_id);
    } catch {}
  }

  const { error: delErr } = await serverSupabase.from('gm_students').delete().eq('id', studentId);
  if (delErr) {
    return { status: 500, body: { success: false, message: delErr.message } };
  }

  return { status: 200, body: { success: true } };
}

export async function handleSyncScoresOnServer(body: any, callerUser: AuthenticatedUser) {
  const cleanClass = String(body?.className || '').trim();
  const cleanSubject = String(body?.subject || '').trim();
  const cleanYear = String(body?.academicYear || '2026/2027').trim() || '2026/2027';
  const examType = String(body?.examType || 'HARIAN').trim().toUpperCase();
  const teacherName = String(body?.teacherName || callerUser.full_name || 'Guru Pengampu').trim();
  const kkm = Number(body?.kkm) || 75;
  const scores = Array.isArray(body?.scores) ? body.scores : [];

  if (!cleanClass || !cleanSubject) {
    return { status: 400, body: { success: false, message: 'className dan subject wajib diisi.' } };
  }
  if (scores.length === 0) {
    return { status: 200, body: { success: true, count: 0, message: 'Tidak ada data nilai yang dikirim.' } };
  }

  const accountNamesMap = new Map<string, string>();
  try {
    const { data: accounts } = await serverSupabase
      .from('gm_student_accounts')
      .select('student_name')
      .eq('class_name', cleanClass);
    for (const acc of accounts || []) {
      if (acc.student_name) {
        accountNamesMap.set(String(acc.student_name).trim().toLowerCase(), String(acc.student_name).trim());
      }
    }
  } catch {}

  const sessionName = `${examType} - ${cleanSubject} - ${cleanClass} (${cleanYear})`;
  const normalizedClassCode = cleanClass.toUpperCase().replace(/[^A-Z0-9]/g, '');
  let sessionId: string | null = null;
  let existingStudentList: string[] = [];

  const { data: existingSession } = await serverSupabase
    .from('gm_sessions')
    .select('id, student_list')
    .eq('class_name', cleanClass)
    .eq('subject', cleanSubject)
    .eq('academic_year', cleanYear)
    .eq('exam_type', examType)
    .maybeSingle();

  if (existingSession) {
    sessionId = existingSession.id;
    existingStudentList = Array.isArray(existingSession.student_list) ? existingSession.student_list : [];
    await serverSupabase
      .from('gm_sessions')
      .update({ is_public: true, updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  } else {
    const { data: byName } = await serverSupabase
      .from('gm_sessions')
      .select('id, student_list')
      .eq('session_name', sessionName)
      .maybeSingle();

    if (byName) {
      sessionId = byName.id;
      existingStudentList = Array.isArray(byName.student_list) ? byName.student_list : [];
      await serverSupabase
        .from('gm_sessions')
        .update({ is_public: true, updated_at: new Date().toISOString() })
        .eq('id', sessionId);
    } else {
      const studentNames = scores.map((s: any) => {
        const raw = String(s.studentName || '').trim();
        return accountNamesMap.get(raw.toLowerCase()) || raw;
      });
      const newSessionId = crypto.randomUUID();
      const { data: inserted, error: insErr } = await serverSupabase
        .from('gm_sessions')
        .insert({
          id: newSessionId,
          session_name: sessionName,
          teacher: teacherName,
          owner_user_id: callerUser.id,
          subject: cleanSubject,
          class_name: cleanClass,
          class_code: normalizedClassCode,
          academic_year: cleanYear,
          exam_type: examType,
          kkm,
          is_public: true,
          student_list: studentNames,
          password_hash: 'system_synced',
          scoring_config: { pgWeight: 1, essayWeight: 0, essayMaxScore: 0, essayCount: 0 },
          updated_at: new Date().toISOString(),
        })
        .select('id')
        .single();

      if (insErr) {
        return { status: 500, body: { success: false, message: insErr.message } };
      }
      sessionId = inserted?.id || newSessionId;
      existingStudentList = studentNames;
    }
  }

  if (!sessionId) {
    return { status: 500, body: { success: false, message: 'Gagal membuat sesi GradeMaster.' } };
  }

  const updatedStudentNames = [...existingStudentList];
  const nowIso = new Date().toISOString();

  for (let i = 0; i < scores.length; i++) {
    const rawName = String(scores[i].studentName || '').trim();
    const canonicalName = accountNamesMap.get(rawName.toLowerCase()) || rawName;
    const finalScore = Math.max(0, Math.min(100, Number(scores[i].score) || 0));
    const remedialStatus = finalScore >= kkm ? 'PASSED' : 'NONE';

    if (canonicalName && !updatedStudentNames.includes(canonicalName)) {
      updatedStudentNames.push(canonicalName);
    }

    const { data: existingStudent } = await serverSupabase
      .from('gm_students')
      .select('id, student_user_id')
      .eq('session_id', sessionId)
      .ilike('name', canonicalName)
      .maybeSingle();

    const studentUserId =
      existingStudent?.student_user_id ||
      `std_${normalizedClassCode.toLowerCase()}_${Date.now()}_${i}`;

    if (existingStudent) {
      await serverSupabase
        .from('gm_students')
        .update({
          name: canonicalName,
          final_score: finalScore,
          original_score: finalScore,
          mcq_score: finalScore,
          essay_score: 0,
          remedial_status: remedialStatus,
          is_deleted: false,
          updated_at: nowIso,
        })
        .eq('id', existingStudent.id);
    } else {
      await serverSupabase.from('gm_students').insert({
        id: crypto.randomUUID(),
        session_id: sessionId,
        student_user_id: studentUserId,
        name: canonicalName,
        final_score: finalScore,
        original_score: finalScore,
        mcq_score: finalScore,
        essay_score: 0,
        remedial_status: remedialStatus,
        is_deleted: false,
        created_at: nowIso,
        updated_at: nowIso,
      });
    }

    await serverSupabase.from('student_scores').upsert(
      {
        student_id: `std_${cleanClass}_${canonicalName.replace(/\s+/g, '_')}`,
        session_id: sessionId,
        score: finalScore,
        answers: { session_id: sessionId, name: canonicalName, score: finalScore, synced_at: nowIso },
        is_completed: true,
        completed_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'student_id,session_id' }
    );
  }

  if (updatedStudentNames.length > existingStudentList.length) {
    await serverSupabase
      .from('gm_sessions')
      .update({ student_list: updatedStudentNames, updated_at: nowIso })
      .eq('id', sessionId);
  }

  return {
    status: 200,
    body: {
      success: true,
      count: scores.length,
      sessionId,
      message: `Berhasil menyinkronkan ${scores.length} nilai siswa ke GradeMaster (${cleanClass}).`,
    },
  };
}
