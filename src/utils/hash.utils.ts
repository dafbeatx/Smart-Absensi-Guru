/**
 * Centralized PIN SHA-256 Hashing Helper.
 * Computes a standard 64-character lowercase hex string SHA-256 hash.
 */
export async function hashPin(pin: string): Promise<string> {
  const str = String(pin || '').trim();

  // 1. Modern Web Crypto API (Browser / Node 18+)
  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // 2. Node.js / Server-side / Test runner environment fallback
  const isNode = typeof process !== 'undefined' && process.versions && !!process.versions.node;
  if (isNode) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const req = (globalThis as any).require;
      const nodeCrypto = typeof req === 'function' ? req('crypto') : null;
      if (nodeCrypto && typeof nodeCrypto.createHash === 'function') {
        return nodeCrypto.createHash('sha256').update(str).digest('hex');
      }
    } catch {
      // Fall through to strict error
    }
  }

  // 3. Insecure / obsolete browser environment without crypto.subtle
  throw new Error(
    'Penambatan PIN gagal: Browser Anda tidak mendukung Web Crypto API (crypto.subtle). Harap gunakan browser modern dengan koneksi HTTPS.'
  );
}
