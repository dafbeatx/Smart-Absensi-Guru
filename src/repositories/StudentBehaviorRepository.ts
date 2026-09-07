import { ProviderFactory } from '../providers/provider-factory';
import type {
  StudentBehaviorRecord,
  StudentBehaviorLog,
  RecordStudentBehaviorParams,
  GradeMasterBehaviorCategory,
} from '../types/database.types';
import { logger } from '../utils/logger.utils';

export const BEHAVIORS_STORAGE_KEY = 'smart_absensi_gm_behaviors';
export const BEHAVIORS_CATEGORIES_KEY = 'smart_absensi_gm_categories';
export const BEHAVIORS_UPDATED_EVENT = 'smart_absensi_behaviors_updated';

// ==============================================================================
// OFFICIAL GRADEMASTER OS MASTER LISTS (Identik 100% dengan GradeMaster OS Sikap)
// ==============================================================================

export const GRADEMASTER_PELANGGARAN_PRESETS: GradeMasterBehaviorCategory[] = [
  { text: 'Terlambat Masuk Sekolah / Kelas', weight: 5, isGood: false, icon: '⏰' },
  { text: 'Tidak Mengerjakan Tugas / PR', weight: 5, isGood: false, icon: '📝' },
  { text: 'Bermain HP / Gadget saat Pelajaran', weight: 10, isGood: false, icon: '📱' },
  { text: 'Mengganggu Ketertiban & Suasana Kelas', weight: 10, isGood: false, icon: '📢' },
  { text: 'Atribut Seragam Tidak Lengkap / Rapi', weight: 5, isGood: false, icon: '👔' },
  { text: 'Meninggalkan Kelas Tanpa Izin', weight: 15, isGood: false, icon: '🏃' },
  { text: 'Tidak Mengikuti Upacara / Kegiatan Sekolah', weight: 15, isGood: false, icon: '🚩' },
  { text: 'Merusak Fasilitas / Inventaris Sekolah', weight: 25, isGood: false, icon: '🪑' },
  { text: 'Tindakan Indisipliner / Melawan Guru', weight: 30, isGood: false, icon: '⚠️' },
];

export const GRADEMASTER_KEBAIKAN_PRESETS: GradeMasterBehaviorCategory[] = [
  { text: 'Aktif Berdiskusi & Tanya Jawab', weight: 5, isGood: true, icon: '🙋' },
  { text: 'Membantu Teman / Tutor Sebaya', weight: 5, isGood: true, icon: '🤝' },
  { text: 'Menjaga Kebersihan Kelas (Piket)', weight: 5, isGood: true, icon: '🧹' },
  { text: 'Jujur & Menjunjung Integritas', weight: 10, isGood: true, icon: '💎' },
  { text: 'Pencapaian Prestasi Sekolah', weight: 15, isGood: true, icon: '🏆' },
  { text: 'Sopan Santun & Ramah pada Guru', weight: 5, isGood: true, icon: '🌱' },
];

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

  /**
   * Retrieves official GradeMaster OS behavior categories & preset point weights.
   * Checks live GradeMaster OS settings endpoint if available, with robust fallback to official presets.
   */
  public static async getCategories(): Promise<{
    kebaikan: GradeMasterBehaviorCategory[];
    pelanggaran: GradeMasterBehaviorCategory[];
  }> {
    // 1. Try to load cached categories from storage
    const cached = safeGetStorage(BEHAVIORS_CATEGORIES_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.kebaikan?.length && parsed?.pelanggaran?.length) {
          return parsed;
        }
      } catch {
        // ignore
      }
    }

    // 2. Try fetching dynamic settings from GradeMaster OS
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        const res = await window.fetch(
          'https://web-input-nilai-dafbeatxs-projects-0222ca64.vercel.app/api/grademaster/behaviors/settings',
          {
            headers: { Accept: 'application/json' },
            cache: 'no-store',
          }
        );
        if (res.ok) {
          const json = await res.json();
          if (json?.settings && Array.isArray(json.settings.reasons) && json.settings.reasons.length > 0) {
            const reasons: GradeMasterBehaviorCategory[] = json.settings.reasons;
            const result = {
              kebaikan: reasons.filter((r) => r.isGood),
              pelanggaran: reasons.filter((r) => !r.isGood),
            };
            safeSetStorage(BEHAVIORS_CATEGORIES_KEY, JSON.stringify(result));
            return result;
          }
        }
      }
    } catch {
      // Fallback silently to official GradeMaster OS master presets
    }

    const official = {
      kebaikan: GRADEMASTER_KEBAIKAN_PRESETS,
      pelanggaran: GRADEMASTER_PELANGGARAN_PRESETS,
    };
    safeSetStorage(BEHAVIORS_CATEGORIES_KEY, JSON.stringify(official));
    return official;
  }
}

