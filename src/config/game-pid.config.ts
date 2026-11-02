/**
 * Konfigurasi URL dan Pengaturan Platform Game PID (Pekan Inovasi Digital)
 * SMP Terpadu Al-Ittihadiyah
 */

export const DEFAULT_GAME_PID_URL = 'https://game-pid.smpt-alittihadiyah.sch.id';
export const STORAGE_KEY_GAME_PID_URL = 'smart_absensi_game_pid_url';

/**
 * Mengambil tautan langsung platform Game PID dari storage lokal atau default resmi sekolah
 */
export function getGamePidPlatformUrl(): string {
  if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
    try {
      const stored = localStorage.getItem(STORAGE_KEY_GAME_PID_URL);
      if (stored && stored.trim().length > 0) {
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
