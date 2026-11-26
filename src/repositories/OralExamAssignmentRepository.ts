/**
 * SMART ABSENSI GURU — ORAL EXAM ASSIGNMENTS REPOSITORY
 * Menyimpan dan menyinkronkan penugasan penguji, ruangan, kelas, mata uji, dan daftar siswa
 * yang ditetapkan Admin (Supabase Cloud + LocalStorage fallback) untuk langsung dipakai Guru.
 */

import type { UserProfile } from '../types/database.types';
import type { OralExamAssignment } from '../types/oral-exam.types';
import { getDefaultOralExamAssignments } from '../data/oral-exam-groups';
import { AdministrationRepository } from './AdministrationRepository';
import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger.utils';

export const ORAL_EXAM_ASSIGNMENTS_KEY_PREFIX = 'smart_absensi_oral_exam_assignments';
export const ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT = 'smart_absensi_oral_exam_assignments_changed';

const memoryAssignStore = new Map<string, string>();

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // fallback
  }
  return memoryAssignStore.get(key) || null;
};

const safeSetStorage = (key: string, value: string): void => {
  memoryAssignStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {
    // fallback
  }
};

export class OralExamAssignmentRepository {
  /**
   * Memuat daftar penugasan penguji ujian lisan (Cloud -> LocalStorage -> Default 12 Kelompok Resmi).
   */
  public static async getAssignments(academicYear?: string): Promise<OralExamAssignment[]> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();
    const cleanYear = targetYear.replace(/[^\w]/g, '_');
    const storageKey = `${ORAL_EXAM_ASSIGNMENTS_KEY_PREFIX}_${cleanYear}`;

    try {
      const provider = ProviderFactory.getProvider();
      if (provider.getOralExamAssignments) {
        const remote = await provider.getOralExamAssignments(targetYear);
        if (Array.isArray(remote)) {
          safeSetStorage(storageKey, JSON.stringify(remote));
          return remote;
        }
      }
    } catch (err) {
      logger.warn('OralExamAssignmentRepository', 'Cloud fetch failed, using local cache:', err);
    }

    try {
      const raw = safeGetStorage(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (err) {
      logger.error('OralExamAssignmentRepository', 'Failed to parse local oral exam assignments:', err);
    }

    return getDefaultOralExamAssignments(targetYear);
  }

  /**
   * Menyimpan perubahan pengaturan penguji & penempatan siswa (Admin Only).
   */
  public static async saveAssignments(
    assignments: OralExamAssignment[],
    academicYear?: string,
    token?: string
  ): Promise<boolean> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();
    const cleanYear = targetYear.replace(/[^\w]/g, '_');
    const storageKey = `${ORAL_EXAM_ASSIGNMENTS_KEY_PREFIX}_${cleanYear}`;
    const prevRaw = safeGetStorage(storageKey);

    const normalizedPayload = assignments.map((a) => ({
      ...a,
      academicYear: targetYear,
      updatedAt: new Date().toISOString(),
    }));

    safeSetStorage(storageKey, JSON.stringify(normalizedPayload));

    try {
      const provider = ProviderFactory.getProvider();
      if (provider.saveOralExamAssignments) {
        const ok = await provider.saveOralExamAssignments(normalizedPayload, targetYear, token);
        if (!ok) {
          if (prevRaw !== null) safeSetStorage(storageKey, prevRaw);
          return false;
        }
      }
    } catch (err) {
      logger.warn('OralExamAssignmentRepository', 'Failed to save assignments to provider:', err);
      if (prevRaw !== null) safeSetStorage(storageKey, prevRaw);
      return false;
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT, { detail: normalizedPayload })
      );
    }

    return true;
  }

  /**
   * Mengembalikan penempatan ke 12 kelompok penguji resmi sekolah.
   */
  public static async resetToOfficialDefaults(
    academicYear?: string,
    token?: string,
    staffList?: UserProfile[]
  ): Promise<OralExamAssignment[]> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();
    const defaults = getDefaultOralExamAssignments(targetYear, staffList);
    await this.saveAssignments(defaults, targetYear, token);
    return defaults;
  }

  /**
   * Mengambil daftar guru & staf aktif langsung dari Data Manajemen Guru & Staf
   * (Provider cloud/mock + fallback cermin lokal `smart_absensi_teachers`), terurut alfabetis.
   */
  public static async getStaffDirectory(token?: string): Promise<UserProfile[]> {
    let rawUsers: UserProfile[] = [];
    try {
      const provider = ProviderFactory.getProvider();
      if (provider && typeof provider.getAllUsers === 'function') {
        const fetched = await provider.getAllUsers(token || '');
        if (Array.isArray(fetched) && fetched.length > 0) {
          rawUsers = fetched;
        }
      }
    } catch (err) {
      logger.warn('OralExamAssignmentRepository', 'Gagal mengambil daftar Manajemen Guru & Staf dari provider:', err);
    }

    if (rawUsers.length === 0) {
      try {
        const cachedRaw = safeGetStorage('smart_absensi_teachers');
        if (cachedRaw) {
          const parsed = JSON.parse(cachedRaw);
          if (Array.isArray(parsed)) {
            rawUsers = parsed;
          }
        }
      } catch {
        // ignore storage parse failure
      }
    }

    const deduped = new Map<string, UserProfile>();
    for (const u of rawUsers) {
      if (!u || !u.id || u.is_active === false) continue;
      if (!u.full_name || !u.full_name.trim()) continue;
      if (!deduped.has(u.id)) {
        deduped.set(u.id, u);
      }
    }

    return Array.from(deduped.values()).sort((a, b) =>
      a.full_name.localeCompare(b.full_name, 'id', { sensitivity: 'base' })
    );
  }
}
