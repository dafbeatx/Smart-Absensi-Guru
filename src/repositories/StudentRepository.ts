import { ProviderFactory } from '../providers/provider-factory';
import type { StudentItem } from '../types/database.types';
import { logger } from '../utils/logger.utils';
import { areClassCodesEqual, normalizeClassCode } from '../utils/class.utils';

export const STUDENTS_STORAGE_KEY = 'smart_absensi_students';
export const STUDENTS_UPDATED_EVENT = 'smart_absensi_students_updated';

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

export const clearExamRosterCaches = (): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && (k.startsWith('smart_absensi_exam_student_roster_') || k === 'smart_absensi_exam_student_roster_custom')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
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
    return all.filter((s) => areClassCodesEqual(s.className, className));
  }

  /**
   * Retrieves distinct class names and student distribution strictly filtered by academic year.
   * Prioritizes local caches (Zero Egress) to avoid consuming Supabase cloud bandwidth.
   */
  public static async getDistinctClassesByAcademicYear(
    academicYear?: string,
    forceRefreshServer: boolean = false
  ): Promise<{
    classes: string[];
    classStudentCounts: Record<string, number>;
    source: 'LOCAL_CACHE' | 'TEACHING_SCHEDULE' | 'CLOUD' | 'FALLBACK';
    totalStudents: number;
  }> {
    const targetYear = academicYear || '2026/2027';

    // 1. Prioritas Utama: Check Local Student Cache (0 Bytes Egress)
    try {
      const cached = safeGetStorage(STUDENTS_STORAGE_KEY);
      if (cached && !forceRefreshServer) {
        const students: StudentItem[] = JSON.parse(cached);
        if (Array.isArray(students) && students.length > 0) {
          const yearStudents = students.filter(
            (s) => !s.academicYear || s.academicYear === targetYear
          );
          if (yearStudents.length > 0) {
            const classCounts: Record<string, number> = {};
            yearStudents.forEach((s) => {
              const norm = normalizeClassCode(s.className);
              if (norm) {
                classCounts[norm] = (classCounts[norm] || 0) + 1;
              }
            });
            const classes = Object.keys(classCounts).sort();
            if (classes.length > 0) {
              return {
                classes,
                classStudentCounts: classCounts,
                source: 'LOCAL_CACHE',
                totalStudents: yearStudents.length,
              };
            }
          }
        }
      }
    } catch {
      // ignore
    }

    // 2. Prioritas Kedua: Check Teaching Schedule Cache (0 Bytes Egress)
    try {
      const cachedSchedules = typeof window !== 'undefined' ? localStorage.getItem('smart_absensi_teaching_schedules') : null;
      if (cachedSchedules && !forceRefreshServer) {
        const slots: any[] = JSON.parse(cachedSchedules);
        if (Array.isArray(slots) && slots.length > 0) {
          const yearSlots = slots.filter((slot) => !slot.academic_year || slot.academic_year === targetYear);
          const set = new Set<string>();
          yearSlots.forEach((s) => {
            const norm = normalizeClassCode(s.class_name);
            if (norm) set.add(norm);
          });
          const classes = Array.from(set).sort();
          if (classes.length > 0) {
            return {
              classes,
              classStudentCounts: {},
              source: 'TEACHING_SCHEDULE',
              totalStudents: 0,
            };
          }
        }
      }
    } catch {
      // ignore
    }

    // 3. Jika diminta eksplisit (Sync Button) oleh Panitia: Ambil dari provider
    if (forceRefreshServer) {
      try {
        const fresh = await this.getStudents();
        if (Array.isArray(fresh) && fresh.length > 0) {
          const yearStudents = fresh.filter(
            (s) => !s.academicYear || s.academicYear === targetYear
          );
          const classCounts: Record<string, number> = {};
          yearStudents.forEach((s) => {
            const norm = normalizeClassCode(s.className);
            if (norm) {
              classCounts[norm] = (classCounts[norm] || 0) + 1;
            }
          });
          const classes = Object.keys(classCounts).sort();
          if (classes.length > 0) {
            return {
              classes,
              classStudentCounts: classCounts,
              source: 'CLOUD',
              totalStudents: yearStudents.length,
            };
          }
        }
      } catch (err) {
        logger.warn('StudentRepository', 'Server fetch for classes failed, using fallback:', err);
      }
    }

    // 4. Default Fallback Rombel Umum Sekolah (Zero Network)
    const fallbackClasses = ['7A', '7B', '8A', '8B', '9A', '9B', 'SMA'];
    return {
      classes: fallbackClasses,
      classStudentCounts: {},
      source: 'FALLBACK',
      totalStudents: 0,
    };
  }

  /**
   * Saves or updates the complete students list across cloud and local storage.
   */
  public static async saveStudents(students: StudentItem[], token?: string): Promise<boolean> {
    try {
      // 1. Save to local storage for instant responsiveness
      safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(students));
      clearExamRosterCaches();

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
    clearExamRosterCaches();
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
    clearExamRosterCaches();
    const provider = ProviderFactory.getProvider();
    const success = await provider.updateStudent(id, updates, token);

    if (success) {
      try {
        const freshList = await provider.getStudents(token);
        if (Array.isArray(freshList) && freshList.length > 0) {
          safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(freshList));
          clearExamRosterCaches();
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
        clearExamRosterCaches();
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
    clearExamRosterCaches();
    const provider = ProviderFactory.getProvider();
    const success = await provider.deleteStudent(id, token);

    if (success) {
      try {
        const freshList = await provider.getStudents(token);
        if (Array.isArray(freshList)) {
          safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(freshList));
          clearExamRosterCaches();
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
      clearExamRosterCaches();
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
    clearExamRosterCaches();
    const provider = ProviderFactory.getProvider();
    const result = await provider.syncStudentsFromGradeMaster(academicYear, token);
    const updated = await provider.getStudents(token);
    safeSetStorage(STUDENTS_STORAGE_KEY, JSON.stringify(updated));
    clearExamRosterCaches();
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
