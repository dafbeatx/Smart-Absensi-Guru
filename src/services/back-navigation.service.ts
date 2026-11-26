import { useToastStore } from '../store/useToastStore';

export const BACK_PRIORITIES = {
  OVERLAY: 100,      // Scan QR, Emergency SOS, Full celebratory award overlay
  MODAL: 80,         // Standard dialogs, Form Izin, Detail Guru, Full-screen sheets
  DRAWER: 60,        // AI Assistant Drawer, Sidebars
  SUB_LAYER: 40,     // berandaLayer (ALL_FEATURES, STUDENT_BEHAVIOR, EDUCATION, etc.)
  TAB: 20,           // Non-default tabs (RIWAYAT, PROFIL, NOTIFIKASI) -> back to BERANDA
  PREVIEW_MODE: 15,  // Mode Preview Tampilan Guru (Admin/Kepsek) -> back to Admin
  ROOT: 0,           // Base Dashboard
} as const;

export interface BackHandlerItem {
  id: string;
  onBack: () => boolean | void;
  priority: number;
  title?: string;
  seq: number;
  createdAt: number;
  pushHistory?: boolean;
}

export interface RegisterBackHandlerOptions {
  id: string;
  onBack: () => boolean | void;
  priority?: number;
  title?: string;
  pushHistory?: boolean;
}

class BackNavigationManager {
  private stack: BackHandlerItem[] = [];
  private sequenceCounter = 0;
  private lastCapBackTime = 0;
  private lastRootBackPressTime = 0;
  private isInitialized = false;

  /**
   * Inisialisasi listener global (Web Browser popstate & Capacitor Android backButton).
   * Idempoten dan aman terhadap React StrictMode double-mount maupun reload halaman.
   */
  public init(): () => void {
    if (this.isInitialized) {
      return () => {};
    }
    this.isInitialized = true;

    // 1. Web Browser & PWA History Guard Setup
    if (typeof window !== 'undefined' && window.history) {
      try {
        const currentState = window.history.state as Record<string, unknown> | null;
        const alreadyInAppHistory = Boolean(
          currentState?.sagRootGuard || currentState?.sagAppActive || currentState?.sagModalTrap
        );

        if (!alreadyInAppHistory) {
          window.history.replaceState({ sagRootGuard: true, level: 0 }, '');
          window.history.pushState({ sagAppActive: true, level: 1 }, '');
        } else if (currentState?.sagRootGuard) {
          window.history.pushState({ sagAppActive: true, level: 1 }, '');
        }
      } catch (err) {
        console.warn('[BackNavigation] Failed to setup initial history guard:', err);
      }

      window.addEventListener('popstate', this.handlePopState);
    }

    // 2. Capacitor Android Hardware Back Button Setup
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        CapApp.addListener('backButton', () => {
          const now = Date.now();
          if (now - this.lastCapBackTime < 150) {
            return;
          }
          this.lastCapBackTime = now;

          const handled = this.handleBack();
          if (!handled) {
            this.handleRootExit(() => CapApp.exitApp());
          }
        }).catch((err) => {
          console.warn('[BackNavigation] Capacitor backButton listener error:', err);
        });
      })
      .catch(() => {
        // Bukan lingkungan Capacitor native (normal di browser web/PWA)
      });

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('popstate', this.handlePopState);
      }
      this.isInitialized = false;
    };
  }

  /**
   * Pastikan terdapat paling banyak satu state sentinel `sagModalTrap` di atas `sagAppActive`
   * saat modal/sub-layer/tab terbuka, sehingga tombol Back/Swipe tidak langsung menyentuh root guard
   * maupun menumpuk entry history yang dapat menyebabkan mismatch saat ditutup via UI.
   */
  private armHistoryGuard(trapKey: 'sagAppActive' | 'sagModalTrap', extra?: Record<string, unknown>): void {
    if (typeof window === 'undefined' || !window.history) return;
    try {
      const currentState = window.history.state as Record<string, unknown> | null;
      if (trapKey === 'sagModalTrap') {
        if (currentState?.sagModalTrap) return;
        window.history.pushState({ sagModalTrap: true, level: 2, ...extra }, '');
      } else {
        if (currentState?.sagAppActive || currentState?.sagModalTrap) return;
        window.history.pushState({ sagAppActive: true, level: 1, ...extra }, '');
      }
    } catch {
      // Abaikan error history API pada environment terbatas
    }
  }

  /**
   * Daftarkan handler navigasi kembali ke dalam stack.
   * Mengembalikan fungsi unregister untuk membersihkan stack saat modal/komponen ditutup.
   */
  public register(options: RegisterBackHandlerOptions): () => void {
    const {
      id,
      onBack,
      priority = BACK_PRIORITIES.MODAL,
      title,
      pushHistory = priority >= BACK_PRIORITIES.SUB_LAYER,
    } = options;

    this.stack = this.stack.filter((item) => item.id !== id);

    const item: BackHandlerItem = {
      id,
      onBack,
      priority,
      title,
      seq: ++this.sequenceCounter,
      createdAt: Date.now(),
      pushHistory,
    };

    this.stack.push(item);

    if (pushHistory) {
      this.armHistoryGuard('sagModalTrap', { sagBackId: id, priority, seq: item.seq });
    }

    return () => {
      this.unregister(id);
    };
  }

  /**
   * Hapus handler dari stack saat komponen ditutup lewat UI atau unmount.
   * Sengaja TIDAK memanggil `window.history.back()` pada cleanup React untuk mencegah
   * race condition popstate asinkron yang dapat mengeluarkan tab browser ke halaman sebelumnya.
   */
  public unregister(id: string): void {
    const index = this.stack.findIndex((item) => item.id === id);
    if (index === -1) return;
    this.stack.splice(index, 1);
  }

  /**
   * Eksekusi navigasi kembali (LIFO: Prioritas tertinggi lalu urutan registrasi terbaru).
   * Mengembalikan true jika berhasil menangani penutupan modal/layer/tab, false jika di root.
   */
  public handleBack(): boolean {
    if (this.stack.length === 0) {
      return false;
    }

    this.stack.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.seq - a.seq;
    });

    const topItem = this.stack.shift();
    if (!topItem) return false;

    try {
      const result = topItem.onBack();
      if (result === false) {
        return false;
      }
      return true;
    } catch (err) {
      console.error('[BackNavigation] Error executing onBack handler for:', topItem.id, err);
      return false;
    }
  }

  /**
   * Tangani back button saat pengguna berada di root tampilan (tidak ada modal atau sub-layer terbuka).
   * Menggunakan pola native mobile app: "Tekan sekali lagi untuk keluar".
   */
  public handleRootExit(exitCallback?: () => void): void {
    const now = Date.now();
    const isDoubleBack = now - this.lastRootBackPressTime < 2000;

    if (isDoubleBack) {
      this.lastRootBackPressTime = 0;
      if (exitCallback) {
        exitCallback();
      } else if (typeof window !== 'undefined' && window.history) {
        window.history.back();
      }
      return;
    }

    this.lastRootBackPressTime = now;
    this.armHistoryGuard('sagAppActive');

    useToastStore
      .getState()
      .showToast(
        'info',
        'Tekan Sekali Lagi Untuk Keluar',
        'Tekan tombol kembali sekali lagi untuk menutup aplikasi.'
      );
  }

  /**
   * Listener event popstate browser (HP swipe back / tombol kembali Chrome/Safari/PWA)
   */
  private handlePopState = (event: PopStateEvent): void => {
    const state = event.state as Record<string, unknown> | null;
    const handled = this.handleBack();

    if (handled) {
      // Pastikan browser selalu memiliki guard di atas sagRootGuard setelah menutup layer
      if (this.stack.length > 0) {
        this.armHistoryGuard('sagModalTrap');
      } else if (state?.sagRootGuard) {
        this.armHistoryGuard('sagAppActive');
      }
      return;
    }

    // Jika event mendarat di sagModalTrap -> sagAppActive dengan stack kosong, tetap jaga di sagAppActive
    // dan hanya izinkan root exit bila berada di sagRootGuard atau double-back disengaja.
    if (state?.sagAppActive) {
      this.armHistoryGuard('sagAppActive');
    }

    this.handleRootExit();
  };

  /**
   * Dapatkan snapshot isi stack saat ini untuk debugging / unit testing
   */
  public getStackSnapshot(): BackHandlerItem[] {
    return [...this.stack];
  }

  /**
   * Reset seluruh stack (khusus testing atau logout)
   */
  public reset(): void {
    this.stack = [];
    this.sequenceCounter = 0;
    this.lastCapBackTime = 0;
    this.lastRootBackPressTime = 0;
  }
}

export const BackNavigationService = new BackNavigationManager();
