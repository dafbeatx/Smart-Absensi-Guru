/**
 * Smart Absensi Guru - Class Code Normalization Utility
 * Normalizes various class name formats into a canonical code.
 *
 * Examples:
 * - "Kelas VIII-A" -> "8A"
 * - "VIII-A"       -> "8A"
 * - "Kelas 8A"     -> "8A"
 * - "8A"           -> "8A"
 * - "kelas vii - b"-> "7B"
 * - "Kelas IX.A"   -> "9A"
 */

const ROMAN_NUMERAL_MAP: Record<string, string> = {
  XII: '12',
  XI: '11',
  X: '10',
  IX: '9',
  VIII: '8',
  VII: '7',
  VI: '6',
  V: '5',
  IV: '4',
  III: '3',
  II: '2',
  I: '1',
};

/**
 * Normalizes any class string into a canonical class code.
 * e.g. "Kelas VIII-A" -> "8A", "8 - B" -> "8B", "SMA" -> "SMA"
 */
export function normalizeClassCode(input?: string | null): string {
  if (!input || typeof input !== 'string') return '';

  let str = input.trim();
  if (!str) return '';

  // 1. Remove "Kelas" / "KELAS" prefix
  str = str.replace(/^(?:kelas|kls)[\s.:_-]*/i, '');

  // 2. Identify and replace Roman numerals at the beginning of the grade
  // Order matters: check XII before XI before X, VIII before VII, etc.
  for (const [roman, arabic] of Object.entries(ROMAN_NUMERAL_MAP)) {
    const regex = new RegExp(`^${roman}(?=[\\s\\-_.]*([A-Za-z0-9]|$))`, 'i');
    if (regex.test(str)) {
      str = str.replace(regex, arabic);
      break;
    }
  }

  // 3. Remove punctuation, hyphens, spaces, underscores, dots
  str = str.replace(/[\s\-_.]+/g, '');

  return str.toUpperCase();
}

/**
 * Compares two class strings canonically.
 */
export function areClassCodesEqual(a?: string | null, b?: string | null): boolean {
  const normA = normalizeClassCode(a);
  const normB = normalizeClassCode(b);
  return normA.length > 0 && normA === normB;
}

/**
 * Formats a canonical class code into user-friendly display format.
 * e.g. "8A" -> "Kelas 8A", "SMA" -> "SMA"
 */
export function formatClassDisplay(classInput?: string | null): string {
  const canonical = normalizeClassCode(classInput);
  if (!canonical) return classInput || '-';
  if (/^\d+[A-Z0-9]+$/i.test(canonical)) {
    return `Kelas ${canonical}`;
  }
  return canonical;
}

/**
 * Resolves whether a class belongs to SMP or SMA deterministically.
 * Guarantees that SMP classes (7, 8, 9, VII, VIII, IX) never get desynchronized as SMA.
 */
export function resolveSchoolLevel(className?: string | null, fallbackLevel?: string | null): 'SMP' | 'SMA' {
  const raw = (className || '').trim();
  const norm = normalizeClassCode(raw);

  // 1. Definite SMP patterns: 7, 8, 9, VII, VIII, IX, or explicit SMP keyword
  if (
    /^[789]/.test(norm) ||
    /^(?:kelas\s*)?(?:VII|VIII|IX)(?:\b|[^A-Z0-9]|$)/i.test(raw) ||
    /\bSMP\b/i.test(raw)
  ) {
    return 'SMP';
  }

  // 2. Definite SMA/SMK patterns: 10, 11, 12, X, XI, XII, MIPA, IPS, SMK, or explicit SMA
  if (
    /^(?:10|11|12)/.test(norm) ||
    /^(?:kelas\s*)?(?:X|XI|XII)(?:\b|[^A-Z0-9]|$)/i.test(raw) ||
    /\b(?:SMA|SMK|MIPA|IPS|RPL|TKJ)\b/i.test(raw) ||
    norm === 'SMA'
  ) {
    return 'SMA';
  }

  // 3. Fallback level if valid
  const upperFallback = (fallbackLevel || '').trim().toUpperCase();
  if (upperFallback === 'SMA') return 'SMA';
  if (upperFallback === 'SMP') return 'SMP';

  return 'SMP';
}
