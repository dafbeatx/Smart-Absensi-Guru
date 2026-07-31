import { indexedDBService } from './indexed-db.service';
import type { OfflineAttendanceRecord } from './indexed-db.service';
import { ProviderFactory } from '../providers/provider-factory';
import { useSyncQueueStore } from '../store/useSyncQueueStore';
import { useToastStore } from '../store/useToastStore';

export class SyncEngine {
  private static isSyncing = false;

  /**
   * Initializes background sync listeners and interval fallback
   */
  public static initAutoSync(): void {
    // Listener for network reconnection
    window.addEventListener('online', () => {
      console.info('🌐 Network Reconnected. Triggering Sync Engine...');
      SyncEngine.processSyncQueue();
    });

    // Interval fallback every 60 seconds
    setInterval(() => {
      if (navigator.onLine) {
        SyncEngine.processSyncQueue();
      }
    }, 60000);

    // Initial check
    SyncEngine.refreshQueueState();
  }

  /**
   * Refresh pending queue count in global store
   */
  public static async refreshQueueState(): Promise<void> {
    try {
      const pending = await indexedDBService.getPendingQueue();
      useSyncQueueStore.getState().setPendingItems(pending);
    } catch (err) {
      console.error('Failed to refresh queue state:', err);
    }
  }

  /**
   * Processes all pending offline attendance records using exponential backoff retries
   */
  public static async processSyncQueue(): Promise<void> {
    if (SyncEngine.isSyncing || !navigator.onLine) return;

    SyncEngine.isSyncing = true;
    const store = useSyncQueueStore.getState();
    store.setSyncState('SYNCING');
    store.setLastError(null);

    try {
      const pendingItems = await indexedDBService.getPendingQueue();
      if (pendingItems.length === 0) {
        store.setSyncState('IDLE');
        SyncEngine.isSyncing = false;
        return;
      }

      const provider = ProviderFactory.getProvider();
      let syncedCount = 0;

      for (const item of pendingItems as OfflineAttendanceRecord[]) {
        try {
          await provider.scanAttendance({
            token: 'SYNC_OFFLINE_TOKEN',
            qr_seed: item.qr_seed,
            user_lat: item.user_lat,
            user_lng: item.user_lng,
            device_uuid: item.user_id,
          });

          // Remove successfully synced item from IndexedDB
          await indexedDBService.remove(item.id);
          syncedCount++;
        } catch (err) {
          console.error(`Failed to sync item ${item.id}:`, err);
          // Increment retry count in IndexedDB
          item.retry_count = (item.retry_count || 0) + 1;
          if (item.retry_count > 5) {
            item.sync_status = 'FAILED';
          }
          await indexedDBService.enqueue(item);
        }
      }

      await SyncEngine.refreshQueueState();

      if (syncedCount > 0) {
        store.setLastSyncedCount(syncedCount);
        store.setSyncState('SUCCESS');
        useToastStore
          .getState()
          .showToast(
            'success',
            'Sinkronisasi Berhasil!',
            `${syncedCount} data absensi offline berhasil dikirim ke server.`
          );
      } else {
        store.setSyncState('IDLE');
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Gagal sinkronisasi data';
      store.setLastError(errorMessage);
      store.setSyncState('FAILED');
    } finally {
      SyncEngine.isSyncing = false;
    }
  }
}
