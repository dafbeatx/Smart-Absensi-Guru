import { APP_VERSION_CONFIG } from '../config/version.config';
import { useToastStore } from '../store/useToastStore';

export class AutoUpdateService {
  private static isChecking = false;
  private static updateTriggered = false;
  private static checkIntervalTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Initializes background version polling & visibilitychange listeners.
   */
  public static initAutoUpdateEngine(): void {
    if (typeof window === 'undefined') return;

    // 1. Initial check after 3 seconds on app launch
    setTimeout(() => {
      this.checkForUpdates();
    }, 3000);

    // 2. Periodic background polling every 30 seconds
    if (!this.checkIntervalTimer) {
      this.checkIntervalTimer = setInterval(() => {
        this.checkForUpdates();
      }, 30000);
    }

    // 3. Waking up screen / switching tabs on HP Mobile
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkForUpdates();
      }
    });

    // 4. Online reconnection event
    window.addEventListener('online', () => {
      this.checkForUpdates();
    });

    // 5. Global chunk / module import error recovery
    window.addEventListener('unhandledrejection', (event) => {
      const reasonStr = String(event.reason || '');
      if (
        reasonStr.includes('Failed to fetch dynamically imported module') ||
        reasonStr.includes('Importing a module script failed') ||
        reasonStr.includes('error loading dynamically imported module')
      ) {
        console.warn('[AutoUpdate] Stale JS chunk error detected. Force reloading application...');
        this.forceReloadWithCacheClear();
      }
    });
  }

  /**
   * Checks `/version.json` endpoint for a newer build_timestamp or build_id.
   */
  public static async checkForUpdates(): Promise<boolean> {
    if (this.isChecking || this.updateTriggered || typeof window === 'undefined') {
      return false;
    }

    this.isChecking = true;
    try {
      // Prevent browser cache when fetching version manifest
      const res = await fetch(`/version.json?t=${Date.now()}`, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          Pragma: 'no-cache',
        },
      });

      if (!res.ok) {
        this.isChecking = false;
        return false;
      }

      const remoteData = (await res.json()) as { version?: string; build_timestamp?: number };

      const hasNewVersion =
        (remoteData.build_timestamp && remoteData.build_timestamp > APP_VERSION_CONFIG.BUILD_TIMESTAMP) ||
        (remoteData.version && remoteData.version !== APP_VERSION_CONFIG.BUILD_ID);

      if (hasNewVersion) {
        this.triggerAutoReload();
        this.isChecking = false;
        return true;
      }
    } catch (err) {
      // Network offline or error ignored silently during background poll
      console.debug('[AutoUpdate] Version check fetch error:', err);
    } finally {
      this.isChecking = false;
    }

    return false;
  }

  /**
   * Displays notification and reloads the application with Service Worker cache purge.
   */
  public static triggerAutoReload(): void {
    if (this.updateTriggered) return;
    this.updateTriggered = true;

    try {
      useToastStore.getState().showToast(
        'info',
        '🚀 Pembaruan Sistem Otomatis',
        'Versi terbaru aplikasi dari developer telah tersedia. Memperbarui otomatis...'
      );
    } catch (e) {
      console.warn('Toast display failed on update trigger:', e);
    }

    setTimeout(() => {
      this.forceReloadWithCacheClear();
    }, 1500);
  }

  /**
   * Purges Service Worker cache & reloads the window.
   */
  public static async forceReloadWithCacheClear(): Promise<void> {
    try {
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const reg of registrations) {
          await reg.unregister();
        }
      }
    } catch (e) {
      console.warn('Failed clearing caches during force reload:', e);
    } finally {
      window.location.reload();
    }
  }
}
