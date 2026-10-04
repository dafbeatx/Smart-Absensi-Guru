/**
 * SMART ABSENSI GURU — ACADEMIC YEAR INTELLIGENCE & NORMALIZATION UTILITIES
 * Memberikan deteksi cerdas tahun ajaran, normalisasi format variatif,
 * inferensi tanggal & judul ujian, serta penyaringan multi-kriteria tanpa kehilangan data.
 */

import { AdministrationRepository } from '../repositories/AdministrationRepository';
import { normalizeClassCode, areClassCodesEqual } from './class.utils';
import { normalizeSubjectName } from '../config/school-subjects.config';
import type { ExamSessionRecord } from '../types/database.types';

/**
 * Normalizes any academic year string into the canonical format 'YYYY/YYYY'.
 * Handles:
 * - "2026/2027", "2026-2027", "2026 - 2027", "2026 / 2027"
 * - "2026", "26/27", "26-27", "TA 2026/2027", "T.A. 2026/2027", "TP 2026/2027"
 * - Same for 2025/2026, 2024/2025, 2027/2028, etc.
 */
export function normalizeAcademicYearString(raw?: string | null): string {
  if (!raw || typeof raw !== 'string') return '';
  const clean = raw.trim();
  if (!clean) return '';

  // 1. Direct standard pattern "YYYY/YYYY" or "YYYY-YYYY" or "YYYY - YYYY"
  const fullMatch = clean.match(/\b(20\d\d)[\s\/\-_]+(20\d\d)\b/);
  if (fullMatch) {
    const startYear = parseInt(fullMatch[1], 10);
    const endYear = parseInt(fullMatch[2], 10);
    if (endYear === startYear + 1) {
      return `${startYear}/${endYear}`;
    }
    return `${startYear}/${endYear}`;
  }

  // 2. Short 2-digit format "26/27", "25/26", "24/25", "27/28"
  const shortMatch = clean.match(/\b(\d{2})[\s\/\-_]+(\d{2})\b/);
  if (shortMatch) {
    const s = parseInt(shortMatch[1], 10);
    const e = parseInt(shortMatch[2], 10);
    if (e === s + 1 && s >= 20 && s <= 40) {
      return `20${s}/20${e}`;
    }
  }

  // 3. Single 4-digit year e.g. "2026" -> in Indonesian academic system, "2026" starts "2026/2027"
  const singleMatch = clean.match(/\b(20\d\d)\b/);
  if (singleMatch) {
    const y = parseInt(singleMatch[1], 10);
    return `${y}/${y + 1}`;
  }

  return clean;
}

/**
 * Extracts academic year clue from title/notes/context string.
 * e.g. "ASTS Ganjil 2026/2027" -> "2026/2027"
 *      "PTS Informatika 8A 2026-2027" -> "2026/2027"
 *      "Koreksi Soal 2026" -> "2026/2027"
 *      "Simulasi Ujian 25/26" -> "2025/2026"
 */
export function detectAcademicYearFromText(text?: string | null): string | null {
  if (!text || typeof text !== 'string') return null;

  // 4-digit span e.g. 2026/2027 or 2026-2027
  const full = text.match(/\b(20\d\d)[\s\/\-_]+(20\d\d)\b/);
  if (full) {
    const s = parseInt(full[1], 10);
    const e = parseInt(full[2], 10);
    if (e === s + 1) return `${s}/${e}`;
    return `${s}/${e}`;
  }

  // Short 2-digit span e.g. 26/27
  const shortSpan = text.match(/\b(\d{2})[\s\/\-_]+(\d{2})\b/);
  if (shortSpan) {
    const s = parseInt(shortSpan[1], 10);
    const e = parseInt(shortSpan[2], 10);
    if (e === s + 1 && s >= 20 && s <= 40) {
      return `20${s}/20${e}`;
    }
  }

  // Standalone 2026 or 2025 with boundary
  const standalone = text.match(/\b(202\d)\b/);
  if (standalone) {
    const y = parseInt(standalone[1], 10);
    return `${y}/${y + 1}`;
  }

  return null;
}

/**
 * Infers Indonesian academic year from a Date or ISO timestamp string.
 * School calendar begins July 1 and ends June 30:
 * - July - December: year / (year + 1), e.g. Oct 2026 -> '2026/2027'
 * - January - June: (year - 1) / year, e.g. March 2027 -> '2026/2027'
 */
export function detectAcademicYearFromDate(dateInput?: string | Date | null): string | null {
  if (!dateInput) return null;
  try {
    const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return null;

    const year = d.getFullYear();
    const month = d.getMonth() + 1; // 1-12

    if (month >= 7) {
      return `${year}/${year + 1}`;
    } else {
      return `${year - 1}/${year}`;
    }
  } catch {
    return null;
  }
}

/**
 * Deterministically resolves the academic year of an exam session with multi-level fallback.
 * Guarantees zero data loss:
 * 1. Explicit academic_year field (normalized)
 * 2. Academic year found in session_name
 * 3. Academic year derived from created_at timestamp
 * 4. Active system academic year (default 2026/2027), NEVER hardcoded past year!
 */
export function resolveSessionAcademicYear(
  rawAcademicYear?: string | null,
  sessionName?: string | null,
  createdAt?: string | Date | null,
  customFallback?: string
): string {
  // 1. Normalized explicit academic year
  if (rawAcademicYear && typeof rawAcademicYear === 'string' && rawAcademicYear.trim()) {
    const norm = normalizeAcademicYearString(rawAcademicYear);
    if (norm) return norm;
  }

  // 2. Detection from session name
  if (sessionName) {
    const detectedFromTitle = detectAcademicYearFromText(sessionName);
    if (detectedFromTitle) return detectedFromTitle;
  }

  // 3. Detection from created_at timestamp
  if (createdAt) {
    const detectedFromDate = detectAcademicYearFromDate(createdAt);
    if (detectedFromDate) return detectedFromDate;
  }

  // 4. Fallback to active academic year or custom fallback
  if (customFallback && typeof customFallback === 'string' && customFallback.trim()) {
    return normalizeAcademicYearString(customFallback);
  }

  try {
    return AdministrationRepository.getActiveAcademicYear() || '2026/2027';
  } catch {
    return '2026/2027';
  }
}

/**
 * Checks whether an exam session matches the academic year filter with high intelligence.
 * Handles exact matches, normalized matches, and contextual keywords.
 */
export function isAcademicYearMatch(
  session: { academic_year?: string | null; session_name?: string | null; created_at?: string | null },
  filterYear: string
): boolean {
  if (!filterYear || filterYear === 'ALL') return true;

  const targetNorm = normalizeAcademicYearString(filterYear);
  const resolved = resolveSessionAcademicYear(
    session.academic_year,
    session.session_name,
    session.created_at
  );

  // Exact or normalized match
  if (resolved === targetNorm || resolved === filterYear) return true;

  // Stripped comparison e.g. "20262027" vs "20262027"
  const cleanTarget = (targetNorm || filterYear).replace(/[\s\-_/.]+/g, '');
  const cleanResolved = resolved.replace(/[\s\-_/.]+/g, '');
  if (cleanTarget && cleanResolved && cleanTarget === cleanResolved) return true;

  // Smart fuzzy detection for 2026/2027
  if (targetNorm === '2026/2027' || filterYear === '2026/2027') {
    const haystack = `${session.academic_year || ''} ${session.session_name || ''}`.toLowerCase();
    if (
      /2026[\s\/\-_]+2027|\b26[\/\-_]27\b/.test(haystack) ||
      haystack.includes('2026/2027') ||
      haystack.includes('2026-2027') ||
      haystack.includes('26/27')
    ) {
      return true;
    }
  }

  // Smart fuzzy detection for 2025/2026
  if (targetNorm === '2025/2026' || filterYear === '2025/2026') {
    const haystack = `${session.academic_year || ''} ${session.session_name || ''}`.toLowerCase();
    if (
      /2025[\s\/\-_]+2026|\b25[\/\-_]26\b/.test(haystack) ||
      haystack.includes('2025/2026') ||
      haystack.includes('2025-2026') ||
      haystack.includes('25/26')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Checks whether an exam session matches class filtering with class alias support (e.g. 7 <-> 7A/7B).
 */
export function isClassMatch(
  sessionClassIdentifier: string | null | undefined,
  filterClass: string
): boolean {
  if (!filterClass || filterClass === 'ALL') return true;
  if (!sessionClassIdentifier) return false;

  if (areClassCodesEqual(sessionClassIdentifier, filterClass)) return true;

  const normS = normalizeClassCode(sessionClassIdentifier);
  const normTarget = normalizeClassCode(filterClass);

  if (
    (normS === '7' && (normTarget === '7A' || normTarget === '7B')) ||
    (normTarget === '7' && (normS === '7A' || normS === '7B'))
  ) {
    return true;
  }

  return false;
}

/**
 * Comprehensive multi-field search matcher for exam sessions.
 * Searches across name, subject, teacher, class, academic year, semester, and exam type.
 */
export function isSessionSearchMatch(session: ExamSessionRecord, query: string): boolean {
  const q = query.toLowerCase().trim();
  if (!q) return true;

  const resolvedYear = resolveSessionAcademicYear(
    session.academic_year,
    session.session_name,
    session.created_at
  );

  const haystacks = [
    session.session_name || '',
    session.subject || '',
    normalizeSubjectName(session.subject || ''),
    session.teacher || '',
    session.class_name || '',
    session.class_code || '',
    session.academic_year || '',
    resolvedYear,
    session.semester || '',
    session.exam_type || '',
    session.school_level || '',
  ].map((str) => str.toLowerCase());

  return haystacks.some((h) => h.includes(q));
}
