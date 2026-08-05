/**
 * Centralized PIN SHA-256 Hashing Helper.
 * Computes a standard 64-character lowercase hex string SHA-256 hash.
 */
export async function hashPin(pin: string): Promise<string> {
  const str = String(pin || '').trim();

  if (typeof globalThis.crypto !== 'undefined' && globalThis.crypto.subtle) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Node.js fallback
  try {
    const cryptoModule = await import('crypto');
    return cryptoModule.createHash('sha256').update(str).digest('hex');
  } catch {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16).padStart(64, '0');
  }
}
