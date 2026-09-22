/**
 * SMART ABSENSI GURU — EXAM MATRIX BUILDER SERVICE
 * Transforms raw exam and proctor schedules into the official Indonesian school
 * invigilation matrix format (Matriks Jadwal Pengawas & Legenda Kode Pengawas).
 */

import type { ExamScheduleData, ExamProctorItem } from '../types/exam-schedule.types';
import type { UserProfile } from '../types/database.types';
import { ExamSchedulerService } from './exam-scheduler.service';

export interface TeacherLegendItem {
  no: number;
  userId: string;
  fullName: string;
  subject: string;
  code: string; // "01", "02", ...
}

export interface MatrixSessionRow {
  sessionNumber: number;
  timeRange: string; // e.g. "08.00 - 09.30"
  subjectNumber: number; // e.g. 1, 2, 3
  subjectTitle: string; // e.g. "PAI & BP"
  roomCodes: Record<string, string>; // roomKey -> "02"
}

export interface MatrixDayGroup {
  dayNumber: number; // 1, 2, 3...
  date: string; // "2026-06-01"
  dayFormatted: string; // "Senin, 1 Juni 2026"
  sessions: MatrixSessionRow[];
}

export interface ExamInvigilationMatrix {
  title: string;
  subTitle: string;
  institutionName: string;
  rooms: Array<{ key: string; label: string }>; // e.g. [{ key: 'Ruang 1', label: 'R 01' }, ...]
  days: MatrixDayGroup[];
  teacherLegend: TeacherLegendItem[];
}

export class ExamMatrixBuilderService {
  /**
   * Format ISO date string into Indonesian formal day format:
   * e.g. "2026-06-01" -> "Senin, 1 Juni 2026"
   */
  public static formatIndonesianDate(dateStr: string): string {
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return dateStr;

      const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', "Jum'at", 'Sabtu'];
      const months = [
        'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
        'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
      ];

      const dayName = days[d.getDay()];
      const dayNum = d.getDate();
      const monthName = months[d.getMonth()];
      const year = d.getFullYear();

      return `${dayName}, ${dayNum} ${monthName} ${year}`;
    } catch {
      return dateStr;
    }
  }

  /**
   * Normalize time format to dot notation: "08:00 - 09:30" -> "08.00 - 09.30"
   */
  public static formatTimeRange(start: string, end: string): string {
    const s = (start || '07:30').replace(':', '.');
    const e = (end || '09:00').replace(':', '.');
    return `${s} - ${e}`;
  }

  /**
   * Builds the complete official matrix representation matching the school layout.
   */
  public static buildMatrix(
    scheduleData: ExamScheduleData,
    allTeachers: UserProfile[],
    institutionNameOverride?: string
  ): ExamInvigilationMatrix {
    const { config, proctorSchedules } = scheduleData;

    const institutionName = institutionNameOverride || 'SMP TERPADU AL - ITTIHADIYAH';
    const examName = config.examType === 'ASAS'
      ? 'ASESMEN SUMATIF AKHIR SEMESTER (ASAS)'
      : config.examType === 'ASTS'
      ? 'ASESMEN SUMATIF TENGAH SEMESTER (ASTS)'
      : config.examTitle || `UJIAN ${config.examType}`;

    const subTitle = `${examName} ${config.semester ? config.semester.toUpperCase() : 'GENAP'}`;

    // ── 1. GATHER ALL DISTINCT TEACHERS ASSIGNED AS PROCTORS ──────────────────
    const teacherMap = new Map<string, { userId: string; fullName: string; subject: string }>();

    // Index all teachers from profile list for rich metadata (teaching assignment)
    const teacherProfileMap = new Map<string, UserProfile>();
    allTeachers.forEach((t) => {
      teacherProfileMap.set(t.id, t);
      if (t.full_name) {
        teacherProfileMap.set(t.full_name.toLowerCase().trim(), t);
        teacherProfileMap.set(ExamSchedulerService.normalizeTeacherName(t.full_name), t);
      }
    });

    // Extract proctors from assignments
    proctorSchedules.forEach((p) => {
      if (p.mainProctorId && p.mainProctorName) {
        if (!teacherMap.has(p.mainProctorId)) {
          const profile =
            teacherProfileMap.get(p.mainProctorId) ||
            teacherProfileMap.get(p.mainProctorName.toLowerCase().trim()) ||
            teacherProfileMap.get(ExamSchedulerService.normalizeTeacherName(p.mainProctorName));
          let subject = '-';
          if (profile?.teaching_assignment) {
            subject = Array.isArray(profile.teaching_assignment)
              ? profile.teaching_assignment.join(', ')
              : String(profile.teaching_assignment);
          }
          teacherMap.set(p.mainProctorId, {
            userId: p.mainProctorId,
            fullName: p.mainProctorName,
            subject,
          });
        }
      }
    });

    // If proctors are few, populate with selected teachers
    if (teacherMap.size < (config.selectedTeacherIds?.length || 0)) {
      config.selectedTeacherIds.forEach((tId) => {
        if (!teacherMap.has(tId)) {
          const profile = teacherProfileMap.get(tId);
          if (profile) {
            let subject = '-';
            if (profile.teaching_assignment) {
              subject = Array.isArray(profile.teaching_assignment)
                ? profile.teaching_assignment.join(', ')
                : String(profile.teaching_assignment);
            }
            teacherMap.set(tId, {
              userId: tId,
              fullName: profile.full_name || 'Guru',
              subject,
            });
          }
        }
      });
    }

    // Sort teachers alphabetically by full name
    const sortedTeachers = Array.from(teacherMap.values()).sort((a, b) =>
      a.fullName.localeCompare(b.fullName)
    );

    // Assign sequential 2-digit code: "01", "02", ...
    const teacherCodeMap = new Map<string, string>(); // userId -> code
    const teacherLegend: TeacherLegendItem[] = sortedTeachers.map((t, idx) => {
      const code = String(idx + 1).padStart(2, '0');
      teacherCodeMap.set(t.userId, code);
      teacherCodeMap.set(t.fullName.toLowerCase().trim(), code);
      return {
        no: idx + 1,
        userId: t.userId,
        fullName: t.fullName,
        subject: t.subject || '-',
        code,
      };
    });

    // ── 2. DETERMINE DISTINCT ROOMS ──────────────────────────────────────────
    // Extract unique rooms from proctor schedules or config
    const roomSet = new Set<string>();
    proctorSchedules.forEach((p) => {
      if (p.roomName) roomSet.add(p.roomName);
    });

    // Fallback if no proctors yet
    const totalRooms = Math.max(1, config.totalRooms || roomSet.size || config.selectedClasses.length || 1);
    if (roomSet.size === 0) {
      for (let i = 1; i <= totalRooms; i++) {
        roomSet.add(`Ruang ${i}`);
      }
    }

    // Sort rooms naturally (Ruang 1, Ruang 2, ..., Ruang 10)
    const sortedRooms = Array.from(roomSet).sort((a, b) => {
      const numA = parseInt(a.replace(/[^\d]/g, ''), 10) || 0;
      const numB = parseInt(b.replace(/[^\d]/g, ''), 10) || 0;
      if (numA !== numB) return numA - numB;
      return a.localeCompare(b);
    });

    // Label rooms as "R 01", "R 02", etc. as seen in the official school paper
    const rooms: Array<{ key: string; label: string }> = sortedRooms.map((roomKey, idx) => {
      const num = parseInt(roomKey.replace(/[^\d]/g, ''), 10) || (idx + 1);
      const label = `R ${String(num).padStart(2, '0')}`;
      return {
        key: roomKey,
        label,
      };
    });

    // ── 3. BUILD MATRIX BY DAY AND SESSIONS ──────────────────────────────────
    // Group proctor items by date
    const dateMap = new Map<string, ExamProctorItem[]>();
    proctorSchedules.forEach((p) => {
      const list = dateMap.get(p.date) || [];
      list.push(p);
      dateMap.set(p.date, list);
    });

    const sortedDates = Array.from(dateMap.keys()).sort();
    const days: MatrixDayGroup[] = [];

    sortedDates.forEach((dateStr, dayIdx) => {
      const proctorsOnDate = dateMap.get(dateStr) || [];
      const dayFormatted = this.formatIndonesianDate(dateStr);

      // Group by session number
      const sessionMap = new Map<number, ExamProctorItem[]>();
      proctorsOnDate.forEach((p) => {
        const list = sessionMap.get(p.sessionNumber) || [];
        list.push(p);
        sessionMap.set(p.sessionNumber, list);
      });

      const sortedSessions = Array.from(sessionMap.keys()).sort((a, b) => a - b);
      const sessionRows: MatrixSessionRow[] = [];

      sortedSessions.forEach((sNum) => {
        const items = sessionMap.get(sNum) || [];
        const first = items[0];
        const timeRange = this.formatTimeRange(first.startTime, first.endTime);
        const subjectTitle = first.subject || 'Mata Pelajaran';

        // Map each room to teacher code
        const roomCodes: Record<string, string> = {};
        rooms.forEach((r) => {
          // Find matching proctor for this room
          const match = items.find((item) => item.roomName === r.key);
          if (match) {
            const code = teacherCodeMap.get(match.mainProctorId) ||
                         teacherCodeMap.get(match.mainProctorName.toLowerCase().trim()) ||
                         '-';
            roomCodes[r.key] = code;
          } else {
            roomCodes[r.key] = '-';
          }
        });

        sessionRows.push({
          sessionNumber: sNum,
          timeRange,
          subjectNumber: sNum,
          subjectTitle,
          roomCodes,
        });
      });

      days.push({
        dayNumber: dayIdx + 1,
        date: dateStr,
        dayFormatted,
        sessions: sessionRows,
      });
    });

    return {
      title: 'JADWAL PENGAWAS',
      subTitle,
      institutionName,
      rooms,
      days,
      teacherLegend,
    };
  }
}
