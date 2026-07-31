import React, { useEffect } from 'react';
import { useSyncQueueStore } from '../../store/useSyncQueueStore';
import { SyncEngine } from '../../services/sync-engine.service';

export const QueueMonitor: React.FC = () => {
  const { pendingItems, syncState, lastSyncedCount } = useSyncQueueStore();

  useEffect(() => {
    SyncEngine.initAutoSync();
  }, []);

  if (pendingItems.length === 0 && syncState === 'IDLE') return null;

  return (
    <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-card space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔄</span>
          <div>
            <h4 className="font-extrabold text-slate-900 text-xs">Status Sinkronisasi Offline</h4>
            <p className="text-[11px] text-slate-500">
              {pendingItems.length} transaksi mengantre di IndexedDB
            </p>
          </div>
        </div>

        <button
          onClick={() => SyncEngine.processSyncQueue()}
          disabled={syncState === 'SYNCING'}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl disabled:opacity-50 transition-colors"
        >
          {syncState === 'SYNCING' ? 'Syncing...' : '⚡ Sync Sekarang'}
        </button>
      </div>

      {syncState === 'SYNCING' && (
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div className="bg-emerald-500 h-full w-full animate-pulse" />
        </div>
      )}

      {syncState === 'SUCCESS' && lastSyncedCount > 0 && (
        <p className="text-xs text-emerald-600 font-bold flex items-center gap-1">
          <span>✓</span> {lastSyncedCount} data absensi berhasil disinkronkan.
        </p>
      )}
    </div>
  );
};
