import { ProviderFactory } from '../providers/provider-factory';
import type { TeachingSlot } from '../types/database.types';
import { logger } from '../utils/logger.utils';

export const TEACHING_SCHEDULES_STORAGE_KEY = 'smart_absensi_teaching_schedules';
export const TEACHING_SCHEDULES_UPDATED_EVENT = 'smart_absensi_schedules_updated';

/**
 * Normalizes a teacher's full name by removing common Indonesian academic titles,
 * expanding abbreviations (e.g. M. -> Muhammad), and stripping punctuation for bulletproof matching.
 */
export function normalizeTeacherName(name?: string | null): string {
  if (!name) return '';
  return name
    .toLowerCase()
    // Remove common Indonesian academic titles & honorifics
    .replace(/,\s*(s\.pd|m\.pd|s\.mat|s\.si|s\.e|s\.pd\.i|g\.r|m\.si|dr|drs|dra|h\.|hj\.)/gi, '')
    .replace(/\b(s\.pd|m\.pd|s\.mat|s\.si|s\.e|s\.pd\.i|g\.r|m\.si|dr|drs|dra|h\.|hj\.)\b/gi, '')
    // Normalize "m." to "muhammad"
    .replace(/\bm\.\s*/gi, 'muhammad ')
    // Strip non-alphanumeric except spaces
    .replace(/[^a-z0-9\s]/gi, '')
    // Collapse spaces
    .replace(/\s+/g, ' ')
    .trim();
}

export class TeachingScheduleRepository {
  /**
   * Retrieves all teaching schedules from the active provider with local caching & fallback.
   */
  public static async getSchedules(token?: string): Promise<TeachingSlot[]> {
    try {
      const provider = ProviderFactory.getProvider();
      const schedules = await provider.getTeachingSchedules(token);
      if (Array.isArray(schedules)) {
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
   * Retrieves teaching schedules for a specific teacher with intelligent multi-factor matching:
   * 1. Exact User ID match (case-insensitive)
   * 2. Normalized Teacher Name match (ignoring titles like S.Pd, S.Mat, abbreviations M. vs Muhammad)
   * 3. Name containment and multi-word token overlap
   */
  public static async getTeacherSchedules(
    userId: string,
    teacherName?: string,
    token?: string
  ): Promise<TeachingSlot[]> {
    const allSchedules = await this.getSchedules(token);
    const targetNorm = normalizeTeacherName(teacherName);

    return allSchedules.filter((s) => {
      if (!s) return false;

      // 1. Direct User ID match
      if (s.user_id && userId && s.user_id.toLowerCase() === userId.toLowerCase()) {
        return true;
      }

      // 2. Normalized Teacher Name matching
      if (targetNorm && s.teacher_name) {
        const slotNorm = normalizeTeacherName(s.teacher_name);
        if (slotNorm && targetNorm) {
          // Exact normalized match
          if (slotNorm === targetNorm) return true;

          // One contains the other
          if (slotNorm.includes(targetNorm) || targetNorm.includes(slotNorm)) return true;

          // Word tokens overlap (at least 2 words match)
          const targetWords = targetNorm.split(' ').filter((w) => w.length > 2);
          const slotWords = slotNorm.split(' ').filter((w) => w.length > 2);
          const matchCount = targetWords.filter((tw) => slotWords.includes(tw)).length;
          if (matchCount >= 2 || (targetWords.length === 1 && matchCount === 1)) {
            return true;
          }
        }
      }

      return false;
    });
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
