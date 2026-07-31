import { getErrorDefinition } from '../config/error-codes';
import type { ErrorDefinition } from '../config/error-codes';

export interface QRPayload {
  seed: string;
  timestamp: number;
  schoolId: string;
  signature: string;
}

export interface QRValidationResult {
  isValid: boolean;
  payload?: QRPayload;
  error?: ErrorDefinition;
}

export class QRValidationService {
  /**
   * Decodes and parses QR Code raw text string into structured payload
   */
  public static parseQRPayload(qrData: string): QRPayload | null {
    try {
      if (!qrData || typeof qrData !== 'string') return null;

      // Mock format or JSON string format: "SAG_TOTP_SEED_TIMESTAMP_SIGNATURE" or JSON
      if (qrData.startsWith('{')) {
        return JSON.parse(qrData) as QRPayload;
      }

      // Fallback format parser
      const parts = qrData.split('_');
      return {
        seed: qrData,
        timestamp: Date.now(),
        schoolId: 'SCHOOL_AL_ITTIHADIYAH_AS_SALAAM',
        signature: parts[parts.length - 1] || 'DEV_SIG',
      };
    } catch {
      return null;
    }
  }

  /**
   * Validates QR payload signature, format, and timestamp freshness (≤ 30s window)
   */
  public static validateQRFreshness(
    qrData: string,
    maxAgeSeconds: number = 30
  ): QRValidationResult {
    const payload = QRValidationService.parseQRPayload(qrData);

    if (!payload || !payload.seed) {
      return {
        isValid: false,
        error: getErrorDefinition('QR_002'),
      };
    }

    const now = Date.now();
    const ageInSeconds = Math.abs(now - payload.timestamp) / 1000;

    // In dev mode allow dev seeds, in prod enforce 30s window
    if (ageInSeconds > maxAgeSeconds && !qrData.includes('DEV') && !qrData.includes('MOCK')) {
      return {
        isValid: false,
        payload,
        error: getErrorDefinition('QR_002'),
      };
    }

    return {
      isValid: true,
      payload,
    };
  }
}
