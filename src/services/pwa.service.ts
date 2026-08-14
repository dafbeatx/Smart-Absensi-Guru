/**
 * Smart Absensi Guru - PWA Service & Installation Manager
 * Handles Service Worker lifecycle, PWA installation prompts (Android & iOS), and local push notifications
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

class PWAService {
  private deferredPrompt: BeforeInstallPromptEvent | null = null;
  private swRegistration: ServiceWorkerRegistration | null = null;
  private isInstallable = false;

  constructor() {
    this.initListeners();
  }

  private initListeners() {
    if (typeof window === 'undefined') return;

    // Listen for beforeinstallprompt event on Chrome/Android
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e as BeforeInstallPromptEvent;
      this.isInstallable = true;
      console.log('[PWAService] App is ready to be installed as PWA');
      window.dispatchEvent(new CustomEvent('smart_absensi_pwa_installable'));
    });

    // Listen for appinstalled event
    window.addEventListener('appinstalled', () => {
      this.deferredPrompt = null;
      this.isInstallable = false;
      console.log('[PWAService] PWA installed successfully');
      window.dispatchEvent(new CustomEvent('smart_absensi_pwa_installed'));
    });
  }

  /**
   * Register Service Worker
   */
  public async registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      console.warn('[PWAService] Service Worker is not supported in this browser');
      return null;
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      this.swRegistration = registration;
      console.log('[PWAService] Service Worker registered with scope:', registration.scope);
      return registration;
    } catch (error) {
      console.warn('[PWAService] Service Worker registration failed:', error);
      return null;
    }
  }

  /**
   * Check if application is running in standalone PWA mode
   */
  public isStandalone(): boolean {
    if (typeof window === 'undefined') return false;
    const isStandaloneWindow = window.matchMedia('(display-mode: standalone)').matches;
    const isIOSStandalone = (navigator as any).standalone === true;
    return isStandaloneWindow || isIOSStandalone;
  }

  /**
   * Check if running on iOS device (iPhone/iPad)
   */
  public isIOS(): boolean {
    if (typeof window === 'undefined') return false;
    return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
  }

  /**
   * Check if app can be installed via 1-click prompt
   */
  public canPromptInstall(): boolean {
    return this.isInstallable && this.deferredPrompt !== null;
  }

  /**
   * Prompt user to install PWA (Android / Chrome)
   */
  public async promptInstall(): Promise<boolean> {
    if (!this.deferredPrompt) return false;

    try {
      await this.deferredPrompt.prompt();
      const choice = await this.deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        console.log('[PWAService] User accepted PWA installation');
        this.deferredPrompt = null;
        this.isInstallable = false;
        return true;
      }
      return false;
    } catch (error) {
      console.error('[PWAService] Error prompting PWA installation:', error);
      return false;
    }
  }

  /**
   * Schedule local attendance push reminder via Service Worker
   */
  public scheduleAttendanceReminder(title: string, body: string, delayMs: number, tag?: string) {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;

    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: 'SCHEDULE_ATTENDANCE_REMINDER',
        title,
        body,
        delayMs,
        tag: tag || 'checkout-reminder',
      });
    }
  }

  public getSwRegistration(): ServiceWorkerRegistration | null {
    return this.swRegistration;
  }
}

export const pwaService = new PWAService();
