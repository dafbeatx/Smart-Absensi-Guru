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
  private isPoppingFromBackButton = false;
  private isProgrammaticPop = false;
  private lastHandledTime = 0;
  private lastRootBackPressTime = 0;
  private isInitialized = false;
  private pushedHistoryCount = 0;

  /**
   * Inisialisasi listener global (Web Browser popstate & Capacitor Android backButton).
   * Dipanggil satu kali saat App mount.
   */
  public init(): () => void {
    if (this.isInitialized) {
      return () => {};
    }
    this.isInitialized = true;

    // 1. Web Browser & PWA History Guard Setup
    if (typeof window !== 'undefined' && window.history) {
      try {
        const currentState = window.history.state;
        if (!currentState || !currentState.sagRootGuard) {
          window.history.replaceState({ sagRootGuard: true, level: 0 }, '');
          window.history.pushState({ sagAppActive: true, level: 1 }, '');
          this.pushedHistoryCount = 1;
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
          if (now - this.lastHandledTime < 150) {
            return;
          }
          this.lastHandledTime = now;

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

    // Hapus pendaftaran lama jika ID yang sama sudah ada untuk menghindari duplikasi
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

    // Dorong history state ke browser agar tombol back bawaan HP / gesture swipe back
    // menghasilkan event popstate dan tidak langsung keluar dari situs/PWA
    if (pushHistory && typeof window !== 'undefined' && window.history) {
      try {
        window.history.pushState(
          {
            sagBackId: id,
            priority,
            seq: item.seq,
          },
          ''
        );
        this.pushedHistoryCount++;
      } catch (err) {
        console.warn('[BackNavigation] pushState error for modal:', id, err);
      }
    }

    return () => {
      this.unregister(id);
    };
  }

  /**
   * Hapus handler dari stack saat komponen ditutup secara normal lewat UI (misal tombol ✕).
   */
  public unregister(id: string): void {
    const index = this.stack.findIndex((item) => item.id === id);
    if (index === -1) return;

    const [removedItem] = this.stack.splice(index, 1);

    // Jika komponen ditutup melalui aksi UI (bukan dipicu oleh tombol back HP),
    // maka kita harus membersihkan history entry yang telah di-push sebelumnya
    if (
      removedItem &&
      removedItem.pushHistory &&
      !this.isPoppingFromBackButton &&
      typeof window !== 'undefined' &&
      window.history &&
      this.pushedHistoryCount > 0
    ) {
      try {
        this.pushedHistoryCount = Math.max(0, this.pushedHistoryCount - 1);
        this.isProgrammaticPop = true;
        window.history.back();
      } catch (err) {
        console.warn('[BackNavigation] Programmatic history.back error:', err);
      }
    }
  }

  /**
   * Eksekusi navigasi kembali (LIFO: Prioritas tertinggi lalu urutan registrasi terbaru).
   * Mengembalikan true jika berhasil menangani penutupan modal/layer/tab, false jika di root.
   */
  public handleBack(): boolean {
    if (this.stack.length === 0) {
      return false;
    }

    // Urutkan stack: prioritas lebih tinggi didahulukan.
    // Jika prioritas sama, urutan registrasi terbaru (seq tertinggi) didahulukan (LIFO).
    this.stack.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return b.seq - a.seq;
    });

    const topItem = this.stack[0];
    if (!topItem) return false;

    // Hapus dari stack
    this.stack.shift();

    this.isPoppingFromBackButton = true;
    try {
      const result = topItem.onBack();
      // Jika onBack mengembalikan false secara eksplisit, anggap tidak tertangani
      if (result === false) {
        return false;
      }
      return true;
    } catch (err) {
      console.error('[BackNavigation] Error executing onBack handler for:', topItem.id, err);
      return false;
    } finally {
      // Reset flag pada tick berikutnya agar unregister synchronous mendeteksi status popping
      setTimeout(() => {
        this.isPoppingFromBackButton = false;
      }, 50);
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
      // Pengguna menekan tombol kembali 2x dalam 2 detik: izinkan keluar
      if (exitCallback) {
        exitCallback();
      } else if (typeof window !== 'undefined' && window.history) {
        window.history.back();
      }
    } else {
      // Tekanan pertama di root screen: ingatkan pengguna & amankan history
      this.lastRootBackPressTime = now;

      if (typeof window !== 'undefined' && window.history) {
        try {
          window.history.pushState({ sagAppActive: true, level: 1 }, '');
          this.pushedHistoryCount = 1;
        } catch {}
      }

      useToastStore
        .getState()
        .showToast(
          'info',
          'Tekan Sekali Lagi Untuk Keluar',
          'Tekan tombol kembali sekali lagi untuk menutup aplikasi.'
        );
    }
  }

  /**
   * Listener event popstate browser (HP swipe back / tombol kembali Chrome/Safari/PWA)
   */
  private handlePopState = (_event: PopStateEvent): void => {
    // Abaikan jika popstate dipicu secara programatik oleh unregister modal
    if (this.isProgrammaticPop) {
      this.isProgrammaticPop = false;
      return;
    }

    const now = Date.now();
    if (now - this.lastHandledTime < 150) {
      return;
    }
    this.lastHandledTime = now;

    this.pushedHistoryCount = Math.max(0, this.pushedHistoryCount - 1);

    const handled = this.handleBack();
    if (!handled) {
      // Jika stack kosong dan pengguna menekan back di root:
      this.handleRootExit();
    }
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
    this.isPoppingFromBackButton = false;
    this.isProgrammaticPop = false;
    this.lastHandledTime = 0;
    this.lastRootBackPressTime = 0;
    this.pushedHistoryCount = 0;
  }
}

export const BackNavigationService = new BackNavigationManager();
