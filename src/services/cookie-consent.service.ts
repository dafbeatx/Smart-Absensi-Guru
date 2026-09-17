/**
 * SMART ABSENSI GURU - COOKIE CONSENT & EGRESS OPTIMIZATION SERVICE
 * Mengelola preferensi cookie mikro (ultra-ringan < 50 bytes) & mode hemat Egress Supabase.
 */

export interface CookieConsentPreferences {
  essential: boolean; // Wajib: Sesi, PIN login & keamanan otentikasi
  egressSaver: boolean; // Rekomendasi: Mengalihkan request berulang ke cache lokal
  offlineSync: boolean; // Rekomendasi: IndexedDB (Dexie) untuk presensi tanpa kuota
  performance: boolean; // Opsional: Diagnosa latensi Edge CDN Vercel
  consentedAt: string; // Tanggal persetujuan
  version: number;
}

const COOKIE_NAME = 'saga_consent';
const STORAGE_KEY = 'smart_absensi_cookie_consent';
const CURRENT_VERSION = 1;

export class CookieConsentService {
  /**
   * Helper membaca nilai cookie mentah dari document.cookie
   */
  public static getRawCookie(name: string): string | null {
    if (typeof document === 'undefined') return null;
    const matches = document.cookie.match(
      new RegExp('(?:^|; )' + name.replace(/([.$?*|{}()[\]\\/+^])/g, '\\$1') + '=([^;]*)')
    );
    return matches ? decodeURIComponent(matches[1]) : null;
  }

  /**
   * Helper menulis cookie mikro yang aman dan tahan lama (365 hari)
   * Menggunakan SameSite=Lax & Secure jika berjalan di HTTPS
   */
  public static setRawCookie(name: string, value: string, days = 365): void {
    if (typeof document === 'undefined') return;
    const maxAge = days * 24 * 60 * 60;
    const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}; SameSite=Lax${
      isSecure ? '; Secure' : ''
    }`;
  }

  /**
   * Mengambil preferensi cookie pengguna saat ini
   */
  public static getConsent(): CookieConsentPreferences | null {
    // 1. Cek dari localStorage
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        const local = localStorage.getItem(STORAGE_KEY);
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed && typeof parsed.essential === 'boolean') {
            return parsed;
          }
        }
      } catch {
        // Abaikan parse error
      }
    }

    // 2. Fallback baca format mikro dari cookie: "ess:1,egr:1,off:1,prf:1"
    const raw = this.getRawCookie(COOKIE_NAME);
    if (raw) {
      try {
        const parts = raw.split(',');
        const obj: Record<string, boolean> = {};
        for (const part of parts) {
          const [k, v] = part.split(':');
          if (k) obj[k] = v === '1';
        }
        return {
          essential: true,
          egressSaver: obj['egr'] ?? true,
          offlineSync: obj['off'] ?? true,
          performance: obj['prf'] ?? true,
          consentedAt: new Date().toISOString(),
          version: CURRENT_VERSION,
        };
      } catch {
        // ignore
      }
    }

    return null;
  }

  /**
   * Cek apakah pengguna sudah pernah memberikan persetujuan cookie
   */
  public static isConsentGiven(): boolean {
    return this.getConsent() !== null;
  }

  /**
   * Menyimpan preferensi kustom pengguna
   */
  public static saveConsent(prefs: Partial<CookieConsentPreferences>): CookieConsentPreferences {
    const fullPrefs: CookieConsentPreferences = {
      essential: true, // Wajib selalu true
      egressSaver: prefs.egressSaver !== undefined ? prefs.egressSaver : true,
      offlineSync: prefs.offlineSync !== undefined ? prefs.offlineSync : true,
      performance: prefs.performance !== undefined ? prefs.performance : true,
      consentedAt: new Date().toISOString(),
      version: CURRENT_VERSION,
    };

    // Format mikro super hemat: hanya ~35 bytes di HTTP header
    const microCookie = `ess:1,egr:${fullPrefs.egressSaver ? '1' : '0'},off:${
      fullPrefs.offlineSync ? '1' : '0'
    },prf:${fullPrefs.performance ? '1' : '0'}`;

    this.setRawCookie(COOKIE_NAME, microCookie, 365);

    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(fullPrefs));
      } catch {
        // ignore
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_cookie_consent_updated', { detail: fullPrefs }));
    }

    return fullPrefs;
  }

  /**
   * Menerima semua preferensi (Default: Mode Hemat Egress Aktif)
   */
  public static acceptAll(): CookieConsentPreferences {
    return this.saveConsent({
      essential: true,
      egressSaver: true,
      offlineSync: true,
      performance: true,
    });
  }

  /**
   * Cek apakah Mode Hemat Egress aktif untuk memprioritaskan cache lokal
   */
  public static isEgressSaverActive(): boolean {
    const consent = this.getConsent();
    // Default aktif untuk menghemat kuota Supabase Free Tier
    return consent ? consent.egressSaver : true;
  }
}
