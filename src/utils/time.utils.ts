import { CONSTANTS } from '../config/constants';
import type { HolidayRecord } from '../types/database.types';

/**
 * Helper utility for formatting and sanitizing time values for HTML5 <input type="time">
 * and intelligent attendance status evaluation (HADIR vs TERLAMBAT).
 */

/**
 * Converts any time string ("07:48", "07.48.15", "07:15:00") into total minutes from midnight for bulletproof time comparisons.
 * Examples:
 * - "07:15" -> 435
 * - "07.48.15" -> 468
 */
export function timeToMinutes(timeStr: unknown): number {
  if (!timeStr) return 0;
  const str = String(timeStr).replace(/\./g, ':').trim();
  const parts = str.split(':');
  if (parts.length >= 2) {
    const hours = parseInt(parts[0], 10) || 0;
    const minutes = parseInt(parts[1], 10) || 0;
    return hours * 60 + minutes;
  }
  return 0;
}

/**
 * Intelligently evaluates whether a check-in time is HADIR (On Time) or TERLAMBAT (Late).
 * If check-in time is strictly greater than checkinEnd (default from system settings / 07:30), returns 'TERLAMBAT'.
 */
export function evaluateAttendanceStatus(
  checkInTime: string | null | undefined,
  checkinEnd: string = CONSTANTS.DEFAULTS.WORK_CHECKIN_END,
  currentStatus?: string
): 'HADIR' | 'TERLAMBAT' | 'IZIN' | 'SAKIT' | 'DINAS_LUAR' | 'ALFA' {
  if (currentStatus && currentStatus !== 'HADIR' && currentStatus !== 'TERLAMBAT' && currentStatus !== 'BELUM_ABSEN') {
    return currentStatus as 'IZIN' | 'SAKIT' | 'DINAS_LUAR' | 'ALFA';
  }

  if (!checkInTime) {
    return currentStatus === 'TERLAMBAT' ? 'TERLAMBAT' : (currentStatus as 'HADIR' || 'HADIR');
  }

  const checkInMin = timeToMinutes(checkInTime);
  const cutoffMin = timeToMinutes(checkinEnd);

  if (checkInMin > cutoffMin) {
    return 'TERLAMBAT';
  }

  return 'HADIR';
}

/**
 * Normalizes any time or date-time value (ISO string, HH:mm:ss, HH:mm)
 * into standard 24-hour "HH:mm" format required by HTML5 <input type="time">.
 */
export function formatTimeForInput(value: unknown, defaultValue: string = ''): string {
  if (value === null || value === undefined) return defaultValue;

  const str = String(value).trim();
  if (!str) return defaultValue;

  if (str.includes('T')) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      const totalSeconds = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
      const roundedMinutes = Math.round(totalSeconds / 60);
      const hours = String(Math.floor(roundedMinutes / 60) % 24).padStart(2, '0');
      const minutes = String(roundedMinutes % 60).padStart(2, '0');
      return `${hours}:${minutes}`;
    }
  }

  const normalizedStr = str.replace(/\./g, ':');
  const timeMatch = normalizedStr.match(/(\d{1,2}):(\d{2})/);
  if (timeMatch) {
    const hours = String(timeMatch[1]).padStart(2, '0');
    const minutes = String(timeMatch[2]).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  return defaultValue;
}

/**
 * Returns today's date string formatted as "YYYY-MM-DD" strictly in Asia/Jakarta timezone (WIB/GMT+7).
 * Avoids the bug where Date.prototype.toISOString().split('T')[0] yields yesterday's date between 00:00 - 06:59 WIB.
 */
export function getTodayDateInJakarta(timeZone: string = 'Asia/Jakarta'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().substring(0, 10);
  }
}

/**
 * Returns current time string formatted as "HH:mm:ss" strictly in Asia/Jakarta timezone (WIB/GMT+7).
 */
export function getCurrentTimeInJakarta(timeZone: string = 'Asia/Jakarta'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    return formatter.format(new Date());
  } catch {
    const d = new Date();
    return [d.getHours(), d.getMinutes(), d.getSeconds()]
      .map((n) => String(n).padStart(2, '0'))
      .join(':');
  }
}

/**
 * Checks if a given date (or date string YYYY-MM-DD / Date object) is a non-working day (Weekend or Holiday)
 * based on system settings and holiday records.
 */
export function isDateOffDay(
  targetDate: string | Date = new Date(),
  settings?: { saturday_is_holiday?: boolean; sunday_is_holiday?: boolean } | null,
  holidays?: Array<{
    date: string;
    name: string;
    is_holiday?: boolean;
    category_type?: string;
    type?: string;
  }> | null
): { isOff: boolean; reason: string } {
  let dateIso = '';
  let dayOfWeek = 0;

  if (typeof targetDate === 'string') {
    const cleanStr = targetDate.trim();
    if (cleanStr.includes('T')) {
      const d = new Date(cleanStr);
      if (isNaN(d.getTime())) return { isOff: false, reason: '' };
      dateIso = cleanStr.substring(0, 10);
      dayOfWeek = d.getDay();
    } else {
      const parts = cleanStr.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const localDate = new Date(y, m - 1, d);
        if (isNaN(localDate.getTime())) return { isOff: false, reason: '' };
        dateIso = cleanStr;
        dayOfWeek = localDate.getDay();
      } else {
        const d = new Date(cleanStr);
        if (isNaN(d.getTime())) return { isOff: false, reason: '' };
        dateIso = d.toISOString().substring(0, 10);
        dayOfWeek = d.getDay();
      }
    }
  } else if (targetDate instanceof Date) {
    if (isNaN(targetDate.getTime())) return { isOff: false, reason: '' };
    dateIso = targetDate.toISOString().substring(0, 10);
    dayOfWeek = targetDate.getDay();
  }

  // Auto-resolve global holidays from LocalStorage if not explicitly passed
  let effectiveHolidays = holidays;
  if (!effectiveHolidays && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem('smart_absensi_holidays');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          effectiveHolidays = parsed;
        }
      }
    } catch (e) {}
  }

  // 1. Check explicit holiday record first
  // HANYA record yang bertipe Hari Libur resmi yang membuat libur (is_holiday !== false && category_type !== 'SCHEDULE')
  // Record yang bertipe 'SCHEDULE' (Rapat, UTS/UAS, Upacara, dll) adalah pengingat agenda dan TIDAK membuat guru libur.
  if (effectiveHolidays && effectiveHolidays.length > 0 && dateIso) {
    const matchedHoliday = effectiveHolidays.find((h) => {
      if (h.date !== dateIso) return false;
      if (h.is_holiday === false) return false;
      if (h.category_type === 'SCHEDULE') return false;
      if (
        h.is_holiday === undefined &&
        (h.type === 'RAPAT' || h.type === 'UJIAN' || h.type === 'UPACARA' || h.type === 'WORKSHOP' || h.type === 'OTHER')
      ) {
        return false;
      }
      return true;
    });

    if (matchedHoliday) {
      return { isOff: true, reason: `Hari Libur: ${matchedHoliday.name}` };
    }
  }

  // Auto-resolve weekend settings from LocalStorage if not explicitly passed
  let saturdayLibur = true;
  let sundayLibur = true;

  if (settings) {
    saturdayLibur = settings.saturday_is_holiday ?? true;
    sundayLibur = settings.sunday_is_holiday ?? true;
  } else if (typeof window !== 'undefined') {
    try {
      const savedSettings = localStorage.getItem('smart_absensi_system_settings');
      if (savedSettings) {
        const parsed = JSON.parse(savedSettings);
        if (parsed.saturday_is_holiday !== undefined) saturdayLibur = parsed.saturday_is_holiday;
        if (parsed.sunday_is_holiday !== undefined) sundayLibur = parsed.sunday_is_holiday;
      }
    } catch (e) {}
  }

  if (dayOfWeek === 6 && saturdayLibur) {
    return { isOff: true, reason: 'Libur Akhir Pekan (Sabtu)' };
  }
  if (dayOfWeek === 0 && sundayLibur) {
    return { isOff: true, reason: 'Libur Akhir Pekan (Minggu)' };
  }

  return { isOff: false, reason: '' };
}

export const INDONESIAN_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export interface MonthWorkingDaysInfo {
  monthName: string;
  monthNumber: number; // 1 - 12
  year: number;
  totalDaysInMonth: number;
  totalMonthWorkingDays: number;
  elapsedWorkingDays: number;
  effectiveWorkingDays: number;
  isCurrentMonth: boolean;
  isPastMonth: boolean;
  isFutureMonth: boolean;
  workingDates: string[];
}

export function parseIndonesianMonth(monthInput: string | number): number {
  if (typeof monthInput === 'number') {
    return Math.min(12, Math.max(1, Math.floor(monthInput)));
  }
  const str = String(monthInput).trim().toLowerCase();
  const foundIdx = INDONESIAN_MONTHS.findIndex((m) => m.toLowerCase() === str);
  if (foundIdx !== -1) {
    return foundIdx + 1;
  }
  const parsedNum = parseInt(str, 10);
  if (!isNaN(parsedNum) && parsedNum >= 1 && parsedNum <= 12) {
    return parsedNum;
  }
  return new Date().getMonth() + 1;
}

/**
 * Calculates accurate working days in a specific month & year.
 * Distinguishes between completed months and ongoing/current months (up to today),
 * properly excluding weekend holidays and custom school holidays.
 */
export function getMonthWorkingDays(
  monthInput: string | number,
  yearInput: string | number,
  upToTodayIfCurrentMonth: boolean = true,
  settings?: { saturday_is_holiday?: boolean; sunday_is_holiday?: boolean } | null,
  holidays?: Array<{ date: string; name: string }> | null
): MonthWorkingDaysInfo {
  const monthNumber = parseIndonesianMonth(monthInput);
  const year = typeof yearInput === 'number' ? yearInput : parseInt(String(yearInput), 10) || new Date().getFullYear();
  const monthName = INDONESIAN_MONTHS[monthNumber - 1] || 'Januari';

  const todayStr = getTodayDateInJakarta();
  const todayDate = new Date(todayStr);
  const currentYear = todayDate.getFullYear();
  const currentMonthNumber = todayDate.getMonth() + 1;
  const currentDay = todayDate.getDate();

  const isCurrentMonth = year === currentYear && monthNumber === currentMonthNumber;
  const isPastMonth = year < currentYear || (year === currentYear && monthNumber < currentMonthNumber);
  const isFutureMonth = year > currentYear || (year === currentYear && monthNumber > currentMonthNumber);

  const totalDaysInMonth = new Date(year, monthNumber, 0).getDate();
  let totalMonthWorkingDays = 0;
  let elapsedWorkingDays = 0;
  const workingDates: string[] = [];

  for (let day = 1; day <= totalDaysInMonth; day++) {
    const dayStr = `${year}-${String(monthNumber).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    const offCheck = isDateOffDay(dayStr, settings, holidays);

    if (!offCheck.isOff) {
      totalMonthWorkingDays++;
      workingDates.push(dayStr);

      if (isCurrentMonth) {
        if (day <= currentDay) {
          elapsedWorkingDays++;
        }
      } else if (isPastMonth) {
        elapsedWorkingDays++;
      }
    }
  }

  let effectiveWorkingDays = totalMonthWorkingDays;
  if (isCurrentMonth && upToTodayIfCurrentMonth) {
    effectiveWorkingDays = elapsedWorkingDays;
  } else if (isFutureMonth) {
    effectiveWorkingDays = totalMonthWorkingDays;
  }

  return {
    monthName,
    monthNumber,
    year,
    totalDaysInMonth,
    totalMonthWorkingDays,
    elapsedWorkingDays,
    effectiveWorkingDays,
    isCurrentMonth,
    isPastMonth,
    isFutureMonth,
    workingDates,
  };
}

/**
 * Memeriksa apakah suatu tanggal merupakan Hari Gajian (setiap tanggal 10).
 */
export function isPaydayDate(targetDate: string | Date = new Date()): boolean {
  if (!targetDate) return false;
  if (typeof targetDate === 'string') {
    const parts = targetDate.split('-');
    if (parts.length >= 3) {
      return parseInt(parts[2], 10) === 10;
    }
  }
  const d = targetDate instanceof Date ? targetDate : new Date(targetDate);
  return !isNaN(d.getTime()) && d.getDate() === 10;
}

export interface PaydayReminderInfo {
  isReminderActive: boolean;
  status: 'H-2' | 'H-1' | 'HARI_H' | null;
  daysRemaining: number;
  badgeLabel: string;
  title: string;
  message: string;
  targetPaydayDate: string;
}

/**
 * Mendapatkan status pengingat Hari Gajian (H-2, H-1, dan Hari H tanggal 10).
 */
export function getPaydayReminderInfo(
  targetDate: string | Date = new Date(),
  teacherName?: string
): PaydayReminderInfo {
  let d: Date;
  if (typeof targetDate === 'string') {
    const parts = targetDate.split('-');
    if (parts.length >= 3) {
      d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    } else {
      d = new Date(targetDate);
    }
  } else {
    d = targetDate;
  }

  if (!d || isNaN(d.getTime())) {
    return {
      isReminderActive: false,
      status: null,
      daysRemaining: 0,
      badgeLabel: '',
      title: '',
      message: '',
      targetPaydayDate: '',
    };
  }

  const dayNumber = d.getDate();
  const year = d.getFullYear();
  const monthPad = String(d.getMonth() + 1).padStart(2, '0');
  const targetPaydayDate = `${year}-${monthPad}-10`;
  const greeting = teacherName ? `Bapak/Ibu ${teacherName}` : 'Bapak/Ibu Guru & Staf';

  // H-2 Pengingat: Tanggal 8
  if (dayNumber === 8) {
    return {
      isReminderActive: true,
      status: 'H-2',
      daysRemaining: 2,
      badgeLabel: 'PENGINGAT H-2 HARI GAJIAN',
      title: '💰 Pengingat: 2 Hari Lagi Hari Gajian (Tanggal 10)',
      message: `Halo ${greeting}! 2 hari lagi (tanggal 10) adalah Hari Gajian bulanan. Tetap semangat mengajar dan selalu lakukan presensi masuk & pulang.`,
      targetPaydayDate,
    };
  }

  // H-1 Pengingat: Tanggal 9
  if (dayNumber === 9) {
    return {
      isReminderActive: true,
      status: 'H-1',
      daysRemaining: 1,
      badgeLabel: 'PENGINGAT H-1 HARI GAJIAN (BESOK)',
      title: '💰 Pengingat: Besok Hari Gajian! (Tanggal 10)',
      message: `Halo ${greeting}! Besok (tanggal 10) adalah jadwal penggajian bulanan. Tetap semangat mengajar dan jangan lupa presensi masuk & pulang.`,
      targetPaydayDate,
    };
  }

  // Hari H: Tanggal 10
  if (dayNumber === 10) {
    return {
      isReminderActive: true,
      status: 'HARI_H',
      daysRemaining: 0,
      badgeLabel: 'HARI GAJIAN TELAH TIBA',
      title: '💰 Hari Gajian Telah Tiba! (Tanggal 10)',
      message: `Selamat ${greeting}! Hari ini tanggal 10 adalah Hari Gajian Guru & Staf. Tetap semangat mengajar dan jangan lupa presensi masuk & pulang.`,
      targetPaydayDate,
    };
  }

  return {
    isReminderActive: false,
    status: null,
    daysRemaining: 0,
    badgeLabel: '',
    title: '',
    message: '',
    targetPaydayDate,
  };
}

/**
 * Menghasilkan entri kalender Hari Gajian Guru & Staf (SCHEDULE, is_holiday: false)
 * untuk setiap bulan tanggal 10 pada tahun yang ditentukan.
 */
export function generatePaydayEventsForYear(year: number = 2026): HolidayRecord[] {
  const events: HolidayRecord[] = [];
  for (let m = 1; m <= 12; m++) {
    const monthPad = String(m).padStart(2, '0');
    events.push({
      id: `hol_payday_${year}_${monthPad}`,
      date: `${year}-${monthPad}-10`,
      name: 'Hari Gajian Guru & Staf',
      type: 'OTHER' as const,
      category_type: 'SCHEDULE' as const,
      is_holiday: false,
      description: 'Penggajian bulanan dewan guru dan karyawan sekolah. Tetap masuk & presensi.',
      created_at: new Date().toISOString(),
    });
  }
  return events;
}


