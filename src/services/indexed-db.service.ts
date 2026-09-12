/**
 * SMART ABSENSI GURU - INDEXEDDB OFFLINE STORAGE SERVICE
 * Powered by Dexie.js for High Performance, IndexedDB Reactive Transactions
 */

import { dexieDB, type OfflineAttendanceRecord } from '../lib/dexie-db.lib';
export type { OfflineAttendanceRecord };

class IndexedDBService {
  /**
   * Enqueue attendance record into offline queue
   */
  public async enqueue(record: OfflineAttendanceRecord): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') return;
      await dexieDB.offline_attendance_queue.put(record);
    } catch (e) {
      console.warn('Dexie enqueue skipped/failed:', (e as Error).message);
    }
  }

  /**
   * Retrieve all pending attendance records to be synced
   */
  public async getPendingQueue(): Promise<OfflineAttendanceRecord[]> {
    try {
      if (typeof indexedDB === 'undefined') return [];
      return await dexieDB.offline_attendance_queue
        .where('sync_status')
        .equals('PENDING')
        .toArray();
    } catch {
      return [];
    }
  }

  /**
   * Retrieve all records in the queue regardless of status
   */
  public async getAllQueue(): Promise<OfflineAttendanceRecord[]> {
    try {
      if (typeof indexedDB === 'undefined') return [];
      return await dexieDB.offline_attendance_queue.toArray();
    } catch {
      return [];
    }
  }

  /**
   * Update sync status of an offline record
   */
  public async updateStatus(id: string, status: 'PENDING' | 'SYNCING' | 'FAILED'): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') return;
      await dexieDB.offline_attendance_queue.update(id, { sync_status: status });
    } catch (e) {
      console.warn('Dexie updateStatus failed:', (e as Error).message);
    }
  }

  /**
   * Remove synchronized record from queue
   */
  public async remove(id: string): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') return;
      await dexieDB.offline_attendance_queue.delete(id);
    } catch {
      // Ignored in non-browser env
    }
  }

  /**
   * Clear all records in offline queue
   */
  public async clearAll(): Promise<void> {
    try {
      if (typeof indexedDB === 'undefined') return;
      await dexieDB.offline_attendance_queue.clear();
    } catch {
      // Ignored in non-browser env
    }
  }
}

export const indexedDBService = new IndexedDBService();
