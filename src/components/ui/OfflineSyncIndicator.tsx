/**
 * SMART ABSENSI GURU - OFFLINE SYNC STATUS INDICATOR (DEXIE.JS)
 * Displays reactive online/offline state and pending background sync queue status
 */

import React, { useEffect, useState } from 'react';
import { WifiOff, RefreshCw, Database } from 'lucide-react';
import { OfflineSyncService, type OfflineSyncStats } from '../../services/offline-sync.service';
import { useToastStore } from '../../store/useToastStore';

export const OfflineSyncIndicator: React.FC = () => {
  const { showToast } = useToastStore();
  const [stats, setStats] = useState<OfflineSyncStats>({
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    pendingCount: 0,
    syncingCount: 0,
    failedCount: 0,
    totalCachedTeachers: 0,
    totalCachedStudents: 0,
    lastSyncAt: null,
  });
  const [isManualSyncing, setIsManualSyncing] = useState(false);

  useEffect(() => {
    OfflineSyncService.init();
    const unsubscribe = OfflineSyncService.subscribe((updatedStats) => {
      setStats(updatedStats);
    });
    return () => unsubscribe();
  }, []);

  const handleManualSync = async () => {
    if (!stats.isOnline) {
      showToast('warning', 'Masih Offline', 'Perangkat sedang tidak terhubung ke internet. Sinkronisasi akan otomatis berjalan saat online.');
      return;
    }
    setIsManualSyncing(true);
    try {
      const res = await OfflineSyncService.syncPendingAttendanceQueue();
      if (res.synced > 0) {
        showToast('success', 'Sinkronisasi Berhasil', `${res.synced} data presensi offline berhasil diunggah ke cloud.`);
      } else if (res.failed > 0) {
        showToast('error', 'Sebagian Gagal', `${res.failed} data gagal disinkronkan. Akan dicoba kembali otomatis.`);
      } else {
        showToast('info', 'Semua Data Tersinkron', 'Tidak ada antrean presensi yang tertunda.');
      }
    } catch {
      showToast('error', 'Gagal Sinkronisasi', 'Terjadi kendala jaringan.');
    } finally {
      setIsManualSyncing(false);
    }
  };

  const totalPending = stats.pendingCount + stats.failedCount;

  // Don't clutter UI if online and no pending queue items
  if (stats.isOnline && totalPending === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-bounce-subtle">
      <div
        className={`px-3 py-2 rounded-2xl border shadow-lg flex items-center gap-2.5 text-xs font-bold transition-all ${
          !stats.isOnline
            ? 'bg-amber-500 text-white border-amber-600 shadow-amber-500/20'
            : totalPending > 0
            ? 'bg-[#023246] text-white border-slate-700 shadow-[#023246]/30'
            : 'bg-emerald-600 text-white border-emerald-700'
        }`}
      >
        {/* Status Icon */}
        {!stats.isOnline ? (
          <div className="flex items-center gap-1.5">
            <WifiOff className="w-4 h-4 text-white animate-pulse" />
            <span>Mode Offline</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <Database className="w-4 h-4 text-emerald-400" />
            <span>Dexie Queue</span>
          </div>
        )}

        {/* Pending counter */}
        {totalPending > 0 && (
          <span className="px-1.5 py-0.5 rounded-full bg-white/20 text-white text-[10px]">
            {totalPending} antrean
          </span>
        )}

        {/* Sync Button */}
        {stats.isOnline && totalPending > 0 && (
          <button
            type="button"
            onClick={handleManualSync}
            disabled={isManualSyncing}
            className="px-2 py-1 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-extrabold flex items-center gap-1 transition-all cursor-pointer shadow-xs"
            title="Kirim antrean offline ke cloud sekarang"
          >
            <RefreshCw className={`w-3 h-3 ${isManualSyncing ? 'animate-spin' : ''}`} />
            <span>{isManualSyncing ? 'Sinkron...' : 'Upload'}</span>
          </button>
        )}
      </div>
    </div>
  );
};
