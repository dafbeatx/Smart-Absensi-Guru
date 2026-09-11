import type { TeachingSlot, TeacherDutySchedule } from '../types/database.types';
import {
  normalizeDayOfWeek,
  getDayNameIndonesian,
  parseScheduleTime,
  timeStringToMinutes,
  getSchoolNowInJakarta,
} from './teaching-schedule.utils';

export interface SmartAlarmStatus {
  type: 'NO_SCHEDULE' | 'UPCOMING' | 'UPCOMING_10MIN' | 'CURRENTLY_TEACHING' | 'DUTY_TODAY' | 'ALL_FINISHED';
  currentSlot?: TeachingSlot;
  upcomingSlot?: TeachingSlot;
  minutesUntilNext?: number;
  minutesRemainingInCurrent?: number;
  message: string;
  speechText?: string;
  dutyNotes?: string;
}

/**
 * Evaluates real-time teaching slots & duty schedules for the logged in teacher.
 * Strictly avoids fake dummy schedules if no slots exist.
 * Uses school business time (Asia/Jakarta) when nowDate is not explicitly passed.
 */
export function evaluateSmartClassAlarm(
  slots: TeachingSlot[] = [],
  dutySchedule: TeacherDutySchedule | null = null,
  nowDate?: Date
): SmartAlarmStatus {
  const jakartaInfo = getSchoolNowInJakarta();

  let targetDayOfWeek: number;
  let currentMinutes: number;
  let todayName: string;

  if (nowDate) {
    const jsDay = nowDate.getDay();
    targetDayOfWeek = jsDay === 0 ? 7 : jsDay;
    todayName = getDayNameIndonesian(targetDayOfWeek);
    currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();
  } else {
    targetDayOfWeek = jakartaInfo.dayOfWeek;
    todayName = jakartaInfo.dayName;
    currentMinutes = jakartaInfo.minutesNow;
  }

  // Filter slots for today (active only)
  const todaySlots = slots.filter((s) => {
    if (!s) return false;
    if (s.is_active === false) return false;
    const slotDay = normalizeDayOfWeek(s.day_of_week !== undefined ? s.day_of_week : s.day);
    return slotDay === targetDayOfWeek;
  });

  if (todaySlots.length === 0) {
    if (dutySchedule) {
      return {
        type: 'DUTY_TODAY',
        dutyNotes: dutySchedule.notes,
        message: `🛡️ Hari ini Anda bertugas sebagai Guru Piket (${todayName}). Sambut siswa & bina ketertiban sekolah!`,
        speechText: `Bapak Ibu Guru, hari ini Anda bertugas sebagai Guru Piket. Selamat bertugas!`,
      };
    }

    return {
      type: 'NO_SCHEDULE',
      message: `Belum ada jadwal mengajar terdaftar untuk Anda pada hari ${todayName}.`,
    };
  }

  let activeSlot: TeachingSlot | undefined;
  let nextSlot: TeachingSlot | undefined;
  let minDiffToNext = Infinity;
  let minDiffRemainingInActive = 0;

  for (const slot of todaySlots) {
    let startMin: number;
    let endMin: number;

    if (slot.start_time && slot.end_time) {
      startMin = timeStringToMinutes(slot.start_time);
      endMin = timeStringToMinutes(slot.end_time);
    } else {
      const parsed = parseScheduleTime(slot.time);
      if (!parsed) continue;
      startMin = timeStringToMinutes(parsed.startTime);
      endMin = timeStringToMinutes(parsed.endTime);
    }

    if (endMin <= startMin) continue;

    // Check if currently teaching in this slot [startMin, endMin)
    if (currentMinutes >= startMin && currentMinutes < endMin) {
      activeSlot = slot;
      minDiffRemainingInActive = endMin - currentMinutes;
      break;
    }

    // Check if slot is upcoming today
    if (startMin > currentMinutes) {
      const diff = startMin - currentMinutes;
      if (diff < minDiffToNext) {
        minDiffToNext = diff;
        nextSlot = slot;
      }
    }
  }

  // 1. Currently teaching
  if (activeSlot) {
    const endDisplay =
      activeSlot.end_time || parseScheduleTime(activeSlot.time)?.endTime || '';
    const className = activeSlot.className || activeSlot.class_name || '';
    return {
      type: 'CURRENTLY_TEACHING',
      currentSlot: activeSlot,
      minutesRemainingInCurrent: minDiffRemainingInActive,
      message: `📚 KBM Berlangsung: Kelas ${className} (${activeSlot.subject}) hingga ${endDisplay} WIB (Sisa ${minDiffRemainingInActive} menit).`,
      speechText: `KBM sedang berlangsung di kelas ${className} mata pelajaran ${activeSlot.subject}.`,
    };
  }

  // 2. Upcoming class within 10 minutes (1 <= minDiffToNext <= 10)
  if (nextSlot && minDiffToNext <= 10) {
    const className = nextSlot.className || nextSlot.class_name || '';
    return {
      type: 'UPCOMING_10MIN',
      upcomingSlot: nextSlot,
      minutesUntilNext: minDiffToNext,
      message: `⏰ Persiapan KBM: Jam mengajar di kelas ${className} (${nextSlot.subject}) akan dimulai dalam ${minDiffToNext} menit!`,
      speechText: `Bapak Ibu, jam pelajaran di kelas ${className} mata pelajaran ${nextSlot.subject} akan dimulai dalam ${minDiffToNext} menit. Silakan bersiap-siap.`,
    };
  }

  // 3. Upcoming class later today (> 10 minutes)
  if (nextSlot) {
    const startDisplay =
      nextSlot.start_time || parseScheduleTime(nextSlot.time)?.startTime || '';
    const className = nextSlot.className || nextSlot.class_name || '';
    return {
      type: 'UPCOMING',
      upcomingSlot: nextSlot,
      minutesUntilNext: minDiffToNext,
      message: `📅 Jam mengajar berikutnya: Kelas ${className} (${nextSlot.subject}) pada pukul ${startDisplay} WIB.`,
    };
  }

  // 4. All finished today
  return {
    type: 'ALL_FINISHED',
    message: `✨ Seluruh jadwal mengajar Anda untuk hari ${todayName} telah selesai. Terus berikan inspirasi terbaik!`,
    speechText: `Seluruh jam mengajar Anda hari ini telah selesai. Selamat beristirahat.`,
  };
}
