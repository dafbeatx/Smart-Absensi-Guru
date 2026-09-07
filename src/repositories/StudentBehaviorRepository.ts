import { ProviderFactory } from '../providers/provider-factory';
import type {
  StudentBehaviorRecord,
  StudentBehaviorLog,
  RecordStudentBehaviorParams,
} from '../types/database.types';
import { logger } from '../utils/logger.utils';

export const BEHAVIORS_STORAGE_KEY = 'smart_absensi_gm_behaviors';
export const BEHAVIORS_UPDATED_EVENT = 'smart_absensi_behaviors_updated';

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

export class StudentBehaviorRepository {
  /**
   * Retrieves all student behaviors from active provider (Supabase gm_behaviors).
   * Supports local cache & fallback.
   */
  public static async getBehaviors(
    className?: string,
    academicYear = '2026/2027',
    token?: string
  ): Promise<StudentBehaviorRecord[]> {
    try {
      const provider = ProviderFactory.getProvider();
      const records = await provider.getStudentBehaviors(className, academicYear, token);
      if (Array.isArray(records) && records.length > 0) {
        if (!className || className === 'ALL') {
          safeSetStorage(BEHAVIORS_STORAGE_KEY, JSON.stringify(records));
        }
        return records;
      }
    } catch (err) {
      logger.warn('StudentBehaviorRepository', 'Failed to fetch student behaviors from provider, using fallback:', err);
    }

    // Fallback to localStorage cache
    try {
      const saved = safeGetStorage(BEHAVIORS_STORAGE_KEY);
      if (saved) {
        const parsed: StudentBehaviorRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.filter((b) => {
            const matchYear = !b.academic_year || b.academic_year === academicYear;
            const matchClass = !className || className === 'ALL' || b.class_name === className;
            return matchYear && matchClass;
          });
        }
      }
    } catch (err) {
      logger.error('StudentBehaviorRepository', 'Failed to parse cached behaviors:', err);
    }

    return [];
  }

  /**
   * Records student good deed (kebaikan) or discipline infraction (pelanggaran).
   * Atomically updates points & behavior_logs on Supabase and dispatches cross-component event.
   */
  public static async recordBehavior(
    params: RecordStudentBehaviorParams,
    token?: string
  ): Promise<{
    success: boolean;
    newTotal: number;
    record?: StudentBehaviorRecord;
    message: string;
  }> {
    try {
      const provider = ProviderFactory.getProvider();
      const result = await provider.recordStudentBehavior(params, token);

      if (result.success) {
        // Refresh and broadcast updated behaviors list
        try {
          const freshList = await provider.getStudentBehaviors('ALL', params.academicYear || '2026/2027', token);
          if (Array.isArray(freshList)) {
            safeSetStorage(BEHAVIORS_STORAGE_KEY, JSON.stringify(freshList));
            if (typeof window !== 'undefined') {
              window.dispatchEvent(
                new CustomEvent(BEHAVIORS_UPDATED_EVENT, { detail: freshList })
              );
            }
          }
        } catch {
          // ignore background broadcast error
        }
      }

      return result;
    } catch (err: any) {
      logger.error('StudentBehaviorRepository', 'Failed to record student behavior:', err);
      return {
        success: false,
        newTotal: 0,
        message: err?.message || 'Terjadi kesalahan sistem saat mencatat poin siswa.',
      };
    }
  }

  /**
   * Retrieves behavior history logs for a specific student.
   */
  public static async getHistory(
    studentName: string,
    className: string,
    token?: string
  ): Promise<StudentBehaviorLog[]> {
    try {
      const provider = ProviderFactory.getProvider();
      return await provider.getStudentBehaviorHistory(studentName, className, token);
    } catch (err) {
      logger.warn('StudentBehaviorRepository', 'Failed to fetch student history:', err);
      return [];
    }
  }
}
