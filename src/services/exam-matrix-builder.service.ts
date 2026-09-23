/**
 * SMART ABSENSI GURU — EXAM MATRIX BUILDER SERVICE
 * Transforms raw exam and proctor schedules into the official Indonesian school
 * invigilation matrix format (Matriks Jadwal Pengawas & Legenda Kode Pengawas).
 */

import type { ExamScheduleData, ExamProctorItem, ExamSubjectScheduleItem } from '../types/exam-schedule.types';
import type { UserProfile } from '../types/database.types';
import { ExamSchedulerService } from './exam-scheduler.service';
import { normalizeSubjectName } from '../config/school-subjects.config';

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
   * Resolves a teacher's subject with multi-tier resilience:
   * 1. Profile teaching_assignment (single or array)
   * 2. Profile position (e.g. "Guru Mapel IPA", "Guru Mapel Akhlak lil Banin")
   * 3. Substring match across allTeachers list
   * 4. Cached teaching schedules from localStorage
   * 5. Canonical school faculty dictionary (Widianingsih -> IPA, Ridho -> Akhlak lil Banin, etc.)
   * 6. Formats output with canonical official school subject labels (e.g. "IPA – Ilmu Pengetahuan Alam")
   */
  public static resolveTeacherSubject(
    profile: UserProfile | undefined,
    teacherName: string,
    allTeachers: UserProfile[] = []
  ): string {
    let rawSubject = '';

    // 1. Explicit teaching_assignment in profile
    if (profile?.teaching_assignment) {
      rawSubject = Array.isArray(profile.teaching_assignment)
        ? profile.teaching_assignment.join(', ')
        : String(profile.teaching_assignment).trim();
    }

    // 2. Extract from position (e.g. "Guru Mapel IPA", "Guru Mapel Akhlak lil Banin")
    if (!rawSubject && profile?.position) {
      const pos = profile.position.trim();
      const posMatch = pos.match(/guru\s+(?:mapel\s+|mata\s+pelajaran\s+|bidang\s+studi\s+)?(.+)/i);
      if (posMatch && posMatch[1]) {
        const candidate = posMatch[1].trim();
        if (!/^(utama|pendidik|honorer|tetap|piket|wali\s+kelas|kelas)/i.test(candidate)) {
          rawSubject = candidate;
        }
      }
    }

    // 3. Fallback: Search allTeachers if profile had no subject or was not found
    if (!rawSubject && allTeachers.length > 0) {
      const normTarget = ExamSchedulerService.normalizeTeacherName(teacherName);
      const matched = allTeachers.find((t) => {
        if (!t.full_name) return false;
        const norm = ExamSchedulerService.normalizeTeacherName(t.full_name);
        return norm === normTarget || (norm.length >= 4 && (norm.includes(normTarget) || normTarget.includes(norm)));
      });
      if (matched) {
        if (matched.teaching_assignment) {
          rawSubject = Array.isArray(matched.teaching_assignment)
            ? matched.teaching_assignment.join(', ')
            : String(matched.teaching_assignment).trim();
        } else if (matched.position) {
          const posMatch = matched.position.match(/guru\s+(?:mapel\s+|mata\s+pelajaran\s+|bidang\s+studi\s+)?(.+)/i);
          if (posMatch && posMatch[1] && !/^(utama|pendidik|honorer|tetap|piket|wali\s+kelas|kelas)/i.test(posMatch[1].trim())) {
            rawSubject = posMatch[1].trim();
          }
        }
      }
    }

    // 4. Cached teaching schedules from localStorage
    if (!rawSubject && typeof window !== 'undefined' && window.localStorage) {
      try {
        const cached = localStorage.getItem('smart_absensi_teaching_schedules');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            const normTarget = ExamSchedulerService.normalizeTeacherName(teacherName);
            const slot = parsed.find((s: any) => {
              if (profile?.id && (s.teacher_id === profile.id || s.user_id === profile.id)) return true;
              const slotTeacherNorm = ExamSchedulerService.normalizeTeacherName(s.teacher_name || s.teacher || '');
              return slotTeacherNorm && (slotTeacherNorm === normTarget || normTarget.includes(slotTeacherNorm));
            });
            if (slot && (slot.subject || slot.subject_name)) {
              rawSubject = (slot.subject || slot.subject_name).trim();
            }
          }
        }
      } catch {}
    }

    // 5. Canonical school faculty map fallback
    if (!rawSubject) {
      const norm = ExamSchedulerService.normalizeTeacherName(teacherName);
      if (norm.includes('widianingsih') || norm.includes('widia')) {
        rawSubject = 'IPA';
      } else if (norm.includes('ridho') || norm.includes('farizi')) {
        rawSubject = 'Akhlak lil Banin';
      } else if (norm.includes('fitri ani') || norm.includes('rahayu')) {
        rawSubject = 'MTK';
      } else if (norm.includes('iqbal') || norm.includes('gustiawan')) {
        rawSubject = 'Hadits';
      } else if (norm.includes('mawar') || norm.includes('andinia')) {
        rawSubject = 'BTQ';
      } else if (norm.includes('mira') || norm.includes('nurdianti')) {
        rawSubject = 'B. Arab, PAI';
      } else if (norm.includes('nurul') || norm.includes('farhiya') || norm.includes('fahriya')) {
        rawSubject = 'PP';
      } else if (norm.includes('qodiatul') || norm.includes('asrof') || norm.includes('ramadhoni')) {
        rawSubject = 'IPS';
      } else if (norm.includes('septi') || norm.includes('nur aeni')) {
        rawSubject = 'B. Indonesia';
      } else if (norm.includes('dafa') || norm.includes('maulana')) {
        rawSubject = 'Informatika';
      } else if (norm.includes('adi') || norm.includes('prasetyo')) {
        rawSubject = 'B. Inggris';
      }
    }

    if (!rawSubject || rawSubject === '-') return '-';

    // 6. Normalize with official school subject labels
    const parts = rawSubject.split(/[,&/]/).map((p) => p.trim()).filter(Boolean);
    if (parts.length > 1) {
      return parts.map((p) => normalizeSubjectName(p) || p).join(', ');
    }

    return normalizeSubjectName(rawSubject) || rawSubject;
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

    const institutionName =
      institutionNameOverride ||
      (config.educationLevel === 'SMA' ? 'SMA TERPADU AS SALAAM' : 'SMP TERPADU AL - ITTIHADIYAH');
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

    const findProfile = (id?: string, name?: string): UserProfile | undefined => {
      if (id && teacherProfileMap.has(id)) return teacherProfileMap.get(id);
      if (name) {
        const lower = name.toLowerCase().trim();
        if (teacherProfileMap.has(lower)) return teacherProfileMap.get(lower);
        const norm = ExamSchedulerService.normalizeTeacherName(name);
        if (teacherProfileMap.has(norm)) return teacherProfileMap.get(norm);

        const matched = allTeachers.find((t) => {
          if (!t.full_name) return false;
          const tNorm = ExamSchedulerService.normalizeTeacherName(t.full_name);
          return (
            (tNorm.length >= 3 && norm.length >= 3 && (tNorm.includes(norm) || norm.includes(tNorm))) ||
            t.full_name.toLowerCase().includes(lower) ||
            lower.includes(t.full_name.toLowerCase())
          );
        });
        if (matched) return matched;
      }
      return undefined;
    };

    // Extract proctors from actual assignments (main and secondary proctors)
    proctorSchedules.forEach((p) => {
      if (p.mainProctorId && p.mainProctorName) {
        if (!teacherMap.has(p.mainProctorId)) {
          const profile = findProfile(p.mainProctorId, p.mainProctorName);
          const subject = this.resolveTeacherSubject(profile, p.mainProctorName, allTeachers);
          teacherMap.set(p.mainProctorId, {
            userId: p.mainProctorId,
            fullName: p.mainProctorName,
            subject,
          });
        }
      }

      if (p.secondaryProctorId && p.secondaryProctorName) {
        if (!teacherMap.has(p.secondaryProctorId)) {
          const profile = findProfile(p.secondaryProctorId, p.secondaryProctorName);
          const subject = this.resolveTeacherSubject(profile, p.secondaryProctorName, allTeachers);
          teacherMap.set(p.secondaryProctorId, {
            userId: p.secondaryProctorId,
            fullName: p.secondaryProctorName,
            subject,
          });
        }
      }
    });

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

    if (sortedDates.length === 0 && scheduleData.subjectSchedules && scheduleData.subjectSchedules.length > 0) {
      // Fallback when proctor schedules are omitted: construct timetable structure from subject schedules
      const subjDateMap = new Map<string, ExamSubjectScheduleItem[]>();
      scheduleData.subjectSchedules.forEach((s) => {
        const list = subjDateMap.get(s.date) || [];
        list.push(s);
        subjDateMap.set(s.date, list);
      });

      const sortedSubjDates = Array.from(subjDateMap.keys()).sort();
      sortedSubjDates.forEach((dateStr, dayIdx) => {
        const subjsOnDate = subjDateMap.get(dateStr) || [];
        const dayFormatted = this.formatIndonesianDate(dateStr);

        const sessionMap = new Map<number, ExamSubjectScheduleItem[]>();
        subjsOnDate.forEach((s) => {
          const list = sessionMap.get(s.sessionNumber) || [];
          list.push(s);
          sessionMap.set(s.sessionNumber, list);
        });

        const sortedSessions = Array.from(sessionMap.keys()).sort((a, b) => a - b);
        const sessionRows: MatrixSessionRow[] = [];

        sortedSessions.forEach((sNum) => {
          const items = sessionMap.get(sNum) || [];
          const first = items[0];
          const timeRange = this.formatTimeRange(first.startTime, first.endTime);
          const subjectTitle = first.subject || 'Mata Pelajaran';

          const roomCodes: Record<string, string> = {};
          rooms.forEach((r) => {
            roomCodes[r.key] = '-';
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
    } else {
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
  }

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
