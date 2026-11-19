/**
 * Konfigurasi URL dan Pengaturan Platform Game PID (Pekan Inovasi Digital)
 * SMP Terpadu Al-Ittihadiyah
 * Platform Inovasi Digital Siswa: Nawasena Platform Siswa (https://nawasena-platform-siswa.vercel.app/)
 * Gim Edukatif 3D: School Slice 3D (/games/school-slice-3d/index.html)
 */

export const DEFAULT_GAME_PID_URL = 'https://nawasena-platform-siswa.vercel.app/';
export const STORAGE_KEY_GAME_PID_URL = 'smart_absensi_game_pid_url';

export const DEFAULT_SCHOOL_SLICE_3D_URL = '/games/school-slice-3d/index.html';
export const STORAGE_KEY_SCHOOL_SLICE_3D_URL = 'smart_absensi_school_slice_3d_url';

export const DEFAULT_RUMAH_SUNYI_URL = '/games/rumah-sunyi/index.html';
export const STORAGE_KEY_RUMAH_SUNYI_URL = 'smart_absensi_rumah_sunyi_url';

export const DEFAULT_G7KAIH_URL = '/games/g7kaih-al-ittihadiyah/index.html';
export const STORAGE_KEY_G7KAIH_URL = 'smart_absensi_g7kaih_url';

export const STORAGE_KEY_PID_PROMO_DISMISSED_DATE = 'smart_absensi_pid_promo_dismissed_date';
export const SESSION_KEY_PID_PROMO_SHOWN = 'smart_absensi_pid_promo_shown';

/**
 * Mengambil tautan langsung platform Game PID dari storage lokal atau default resmi sekolah
 */
export function getGamePidPlatformUrl(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GAME_PID_URL);
      if (stored && stored.trim().length > 0) {
        // Sanitasi permanen: hapus URL lama nawasena-pi.vercel.app dari storage lokal perangkat
        if (stored.includes('nawasena-pi.vercel.app')) {
          localStorage.removeItem(STORAGE_KEY_GAME_PID_URL);
          return DEFAULT_GAME_PID_URL;
        }
        return stored.trim();
      }
    } catch {
      // fallback to default
    }
  }
  return DEFAULT_GAME_PID_URL;
}

/**
 * Menyimpan tautan kustom platform Game PID
 */
export function setGamePidPlatformUrl(url: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const trimmed = url.trim();
      if (trimmed.length > 0) {
        localStorage.setItem(STORAGE_KEY_GAME_PID_URL, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_GAME_PID_URL);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_game_pid_url_updated', { detail: trimmed }));
    } catch {
      // ignore
    }
  }
}

/**
 * Mengambil tautan langsung Gim 3D School Slice dari storage lokal atau default bundle aplikasi
 */
export function getSchoolSlice3dUrl(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_SCHOOL_SLICE_3D_URL);
      if (stored && stored.trim().length > 0) {
        // Migrasi otomatis: jika browser masih menyimpan tautan 404 lama (school-slice-3d.vercel.app),
        // bersihkan dan arahkan ke bundle statis resmi aplikasi
        if (stored.includes('school-slice-3d.vercel.app')) {
          localStorage.removeItem(STORAGE_KEY_SCHOOL_SLICE_3D_URL);
          return DEFAULT_SCHOOL_SLICE_3D_URL;
        }
        return stored.trim();
      }
    } catch {
      // fallback to default
    }
  }
  return DEFAULT_SCHOOL_SLICE_3D_URL;
}

/**
 * Menyimpan tautan kustom Gim 3D School Slice (misal: localhost:5173 saat staging atau URL Vercel)
 */
export function setSchoolSlice3dUrl(url: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const trimmed = url.trim();
      if (trimmed.length > 0 && trimmed !== DEFAULT_SCHOOL_SLICE_3D_URL) {
        localStorage.setItem(STORAGE_KEY_SCHOOL_SLICE_3D_URL, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_SCHOOL_SLICE_3D_URL);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_school_slice_3d_url_updated', { detail: trimmed || DEFAULT_SCHOOL_SLICE_3D_URL }));
    } catch {
      // ignore
    }
  }
}

/**
 * Mengambil tautan langsung Gim 3D Rumah Sunyi: Tiga Kunci dari storage lokal atau default bundle
 */
export function getRumahSunyiUrl(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_RUMAH_SUNYI_URL);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch {
      // fallback to default
    }
  }
  return DEFAULT_RUMAH_SUNYI_URL;
}

/**
 * Menyimpan tautan kustom Gim 3D Rumah Sunyi (misal: localhost atau URL staging)
 */
export function setRumahSunyiUrl(url: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const trimmed = url.trim();
      if (trimmed.length > 0 && trimmed !== DEFAULT_RUMAH_SUNYI_URL) {
        localStorage.setItem(STORAGE_KEY_RUMAH_SUNYI_URL, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_RUMAH_SUNYI_URL);
      }
      window.dispatchEvent(
        new CustomEvent('smart_absensi_rumah_sunyi_url_updated', {
          detail: trimmed || DEFAULT_RUMAH_SUNYI_URL,
        })
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Mengambil tautan langsung Gim 3D G7KAIH Al-Ittihadiyah dari storage lokal atau default bundle
 */
export function getG7kaihUrl(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_G7KAIH_URL);
      if (stored && stored.trim().length > 0) {
        return stored.trim();
      }
    } catch {
      // fallback to default
    }
  }
  return DEFAULT_G7KAIH_URL;
}

/**
 * Menyimpan tautan kustom Gim 3D G7KAIH (misal: localhost atau URL staging)
 */
export function setG7kaihUrl(url: string): void {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const trimmed = url.trim();
      if (trimmed.length > 0 && trimmed !== DEFAULT_G7KAIH_URL) {
        localStorage.setItem(STORAGE_KEY_G7KAIH_URL, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY_G7KAIH_URL);
      }
      window.dispatchEvent(
        new CustomEvent('smart_absensi_g7kaih_url_updated', {
          detail: trimmed || DEFAULT_G7KAIH_URL,
        })
      );
    } catch {
      // ignore
    }
  }
}

/**
 * Mendapatkan tautan deep-link khusus yang langsung membuka portal Game PID saat diakses
 */
export function getDirectGamePidShareUrl(): string {
  if (typeof window !== 'undefined' && window.location) {
    return `${window.location.origin}${window.location.pathname}?portal=game-pid`;
  }
  return DEFAULT_GAME_PID_URL;
}

/**
 * Mengecek apakah promosi pop-up Game PID harus dimunculkan ke guru hari ini
 */
export function shouldShowPidPromoToday(todayDateStr: string): boolean {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') {
    return false;
  }
  try {
    const dismissedDate = localStorage.getItem(STORAGE_KEY_PID_PROMO_DISMISSED_DATE);
    if (dismissedDate === todayDateStr) {
      return false;
    }
    const shownInSession = sessionStorage.getItem(SESSION_KEY_PID_PROMO_SHOWN);
    if (shownInSession === 'true') {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Menandai pop-up promosi Game PID telah dilihat pada sesi saat ini atau ditutup permanen untuk hari ini
 */
export function markPidPromoShown(dontShowAgainToday = false, todayDateStr = ''): void {
  if (typeof window === 'undefined') return;
  try {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(SESSION_KEY_PID_PROMO_SHOWN, 'true');
    }
    if (dontShowAgainToday && todayDateStr && typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PID_PROMO_DISMISSED_DATE, todayDateStr);
    }
  } catch {
    // ignore
  }
}
