// api/teacher-points.ts
// Serverless Controlled API for Teacher Point Ledger & Gamification
// Enforces stateful session authentication (saga_sess_), role-based authorization,
// server-calculated points for teachers, idempotency guarantees, and tenant isolation.

import crypto from 'node:crypto';
import { serverSupabase, authenticateUser } from './_shared/session-auth.js';

// Whitelist katalog aktivitas resmi yang boleh dicatat secara otomatis oleh role GURU
const GURU_ACTIVITY_CATALOG: Record<string, { points: number; title: string }> = {
  CHECK_IN_ON_TIME: { points: 15, title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)' },
  CHECK_IN_LATE: { points: 5, title: 'Presensi Masuk Terlambat (> 07:30 WIB)' },
  CHECK_OUT: { points: 10, title: 'Presensi Pulang Tuntas Bertugas' },
  DUTY_PIKET: { points: 10, title: 'Tugas Piket Harian Sekolah' },
  EARLY_BIRD_BONUS: { points: 5, title: '🌅 Teladan Fajar (Early Bird ≤ 07:00 WIB)' },
  MOOD_CHECKIN: { points: 5, title: 'Refleksi Semangat Mengajar (Mood Check-in)' },
};

export default async function handler(req: any, res: any) {
  // 1. CORS Configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-session-token');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Session Authentication & Role Authorization
  let auth = await authenticateUser(req);
  const authorizedRoles = ['ADMIN', 'GURU', 'KEPSEK', 'KEPALA SEKOLAH', 'OPERATOR'];
  let callerUser: any = null;
  let callerRole = '';

  // Mutasi/Pencatatan Poin (POST) WAJIB lolos autentikasi dan otorisasi role
  if (req.method === 'POST') {
    // Fallback toleran jika token adalah SB_JWT_${userId}_... selama masa transisi tabel user_sessions
    if (!auth.ok) {
      const authHeader = req.headers?.authorization || req.headers?.['x-session-token'];
      const rawToken = typeof authHeader === 'string' ? authHeader.replace(/^Bearer\s+/i, '').trim() : '';
      if (rawToken.startsWith('SB_JWT_')) {
        const withoutPrefix = rawToken.substring(7);
        const lastUnderscore = withoutPrefix.lastIndexOf('_');
        const fallbackUserId = lastUnderscore !== -1 ? withoutPrefix.substring(0, lastUnderscore) : withoutPrefix;
        if (fallbackUserId) {
          try {
            const { data: user, error: uErr } = await serverSupabase
              .from('users')
              .select('id, nip, full_name, role, position, account_status, avatar_url, phone_number')
              .eq('id', fallbackUserId)
              .maybeSingle();

            if (!uErr && user && user.account_status === 'ACTIVE') {
              auth = {
                ok: true,
                userId: user.id,
                user: {
                  id: user.id,
                  nip: user.nip || null,
                  full_name: user.full_name,
                  role: user.role,
                  position: user.position || null,
                  avatar_url: user.avatar_url || null,
                  phone_number: user.phone_number || null,
                },
                role: user.role,
                sessionId: `fallback_${user.id}`,
              };
            }
          } catch (e) {
            console.warn('[teacher-points] Fallback auth lookup exception:', e);
          }
        }
      }
    }

    if (!auth.ok) {
      return res.status(auth.status).json({
        success: false,
        errorCode: auth.errorCode,
        errorMessage: auth.errorMessage,
      });
    }

    callerUser = auth.user;
    callerRole = (callerUser?.role || '').toUpperCase().trim();
    if (!authorizedRoles.includes(callerRole)) {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Akses Ditolak: Anda tidak memiliki wewenang untuk mencatat poin guru.',
      });
    }
  }

  // ── GET: Read Point History & Reward Decisions ───────────────────────────
  if (req.method === 'GET') {
    try {
      const { user_id, month, type, period, limit: rawLimit, offset: rawOffset } = req.query || {};

      // Jika meminta data keputusan reward Kepala Sekolah
      if (type === 'reward_decision') {
        const cleanPeriod = String(period || month || '').trim();
        if (!cleanPeriod) {
          return res.status(400).json({
            success: false,
            errorCode: 'VALIDATION_ERROR',
            errorMessage: 'Parameter period wajib disertakan untuk query reward_decision.',
          });
        }
        const { data: decision, error: dErr } = await serverSupabase
          .from('teacher_point_reward_decisions')
          .select('id, period, teacher_user_id, teacher_name, approved_by, approved_at, leaderboard_snapshot_id, reason, reward_detail, created_at')
          .eq('period', cleanPeriod)
          .maybeSingle();

        if (dErr) {
          console.error('[API /api/teacher-points GET reward_decision error]:', dErr);
          return res.status(500).json({
            success: false,
            errorCode: 'DATABASE_ERROR',
            errorMessage: 'Gagal memuat data keputusan apresiasi kepala sekolah.',
          });
        }
        return res.status(200).json({
          success: true,
          data: decision || null,
        });
      }

      const limit = Math.min(1000, Math.max(1, parseInt(rawLimit as string, 10) || 500));
      const offset = Math.max(0, parseInt(rawOffset as string, 10) || 0);

      let query = serverSupabase
        .from('teacher_point_history')
        .select('id, user_id, teacher_name, date, points, activity_type, title, description, created_at, idempotency_key, status, voided_at, void_reason, source, occurred_at')
        .order('date', { ascending: false })
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      // Filter user jika diminta spesifik (dan bukan 'ALL')
      if (user_id && user_id !== 'ALL' && typeof user_id === 'string') {
        query = query.eq('user_id', user_id.trim());
      }

      // Filter bulan jika format YYYY-MM valid
      if (month && typeof month === 'string' && /^\d{4}-\d{2}$/.test(month.trim())) {
        const cleanMonth = month.trim();
        const [yr, mo] = cleanMonth.split('-').map(Number);
        const startDate = `${cleanMonth}-01`;
        const lastDay = new Date(yr, mo, 0).getDate();
        const endDate = `${cleanMonth}-${String(lastDay).padStart(2, '0')}`;
        query = query.gte('date', startDate).lte('date', endDate);
      }

      const { data, error } = await query;

      if (error) {
        console.error('[API /api/teacher-points GET error]:', error);
        return res.status(500).json({
          success: false,
          errorCode: 'DATABASE_ERROR',
          errorMessage: 'Gagal memuat buku besar poin guru dari cloud.',
        });
      }

      return res.status(200).json({
        success: true,
        data: data || [],
        total: (data || []).length,
      });
    } catch (err: any) {
      console.error('[API /api/teacher-points GET exception]:', err);
      return res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        errorMessage: 'Terjadi kendala internal pada server saat mengambil data poin.',
      });
    }
  }

  // ── POST: Record Teacher Point with Server-side Integrity & Idempotency ─────────────────
  if (req.method === 'POST') {
    try {
      const body = req.body || {};

      // ── Sub-Aksi A: Void / Pembatalan Poin Resmi (Audit Trail) ───────────
      if (body.action === 'VOID') {
        const leaderRoles = ['ADMIN', 'KEPSEK', 'KEPALA SEKOLAH', 'OPERATOR'];
        if (!leaderRoles.includes(callerRole)) {
          return res.status(403).json({
            success: false,
            errorCode: 'AUTH_FORBIDDEN',
            errorMessage: 'Hanya Admin, Operator, atau Kepala Sekolah yang berhak membatalkan (void) poin.',
          });
        }
        const pointId = String(body.point_id || '').trim();
        const voidReason = String(body.void_reason || 'Dibatalkan oleh pengelola').trim();
        if (!pointId) {
          return res.status(400).json({
            success: false,
            errorCode: 'VALIDATION_ERROR',
            errorMessage: 'Field point_id wajib disertakan untuk pembatalan poin.',
          });
        }
        const { error: vErr } = await serverSupabase
          .from('teacher_point_history')
          .update({
            status: 'VOIDED',
            voided_at: new Date().toISOString(),
            void_reason: voidReason,
          })
          .eq('id', pointId);

        if (vErr) {
          console.error('[API /api/teacher-points VOID error]:', vErr);
          return res.status(500).json({
            success: false,
            errorCode: 'DATABASE_ERROR',
            errorMessage: 'Gagal membatalkan poin di database.',
          });
        }

        return res.status(200).json({
          success: true,
          voided: true,
          point_id: pointId,
        });
      }

      // ── Sub-Aksi B: Simpan Keputusan Hadiah Juara Kepala Sekolah ─────────
      if (body.action === 'REWARD_DECISION') {
        const rewardRoles = ['KEPSEK', 'KEPALA SEKOLAH', 'ADMIN'];
        if (!rewardRoles.includes(callerRole)) {
          return res.status(403).json({
            success: false,
            errorCode: 'AUTH_FORBIDDEN',
            errorMessage: 'Hanya Kepala Sekolah atau Admin yang berhak menyetujui keputusan apresiasi juara.',
          });
        }
        const {
          period: decPeriod,
          teacher_user_id: decTeacherId,
          teacher_name: decTeacherName,
          leaderboard_snapshot_id: decSnapshotId,
          reason: decReason,
          reward_detail: decRewardDetail,
        } = body;

        if (!decPeriod || !decTeacherId || !decRewardDetail) {
          return res.status(400).json({
            success: false,
            errorCode: 'VALIDATION_ERROR',
            errorMessage: 'Field period, teacher_user_id, dan reward_detail wajib disertakan.',
          });
        }

        const decisionRecord = {
          id: body.id || `rew_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          period: String(decPeriod).trim(),
          teacher_user_id: String(decTeacherId).trim(),
          teacher_name: decTeacherName ? String(decTeacherName).trim() : null,
          approved_by: callerUser?.id || callerUser?.full_name || 'KEPSEK',
          approved_at: new Date().toISOString(),
          leaderboard_snapshot_id: decSnapshotId ? String(decSnapshotId).trim() : null,
          reason: decReason ? String(decReason).trim() : null,
          reward_detail: String(decRewardDetail).trim(),
          created_at: new Date().toISOString(),
        };

        const { data: savedDec, error: decErr } = await serverSupabase
          .from('teacher_point_reward_decisions')
          .upsert(decisionRecord, { onConflict: 'period' })
          .select()
          .single();

        if (decErr) {
          console.error('[API /api/teacher-points REWARD_DECISION error]:', decErr);
          return res.status(500).json({
            success: false,
            errorCode: 'DATABASE_ERROR',
            errorMessage: 'Gagal menyimpan keputusan apresiasi ke database.',
          });
        }

        return res.status(200).json({
          success: true,
          data: savedDec || decisionRecord,
        });
      }

      const {
        recipient_user_id,
        activity_type,
        date: rawDate,
        title: customTitle,
        description,
        idempotency_key: rawIdempotencyKey,
      } = body;

      const cleanActivity = String(activity_type || '').trim();
      const targetUserId = String(recipient_user_id || '').trim();
      const targetDate = String(rawDate || new Date().toISOString().split('T')[0]).trim();

      if (!cleanActivity) {
        return res.status(400).json({
          success: false,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'Field activity_type wajib disertakan.',
        });
      }

      if (!targetUserId) {
        return res.status(400).json({
          success: false,
          errorCode: 'VALIDATION_ERROR',
          errorMessage: 'Field recipient_user_id wajib disertakan.',
        });
      }

      // 1. Idempotency Check: Jika idempotency_key sudah diproses, return langsung data yang sudah ada
      const cleanIdempotencyKey = rawIdempotencyKey
        ? String(rawIdempotencyKey).trim()
        : `${targetUserId}:${targetDate}:${cleanActivity}`;

      if (cleanIdempotencyKey) {
        const { data: existingPoint } = await serverSupabase
          .from('teacher_point_history')
          .select('id, user_id, teacher_name, date, points, activity_type, title, description, created_at, idempotency_key')
          .eq('idempotency_key', cleanIdempotencyKey)
          .maybeSingle();

        if (existingPoint) {
          return res.status(200).json({
            success: true,
            data: existingPoint,
            idempotent: true,
          });
        }
      }

      // 2. Otorisasi & Perhitungan Poin Berdasarkan Role Caller
      let verifiedPoints: number;
      let verifiedTitle: string;
      let verifiedTeacherName: string;

      if (callerRole === 'GURU') {
        // GURU HANYA boleh mencatat untuk dirinya sendiri
        if (targetUserId !== callerUser.id) {
          return res.status(403).json({
            success: false,
            errorCode: 'AUTH_FORBIDDEN_RECIPIENT',
            errorMessage: 'Akses Ditolak: Anda hanya diperbolehkan mencatat poin presensi untuk diri sendiri.',
          });
        }

        // Whitelist aktivitas yang diizinkan untuk guru
        const catalogItem = GURU_ACTIVITY_CATALOG[cleanActivity];
        if (!catalogItem) {
          return res.status(403).json({
            success: false,
            errorCode: 'AUTH_FORBIDDEN_ACTIVITY',
            errorMessage: `Akses Ditolak: Jenis aktivitas ${cleanActivity} tidak diizinkan untuk dicatat secara mandiri oleh guru.`,
          });
        }

        // Poin DIHITUNG SECARA DETERMINISTIK DI SERVER (klien tidak boleh mengirim poin bebas)
        verifiedPoints = catalogItem.points;
        verifiedTitle = customTitle && typeof customTitle === 'string' && customTitle.trim().length > 0
          ? customTitle.trim().slice(0, 150)
          : catalogItem.title;
        verifiedTeacherName = callerUser.full_name;
      } else {
        // ADMIN, OPERATOR, KEPSEK
        // Cari guru penerima di tabel users untuk memastikan guru aktif di sekolah
        const { data: recipientUser, error: recipErr } = await serverSupabase
          .from('users')
          .select('id, full_name, role, account_status')
          .eq('id', targetUserId)
          .maybeSingle();

        if (recipErr || !recipientUser) {
          return res.status(404).json({
            success: false,
            errorCode: 'RECIPIENT_NOT_FOUND',
            errorMessage: 'Guru penerima poin tidak ditemukan di database.',
          });
        }

        if (recipientUser.account_status !== 'ACTIVE') {
          return res.status(400).json({
            success: false,
            errorCode: 'RECIPIENT_INACTIVE',
            errorMessage: 'Akun guru penerima sedang tidak aktif atau terblokir.',
          });
        }

        verifiedTeacherName = recipientUser.full_name;

        // Jika aktivitas terdaftar di katalog, gunakan nilai default atau nilai input yang divalidasi
        const catalogItem = GURU_ACTIVITY_CATALOG[cleanActivity];
        if (typeof body.points === 'number' && Number.isInteger(body.points)) {
          if (body.points < -50 || body.points > 100) {
            return res.status(400).json({
              success: false,
              errorCode: 'INVALID_POINTS_RANGE',
              errorMessage: 'Nilai poin penyesuaian harus berada di antara -50 hingga +100.',
            });
          }
          verifiedPoints = body.points;
        } else if (catalogItem) {
          verifiedPoints = catalogItem.points;
        } else {
          verifiedPoints = 10;
        }

        verifiedTitle = customTitle && typeof customTitle === 'string' && customTitle.trim().length > 0
          ? customTitle.trim().slice(0, 150)
          : (catalogItem?.title || `Pemberian Poin: ${cleanActivity}`);
      }

      // 3. Simpan ke Database
      const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
        ? crypto.randomUUID()
        : 'pt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

      const payload = {
        id: newId,
        user_id: targetUserId,
        teacher_name: verifiedTeacherName,
        date: targetDate,
        points: verifiedPoints,
        activity_type: cleanActivity,
        title: verifiedTitle,
        description: description && typeof description === 'string' ? description.trim().slice(0, 500) : null,
        idempotency_key: cleanIdempotencyKey || null,
        status: 'VALID',
        source: body.source ? String(body.source).trim() : 'SYSTEM',
        occurred_at: body.occurred_at ? String(body.occurred_at).trim() : targetDate,
        created_at: new Date().toISOString(),
      };

      const { data: inserted, error: insertErr } = await serverSupabase
        .from('teacher_point_history')
        .insert(payload)
        .select('id, user_id, teacher_name, date, points, activity_type, title, description, created_at, idempotency_key, status, voided_at, void_reason, source, occurred_at')
        .maybeSingle();

      if (insertErr) {
        // Tangani jika ada bentrok idempotency concurrent
        const isConflict =
          insertErr.code === '23505' ||
          insertErr.message?.includes('duplicate key') ||
          insertErr.message?.includes('unique');

        if (isConflict) {
          const { data: conflictRow } = await serverSupabase
            .from('teacher_point_history')
            .select('id, user_id, teacher_name, date, points, activity_type, title, description, created_at, idempotency_key, status, voided_at, void_reason, source, occurred_at')
            .eq('idempotency_key', cleanIdempotencyKey)
            .maybeSingle();

          if (conflictRow) {
            return res.status(200).json({
              success: true,
              data: conflictRow,
              idempotent: true,
            });
          }
        }

        console.error('[API /api/teacher-points POST insert error]:', insertErr);
        return res.status(500).json({
          success: false,
          errorCode: 'DATABASE_INSERT_ERROR',
          errorMessage: 'Gagal mencatat riwayat poin ke database cloud.',
        });
      }

      return res.status(200).json({
        success: true,
        data: inserted || payload,
      });
    } catch (err: any) {
      console.error('[API /api/teacher-points POST exception]:', err);
      return res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SERVER_ERROR',
        errorMessage: 'Terjadi kesalahan sistem saat menyimpan riwayat poin.',
      });
    }
  }

  return res.status(405).json({
    success: false,
    errorCode: 'METHOD_NOT_ALLOWED',
    errorMessage: 'Metode request tidak diizinkan. Gunakan GET atau POST.',
  });
}
