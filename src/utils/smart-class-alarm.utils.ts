import type { TeachingSlot, TeacherDutySchedule } from '../types/database.types';

export interface SmartAlarmStatus {
  type: 'NO_SCHEDULE' | 'UPCOMING_10MIN' | 'CURRENTLY_TEACHING' | 'DUTY_TODAY' | 'ALL_FINISHED';
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
 * Strictly avoids fake AI dummy schedules if no slots exist.
 */
export function evaluateSmartClassAlarm(
  slots: TeachingSlot[] = [],
  dutySchedule: TeacherDutySchedule | null = null,
  nowDate: Date = new Date()
): SmartAlarmStatus {
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
  const todayName = dayNames[nowDate.getDay()];

  // Filter slots for today
  const todaySlots = slots.filter((s) => s && s.day === todayName);

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

  const currentMinutes = nowDate.getHours() * 60 + nowDate.getMinutes();

  // Helper to parse time string like "07:30 - 08:50" or "07:30-08:50"
  const parseSlotTime = (timeStr: string) => {
    try {
      const parts = timeStr.split('-').map((p) => p.trim());
      if (parts.length < 2) return null;
      const [startStr, endStr] = parts;
      const [sh, sm] = startStr.split(':').map((n) => parseInt(n, 10));
      const [eh, em] = endStr.split(':').map((n) => parseInt(n, 10));

      if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return null;

      return {
        startMin: sh * 60 + sm,
        endMin: eh * 60 + em,
        startStr,
        endStr,
      };
    } catch {
      return null;
    }
  };

  let activeSlot: TeachingSlot | undefined;
  let nextSlot: TeachingSlot | undefined;
  let minDiffToNext = Infinity;
  let minDiffRemainingInActive = 0;

  for (const slot of todaySlots) {
    const parsed = parseSlotTime(slot.time);
    if (!parsed) continue;

    // Check if currently in this slot
    if (currentMinutes >= parsed.startMin && currentMinutes < parsed.endMin) {
      activeSlot = slot;
      minDiffRemainingInActive = parsed.endMin - currentMinutes;
      break;
    }

    // Check if slot is in the future
    if (parsed.startMin > currentMinutes) {
      const diff = parsed.startMin - currentMinutes;
      if (diff < minDiffToNext) {
        minDiffToNext = diff;
        nextSlot = slot;
      }
    }
  }

  // 1. If currently teaching
  if (activeSlot) {
    return {
      type: 'CURRENTLY_TEACHING',
      currentSlot: activeSlot,
      minutesRemainingInCurrent: minDiffRemainingInActive,
      message: `📚 KBM Berlangsung: Kelas ${activeSlot.className} (${activeSlot.subject}) hingga ${activeSlot.time.split('-')[1]?.trim() || ''} WIB (Sisa ${minDiffRemainingInActive} menit).`,
      speechText: `KBM sedang berlangsung di kelas ${activeSlot.className} mata pelajaran ${activeSlot.subject}.`,
    };
  }

  // 2. If upcoming class within 10 minutes (or upcoming today)
  if (nextSlot && minDiffToNext <= 10) {
    return {
      type: 'UPCOMING_10MIN',
      upcomingSlot: nextSlot,
      minutesUntilNext: minDiffToNext,
      message: `⏰ Persiapan KBM: Jam mengajar di kelas ${nextSlot.className} (${nextSlot.subject}) akan dimulai dalam ${minDiffToNext} menit!`,
      speechText: `Bapak Ibu, jam pelajaran di kelas ${nextSlot.className} mata pelajaran ${nextSlot.subject} akan dimulai dalam ${minDiffToNext} menit. Silakan bersiap-siap.`,
    };
  }

  if (nextSlot) {
    return {
      type: 'UPCOMING_10MIN',
      upcomingSlot: nextSlot,
      minutesUntilNext: minDiffToNext,
      message: `📅 Jam mengajar berikutnya: Kelas ${nextSlot.className} (${nextSlot.subject}) pada pukul ${nextSlot.time.split('-')[0]?.trim()} WIB.`,
    };
  }

  return {
    type: 'ALL_FINISHED',
    message: `✨ Seluruh jadwal mengajar Anda untuk hari ${todayName} telah selesai. Terus berikan inspirasi terbaik!`,
    speechText: `Seluruh jam mengajar Anda hari ini telah selesai. Selamat beristirahat.`,
  };
}
