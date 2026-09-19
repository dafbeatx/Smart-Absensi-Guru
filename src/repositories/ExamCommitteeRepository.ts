import type { ExamCommitteeMember } from '../types/exam-schedule.types';
import type { UserProfile } from '../types/database.types';
import { AdministrationRepository } from './AdministrationRepository';
import { logger } from '../utils/logger.utils';

export const EXAM_COMMITTEE_STORAGE_KEY = 'smart_absensi_exam_committee';
export const EXAM_COMMITTEE_CHANGED_EVENT = 'smart_absensi_exam_committee_changed';

const memoryCommitteeStore = new Map<string, string>();

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {}
  return memoryCommitteeStore.get(key) || null;
};

const safeSetStorage = (key: string, value: string): void => {
  memoryCommitteeStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {}
};

export class ExamCommitteeRepository {
  /**
   * Retrieves all committee members, optionally filtered by academic year.
   */
  public static async getCommitteeMembers(academicYear?: string): Promise<ExamCommitteeMember[]> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();
    try {
      const raw = safeGetStorage(EXAM_COMMITTEE_STORAGE_KEY);
      if (raw) {
        const parsed: ExamCommitteeMember[] = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.filter((m) => !targetYear || m.academicYear === targetYear);
        }
      }
    } catch (err) {
      logger.error('ExamCommitteeRepository', 'Failed to parse committee members:', err);
    }
    return [];
  }

  /**
   * Saves or updates the complete committee list for a specific academic year.
   */
  public static async saveCommitteeMembers(
    membersForYear: ExamCommitteeMember[],
    academicYear?: string
  ): Promise<boolean> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();
    try {
      const raw = safeGetStorage(EXAM_COMMITTEE_STORAGE_KEY);
      let allMembers: ExamCommitteeMember[] = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(allMembers)) allMembers = [];

      // Remove current year members and append new ones
      allMembers = allMembers.filter((m) => m.academicYear !== targetYear);
      allMembers.push(...membersForYear);

      safeSetStorage(EXAM_COMMITTEE_STORAGE_KEY, JSON.stringify(allMembers));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(EXAM_COMMITTEE_CHANGED_EVENT, { detail: { academicYear: targetYear, members: membersForYear } })
        );
      }

      return true;
    } catch (err) {
      logger.error('ExamCommitteeRepository', 'Failed to save committee members:', err);
      return false;
    }
  }

  /**
   * Checks whether a specific user is an authorized committee member.
   */
  public static async isUserCommittee(userId?: string, academicYear?: string): Promise<boolean> {
    if (!userId) return false;
    const members = await this.getCommitteeMembers(academicYear);
    return members.some((m) => m.userId === userId && m.isActive);
  }

  /**
   * Determines full access rights for a user (Admin, Operator, Committee, or Teacher).
   */
  public static async checkCommitteeAccess(
    user?: UserProfile,
    academicYear?: string
  ): Promise<{
    canManage: boolean;
    isCommittee: boolean;
    isAdmin: boolean;
    roleLabel: string;
  }> {
    if (!user) {
      return { canManage: false, isCommittee: false, isAdmin: false, roleLabel: 'Tamu' };
    }

    const userRole = (user.role || '').toUpperCase();
    const isAdmin = ['ADMIN', 'OPERATOR'].includes(userRole);

    if (isAdmin) {
      return {
        canManage: true,
        isCommittee: true,
        isAdmin: true,
        roleLabel: userRole === 'ADMIN' ? 'Administrator' : 'Operator Sekolah',
      };
    }

    const isCommittee = await this.isUserCommittee(user.id, academicYear);

    if (isCommittee) {
      const members = await this.getCommitteeMembers(academicYear);
      const member = members.find((m) => m.userId === user.id);
      const roleName = member?.role === 'KETUA' ? 'Ketua Panitia Ujian'
        : member?.role === 'SEKRETARIS' ? 'Sekretaris Panitia Ujian'
        : member?.role === 'BENDAHARA' ? 'Bendahara Panitia Ujian'
        : 'Panitia Ujian';

      return {
        canManage: true,
        isCommittee: true,
        isAdmin: false,
        roleLabel: roleName,
      };
    }

    return {
      canManage: false,
      isCommittee: false,
      isAdmin: false,
      roleLabel: userRole === 'KEPSEK' ? 'Kepala Sekolah (Peninjau)' : 'Guru Pengajar',
    };
  }
}
