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
  roomName: string;
  className: string;
  proctorId: string;
  proctorName: string;
  proctorCode: string;
}

export interface CanonicalSmpSlot {
  dayIndex: number;
  date: string;
  dayName: string;
  sessionNumber: number;
  subject: string;
  startTime: string;
  endTime: string;
  roomName: string;
  className: string;
  proctorId: string;
  proctorName: string;
  proctorCode: string;
}

export interface CrossLevelConflictItem {
  dayName: string;
  date: string;
  sessionNumber: number;
  timeRange: string;
  teacherId: string;
  teacherName: string;
  smpDuty: {
    roomName: string;
    className: string;
    subject: string;
    proctorCode: string;
  };
  smaDuty: {
    roomName: string;
    className: string;
    subject: string;
    proctorCode: string;
  };
  availableReplacementTeachers: Array<{
    userId: string;
    fullName: string;
    smpCode?: string;
  }>;
}

export const CANONICAL_SMA_SLOTS: CanonicalSmaSlot[] = [
  // ── SENIN, 28 SEPTEMBER 2026 ──────────────────────────────────────────────
  // Sesi 1 (07:30 - 09:00): PAI -> Pengawas 04 (Nurul Farhiya, S.Pd., G.r)
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '07:30', endTime: '09:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '04' },
  // Sesi 2 (09:30 - 11:00): Biologi -> Pengawas 05 (Qodiatul Asrof Ramadhoni, S.E., G.r)
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'Biologi', startTime: '09:30', endTime: '11:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '05' },

  // ── SELASA, 29 SEPTEMBER 2026 ─────────────────────────────────────────────
  // Sesi 1 (07:30 - 09:00): Matematika -> Pengawas 05 (Qodiatul Asrof Ramadhoni, S.E., G.r)
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'Matematika', startTime: '07:30', endTime: '09:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '05' },
  // Sesi 2 (09:30 - 11:00): Pendidikan Pancasila -> Pengawas 01 (Dafa Maulana, S.Pd)
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'Pendidikan Pancasila', startTime: '09:30', endTime: '11:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_admin_001', proctorName: 'Dafa Maulana, S.Pd', proctorCode: '01' },

  // ── RABU, 30 SEPTEMBER 2026 ───────────────────────────────────────────────
  // Sesi 1 (07:30 - 09:00): B. Indonesia -> Pengawas 05 (Qodiatul Asrof Ramadhoni, S.E., G.r)
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '07:30', endTime: '09:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '05' },
  // Sesi 2 (09:30 - 11:00): Akuntansi -> Pengawas 02 (Mawar Andinia, S.Pd., G.r)
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'Akuntansi', startTime: '09:30', endTime: '11:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_guru_010', proctorName: 'Mawar Andinia, S.Pd., G.r', proctorCode: '02' },
  // Sesi 3 (11:15 - 12:45): B. Arab -> Pengawas 06 (Ridho Maulana Al Farizi)
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:15', endTime: '12:45', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi', proctorCode: '06' },

  // ── KAMIS, 1 OKTOBER 2026 ─────────────────────────────────────────────────
  // Sesi 1 (07:30 - 09:00): B. Inggris -> Pengawas 06 (Ridho Maulana Al Farizi)
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '07:30', endTime: '09:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi', proctorCode: '06' },
  // Sesi 2 (09:30 - 11:00): Ekonomi -> Pengawas 03 (Muhammad Iqbal Gustiawan, S.Pd., G.r)
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'Ekonomi', startTime: '09:30', endTime: '11:00', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_guru_002', proctorName: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', proctorCode: '03' },
  // Sesi 3 (11:15 - 12:45): Informatika -> Pengawas 04 (Nurul Farhiya, S.Pd., G.r)
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:15', endTime: '12:45', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '04' },

  // ── JUM'AT, 2 OKTOBER 2026 ────────────────────────────────────────────────
  // Sesi 1 (07:15 - 08:45): Hadits -> Pengawas 03 (Muhammad Iqbal Gustiawan, S.Pd., G.r)
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '07:15', endTime: '08:45', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_guru_002', proctorName: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', proctorCode: '03' },
  // Sesi 2 (09:00 - 10:30): BTQ -> Pengawas 06 (Ridho Maulana Al Farizi)
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '09:00', endTime: '10:30', roomName: 'Ruang 06', className: '10, 11, 12', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi', proctorCode: '06' },
];

/**
 * Matriks Pengawas Resmi ASTS Ganjil SMP Terpadu Al-Ittihadiyah (Ruang 1 s.d. Ruang 5)
 * Sesuai dokumen resmi fisik jadwal pengawas di papan sekolah:
 * 01: Adi Prasetyo, S.Pd., G.r
 * 02: Dafa Maulana, S.Pd
 * 03: Fitri Ani Rahayu, S.Mat
 * 04: M. Iqbal Gustiawan, S.Pd., G.r.
 * 05: Mawar Andinia, S.Pd., G.r
 * 06: Mira Nurdianti, S.Pd
 * 07: Nurul Farhiya, S.Pd., G.r
 * 08: Qodiatul Asrof Ramadhoni, S.E., G.r
 * 09: Ridho Maulana Al Farizi
 * 10: Septi Nur Aeni, S.E
 * 11: Widianingsih, S.I., G.r
 */
export const CANONICAL_SMP_SLOTS: CanonicalSmpSlot[] = [
  // ── SENIN, 28 SEPTEMBER 2026 ──────────────────────────────────────────────
  // Sesi 1 (08:00 - 09:30): PAI
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_admin_001', proctorName: 'Dafa Maulana, S.Pd', proctorCode: '02' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '08' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_002', proctorName: 'M. Iqbal Gustiawan, S.Pd., G.r.', proctorCode: '04' },

  // Sesi 2 (10:00 - 11:00): IPA
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'IPA', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'IPA', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '07' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'IPA', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi', proctorCode: '09' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'IPA', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '08' },
  { dayIndex: 0, date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'IPA', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },

  // ── SELASA, 29 SEPTEMBER 2026 ─────────────────────────────────────────────
  // Sesi 1 (08:00 - 09:30): MTK
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'MTK', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '07' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'MTK', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'MTK', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_guru_002', proctorName: 'M. Iqbal Gustiawan, S.Pd., G.r.', proctorCode: '04' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'MTK', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_004', proctorName: 'Mira Nurdianti, S.Pd', proctorCode: '06' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'MTK', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },

  // Sesi 2 (10:00 - 11:00): PP
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'PP', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'PP', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi', proctorCode: '09' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'PP', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_guru_007', proctorName: 'Septi Nur Aeni, S.E', proctorCode: '10' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'PP', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },
  { dayIndex: 1, date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'PP', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '07' },

  // ── RABU, 30 SEPTEMBER 2026 ───────────────────────────────────────────────
  // Sesi 1 (08:00 - 09:30): B. Indonesia
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_002', proctorName: 'M. Iqbal Gustiawan, S.Pd., G.r.', proctorCode: '04' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_admin_001', proctorName: 'Dafa Maulana, S.Pd', proctorCode: '02' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_010', proctorName: 'Mawar Andinia, S.Pd., G.r', proctorCode: '05' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },

  // Sesi 2 (10:00 - 11:00): IPS
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'IPS', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi', proctorCode: '09' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'IPS', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_007', proctorName: 'Septi Nur Aeni, S.E', proctorCode: '10' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'IPS', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'IPS', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'IPS', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },

  // Sesi 3 (11:00 - 12:00): B. Arab
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '08' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_guru_007', proctorName: 'Septi Nur Aeni, S.E', proctorCode: '10' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_002', proctorName: 'M. Iqbal Gustiawan, S.Pd., G.r.', proctorCode: '04' },
  { dayIndex: 2, date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },

  // ── KAMIS, 1 OKTOBER 2026 ─────────────────────────────────────────────────
  // Sesi 1 (08:00 - 09:30): B. Inggris
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '07' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_004', proctorName: 'Mira Nurdianti, S.Pd', proctorCode: '06' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },

  // Sesi 2 (10:00 - 11:00): SBPK
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'SBPK', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'SBPK', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_010', proctorName: 'Mawar Andinia, S.Pd., G.r', proctorCode: '05' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'SBPK', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '08' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'SBPK', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_003', proctorName: 'Adi Prasetyo, S.Pd., G.r', proctorCode: '01' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'SBPK', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },

  // Sesi 3 (11:00 - 12:00): Informatika
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '08' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_007', proctorName: 'Septi Nur Aeni, S.E', proctorCode: '10' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_admin_001', proctorName: 'Dafa Maulana, S.Pd', proctorCode: '02' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },
  { dayIndex: 3, date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:00', endTime: '12:00', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_002', proctorName: 'M. Iqbal Gustiawan, S.Pd., G.r.', proctorCode: '04' },

  // ── JUM'AT, 2 OKTOBER 2026 ────────────────────────────────────────────────
  // Sesi 1 (08:00 - 09:30): Hadits
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_009', proctorName: 'Widianingsih, S.I., G.r', proctorCode: '11' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_010', proctorName: 'Mawar Andinia, S.Pd., G.r', proctorCode: '05' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_1786512137742', proctorName: 'Ridho Maulana Al Farizi', proctorCode: '09' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '07' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '08:00', endTime: '09:30', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_004', proctorName: 'Mira Nurdianti, S.Pd', proctorCode: '06' },

  // Sesi 2 (10:00 - 11:00): BTQ
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 1', className: '7A', proctorId: 'usr_guru_006', proctorName: 'Nurul Farhiya, S.Pd., G.r', proctorCode: '07' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 2', className: '7B', proctorId: 'usr_guru_004', proctorName: 'Mira Nurdianti, S.Pd', proctorCode: '06' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 3', className: '8A', proctorId: 'usr_op_002', proctorName: 'Qodiatul Asrof Ramadhoni, S.E., G.r', proctorCode: '08' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 4', className: '8B', proctorId: 'usr_guru_005', proctorName: 'Fitri Ani Rahayu, S.Mat', proctorCode: '03' },
  { dayIndex: 4, date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '10:00', endTime: '11:00', roomName: 'Ruang 5', className: '9A, 9B', proctorId: 'usr_guru_010', proctorName: 'Mawar Andinia, S.Pd., G.r', proctorCode: '05' },
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
    const classes = schedule.config?.selectedClasses?.length ? schedule.config.selectedClasses : ['10', '11', '12'];

    let updatedSubjects: ExamSubjectScheduleItem[] = [];
    if (!schedule.subjectSchedules || schedule.subjectSchedules.length < 12) {
      classes.forEach((cls) => {
        CANONICAL_SMA_SLOTS.forEach((slot, idx) => {
          updatedSubjects.push({
            id: `subj_sma_${cls}_${slot.date}_s${slot.sessionNumber}_${idx}`,
            date: slot.date,
            dayName: slot.dayName,
            sessionNumber: slot.sessionNumber,
            startTime: slot.startTime,
            endTime: slot.endTime,
            className: cls,
            subject: slot.subject,
            roomName: 'Ruang 06',
            isLabRequired: false,
          });
        });
      });
    } else {
      updatedSubjects = schedule.subjectSchedules.map((item) => {
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
            startTime: canonical.startTime,
            endTime: canonical.endTime,
            roomName: 'Ruang 06',
          };
        }
        return {
          ...item,
          roomName: 'Ruang 06',
        };
      });
    }

    // Synchronize all 12 canonical proctor slots strictly matching official document
    const updatedProctors: ExamProctorItem[] = CANONICAL_SMA_SLOTS.map((slot) => {
      const existing = (schedule.proctorSchedules || []).find(
        (p) =>
          (p.date === slot.date || p.dayName.toLowerCase() === slot.dayName.toLowerCase()) &&
          p.sessionNumber === slot.sessionNumber
      );
      return {
        id: existing?.id || `proc_sma_${slot.date}_s${slot.sessionNumber}_r06`,
        date: slot.date,
        dayName: slot.dayName,
        sessionNumber: slot.sessionNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomName: 'Ruang 06',
        className: existing?.className || slot.className || '10, 11, 12',
        subject: slot.subject,
        mainProctorId: slot.proctorId,
        mainProctorName: slot.proctorName,
        secondaryProctorId: existing?.secondaryProctorId,
        secondaryProctorName: existing?.secondaryProctorName,
        backupProctorId: existing?.backupProctorId,
        backupProctorName: existing?.backupProctorName,
        educationLevel: 'SMA' as const,
      };
    });

    const canonicalSubjectNames = Array.from(new Set(CANONICAL_SMA_SLOTS.map((c) => c.subject)));

    return {
      ...schedule,
      educationLevel: 'SMA',
      subjectSchedules: updatedSubjects,
      proctorSchedules: updatedProctors,
      config: {
        ...schedule.config,
        selectedSubjects: canonicalSubjectNames,
        totalRooms: 1,
        educationLevel: 'SMA',
        roomFormat: 'DOUBLE_DIGIT',
        classRoomMapping: { '10': 'Ruang 06', '11': 'Ruang 06', '12': 'Ruang 06' },
        sessionSlots: [
          { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '07:30', endTime: '09:00' },
          { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '09:30', endTime: '11:00' },
          { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:15', endTime: '12:45' },
        ],
        dayOverrides: [
          { date: uniqueDates[0] || '2026-09-28', dayName: 'Senin', sessionsCount: 2 },
          { date: uniqueDates[1] || '2026-09-29', dayName: 'Selasa', sessionsCount: 2 },
          { date: uniqueDates[2] || '2026-09-30', dayName: 'Rabu', sessionsCount: 3 },
          { date: uniqueDates[3] || '2026-10-01', dayName: 'Kamis', sessionsCount: 3 },
          {
            date: uniqueDates[4] || '2026-10-02',
            dayName: 'Jumat',
            sessionsCount: 2,
            sessionSlots: [
              { sessionNumber: 1, sessionName: 'Sesi 1 (Khusus Jumat)', startTime: '07:15', endTime: '08:45' },
              { sessionNumber: 2, sessionName: 'Sesi 2 (Khusus Jumat)', startTime: '09:00', endTime: '10:30' },
            ],
          },
        ],
      },
      summary: {
        ...schedule.summary,
        totalSubjects: canonicalSubjectNames.length,
        totalSessions: CANONICAL_SMA_SLOTS.length,
        averageSessionsPerTeacher: 2,
      },
    };
  }

  /**
   * Generates a fully populated, 100% conflict-free canonical SMA schedule for Ruang 06 (Classes 10, 11, 12).
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
          roomName: 'Ruang 06',
          isLabRequired: false,
        });
      });
    });

    const proctorSchedules: ExamProctorItem[] = CANONICAL_SMA_SLOTS.map((slot) => ({
      id: `proc_sma_${slot.date}_s${slot.sessionNumber}_r06`,
      date: slot.date,
      dayName: slot.dayName,
      sessionNumber: slot.sessionNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomName: 'Ruang 06',
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
        semester: 'Ganjil',
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
        roomFormat: 'DOUBLE_DIGIT',
        classRoomMapping: { '10': 'Ruang 06', '11': 'Ruang 06', '12': 'Ruang 06' },
        educationLevel: 'SMA',
        dayOverrides: [
          { date: '2026-09-28', dayName: 'Senin', sessionsCount: 2 },
          { date: '2026-09-29', dayName: 'Selasa', sessionsCount: 2 },
          { date: '2026-09-30', dayName: 'Rabu', sessionsCount: 3 },
          { date: '2026-10-01', dayName: 'Kamis', sessionsCount: 3 },
          {
            date: '2026-10-02',
            dayName: 'Jumat',
            sessionsCount: 2,
            sessionSlots: [
              { sessionNumber: 1, sessionName: 'Sesi 1 (Khusus Jumat)', startTime: '07:15', endTime: '08:45' },
              { sessionNumber: 2, sessionName: 'Sesi 2 (Khusus Jumat)', startTime: '09:00', endTime: '10:30' },
            ],
          },
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
   * Synchronizes an SMP exam schedule so all subject allocations across all classes and proctors
   * are 100% in sync with the official school schedule photo.
   */
  public static syncSmpScheduleSubjects(schedule: ExamScheduleData): ExamScheduleData {
    if (schedule.educationLevel === 'SMA' || schedule.config?.educationLevel === 'SMA') {
      return schedule;
    }

    const uniqueDates = Array.from(new Set(schedule.subjectSchedules.map((s) => s.date))).sort();

    // Map subjectSchedules to canonical subjects & times
    const updatedSubjects = (schedule.subjectSchedules || []).map((item) => {
      let canonical = CANONICAL_SMP_SLOTS.find(
        (c) =>
          (c.dayName.toLowerCase() === item.dayName.toLowerCase() || c.date === item.date) &&
          c.sessionNumber === item.sessionNumber &&
          (!item.roomName || c.roomName === item.roomName)
      );
      if (!canonical) {
        canonical = CANONICAL_SMP_SLOTS.find(
          (c) =>
            (c.dayName.toLowerCase() === item.dayName.toLowerCase() || c.date === item.date) &&
            c.sessionNumber === item.sessionNumber
        );
      }
      if (canonical) {
        return {
          ...item,
          subject: canonical.subject,
          startTime: canonical.startTime,
          endTime: canonical.endTime,
          roomName: item.roomName || canonical.roomName,
        };
      }
      return item;
    });

    // For proctorSchedules: ensure all 60 canonical proctor slots are present and accurate
    let updatedProctors: ExamProctorItem[];
    if (!schedule.proctorSchedules || schedule.proctorSchedules.length < 50) {
      updatedProctors = CANONICAL_SMP_SLOTS.map((slot) => ({
        id: `proc_smp_${slot.date}_s${slot.sessionNumber}_r${slot.roomName.replace(/[^\d]/g, '')}`,
        date: slot.date,
        dayName: slot.dayName,
        sessionNumber: slot.sessionNumber,
        startTime: slot.startTime,
        endTime: slot.endTime,
        roomName: slot.roomName,
        className: slot.className || (slot.roomName === 'Ruang 1' ? '7A' : slot.roomName === 'Ruang 2' ? '7B' : slot.roomName === 'Ruang 3' ? '8A' : slot.roomName === 'Ruang 4' ? '8B' : '9A, 9B'),
        subject: slot.subject,
        mainProctorId: slot.proctorId,
        mainProctorName: slot.proctorName,
        educationLevel: 'SMP',
      }));
    } else {
      updatedProctors = CANONICAL_SMP_SLOTS.map((slot) => {
        const existing = schedule.proctorSchedules.find(
          (p) =>
            (p.date === slot.date || p.dayName.toLowerCase() === slot.dayName.toLowerCase()) &&
            p.sessionNumber === slot.sessionNumber &&
            p.roomName === slot.roomName
        );
        return {
          id: existing?.id || `proc_smp_${slot.date}_s${slot.sessionNumber}_r${slot.roomName.replace(/[^\d]/g, '')}`,
          date: slot.date,
          dayName: slot.dayName,
          sessionNumber: slot.sessionNumber,
          startTime: slot.startTime,
          endTime: slot.endTime,
          roomName: slot.roomName,
          className: existing?.className || slot.className || (slot.roomName === 'Ruang 1' ? '7A' : slot.roomName === 'Ruang 2' ? '7B' : slot.roomName === 'Ruang 3' ? '8A' : slot.roomName === 'Ruang 4' ? '8B' : '9A, 9B'),
          subject: slot.subject,
          mainProctorId: slot.proctorId,
          mainProctorName: slot.proctorName,
          secondaryProctorId: existing?.secondaryProctorId,
          secondaryProctorName: existing?.secondaryProctorName,
          backupProctorId: existing?.backupProctorId,
          backupProctorName: existing?.backupProctorName,
          educationLevel: 'SMP',
        };
      });
    }

    const canonicalSubjectNames = Array.from(new Set(CANONICAL_SMP_SLOTS.map((c) => c.subject)));

    return {
      ...schedule,
      educationLevel: 'SMP',
      subjectSchedules: updatedSubjects.length > 0 ? updatedSubjects : this.createCanonicalSmpSchedule(schedule.config?.academicYear, schedule.config?.examType).subjectSchedules,
      proctorSchedules: updatedProctors,
      config: {
        ...schedule.config,
        selectedSubjects: canonicalSubjectNames,
        totalRooms: 5,
        educationLevel: 'SMP',
        sessionSlots: [
          { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '08:00', endTime: '09:30' },
          { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '10:00', endTime: '11:00' },
          { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:00', endTime: '12:00' },
        ],
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
        totalSessions: 12,
        totalClasses: 6,
        totalProctorsAssigned: updatedProctors.length,
        averageSessionsPerTeacher: schedule.summary?.averageSessionsPerTeacher || Math.round(updatedProctors.length / 11),
      },
    };
  }

  /**
   * Generates a fully populated, 100% conflict-free canonical SMP schedule for Ruang 1 s.d. Ruang 5 (Classes 7A, 7B, 8A, 8B, 9A, 9B).
   */
  public static createCanonicalSmpSchedule(academicYear: string = '2026/2027', examType: string = 'ASTS'): ExamScheduleData {
    const classes = ['7A', '7B', '8A', '8B', '9A', '9B'];
    const classToRoom: Record<string, string> = {
      '7A': 'Ruang 1',
      '7B': 'Ruang 2',
      '8A': 'Ruang 3',
      '8B': 'Ruang 4',
      '9A': 'Ruang 5',
      '9B': 'Ruang 5',
    };

    const uniqueSessions = [
      { date: '2026-09-28', dayName: 'Senin', sessionNumber: 1, subject: 'PAI', startTime: '08:00', endTime: '09:30' },
      { date: '2026-09-28', dayName: 'Senin', sessionNumber: 2, subject: 'IPA', startTime: '10:00', endTime: '11:00' },
      { date: '2026-09-29', dayName: 'Selasa', sessionNumber: 1, subject: 'MTK', startTime: '08:00', endTime: '09:30' },
      { date: '2026-09-29', dayName: 'Selasa', sessionNumber: 2, subject: 'PP', startTime: '10:00', endTime: '11:00' },
      { date: '2026-09-30', dayName: 'Rabu', sessionNumber: 1, subject: 'B. Indonesia', startTime: '08:00', endTime: '09:30' },
      { date: '2026-09-30', dayName: 'Rabu', sessionNumber: 2, subject: 'IPS', startTime: '10:00', endTime: '11:00' },
      { date: '2026-09-30', dayName: 'Rabu', sessionNumber: 3, subject: 'B. Arab', startTime: '11:00', endTime: '12:00' },
      { date: '2026-10-01', dayName: 'Kamis', sessionNumber: 1, subject: 'B. Inggris', startTime: '08:00', endTime: '09:30' },
      { date: '2026-10-01', dayName: 'Kamis', sessionNumber: 2, subject: 'SBPK', startTime: '10:00', endTime: '11:00' },
      { date: '2026-10-01', dayName: 'Kamis', sessionNumber: 3, subject: 'Informatika', startTime: '11:00', endTime: '12:00' },
      { date: '2026-10-02', dayName: 'Jumat', sessionNumber: 1, subject: 'Hadits', startTime: '08:00', endTime: '09:30' },
      { date: '2026-10-02', dayName: 'Jumat', sessionNumber: 2, subject: 'BTQ', startTime: '10:00', endTime: '11:00' },
    ];

    const subjectSchedules: ExamSubjectScheduleItem[] = [];
    classes.forEach((cls) => {
      const room = classToRoom[cls] || 'Ruang 1';
      uniqueSessions.forEach((sess, idx) => {
        subjectSchedules.push({
          id: `subj_smp_${cls}_${sess.date}_s${sess.sessionNumber}_${idx}`,
          date: sess.date,
          dayName: sess.dayName,
          sessionNumber: sess.sessionNumber,
          startTime: sess.startTime,
          endTime: sess.endTime,
          className: cls,
          subject: sess.subject,
          roomName: room,
          isLabRequired: false,
        });
      });
    });

    const proctorSchedules: ExamProctorItem[] = CANONICAL_SMP_SLOTS.map((slot) => ({
      id: `proc_smp_${slot.date}_s${slot.sessionNumber}_r${slot.roomName.replace(/[^\d]/g, '')}`,
      date: slot.date,
      dayName: slot.dayName,
      sessionNumber: slot.sessionNumber,
      startTime: slot.startTime,
      endTime: slot.endTime,
      roomName: slot.roomName,
      className: slot.className || (slot.roomName === 'Ruang 1' ? '7A' : slot.roomName === 'Ruang 2' ? '7B' : slot.roomName === 'Ruang 3' ? '8A' : slot.roomName === 'Ruang 4' ? '8B' : '9A, 9B'),
      subject: slot.subject,
      mainProctorId: slot.proctorId,
      mainProctorName: slot.proctorName,
      educationLevel: 'SMP',
    }));

    const canonicalSubjectNames = Array.from(new Set(uniqueSessions.map((c) => c.subject)));

    return {
      id: `exam_sched_smp_${academicYear.replace(/[^\w]/g, '_')}_${examType.toLowerCase()}`,
      educationLevel: 'SMP',
      config: {
        academicYear,
        examType: examType as any,
        examTitle: `Asesmen Sumatif Tengah Semester (${examType}) SMP`,
        semester: '1',
        startDate: '2026-09-28',
        endDate: '2026-10-02',
        sessionsPerDay: 3,
        sessionSlots: [
          { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '08:00', endTime: '09:30' },
          { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '10:00', endTime: '11:00' },
          { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:00', endTime: '12:00' },
        ],
        selectedClasses: classes,
        selectedSubjects: canonicalSubjectNames,
        selectedTeacherIds: Array.from(new Set(CANONICAL_SMP_SLOTS.map((s) => s.proctorId))),
        proctorsPerRoom: 1,
        excludeOwnSubject: false,
        excludeCommitteeProctor: false,
        assignBackupProctor: false,
        totalRooms: 5,
        roomFormat: 'NUMERIC',
        classRoomMapping: classToRoom,
        educationLevel: 'SMP',
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
        totalSessions: uniqueSessions.length,
        totalClasses: classes.length,
        totalSubjects: canonicalSubjectNames.length,
        totalProctorsAssigned: proctorSchedules.length,
        averageSessionsPerTeacher: Math.round(proctorSchedules.length / 11),
      },
      isPublished: true,
      publishedAt: new Date().toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /**
   * Normalizes exam schedule session hours to standard school timetable:
   * Sesi 1: 08:00 - 09:30
   * Sesi 2: 10:00 - 11:00
   * Sesi 3: 11:00 - 12:00
   */
  public static normalizeScheduleSessionTimes(schedule: ExamScheduleData): ExamScheduleData {
    if (!schedule) return schedule;

    // For SMA, preserve canonical timetable matching physical photo strictly
    if (schedule.educationLevel === 'SMA' || schedule.config?.educationLevel === 'SMA') {
      return this.syncSmaScheduleSubjects(schedule);
    }

    const getCanonicalTimes = (sNum: number) => {
      if (sNum === 1) return { startTime: '08:00', endTime: '09:30' };
      if (sNum === 2) return { startTime: '10:00', endTime: '11:00' };
      if (sNum === 3) return { startTime: '11:00', endTime: '12:00' };
      return null;
    };

    const updatedSlots = (schedule.config?.sessionSlots || []).map((slot) => {
      const canonical = getCanonicalTimes(slot.sessionNumber);
      if (canonical) {
        return {
          ...slot,
          startTime: canonical.startTime,
          endTime: canonical.endTime,
        };
      }
      return slot;
    });

    const updatedDayOverrides = (schedule.config?.dayOverrides || []).map((ov) => {
      if (ov.sessionSlots && ov.sessionSlots.length > 0) {
        return {
          ...ov,
          sessionSlots: ov.sessionSlots.map((s) => {
            const canonical = getCanonicalTimes(s.sessionNumber);
            return canonical ? { ...s, startTime: canonical.startTime, endTime: canonical.endTime } : s;
          }),
        };
      }
      return ov;
    });

    const updatedSubjects = (schedule.subjectSchedules || []).map((subj) => {
      const canonical = getCanonicalTimes(subj.sessionNumber);
      if (canonical) {
        return {
          ...subj,
          startTime: canonical.startTime,
          endTime: canonical.endTime,
        };
      }
      return subj;
    });

    const updatedProctors = (schedule.proctorSchedules || []).map((p) => {
      const canonical = getCanonicalTimes(p.sessionNumber);
      if (canonical) {
        return {
          ...p,
          startTime: canonical.startTime,
          endTime: canonical.endTime,
        };
      }
      return p;
    });

    return {
      ...schedule,
      config: {
        ...schedule.config,
        sessionSlots: updatedSlots.length > 0 ? updatedSlots : [
          { sessionNumber: 1, sessionName: 'Sesi 1 (Pagi)', startTime: '08:00', endTime: '09:30' },
          { sessionNumber: 2, sessionName: 'Sesi 2 (Menjelang Siang)', startTime: '10:00', endTime: '11:00' },
          { sessionNumber: 3, sessionName: 'Sesi 3 (Siang)', startTime: '11:00', endTime: '12:00' },
        ],
        dayOverrides: updatedDayOverrides,
      },
      subjectSchedules: updatedSubjects,
      proctorSchedules: updatedProctors,
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
        const synced = this.normalizeScheduleSessionTimes(this.syncSmaScheduleSubjects(schedule));
        const key = this.getStorageKey(academicYear, examType, 'SMA');
        safeSetStorage(key, JSON.stringify(synced));
        return synced;
      }
      return null;
    }

    // 4. For SMP: Synchronize subjects and proctor assignments when schedule exists
    if (level === 'SMP') {
      if (schedule) {
        const synced = this.normalizeScheduleSessionTimes(this.syncSmpScheduleSubjects(schedule));
        const key = this.getStorageKey(academicYear, examType, 'SMP');
        safeSetStorage(key, JSON.stringify(synced));
        return synced;
      }
      return null;
    }

    if (schedule) {
      return this.normalizeScheduleSessionTimes(schedule);
    }

    return null;
  }

  /**
   * Saves or updates an exam schedule.
   */
  public static async saveSchedule(schedule: ExamScheduleData, level?: 'SMP' | 'SMA'): Promise<boolean> {
    try {
      const effectiveLevel = level || schedule.config.educationLevel || schedule.educationLevel;
      const synced = effectiveLevel === 'SMA'
        ? this.syncSmaScheduleSubjects(schedule)
        : effectiveLevel === 'SMP'
        ? this.syncSmpScheduleSubjects(schedule)
        : schedule;
      const finalSchedule = this.normalizeScheduleSessionTimes(synced);

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
    const targetKey = (teacherIdOrName || '').toLowerCase().trim();
    const targetName = (teacherFullName || '').toLowerCase().trim();
    const cleanTargetName = this.normalizeTeacherName(teacherFullName || (!teacherIdOrName.startsWith('usr_') ? teacherIdOrName : ''));
    if (!targetKey && !targetName && !cleanTargetName) return null;

    // If level is not specified, aggregate duties across both SMP and SMA
    if (!level) {
      const allDuties: ExamProctorItem[] = [];
      let baseSchedule: ExamScheduleData | null = null;
      let primaryTeacherCode: string | undefined = undefined;

      for (const lvl of ['SMP', 'SMA'] as const) {
        for (const eType of examTypes) {
          const schedule = await this.getSchedule(academicYear, eType, lvl);
          if (!schedule || !schedule.proctorSchedules || schedule.proctorSchedules.length === 0) {
            continue;
          }
          if (!baseSchedule) baseSchedule = schedule;

          const duties = schedule.proctorSchedules.filter((p) => {
            const matchMainId = Boolean(targetKey && p.mainProctorId?.toLowerCase().trim() === targetKey);
            const matchSecId = Boolean(targetKey && p.secondaryProctorId?.toLowerCase().trim() === targetKey);
            const matchBackupId = Boolean(targetKey && p.backupProctorId?.toLowerCase().trim() === targetKey);

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

            return matchMainId || matchMainName || matchSecId || matchSecName || matchBackupId;
          }).map((d) => ({
            ...d,
            educationLevel: lvl,
          }));

          if (duties.length > 0) {
            allDuties.push(...duties);

            if (!primaryTeacherCode) {
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
              if (idx !== -1) primaryTeacherCode = String(idx + 1).padStart(2, '0');
            }
          }
        }
      }

      if (allDuties.length > 0 && baseSchedule) {
        allDuties.sort((a, b) => {
          const dateCmp = a.date.localeCompare(b.date);
          if (dateCmp !== 0) return dateCmp;
          return a.sessionNumber - b.sessionNumber;
        });
        return {
          schedule: baseSchedule,
          duties: allDuties,
          teacherCode: primaryTeacherCode,
        };
      }
      return null;
    }

    // Specific single level requested
    for (const eType of examTypes) {
      const schedule = await this.getSchedule(academicYear, eType, level);
      if (!schedule || !schedule.proctorSchedules || schedule.proctorSchedules.length === 0) {
        continue;
      }

      const duties = schedule.proctorSchedules.filter((p) => {
        const matchMainId = Boolean(targetKey && p.mainProctorId?.toLowerCase().trim() === targetKey);
        const matchSecId = Boolean(targetKey && p.secondaryProctorId?.toLowerCase().trim() === targetKey);
        const matchBackupId = Boolean(targetKey && p.backupProctorId?.toLowerCase().trim() === targetKey);

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

        return matchMainId || matchMainName || matchSecId || matchSecName || matchBackupId;
      }).map((d) => ({
        ...d,
        educationLevel: level,
      }));

      if (duties.length > 0) {
        // Derive deterministic teacher code matching canonical schedule
        const canonicalSlots = level === 'SMA' ? CANONICAL_SMA_SLOTS : CANONICAL_SMP_SLOTS;
        const matchedCanonical = canonicalSlots.find((s) => {
          const sTrim = s.proctorName.toLowerCase().trim();
          const sClean = this.normalizeTeacherName(s.proctorName);
          return (
            (targetName && sTrim.length > 2 && (sTrim.includes(targetName) || targetName.includes(sTrim))) ||
            (cleanTargetName && sClean.length > 2 && (sClean.includes(cleanTargetName) || cleanTargetName.includes(sClean)))
          );
        });

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
        const fallbackCode = idx !== -1 ? String(idx + 1).padStart(2, '0') : undefined;
        const teacherCode = matchedCanonical?.proctorCode || fallbackCode;

        return {
          schedule,
          duties,
          teacherCode,
        };
      }
    }

    return null;
  }

  /**
   * Diagnoses cross-level proctor conflicts between SMP and SMA schedules.
   * Compares each session where the same teacher is scheduled simultaneously in both schools.
   */
  public static detectCrossLevelProctorConflicts(
    smpSchedule: ExamScheduleData | null,
    smaSchedule: ExamScheduleData | null
  ): CrossLevelConflictItem[] {
    if (!smpSchedule || !smaSchedule) return [];

    const conflicts: CrossLevelConflictItem[] = [];

    // Distinct teachers across SMP canonical roster to compute free teachers
    const allSmpTeachers = Array.from(
      new Map(
        CANONICAL_SMP_SLOTS.map((s) => [
          s.proctorId || this.normalizeTeacherName(s.proctorName),
          { userId: s.proctorId, fullName: s.proctorName, smpCode: s.proctorCode },
        ])
      ).values()
    );

    (smaSchedule.proctorSchedules || []).forEach((smaSlot) => {
      const smaTeacherClean = this.normalizeTeacherName(smaSlot.mainProctorName);
      if (!smaTeacherClean) return;

      const overlappingSmpSlots = (smpSchedule.proctorSchedules || []).filter(
        (smpSlot) =>
          (smpSlot.date === smaSlot.date || smpSlot.dayName.toLowerCase() === smaSlot.dayName.toLowerCase()) &&
          smpSlot.sessionNumber === smaSlot.sessionNumber
      );

      overlappingSmpSlots.forEach((smpSlot) => {
        const smpTeacherClean = this.normalizeTeacherName(smpSlot.mainProctorName);
        const isSameTeacher =
          (smaSlot.mainProctorId && smpSlot.mainProctorId && smaSlot.mainProctorId === smpSlot.mainProctorId) ||
          smaTeacherClean === smpTeacherClean ||
          (smaTeacherClean.length >= 4 && smpTeacherClean.length >= 4 && (smaTeacherClean.includes(smpTeacherClean) || smpTeacherClean.includes(smaTeacherClean)));

        if (isSameTeacher) {
          // Identify teachers who are completely free during this session in both schools
          const busyIdsOrNames = new Set<string>();
          overlappingSmpSlots.forEach((s) => {
            busyIdsOrNames.add(s.mainProctorId);
            busyIdsOrNames.add(this.normalizeTeacherName(s.mainProctorName));
          });
          busyIdsOrNames.add(smaSlot.mainProctorId);
          busyIdsOrNames.add(smaTeacherClean);

          const freeTeachers = allSmpTeachers.filter((t) => {
            const tNorm = this.normalizeTeacherName(t.fullName);
            return !busyIdsOrNames.has(t.userId) && !busyIdsOrNames.has(tNorm);
          });

          const smpCanonical = CANONICAL_SMP_SLOTS.find(
            (c) =>
              (c.date === smpSlot.date || c.dayName.toLowerCase() === smpSlot.dayName.toLowerCase()) &&
              c.sessionNumber === smpSlot.sessionNumber &&
              c.roomName === smpSlot.roomName
          );
          const smaCanonical = CANONICAL_SMA_SLOTS.find(
            (c) =>
              (c.date === smaSlot.date || c.dayName.toLowerCase() === smaSlot.dayName.toLowerCase()) &&
              c.sessionNumber === smaSlot.sessionNumber
          );

          conflicts.push({
            dayName: smaSlot.dayName,
            date: smaSlot.date,
            sessionNumber: smaSlot.sessionNumber,
            timeRange: `${smaSlot.startTime || '09:30'} - ${smaSlot.endTime || '11:00'}`,
            teacherId: smaSlot.mainProctorId,
            teacherName: smaSlot.mainProctorName,
            smpDuty: {
              roomName: smpSlot.roomName,
              className: smpSlot.className || '-',
              subject: smpSlot.subject,
              proctorCode: smpCanonical?.proctorCode || '08',
            },
            smaDuty: {
              roomName: smaSlot.roomName,
              className: smaSlot.className || '10, 11, 12',
              subject: smaSlot.subject,
              proctorCode: smaCanonical?.proctorCode || '05',
            },
            availableReplacementTeachers: freeTeachers,
          });
        }
      });
    });

    return conflicts;
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
