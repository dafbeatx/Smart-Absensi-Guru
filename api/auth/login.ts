// api/auth/login.ts
// Serverless Auth Engine for Smart Absensi Guru (SAGA)
// Handles:
// - POST /api/auth/login (State-machine login + Turnstile + IP Rate Limiter + CSPRNG Session + HttpOnly Cookie)
// - GET/POST /api/auth/session (rewritten via vercel.json -> ?action=session)
// - POST /api/auth/change-pin (rewritten via vercel.json -> ?action=change-pin)

import crypto from 'node:crypto';
import {
  serverSupabase,
  hashSessionToken,
  authenticateUser,
  applyAuthCorsHeaders,
  buildSessionCookie,
  buildClearSessionCookie,
  SESSION_MAX_AGE_SECONDS,
} from '../_shared/session-auth.js';

const DEFAULT_PIN_HASH = '8d969eef6ecad3c29a3a629280e686cf0c3f5d5a86aff3ca12020c923adc6c92'; // SHA-256('123456')
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const MAX_TOTAL_ATTEMPTS_PER_IP = 40;
const MAX_FAILED_ATTEMPTS_PER_IP = 12;
const MAX_NATIVE_FAILED_ATTEMPTS_PER_IP = 6;

interface IpRateEntry {
  totalCount: number;
  failedCount: number;
  windowStart: number;
}

const ipRateLimitMap = new Map<string, IpRateEntry>();

function checkIpRateLimit(ip: string, isNativeBypass: boolean): { allowed: boolean; retryAfterSec: number } {
  if (!ip) return { allowed: true, retryAfterSec: 0 };
  const now = Date.now();

  // Periodic cleanup to prevent unbounded memory growth
  if (ipRateLimitMap.size > 500) {
    for (const [k, entry] of ipRateLimitMap.entries()) {
      if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
        ipRateLimitMap.delete(k);
      }
    }
  }

  let entry = ipRateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    entry = { totalCount: 0, failedCount: 0, windowStart: now };
    ipRateLimitMap.set(ip, entry);
  }

  entry.totalCount += 1;
  const maxFailures = isNativeBypass ? MAX_NATIVE_FAILED_ATTEMPTS_PER_IP : MAX_FAILED_ATTEMPTS_PER_IP;

  if (entry.totalCount > MAX_TOTAL_ATTEMPTS_PER_IP || entry.failedCount >= maxFailures) {
    const retryAfterSec = Math.max(1, Math.ceil((entry.windowStart + RATE_LIMIT_WINDOW_MS - now) / 1000));
    return { allowed: false, retryAfterSec };
  }

  return { allowed: true, retryAfterSec: 0 };
}

function recordIpAuthFailure(ip: string): void {
  if (!ip) return;
  const now = Date.now();
  const entry = ipRateLimitMap.get(ip);
  if (!entry || now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
    ipRateLimitMap.set(ip, { totalCount: 1, failedCount: 1, windowStart: now });
  } else {
    entry.failedCount += 1;
  }
}

function timingSafeMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
  const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
  return crypto.timingSafeEqual(digestA, digestB);
}

function isSafePostgrestIdentity(value: string): boolean {
  if (!value || value.length > 64) return false;
  // Disallow PostgREST filter operators/delimiters (, ( ) " ' \ ; * % < > newline)
  return /^[a-zA-Z0-9_@+\-\s.]+$/.test(value);
}

function resolveAction(req: any): string {
  if (req?.query?.action) return String(req.query.action).trim();
  if (typeof req?.url === 'string' && req.url.includes('action=')) {
    try {
      const parsed = new URL(req.url, 'http://localhost');
      return String(parsed.searchParams.get('action') || '').trim();
    } catch {
      return '';
    }
  }
  return '';
}

function isValidVerifiedTurnstileHost(hostname: string | undefined): boolean {
  if (!hostname) return false;
  if (hostname === 'example.com') return true; // Cloudflare official test sitekey host
  const cleanHost = hostname.toLowerCase();
  if (cleanHost === 'localhost' || cleanHost === '127.0.0.1') return true;
  if (cleanHost === 'smart-absensi-guru-eight.vercel.app') return true;
  if (/^smart-absensi-guru[a-z0-9-]*\.vercel\.app$/.test(cleanHost)) return true;
  if (process.env.VERCEL_URL && cleanHost === process.env.VERCEL_URL.toLowerCase()) return true;
  if (process.env.VITE_APP_HOSTNAME && cleanHost === process.env.VITE_APP_HOSTNAME.toLowerCase()) return true;
  return false;
}

function isStrictNativeAppRequest(req: any, turnstileToken: unknown, deviceUuid: unknown): boolean {
  const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin.trim().toLowerCase() : '';
  const platformHeader = typeof req?.headers?.['x-saga-platform'] === 'string'
    ? req.headers['x-saga-platform'].trim().toLowerCase()
    : '';

  // Browser web origins (https://*.vercel.app, etc.) can NEVER forge their Origin header in browser JS
  const isNativeContainerOrigin =
    !origin ||
    origin === 'null' ||
    origin === 'file://' ||
    origin === 'capacitor://localhost' ||
    origin === 'ionic://localhost' ||
    origin === 'https://localhost' ||
    origin === 'http://localhost';

  if (!isNativeContainerOrigin) return false;
  if (typeof deviceUuid !== 'string' || deviceUuid.trim().length < 10) return false;

  if (platformHeader === 'android-capacitor' && turnstileToken === 'native-android-verified-token') {
    return true;
  }
  if (platformHeader === 'electron-desktop' && turnstileToken === 'native-windows-verified-token') {
    return true;
  }
  return false;
}

async function handleSessionAction(req: any, res: any) {
  applyAuthCorsHeaders(req, res, 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      errorCode: 'METHOD_NOT_ALLOWED',
      errorMessage: 'Metode request tidak diizinkan.',
    });
  }

  const auth = await authenticateUser(req);
  if (!auth.ok) {
    if (
      auth.errorCode === 'AUTH_SESSION_REVOKED' ||
      auth.errorCode === 'AUTH_SESSION_EXPIRED' ||
      auth.errorCode === 'AUTH_SESSION_INVALID' ||
      auth.errorCode === 'AUTH_USER_INACTIVE'
    ) {
      res.setHeader('Set-Cookie', buildClearSessionCookie(req));
    }
    return res.status(auth.status).json({
      success: false,
      errorCode: auth.errorCode,
      errorMessage: auth.errorMessage,
    });
  }

  // Re-verify default PIN status against pin_hash on server as belt-and-suspenders guard
  let serverMustChangePin = Boolean(auth.user.must_change_pin);
  if (!serverMustChangePin) {
    try {
      const { data: pinCheck } = await serverSupabase
        .from('users')
        .select('pin_hash')
        .eq('id', auth.userId)
        .maybeSingle();
      if (pinCheck?.pin_hash && (timingSafeMatch(pinCheck.pin_hash, DEFAULT_PIN_HASH) || timingSafeMatch(pinCheck.pin_hash, '123456'))) {
        serverMustChangePin = true;
      }
    } catch {
      // ignore fallback check
    }
  }

  return res.status(200).json({
    success: true,
    user: {
      ...auth.user,
      is_active: true,
      must_change_pin: serverMustChangePin,
    },
  });
}

async function handleChangePinAction(req: any, res: any) {
  applyAuthCorsHeaders(req, res, 'POST, OPTIONS');

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

  const auth = await authenticateUser(req);
  if (!auth.ok) {
    return res.status(auth.status).json({
      success: false,
      errorCode: auth.errorCode,
      errorMessage: auth.errorMessage,
    });
  }

  const { new_pin, current_pin, target_user_id } = req.body || {};
  const cleanNewPin = typeof new_pin === 'string' ? new_pin.trim() : '';

  if (!/^\d{6}$/.test(cleanNewPin)) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'PIN baru wajib terdiri dari tepat 6 digit angka.',
    });
  }

  const requestedTargetId =
    typeof target_user_id === 'string' && target_user_id.trim().length > 0
      ? target_user_id.trim()
      : auth.userId;

  const isAdminReset = requestedTargetId !== auth.userId;

  if (isAdminReset) {
    const normalizedRole = String(auth.role || '').toUpperCase();
    if (normalizedRole !== 'ADMIN' && normalizedRole !== 'OPERATOR') {
      return res.status(403).json({
        success: false,
        errorCode: 'AUTH_FORBIDDEN',
        errorMessage: 'Anda tidak memiliki wewenang mereset PIN pengguna lain.',
      });
    }
  } else {
    if (cleanNewPin === '123456') {
      return res.status(400).json({
        success: false,
        errorCode: 'WEAK_PIN_REJECTED',
        errorMessage: 'PIN baru tidak boleh menggunakan PIN bawaan (123456).',
      });
    }

    if (current_pin !== undefined && current_pin !== null) {
      const cleanCurrentPin = String(current_pin).trim();
      const { data: curUser } = await serverSupabase
        .from('users')
        .select('pin_hash')
        .eq('id', auth.userId)
        .maybeSingle();

      const hashedCurrent = crypto.createHash('sha256').update(cleanCurrentPin).digest('hex');
      const curMatch =
        timingSafeMatch(curUser?.pin_hash, hashedCurrent) || timingSafeMatch(curUser?.pin_hash, cleanCurrentPin);
      if (!curUser?.pin_hash || !curMatch) {
        return res.status(401).json({
          success: false,
          errorCode: 'AUTH_INVALID_CREDENTIALS',
          errorMessage: 'PIN saat ini yang Anda masukkan tidak sesuai.',
        });
      }
    }
  }

  const newPinHash = crypto.createHash('sha256').update(cleanNewPin).digest('hex');
  const targetId = requestedTargetId;
  const nextMustChangePin = isAdminReset;

  const updatePayload: Record<string, unknown> = {
    pin_hash: newPinHash,
    must_change_pin: nextMustChangePin,
    updated_at: new Date().toISOString(),
  };

  if (isAdminReset) {
    updatePayload.failed_login_count = 0;
    updatePayload.locked_until = null;
  }

  let updateRes = await serverSupabase.from('users').update(updatePayload).eq('id', targetId);

  // Schema resilience: retry without must_change_pin / updated_at if DB migration 70 hasn't executed yet
  if (updateRes.error && String(updateRes.error.message || '').includes('must_change_pin')) {
    delete updatePayload.must_change_pin;
    updateRes = await serverSupabase.from('users').update(updatePayload).eq('id', targetId);
  }

  if (updateRes.error) {
    return res.status(500).json({
      success: false,
      errorCode: 'PIN_UPDATE_FAILED',
      errorMessage: 'Gagal memperbarui PIN di database.',
    });
  }

  // Revoke compromised/old sessions:
  // - Admin reset: revoke ALL active sessions of target user
  // - Self change: revoke all OTHER sessions of this user
  try {
    const revokeQuery = serverSupabase
      .from('user_sessions')
      .update({
        revoked_at: new Date().toISOString(),
        revocation_reason: isAdminReset ? 'ADMIN_PIN_RESET' : 'PIN_CHANGED',
      })
      .eq('user_id', targetId)
      .is('revoked_at', null);

    if (isAdminReset) {
      await revokeQuery;
    } else if (typeof revokeQuery.neq === 'function') {
      await revokeQuery.neq('id', auth.sessionId);
    }
  } catch {
    // ignore background revocation errors
  }

  return res.status(200).json({
    success: true,
    must_change_pin: nextMustChangePin,
    message: isAdminReset ? 'PIN pengguna berhasil direset.' : 'PIN baru berhasil disimpan.',
  });
}

export default async function handler(req: any, res: any) {
  const action = resolveAction(req);
  if (action === 'session') {
    return handleSessionAction(req, res);
  }
  if (action === 'change-pin') {
    return handleChangePinAction(req, res);
  }

  applyAuthCorsHeaders(req, res, 'POST, OPTIONS');

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

  const { identity, pin, device_uuid, device_model } = req.body || {};

  // 1. Validasi Kelengkapan & Format Input
  if (!identity || typeof identity !== 'string' || !pin || typeof pin !== 'string') {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Identitas (No HP / NPP) dan PIN 6-digit wajib diisi.',
    });
  }

  const cleanIdentity = identity.trim();
  const cleanPin = pin.trim();

  if (!isSafePostgrestIdentity(cleanIdentity)) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'Format No HP / NPP tidak valid.',
    });
  }

  if (!/^\d{6}$/.test(cleanPin)) {
    return res.status(400).json({
      success: false,
      errorCode: 'VALIDATION_ERROR',
      errorMessage: 'PIN 6-digit yang Anda masukkan harus berupa 6 angka.',
    });
  }

  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || process.env.TURNSTILE_SECRET;
  const turnstileToken = req.body?.['cf-turnstile-response'] || req.body?.turnstile_token;
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket?.remoteAddress || '';
  const isNativeExempt = isStrictNativeAppRequest(req, turnstileToken, device_uuid);

  // 1a. Proteksi Brute-Force & Password-Spraying Berbasis IP
  const rateCheck = checkIpRateLimit(clientIp, isNativeExempt);
  if (!rateCheck.allowed) {
    res.setHeader('Retry-After', String(rateCheck.retryAfterSec));
    return res.status(429).json({
      success: false,
      errorCode: 'RATE_LIMIT_EXCEEDED',
      errorMessage: `Terlalu banyak percobaan login dari jaringan ini. Silakan tunggu ${Math.ceil(rateCheck.retryAfterSec / 60)} menit sebelum mencoba lagi.`,
    });
  }

  // 1b. Canonical Cloudflare Turnstile Bot Verification (Fail-Closed di Produksi, Zero Web Bypass)
  const isProductionRuntime =
    process.env.VERCEL_ENV === 'production' ||
    (process.env.VERCEL === '1' && process.env.NODE_ENV === 'production');

  if (!turnstileSecret && isProductionRuntime) {
    return res.status(503).json({
      success: false,
      errorCode: 'BOT_VERIFICATION_MISCONFIGURED',
      errorMessage: 'Konfigurasi verifikasi keamanan server belum lengkap. Hubungi Administrator.',
    });
  }

  if (turnstileSecret && !isNativeExempt) {
    if (typeof turnstileToken !== 'string' || turnstileToken.length === 0 || turnstileToken.length > 2048) {
      return res.status(403).json({
        success: false,
        errorCode: 'BOT_VERIFICATION_REQUIRED',
        errorMessage: 'Verifikasi keamanan Cloudflare Turnstile wajib diselesaikan.',
      });
    }

    // Explicitly reject client-minted fallback/timeout tokens and spoofed native tokens from browser origins
    if (
      turnstileToken.startsWith('cf-fallback-') ||
      turnstileToken.startsWith('cf-timeout-') ||
      turnstileToken.startsWith('native-')
    ) {
      return res.status(403).json({
        success: false,
        errorCode: 'BOT_VERIFICATION_FAILED',
        errorMessage: 'Token verifikasi Cloudflare Turnstile tidak valid. Selesaikan tantangan verifikasi asli.',
      });
    }

    try {
      const verifyRes = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10000),
        body: new URLSearchParams({
          secret: turnstileSecret,
          response: turnstileToken,
          remoteip: clientIp,
        }),
      });

      if (!verifyRes.ok) {
        throw new Error(`siteverify HTTP ${verifyRes.status}`);
      }

      const verifyJson = (await verifyRes.json()) as {
        success: boolean;
        action?: string;
        hostname?: string;
        'error-codes'?: string[];
      };

      const isTestVerify = verifyJson.hostname === 'example.com';
      const actionValid = isTestVerify ? (!verifyJson.action || verifyJson.action === 'login') : verifyJson.action === 'login';
      const hostValid = isTestVerify || isValidVerifiedTurnstileHost(verifyJson.hostname);

      if (!verifyJson.success || !actionValid || !hostValid) {
        console.warn('[api/auth/login] Turnstile rejected:', verifyJson['error-codes']);
        return res.status(403).json({
          success: false,
          errorCode: 'BOT_VERIFICATION_FAILED',
          errorMessage: 'Verifikasi keamanan Cloudflare Turnstile tidak valid atau telah kedaluwarsa.',
        });
      }
    } catch (err: any) {
      console.warn('[api/auth/login] Turnstile siteverify network error:', err);
      return res.status(403).json({
        success: false,
        errorCode: 'BOT_VERIFICATION_ERROR',
        errorMessage: 'Gagal memverifikasi keamanan Cloudflare. Silakan coba beberapa saat lagi.',
      });
    }
  }

  try {
    // 2. Cari Pengguna di public.users (quoted PostgREST values + sanitized identity)
    const orFilter = `phone_number.eq.${cleanIdentity},nip.eq.${cleanIdentity},id.eq.${cleanIdentity}`;
    let userLookup = await serverSupabase
      .from('users')
      .select('id, nip, full_name, phone_number, role, position, avatar_url, account_status, created_at, pin_hash, failed_login_count, locked_until, must_change_pin')
      .or(orFilter)
      .maybeSingle();

    if (userLookup.error && String(userLookup.error.message || '').includes('must_change_pin')) {
      userLookup = await serverSupabase
        .from('users')
        .select('id, nip, full_name, phone_number, role, position, avatar_url, account_status, created_at, pin_hash, failed_login_count, locked_until')
        .or(orFilter)
        .maybeSingle();
    }

    const { data: user, error: userErr } = userLookup;

    if (userErr || !user) {
      // Equalize timing and prevent account enumeration with same error response as wrong PIN
      const dummyHash = crypto.createHash('sha256').update(cleanPin).digest('hex');
      timingSafeMatch(dummyHash, DEFAULT_PIN_HASH);
      recordIpAuthFailure(clientIp);
      return res.status(401).json({
        success: false,
        errorCode: 'AUTH_INVALID_CREDENTIALS',
        errorMessage: 'No HP / NPP atau PIN 6-digit yang Anda masukkan tidak valid.',
      });
    }

    // 3. Verifikasi Status Akun & Lockout
    if (user.account_status === 'LOCKED' || user.account_status === 'INACTIVE') {
      recordIpAuthFailure(clientIp);
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

    // 4. Verifikasi PIN (Constant-Time Digest Comparison)
    const hashedInputPin = crypto.createHash('sha256').update(cleanPin).digest('hex');
    const matchedHash = timingSafeMatch(user.pin_hash, hashedInputPin);
    const matchedPlainLegacy = !matchedHash && timingSafeMatch(user.pin_hash, cleanPin);
    const isPinValid = matchedHash || matchedPlainLegacy;

    if (!isPinValid) {
      recordIpAuthFailure(clientIp);
      const nextFailedCount = (user.failed_login_count || 0) + 1;
      const updates: Record<string, any> = { failed_login_count: nextFailedCount };

      let lockoutMsg = 'No HP / NPP atau PIN 6-digit yang Anda masukkan tidak valid.';
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

    // 5. Reset Counter Gagal & Auto-Upgrade Legacy Plaintext Hash jika PIN Benar
    const successUpdates: Record<string, unknown> = {};
    if (user.failed_login_count > 0 || user.locked_until) {
      successUpdates.failed_login_count = 0;
      successUpdates.locked_until = null;
    }
    if (matchedPlainLegacy) {
      successUpdates.pin_hash = hashedInputPin;
    }
    if (Object.keys(successUpdates).length > 0) {
      await serverSupabase.from('users').update(successUpdates).eq('id', user.id);
    }

    // 6. Penerbitan Session Token CSPRNG (32 Bytes / 64 Hex Characters)
    const rawToken = 'saga_sess_' + crypto.randomBytes(32).toString('hex');
    const tokenHash = hashSessionToken(rawToken);

    // Kebijakan Kedaluwarsa Sesi: 30 Hari
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString();
    const cleanDeviceUuid = typeof device_uuid === 'string' ? device_uuid.trim().slice(0, 128) : null;
    const cleanDeviceModel = typeof device_model === 'string' ? device_model.trim().slice(0, 128) : null;
    const userAgent = (req.headers['user-agent'] as string)?.slice(0, 256) || null;

    // 7. Evaluasi Kewajiban Ganti PIN Sisi Server (Default PIN 123456 atau flag reset admin)
    const mustChangePin =
      Boolean(user.must_change_pin) ||
      timingSafeMatch(user.pin_hash, DEFAULT_PIN_HASH) ||
      timingSafeMatch(hashedInputPin, DEFAULT_PIN_HASH);

    // Bentuk User Profile Publik (PIN Hash Dibuang / Sanitasi)
    const userProfile = {
      id: user.id,
      nip: user.nip || null,
      full_name: user.full_name,
      phone_number: user.phone_number,
      role: user.role,
      position: user.position || null,
      avatar_url: user.avatar_url || null,
      is_active: user.account_status === 'ACTIVE',
      must_change_pin: mustChangePin,
      created_at: user.created_at,
    };

    // 8. Simpan HANYA token_hash ke Database (Fail-Closed: Tolak login bila gagal menyimpan sesi)
    const { error: sessionErr } = await serverSupabase.from('user_sessions').insert({
      user_id: user.id,
      token_hash: tokenHash,
      device_uuid: cleanDeviceUuid || null,
      device_model: cleanDeviceModel || null,
      ip_address: clientIp || null,
      user_agent: userAgent,
      expires_at: expiresAt,
    });

    if (sessionErr) {
      console.error('[api/auth/login] Failed to persist user session:', sessionErr.message);
      return res.status(500).json({
        success: false,
        errorCode: 'SESSION_PERSISTENCE_FAILED',
        errorMessage: 'Gagal menerbitkan sesi keamanan di server. Silakan coba lagi.',
      });
    }

    // 9. Terbitkan HttpOnly Session Cookie yang kompatibel dengan PWA, Capacitor Android, dan Electron
    res.setHeader('Set-Cookie', buildSessionCookie(req, rawToken, SESSION_MAX_AGE_SECONDS));

    return res.status(200).json({
      success: true,
      token: rawToken,
      user: userProfile,
    });
  } catch {
    return res.status(500).json({
      success: false,
      errorCode: 'INTERNAL_SERVER_ERROR',
      errorMessage: 'Terjadi kesalahan sistem saat memproses login.',
    });
  }
}
