// api/admin/teaching-schedules.ts
// Serverless Controlled Endpoint for Teaching Schedules (Jadwal Mengajar KBM)
// Enforces session authentication, role checks (admin/superadmin/kepsek),
// and performs mutations via serverSupabase (service_role) to protect RLS boundaries.

import { serverSupabase, authenticateUser } from '../_shared/session-auth';

function normalizeDayOfWeek(day: any): number {
  if (typeof day === 'number' && day >= 1 && day <= 6) return day;
  const map: Record<string, number> = {
    senin: 1,
    selasa: 2,
    rabu: 3,
    kamis: 4,
    jumat: 5,
    sabtu: 6,
  };
  if (typeof day === 'string') {
    const clean = day.trim().toLowerCase();
    if (map[clean]) return map[clean];
  }
  return 1;
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');

  if (req.method === 'OPTIONS') return res.status(200).end();

  // 1. Session Authentication
  const auth = await authenticateUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      errorCode: auth.errorCode,
      errorMessage: auth.errorMessage,
    });
  }

  const role = (auth.user?.role || auth.role || '').toLowerCase();
  const isAdminOrKepsek = ['admin', 'superadmin', 'kepsek'].includes(role);

  // 2. Role Enforcement for Mutations
  if (['POST', 'PUT', 'DELETE'].includes(req.method) && !isAdminOrKepsek) {
    return res.status(403).json({
      success: false,
      errorCode: 'AUTH_FORBIDDEN',
      errorMessage: 'Akses Ditolak: Hanya Admin atau Kepala Sekolah yang berwenang mengubah jadwal mengajar.',
    });
  }

  try {
    // ── GET: Read Teaching Schedules ─────────────────────────────────────────
    if (req.method === 'GET') {
      const { teacher_user_id, academic_year, day_of_week } = req.query || {};

      let query = serverSupabase
        .from('teaching_schedules')
        .select('id, teacher_user_id, teacher_name, day_of_week, start_time, end_time, class_name, subject, room, academic_year, effective_from, effective_until, is_active, version, created_at, updated_at, created_by, updated_by')
        .eq('is_active', true);

      if (teacher_user_id) query = query.eq('teacher_user_id', teacher_user_id);
      if (academic_year) query = query.eq('academic_year', academic_year);
      if (day_of_week !== undefined && day_of_week !== '') query = query.eq('day_of_week', Number(day_of_week));

      const { data, error } = await query.order('day_of_week', { ascending: true }).order('start_time', { ascending: true });

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, data: data || [] });
    }

    // ── POST: Create Schedule ────────────────────────────────────────────────
    if (req.method === 'POST') {
      const body = req.body || {};
      const {
        teacher_user_id,
        class_name,
        subject,
        room,
        academic_year,
        start_time,
        end_time,
        effective_from,
        effective_until,
        is_active,
      } = body;

      if (!teacher_user_id || !class_name || !subject || !start_time || !end_time) {
        return res.status(400).json({
          success: false,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'Kolom teacher_user_id, class_name, subject, start_time, dan end_time wajib diisi.',
        });
      }

      const dayOfWeek = normalizeDayOfWeek(body.day_of_week ?? body.day);

      // Lookup teacher name if not explicitly provided
      let teacherName = body.teacher_name;
      if (!teacherName) {
        const { data: userProfile } = await serverSupabase
          .from('users_public_view')
          .select('full_name')
          .eq('id', teacher_user_id)
          .maybeSingle();
        teacherName = userProfile?.full_name || 'Guru';
      }

      const payload = {
        teacher_user_id,
        teacher_name: teacherName,
        day_of_week: dayOfWeek,
        start_time,
        end_time,
        class_name,
        subject,
        room: room || 'Ruang Kelas',
        academic_year: academic_year || '2026/2027',
        effective_from: effective_from || null,
        effective_until: effective_until || null,
        is_active: is_active ?? true,
        version: 1,
        created_by: auth.userId,
        updated_by: auth.userId,
      };

      const { data, error } = await serverSupabase
        .from('teaching_schedules')
        .insert([payload])
        .select('id, teacher_user_id, teacher_name, day_of_week, start_time, end_time, class_name, subject, room, academic_year, effective_from, effective_until, is_active, version, created_at, updated_at, created_by, updated_by')
        .single();

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(201).json({ success: true, data });
    }

    // ── PUT: Update Schedule ─────────────────────────────────────────────────
    if (req.method === 'PUT') {
      const body = req.body || {};
      const { id } = body;

      if (!id) {
        return res.status(400).json({
          success: false,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'ID jadwal wajib disertakan untuk pembaruan.',
        });
      }

      const { data: existing, error: fetchErr } = await serverSupabase
        .from('teaching_schedules')
        .select('id, version')
        .eq('id', id)
        .maybeSingle();

      if (fetchErr || !existing) {
        return res.status(404).json({
          success: false,
          errorMessage: 'Jadwal tidak ditemukan di database.',
        });
      }

      if (body.version !== undefined && existing.version !== undefined && existing.version !== body.version) {
        return res.status(409).json({
          success: false,
          errorCode: 'CONCURRENCY_CONFLICT',
          errorMessage: 'Konflik Versi: Jadwal telah diubah oleh operator lain. Silakan muat ulang.',
        });
      }

      const updatePayload: Record<string, any> = {
        updated_by: auth.userId,
        updated_at: new Date().toISOString(),
        version: (existing.version || 1) + 1,
      };

      if (body.teacher_user_id) updatePayload.teacher_user_id = body.teacher_user_id;
      if (body.teacher_name) updatePayload.teacher_name = body.teacher_name;
      if (body.day_of_week !== undefined || body.day !== undefined) {
        updatePayload.day_of_week = normalizeDayOfWeek(body.day_of_week ?? body.day);
      }
      if (body.start_time) updatePayload.start_time = body.start_time;
      if (body.end_time) updatePayload.end_time = body.end_time;
      if (body.class_name) updatePayload.class_name = body.class_name;
      if (body.subject !== undefined) updatePayload.subject = body.subject;
      if (body.room !== undefined) updatePayload.room = body.room;
      if (body.academic_year) updatePayload.academic_year = body.academic_year;
      if (body.is_active !== undefined) updatePayload.is_active = body.is_active;
      if (body.effective_from !== undefined) updatePayload.effective_from = body.effective_from;
      if (body.effective_until !== undefined) updatePayload.effective_until = body.effective_until;

      const { data, error } = await serverSupabase
        .from('teaching_schedules')
        .update(updatePayload)
        .eq('id', id)
        .select('id, teacher_user_id, teacher_name, day_of_week, start_time, end_time, class_name, subject, room, academic_year, effective_from, effective_until, is_active, version, created_at, updated_at, created_by, updated_by')
        .single();

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, data });
    }

    // ── DELETE: Delete Schedule ──────────────────────────────────────────────
    if (req.method === 'DELETE') {
      const id = req.query?.id || req.body?.id;
      if (!id) {
        return res.status(400).json({
          success: false,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'ID jadwal wajib disertakan untuk penghapusan.',
        });
      }

      const { error } = await serverSupabase
        .from('teaching_schedules')
        .delete()
        .eq('id', id);

      if (error) {
        return res.status(400).json({ success: false, error: error.message });
      }

      return res.status(200).json({ success: true, message: 'Jadwal mengajar berhasil dihapus.' });
    }

    return res.status(405).json({
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: `Metode ${req.method} tidak didukung.`,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: err?.message || 'Terjadi kesalahan pada server database.',
    });
  }
}
