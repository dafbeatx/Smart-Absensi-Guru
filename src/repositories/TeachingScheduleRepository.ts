import { ProviderFactory } from '../providers/provider-factory';
import type { TeachingSlot } from '../types/database.types';
import { logger } from '../utils/logger.utils';

export const TEACHING_SCHEDULES_STORAGE_KEY = 'smart_absensi_teaching_schedules';
export const TEACHING_SCHEDULES_UPDATED_EVENT = 'smart_absensi_schedules_updated';

export class TeachingScheduleRepository {
  /**
   * Retrieves all teaching schedules from the active provider with local caching & fallback.
   */
  public static async getSchedules(token?: string): Promise<TeachingSlot[]> {
    try {
      const provider = ProviderFactory.getProvider();
      const schedules = await provider.getTeachingSchedules(token);
      if (Array.isArray(schedules) && schedules.length > 0) {
        try {
          localStorage.setItem(TEACHING_SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));
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
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (err) {
      logger.error('TeachingScheduleRepository', 'Failed to parse cached schedules:', err);
    }

    return [];
  }

  /**
   * Retrieves teaching schedules for a specific teacher.
   */
  public static async getTeacherSchedules(userId: string, teacherName?: string, token?: string): Promise<TeachingSlot[]> {
    const allSchedules = await this.getSchedules(token);
    return allSchedules.filter(
      (s) =>
        s &&
        (s.user_id === userId ||
          (teacherName && s.teacher_name && s.teacher_name.toLowerCase() === teacherName.toLowerCase()))
    );
  }

  /**
   * Saves or updates the complete teaching schedules list across cloud and local storage.
   */
  public static async saveSchedules(schedules: TeachingSlot[], token?: string): Promise<boolean> {
    try {
      // 1. Save to local storage for instant responsiveness
      localStorage.setItem(TEACHING_SCHEDULES_STORAGE_KEY, JSON.stringify(schedules));

      // 2. Dispatch cross-tab / window sync event
      window.dispatchEvent(
        new CustomEvent(TEACHING_SCHEDULES_UPDATED_EVENT, { detail: schedules })
      );

      // 3. Persist to active cloud provider
      const provider = ProviderFactory.getProvider();
      await provider.saveTeachingSchedules(schedules, token);
      return true;
    } catch (err) {
      logger.error('TeachingScheduleRepository', 'Failed to save schedules:', err);
      return false;
    }
  }
}
