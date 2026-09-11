import type { TeachingSlot, TeachingScheduleConflictError } from '../types/database.types';

/**
 * Normalizes day of week to standard 1..7 (1 = Senin, 7 = Minggu).
 */
export function normalizeDayOfWeek(input: string | number | undefined | null): number {
  if (input === undefined || input === null) return 1;

  if (typeof input === 'number') {
    if (input >= 1 && input <= 7) return input;
    if (input === 0) return 7; // JavaScript Sunday (0) maps to 7
    return 1;
  }

  const str = String(input).trim().toLowerCase();
  switch (str) {
    case 'senin':
    case 'monday':
    case 'mon':
    case '1':
      return 1;
    case 'selasa':
    case 'tuesday':
    case 'tue':
    case '2':
      return 2;
    case 'rabu':
    case 'wednesday':
    case 'wed':
    case '3':
      return 3;
    case 'kamis':
    case 'thursday':
    case 'thu':
    case '4':
      return 4;
    case 'jumat':
    case "jum'at":
    case 'friday':
    case 'fri':
    case '5':
      return 5;
    case 'sabtu':
    case 'saturday':
    case 'sat':
    case '6':
      return 6;
    case 'minggu':
    case 'ahad':
    case 'sunday':
    case 'sun':
    case '7':
    case '0':
      return 7;
    default:
      return 1;
  }
}

/**
 * Returns standard Indonesian day name for day of week (1..7).
 */
export function getDayNameIndonesian(dayOfWeek: number): string {
  const map: Record<number, string> = {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
    7: 'Minggu',
  };
  return map[dayOfWeek] || 'Senin';
}

/**
 * Parses time string like "07:30 - 08:50" or "07.30 - 08.50" into start and end times in HH:mm.
 */
export function parseScheduleTime(timeStr: string): { startTime: string; endTime: string } | null {
  if (!timeStr) return null;
  const cleaned = String(timeStr).replace(/\./g, ':').trim();
  const parts = cleaned.split(/[-–—]/).map((p) => p.trim());
  if (parts.length < 2) return null;

  const sanitizeTime = (t: string): string | null => {
    const m = t.match(/(\d{1,2})[:.](\d{1,2})/);
    if (!m) return null;
    const hh = m[1].padStart(2, '0');
    const mm = m[2].padStart(2, '0');
    const hNum = parseInt(hh, 10);
    const mNum = parseInt(mm, 10);
    if (hNum < 0 || hNum > 23 || mNum < 0 || mNum > 59) return null;
    return `${hh}:${mm}`;
  };

  const start = sanitizeTime(parts[0]);
  const end = sanitizeTime(parts[1]);

  if (!start || !end) return null;
  return { startTime: start, endTime: end };
}

/**
 * Formats start and end times into standard "HH:mm - HH:mm" string.
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  return `${startTime.trim()} - ${endTime.trim()}`;
}

/**
 * Converts "HH:mm" or "HH:mm:ss" into total minutes from midnight.
 */
export function timeStringToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const cleaned = String(timeStr).replace(/\./g, ':').trim();
  const parts = cleaned.split(':');
  if (parts.length >= 2) {
    const hh = parseInt(parts[0], 10) || 0;
    const mm = parseInt(parts[1], 10) || 0;
    return hh * 60 + mm;
  }
  return 0;
}

/**
 * Checks if two time intervals [startA, endA) and [startB, endB) overlap.
 * Strictly checks: startA < endB && endA > startB.
 */
export function isTimeIntervalOverlapping(
  startA: string,
  endA: string,
  startB: string,
  endB: string
): boolean {
  const minStartA = timeStringToMinutes(startA);
  const minEndA = timeStringToMinutes(endA);
  const minStartB = timeStringToMinutes(startB);
  const minEndB = timeStringToMinutes(endB);

  // Invalid interval guards
  if (minEndA <= minStartA || minEndB <= minStartB) {
    return false;
  }

  return minStartA < minEndB && minEndA > minStartB;
}

/**
 * Validates schedule candidates against existing schedules for conflicts:
 * 1. Invalid time: start_time >= end_time
 * 2. Teacher overlap (same teacher cannot teach two classes at the same time)
 * 3. Class overlap (same class cannot have two teachers/subjects at the same time)
 * 4. Room overlap (same room cannot be occupied by two classes at the same time, if room specified)
 */
export function validateScheduleConflict(
  candidate: {
    id?: string;
    teacher_user_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
    class_name: string;
    room?: string;
    academic_year?: string;
  },
  existingSchedules: TeachingSlot[]
): TeachingScheduleConflictError | null {
  const candStartMin = timeStringToMinutes(candidate.start_time);
  const candEndMin = timeStringToMinutes(candidate.end_time);

  if (candStartMin >= candEndMin) {
    return {
      conflict_type: 'TEACHER',
      conflicting_schedule: {} as TeachingSlot,
      message: `Waktu selesai (${candidate.end_time}) harus lebih akhir dari waktu mulai (${candidate.start_time}).`,
    };
  }

  const candDay = normalizeDayOfWeek(candidate.day_of_week);
  const candClassName = candidate.class_name.trim().toLowerCase();
  const candRoom = candidate.room ? candidate.room.trim().toLowerCase() : '';

  for (const slot of existingSchedules) {
    // Skip self
    if (candidate.id && slot.id === candidate.id) continue;
    // Skip inactive slots
    if (slot.is_active === false) continue;

    // Check academic year if both are present
    if (
      candidate.academic_year &&
      slot.academic_year &&
      candidate.academic_year.trim() !== slot.academic_year.trim()
    ) {
      continue;
    }

    const slotDay = normalizeDayOfWeek(slot.day_of_week !== undefined ? slot.day_of_week : slot.day);
    if (slotDay !== candDay) continue;

    // Resolve slot times
    let slotStart = slot.start_time;
    let slotEnd = slot.end_time;
    if (!slotStart || !slotEnd) {
      const parsed = parseScheduleTime(slot.time);
      if (parsed) {
        slotStart = parsed.startTime;
        slotEnd = parsed.endTime;
      }
    }

    if (!slotStart || !slotEnd) continue;

    if (isTimeIntervalOverlapping(candidate.start_time, candidate.end_time, slotStart, slotEnd)) {
      const slotTimeStr = slot.time || formatTimeRange(slotStart, slotEnd);
      const slotTeacherId = slot.teacher_user_id || slot.user_id;

      // 1. Teacher Conflict
      if (slotTeacherId && candidate.teacher_user_id && slotTeacherId === candidate.teacher_user_id) {
        return {
          conflict_type: 'TEACHER',
          conflicting_schedule: slot,
          message: `Guru memiliki jadwal lain (${slot.subject} di kelas ${slot.className || slot.class_name}) pada waktu yang sama (${slotTimeStr}).`,
        };
      }

      // 2. Class Conflict
      const existingClassName = (slot.className || slot.class_name || '').trim().toLowerCase();
      if (candClassName && existingClassName && candClassName === existingClassName) {
        return {
          conflict_type: 'CLASS',
          conflicting_schedule: slot,
          message: `Kelas ${slot.className || slot.class_name} sudah memiliki jadwal (${slot.subject} bersama ${slot.teacher_name || 'guru lain'}) pada waktu yang sama (${slotTimeStr}).`,
        };
      }

      // 3. Room Conflict (ignore virtual / online / '-' rooms)
      const existingRoom = (slot.room || '').trim().toLowerCase();
      if (
        candRoom &&
        existingRoom &&
        candRoom !== 'online' &&
        candRoom !== '-' &&
        candRoom === existingRoom
      ) {
        return {
          conflict_type: 'ROOM',
          conflicting_schedule: slot,
          message: `Ruangan ${slot.room} sedang dipakai untuk ${slot.subject} (${slot.className || slot.class_name}) pada waktu yang sama (${slotTimeStr}).`,
        };
      }
    }
  }

  return null;
}

/**
 * Returns current date and time in school business timezone (Asia/Jakarta).
 */
export function getSchoolNowInJakarta(): {
  now: Date;
  dateStr: string; // YYYY-MM-DD
  timeStr: string; // HH:mm
  dayOfWeek: number; // 1 = Senin .. 7 = Minggu
  dayName: string; // Indonesian day name
  minutesNow: number;
} {
  const now = new Date();

  // Format parts using Asia/Jakarta timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(now);
  const partMap: Record<string, string> = {};
  for (const p of parts) {
    partMap[p.type] = p.value;
  }

  const year = partMap.year || '1970';
  const month = partMap.month || '01';
  const day = partMap.day || '01';
  let hour = partMap.hour || '00';
  if (hour === '24') hour = '00';
  const minute = partMap.minute || '00';

  const dateStr = `${year}-${month}-${day}`;
  const timeStr = `${hour}:${minute}`;
  const minutesNow = (parseInt(hour, 10) || 0) * 60 + (parseInt(minute, 10) || 0);

  // Accurate day of week for Jakarta
  const jakartaDate = new Date(`${dateStr}T${timeStr}:00+07:00`);
  const jsDay = jakartaDate.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
  const dayOfWeek = jsDay === 0 ? 7 : jsDay;
  const dayName = getDayNameIndonesian(dayOfWeek);

  return {
    now: jakartaDate,
    dateStr,
    timeStr,
    dayOfWeek,
    dayName,
    minutesNow,
  };
}

/**
 * Deterministically sorts teaching slots:
 * 1. day_of_week asc (1..7)
 * 2. start_time asc
 * 3. class_name asc
 */
export function sortTeachingSlots(slots: TeachingSlot[]): TeachingSlot[] {
  return [...slots].sort((a, b) => {
    const dayA = normalizeDayOfWeek(a.day_of_week !== undefined ? a.day_of_week : a.day);
    const dayB = normalizeDayOfWeek(b.day_of_week !== undefined ? b.day_of_week : b.day);
    if (dayA !== dayB) return dayA - dayB;

    const startA = a.start_time || parseScheduleTime(a.time)?.startTime || '00:00';
    const startB = b.start_time || parseScheduleTime(b.time)?.startTime || '00:00';
    const minA = timeStringToMinutes(startA);
    const minB = timeStringToMinutes(startB);
    if (minA !== minB) return minA - minB;

    const classA = a.className || a.class_name || '';
    const classB = b.className || b.class_name || '';
    return classA.localeCompare(classB);
  });
}
