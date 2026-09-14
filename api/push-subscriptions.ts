// Vercel Serverless Function: api/push-subscriptions.ts
// Handles secure, server-side Web Push subscription storage using Supabase Service-Role
// Protects against unauthorized endpoint takeovers and client-side RLS violations
// Integrates with SAGA Session Store (saga_sess_...) via authenticateUser

import {
  serverSupabase,
  authenticateUser,
  isServiceRoleConfigured,
} from './_shared/session-auth.js';

interface SubscriptionRequestBody {
  subscription?: {
    endpoint: string;
    p256dh: string;
    auth: string;
    device_type?: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'UNKNOWN';
    user_agent?: string;
    user_id?: string; // May be sent by client, but MUST BE IGNORED by server
  };
  endpoint?: string;
  user_id?: string;
}

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Verifikasi Autentikasi Pengguna via Session Store (saga_sess_...)
  const internalSecret = req.headers?.['x-internal-secret'];
  const expectedSecret = process.env.INTERNAL_PUSH_SECRET || process.env.VAPID_PRIVATE_KEY;

  let currentUserId: string | null = null;

  if (internalSecret && expectedSecret && internalSecret === expectedSecret) {
    currentUserId = 'SYSTEM_INTERNAL';
  } else {
    const auth = await authenticateUser(req);
    if (!auth.ok) {
      return res.status(auth.status || 401).json({
        success: false,
        persisted: false,
        errorCode: auth.errorCode,
        errorMessage: auth.errorMessage,
      });
    }
    currentUserId = auth.userId;
  }

  // 2. Fail-Closed Check: Server Service Role Configuration
  if (!isServiceRoleConfigured()) {
    console.error('[PushSubscription] SUPABASE_SERVICE_ROLE_KEY configured: false');
    return res.status(500).json({
      success: false,
      persisted: false,
      errorCode: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
      errorMessage: 'Konfigurasi keamanan push notification belum lengkap (Service Role missing). Hubungi Administrator.',
    });
  }

  // 3. Handler POST: Simpan / Perbarui Push Subscription
  if (req.method === 'POST') {
    const body: SubscriptionRequestBody = req.body || {};
    const sub = body.subscription || (body as any);

    if (!sub || !sub.endpoint || typeof sub.endpoint !== 'string' || !sub.endpoint.startsWith('http')) {
      return res.status(400).json({
        success: false,
        persisted: false,
        errorCode: 'INVALID_SUBSCRIPTION',
        errorMessage: 'Payload subscription tidak valid: endpoint wajib berupa URL push service yang valid.',
      });
    }

    if (!sub.p256dh || !sub.auth) {
      return res.status(400).json({
        success: false,
        persisted: false,
        errorCode: 'INVALID_SUBSCRIPTION',
        errorMessage: 'Payload subscription tidak valid: p256dh dan auth key wajib diisi.',
      });
    }

    try {
      // 3A. Verifikasi Kepemilikan Endpoint (Mencegah Endpoint Hijacking antar-user)
      const { data: existingSub, error: checkError } = await serverSupabase
        .from('push_subscriptions')
        .select('id, user_id')
        .eq('endpoint', sub.endpoint)
        .maybeSingle();

      if (checkError && checkError.code === '42P01') {
        return res.status(404).json({
          success: false,
          persisted: false,
          errorCode: 'TABLE_NOT_FOUND',
          errorMessage: 'Tabel push_subscriptions belum terpasang di database Supabase.',
        });
      }

      // Jika endpoint sudah ada dan dimiliki oleh user LAIN:
      if (existingSub && existingSub.user_id !== currentUserId && currentUserId !== 'SYSTEM_INTERNAL') {
        return res.status(409).json({
          success: false,
          persisted: false,
          errorCode: 'ENDPOINT_CONFLICT',
          errorMessage: 'Endpoint push ini telah terdaftar untuk profil pengguna lain pada perangkat ini.',
        });
      }

      // 3B. Simpan dengan Service-Role Key (Bypass RLS anonim secara aman dari server)
      // User identity DIKUNCI KE currentUserId (berasal dari sesi database, BUKAN dari payload client)
      const userAgent = sub.user_agent || req.headers?.['user-agent'] || null;
      const deviceType = sub.device_type || (/mobile|android|iphone|ipad/i.test(userAgent || '') ? 'MOBILE' : 'DESKTOP');
      const nowIso = new Date().toISOString();

      const payload = {
        user_id: currentUserId, // Diambil dari sesi yang divalidasi, BUKAN dari payload client
        endpoint: sub.endpoint.trim(),
        p256dh: sub.p256dh.trim(),
        auth: sub.auth.trim(),
        device_type: deviceType,
        user_agent: userAgent,
        last_seen_at: nowIso,
        updated_at: nowIso,
      };

      const { data, error: upsertError } = await serverSupabase
        .from('push_subscriptions')
        .upsert(payload, { onConflict: 'endpoint' })
        .select('id, user_id, endpoint, updated_at')
        .single();

      if (upsertError) {
        console.error('[API push-subscriptions] Upsert error code:', upsertError.code);
        return res.status(500).json({
          success: false,
          persisted: false,
          errorCode: 'RLS_DENIED',
          errorMessage: `Gagal menyimpan subscription ke cloud: ${upsertError.message}`,
        });
      }

      return res.status(200).json({
        success: true,
        persisted: true,
        data: {
          id: data.id,
          user_id: data.user_id,
          updated_at: data.updated_at,
        },
      });
    } catch (err: any) {
      console.error('[API push-subscriptions] Exception:', err?.message);
      return res.status(500).json({
        success: false,
        persisted: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: err?.message || 'Terjadi kesalahan saat menyimpan subscription.',
      });
    }
  }

  // 4. Handler DELETE: Hapus Push Subscription Milik Pengguna
  if (req.method === 'DELETE') {
    const endpointToDelete = req.query?.endpoint || req.body?.endpoint;

    if (!endpointToDelete || typeof endpointToDelete !== 'string') {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_SUBSCRIPTION',
        errorMessage: 'Parameter "endpoint" wajib disertakan untuk penghapusan.',
      });
    }

    try {
      // User hanya dapat menghapus subscription miliknya sendiri
      let deleteQuery = serverSupabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpointToDelete.trim());

      if (currentUserId !== 'SYSTEM_INTERNAL') {
        deleteQuery = deleteQuery.eq('user_id', currentUserId);
      }

      const { error: deleteError } = await deleteQuery;

      if (deleteError) {
        return res.status(500).json({
          success: false,
          errorMessage: deleteError.message,
        });
      }

      return res.status(200).json({
        success: true,
        deleted: true,
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        errorMessage: err?.message || 'Gagal menghapus subscription.',
      });
    }
  }

  return res.status(405).json({
    success: false,
    errorMessage: 'Method Not Allowed. Gunakan POST atau DELETE.',
  });
}
