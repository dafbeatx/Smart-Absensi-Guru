import { ProviderFactory } from '../providers/provider-factory';
import type {
  TeachingSlot,
  CreateTeachingScheduleDTO,
  UpdateTeachingScheduleDTO,
  TeachingScheduleResult,
} from '../types/database.types';
import { logger } from '../utils/logger.utils';

export const TEACHING_SCHEDULES_STORAGE_KEY = 'smart_absensi_teaching_schedules';
export const TEACHING_SCHEDULES_UPDATED_EVENT = 'smart_absensi_schedules_updated';

export class TeachingScheduleRepository {
  /**
   * Retrieves all teaching schedules from the active provider with local caching & fallback.
   */
  public static async getSchedules(
    token?: string,
    filter?: { teacher_user_id?: string; academic_year?: string; day_of_week?: number }
  ): Promise<TeachingSlot[]> {
    try {
      const provider = ProviderFactory.getProvider();
      const schedules = await provider.getTeachingSchedules(token, filter);
      if (Array.isArray(schedules)) {
        try {
          if (!filter || (!filter.teacher_user_id && !filter.day_of_week)) {
            localStorage.setItem(TEACHING_SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
          }
        } catch {
          // ignore localStorage write errors
        }
        return schedules;
      }
    } catch (err) {
      logger.warn('TeachingScheduleRepository', 'Failed to fetch schedules from provider, using fallback:', err);
    }

    // Fallback to localStorage cache
    try {
      const saved = localStorage.getItem(TEACHING_SCHEDULES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          let list = parsed;
          if (filter?.teacher_user_id) {
            list = list.filter(
              (s) => s.teacher_user_id === filter.teacher_user_id || s.user_id === filter.teacher_user_id
            );
          }
          if (filter?.day_of_week !== undefined) {
            list = list.filter((s) => s.day_of_week === filter.day_of_week);
          }
          return list;
        }
      }
    } catch (err) {
      logger.error('TeachingScheduleRepository', 'Failed to parse cached schedules:', err);
    }

    return [];
  }

  /**
   * Retrieves teaching schedules for a specific teacher with strict User ID filtering.
   * Eliminates runtime fuzzy string matching to prevent cross-teacher leakage.
   */
  public static async getTeacherSchedules(
    userId: string,
    _deprecatedTeacherName?: string,
    token?: string
  ): Promise<TeachingSlot[]> {
    if (!userId) return [];
    const allSchedules = await this.getSchedules(token, { teacher_user_id: userId });

    return allSchedules.filter((s) => {
      if (!s) return false;
      const slotOwnerId = s.teacher_user_id || s.user_id;
      return slotOwnerId && slotOwnerId.toLowerCase() === userId.toLowerCase();
    });
  }

  /**
   * Atomically creates a single teaching schedule slot with conflict validation.
   */
  public static async createSchedule(
    dto: CreateTeachingScheduleDTO,
    token?: string
  ): Promise<TeachingScheduleResult> {
    try {
      const provider = ProviderFactory.getProvider();
      const result = await provider.createTeachingSchedule(dto, token);
      if (result.success && result.data) {
        await this.refreshCache(token);
        window.dispatchEvent(
          new CustomEvent(TEACHING_SCHEDULES_UPDATED_EVENT, { detail: result.data })
        );
      }
      return result;
    } catch (err: any) {
      logger.error('TeachingScheduleRepository', 'createSchedule failed:', err);
      return { success: false, error: err?.message || 'Gagal membuat jadwal' };
    }
  }

  /**
   * Atomically updates a single teaching schedule slot with optimistic locking & conflict validation.
   */
  public static async updateSchedule(
    dto: UpdateTeachingScheduleDTO,
    token?: string
  ): Promise<TeachingScheduleResult> {
    try {
      const provider = ProviderFactory.getProvider();
      const result = await provider.updateTeachingSchedule(dto, token);
      if (result.success && result.data) {
        await this.refreshCache(token);
        window.dispatchEvent(
          new CustomEvent(TEACHING_SCHEDULES_UPDATED_EVENT, { detail: result.data })
        );
      }
      return result;
    } catch (err: any) {
      logger.error('TeachingScheduleRepository', 'updateSchedule failed:', err);
      return { success: false, error: err?.message || 'Gagal memperbarui jadwal' };
    }
  }

  /**
   * Atomically deletes a teaching schedule slot by ID.
   */
  public static async deleteSchedule(id: string, token?: string): Promise<boolean> {
    try {
      const provider = ProviderFactory.getProvider();
      const success = await provider.deleteTeachingSchedule(id, token);
      if (success) {
        await this.refreshCache(token);
        window.dispatchEvent(
          new CustomEvent(TEACHING_SCHEDULES_UPDATED_EVENT, { detail: { id } })
        );
      }
      return success;
    } catch (err) {
      logger.error('TeachingScheduleRepository', 'deleteSchedule failed:', err);
      return false;
    }
  }

  /**
   * Bulk saves teaching schedules (upsert-preserving).
   */
  public static async saveSchedules(schedules: TeachingSlot[], token?: string): Promise<boolean> {
    try {
      const provider = ProviderFactory.getProvider();
      const success = await provider.saveTeachingSchedules(schedules, token);
      if (success) {
        try {
          localStorage.setItem(TEACHING_SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
        } catch {
          // ignore
        }
        window.dispatchEvent(
          new CustomEvent(TEACHING_SCHEDULES_UPDATED_EVENT, { detail: schedules })
        );
        return true;
      }
      return false;
    } catch (err) {
      logger.error('TeachingScheduleRepository', 'Failed to save schedules:', err);
      return false;
    }
  }

  private static async refreshCache(token?: string): Promise<void> {
    try {
      const provider = ProviderFactory.getProvider();
      const schedules = await provider.getTeachingSchedules(token);
      if (Array.isArray(schedules)) {
        localStorage.setItem(TEACHING_SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
      }
    } catch {
      // ignore
    }
  }
}
