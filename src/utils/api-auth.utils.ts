// src/utils/api-auth.utils.ts
// Shared client-side authentication headers builder for serverless API requests
// across Web PWA, Capacitor Android, and Electron containers.

import { useAuthStore } from '../store/useAuthStore';

const ALLOWED_SESSION_TOKEN_PREFIXES = ['saga_sess_', 'saga_tok_'] as const;

export function isServerVerifiableToken(token: unknown): token is string {
  if (typeof token !== 'string') return false;
  const trimmed = token.trim();
  return ALLOWED_SESSION_TOKEN_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

/**
 * Resolves a real server-verifiable session token (`saga_sess_` or `saga_tok_`)
 * from explicit args, Zustand store, or local storage.
 * Never fabricates or forwards legacy insecure tokens (`mock_token`, `SB_JWT_`, `usr_`).
 */
export function resolveClientAuthToken(explicitToken?: string): string | null {
  const candidates: Array<unknown> = [
    explicitToken,
    useAuthStore.getState().token,
  ];

  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const persisted = JSON.parse(localStorage.getItem('smart_absensi_auth_storage') || '{}');
      candidates.push(persisted?.state?.token);
    } catch {
      // Ignore storage parse error
    }
    try {
      candidates.push(localStorage.getItem('saga_auth_token'));
    } catch {
      // Ignore storage access error
    }
  }

  for (const candidate of candidates) {
    if (isServerVerifiableToken(candidate)) {
      return candidate.trim();
    }
  }

  return null;
}

export function detectClientPlatformHeader(): 'electron' | 'capacitor' | 'web' {
  if (typeof window === 'undefined') return 'web';
  const protocol = window.location?.protocol || '';
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent || '' : '';

  if (protocol === 'file:' || /electron/i.test(ua)) {
    return 'electron';
  }
  if (protocol === 'capacitor:' || protocol === 'ionic:' || Boolean((window as any)?.Capacitor?.isNativePlatform?.())) {
    return 'capacitor';
  }
  return 'web';
}

export function buildAuthenticatedFetchOptions(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  body?: unknown,
  explicitToken?: string
): RequestInit {
  const token = resolveClientAuthToken(explicitToken);
  const headers: Record<string, string> = {
    'X-SAGA-Platform': detectClientPlatformHeader(),
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
    headers['X-Session-Token'] = token;
  }

  const options: RequestInit = {
    method,
    credentials: 'include',
    headers,
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  return options;
}
