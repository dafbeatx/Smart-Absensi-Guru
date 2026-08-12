import { useEffect, useRef, useCallback } from 'react';

export interface UseCrossDeviceSyncOptions {
  /**
   * Callback invoked when the app regains visibility, focus, or reconnects online.
   * Should fetch fresh data from the backend.
   */
  onSync: () => void;

  /**
   * Minimum interval (ms) between consecutive sync triggers.
   * Prevents spam-refreshing when user rapidly switches tabs/apps.
   * @default 30000 (30 seconds)
   */
  cooldownMs?: number;

  /**
   * Whether the sync hook is active.
   * Set to false to disable (e.g., during preview mode or when user is logged out).
   * @default true
   */
  enabled?: boolean;
}

/**
 * useCrossDeviceSync
 *
 * Solves the cross-device data staleness problem:
 * When Admin updates teacher data on Device A, Guru/Kepsek on Device B
 * won't see changes until they re-fetch from backend.
 *
 * This hook automatically triggers a backend re-fetch when:
 * 1. User switches back to the app tab (visibilitychange → visible)
 * 2. User taps back into the browser window (focus event — mobile app switching)
 * 3. Device reconnects to the internet (online event)
 *
 * A cooldown timer prevents excessive API calls when rapidly switching contexts.
 */
export function useCrossDeviceSync({
  onSync,
  cooldownMs = 30000,
  enabled = true,
}: UseCrossDeviceSyncOptions): void {
  const lastSyncRef = useRef<number>(0);
  const onSyncRef = useRef(onSync);

  // Keep callback reference fresh without re-registering listeners
  useEffect(() => {
    onSyncRef.current = onSync;
  }, [onSync]);

  const triggerSync = useCallback(() => {
    if (!enabled) return;

    const now = Date.now();
    if (now - lastSyncRef.current < cooldownMs) {
      return; // Still within cooldown window
    }

    lastSyncRef.current = now;
    onSyncRef.current();
  }, [enabled, cooldownMs]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined' || typeof document === 'undefined') return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        triggerSync();
      }
    };

    const handleFocus = () => {
      triggerSync();
    };

    const handleOnline = () => {
      triggerSync();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('online', handleOnline);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('online', handleOnline);
    };
  }, [enabled, triggerSync]);
}
