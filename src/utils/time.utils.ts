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
 * If check-in time is strictly greater than checkinEnd (default 07:15), returns 'TERLAMBAT'.
 */
export function evaluateAttendanceStatus(
  checkInTime: string | null | undefined,
  checkinEnd: string = '07:15',
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
  holidays?: Array<{ date: string; name: string }> | null
): { isOff: boolean; reason: string } {
  const d = typeof targetDate === 'string' ? new Date(targetDate) : targetDate;
  if (isNaN(d.getTime())) {
    return { isOff: false, reason: '' };
  }

  const dateIso = d.toISOString().substring(0, 10);

  // 1. Check explicit holiday record first
  if (holidays && holidays.length > 0) {
    const matchedHoliday = holidays.find((h) => h.date === dateIso);
    if (matchedHoliday) {
      return { isOff: true, reason: `Hari Libur: ${matchedHoliday.name}` };
    }
  }

  // 2. Check weekend settings (defaulting saturday_is_holiday=true, sunday_is_holiday=true)
  const day = d.getDay(); // 0 = Sunday, 6 = Saturday
  const saturdayLibur = settings?.saturday_is_holiday ?? true;
  const sundayLibur = settings?.sunday_is_holiday ?? true;

  if (day === 6 && saturdayLibur) {
    return { isOff: true, reason: 'Libur Akhir Pekan (Sabtu)' };
  }
  if (day === 0 && sundayLibur) {
    return { isOff: true, reason: 'Libur Akhir Pekan (Minggu)' };
  }

  return { isOff: false, reason: '' };
}


