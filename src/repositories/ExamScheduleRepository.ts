import * as XLSX from 'xlsx';
import type { ExamScheduleData } from '../types/exam-schedule.types';
import { useSettingsStore } from '../store/useSettingsStore';
import { logger } from '../utils/logger.utils';

export const EXAM_SCHEDULE_STORAGE_PREFIX = 'smart_absensi_exam_schedule_';
export const EXAM_SCHEDULE_UPDATED_EVENT = 'smart_absensi_exam_schedule_updated';

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
  private static getStorageKey(academicYear: string, examType: string): string {
    const cleanYear = academicYear.replace(/[^\w]/g, '_');
    const cleanType = examType.replace(/[^\w]/g, '_');
    return `${EXAM_SCHEDULE_STORAGE_PREFIX}${cleanYear}_${cleanType}`;
  }

  /**
   * Retrieves saved exam schedule for a specific academic year and exam type.
   */
  public static async getSchedule(
    academicYear: string,
    examType: string
  ): Promise<ExamScheduleData | null> {
    try {
      const key = this.getStorageKey(academicYear, examType);
      const raw = safeGetStorage(key);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (err) {
      logger.error('ExamScheduleRepository', 'Failed to parse exam schedule:', err);
    }
    return null;
  }

  /**
   * Saves or updates an exam schedule.
   */
  public static async saveSchedule(schedule: ExamScheduleData): Promise<boolean> {
    try {
      const key = this.getStorageKey(schedule.config.academicYear, schedule.config.examType);
      safeSetStorage(key, JSON.stringify(schedule));

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent(EXAM_SCHEDULE_UPDATED_EVENT, { detail: schedule })
        );
      }
      return true;
    } catch (err) {
      logger.error('ExamScheduleRepository', 'Failed to save exam schedule:', err);
      return false;
    }
  }

  /**
   * Deletes an exam schedule.
   */
  public static async deleteSchedule(academicYear: string, examType: string): Promise<boolean> {
    try {
      const key = this.getStorageKey(academicYear, examType);
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.removeItem(key);
      }
      memoryScheduleStore.delete(key);

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
    const institutionName = appSettings.institution_name || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam';
    const appName = appSettings.app_name || 'Smart Absensi Guru';

    const { config, subjectSchedules, proctorSchedules } = schedule;

    // --- SHEET 1: JADWAL UJIAN MAPEL SISWA ---
    const subjectRows: (string | number)[][] = [
      [appName.toUpperCase()],
      [institutionName.toUpperCase()],
      [`JADWAL UJIAN MATA PELAJARAN — ${config.examTitle || config.examType}`],
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
        'Keterangan Ruang',
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
        item.isLabRequired ? 'Lab Komputer (CBT)' : 'Ruang Kelas Teori',
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
      [appName.toUpperCase()],
      [institutionName.toUpperCase()],
      [`JADWAL TUGAS MENGAWAS UJIAN GURU — ${config.examTitle || config.examType}`],
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
        item.roomName,
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
    XLSX.utils.book_append_sheet(wb, subjectWs, 'Jadwal Ujian Mapel');
    XLSX.utils.book_append_sheet(wb, proctorWs, 'Jadwal Pengawas Guru');

    const filename = `Jadwal_${config.examType}_${config.academicYear.replace('/', '-')}.xlsx`.replace(/\s+/g, '_');
    XLSX.writeFile(wb, filename);
  }
}
