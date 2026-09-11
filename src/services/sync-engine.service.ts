import { indexedDBService } from './indexed-db.service';
import type { OfflineAttendanceRecord } from './indexed-db.service';
import { ProviderFactory } from '../providers/provider-factory';
import { useSyncQueueStore } from '../store/useSyncQueueStore';
import { useAuthStore } from '../store/useAuthStore';
import { useToastStore } from '../store/useToastStore';

export class SyncEngine {
  private static isSyncing = false;
  private static isInitialized = false;

  /**
   * Initializes background sync listeners and interval fallback
   */
  public static initAutoSync(): void {
    if (SyncEngine.isInitialized) return;
    SyncEngine.isInitialized = true;

    // Listener for network reconnection
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        console.info('🌐 Network Reconnected. Triggering Sync Engine...');
        SyncEngine.processSyncQueue();
      });

      // Interval fallback every 60 seconds
      setInterval(() => {
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          SyncEngine.processSyncQueue();
        }
      }, 60000);
    }

    // Initial check
    SyncEngine.refreshQueueState();
  }

  /**
   * Refresh pending queue count in global store
   */
  public static async refreshQueueState(): Promise<void> {
    try {
      const pending = await indexedDBService.getPendingQueue();
      useSyncQueueStore.getState().setPendingItems(pending || []);
    } catch (err) {
      console.error('Failed to refresh queue state:', err);
    }
  }

  /**
   * Clears all offline attendance records from local IndexedDB
   */
  public static async clearQueue(): Promise<void> {
    try {
      await indexedDBService.clearAll();
      useSyncQueueStore.getState().setPendingItems([]);
      useSyncQueueStore.getState().setSyncState('IDLE');
      useSyncQueueStore.getState().setLastError(null);
      useSyncQueueStore.getState().setLastSyncedCount(0);
      useToastStore
        .getState()
        .showToast(
          'info',
          'Antrean Dibersihkan',
          'Antrean absensi offline di HP telah berhasil dikosongkan.'
        );
    } catch (err) {
      console.error('Failed to clear offline queue:', err);
    }
  }

  /**
   * Processes all pending offline attendance records using smart retries and error resolution
   */
  public static async processSyncQueue(): Promise<void> {
    if (SyncEngine.isSyncing) return;

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      useToastStore.getState().showToast(
        'warning',
        'Sedang Offline',
        'Perangkat tidak terhubung ke internet. Sinkronisasi akan otomatis berjalan saat online.'
      );
      return;
    }

    SyncEngine.isSyncing = true;
    const store = useSyncQueueStore.getState();
    store.setSyncState('SYNCING');
    store.setLastError(null);

    try {
      const pendingItems = await indexedDBService.getPendingQueue();
      if (!pendingItems || pendingItems.length === 0) {
        store.setPendingItems([]);
        store.setSyncState('IDLE');
        SyncEngine.isSyncing = false;
        return;
      }

      const provider = ProviderFactory.getProvider();
      const currentSessionUser = useAuthStore.getState().user;
      let syncedCount = 0;
      let prunedCount = 0;

      for (const item of pendingItems as OfflineAttendanceRecord[]) {
        try {
          // Resolve effective user ID
          const effectiveUserId =
            item.user_id && item.user_id !== 'usr_offline'
              ? item.user_id
              : currentSessionUser?.id || item.user_id;

          const itemAgeMs = item.timestamp ? Date.now() - new Date(item.timestamp).getTime() : 0;

          // Hapus record yang terlalu usang (> 30 hari)
          if (itemAgeMs > 30 * 24 * 60 * 60 * 1000) {
            await indexedDBService.remove(item.id);
            prunedCount++;
            continue;
          }

          // Jika user id tidak ada dan tidak ada user login aktif
          if (!effectiveUserId || effectiveUserId === 'usr_offline') {
            if ((item.retry_count || 0) >= 3) {
              await indexedDBService.remove(item.id);
              prunedCount++;
            } else {
              item.retry_count = (item.retry_count || 0) + 1;
              await indexedDBService.enqueue(item);
            }
            continue;
          }

          await provider.scanAttendance({
            token: `SYNC_${effectiveUserId}_TOKEN`,
            qr_seed: item.qr_seed,
            user_lat: item.user_lat,
            user_lng: item.user_lng,
            device_uuid: effectiveUserId,
            user_id: effectiveUserId,
            timestamp: item.timestamp,
            gps_accuracy: item.gps_accuracy,
            distance_meters: item.distance_meters || 10,
            attendance_source: 'OFFLINE_SYNC',
            attempt_action: item.attempt_action || (item.qr_seed?.includes('CHECK_OUT') ? 'CHECK_OUT' : undefined),
          });

          // Hapus item yang berhasil dari IndexedDB
          await indexedDBService.remove(item.id);
          syncedCount++;
        } catch (err: unknown) {
          const errMsg = err instanceof Error ? err.message : String(err);
          console.warn(`SyncEngine: Failed to sync item ${item.id}:`, errMsg);

          // Jika pesan error menandakan absensi sudah tercatat / sudah lengkap di server
          const isAlreadyDone =
            errMsg.toLowerCase().includes('already') ||
            errMsg.toLowerCase().includes('sudah') ||
            errMsg.toLowerCase().includes('lengkap') ||
            errMsg.toLowerCase().includes('duplicate') ||
            errMsg.toLowerCase().includes('tercatat');

          if (isAlreadyDone) {
            await indexedDBService.remove(item.id);
            syncedCount++;
            continue;
          }

          item.retry_count = (item.retry_count || 0) + 1;

          // Jika gagal berulang kali (>= 3 kali) atau akun tidak valid, bersihkan agar tidak mengunci antrean
          if (
            item.retry_count >= 3 ||
            errMsg.toLowerCase().includes('tidak ditemukan') ||
            errMsg.toLowerCase().includes('not found')
          ) {
            console.warn(`SyncEngine: Pruning failed item ${item.id} after ${item.retry_count} retries`);
            await indexedDBService.remove(item.id);
            prunedCount++;
          } else {
            await indexedDBService.enqueue(item);
          }
        }
      }

      await SyncEngine.refreshQueueState();

      if (syncedCount > 0 || prunedCount > 0) {
        store.setLastSyncedCount(syncedCount);
        store.setSyncState('SUCCESS');

        // Dispatch real-time events to update Admin & Guru views
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('smart_absensi_scanned'));
          window.dispatchEvent(new CustomEvent('smart_absensi_records_updated'));
          window.dispatchEvent(new Event('storage'));
        }

        if (syncedCount > 0) {
          useToastStore
            .getState()
            .showToast(
              'success',
              'Sinkronisasi Berhasil!',
              `${syncedCount} data absensi offline berhasil dikirim ke server.`
            );
        } else if (prunedCount > 0) {
          useToastStore
            .getState()
            .showToast(
              'info',
              'Antrean Diperbarui',
              `${prunedCount} data offline kadaluarsa/tidak valid telah dibersihkan.`
            );
        }
      } else {
        store.setSyncState('IDLE');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal sinkronisasi data';
      store.setLastError(errorMessage);
      store.setSyncState('FAILED');
    } finally {
      SyncEngine.isSyncing = false;
      await SyncEngine.refreshQueueState();
    }
  }
}
