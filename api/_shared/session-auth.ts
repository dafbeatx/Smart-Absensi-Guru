// api/_shared/session-auth.ts
// Shared Serverless Session Authentication Middleware for Smart Absensi Guru (SAGA)
// Implements server-verifiable, stateful session security with SHA-256 token hashing

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const safeEnv: Record<string, string | undefined> =
  typeof process !== 'undefined' && process?.env
    ? process.env
    : (typeof window !== 'undefined' && (window as any)?.__ENV) || {};

const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucHBmbWpzYnF4YnRpb3lwbmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzcyNDksImV4cCI6MjEwNDk1MzI0OX0.ewXX-KW3SMEF-KtOZ5P1MY5IpZSJQImDt5g9maTOWfE';

const SUPABASE_SERVICE_ROLE_KEY =
  safeEnv.SUPABASE_SERVICE_ROLE_KEY_TOREN2 ||
  safeEnv.SUPABASE_SERVICE_ROLE_KEY ||
  safeEnv.VITE_SUPABASE_ANON_KEY_TOREN2 ||
  safeEnv.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const SUPABASE_URL =
  safeEnv.VITE_SUPABASE_URL_TOREN2 ||
  safeEnv.VITE_SUPABASE_URL ||
  'https://fnppfmjsbqxbtioypnap.supabase.co';

export const SESSION_COOKIE_NAME = 'saga_session';
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

let activeClient: any = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

export const serverSupabase: any = new Proxy({} as any, {
  get(_target, prop) {
    return activeClient[prop];
  },
});

export function setServerSupabaseClient(client: any) {
  activeClient = client;
}

export function resetServerSupabaseClient() {
  activeClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export interface AuthenticatedUser {
  id: string;
  nip: string | null;
  full_name: string;
  role: string;
  position: string | null;
  avatar_url: string | null;
  phone_number: string | null;
  must_change_pin?: boolean;
}

export interface AuthSuccessContext {
  ok: true;
  userId: string;
  user: AuthenticatedUser;
  role: string;
  sessionId: string;
}

export interface AuthErrorContext {
  ok: false;
  status: number;
  errorCode: 'AUTH_SESSION_MISSING' | 'AUTH_SESSION_INVALID' | 'AUTH_SESSION_REVOKED' | 'AUTH_SESSION_EXPIRED' | 'AUTH_USER_INACTIVE';
  errorMessage: string;
}

export type AuthContext = AuthSuccessContext | AuthErrorContext;

/**
 * Checks whether an HTTP request origin is authorized for credentialed CORS
 */
export function isAllowedAuthOrigin(origin: string | undefined): boolean {
  if (!origin) return false;
  const exactAllowed = new Set([
    'https://smart-absensi-guru-eight.vercel.app',
    'https://localhost',
    'http://localhost',
    'capacitor://localhost',
    'ionic://localhost',
  ]);
  if (exactAllowed.has(origin)) return true;
  if (/^https:\/\/smart-absensi-guru[a-z0-9-]*\.vercel\.app$/i.test(origin)) return true;
  if (/^https?:\/\/(localhost|127\.0\.0\.1|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)(:\d+)?$/i.test(origin)) return true;
  return false;
}

/**
 * Applies multi-platform CORS (Web PWA, Capacitor Android, Electron) and strict anti-cache headers
 */
export function applyAuthCorsHeaders(req: any, res: any, allowedMethods = 'POST, OPTIONS') {
  const origin = typeof req?.headers?.origin === 'string' ? req.headers.origin.trim() : '';

  if (origin && isAllowedAuthOrigin(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Vary', 'Origin');
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // Reject browser credentialed cross-origin calls from unknown domains cleanly
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', allowedMethods);
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Session-Token, X-SAGA-Platform'
  );
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Content-Type-Options', 'nosniff');
}

/**
 * Parses Cookie header string into key-value pairs safely
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};
  if (!cookieHeader || typeof cookieHeader !== 'string') return cookies;
  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const idx = pair.indexOf('=');
    if (idx <= 0) continue;
    const key = pair.slice(0, idx).trim();
    const rawVal = pair.slice(idx + 1).trim();
    try {
      cookies[key] = decodeURIComponent(rawVal);
    } catch {
      cookies[key] = rawVal;
    }
  }
  return cookies;
}

function resolveCookieAttributes(req: any): { isHttps: boolean; sameSite: 'None' | 'Lax' } {
  const proto = String(req?.headers?.['x-forwarded-proto'] || '').toLowerCase();
  const origin = String(req?.headers?.origin || '').toLowerCase();
  const host = String(req?.headers?.host || '').toLowerCase();

  const isHttps =
    proto.includes('https') ||
    origin.startsWith('https://') ||
    process.env.VERCEL === '1' ||
    process.env.NODE_ENV === 'production';

  // Cross-site requests (e.g. Capacitor https://localhost -> Vercel API, Electron file:// -> Vercel API)
  // require SameSite=None; Secure to allow cookie storage inside WebView/Chromium.
  const isCrossOrigin =
    Boolean(origin) &&
    (origin.startsWith('capacitor://') ||
      origin.startsWith('ionic://') ||
      origin === 'null' ||
      (Boolean(host) && !origin.endsWith(`://${host}`)));

  const sameSite: 'None' | 'Lax' = isCrossOrigin && isHttps ? 'None' : 'Lax';
  return { isHttps, sameSite };
}

/**
 * Formats an HttpOnly Set-Cookie header compatible with Web PWA, Capacitor Android, and Electron
 */
export function buildSessionCookie(req: any, rawToken: string, maxAge = SESSION_MAX_AGE_SECONDS): string {
  const { isHttps, sameSite } = resolveCookieAttributes(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(rawToken)}`,
    'Path=/',
    `Max-Age=${maxAge}`,
    'HttpOnly',
    `SameSite=${sameSite}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Formats an expiring Set-Cookie header to clear the session cookie immediately upon logout
 */
export function buildClearSessionCookie(req: any): string {
  const { isHttps, sameSite } = resolveCookieAttributes(req);
  const parts = [
    `${SESSION_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'HttpOnly',
    `SameSite=${sameSite}`,
  ];
  if (isHttps) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

/**
 * Extracts raw session token from Authorization header, X-Session-Token, or HttpOnly cookie
 */
export function extractSessionToken(req: any): string | null {
  const authHeader = req?.headers?.authorization || req?.headers?.['x-session-token'];
  if (authHeader && typeof authHeader === 'string') {
    const cleaned = authHeader.replace(/^Bearer\s+/i, '').trim();
    if (cleaned) return cleaned;
  }

  const cookies = parseCookies(req?.headers?.cookie);
  const cookieToken = cookies[SESSION_COOKIE_NAME];
  if (cookieToken && typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    return cookieToken.trim();
  }

  return null;
}

/**
 * Computes SHA-256 hex string for a given token
 */
export function hashSessionToken(rawToken: string): string {
  if (typeof crypto !== 'undefined' && crypto && typeof (crypto as any).createHash === 'function') {
    return crypto.createHash('sha256').update(rawToken).digest('hex');
  }
  return 'token_' + rawToken;
}

/**
 * Extracts and verifies the stateful session token from request headers or cookies
 */
export async function authenticateUser(req: any): Promise<AuthContext> {
  const rawToken = extractSessionToken(req);
  if (!rawToken) {
    return {
      ok: false,
      status: 401,
      errorCode: 'AUTH_SESSION_MISSING',
      errorMessage: 'Sesi login tidak ditemukan. Harap sertakan Authorization Bearer token.',
    };
  }

  // Hanya token resmi stateful (prefix saga_sess_) yang diterima oleh session middleware baru
  if (!rawToken.startsWith('saga_sess_')) {
    return {
      ok: false,
      status: 401,
      errorCode: 'AUTH_SESSION_INVALID',
      errorMessage: 'Format token tidak valid atau bukan sesi server-verifiable.',
    };
  }

  const tokenHash = hashSessionToken(rawToken);

  try {
    let { data: session, error } = await serverSupabase
      .from('user_sessions')
      .select('id, user_id, device_uuid, expires_at, revoked_at, users:user_id(id, nip, full_name, role, position, account_status, avatar_url, phone_number, must_change_pin)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !session) {
      const { data: directSess } = await serverSupabase
        .from('user_sessions')
        .select('id, user_id, device_uuid, expires_at, revoked_at')
        .eq('token_hash', tokenHash)
        .maybeSingle();
      if (directSess) {
        session = directSess;
      }
    }

    if (!session) {
      return {
        ok: false,
        status: 401,
        errorCode: 'AUTH_SESSION_INVALID',
        errorMessage: 'Sesi tidak sah atau tidak ditemukan di database.',
      };
    }

    if (session.revoked_at) {
      return {
        ok: false,
        status: 401,
        errorCode: 'AUTH_SESSION_REVOKED',
        errorMessage: 'Sesi telah diakhiri (logout) dan tidak dapat digunakan kembali.',
      };
    }

    const now = new Date();
    if (new Date(session.expires_at) <= now) {
      return {
        ok: false,
        status: 401,
        errorCode: 'AUTH_SESSION_EXPIRED',
        errorMessage: 'Masa berlaku sesi telah habis. Silakan login kembali.',
      };
    }

    let user = Array.isArray(session.users) ? session.users[0] : session.users;
    if (!user && session.user_id) {
      let userQuery = await serverSupabase
        .from('users')
        .select('id, nip, full_name, role, position, account_status, avatar_url, phone_number, must_change_pin')
        .eq('id', session.user_id)
        .maybeSingle();

      // Schema resilience if must_change_pin column not yet migrated
      if (userQuery.error && String(userQuery.error.message || '').includes('must_change_pin')) {
        userQuery = await serverSupabase
          .from('users')
          .select('id, nip, full_name, role, position, account_status, avatar_url, phone_number')
          .eq('id', session.user_id)
          .maybeSingle();
      }
      if (userQuery.data) {
        user = userQuery.data;
      }
    }

    if (!user) {
      return {
        ok: false,
        status: 401,
        errorCode: 'AUTH_USER_INACTIVE',
        errorMessage: 'Data pengguna terkait sesi ini tidak ditemukan.',
      };
    }

    if (user.account_status !== 'ACTIVE') {
      return {
        ok: false,
        status: 401,
        errorCode: 'AUTH_USER_INACTIVE',
        errorMessage: 'Akun Anda sedang terblokir atau tidak aktif. Hubungi Admin Sekolah.',
      };
    }

    // Perbarui last_seen_at secara asynchronous (fire-and-forget)
    try {
      Promise.resolve(
        serverSupabase
          .from('user_sessions')
          .update({ last_seen_at: now.toISOString() })
          .eq('id', session.id)
      ).catch(() => {});
    } catch {
      // ignore background update error
    }

    return {
      ok: true,
      userId: user.id,
      user: {
        id: user.id,
        nip: user.nip ?? null,
        full_name: user.full_name,
        role: user.role,
        position: user.position ?? null,
        avatar_url: user.avatar_url ?? null,
        phone_number: user.phone_number ?? null,
        must_change_pin: Boolean(user.must_change_pin),
      },
      role: user.role,
      sessionId: session.id,
    };
  } catch {
    return {
      ok: false,
      status: 500,
      errorCode: 'AUTH_SESSION_INVALID',
      errorMessage: 'Terjadi kendala saat memvalidasi sesi pengguna.',
    };
  }
}
