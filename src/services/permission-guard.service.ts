/**
 * Smart Absensi Guru - Permission Guard Service
 * 
 * Memvalidasi izin esensial perangkat browser (Notifikasi, Lokasi GPS Geofence, Kamera).
 * Memblokir proses absensi jika izin belum diberikan dan mencatat pesan error browser secara transparan.
 */

export interface PermissionItemStatus {
  id: 'notifications' | 'geolocation' | 'camera';
  title: string;
  category: string;
  status: 'granted' | 'prompt' | 'denied' | 'unsupported';
  isGranted: boolean;
  isRequiredForAttendance: boolean;
  error?: string;
  description: string;
  guideInstructions: string;
}

export interface AttendancePermissionsReport {
  isReadyForAttendance: boolean;
  missingPermissionsCount: number;
  permissions: {
    notifications: PermissionItemStatus;
    geolocation: PermissionItemStatus;
    camera: PermissionItemStatus;
  };
  rawErrors: string[];
}

export class PermissionGuardService {
  private static getNotificationAPI(): any {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return window.Notification;
    }
    if (typeof globalThis !== 'undefined' && 'Notification' in globalThis) {
      return (globalThis as any).Notification;
    }
    return undefined;
  }

  private static getNavigator(): any {
    if (typeof navigator !== 'undefined') {
      return navigator;
    }
    if (typeof globalThis !== 'undefined' && (globalThis as any).navigator) {
      return (globalThis as any).navigator;
    }
    return undefined;
  }

  /**
   * Cek status izin Notifikasi browser
   */
  public static checkNotificationPermission(): { status: 'granted' | 'prompt' | 'denied' | 'unsupported'; error?: string } {
    const notifAPI = this.getNotificationAPI();
    if (!notifAPI) {
      return {
        status: 'unsupported',
        error: 'Web Notification API tidak didukung pada browser/perangkat ini.',
      };
    }

    const perm = notifAPI.permission;
    if (perm === 'granted') {
      return { status: 'granted' };
    }
    if (perm === 'denied') {
      return {
        status: 'denied',
        error: 'Notifikasi diblokir oleh browser (Notification.permission === "denied").',
      };
    }
    return {
      status: 'prompt',
      error: 'Notifikasi belum diizinkan oleh pengguna (Notification.permission === "default").',
    };
  }

  /**
   * Cek status izin Lokasi (Geolocation) browser
   */
  public static async checkGeolocationPermission(): Promise<{ status: 'granted' | 'prompt' | 'denied' | 'unsupported'; error?: string }> {
    const nav = this.getNavigator();
    if (!nav || !nav.geolocation) {
      return {
        status: 'unsupported',
        error: 'Geolocation API tidak didukung pada perangkat ini.',
      };
    }

    if (nav.permissions && nav.permissions.query) {
      try {
        const result = await nav.permissions.query({ name: 'geolocation' });
        if (result.state === 'granted') {
          return { status: 'granted' };
        }
        if (result.state === 'denied') {
          return {
            status: 'denied',
            error: 'Akses lokasi GPS ditolak/diblokir oleh browser (Geolocation permission === "denied").',
          };
        }
        return {
          status: 'prompt',
          error: 'Akses lokasi GPS belum diaktifkan/dikonfirmasi (status "prompt").',
        };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { status: 'prompt', error: `Pemeriksaan izin GPS: ${msg}` };
      }
    }

    return { status: 'prompt' };
  }

  /**
   * Cek status izin Kamera browser
   */
  public static async checkCameraPermission(): Promise<{ status: 'granted' | 'prompt' | 'denied' | 'unsupported'; error?: string }> {
    const nav = this.getNavigator();
    if (!nav || !nav.mediaDevices?.getUserMedia) {
      return {
        status: 'unsupported',
        error: 'MediaDevices getUserMedia tidak didukung pada browser ini.',
      };
    }

    if (nav.permissions && nav.permissions.query) {
      try {
        const result = await nav.permissions.query({ name: 'camera' as PermissionName });
        if (result.state === 'granted') {
          return { status: 'granted' };
        }
        if (result.state === 'denied') {
          return {
            status: 'denied',
            error: 'Akses kamera scanner diblokir oleh browser (Camera permission === "denied").',
          };
        }
        return {
          status: 'prompt',
          error: 'Akses kamera belum diaktifkan (status "prompt").',
        };
      } catch {
        return { status: 'prompt' };
      }
    }

    return { status: 'prompt' };
  }

  /**
   * Evaluasi laporan komprehensif seluruh izin presensi
   */
  public static async evaluatePermissions(requiresCamera = false): Promise<AttendancePermissionsReport> {
    const notif = this.checkNotificationPermission();
    const geo = await this.checkGeolocationPermission();
    const cam = await this.checkCameraPermission();

    const rawErrors: string[] = [];
    if (notif.error && notif.status !== 'granted') rawErrors.push(`[Notifikasi]: ${notif.error}`);
    if (geo.error && geo.status !== 'granted') rawErrors.push(`[Lokasi GPS]: ${geo.error}`);
    if (requiresCamera && cam.error && cam.status !== 'granted') rawErrors.push(`[Kamera QR]: ${cam.error}`);

    const notifItem: PermissionItemStatus = {
      id: 'notifications',
      title: 'Izin Notifikasi Web & Mobile',
      category: 'Komunikasi & Pengingat',
      status: notif.status,
      isGranted: notif.status === 'granted',
      isRequiredForAttendance: true,
      error: notif.error,
      description: 'Diperlukan untuk mengirimkan konfirmasi presensi masuk/pulang, alarm pengingat jam pulang, serta warta resmi sekolah.',
      guideInstructions: 'Buka ikon gembok 🔒 di address bar browser > Cari menu "Notifikasi" > Ubah menjadi "Izinkan / Allow".',
    };

    const geoItem: PermissionItemStatus = {
      id: 'geolocation',
      title: 'Izin Lokasi GPS & Geofence',
      category: 'Keamanan & Validasi Radius',
      status: geo.status,
      isGranted: geo.status === 'granted',
      isRequiredForAttendance: true,
      error: geo.error,
      description: 'Wajib untuk memastikan posisi fisik asli Anda berada dalam radius sekolah dan mencegah manipulasi fake GPS.',
      guideInstructions: 'Buka ikon gembok 🔒 di address bar browser > Cari menu "Lokasi" > Ubah menjadi "Izinkan". Pastikan sakelar GPS di perangkat HP Anda juga aktif.',
    };

    const camItem: PermissionItemStatus = {
      id: 'camera',
      title: 'Izin Kamera Pemindai Barcode / QR',
      category: 'Perangkat Keras QR Scanner',
      status: cam.status,
      isGranted: cam.status === 'granted',
      isRequiredForAttendance: requiresCamera,
      error: cam.error,
      description: 'Diperlukan untuk memindai poster Barcode / QR Code resmi yang terpasang di gerbang atau papan presensi sekolah.',
      guideInstructions: 'Buka ikon gembok 🔒 di address bar browser > Cari menu "Kamera" > Pilih "Izinkan / Allow".',
    };

    const isReady = notifItem.isGranted && geoItem.isGranted && (!requiresCamera || camItem.isGranted);

    let missing = 0;
    if (!notifItem.isGranted) missing++;
    if (!geoItem.isGranted) missing++;
    if (requiresCamera && !camItem.isGranted) missing++;

    return {
      isReadyForAttendance: isReady,
      missingPermissionsCount: missing,
      permissions: {
        notifications: notifItem,
        geolocation: geoItem,
        camera: camItem,
      },
      rawErrors,
    };
  }

  /**
   * Eksekusi permintaan izin Notifikasi ke browser
   */
  public static async requestNotificationPermission(): Promise<{ success: boolean; status: string; error?: string }> {
    const notifAPI = this.getNotificationAPI();
    if (!notifAPI) {
      return {
        success: false,
        status: 'unsupported',
        error: 'Web Notification API tidak didukung pada browser ini.',
      };
    }

    try {
      const res = await notifAPI.requestPermission();
      if (res === 'granted') {
        try {
          const { NotificationService } = await import('./notification-permission.service');
          NotificationService.subscribeUserToPush().catch(() => {});
        } catch {
          // ignore
        }
        return { success: true, status: 'granted' };
      }
      return {
        success: false,
        status: res,
        error: `Pengguna memilih "${res}". Notifikasi belum diizinkan oleh browser.`,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: 'error',
        error: `Gagal memanggil Notification.requestPermission(): ${msg}`,
      };
    }
  }

  /**
   * Eksekusi permintaan izin Geolocation ke browser
   */
  public static async requestGeolocationPermission(): Promise<{ success: boolean; status: string; error?: string; coords?: { lat: number; lng: number; accuracy: number } }> {
    const nav = this.getNavigator();
    if (!nav || !nav.geolocation) {
      return {
        success: false,
        status: 'unsupported',
        error: 'Perangkat ini tidak memiliki dukungan Geolocation GPS.',
      };
    }

    return new Promise((resolve) => {
      nav.geolocation.getCurrentPosition(
        (pos: any) => {
          resolve({
            success: true,
            status: 'granted',
            coords: {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            },
          });
        },
        (err: any) => {
          let detailedMsg = err.message || 'Gagal membaca koordinat GPS';
          if (err.code === 1) {
            detailedMsg = `[PERMISSION_DENIED Code 1]: ${err.message || 'Izin akses lokasi ditolak oleh pengguna/browser.'}`;
          } else if (err.code === 2) {
            detailedMsg = `[POSITION_UNAVAILABLE Code 2]: ${err.message || 'Satelit/sensor GPS tidak merespons.'}`;
          } else if (err.code === 3) {
            detailedMsg = `[TIMEOUT Code 3]: ${err.message || 'Waktu permintaan lokasi GPS habis.'}`;
          }
          resolve({
            success: false,
            status: 'denied',
            error: detailedMsg,
          });
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
      );
    });
  }

  /**
   * Eksekusi permintaan izin Kamera ke browser
   */
  public static async requestCameraPermission(): Promise<{ success: boolean; status: string; error?: string }> {
    const nav = this.getNavigator();
    if (!nav || !nav.mediaDevices?.getUserMedia) {
      return {
        success: false,
        status: 'unsupported',
        error: 'MediaDevices getUserMedia tidak didukung pada browser ini.',
      };
    }

    try {
      const stream = await nav.mediaDevices.getUserMedia({ video: true });
      // Hentikan track setelah berhasil mendapatkan izin
      stream.getTracks().forEach((track: any) => track.stop());
      return { success: true, status: 'granted' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return {
        success: false,
        status: 'denied',
        error: `[Camera Access Error]: ${msg}`,
      };
    }
  }
}
