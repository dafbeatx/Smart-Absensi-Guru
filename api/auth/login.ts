// api/auth/login.ts
// Serverless Login Engine for Smart Absensi Guru (SAGA)
// Emits server-verifiable, stateful CSPRNG session tokens and stores only SHA-256 token hash

import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import { serverSupabase, hashSessionToken, isServiceRoleConfigured } from '../_shared/session-auth.js';

function timingSafeMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a, 'utf-8');
  const bufB = Buffer.from(b, 'utf-8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export default async function handler(req: any, res: any) {
  // CORS configuration
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Metode request tidak diizinkan. Gunakan POST.',
    });
  }

  // 1. Fail-Closed Check: Server Service Role Configuration
  if (!isServiceRoleConfigured()) {
    console.error('[AuthLogin] SUPABASE_SERVICE_ROLE_KEY configured: false');
    return res.status(500).json({
      success: false,
      errorCode: 'SUPABASE_SERVICE_ROLE_KEY_MISSING',
      errorMessage: 'Konfigurasi keamanan server belum lengkap (Service Role missing). Hubungi Administrator.',
    });
  }

  const { identity, pin, device_uuid, device_model } = req.body || {};

  // 2. Validasi Kelengkapan Input
  if (!identity || typeof identity !== 'string' || !pin || typeof pin !== 'string') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Identitas (No HP / NPP) dan PIN 6-digit wajib diisi.',
    });
  }

  const cleanIdentity = identity.trim();
  const cleanPin = pin.trim();

  try {
    // 2. Cari Pengguna di public.users
    const { data: user, error: userErr } = await serverSupabase
      .from('users')
      .select('*')
      .or(`phone_number.eq.${cleanIdentity},nip.eq.${cleanIdentity},id.eq.${cleanIdentity}`)
      .maybeSingle();

    if (userErr || !user) {
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_USER_NOT_FOUND',
        errorMessage: 'Akun pengguna tidak ditemukan. Periksa No HP / NPP Anda.',
      });
    }

    // 3. Verifikasi Status Akun & Lockout
    if (user.account_status === 'LOCKED' || user.account_status === 'INACTIVE') {
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_USER_INACTIVE',
        errorMessage: 'Akun Anda sedang terblokir atau tidak aktif. Hubungi Admin Sekolah.',
      });
    }

    const now = new Date();
    if (user.locked_until && new Date(user.locked_until) > now) {
      const remainingMinutes = Math.ceil((new Date(user.locked_until).getTime() - now.getTime()) / 60000);
      return res.status(429).json({
        success: false,
        errorCode: 'AUTH_ACCOUNT_LOCKED',
        errorMessage: `Akun terkunci sementara karena salah PIN berulang kali. Silakan coba lagi dalam ${remainingMinutes} menit.`,
      });
    }

    // 4. Verifikasi PIN
    const hashedInputPin = crypto.createHash('sha256').update(cleanPin).digest('hex');
    const isPinValid = timingSafeMatch(user.pin_hash, hashedInputPin) || timingSafeMatch(user.pin_hash, cleanPin);

    if (!isPinValid) {
      const nextFailedCount = (user.failed_login_count || 0) + 1;
      const updates: Record<string, any> = { failed_login_count: nextFailedCount };

      let lockoutMsg = 'PIN 6-digit yang Anda masukkan salah.';
      if (nextFailedCount >= 5) {
        updates.locked_until = new Date(Date.now() + 15 * 60 * 1000).toISOString();
        lockoutMsg = 'Terlalu banyak percobaan gagal (5x). Akun Anda dikunci selama 15 menit demi keamanan.';
      }

      await serverSupabase.from('users').update(updates).eq('id', user.id);

      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        errorMessage: lockoutMsg,
      });
    }

    // 5. Reset Counter Gagal jika PIN Benar
    if (user.failed_login_count > 0 || user.locked_until) {
      await serverSupabase
        .from('users')
        .update({ failed_login_count: 0, locked_until: null })
        .eq('id', user.id);
    }

    // 6. Penerbitan Session Token CSPRNG (32 Bytes / 64 Hex Characters)
    const rawToken = 'saga_sess_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(rawToken);

    // Kebijakan Kedaluwarsa Sesi: 30 Hari
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const ipAddress = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
    const userAgent = (req.headers['user-agent'] as string) || null;

    // 7. Simpan HANYA token_hash ke Database (Zero Plaintext Token in DB)
    const { error: sessionErr } = await serverSupabase.from('user_sessions').insert({
      user_id: user.id,
      token_hash: tokenHash,
      device_uuid: device_uuid || null,
      device_model: device_model || null,
      ip_address: ipAddress,
      user_agent: userAgent,
      expires_at: expiresAt,
    });

    if (sessionErr) {
      return res.status(500).json({
        success: false,
        errorCode: 'INTERNAL_SESSION_ERROR',
        errorMessage: 'Gagal membuat sesi baru di server. Silakan coba kembali.',
      });
    }

    // 8. Bentuk User Profile Publik (PIN Hash Dibuang / Sanitasi)
    const userProfile = {
      id: user.id,
      nip: user.nip || null,
      full_name: user.full_name,
      phone_number: user.phone_number,
      role: user.role,
      position: user.position || null,
      avatar_url: user.avatar_url || null,
      is_active: user.account_status === 'ACTIVE',
      created_at: user.created_at,
    };

    return res.status(200).json({
      success: true,
      token: rawToken,
      user: userProfile,
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat memproses login.',
    });
  }
}
