import * as XLSX from 'xlsx';
import type { ExamScheduleData, ExamSubjectScheduleItem, ExamProctorItem } from '../types/exam-schedule.types';
import { useSettingsStore } from '../store/useSettingsStore';
import { logger } from '../utils/logger.utils';
import { ProviderFactory } from '../providers/provider-factory';

export const EXAM_SCHEDULE_STORAGE_PREFIX = 'smart_absensi_exam_schedule_';
export const EXAM_SCHEDULE_UPDATED_EVENT = 'smart_absensi_exam_schedule_updated';
export const EXAM_SCHEDULE_PUBLISHED_EVENT = 'smart_absensi_exam_schedule_published';

export interface CanonicalSmaSlot {
  dayName: string;
  dayIndex: number;
  date: string;
  sessionNumber: number;
  subject: string;
  startTime: string;
  endTime: string;
  proctorId: string;
  proctorName: string;
}

export const CANONICAL_SMA_SLOTS: CanonicalSmaSlot[] = [
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '07:30', endTime: '09:00', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'Biologi', startTime: '09:30', endTime: '11:00', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'Matematika', startTime: '07:30', endTime: '09:00', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'Pendidikan Pancasila', startTime: '09:30', endTime: '11:00', proctorId: 'usr_admin_001', proctorName: 'Dafa Maulana, S.Pd' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '07:30', endTime: '09:00', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'Akuntansi', startTime: '09:30', endTime: '11:00', proctorId: 'usr_guru_010', proctorName: 'Mawar Andinia, S.Pd., G.r' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:15', endTime: '12:45', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '07:30', endTime: '09:00', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'Ekonomi', startTime: '09:30', endTime: '11:00', proctorId: 'usr_guru_002', proctorName: 'Muhammad Iqbal Gustiawan, S.Pd., G.r' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:15', endTime: '12:45', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '07:15', endTime: '08:45', proctorId: 'usr_guru_002', proctorName: 'Muhammad Iqbal Gustiawan, S.Pd., G.r' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '09:00', endTime: '10:30', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi' },
];

const memoryScheduleStore = new Map<string, string>();

const safeGetStorage = (key: string): string | null => {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {}
  return memoryScheduleStore.get(key) || null;
};

const safeSetStorage = (key: string, value: string): void => {
  memoryScheduleStore.set(key, value);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, value);
    }
  } catch {}
};

export class ExamScheduleRepository {
  private static getStorageKey(academicYear: string, examType: string, level?: 'SMP' | 'SMA'): string {
    const cleanYear = academicYear.replace(/[^\w]/g, '_');
    const cleanType = examType.replace(/[^\w]/g, '_');
    const cleanLevel = level ? `_${level.toLowerCase()}` : '';
    return `${EXAM_SCHEDULE_STORAGE_PREFIX}${cleanYear}_${cleanType}${cleanLevel}`;
  }

  /**
   * Synchronizes an SMA exam schedule so all subject allocations across all classes and proctors
   * are 100% in sync with the official school schedule.
   */
  public static syncSmaScheduleSubjects(schedule: ExamScheduleData): ExamScheduleData {
    if (schedule.educationLevel !== 'SMA' && schedule.config?.educationLevel !== 'SMA') {
      return schedule;
    }

    const uniqueDates = Array.from(new Set(schedule.subjectSchedules.map((s) => s.date))).sort();

    const updatedSubjects = schedule.subjectSchedules.map((item) => {
      let canonical = CANONICAL_SMA_SLOTS.find(
        (c) => c.dayName.toLowerCase() === item.dayName.toLowerCase() && c.sessionNumber === item.sessionNumber
      );
      if (!canonical) {
        const dateIdx = uniqueDates.indexOf(item.date);
        if (dateIdx >= 0) {
          canonical = CANONICAL_SMA_SLOTS.find(
            (c) => c.dayIndex === dateIdx && c.sessionNumber === item.sessionNumber
          );
        }
      }

      if (canonical) {
        return {
          ...item,
          subject: canonical.subject,
          startTime: item.startTime || canonical.startTime,
          endTime: item.endTime || canonical.endTime,
          roomName: item.roomName || 'Ruang 6',
        };
      }
      return item;
    });

    const updatedProctors = (schedule.proctorSchedules || []).map((proctor) => {
      let canonical = CANONICAL_SMA_SLOTS.find(
        (c) => c.dayName.toLowerCase() === proctor.dayName.toLowerCase() && c.sessionNumber === proctor.sessionNumber
      );
      if (!canonical) {
        const dateIdx = uniqueDates.indexOf(proctor.date);
        if (dateIdx >= 0) {
          canonical = CANONICAL_SMA_SLOTS.find(
            (c) => c.dayIndex === dateIdx && c.sessionNumber === proctor.sessionNumber
          );
        }
      }
      if (canonical) {
        return {
          ...proctor,
          subject: canonical.subject,
          roomName: proctor.roomName || 'Ruang 6',
        };
      }
      return proctor;
    });

    const canonicalSubjectNames = Array.from(new Set(CANONICAL_SMA_SLOTS.map((c) => c.subject)));

    return {
      ...schedule,
      subjectSchedules: updatedSubjects,
      proctorSchedules: updatedProctors,
      config: {
        ...schedule.config,
        selectedSubjects: canonicalSubjectNames,
        totalRooms: 1,
        educationLevel: 'SMA',
        dayOverrides: [
          { date: uniqueDates[0] || '2026-09-28', dayName: 'Senin', sessionsCount: 2 },
          { date: uniqueDates[1] || '2026-09-29', dayName: 'Selasa', sessionsCount: 2 },
          { date: uniqueDates[2] || '2026-09-30', dayName: 'Rabu', sessionsCount: 3 },
          { date: uniqueDates[3] || '2026-10-01', dayName: 'Kamis', sessionsCount: 3 },
          { date: uniqueDates[4] || '2026-10-02', dayName: 'Jumat', sessionsCount: 2 },
        ],
      },
      summary: {
        ...schedule.summary,
        totalSubjects: canonicalSubjectNames.length,
        totalSessions: CANONICAL_SMA_SLOTS.length,
        averageSessionsPerTeacher: schedule.summary?.averageSessionsPerTeacher || 2,
      },
    };
  }

  /**
   * Generates a fully populated, 100% conflict-free canonical SMA schedule for Ruang 6 (Classes 10, 11, 12).
   */
  public static createCanonicalSmaSchedule(academicYear: string = '2026/2027', examType: string = 'ASTS'): ExamScheduleData {
    const classes = ['10', '11', '12'];
    const subjectSchedules: ExamSubjectScheduleItem[] = [];

    classes.forEach((cls) => {
      CANONICAL_SMA_SLOTS.forEach((slot, idx) => {
        subjectSchedules.push({
          id: `subj_sma_${cls}_${slot.date}_s${slot.sessionNumber}_${idx}`,
          date: slot.date,
          dayName: slot.dayName,
          sessionNumber: slot.sessionNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          className: cls,
          subject: slot.subject,
          roomName: 'Ruang 6',
          isLabRequired: false,
        });
      });
    });

    const proctorSchedules: ExamProctorItem[] = CANONICAL_SMA_SLOTS.map((slot) => ({
      id: `proc_sma_${slot.date}_s${slot.sessionNumber}_r6`,
      date: slot.date,
      dayName: slot.dayName,
      sessionNumber: slot.sessionNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomName: 'Ruang 6',
      className: '10, 11, 12',
      subject: slot.subject,
      mainProctorId: slot.proctorId,
      mainProctorName: slot.proctorName,
      educationLevel: 'SMA',
    }));

    const canonicalSubjectNames = Array.from(new Set(CANONICAL_SMA_SLOTS.map((c) => c.subject)));

    return {
      id: `exam_sched_sma_${academicYear.replace(/[^\w]/g, '_')}_${examType.toLowerCase()}`,
      educationLevel: 'SMA',
      config: {
        academicYear,
        examType: examType as any,
        examTitle: `Asesmen Sumatif Tengah Semester (${examType}) SMA`,
        semester: '1',
        startDate: '2026-09-28',
        endDate: '2026-10-02',
        sessionsPerDay: 3,
        sessionSlots: [
          { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:00' },
          { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '09:30', endTime: '11:00' },
          { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:15', endTime: '12:45' },
        ],
        selectedClasses: classes,
        selectedSubjects: canonicalSubjectNames,
        selectedTeacherIds: Array.from(new Set(CANONICAL_SMA_SLOTS.map((s) => s.proctorId))),
        proctorsPerRoom: 1,
        excludeOwnSubject: false,
        excludeCommitteeProctor: false,
        assignBackupProctor: false,
        totalRooms: 1,
        roomFormat: 'NUMERIC',
        classRoomMapping: { '10': 'Ruang 6', '11': 'Ruang 6', '12': 'Ruang 6' },
        educationLevel: 'SMA',
        dayOverrides: [
          { date: '2026-09-28', dayName: 'Senin', sessionsCount: 2 },
          { date: '2026-09-29', dayName: 'Selasa', sessionsCount: 2 },
          { date: '2026-09-30', dayName: 'Rabu', sessionsCount: 3 },
          { date: '2026-10-01', dayName: 'Kamis', sessionsCount: 3 },
          { date: '2026-10-02', dayName: 'Jumat', sessionsCount: 2 },
        ],
      },
      subjectSchedules,
      proctorSchedules,
      summary: {
        totalDays: 5,
        totalSessions: CANONICAL_SMA_SLOTS.length,
        totalClasses: classes.length,
        totalSubjects: canonicalSubjectNames.length,
        totalProctorsAssigned: proctorSchedules.length,
        averageSessionsPerTeacher: 2,
      },
      isPublished: true,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Retrieves saved exam schedule for a specific academic year and exam type.
   */
  public static async getSchedule(
    academicYear: string,
    examType: string,
    level?: 'SMP' | 'SMA'
  ): Promise<ExamScheduleData | null> {
    let schedule: ExamScheduleData | null = null;

    // 1. Fetch from cloud provider
    try {
      const provider = ProviderFactory.getProvider();
      const remoteSchedule = await provider.getExamSchedule(academicYear, examType, undefined, level);
      if (remoteSchedule) {
        schedule = remoteSchedule;
      }
    } catch (err) {
      logger.warn('ExamScheduleRepository', 'Cloud schedule fetch error, falling back to local:', err);
    }

    // 2. Fallback to local storage
    if (!schedule) {
      try {
        const key = this.getStorageKey(academicYear, examType, level);
        const raw = safeGetStorage(key);
        if (raw) {
          schedule = JSON.parse(raw);
        } else if (level === 'SMP') {
          // Fallback for SMP to legacy key without level suffix
          const legacyKey = this.getStorageKey(academicYear, examType);
          const legacyRaw = safeGetStorage(legacyKey);
          if (legacyRaw) {
            schedule = JSON.parse(legacyRaw);
          }
        }
      } catch (err) {
        logger.error('ExamScheduleRepository', 'Failed to parse exam schedule:', err);
      }
    }

    // 3. For SMA: Synchronize subjects when schedule exists
    if (level === 'SMA') {
      if (schedule) {
        const synced = this.syncSmaScheduleSubjects(schedule);
        const key = this.getStorageKey(academicYear, examType, 'SMA');
        safeSetStorage(key, JSON.stringify(synced));
        return synced;
      }
      return null;
    }

    return schedule;
  }

  /**
   * Saves or updates an exam schedule.
   */
  public static async saveSchedule(schedule: ExamScheduleData, level?: 'SMP' | 'SMA'): Promise<boolean> {
    try {
      const effectiveLevel = level || schedule.config.educationLevel || schedule.educationLevel;
      const finalSchedule = effectiveLevel === 'SMA' ? this.syncSmaScheduleSubjects(schedule) : schedule;

      const key = this.getStorageKey(finalSchedule.config.academicYear, finalSchedule.config.examType, effectiveLevel);
      safeSetStorage(key, JSON.stringify(finalSchedule));

      // Persist to Supabase Cloud Provider
      try {
        const provider = ProviderFactory.getProvider();
        await provider.saveExamSchedule(finalSchedule, undefined, effectiveLevel);
      } catch (cloudErr) {
        logger.warn('ExamScheduleRepository', 'Failed to save schedule to cloud provider:', cloudErr);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(EXAM_SCHEDULE_UPDATED_EVENT, { detail: finalSchedule })
        );
      }
      return true;
    } catch (err) {
      logger.error('ExamScheduleRepository', 'Failed to save exam schedule:', err);
      return false;
    }
  }

  /**
   * Publishes an exam schedule to teachers, updates publication metadata, and broadcasts event.
   */
  public static async publishSchedule(
    schedule: ExamScheduleData,
    level?: 'SMP' | 'SMA'
  ): Promise<boolean> {
    schedule.isPublished = true;
    schedule.publishedAt = new Date().toISOString();
    schedule.updatedAt = new Date().toISOString();

    const saved = await this.saveSchedule(schedule, level);
    if (saved && typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent(EXAM_SCHEDULE_PUBLISHED_EVENT, { detail: schedule })
      );
    }
    return saved;
  }

  /**
   * Normalizes a teacher name by removing academic titles and non-alphanumeric chars for robust matching.
   */
  public static normalizeTeacherName(name?: string): string {
    if (!name) return '';
    return name
      .toLowerCase()
      .replace(/(,\s*s\.pd.*|,\s*s\.mat.*|,\s*s\.e.*|,\s*s\.i.*|,\s*g\.r.*)/gi, '')
      .replace(/[^a-z0-9]/g, ' ')
      .trim();
  }

  /**
   * Helper to retrieve all active exam duties for a teacher across both levels or specified level.
   */
  public static async getTeacherExamDuties(
    teacherIdOrName: string,
    academicYear: string,
    level?: 'SMP' | 'SMA',
    teacherFullName?: string
  ): Promise<{
    schedule: ExamScheduleData;
    duties: ExamScheduleData['proctorSchedules'];
    teacherCode?: string;
  } | null> {
    const examTypes = ['ASTS', 'ASAS'];
    const levelsToScan: ('SMP' | 'SMA')[] = level ? [level] : ['SMA', 'SMP'];
    const targetKey = (teacherIdOrName || '').toLowerCase().trim();
    const targetName = (teacherFullName || '').toLowerCase().trim();
    const cleanTargetName = this.normalizeTeacherName(teacherFullName || (!teacherIdOrName.startsWith('usr_') ? teacherIdOrName : ''));
    if (!targetKey && !targetName && !cleanTargetName) return null;

    for (const lvl of levelsToScan) {
      for (const eType of examTypes) {
        const schedule = await this.getSchedule(academicYear, eType, lvl);
        if (!schedule || !schedule.proctorSchedules || schedule.proctorSchedules.length === 0) {
          continue;
        }

        const duties = schedule.proctorSchedules.filter((p) => {
          const matchMainId = Boolean(targetKey && p.mainProctorId?.toLowerCase().trim() === targetKey);
          const matchSecId = Boolean(targetKey && p.secondaryProctorId?.toLowerCase().trim() === targetKey);

          const mainTrimmed = p.mainProctorName?.toLowerCase().trim();
          const secTrimmed = p.secondaryProctorName?.toLowerCase().trim();

          const pMainClean = this.normalizeTeacherName(p.mainProctorName);
          const pSecClean = this.normalizeTeacherName(p.secondaryProctorName);

          const matchMainName = Boolean(
            mainTrimmed && mainTrimmed.length > 2 && (
              (targetName && (mainTrimmed.includes(targetName) || targetName.includes(mainTrimmed))) ||
              (cleanTargetName && pMainClean && (pMainClean.includes(cleanTargetName) || cleanTargetName.includes(pMainClean)))
            )
          );

          const matchSecName = Boolean(
            secTrimmed && secTrimmed.length > 2 && (
              (targetName && (secTrimmed.includes(targetName) || targetName.includes(secTrimmed))) ||
              (cleanTargetName && pSecClean && (pSecClean.includes(cleanTargetName) || cleanTargetName.includes(pSecClean)))
            )
          );

          return matchMainId || matchMainName || matchSecId || matchSecName;
        });

        if (duties.length > 0) {
          // Derive deterministic teacher code (01, 02...) matching matrix proctor legend
          const allProctorNames = Array.from(
            new Set(schedule.proctorSchedules.map((p) => p.mainProctorName.trim()))
          ).sort((a, b) => a.localeCompare(b, 'id'));
          const idx = allProctorNames.findIndex((n) => {
            const nTrim = n.toLowerCase().trim();
            const nClean = this.normalizeTeacherName(n);
            return (
              (targetName && nTrim.length > 2 && (nTrim.includes(targetName) || targetName.includes(nTrim))) ||
              (cleanTargetName && nClean.length > 2 && (nClean.includes(cleanTargetName) || cleanTargetName.includes(nClean)))
            );
          });
          const teacherCode = idx !== -1 ? String(idx + 1).padStart(2, '0') : undefined;

          return {
            schedule,
            duties,
            teacherCode,
          };
        }
      }
    }

    return null;
  }

  /**
   * Deletes an exam schedule.
   */
  public static async deleteSchedule(academicYear: string, examType: string, level?: 'SMP' | 'SMA'): Promise<boolean> {
    try {
      const key = this.getStorageKey(academicYear, examType, level);
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.removeItem(key);
      }
      memoryScheduleStore.delete(key);

      // Clean legacy key if SMP or unspecified
      if (level === 'SMP' || !level) {
        const legacyKey = this.getStorageKey(academicYear, examType);
        if (typeof localStorage !== 'undefined' && localStorage) {
          localStorage.removeItem(legacyKey);
        }
        memoryScheduleStore.delete(legacyKey);
      }

      // Delete from Supabase Cloud Provider
      try {
        const provider = ProviderFactory.getProvider();
        await provider.deleteExamSchedule(academicYear, examType, undefined, level);
      } catch (cloudErr) {
        logger.warn('ExamScheduleRepository', 'Failed to delete schedule from cloud provider:', cloudErr);
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(EXAM_SCHEDULE_UPDATED_EVENT, { detail: null })
        );
      }
      return true;
    } catch (err) {
      logger.error('ExamScheduleRepository', 'Failed to delete exam schedule:', err);
      return false;
    }
  }

  /**
   * Exports both Exam Subject Schedule and Teacher Proctor Roster to a professional multi-sheet Excel workbook.
   */
  public static exportToExcel(schedule: ExamScheduleData): void {
    const appSettings = useSettingsStore.getState().settings;
    const effectiveLevel = schedule.config.educationLevel || schedule.educationLevel;
    let defaultInstitution = 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam';
    if (effectiveLevel === 'SMP') {
      defaultInstitution = 'SMP Terpadu Al-Ittihadiyah';
    } else if (effectiveLevel === 'SMA') {
      defaultInstitution = 'SMA Terpadu As Salaam';
    }
    const institutionName = appSettings.institution_name || defaultInstitution;

    const { config, subjectSchedules, proctorSchedules } = schedule;

    // --- SHEET 1: JADWAL UJIAN MAPEL SISWA ---
    const subjectRows: (string | number)[][] = [
      [institutionName.toUpperCase()],
      [`JADWAL UJIAN MATA PELAJARAN — ${config.examTitle || config.examType}${effectiveLevel ? ` (${effectiveLevel})` : ''}`],
      [`Tahun Ajaran: ${config.academicYear} | Semester: ${config.semester}`],
      [`Periode Pelaksanaan: ${config.startDate} s.d. ${config.endDate}`],
      [''],
      [
        'No',
        'Hari',
        'Tanggal',
        'Sesi',
        'Waktu',
        'Kelas / Rombel',
        'Mata Pelajaran',
        'Ruangan',
      ],
    ];

    subjectSchedules.forEach((item, idx) => {
      subjectRows.push([
        idx + 1,
        item.dayName,
        item.date,
        `Sesi ${item.sessionNumber}`,
        `${item.startTime} - ${item.endTime}`,
        item.className,
        item.subject,
        item.roomName || 'Ruang 1',
      ]);
    });

    const subjectWs = XLSX.utils.aoa_to_sheet(subjectRows);
    subjectWs['!cols'] = [
      { wch: 6 },  // No
      { wch: 12 }, // Hari
      { wch: 14 }, // Tanggal
      { wch: 10 }, // Sesi
      { wch: 16 }, // Waktu
      { wch: 16 }, // Kelas
      { wch: 28 }, // Mata Pelajaran
      { wch: 22 }, // Keterangan
    ];

    // --- SHEET 2: JADWAL PENGAWAS GURU ---
    const proctorRows: (string | number)[][] = [
      [institutionName.toUpperCase()],
      [`JADWAL TUGAS MENGAWAS UJIAN GURU — ${config.examTitle || config.examType}${effectiveLevel ? ` (${effectiveLevel})` : ''}`],
      [`Tahun Ajaran: ${config.academicYear} | Semester: ${config.semester}`],
      [''],
      [
        'No',
        'Hari',
        'Tanggal',
        'Sesi',
        'Waktu',
        'Ruangan / Kelas',
        'Mata Pelajaran',
        'Pengawas Utama',
        'Pengawas Cadangan / Piket',
      ],
    ];

    proctorSchedules.forEach((item, idx) => {
      proctorRows.push([
        idx + 1,
        item.dayName,
        item.date,
        `Sesi ${item.sessionNumber}`,
        `${item.startTime} - ${item.endTime}`,
        `${item.roomName} (${item.className})`,
        item.subject,
        item.mainProctorName,
        item.backupProctorName || '-',
      ]);
    });

    const proctorWs = XLSX.utils.aoa_to_sheet(proctorRows);
    proctorWs['!cols'] = [
      { wch: 6 },  // No
      { wch: 12 }, // Hari
      { wch: 14 }, // Tanggal
      { wch: 10 }, // Sesi
      { wch: 16 }, // Waktu
      { wch: 18 }, // Ruangan
      { wch: 26 }, // Mata Pelajaran
      { wch: 28 }, // Pengawas Utama
      { wch: 28 }, // Pengawas Cadangan
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, subjectWs, `Jadwal Ujian ${effectiveLevel || 'Mapel'}`);
    XLSX.utils.book_append_sheet(wb, proctorWs, `Jadwal Pengawas ${effectiveLevel || 'Guru'}`);

    const levelStr = effectiveLevel ? `_${effectiveLevel}` : '';
    const filename = `Jadwal_${config.examType}${levelStr}_${config.academicYear.replace('/', '-')}.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, filename);
  }
}
