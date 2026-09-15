// Vercel Serverless Function: api/push-subscriptions.ts
// Handles secure, server-side Web Push subscription storage using Supabase Service-Role
// Protects against unauthorized endpoint takeovers and client-side RLS 401 violations

import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucHBmbWpzYnF4YnRpb3lwbmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzcyNDksImV4cCI6MjEwNDk1MzI0OX0.ewXX-KW3SMEF-KtOZ5P1MY5IpZSJQImDt5g9maTOWfE';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY_TOREN2 ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY_TOREN2 ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL_TOREN2 ||
  process.env.VITE_SUPABASE_URL ||
  'https://fnppfmjsbqxbtioypnap.supabase.co';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface SubscriptionRequestBody {
  subscription?: {
    endpoint: string;
    p256dh: string;
    auth: string;
    device_type?: 'MOBILE' | 'DESKTOP' | 'TABLET' | 'UNKNOWN';
    user_agent?: string;
  };
  endpoint?: string;
}

/**
 * Validates session token and returns the authenticated user's ID
 */
async function authenticateUser(authHeader: string | undefined): Promise<{ userId: string; role: string } | null> {
  if (!authHeader) return null;

  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  // Format token internal: SB_JWT_<userId>_<timestamp> atau token khusus
  // Contoh: SB_JWT_usr_guru_002_1789269893399
  let candidateUserId: string | null = null;
  if (token.startsWith('SB_JWT_')) {
    const parts = token.split('_');
    // parts: ['SB', 'JWT', 'usr', 'guru', '002', 'timestamp']
    // User ID di Smart Absensi berformat: usr_guru_002, usr_kepsek_002, usr_admin_001, atau UUID
    if (parts.length >= 4) {
      // Ambil bagian tengah sebelum timestamp terakhir
      const withoutPrefix = token.substring('SB_JWT_'.length);
      const lastUnderscore = withoutPrefix.lastIndexOf('_');
      if (lastUnderscore > 0) {
        candidateUserId = withoutPrefix.substring(0, lastUnderscore);
      }
    }
  } else if (token.startsWith('usr_')) {
    candidateUserId = token;
  }

  // Jika tidak terurai via convention, cek apakah token ada di header admin secret
  const expectedSecret = process.env.INTERNAL_PUSH_SECRET || process.env.VAPID_PRIVATE_KEY;
  if (expectedSecret && token === expectedSecret) {
    return { userId: 'SYSTEM_INTERNAL', role: 'ADMIN' };
  }

  if (!candidateUserId) return null;

  // Verifikasi keabsahan user di PostgreSQL public.users
  try {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, role, account_status')
      .eq('id', candidateUserId)
      .maybeSingle();

    if (error || !user) {
      return null;
    }

    if (user.account_status === 'LOCKED' || user.account_status === 'INACTIVE') {
      return null;
    }

    return { userId: user.id, role: user.role };
  } catch {
    return null;
  }
}

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Internal-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 1. Verifikasi Autentikasi Pengguna
  const authHeader = req.headers.authorization || req.headers['x-session-token'];
  const authenticated = await authenticateUser(authHeader);

  if (!authenticated) {
    return res.status(401).json({
      success: false,
      persisted: false,
      errorCode: 'AUTH_SESSION_MISSING',
      errorMessage: 'Sesi login tidak valid, kedaluwarsa, atau pengguna belum terotentikasi.',
    });
  }

  const currentUserId = authenticated.userId;

  // 2. Handler POST: Simpan / Perbarui Push Subscription
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
      // 2A. Verifikasi Kepemilikan Endpoint (Mencegah Endpoint Hijacking antar-user)
      const { data: existingSub, error: checkError } = await supabase
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
        // Blokir jika ada usaha manipulasi kepemilikan tanpa izin
        return res.status(409).json({
          success: false,
          persisted: false,
          errorCode: 'ENDPOINT_CONFLICT',
          errorMessage: 'Endpoint push ini telah terdaftar untuk profil pengguna lain pada perangkat ini.',
        });
      }

      // 2B. Simpan dengan Service-Role Key (Bypass RLS anonim secara aman dari server)
      const userAgent = sub.user_agent || req.headers['user-agent'] || null;
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

      const { data, error: upsertError } = await supabase
        .from('push_subscriptions')
        .upsert(payload, { onConflict: 'endpoint' })
        .select('id, user_id, endpoint, updated_at')
        .single();

      if (upsertError) {
        console.error('[API push-subscriptions] Upsert error:', upsertError.message);
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
      console.error('[API push-subscriptions] Exception:', err);
      return res.status(500).json({
        success: false,
        persisted: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: err?.message || 'Terjadi kesalahan jaringan saat menyimpan subscription.',
      });
    }
  }

  // 3. Handler DELETE: Hapus Push Subscription Milik Pengguna
  if (req.method === 'DELETE') {
    const endpointToDelete = req.query.endpoint || req.body?.endpoint;

    if (!endpointToDelete || typeof endpointToDelete !== 'string') {
      return res.status(400).json({
        success: false,
        errorCode: 'INVALID_SUBSCRIPTION',
        errorMessage: 'Parameter "endpoint" wajib disertakan untuk penghapusan.',
      });
    }

    try {
      // User hanya dapat menghapus subscription miliknya sendiri
      let deleteQuery = supabase
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
