/**
 * SMART ABSENSI GURU - WHATSAPP GROUP NOTIFICATION SERVICE
 * Dispatches attendance event summaries directly to the School WhatsApp Group.
 *
 * Privacy Policy: STRICTLY TEXT-ONLY.
 * Hidden camera captures, stealth snapshots, or selfie images are strictly forbidden.
 * Security: Uses Vercel Serverless Proxy (/api/whatsapp) to protect gateway credentials.
 */

import { logger } from '../utils/logger.utils';
import { getCurrentTimeInJakarta, getTodayDateInJakarta } from '../utils/time.utils';

export interface WhatsAppAttendanceParams {
  teacherName: string;
  nip?: string;
  role?: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | string;
  timeStr?: string;
  dateStr?: string;
  method?: string;
  distanceMeters?: number | string;
  status?: string;
  isOffline?: boolean;
}

export class WhatsAppNotificationService {
  private static readonly PROXY_ENDPOINT = '/api/whatsapp';

  /**
   * Dispatches text-only attendance summary to the School WhatsApp Group.
   * Fire-and-forget: never throws unhandled errors or blocks the UI attendance flow.
   */
  public static async sendAttendanceNotification(
    params: WhatsAppAttendanceParams
  ): Promise<boolean> {
    try {
      const sanitizedPayload = {
        teacherName: params.teacherName || 'Guru',
        npp: params.nip || undefined,
        role: params.role || 'GURU',
        type: params.type || 'CHECK_IN',
        timeStr: params.timeStr || getCurrentTimeInJakarta(),
        dateStr: params.dateStr || getTodayDateInJakarta(),
        method: params.method || 'QR_CODE',
        distanceMeters: params.distanceMeters,
        status: params.status || 'HADIR TEPAT WAKTU',
        isOffline: Boolean(params.isOffline),
      };

      // Dispatched via Vercel Serverless Proxy
      const response = await fetch(this.PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_attendance_notification',
          attendance: sanitizedPayload,
        }),
      });

      if (!response.ok) {
        logger.warn(
          'WhatsAppNotificationService',
          `Serverless proxy returned status ${response.status}. Notifikasi WA grup dilewati.`
        );
        return false;
      }

      const resData = await response.json().catch(() => ({}));
      if (resData.status === 'ignored') {
        logger.info(
          'WhatsAppNotificationService',
          'WhatsApp Gateway belum dikonfigurasi di Vercel env. Notifikasi dilewati dengan aman.'
        );
        return true;
      }

      logger.info(
        'WhatsAppNotificationService',
        'Notifikasi presensi teks berhasil dikirim ke Grup WhatsApp Sekolah'
      );
      return true;
    } catch (err: any) {
      logger.warn(
        'WhatsAppNotificationService',
        'Kendala pengiriman notifikasi WhatsApp ke grup:',
        err?.message || err
      );
      return false;
    }
  }

  /**
   * Tests connection to WhatsApp Gateway via Vercel proxy.
   */
  public static async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(this.PROXY_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'test_connection' }),
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success) {
        return {
          success: true,
          message: 'WhatsApp Gateway aktif dan berhasil terhubung ke server.',
        };
      }

      return {
        success: false,
        message: data.reason || data.error || 'Gateway belum terhubung atau belum scan QR.',
      };
    } catch (err: any) {
      return {
        success: false,
        message: err?.message || 'Gagal menghubungi serverless proxy WhatsApp.',
      };
    }
  }
}
