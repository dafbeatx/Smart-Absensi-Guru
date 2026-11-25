// api/exam-correction.ts
// Serverless Secured Exam Correction & GradeMaster Transaction Endpoint
// Supports:
//   GET  /api/exam-correction?session_id=...   -> Load audit logs (requires ownership check for GURU)
//   POST /api/exam-correction action=save_grade -> Atomic grade persistence via save_exam_grade_v2
//   POST /api/exam-correction action=batch_save_grades -> Atomic batch import (max 100)
//   POST /api/exam-correction action=delete_student -> Ownership-verified student grade deletion
//   POST /api/exam-correction action=sync_scores -> GradeMaster portal synchronization via serverSupabase

import {
  authenticateUser,
  isAuthFailure,
  serverSupabase,
  applyAuthCorsHeaders,
  isAllowedAuthOrigin,
} from './_shared/session-auth.js';
import {
  verifyExamSessionOwnership,
  isSessionOwnershipFailure,
  syncStudentGradeMirrorOnServer,
  saveSingleGradeServerFallback,
  handleDeleteGradedStudentOnServer,
  handleSyncScoresOnServer,
} from './_shared/exam-correction-helpers.js';

export default async function handler(req: any, res: any) {
  // 1. Multi-platform Allowlist CORS Configuration
  applyAuthCorsHeaders(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin.trim() : '';
    if (origin && !isAllowedAuthOrigin(origin, req)) {
      return res.status(403).end();
    }
    return res.status(200).end();
  }

  // 2. Strict Session Authentication (zero SB_JWT_ / mock bypasses)
  const auth = await authenticateUser(req);
  if (isAuthFailure(auth)) {
    return res.status(auth.status).json({
      success: false,
      code: auth.errorCode,
      message: auth.errorMessage,
    });
  }

  const callerUser = auth.user;
  const callerRole = (callerUser.role || auth.role || '').trim().toUpperCase();
  const authorizedRoles = ['ADMIN', 'OPERATOR', 'GURU', 'KEPSEK', 'SUPERADMIN'];

  if (!authorizedRoles.includes(callerRole)) {
    return res.status(403).json({
      success: false,
      code: 'AUTH_FORBIDDEN',
      message: 'Peran akun Anda tidak memiliki hak akses ke modul koreksi soal dan nilai.',
    });
  }

  // 3. Handle GET / Audit Logs (with mandatory ownership check!)
  if (req.method === 'GET') {
    const { session_id, student_user_id } = req.query || {};
    if (!session_id) {
      return res.status(400).json({ success: false, message: 'Parameter session_id wajib diisi.' });
    }

    const ownership = await verifyExamSessionOwnership(String(session_id), callerUser, callerRole);
    if (isSessionOwnershipFailure(ownership)) {
      return res.status(ownership.status).json({
        success: false,
        code: ownership.code,
        message: ownership.message,
      });
    }

    try {
      let query = serverSupabase
        .from('gm_grade_audit_logs')
        .select('*')
        .eq('session_id', session_id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (student_user_id) {
        query = query.eq('student_user_id', student_user_id);
      }

      const { data, error } = await query;
      if (error) {
        return res.status(500).json({ success: false, message: error.message });
      }

      return res.status(200).json({ success: true, logs: data || [] });
    } catch (err: any) {
      return res.status(500).json({ success: false, message: err?.message || 'Gagal memuat log audit.' });
    }
  }

  // 4. Handle POST Mutations
  if (req.method === 'POST') {
    if (callerRole === 'KEPSEK') {
      return res.status(403).json({
        success: false,
        code: 'READ_ONLY_ACCESS',
        message: 'Akun Kepala Sekolah hanya memiliki hak akses peninjauan (read-only).',
      });
    }

    const { action, session_id, data, items, change_reason, source, student_id } = req.body || {};

    if (action === 'sync_scores') {
      const syncResult = await handleSyncScoresOnServer(req.body || {}, callerUser);
      return res.status(syncResult.status).json(syncResult.body);
    }

    if (action === 'delete_student') {
      if (!student_id) {
        return res.status(400).json({ success: false, message: 'Field student_id wajib disertakan.' });
      }
      const delResult = await handleDeleteGradedStudentOnServer(String(student_id), callerUser, callerRole);
      return res.status(delResult.status).json(delResult.body);
    }

    if (!session_id) {
      return res.status(400).json({ success: false, message: 'Field session_id wajib disertakan.' });
    }

    // Enforce session existence & GURU ownership verification
    const ownership = await verifyExamSessionOwnership(String(session_id), callerUser, callerRole);
    if (isSessionOwnershipFailure(ownership)) {
      return res.status(ownership.status).json({
        success: false,
        code: ownership.code,
        message: ownership.message,
      });
    }

    const sessionKkm = Number(ownership.session.kkm) || 75;

    // Action A: Single Save
    if (action === 'save_grade') {
      if (!data || !data.name || !data.student_user_id) {
        return res.status(400).json({
          success: false,
          message: 'Field data.name dan data.student_user_id wajib disertakan.',
        });
      }

      try {
        const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc('save_exam_grade_v2', {
          p_session_id: session_id,
          p_student_user_id: data.student_user_id,
          p_student_name: data.name.trim(),
          p_mcq_answers: data.mcq_answers || {},
          p_essay_scores: data.essay_scores || [],
          p_actor_user_id: callerUser.id,
          p_actor_name: callerUser.full_name,
          p_actor_role: callerRole,
          p_expected_revision: data.expected_revision ?? null,
          p_change_reason: change_reason || null,
          p_source: source || data.source || 'MANUAL_ENTRY',
        });

        if (rpcErr) {
          const isConflict = rpcErr.message?.includes('CONCURRENCY_CONFLICT');
          if (isConflict) {
            return res.status(409).json({
              success: false,
              code: 'CONCURRENCY_CONFLICT',
              message: rpcErr.message,
            });
          }

          // Server-side atomic fallback using service_role if RPC not yet deployed on instance
          const fallbackRecord = await saveSingleGradeServerFallback(
            String(session_id),
            ownership.session,
            data,
            callerUser,
            callerRole,
            change_reason,
            source || data.source || 'MANUAL_ENTRY'
          );
          return res.status(200).json({ success: true, result: fallbackRecord });
        }

        const syncedResult = await syncStudentGradeMirrorOnServer(
          String(session_id),
          rpcRes,
          data,
          sessionKkm
        );

        return res.status(200).json({
          success: true,
          result: syncedResult,
        });
      } catch (err: any) {
        const isConflict = String(err?.message || '').includes('CONCURRENCY_CONFLICT');
        return res.status(isConflict ? 409 : 500).json({
          success: false,
          code: isConflict ? 'CONCURRENCY_CONFLICT' : 'SAVE_ERROR',
          message: err?.message || 'Terjadi kesalahan server saat menyimpan nilai.',
        });
      }
    }

    // Action B: Batch Save
    if (action === 'batch_save_grades') {
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Field items wajib berupa array dan tidak boleh kosong.',
        });
      }

      if (items.length > 100) {
        return res.status(400).json({
          success: false,
          message: `Maksimal 100 siswa per transaksi batch (diterima: ${items.length}).`,
        });
      }

      try {
        const { data: rpcRes, error: rpcErr } = await serverSupabase.rpc('batch_save_exam_grades_v2', {
          p_session_id: session_id,
          p_items: items.map((it: any) => ({
            student_user_id: it.student_user_id || it.id,
            name: String(it.name || '').trim(),
            mcq_answers: it.mcq_answers || {},
            essay_scores: it.essay_scores || [],
            source: it.source || source || 'IMPORT_EXCEL',
          })),
          p_actor_user_id: callerUser.id,
          p_actor_name: callerUser.full_name,
          p_actor_role: callerRole,
          p_source: source || 'IMPORT_EXCEL',
        });

        if (rpcErr) {
          // Server-side batch loop fallback via service_role when RPC unavailable
          const fallbackResults = [];
          for (const item of items) {
            const saved = await saveSingleGradeServerFallback(
              String(session_id),
              ownership.session,
              item,
              callerUser,
              callerRole,
              change_reason,
              item.source || source || 'IMPORT_EXCEL'
            );
            fallbackResults.push(saved);
          }
          return res.status(200).json({
            success: true,
            total_processed: fallbackResults.length,
            results: fallbackResults,
          });
        }

        if (rpcRes?.results && Array.isArray(rpcRes.results)) {
          try {
            const savedIds = rpcRes.results.map((r: any) => r.id).filter(Boolean);
            if (savedIds.length > 0) {
              await serverSupabase
                .from('gm_students')
                .update({ is_deleted: false })
                .in('id', savedIds);
            }
          } catch {}
        }

        return res.status(200).json({
          success: true,
          total_processed: rpcRes?.total_processed || items.length,
          results: rpcRes?.results || [],
        });
      } catch (err: any) {
        return res.status(500).json({
          success: false,
          message: err?.message || 'Terjadi kesalahan server saat batch import nilai.',
        });
      }
    }

    return res.status(400).json({
      success: false,
      message: `Aksi "${action}" tidak dikenali.`,
    });
  }

  return res.status(405).json({ success: false, message: 'Metode HTTP tidak diizinkan.' });
}
