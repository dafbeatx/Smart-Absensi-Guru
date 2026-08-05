/**
 * SMART ABSENSI GURU - CENTRALIZED LOGGER UTILITY
 * Handles structured logging with automatic sensitive data masking (PIN, password, tokens).
 */

const SENSITIVE_KEYS = [
  'pin',
  'password',
  'token',
  'refresh_token',
  'refreshtoken',
  'authorization',
  'auth_token',
  'secret',
  'private_key',
  'credentials',
  'pin_hash',
  'hashedpin',
];

/**
 * Recursively masks sensitive fields in objects or primitives
 */
export function sanitizeMeta(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;

  if (typeof obj === 'string') {
    // Mask potential token strings or sensitive Bearer tokens
    if (obj.toLowerCase().includes('bearer ') || obj.startsWith('SB_JWT_')) {
      return '[REDACTED_TOKEN]';
    }
    return obj;
  }

  if (typeof obj === 'number' || typeof obj === 'boolean') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeMeta);
  }

  if (typeof obj === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((sensitive) => lowerKey.includes(sensitive))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeMeta(value);
      }
    }
    return sanitized;
  }

  return String(obj);
}

class AppLogger {
  private isDev: boolean;

  constructor() {
    this.isDev = typeof import.meta !== 'undefined' && import.meta.env ? Boolean(import.meta.env.DEV) : false;
  }

  public debug(context: string, message: string, meta?: unknown): void {
    if (!this.isDev) return;
    const cleanMeta = meta !== undefined ? sanitizeMeta(meta) : '';
    console.debug(`[DEBUG][${context}] ${message}`, cleanMeta);
  }

  public info(context: string, message: string, meta?: unknown): void {
    if (!this.isDev) return;
    const cleanMeta = meta !== undefined ? sanitizeMeta(meta) : '';
    console.info(`[INFO][${context}] ${message}`, cleanMeta);
  }

  public warn(context: string, message: string, meta?: unknown): void {
    const cleanMeta = meta !== undefined ? sanitizeMeta(meta) : '';
    console.warn(`[WARN][${context}] ${message}`, cleanMeta);
  }

  public error(context: string, message: string, errorOrMeta?: unknown): void {
    const cleanMeta = errorOrMeta !== undefined ? sanitizeMeta(errorOrMeta) : '';
    console.error(`[ERROR][${context}] ${message}`, cleanMeta);
  }
}

export const logger = new AppLogger();
