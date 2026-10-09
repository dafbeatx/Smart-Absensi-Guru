/**
 * SMART ABSENSI GURU — EXAM PERIOD REPOSITORY
 * Dual-layer synchronization (Supabase Cloud + LocalStorage) for Exam & Committee Active Period.
 * Handles manual toggle on-off and auto-expiration by date & time.
 */

import type { ExamPeriodSettings, ExamPeriodStatus } from '../types/exam-schedule.types';
import { AdministrationRepository } from './AdministrationRepository';
import { ExamScheduleRepository } from './ExamScheduleRepository';
import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger.utils';

export const EXAM_PERIOD_STORAGE_KEY_PREFIX = 'smart_absensi_exam_period';
export const EXAM_PERIOD_CHANGED_EVENT = 'smart_absensi_exam_period_changed';

const memoryPeriodStore = new Map<string, string>();

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {}
  return memoryPeriodStore.get(key) || null;
};

const safeSetStorage = (key: string, value: string): void => {
  memoryPeriodStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {}
};

const MONTH_NAMES_ID = [
  'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
  'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'
];

function formatIndonesianDate(d: Date): string {
  if (isNaN(d.getTime())) return '-';
  const day = d.getDate();
  const month = MONTH_NAMES_ID[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
}

function formatIndonesianTime(d: Date): string {
  if (isNaN(d.getTime())) return '00:00';
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

export class ExamPeriodRepository {
  /**
   * Retrieves the current exam period settings for a given academic year.
   * Falls back to active exam schedule's end date if no explicit settings exist yet.
   */
  public static async getPeriodSettings(academicYear?: string): Promise<ExamPeriodSettings> {
    const targetYear = academicYear || AdministrationRepository.getActiveAcademicYear();
    const cleanYear = targetYear.replace(/[^\w]/g, '_');
    const storageKey = `${EXAM_PERIOD_STORAGE_KEY_PREFIX}_${cleanYear}`;

    // 1. Fetch from cloud provider
    try {
      const provider = ProviderFactory.getProvider();
      const remoteSettings = await provider.getExamPeriodSettings(targetYear);
      if (remoteSettings) {
        return remoteSettings;
      }
    } catch (err) {
      logger.warn('ExamPeriodRepository', 'Cloud fetch failed, using local cache:', err);
    }

    // 2. Fallback to localStorage
    try {
      const raw = safeGetStorage(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed.isEnabled === 'boolean') {
          return parsed;
        }
      }

      // Check global legacy key
      const globalRaw = safeGetStorage('smart_absensi_exam_period_settings');
      if (globalRaw) {
        const parsed = JSON.parse(globalRaw);
        if (parsed && (!parsed.academicYear || parsed.academicYear === targetYear)) {
          return parsed;
        }
      }
    } catch (err) {
      logger.error('ExamPeriodRepository', 'Failed to parse local exam period settings:', err);
    }

    // 3. Fallback: Check if an active exam schedule exists to auto-populate end date
    let detectedEndDate = '';
    let detectedTitle = 'Asesmen Sekolah (ASTS/ASAS)';
    try {
      const [smpSchedule, smaSchedule] = await Promise.all([
        ExamScheduleRepository.getSchedule(targetYear, 'ASTS', 'SMP')
          .then(async (s) => s || await ExamScheduleRepository.getSchedule(targetYear, 'ASAS', 'SMP')),
        ExamScheduleRepository.getSchedule(targetYear, 'ASTS', 'SMA')
          .then(async (s) => s || await ExamScheduleRepository.getSchedule(targetYear, 'ASAS', 'SMA')),
      ]);

      const activeSchedule = smpSchedule || smaSchedule;
      if (activeSchedule?.config) {
        detectedEndDate = activeSchedule.config.endDate || '';
        detectedTitle = activeSchedule.config.examTitle || detectedTitle;
      }
    } catch {
      // ignore schedule lookup error
    }

    const defaultSettings: ExamPeriodSettings = {
      isEnabled: true,
      autoDeactivateEnabled: Boolean(detectedEndDate),
      endDate: detectedEndDate,
      endTime: '17:00',
      examTitle: detectedTitle,
      academicYear: targetYear,
      hideCommitteeBanner: true,
      hideExamDutiesCard: true,
      hideAdministrationModules: true,
      updatedAt: new Date().toISOString(),
    };

    return defaultSettings;
  }

  /**
   * Saves updated exam period settings to Cloud Provider and LocalStorage, then broadcasts event.
   */
  public static async savePeriodSettings(settings: ExamPeriodSettings): Promise<boolean> {
    const targetYear = settings.academicYear || AdministrationRepository.getActiveAcademicYear();
    const cleanYear = targetYear.replace(/[^\w]/g, '_');
    const storageKey = `${EXAM_PERIOD_STORAGE_KEY_PREFIX}_${cleanYear}`;

    try {
      const payload: ExamPeriodSettings = {
        ...settings,
        academicYear: targetYear,
        updatedAt: new Date().toISOString(),
      };

      // 1. Local storage save
      safeSetStorage(storageKey, JSON.stringify(payload));
      safeSetStorage('smart_absensi_exam_period_settings', JSON.stringify(payload));

      // 2. Persist to Cloud Provider
      try {
        const provider = ProviderFactory.getProvider();
        await provider.saveExamPeriodSettings(payload);
      } catch (cloudErr) {
        logger.warn('ExamPeriodRepository', 'Failed to push exam period settings to provider:', cloudErr);
      }

      // 3. Broadcast real-time event across components and tabs
      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(EXAM_PERIOD_CHANGED_EVENT, { detail: payload })
        );
      }

      return true;
    } catch (err) {
      logger.error('ExamPeriodRepository', 'Failed to save exam period settings:', err);
      return false;
    }
  }

  /**
   * Helper to quickly toggle the exam period status ON or OFF.
   */
  public static async togglePeriod(
    isEnabled: boolean,
    academicYear?: string,
    updatedBy?: string
  ): Promise<ExamPeriodSettings> {
    const current = await this.getPeriodSettings(academicYear);
    const updated: ExamPeriodSettings = {
      ...current,
      isEnabled,
      updatedBy: updatedBy || current.updatedBy,
      updatedAt: new Date().toISOString(),
    };
    await this.savePeriodSettings(updated);
    return updated;
  }

  /**
   * Deterministically calculates the active status given settings and a reference timestamp.
   */
  public static computePeriodStatus(
    settings: ExamPeriodSettings | null,
    now: Date = new Date()
  ): ExamPeriodStatus {
    if (!settings) {
      return {
        isActive: true,
        isExpiredByTime: false,
        isManuallyDisabled: false,
        statusLabel: 'AKTIF',
        remainingText: 'Aktif',
      };
    }

    // 1. Manual switch turned OFF
    if (!settings.isEnabled) {
      return {
        isActive: false,
        isExpiredByTime: false,
        isManuallyDisabled: true,
        statusLabel: 'NONAKTIF_MANUAL',
        remainingText: 'Ujian telah dinonaktifkan manual oleh Admin/Panitia',
      };
    }

    // 2. Auto-expiration by date & time check
    if (settings.autoDeactivateEnabled && settings.endDate) {
      try {
        const dateParts = settings.endDate.split('-').map(Number);
        if (dateParts.length === 3) {
          const [year, month, day] = dateParts;
          let hour = 17;
          let minute = 0;

          if (settings.endTime && settings.endTime.includes(':')) {
            const timeParts = settings.endTime.split(':').map(Number);
            hour = isNaN(timeParts[0]) ? 17 : timeParts[0];
            minute = isNaN(timeParts[1]) ? 0 : timeParts[1];
          }

          const expiryDate = new Date(year, month - 1, day, hour, minute, 59, 999);

          if (!isNaN(expiryDate.getTime())) {
            const isPast = now.getTime() > expiryDate.getTime();
            const expiryFormatted = `${formatIndonesianDate(expiryDate)} pukul ${formatIndonesianTime(expiryDate)} WIB`;

            if (isPast) {
              return {
                isActive: false,
                isExpiredByTime: true,
                isManuallyDisabled: false,
                statusLabel: 'TELAH_USAI_WAKTU',
                remainingText: `Ujian telah usai (sejak ${expiryFormatted})`,
                expiryFormatted,
              };
            }

            return {
              isActive: true,
              isExpiredByTime: false,
              isManuallyDisabled: false,
              statusLabel: 'AKTIF',
              remainingText: `Aktif s/d ${expiryFormatted}`,
              expiryFormatted,
            };
          }
        }
      } catch (err) {
        logger.warn('ExamPeriodRepository', 'Failed to parse expiry date, defaulting to active:', err);
      }
    }

    // 3. Fallback: Active
    return {
      isActive: true,
      isExpiredByTime: false,
      isManuallyDisabled: false,
      statusLabel: 'AKTIF',
      remainingText: 'Aktif (Tanpa batas waktu otomatis)',
    };
  }

  /**
   * Fetches settings and returns the computed status in a single asynchronous call.
   */
  public static async getPeriodStatus(academicYear?: string, now: Date = new Date()): Promise<ExamPeriodStatus> {
    const settings = await this.getPeriodSettings(academicYear);
    return this.computePeriodStatus(settings, now);
  }
}
