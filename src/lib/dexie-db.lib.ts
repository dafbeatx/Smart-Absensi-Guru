/**
 * SMART ABSENSI GURU - DEXIE.JS DATABASE SCHEMA
 * High-performance, reactive client-side database for PWA Offline mode
 */

import Dexie, { type Table } from 'dexie';

export interface OfflineAttendanceRecord {
  id: string;
  user_id: string;
  qr_seed: string;
  user_lat: number;
  user_lng: number;
  distance_meters: number;
  gps_accuracy?: number;
  timestamp: string;
  sync_status: 'PENDING' | 'SYNCING' | 'FAILED';
  retry_count: number;
  attempt_action?: 'CHECK_IN' | 'CHECK_OUT';
}

export interface CachedTeacher {
  id: string;
  nip: string | null;
  full_name: string;
  phone_number: string;
  role: string;
  position: string;
  avatar_url: string | null;
  is_active: boolean;
  updated_at: string;
}

export interface CachedSchedule {
  id: string;
  teacher_user_id: string;
  day_of_week: number;
  day: string;
  start_time: string;
  end_time: string;
  time: string;
  subject: string;
  class_name: string;
  room: string;
  updated_at: string;
}

export interface CachedStudent {
  id: string;
  nisn: string;
  rfid_uid: string | null;
  full_name: string;
  class_name: string;
  gender: string;
  points: number;
  updated_at: string;
}

export interface CachedAttendance {
  id: string;
  user_id: string;
  date: string;
  check_in_time: string | null;
  check_out_time: string | null;
  status: string;
  verification_method: string;
  updated_at: string;
}

export class SmartAbsensiDexieDB extends Dexie {
  offline_attendance_queue!: Table<OfflineAttendanceRecord, string>;
  cached_teachers!: Table<CachedTeacher, string>;
  cached_schedules!: Table<CachedSchedule, string>;
  cached_students!: Table<CachedStudent, string>;
  cached_attendance!: Table<CachedAttendance, string>;

  constructor() {
    super('SmartAbsensiDexieDB');

    // Schema definition for Dexie IndexedDB
    this.version(1).stores({
      offline_attendance_queue: 'id, user_id, sync_status, timestamp',
      cached_teachers: 'id, nip, role, is_active',
      cached_schedules: 'id, teacher_user_id, day_of_week',
      cached_students: 'id, nisn, rfid_uid, class_name',
      cached_attendance: 'id, user_id, date, status',
    });
  }
}

export const dexieDB = new SmartAbsensiDexieDB();
