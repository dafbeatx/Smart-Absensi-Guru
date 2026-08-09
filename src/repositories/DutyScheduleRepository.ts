import { ProviderFactory } from '../providers/provider-factory';
import type { TeacherDutySchedule } from '../types/database.types';

export class DutyScheduleRepository {
  /**
   * Fetch all duty schedules (Senin - Jumat)
   */
  public static async getDutySchedules(token?: string): Promise<TeacherDutySchedule[]> {
    return ProviderFactory.getProvider().getDutySchedules(token);
  }

  /**
   * Save duty schedule entries
   */
  public static async saveDutySchedules(
    schedules: Omit<TeacherDutySchedule, 'id' | 'created_at'>[],
    token?: string
  ): Promise<boolean> {
    const success = await ProviderFactory.getProvider().saveDutySchedules(schedules, token);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_duty_schedules_updated'));
    }
    return success;
  }

  /**
   * Get duty teachers for a specific day of week (1 = Senin, ..., 5 = Jumat)
   */
  public static async getDutyTeachersForDay(dayOfWeek: number, token?: string): Promise<TeacherDutySchedule[]> {
    const all = await this.getDutySchedules(token);
    return all.filter((s) => s.day_of_week === dayOfWeek);
  }

  /**
   * Check if a specific teacher user is assigned as Guru Piket today
   */
  public static isTeacherDutyToday(
    teacherIdOrName: string,
    dutySchedules: TeacherDutySchedule[],
    todayDayOfWeek?: number
  ): boolean {
    const day = todayDayOfWeek !== undefined ? todayDayOfWeek : new Date().getDay();
    // Only Monday (1) through Friday (5)
    if (day < 1 || day > 5) return false;

    const todaySchedules = dutySchedules.filter((s) => s.day_of_week === day);
    const cleanQuery = teacherIdOrName.trim().toLowerCase();

    return todaySchedules.some((s) => {
      const matchId = s.teacher_id === teacherIdOrName;
      const matchName = s.teacher_name.toLowerCase().includes(cleanQuery) || cleanQuery.includes(s.teacher_name.toLowerCase());
      return matchId || matchName;
    });
  }
}
