/**
 * SMART ABSENSI GURU - BIOMETRIC FINGERPRINT SERVICE (WebAuthn / FIDO2)
 *
 * Mengelola pendaftaran dan verifikasi sidik jari (fingerprint / biometric)
 * langsung dari hardware sensor bawaan HP guru.
 *
 * Sesuai standar privasi keamanan tinggi:
 * - Data fisik sidik jari TIDAK PERNAH dikirim atau disimpan di server.
 * - Hardware HP guru memverifikasi biometrik di Secure Enclave / TEE,
 *   lalu mengembalikan tanda tangan kriptografi sah ke sistem absensi.
 */

import { logger } from '../utils/logger.utils';

export interface BiometricAvailability {
  isSupported: boolean;
  hasPlatformSensor: boolean;
  isEnrolled: boolean;
  credentialId?: string | null;
}

export interface BiometricVerificationResult {
  success: boolean;
  credentialId?: string;
  timestamp?: string;
  error?: string;
}

const STORAGE_KEY_PREFIX = 'smart_absensi_biometric_cred_';

/**
 * Mengonversi ArrayBuffer ke Base64URL (URL-safe, tanpa padding '=' dan mengganti +/ dengan -_)
 */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Mengonversi Base64URL maupun standar Base64 kembali ke ArrayBuffer secara aman
 */
export function base64UrlToBuffer(base64Url: string): ArrayBuffer {
  let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
}

/**
 * Konversi aman Base64URL ke ArrayBuffer tanpa melempar exception
 */
export function safeBase64UrlToBuffer(input: string): ArrayBuffer | null {
  try {
    return base64UrlToBuffer(input);
  } catch {
    return null;
  }
}

// Backward-compatibility aliases
export const bufferToBase64 = bufferToBase64Url;
export const base64ToBuffer = base64UrlToBuffer;

/**
 * Mendapatkan RP ID yang valid sesuai spesifikasi WebAuthn W3C.
 * Menghindari melempar SecurityError jika origin adalah alamat IP.
 */
function getValidRpId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const hostname = window.location.hostname;
  if (!hostname) return undefined;
  // Sesuai WebAuthn spec: rpId TIDAK boleh berupa alamat IPv4 atau IPv6
  const isIpv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(hostname);
  const isIpv6 = hostname.includes(':');
  if (isIpv4 || isIpv6) {
    return undefined;
  }
  return hostname;
}

export class BiometricService {
  /**
   * Mengecek apakah browser mendukung Web Authentication API
   */
  public static isSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(
      window.PublicKeyCredential &&
      navigator.credentials &&
      typeof navigator.credentials.create === 'function' &&
      typeof navigator.credentials.get === 'function'
    );
  }

  /**
   * Mengecek apakah lingkungan browser aman (HTTPS / localhost)
   */
  public static isSecureContext(): boolean {
    if (typeof window === 'undefined') return false;
    return Boolean(window.isSecureContext);
  }

  /**
   * Mengecek apakah aplikasi dibuka di dalam in-app browser (WebView WhatsApp, Instagram, dll)
   * di mana WebAuthn sering diblokir oleh container aplikasi
   */
  public static isWebViewOrInAppBrowser(): boolean {
    if (typeof window === 'undefined') return false;
    const ua = navigator.userAgent || '';
    return /FBAN|FBAV|Instagram|WhatsApp|Line|Snapchat|MicroMessenger|musical_ly|BytedanceWebview/i.test(ua);
  }

  /**
   * Mengecek apakah perangkat HP memiliki sensor biometrik bawaan (Fingerprint / Face ID / Touch ID)
   */
  public static async isPlatformAuthenticatorAvailable(): Promise<boolean> {
    if (!this.isSupported()) return false;
    try {
      if (typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
        const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
        return Boolean(available);
      }
      return false;
    } catch (err) {
      logger.warn('BiometricService', 'Error checking platform authenticator:', err);
      return false;
    }
  }

  /**
   * Mengecek apakah user sudah mendaftarkan sidik jari HP ini di sistem
   */
  public static isEnrolled(userId: string): boolean {
    if (!userId) return false;
    try {
      const saved = localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
      return Boolean(saved && saved.length > 5);
    } catch {
      return false;
    }
  }

  /**
   * Mendapatkan credential ID yang terdaftar untuk user
   */
  public static getEnrolledCredentialId(userId: string): string | null {
    if (!userId) return null;
    try {
      return localStorage.getItem(`${STORAGE_KEY_PREFIX}${userId}`);
    } catch {
      return null;
    }
  }

  /**
   * Mendapatkan status kesiapan biometrik perangkat HP secara komprehensif
   */
  public static async checkAvailability(userId: string): Promise<BiometricAvailability> {
    const isSupported = this.isSupported();
    const hasPlatformSensor = isSupported ? await this.isPlatformAuthenticatorAvailable() : false;
    const isEnrolled = this.isEnrolled(userId);
    const credentialId = isEnrolled ? this.getEnrolledCredentialId(userId) : null;

    return {
      isSupported,
      hasPlatformSensor,
      isEnrolled,
      credentialId,
    };
  }

  /**
   * Mendaftarkan sidik jari HP guru untuk akun terkait (Enrollment)
   * Membuka sensor dialog bawaan OS Android / iOS: "Sentuh sensor sidik jari Anda"
   */
  public static async registerBiometric(
    userId: string,
    userName: string
  ): Promise<BiometricVerificationResult> {
    logger.info('BiometricService', 'Starting biometric registration for user:', { userId, userName });

    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Browser atau perangkat Anda belum mendukung otentikasi biometrik sidik jari.',
      };
    }

    try {
      // 32-byte Cryptographic Random Challenge
      const challenge = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(challenge);
      } else {
        for (let i = 0; i < 32; i++) challenge[i] = Math.floor(Math.random() * 256);
      }

      const userBytes = new TextEncoder().encode(userId);
      const rpId = getValidRpId();

      const rpConfig: PublicKeyCredentialRpEntity = {
        name: 'Smart Absensi Guru',
      };
      if (rpId) {
        rpConfig.id = rpId;
      }

      const creationOptions: CredentialCreationOptions = {
        publicKey: {
          rp: rpConfig,
          user: {
            id: userBytes,
            name: userId,
            displayName: userName || 'Guru',
          },
          challenge: challenge,
          pubKeyCredParams: [
            { alg: -7, type: 'public-key' },  // ES256
            { alg: -257, type: 'public-key' }, // RS256
          ],
          authenticatorSelection: {
            authenticatorAttachment: 'platform',
            userVerification: 'preferred', // 'preferred' lebih toleran terhadap berbagai varian Android OEM
            residentKey: 'preferred',
          },
          timeout: 60000,
          attestation: 'none',
        },
      };

      const credential = (await navigator.credentials.create(creationOptions)) as PublicKeyCredential | null;

      if (!credential) {
        return {
          success: false,
          error: 'Pendaftaran sidik jari gagal atau dibatalkan oleh pengguna.',
        };
      }

      const rawId = credential.rawId ? bufferToBase64Url(credential.rawId) : credential.id;
      localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, rawId);

      logger.info('BiometricService', 'Biometric credential registered successfully:', { rawId });

      return {
        success: true,
        credentialId: rawId,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      logger.error('BiometricService', 'Biometric registration error:', err);
      return {
        success: false,
        error: this.formatBiometricError(err, 'Pendaftaran'),
      };
    }
  }

  /**
   * Memverifikasi sidik jari guru saat absensi
   * Membuka sensor dialog bawaan OS Android / iOS: "Pindai Sidik Jari untuk Konfirmasi Kehadiran"
   */
  public static async verifyBiometric(userId: string): Promise<BiometricVerificationResult> {
    logger.info('BiometricService', 'Executing biometric verification for attendance:', { userId });

    if (!this.isSupported()) {
      return {
        success: false,
        error: 'Perangkat atau browser Anda tidak mendukung pemindaian sidik jari.',
      };
    }

    try {
      const challenge = new Uint8Array(32);
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
        window.crypto.getRandomValues(challenge);
      } else {
        for (let i = 0; i < 32; i++) challenge[i] = Math.floor(Math.random() * 256);
      }

      const rpId = getValidRpId();
      const storedCredId = this.getEnrolledCredentialId(userId);

      const allowCredentials: PublicKeyCredentialDescriptor[] = [];
      if (storedCredId) {
        const credBuffer = safeBase64UrlToBuffer(storedCredId);
        if (credBuffer) {
          allowCredentials.push({
            id: credBuffer,
            type: 'public-key',
            // PENTING: Jangan batasi transports ke ['internal'].
            // Android modern (Chrome 108+ / Google Play Services Passkeys) mengekspos
            // credential sebagai hybrid/internal. Membatasi transport menyebabkan NotAllowedError.
          });
        }
      }

      const requestOptions: CredentialRequestOptions = {
        publicKey: {
          challenge: challenge,
          ...(rpId ? { rpId } : {}),
          userVerification: 'preferred',
          timeout: 60000,
          allowCredentials: allowCredentials.length > 0 ? allowCredentials : undefined,
        },
      };

      const assertion = (await navigator.credentials.get(requestOptions)) as PublicKeyCredential | null;

      if (!assertion) {
        return {
          success: false,
          error: 'Verifikasi sidik jari tidak berhasil.',
        };
      }

      const assertionId = assertion.rawId ? bufferToBase64Url(assertion.rawId) : assertion.id;

      // Update stored credential jika belum tersimpan
      if (!storedCredId && assertionId) {
        localStorage.setItem(`${STORAGE_KEY_PREFIX}${userId}`, assertionId);
      }

      logger.info('BiometricService', 'Biometric verified successfully:', { assertionId });

      return {
        success: true,
        credentialId: assertionId,
        timestamp: new Date().toISOString(),
      };
    } catch (err: unknown) {
      logger.error('BiometricService', 'Biometric verification error:', err);
      return {
        success: false,
        error: this.formatBiometricError(err, 'Verifikasi'),
      };
    }
  }

  /**
   * Menghapus pendaftaran sidik jari perangkat ini untuk user
   */
  public static clearEnrollment(userId: string): void {
    if (!userId) return;
    try {
      localStorage.removeItem(`${STORAGE_KEY_PREFIX}${userId}`);
      logger.info('BiometricService', 'Biometric enrollment cleared for user:', { userId });
    } catch (err) {
      logger.warn('BiometricService', 'Failed to clear biometric enrollment:', err);
    }
  }

  /**
   * Mereset pendaftaran sidik jari agar guru dapat mendaftar ulang di HP ini
   */
  public static resetBiometricEnrollment(userId: string): void {
    this.clearEnrollment(userId);
  }

  /**
   * Format pesan error WebAuthn menjadi bahasa Indonesia yang ramah pengguna
   */
  private static formatBiometricError(err: unknown, actionName: string): string {
    if (!err) return `${actionName} sidik jari gagal.`;

    const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: string }).name) : '';
    const message = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: string }).message) : String(err);
    const lowerMessage = message.toLowerCase();

    if (
      name === 'NotAllowedError' ||
      lowerMessage.includes('cancelled') ||
      lowerMessage.includes('canceled') ||
      lowerMessage.includes('not allowed')
    ) {
      if (lowerMessage.includes('already in progress') || lowerMessage.includes('pending request')) {
        return 'Sensor sidik jari sedang aktif memproses permintaan lain. Harap tunggu 1 detik lalu coba kembali.';
      }
      if (lowerMessage.includes('no eligible credentials') || lowerMessage.includes('not found') || lowerMessage.includes('credentials')) {
        return 'Sidik jari tidak cocok dengan akun HP ini atau pengaturan kunci layar telah diubah. Silakan gunakan tombol "Daftar Ulang Sidik Jari" di bawah.';
      }
      return `${actionName} sidik jari dibatalkan, waktu tunggu habis, atau sidik jari tidak cocok. Silakan coba kembali.`;
    }

    if (name === 'InvalidStateError' || lowerMessage.includes('already registered')) {
      return 'Sidik jari perangkat ini sudah terdaftar di sistem. Jika bermasalah, silakan klik Daftar Ulang.';
    }

    if (name === 'NotSupportedError' || lowerMessage.includes('not supported')) {
      return 'Sensor sidik jari / WebAuthn tidak didukung pada browser atau perangkat ini. Gunakan Google Chrome versi terbaru.';
    }

    if (name === 'SecurityError' || lowerMessage.includes('domain') || lowerMessage.includes('security') || lowerMessage.includes('insecure')) {
      return 'Keamanan browser membatasi akses biometrik. Pastikan mengakses via domain resmi/HTTPS dan bukan dari browser internal WhatsApp.';
    }

    if (name === 'AbortError' || lowerMessage.includes('abort')) {
      return 'Pemindaian sidik jari terputus. Silakan tekan tombol kembali untuk memindai.';
    }

    if (name === 'ConstraintError') {
      return 'Konfigurasi biometrik HP belum memenuhi syarat autentikasi aman.';
    }

    return `${actionName} sidik jari gagal: ${message || 'Terjadi kendala sensor pada HP.'}`;
  }
}
