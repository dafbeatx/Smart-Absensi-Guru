import type { ExamCommitteeMember, CommitteeRole } from '../types/exam-schedule.types';
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
  public static async isUserCommittee(userOrId?: string | UserProfile, academicYear?: string): Promise<boolean> {
    if (!userOrId) return false;
    const members = await this.getCommitteeMembers(academicYear);

    if (typeof userOrId === 'string') {
      return members.some((m) => m.userId === userOrId && m.isActive);
    }

    const u = userOrId;
    const matched = members.some((m) => {
      if (!m.isActive) return false;
      if (m.userId === u.id) return true;
      if (u.nip && m.npp && u.nip === m.npp) return true;
      if (u.npp && m.npp && u.npp === m.npp) return true;
      if (m.fullName && u.full_name && m.fullName.trim().toLowerCase() === u.full_name.trim().toLowerCase()) return true;
      return false;
    });

    if (matched) return true;

    // Fallback: check if position explicitly contains panitia
    if (u.position && u.position.toLowerCase().includes('panitia')) {
      return true;
    }

    return false;
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
      const isActualCommittee = await this.isUserCommittee(user, academicYear);
      let roleName = userRole === 'ADMIN' ? 'Administrator' : 'Operator Sekolah';

      if (isActualCommittee) {
        const members = await this.getCommitteeMembers(academicYear);
        const member = members.find(
          (m) =>
            m.isActive &&
            (m.userId === user.id ||
              (user.nip && m.npp === user.nip) ||
              (user.npp && m.npp === user.npp) ||
              (m.fullName && user.full_name && m.fullName.trim().toLowerCase() === user.full_name.trim().toLowerCase()))
        );
        if (member) {
          roleName =
            member.role === 'KETUA'
              ? 'Ketua Panitia Ujian'
              : member.role === 'SEKRETARIS'
              ? 'Sekretaris Panitia Ujian'
              : member.role === 'BENDAHARA'
              ? 'Bendahara Panitia Ujian'
              : member.role === 'ANGGOTA'
              ? 'Anggota Panitia Ujian'
              : 'Panitia Ujian';
        } else if (user.position && user.position.toLowerCase().includes('panitia')) {
          const pos = user.position.toLowerCase();
          roleName = pos.includes('ketua')
            ? 'Ketua Panitia Ujian'
            : pos.includes('sekretaris')
            ? 'Sekretaris Panitia Ujian'
            : pos.includes('bendahara')
            ? 'Bendahara Panitia Ujian'
            : pos.includes('anggota')
            ? 'Anggota Panitia Ujian'
            : user.position;
        }
      }

      return {
        canManage: true,
        isCommittee: isActualCommittee,
        isAdmin: true,
        roleLabel: roleName,
      };
    }

    const isCommittee = await this.isUserCommittee(user, academicYear);

    if (isCommittee) {
      const members = await this.getCommitteeMembers(academicYear);
      const member = members.find(
        (m) =>
          m.userId === user.id ||
          (user.nip && m.npp === user.nip) ||
          (user.npp && m.npp === user.npp) ||
          (m.fullName && user.full_name && m.fullName.trim().toLowerCase() === user.full_name.trim().toLowerCase())
      );

      let roleName = 'Panitia Ujian';
      if (member) {
        roleName =
          member.role === 'KETUA'
            ? 'Ketua Panitia Ujian'
            : member.role === 'SEKRETARIS'
            ? 'Sekretaris Panitia Ujian'
            : member.role === 'BENDAHARA'
            ? 'Bendahara Panitia Ujian'
            : member.role === 'ANGGOTA'
            ? 'Anggota Panitia Ujian'
            : 'Panitia Ujian';
      } else if (user.position && user.position.toLowerCase().includes('panitia')) {
        const pos = user.position.toLowerCase();
        roleName = pos.includes('ketua')
          ? 'Ketua Panitia Ujian'
          : pos.includes('sekretaris')
          ? 'Sekretaris Panitia Ujian'
          : pos.includes('bendahara')
          ? 'Bendahara Panitia Ujian'
          : pos.includes('anggota')
          ? 'Anggota Panitia Ujian'
          : user.position;
      }

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

  /**
   * Returns committee member details if user is in committee, or null otherwise.
   */
  public static async getTeacherCommitteeRole(
    user?: UserProfile,
    academicYear?: string
  ): Promise<{
    isCommittee: boolean;
    role: CommitteeRole | 'CUSTOM';
    roleLabel: string;
    academicYear: string;
  } | null> {
    if (!user) return null;
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();

    const isCommittee = await this.isUserCommittee(user, targetYear);
    if (!isCommittee) return null;

    const members = await this.getCommitteeMembers(targetYear);
    const member = members.find(
      (m) =>
        m.isActive &&
        (m.userId === user.id ||
          (user.nip && m.npp === user.nip) ||
          (user.npp && m.npp === user.npp) ||
          (m.fullName && user.full_name && m.fullName.trim().toLowerCase() === user.full_name.trim().toLowerCase()))
    );

    let roleCode: CommitteeRole | 'CUSTOM' = member?.role || 'ANGGOTA';
    let roleLabel = 'Anggota Panitia Ujian';

    if (member) {
      roleLabel =
        member.role === 'KETUA'
          ? 'Ketua Panitia Ujian'
          : member.role === 'SEKRETARIS'
          ? 'Sekretaris Panitia Ujian'
          : member.role === 'BENDAHARA'
          ? 'Bendahara Panitia Ujian'
          : member.role === 'ANGGOTA'
          ? 'Anggota Panitia Ujian'
          : 'Panitia Ujian';
    } else if (user.position && user.position.toLowerCase().includes('panitia')) {
      const pos = user.position.toLowerCase();
      if (pos.includes('ketua')) {
        roleCode = 'KETUA';
        roleLabel = 'Ketua Panitia Ujian';
      } else if (pos.includes('sekretaris')) {
        roleCode = 'SEKRETARIS';
        roleLabel = 'Sekretaris Panitia Ujian';
      } else if (pos.includes('bendahara')) {
        roleCode = 'BENDAHARA';
        roleLabel = 'Bendahara Panitia Ujian';
      } else {
        roleCode = 'ANGGOTA';
        roleLabel = 'Anggota Panitia Ujian';
      }
    }

    return {
      isCommittee: true,
      role: roleCode,
      roleLabel: roleLabel,
      academicYear: targetYear,
    };
  }

  /**
   * Helper to set or unset a teacher's committee status directly (e.g. from TeacherManagementTable).
   */
  public static async setTeacherCommitteeRole(
    teacher: UserProfile,
    role: CommitteeRole | 'NONE',
    academicYear?: string
  ): Promise<boolean> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();
    const currentMembers = await this.getCommitteeMembers(targetYear);
    let updatedMembers: ExamCommitteeMember[];

    if (role === 'NONE') {
      updatedMembers = currentMembers.filter(
        (m) =>
          m.userId !== teacher.id &&
          !(teacher.nip && m.npp === teacher.nip) &&
          !(m.fullName && teacher.full_name && m.fullName.trim().toLowerCase() === teacher.full_name.trim().toLowerCase())
      );
    } else {
      const existingIdx = currentMembers.findIndex(
        (m) =>
          m.userId === teacher.id ||
          (teacher.nip && m.npp === teacher.nip) ||
          (m.fullName && teacher.full_name && m.fullName.trim().toLowerCase() === teacher.full_name.trim().toLowerCase())
      );

      const newMember: ExamCommitteeMember = {
        id: existingIdx >= 0 ? currentMembers[existingIdx].id : `comm_${teacher.id}_${Date.now()}`,
        userId: teacher.id,
        fullName: teacher.full_name || 'Guru',
        npp: teacher.nip || teacher.npp || undefined,
        role: role,
        academicYear: targetYear,
        isActive: true,
        createdAt: existingIdx >= 0 ? currentMembers[existingIdx].createdAt : new Date().toISOString(),
      };

      if (existingIdx >= 0) {
        updatedMembers = currentMembers.map((m, idx) => (idx === existingIdx ? newMember : m));
      } else {
        updatedMembers = [...currentMembers, newMember];
      }
    }

    return this.saveCommitteeMembers(updatedMembers, targetYear);
  }
}
