/**
 * SMART ABSENSI GURU - DEXIE.JS OFFLINE DATABASE & SYNC TEST SUITE
 */

import { dexieDB } from '../../lib/dexie-db.lib';
import { indexedDBService } from '../indexed-db.service';
import { OfflineSyncService } from '../offline-sync.service';
import type { UserProfile, TeachingSlot } from '../../types/database.types';

export const runDexieOfflineSyncTestSuite = async (): Promise<{
  passed: number;
  failed: number;
  results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }>;
}> => {
  const results: Array<{ testName: string; status: 'PASS' | 'FAIL'; details?: string }> = [];
  let passed = 0;
  let failed = 0;

  const assert = (testName: string, condition: boolean, details?: string) => {
    if (condition) {
      passed++;
      results.push({ testName, status: 'PASS', details });
    } else {
      failed++;
      results.push({ testName, status: 'FAIL', details });
    }
  };

  try {
    // Test 1: Dexie DB Schema Tables Definition
    assert(
      'Dexie - Database Schema Tables Initialized Properly',
      dexieDB !== null &&
      typeof dexieDB.offline_attendance_queue !== 'undefined' &&
      typeof dexieDB.cached_teachers !== 'undefined' &&
      typeof dexieDB.cached_schedules !== 'undefined' &&
      typeof dexieDB.cached_students !== 'undefined',
      'Tables verified: queue, teachers, schedules, students'
    );

    // Test 2: OfflineSyncService getStats Method
    const stats = await OfflineSyncService.getStats();
    assert(
      'Dexie - OfflineSyncService Returns Structured Statistics',
      typeof stats.isOnline === 'boolean' &&
      typeof stats.pendingCount === 'number' &&
      typeof stats.totalCachedTeachers === 'number',
      `Online: ${stats.isOnline}, Pending: ${stats.pendingCount}, Teachers: ${stats.totalCachedTeachers}`
    );

    // Test 3: IndexedDB Service Graceful Enqueue Fallback
    const mockRecord = {
      id: 'off_test_123',
      user_id: 'usr_t1',
      qr_seed: 'seed_abc',
      user_lat: -6.123456,
      user_lng: 106.123456,
      distance_meters: 15,
      timestamp: new Date().toISOString(),
      sync_status: 'PENDING' as const,
      retry_count: 0,
      attempt_action: 'CHECK_IN' as const,
    };

    let enqueueError: string | null = null;
    try {
      await indexedDBService.enqueue(mockRecord);
    } catch (e) {
      enqueueError = (e as Error).message;
    }
    assert(
      'Dexie - Enqueue Operates Without Unhandled Rejections',
      enqueueError === null,
      'Enqueue completed safely'
    );

    // Test 4: Master Data Cache Transformation
    const mockTeachers: UserProfile[] = [
      {
        id: 'usr_t1',
        nip: '198501012010011001',
        full_name: 'Drs. Suparman, M.Pd.',
        phone_number: '081234567890',
        role: 'GURU',
        position: 'Guru Fisika Senior',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];

    let cacheError: string | null = null;
    try {
      await OfflineSyncService.cacheTeachers(mockTeachers);
    } catch (e) {
      cacheError = (e as Error).message;
    }
    assert(
      'Dexie - Teacher Cache Handles Bulk Insertion Gracefully',
      cacheError === null,
      'Cached teacher record transformed successfully'
    );

    // Test 5: Teaching Schedule Cache Transformation
    const mockSchedules: TeachingSlot[] = [
      {
        id: 'sched_1',
        teacher_user_id: 'usr_t1',
        day_of_week: 1,
        day: 'Senin',
        start_time: '07:30',
        end_time: '08:50',
        time: '07:30 - 08:50',
        subject: 'Fisika Terapan',
        className: 'Kelas X-A',
        room: 'Lab Fisika',
        version: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    let schedError: string | null = null;
    try {
      await OfflineSyncService.cacheSchedules(mockSchedules);
    } catch (e) {
      schedError = (e as Error).message;
    }
    assert(
      'Dexie - Schedule Cache Handles Bulk Insertion Gracefully',
      schedError === null,
      'Cached schedule record transformed successfully'
    );

    // Test 5b: Student Cache Transformation
    const mockStudents = [
      {
        id: 'std_1',
        nisn: '1234567890',
        fullName: 'Ahmad Fauzi',
        className: 'Kelas X-A',
        gender: 'L' as const,
        rfidUid: 'RF123456',
        cardStatus: 'ACTIVE' as const,
      },
    ];

    let studentCacheError: string | null = null;
    try {
      await OfflineSyncService.cacheStudents(mockStudents);
    } catch (e) {
      studentCacheError = (e as Error).message;
    }
    assert(
      'Dexie - Student Cache Handles Bulk Insertion Gracefully',
      studentCacheError === null,
      'Cached student record transformed successfully'
    );

    // Test 6: Background Sync Execution Contract
    const syncRes = await OfflineSyncService.syncPendingAttendanceQueue();
    assert(
      'Dexie - Background Sync Execution Contract Upheld',
      typeof syncRes.synced === 'number' && typeof syncRes.failed === 'number',
      `Synced: ${syncRes.synced}, Failed: ${syncRes.failed}`
    );
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    assert('Dexie - Test Suite Execution Error', false, errMsg);
  }

  return { passed, failed, results };
};
