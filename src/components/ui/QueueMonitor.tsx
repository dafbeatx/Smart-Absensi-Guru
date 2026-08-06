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
    <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 animate-bounce-once">
      <div className="bg-slate-900 text-white rounded-2xl p-3.5 shadow-2xl border border-emerald-500/40 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            <span className="text-base animate-spin">📶</span>
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-white text-xs truncate">
              {pendingItems.length} Absensi Offline Mengantre
            </h4>
            <p className="text-[10px] text-slate-300 truncate">
              {syncState === 'SYNCING'
                ? 'Sedang menyinkronkan ke server...'
                : 'Akan otomatis terkirim saat ada internet/WiFi'}
            </p>
          </div>
        </div>

        <button
          onClick={() => SyncEngine.processSyncQueue()}
          disabled={syncState === 'SYNCING'}
          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-[11px] rounded-xl disabled:opacity-50 transition-all shrink-0 cursor-pointer shadow-md"
        >
          {syncState === 'SYNCING' ? 'Syncing...' : '⚡ Sync'}
        </button>
      </div>

      {syncState === 'SUCCESS' && lastSyncedCount > 0 && (
        <div className="mt-1 bg-emerald-700 text-white text-[10px] font-bold px-3 py-1 rounded-xl text-center shadow-md animate-fade-in">
          ✓ {lastSyncedCount} data absensi offline berhasil dikirim!
        </div>
      )}
    </div>
  );
};
