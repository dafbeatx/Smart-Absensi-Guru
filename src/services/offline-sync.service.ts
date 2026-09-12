/**
 * SMART ABSENSI GURU - OFFLINE SYNC SERVICE (DEXIE.JS)
 * Automates Background Sync, Cache Management, and Network State Tracking for PWA
 */

import { dexieDB, type CachedTeacher, type CachedSchedule, type CachedStudent } from '../lib/dexie-db.lib';
import { indexedDBService } from './indexed-db.service';
import { ProviderFactory } from '../providers/provider-factory';
import { useAuthStore } from '../store/useAuthStore';
import type { UserProfile, TeachingSlot, StudentItem } from '../types/database.types';

export interface OfflineSyncStats {
  isOnline: boolean;
  pendingCount: number;
  syncingCount: number;
  failedCount: number;
  totalCachedTeachers: number;
  totalCachedStudents: number;
  lastSyncAt: string | null;
}

type SyncStateListener = (stats: OfflineSyncStats) => void;

export class OfflineSyncService {
  private static listeners: Set<SyncStateListener> = new Set();
  private static isSyncingInProgress = false;
  private static lastSyncAt: string | null = null;
  private static initialized = false;

  /**
   * Initialize network event listeners for automated background sync
   */
  public static init(): void {
    if (this.initialized || typeof window === 'undefined') return;
    this.initialized = true;

    window.addEventListener('online', () => {
      this.notifyListeners();
      this.syncPendingAttendanceQueue();
    });

    window.addEventListener('offline', () => {
      this.notifyListeners();
    });

    // Initial check and auto-sync if already online
    const isCurrentlyOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    if (isCurrentlyOnline) {
      setTimeout(() => this.syncPendingAttendanceQueue(), 2000);
    }
  }

  /**
   * Subscribe to offline sync state updates
   */
  public static subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    this.getStats().then(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private static async notifyListeners(): Promise<void> {
    const stats = await this.getStats();
    for (const listener of this.listeners) {
      try {
        listener(stats);
      } catch (e) {
        console.warn('Error in sync listener:', e);
      }
    }
  }

  /**
   * Get current offline queue & cache statistics
   */
  public static async getStats(): Promise<OfflineSyncStats> {
    const isOnline = typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' ? navigator.onLine : true;
    let pendingCount = 0;
    let syncingCount = 0;
    let failedCount = 0;
    let totalCachedTeachers = 0;
    let totalCachedStudents = 0;

    try {
      if (typeof indexedDB !== 'undefined') {
        pendingCount = await dexieDB.offline_attendance_queue.where('sync_status').equals('PENDING').count();
        syncingCount = await dexieDB.offline_attendance_queue.where('sync_status').equals('SYNCING').count();
        failedCount = await dexieDB.offline_attendance_queue.where('sync_status').equals('FAILED').count();
        totalCachedTeachers = await dexieDB.cached_teachers.count();
        totalCachedStudents = await dexieDB.cached_students.count();
      }
    } catch {
      // Ignored in non-browser env
    }

    return {
      isOnline,
      pendingCount,
      syncingCount,
      failedCount,
      totalCachedTeachers,
      totalCachedStudents,
      lastSyncAt: this.lastSyncAt,
    };
  }

  // ── MASTER DATA CACHING (DEXIE) ──────────────────────────────────────────

  /**
   * Cache teachers data into Dexie for instant offline boot
   */
  public static async cacheTeachers(teachers: UserProfile[]): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined' || !Array.isArray(teachers) || teachers.length === 0) return;
      const now = new Date().toISOString();
      const records: CachedTeacher[] = teachers.map((t) => ({
        id: t.id,
        nip: t.nip || null,
        full_name: t.full_name,
        phone_number: t.phone_number || '',
        role: t.role,
        position: t.position || 'Guru',
        avatar_url: t.avatar_url || null,
        is_active: t.is_active !== false,
        updated_at: now,
      }));
      await dexieDB.cached_teachers.bulkPut(records);
      this.notifyListeners();
    } catch (e) {
      console.warn('Gagal menyimpan cache guru ke Dexie:', e);
    }
  }

  /**
   * Get cached teachers from Dexie
   */
  public static async getCachedTeachers(): Promise<CachedTeacher[]> {
    try {
      if (typeof indexedDB === 'undefined') return [];
      return await dexieDB.cached_teachers.toArray();
    } catch {
      return [];
    }
  }

  /**
   * Cache teaching schedules into Dexie
   */
  public static async cacheSchedules(schedules: TeachingSlot[]): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined' || !Array.isArray(schedules) || schedules.length === 0) return;
      const now = new Date().toISOString();
      const records: CachedSchedule[] = schedules.map((s) => ({
        id: s.id,
        teacher_user_id: s.teacher_user_id || s.user_id || '',
        day_of_week: typeof s.day_of_week === 'number' ? s.day_of_week : 1,
        day: s.day || '',
        start_time: s.start_time || '',
        end_time: s.end_time || '',
        time: s.time || `${s.start_time || ''} - ${s.end_time || ''}`,
        subject: s.subject || '',
        class_name: s.class_name || s.className || '',
        room: s.room || '',
        updated_at: now,
      }));
      await dexieDB.cached_schedules.bulkPut(records);
    } catch (e) {
      console.warn('Gagal menyimpan cache jadwal ke Dexie:', e);
    }
  }

  /**
   * Get cached schedules by teacher
   */
  public static async getCachedSchedules(teacherId?: string): Promise<CachedSchedule[]> {
    try {
      if (typeof indexedDB === 'undefined') return [];
      if (teacherId) {
        return await dexieDB.cached_schedules.where('teacher_user_id').equals(teacherId).toArray();
      }
      return await dexieDB.cached_schedules.toArray();
    } catch {
      return [];
    }
  }

  /**
   * Cache students directory into Dexie
   */
  public static async cacheStudents(students: StudentItem[]): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined' || !Array.isArray(students) || students.length === 0) return;
      const now = new Date().toISOString();
      const records: CachedStudent[] = students.map((s) => ({
        id: s.id,
        nisn: s.nisn,
        rfid_uid: s.rfidUid || null,
        full_name: s.fullName || '',
        class_name: s.className || '',
        gender: s.gender || 'L',
        points: 100,
        updated_at: now,
      }));
      await dexieDB.cached_students.bulkPut(records);
      this.notifyListeners();
    } catch (e) {
      console.warn('Gagal menyimpan cache siswa ke Dexie:', e);
    }
  }

  /**
   * Get cached students from Dexie
   */
  public static async getCachedStudents(): Promise<CachedStudent[]> {
    try {
      if (typeof indexedDB === 'undefined') return [];
      return await dexieDB.cached_students.toArray();
    } catch {
      return [];
    }
  }

  // ── BACKGROUND SYNC ENGINE ───────────────────────────────────────────────

  /**
   * Execute background synchronization of all pending offline attendance records
   */
  public static async syncPendingAttendanceQueue(): Promise<{
    synced: number;
    failed: number;
  }> {
    if (this.isSyncingInProgress) {
      return { synced: 0, failed: 0 };
    }

    if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean' && !navigator.onLine) {
      return { synced: 0, failed: 0 };
    }

    this.isSyncingInProgress = true;
    let syncedCount = 0;
    let failedCount = 0;

    try {
      const pendingQueue = await indexedDBService.getPendingQueue();
      if (pendingQueue.length === 0) {
        return { synced: 0, failed: 0 };
      }

      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';

      for (const record of pendingQueue) {
        try {
          await indexedDBService.updateStatus(record.id, 'SYNCING');

          const res = await provider.scanAttendance({
            token,
            user_id: record.user_id,
            qr_seed: record.qr_seed,
            user_lat: record.user_lat,
            user_lng: record.user_lng,
            device_uuid: 'offline_pwa_sync',
            distance_meters: record.distance_meters,
            gps_accuracy: record.gps_accuracy,
            verification_method: 'QR_GPS',
            attendance_source: 'OFFLINE_SYNC',
            attempt_action: record.attempt_action || 'CHECK_IN',
          });

          if (res && res.attendance_id) {
            await indexedDBService.remove(record.id);
            syncedCount++;
          } else {
            record.retry_count = (record.retry_count || 0) + 1;
            await dexieDB.offline_attendance_queue.update(record.id, {
              sync_status: 'FAILED',
              retry_count: record.retry_count,
            });
            failedCount++;
          }
        } catch (itemError) {
          console.warn('Sync failed for item:', record.id, itemError);
          await dexieDB.offline_attendance_queue.update(record.id, {
            sync_status: 'FAILED',
            retry_count: (record.retry_count || 0) + 1,
          });
          failedCount++;
        }
      }

      if (syncedCount > 0) {
        this.lastSyncAt = new Date().toISOString();
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smart_absensi_records_updated'));
          window.dispatchEvent(new CustomEvent('smart_absensi_scanned'));
        }
      }
    } catch (err) {
      console.warn('Background sync error:', err);
    } finally {
      this.isSyncingInProgress = false;
      this.notifyListeners();
    }

    return { synced: syncedCount, failed: failedCount };
  }
}
