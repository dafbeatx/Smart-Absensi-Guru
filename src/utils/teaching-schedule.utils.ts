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
 * Normalizes class names.
 * In accordance with school policy:
 * Grade 7 is unified strictly into "Kelas VII" (no VII-A/VII-B/7A/7B split).
 */
export function normalizeClassName(rawName?: string | null): string {
  if (!rawName) return '';
  const trimmed = rawName.trim();
  if (!trimmed) return '';

  const clean = trimmed
    .replace(/^kelas\s+/i, '')
    .trim()
    .toUpperCase();

  // Grade 7 / VII unification: "untuk kelas 7 jadikan kelas VII saja"
  if (/^(7|VII)([-_\s]*[AB])?$/i.test(clean)) {
    return 'Kelas VII';
  }

  // Grade 8 / VIII
  if (/^(8|VIII)[-_\s]*A$/i.test(clean)) return 'Kelas VIII-A';
  if (/^(8|VIII)[-_\s]*B$/i.test(clean)) return 'Kelas VIII-B';
  if (/^(8|VIII)$/i.test(clean)) return 'Kelas VIII';

  // Grade 9 / IX
  if (/^(9|IX)[-_\s]*A$/i.test(clean)) return 'Kelas IX-A';
  if (/^(9|IX)[-_\s]*B$/i.test(clean)) return 'Kelas IX-B';
  if (/^(9|IX)$/i.test(clean)) return 'Kelas IX';

  if (!/^kelas\s+/i.test(trimmed)) {
    return `Kelas ${trimmed}`;
  }
  return trimmed;
}

/**
 * Determines whether a room designation is a generic homeroom/classroom indicator
 * that should NOT cause room conflict across different classes.
 * Specific shared facilities (Lab, Lapangan, Aula, Perpustakaan, Masjid) WILL trigger room conflicts.
 */
export function isGenericClassroom(room?: string | null): boolean {
  if (!room) return true;
  const r = room.trim().toLowerCase();
  return (
    r === '' ||
    r === '-' ||
    r === 'online' ||
    r === 'ruang kelas' ||
    r === 'kelas' ||
    r === 'ruang teori' ||
    r === 'ruang belajar'
  );
}

/**
 * Sanitizes "HH:mm:ss" or "HH:mm" to canonical "HH:mm".
 */
export function sanitizeTimeString(t?: string | null): string {
  if (!t) return '08:00';
  const clean = String(t).trim().replace(/\./g, ':');
  const m = clean.match(/\b(\d{1,2}):(\d{2})/);
  if (!m) return clean;
  const hh = String(parseInt(m[1], 10)).padStart(2, '0');
  const mm = m[2];
  return `${hh}:${mm}`;
}

/**
 * Official School Recess / Break Time configuration.
 */
export const SCHOOL_BREAK_TIME = {
  start: '09:30',
  end: '10:00',
  label: '09:30 - 10:00 WIB',
};

/**
 * Parses time string like "08:00 - 08:40", "08.00 - 08.40", or "Jam 1-2 (08:00 - 09:20)"
 * into start and end times in HH:mm.
 */
export function parseScheduleTime(timeStr: string): { startTime: string; endTime: string } | null {
  if (!timeStr) return null;
  const str = String(timeStr).trim();

  // Find all HH:mm matches (supports : or .)
  const timeRegex = /\b(\d{1,2})[:.](\d{2})\b/g;
  const matches = [...str.matchAll(timeRegex)];

  if (matches.length >= 2) {
    const formatMatch = (m: RegExpMatchArray): string | null => {
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    const start = formatMatch(matches[0]);
    const end = formatMatch(matches[1]);
    if (start && end) {
      return { startTime: start, endTime: end };
    }
  }

  // Fallback: split by dash/range separators
  const cleaned = str.replace(/\./g, ':');
  const parts = cleaned.split(/[-–—]/).map((p) => p.trim());
  if (parts.length >= 2) {
    const sanitizeTime = (t: string): string | null => {
      const m = t.match(/(\d{1,2})[:.](\d{1,2})/);
      if (!m) return null;
      const hh = parseInt(m[1], 10);
      const mm = parseInt(m[2], 10);
      if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
      return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    };

    const start = sanitizeTime(parts[0]);
    const end = sanitizeTime(parts[parts.length - 1]);
    if (start && end) {
      return { startTime: start, endTime: end };
    }
  }

  return null;
}

/**
 * Formats start and end times into standard "HH:mm - HH:mm" string (strips seconds).
 */
export function formatTimeRange(startTime: string, endTime: string): string {
  const start = sanitizeTimeString(startTime);
  const end = sanitizeTimeString(endTime);
  return `${start} - ${end}`;
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
 * 2. Official Break Time Guard (09:30 - 10:00 WIB)
 * 3. Teacher overlap (same teacher cannot teach two classes at the same time)
 * 4. Class overlap (same class cannot have two teachers/subjects at the same time)
 * 5. Room overlap (shared facilities cannot be occupied by two classes at the same time)
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
      message: `Waktu selesai (${sanitizeTimeString(candidate.end_time)}) harus lebih akhir dari waktu mulai (${sanitizeTimeString(candidate.start_time)}).`,
    };
  }

  const candDay = normalizeDayOfWeek(candidate.day_of_week);
  const candClassName = normalizeClassName(candidate.class_name).toLowerCase();
  const candRoom = candidate.room ? candidate.room.trim().toLowerCase() : '';

  // 1. Guard against scheduling inside Official School Recess (Senin - Jumat 09:30 - 10:00)
  if (candDay >= 1 && candDay <= 5) {
    const candStartMin = timeStringToMinutes(candidate.start_time);
    const candEndMin = timeStringToMinutes(candidate.end_time);
    const breakStartMin = timeStringToMinutes(SCHOOL_BREAK_TIME.start); // 09:30
    const breakEndMin = timeStringToMinutes(SCHOOL_BREAK_TIME.end); // 10:00

    const isInsideBreak =
      (candStartMin >= breakStartMin && candStartMin < breakEndMin) ||
      (candEndMin > breakStartMin && candEndMin <= breakEndMin);

    if (isInsideBreak) {
      return {
        conflict_type: 'BREAK_TIME',
        conflicting_schedule: {} as TeachingSlot,
        message: `Waktu KBM (${formatTimeRange(candidate.start_time, candidate.end_time)}) bertabrakan dengan Jam Istirahat Resmi Sekolah (${SCHOOL_BREAK_TIME.label}). KBM tidak dapat dijadwalkan pada waktu istirahat.`,
      };
    }
  }

  for (const slot of existingSchedules) {
    // Skip self (normalized ID comparison)
    if (candidate.id && slot.id && String(slot.id).trim().toLowerCase() === String(candidate.id).trim().toLowerCase()) {
      continue;
    }
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

    const rawSlotDay = slot.day_of_week != null ? slot.day_of_week : slot.day;
    const slotDay = normalizeDayOfWeek(rawSlotDay);
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
      const slotTimeStr = slot.time ? slot.time.replace(/:\d{2}\b/g, '') : formatTimeRange(slotStart, slotEnd);
      const slotTeacherId = slot.teacher_user_id || slot.user_id;

      // 1. Teacher Conflict (same teacher cannot teach two classes at the same time)
      if (slotTeacherId && candidate.teacher_user_id && slotTeacherId.trim().toLowerCase() === candidate.teacher_user_id.trim().toLowerCase()) {
        return {
          conflict_type: 'TEACHER',
          conflicting_schedule: slot,
          message: `Guru memiliki jadwal lain (${slot.subject} di kelas ${slot.className || slot.class_name}) pada waktu yang sama (${slotTimeStr}).`,
        };
      }

      // 2. Class Conflict (same class cannot have two teachers/subjects at the same time)
      const existingClassName = normalizeClassName(slot.className || slot.class_name || '').toLowerCase();
      if (candClassName && existingClassName && candClassName === existingClassName) {
        const displayClassName = slot.className || slot.class_name || candidate.class_name;
        const cleanName = displayClassName.startsWith('Kelas') ? displayClassName : `Kelas ${displayClassName}`;
        return {
          conflict_type: 'CLASS',
          conflicting_schedule: slot,
          message: `${cleanName} sudah memiliki jadwal (${slot.subject} bersama ${slot.teacher_name || 'guru lain'}) pada waktu yang sama (${slotTimeStr}).`,
        };
      }

      // 3. Room Conflict (ignore virtual / regular homeroom classrooms to prevent false alarms across classes)
      const existingRoom = (slot.room || '').trim().toLowerCase();
      if (
        candRoom &&
        existingRoom &&
        !isGenericClassroom(candRoom) &&
        !isGenericClassroom(existingRoom) &&
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
