import React, { useEffect, useState } from 'react';
import { useSyncQueueStore } from '../../store/useSyncQueueStore';
import { SyncEngine } from '../../services/sync-engine.service';
import { RefreshCw, X, Trash2, CheckCircle2 } from 'lucide-react';

export const QueueMonitor: React.FC = () => {
  const { pendingItems, syncState, lastSyncedCount, lastError } = useSyncQueueStore();
  const [isDismissed, setIsDismissed] = useState(false);
  const [prevCount, setPrevCount] = useState(pendingItems.length);

  useEffect(() => {
    SyncEngine.initAutoSync();
  }, []);

  // Reset status tutup jika ada item antrean offline baru yang masuk
  useEffect(() => {
    if (pendingItems.length > prevCount) {
      setIsDismissed(false);
    }
    setPrevCount(pendingItems.length);
  }, [pendingItems.length, prevCount]);

  // Otomatis sembunyikan notifikasi sukses setelah 3 detik
  useEffect(() => {
    if (syncState === 'SUCCESS') {
      const timer = setTimeout(() => {
        useSyncQueueStore.getState().setSyncState('IDLE');
        useSyncQueueStore.getState().setLastSyncedCount(0);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [syncState]);

  // Jika ditutup pengguna atau antrean sudah 0 dan tidak sedang menampilkan sukses, sembunyikan banner
  if (isDismissed || (pendingItems.length === 0 && syncState !== 'SUCCESS')) {
    return null;
  }

  const isSyncing = syncState === 'SYNCING';

  return (
    <aside
      aria-label="Notifikasi Sinkronisasi Presensi Offline"
      className="fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-md pointer-events-auto transition-all duration-300 animate-in fade-in slide-in-from-top-4"
    >
      <div className="bg-[#023246] text-white rounded-2xl p-3 sm:p-3.5 shadow-2xl border border-emerald-500/30 flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center shrink-0">
            {isSyncing ? (
              <RefreshCw className="w-4 h-4 text-emerald-400 animate-spin" />
            ) : (
              <span className="text-sm">📶</span>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="font-extrabold text-white text-xs truncate flex items-center gap-1.5">
              <span>{pendingItems.length} Absensi Offline</span>
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Lokal HP
              </span>
            </h4>
            <p className="text-[10px] text-slate-300 truncate mt-0.5">
              {isSyncing
                ? 'Sedang mengirim data ke server...'
                : lastError
                ? `Kendala: ${lastError}`
                : 'Tersimpan di HP • Klik sync saat ada internet'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => SyncEngine.processSyncQueue()}
            disabled={isSyncing}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white font-extrabold text-[11px] rounded-xl disabled:opacity-50 transition-all flex items-center gap-1 cursor-pointer shadow-sm"
          >
            <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              if (window.confirm('Bersihkan antrean absensi offline yang tersimpan di HP ini?')) {
                SyncEngine.clearQueue();
              }
            }}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            title="Bersihkan antrean offline yang macet"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() => setIsDismissed(true)}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all cursor-pointer"
            title="Tutup banner ini"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {syncState === 'SUCCESS' && lastSyncedCount > 0 && (
        <div className="mt-1.5 bg-emerald-600 text-white text-[11px] font-bold px-3 py-1.5 rounded-xl text-center shadow-md flex items-center justify-center gap-1.5 animate-in fade-in">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>{lastSyncedCount} data absensi offline berhasil dikirim ke server!</span>
        </div>
      )}
    </aside>
  );
};
