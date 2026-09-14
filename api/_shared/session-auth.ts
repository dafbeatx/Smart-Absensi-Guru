// api/_shared/session-auth.ts
// Shared Serverless Session Authentication Middleware for Smart Absensi Guru (SAGA)
// Implements server-verifiable, stateful session security with SHA-256 token hashing

import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const DEFAULT_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3aGRqcXZ0anplc2JkY3FvcnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAyNDgsImV4cCI6MjA4Mjk0NjI0OH0.jgKMD9Yg0iWw3JQMeH7_HQ3ZDOmYBqZ70Y-HZEjOyuY';

const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_ANON_KEY;

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://fnppfmjsbqxbtioypnap.supabase.co';

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
 * Computes SHA-256 hex string for a given token
 */
export function hashSessionToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Extracts and verifies the stateful session token from request headers
 */
export async function authenticateUser(req: any): Promise<AuthContext> {
  const authHeader = req.headers?.authorization || req.headers?.['x-session-token'];
  if (!authHeader || typeof authHeader !== 'string') {
    return {
      ok: false,
      status: 401,
      errorCode: 'AUTH_SESSION_MISSING',
      errorMessage: 'Sesi login tidak ditemukan. Harap sertakan Authorization Bearer token.',
    };
  }

  const rawToken = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!rawToken) {
    return {
      ok: false,
      status: 401,
      errorCode: 'AUTH_SESSION_MISSING',
      errorMessage: 'Token sesi kosong.',
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
    const { data: session, error } = await serverSupabase
      .from('user_sessions')
      .select('id, user_id, device_uuid, expires_at, revoked_at, users:user_id(id, nip, full_name, role, position, account_status, avatar_url, phone_number)')
      .eq('token_hash', tokenHash)
      .maybeSingle();

    if (error || !session) {
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

    const user = Array.isArray(session.users) ? session.users[0] : session.users;
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
    serverSupabase
      .from('user_sessions')
      .update({ last_seen_at: now.toISOString() })
      .eq('id', session.id)
      .then(() => {})
      .catch(() => {});

    return {
      ok: true,
      userId: user.id,
      user: {
        id: user.id,
        nip: user.nip,
        full_name: user.full_name,
        role: user.role,
        position: user.position,
        avatar_url: user.avatar_url,
        phone_number: user.phone_number,
      },
      role: user.role,
      sessionId: session.id,
    };
  } catch (err: any) {
    return {
      ok: false,
      status: 500,
      errorCode: 'AUTH_SESSION_INVALID',
      errorMessage: 'Terjadi kendala saat memvalidasi sesi pengguna.',
    };
  }
}
