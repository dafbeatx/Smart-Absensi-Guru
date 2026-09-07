import { ProviderFactory } from '../providers/provider-factory';
import type { StudentItem } from '../types/database.types';
import { logger } from '../utils/logger.utils';

export const STUDENTS_STORAGE_KEY = 'smart_absensi_students';
export const STUDENTS_UPDATED_EVENT = 'smart_absensi_students_updated';

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
  } catch {
    // ignore
  }
  return null;
};

const safeSetStorage = (key: string, value: string): void => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
    }
  } catch {
    // ignore
  }
};

export class StudentRepository {
  /**
   * Retrieves all students from the active provider with local caching & fallback.
   */
  public static async getStudents(token?: string): Promise<StudentItem[]> {
    try {
      const provider = ProviderFactory.getProvider();
      const students = await provider.getStudents(token);
      if (Array.isArray(students)) {
        safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(students));
        return students;
      }
    } catch (err) {
      logger.warn('StudentRepository', 'Failed to fetch students from provider, using fallback:', err);
    }

    // Fallback to localStorage cache
    try {
      const saved = safeGetStorage(STUDENTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      logger.error('StudentRepository', 'Failed to parse cached students:', err);
    }

    return [];
  }

  /**
   * Retrieves students for a specific class.
   */
  public static async getStudentsByClass(className: string, token?: string): Promise<StudentItem[]> {
    const all = await this.getStudents(token);
    if (!className || className === 'ALL') return all;
    return all.filter((s) => s.className === className);
  }

  /**
   * Saves or updates the complete students list across cloud and local storage.
   */
  public static async saveStudents(students: StudentItem[], token?: string): Promise<boolean> {
    try {
      // 1. Save to local storage for instant responsiveness
      safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(students));

      // 2. Dispatch cross-tab / window sync event
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: students })
        );
      }

      // 3. Persist to active cloud provider
      const provider = ProviderFactory.getProvider();
      await provider.saveStudents(students, token);
      return true;
    } catch (err) {
      logger.error('StudentRepository', 'Failed to save students:', err);
      return false;
    }
  }

  /**
   * Creates a new student record.
   */
  public static async createStudent(
    student: Omit<StudentItem, 'id' | 'created_at'>,
    token?: string
  ): Promise<StudentItem> {
    const provider = ProviderFactory.getProvider();
    const created = await provider.createStudent(student, token);

    try {
      const freshList = await provider.getStudents(token);
      if (Array.isArray(freshList) && freshList.length > 0) {
        safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(freshList));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: freshList })
          );
        }
        return created;
      }
    } catch {
      // ignore
    }

    // Sync localStorage fallback
    const existing = await this.getStudents(token);
    if (!existing.some((s) => s.id === created.id)) {
      existing.unshift(created);
      safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(existing));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: existing })
      );
    }

    return created;
  }

  /**
   * Updates an existing student record.
   */
  public static async updateStudent(
    id: string,
    updates: Partial<StudentItem>,
    token?: string
  ): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    const success = await provider.updateStudent(id, updates, token);

    if (success) {
      try {
        const freshList = await provider.getStudents(token);
        if (Array.isArray(freshList) && freshList.length > 0) {
          safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(freshList));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: freshList })
            );
          }
          return true;
        }
      } catch {
        // ignore
      }

      const existing = await this.getStudents(token);
      const idx = existing.findIndex((s) => s.id === id);
      if (idx !== -1) {
        existing[idx] = { ...existing[idx], ...updates };
        safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(existing));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(
            new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: existing })
          );
        }
      }
    }

    return success;
  }

  /**
   * Deletes a student record by ID.
   */
  public static async deleteStudent(id: string, token?: string): Promise<boolean> {
    const provider = ProviderFactory.getProvider();
    const success = await provider.deleteStudent(id, token);

    if (success) {
      try {
        const freshList = await provider.getStudents(token);
        if (Array.isArray(freshList)) {
          safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(freshList));
          if (typeof window !== 'undefined') {
            window.dispatchEvent(
              new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: freshList })
            );
          }
          return true;
        }
      } catch {
        // ignore
      }

      const existing = await this.getStudents(token);
      const filtered = existing.filter((s) => s.id !== id);
      safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(filtered));
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: filtered })
        );
      }
    }

    return success;
  }

  /**
   * Finds a student by RFID UID.
   */
  public static async getStudentByRfid(rfidUid: string, token?: string): Promise<StudentItem | null> {
    if (!rfidUid) return null;
    const cleanRfid = rfidUid.trim().toUpperCase();
    const students = await this.getStudents(token);
    return students.find((s) => s.rfidUid && s.rfidUid.trim().toUpperCase() === cleanRfid) || null;
  }

  /**
   * Binds an RFID card UID to a student. Checks uniqueness.
   */
  public static async bindRfidCard(studentId: string, rfidUid: string, token?: string): Promise<{ success: boolean; message: string }> {
    const cleanRfid = rfidUid.trim().toUpperCase();
    const students = await this.getStudents(token);

    // Check if RFID already assigned to someone else
    const conflict = students.find(
      (s) => s.id !== studentId && s.rfidUid && s.rfidUid.trim().toUpperCase() === cleanRfid
    );
    if (conflict) {
      return {
        success: false,
        message: `Kartu RFID ${cleanRfid} sudah terpasang pada siswa ${conflict.fullName} (${conflict.className}).`,
      };
    }

    const updated = await this.updateStudent(studentId, { rfidUid: cleanRfid, cardStatus: 'ACTIVE' }, token);
    return {
      success: updated,
      message: updated ? `Kartu RFID berhasil ditautkan ke siswa.` : `Gagal menautkan kartu RFID ke database.`,
    };
  }

  /**
   * Unbinds an RFID card from a student.
   */
  public static async unbindRfidCard(studentId: string, token?: string): Promise<boolean> {
    return this.updateStudent(studentId, { rfidUid: undefined, cardStatus: 'INACTIVE' }, token);
  }

  /**
   * Synchronizes active students directly from GradeMaster (Year 2026/2027).
   */
  public static async syncFromGradeMaster(
    academicYear = '2026/2027',
    token?: string
  ): Promise<{ syncedCount: number; classesCount: number }> {
    const provider = ProviderFactory.getProvider();
    const result = await provider.syncStudentsFromGradeMaster(academicYear, token);
    const updated = await provider.getStudents(token);
    safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(updated));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(STUDENTS_UPDATED_EVENT, { detail: updated })
      );
    }
    return result;
  }

  /**
   * Records student attendance when an RFID card is scanned.
   */
  public static async recordStudentRfidAttendance(
    rfidUid: string,
    subject = 'Presensi Harian',
    token?: string
  ) {
    const provider = ProviderFactory.getProvider();
    return provider.recordStudentRfidAttendance(rfidUid, subject, token);
  }

  /**
   * Fetches attendance records for a specific date and class from gm_attendance.
   */
  public static async getStudentAttendance(
    date: string,
    className?: string,
    academicYear = '2026/2027',
    token?: string
  ) {
    const provider = ProviderFactory.getProvider();
    return provider.getStudentAttendance(date, className, academicYear, token);
  }
}
