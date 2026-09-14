import { useEffect, useRef, useCallback } from 'react';
import { ProviderFactory } from '../providers/provider-factory';

export interface UseLiveAttendanceSyncOptions {
  /**
   * Callback to re-fetch attendance and leave data from the backend.
   */
  onSync: () => void;

  /**
   * Minimum interval (ms) between consecutive auto-sync triggers to prevent spam.
   * @default 2000
   */
  debounceMs?: number;

  /**
   * Background heartbeat interval (ms) to ensure guaranteed data freshness even if
   * websocket realtime is temporarily disconnected or disabled on Supabase table publication.
   * Set to 0 to disable periodic heartbeat.
   * @default 30000 (30 seconds)
   */
  heartbeatIntervalMs?: number;

  /**
   * Whether the sync listener is enabled.
   * @default true
   */
  enabled?: boolean;
}

/**
 * useLiveAttendanceSync
 *
 * Provides real-time cross-device data synchronization for Live Tracking dashboards
 * (Admin, Kepsek, and Staff) by combining:
 * 1. Supabase PostgreSQL Realtime subscription (pushes updates instantly from other devices).
 * 2. Local window events (synchronizes across tabs/components on the same device).
 * 3. Visibility & Focus triggers (refreshes immediately when user views the dashboard).
 * 4. Periodic heartbeat fallback (guarantees freshness without manual page reload).
 */
export function useLiveAttendanceSync({
  onSync,
  debounceMs = 2000,
  heartbeatIntervalMs = 30000,
  enabled = true,
}: UseLiveAttendanceSyncOptions): void {
  const onSyncRef = useRef(onSync);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSyncTimeRef = useRef<number>(0);

  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  const scheduleSync = useCallback(() => {
    if (!enabled) return;

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      lastSyncTimeRef.current = Date.now();
      onSyncRef.current();
    }, debounceMs);
  }, [enabled, debounceMs]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;

    // 1. Subscribe to Provider Realtime updates (Supabase Realtime Channel)
    const provider = ProviderFactory.getProvider();
    let unsubscribeRealtime: (() => void) | undefined;

    if (typeof provider.subscribeToAttendanceUpdates === 'function') {
      try {
        unsubscribeRealtime = provider.subscribeToAttendanceUpdates((event) => {
          console.info('📡 [useLiveAttendanceSync] Realtime change received:', event);
          scheduleSync();
        });
      } catch (err) {
        console.warn('⚠️ [useLiveAttendanceSync] Failed to subscribe to provider realtime:', err);
      }
    }

    // 2. Same-device local window events
    const handleLocalUpdate = () => {
      scheduleSync();
    };

    window.addEventListener('smart_absensi_scanned', handleLocalUpdate);
    window.addEventListener('smart_absensi_records_updated', handleLocalUpdate);
    window.addEventListener('smart_absensi_leave_updated', handleLocalUpdate);
    window.addEventListener('smart_absensi_leaves_updated', handleLocalUpdate);
    window.addEventListener('storage', handleLocalUpdate);

    // 3. Tab visibility change & window focus
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastSyncTimeRef.current;
        if (elapsed > 5000) {
          scheduleSync();
        }
      }
    };

    const handleWindowFocus = () => {
      const elapsed = Date.now() - lastSyncTimeRef.current;
      if (elapsed > 5000) {
        scheduleSync();
      }
    };

    const handleOnline = () => {
      scheduleSync();
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener('online', handleOnline);

    // 4. Periodic background heartbeat while tab is active
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    if (heartbeatIntervalMs > 0) {
      heartbeatTimer = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
          scheduleSync();
        }
      }, heartbeatIntervalMs);
    }

    return () => {
      if (unsubscribeRealtime) {
        unsubscribeRealtime();
      }
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
      }
      window.removeEventListener('smart_absensi_scanned', handleLocalUpdate);
      window.removeEventListener('smart_absensi_records_updated', handleLocalUpdate);
      window.removeEventListener('smart_absensi_leave_updated', handleLocalUpdate);
      window.removeEventListener('smart_absensi_leaves_updated', handleLocalUpdate);
      window.removeEventListener('storage', handleLocalUpdate);
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, scheduleSync, heartbeatIntervalMs]);
}
