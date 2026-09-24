/**
 * Smart Absensi Guru - Student Deduplication & Tombstone Storage Utility
 * Prevents duplicate student entries during GradeMaster sync and ensures deleted students stay deleted.
 */

import type { StudentItem } from '../types/database.types';
import { normalizeClassCode } from './class.utils';

export const DELETED_STUDENTS_STORAGE_KEY = 'smart_absensi_deleted_students';

const memoryStore = new Map<string, string>();

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // ignore
  }
  return memoryStore.get(key) || null;
};

const safeSetStorage = (key: string, value: string): void => {
  memoryStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
};

/**
 * Generates a canonical natural key for a student based on normalized class code and full name.
 * e.g. "Kelas 7" & "ADIBA KHANSA AZ-ZAHRA" -> "7|||ADIBA KHANSA AZ-ZAHRA"
 */
export function getStudentNaturalKey(className?: string | null, fullName?: string | null): string {
  const normClass = normalizeClassCode(className);
  const normName = (fullName || '').trim().replace(/\s+/g, ' ').toUpperCase();
  return `${normClass}|||${normName}`;
}

/**
 * Retrieves the set of deleted student natural keys (tombstones).
 */
export function getDeletedStudentKeys(): Set<string> {
  const raw = safeGetStorage(DELETED_STUDENTS_STORAGE_KEY);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return new Set(parsed.map((k) => String(k)));
    }
  } catch {
    // ignore
  }
  return new Set();
}

/**
 * Records a deleted student key in the local tombstone set.
 */
export function recordDeletedStudentKey(className?: string | null, fullName?: string | null): void {
  const key = getStudentNaturalKey(className, fullName);
  if (!key || key.endsWith('|||')) return;
  const set = getDeletedStudentKeys();
  set.add(key);
  safeSetStorage(DELETED_STUDENTS_STORAGE_KEY, JSON.stringify(Array.from(set)));
}

/**
 * Removes a student key from the tombstone set (e.g. when admin explicitly re-adds a student).
 */
export function removeDeletedStudentKey(className?: string | null, fullName?: string | null): void {
  const key = getStudentNaturalKey(className, fullName);
  if (!key || key.endsWith('|||')) return;
  const set = getDeletedStudentKeys();
  if (set.delete(key)) {
    safeSetStorage(DELETED_STUDENTS_STORAGE_KEY, JSON.stringify(Array.from(set)));
  }
}

/**
 * Clears all deleted student tombstones (e.g. for testing or factory reset).
 */
export function clearDeletedStudentKeys(): void {
  safeSetStorage(DELETED_STUDENTS_STORAGE_KEY, JSON.stringify([]));
  memoryStore.delete(DELETED_STUDENTS_STORAGE_KEY);
}

/**
 * Deduplicates an array of students using their canonical natural key.
 * Preserves the richest student data (existing RFID, NISN, notes) and filters out any tombstones.
 */
export function deduplicateStudents(students: StudentItem[], deletedKeys?: Set<string>): StudentItem[] {
  const activeTombstones = deletedKeys || getDeletedStudentKeys();
  const map = new Map<string, StudentItem>();

  for (const s of students) {
    if (!s || !s.fullName) continue;
    const key = getStudentNaturalKey(s.className, s.fullName);
    if (activeTombstones.has(key)) continue;

    const normClass = normalizeClassCode(s.className);
    const cleanName = s.fullName.trim().replace(/\s+/g, ' ');

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        ...s,
        className: normClass || s.className,
        fullName: cleanName,
      });
    } else {
      const mergedRfid = s.rfidUid || existing.rfidUid;
      const mergedNisn = s.nisn || existing.nisn;
      const mergedNotes = s.notes || existing.notes;
      const mergedGender = existing.gender || s.gender;
      const mergedCardStatus = mergedRfid ? (s.cardStatus || existing.cardStatus || 'ACTIVE') : 'INACTIVE';

      map.set(key, {
        ...existing,
        ...s,
        id: existing.id || s.id,
        className: normClass || existing.className,
        fullName: existing.fullName || cleanName,
        rfidUid: mergedRfid || undefined,
        cardStatus: mergedCardStatus,
        nisn: mergedNisn,
        notes: mergedNotes,
        gender: mergedGender,
      });
    }
  }

  return Array.from(map.values());
}
