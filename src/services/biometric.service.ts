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

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer as ArrayBuffer;
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
      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';

      const creationOptions: CredentialCreationOptions = {
        publicKey: {
          rp: {
            name: 'Smart Absensi Guru',
            id: host,
          },
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
            userVerification: 'required',
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

      const rawId = credential.rawId ? bufferToBase64(credential.rawId) : credential.id;
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

      const host = typeof window !== 'undefined' && window.location.hostname ? window.location.hostname : 'localhost';
      const storedCredId = this.getEnrolledCredentialId(userId);

      const allowCredentials: PublicKeyCredentialDescriptor[] = [];
      if (storedCredId) {
        try {
          allowCredentials.push({
            id: base64ToBuffer(storedCredId),
            type: 'public-key',
            transports: ['internal'],
          });
        } catch {
          // If stored string is not valid base64, proceed without allowCredentials filter
        }
      }

      const requestOptions: CredentialRequestOptions = {
        publicKey: {
          challenge: challenge,
          rpId: host,
          userVerification: 'required',
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

      const assertionId = assertion.rawId ? bufferToBase64(assertion.rawId) : assertion.id;

      // Update stored credential if user hadn't enrolled explicitly before
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
   * Format pesan error WebAuthn menjadi bahasa Indonesia yang ramah pengguna
   */
  private static formatBiometricError(err: unknown, actionName: string): string {
    if (!err) return `${actionName} sidik jari gagal.`;

    const name = typeof err === 'object' && err !== null && 'name' in err ? String((err as { name: string }).name) : '';
    const message = typeof err === 'object' && err !== null && 'message' in err ? String((err as { message: string }).message) : String(err);

    if (name === 'NotAllowedError' || message.includes('cancelled') || message.includes('canceled') || message.includes('NotAllowedError')) {
      return `${actionName} sidik jari dibatalkan atau waktu tunggu habis. Silakan coba kembali.`;
    }

    if (name === 'InvalidStateError' || message.includes('already registered')) {
      return 'Sidik jari perangkat ini sudah terdaftar di sistem.';
    }

    if (name === 'NotSupportedError' || message.includes('not supported')) {
      return 'Sensor sidik jari tidak didukung pada browser atau perangkat ini.';
    }

    if (name === 'SecurityError' || message.includes('domain') || message.includes('security')) {
      return 'Keamanan browser membatasi akses biometrik. Pastikan menggunakan domain atau HTTPS yang valid.';
    }

    return `${actionName} sidik jari gagal: ${message || 'Terjadi kendala sensor pada HP.'}`;
  }
}
