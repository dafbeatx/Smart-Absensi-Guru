/**
 * SMART ABSENSI GURU — ORAL EXAM ASSIGNMENTS REPOSITORY
 * Menyimpan dan menyinkronkan penugasan penguji, ruangan, kelas, mata uji, dan daftar siswa
 * langsung ke Supabase Cloud melalui ProviderFactory (zero localStorage agar tidak pernah hilang).
 */

import type { UserProfile } from '../types/database.types';
import type { OralExamAssignment } from '../types/oral-exam.types';
import { getDefaultOralExamAssignments } from '../data/oral-exam-groups';
import { AdministrationRepository } from './AdministrationRepository';
import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger.utils';

export const ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT = 'smart_absensi_oral_exam_assignments_changed';

export class OralExamAssignmentRepository {
  /**
   * Memuat daftar penugasan penguji ujian lisan langsung dari Provider (Supabase Cloud / MockProvider).
   * Jika belum pernah diatur Admin di database, mengembalikan 12 kelompok resmi bawaan.
   */
  public static async getAssignments(academicYear?: string, token?: string): Promise<OralExamAssignment[]> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();

    try {
      const provider = ProviderFactory.getProvider();
      if (provider.getOralExamAssignments) {
        const remote = await provider.getOralExamAssignments(targetYear, token);
        if (Array.isArray(remote)) {
          return remote;
        }
      }
    } catch (err) {
      logger.warn('OralExamAssignmentRepository', 'Gagal memuat penugasan penguji dari Supabase:', err);
    }

    return getDefaultOralExamAssignments(targetYear);
  }

  /**
   * Menyimpan perubahan pengaturan penguji & penempatan siswa langsung ke Supabase Cloud (Admin Only).
   */
  public static async saveAssignments(
    assignments: OralExamAssignment[],
    academicYear?: string,
    token?: string
  ): Promise<boolean> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();

    const normalizedPayload = assignments.map((a) => ({
      ...a,
      academicYear: targetYear,
      updatedAt: new Date().toISOString(),
    }));

    try {
      const provider = ProviderFactory.getProvider();
      if (!provider.saveOralExamAssignments) {
        return false;
      }
      const ok = await provider.saveOralExamAssignments(normalizedPayload, targetYear, token);
      if (!ok) {
        return false;
      }
    } catch (err) {
      logger.warn('OralExamAssignmentRepository', 'Gagal menyimpan penugasan penguji ke Supabase:', err);
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
   * Mengembalikan penempatan ke 12 kelompok penguji resmi sekolah dan menyimpannya ke Supabase.
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
   * Mengambil daftar guru & staf aktif langsung dari Data Manajemen Guru & Staf Supabase
   * via ProviderFactory, terurut alfabetis (zero localStorage).
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
      logger.warn('OralExamAssignmentRepository', 'Gagal mengambil daftar Manajemen Guru & Staf dari Supabase:', err);
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
