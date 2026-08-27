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

    // Sync localStorage
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
}
