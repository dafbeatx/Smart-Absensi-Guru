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
  npp?: string;
  role?: string;
  type: 'CHECK_IN' | 'CHECK_OUT' | string;
  timeStr?: string;
  dateStr?: string;
  method?: string;
  distanceMeters?: number | string;
  status?: string;
  isOffline?: boolean;
}

export interface WhatsAppLeaveParams {
  teacherName: string;
  nip?: string;
  npp?: string;
  role?: string;
  leaveType: 'SAKIT' | 'IZIN' | 'DINAS_LUAR' | 'CUTI' | string;
  startDate: string;
  endDate: string;
  reason: string;
  dutyTeacherNotes?: string;
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
        npp: params.npp || params.nip || undefined,
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
   * Generates formatted text for WhatsApp Click-to-Chat (100% text-only, no photos).
   */
  public static generateWhatsAppShareText(params: WhatsAppAttendanceParams): string {
    const isMasuk = params.type === 'CHECK_IN' || String(params.status).toUpperCase().includes('MASUK');
    const actionTitle = isMasuk ? 'PRESENSI MASUK' : 'PRESENSI PULANG';
    const actionEmoji = isMasuk ? '🟢' : '🔵';
    const dateDisplay = params.dateStr || getTodayDateInJakarta();
    const timeDisplay = params.timeStr || getCurrentTimeInJakarta();
    const nppDisplay = (params.npp || params.nip || '').trim() || '-';
    const roleDisplay = params.role === 'ADMIN' ? 'Administrator' : params.role === 'KEPSEK' ? 'Kepala Sekolah' : 'Guru / Pendidik';

    let distanceDisplay = '-';
    if (params.distanceMeters !== undefined && params.distanceMeters !== null) {
      const num = Number(params.distanceMeters);
      distanceDisplay = !isNaN(num) ? `Radius ~${Math.round(num)} meter` : String(params.distanceMeters);
    }

    const methodDisplay = params.method === 'FACE' ? 'Verifikasi Wajah (Biometrik)'
      : params.method === 'QR_CODE' ? 'Scan Barcode / QR Poster'
      : params.method === 'BIOMETRIC_GPS' ? 'Sidik Jari HP + Radar GPS'
      : params.method === 'GEOFENCE' ? 'Geolokasi Radar GPS'
      : params.method || 'Presensi Mandiri';

    const modeDisplay = params.isOffline ? ' (Mode Sinkronisasi Offline)' : '';

    return [
      `🔔 *NOTIFIKASI PRESENSI GURU*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `${actionEmoji} *Aktivitas:* ${actionTitle}${modeDisplay}`,
      `👤 *Nama:* ${params.teacherName || 'Guru'}`,
      `🆔 *NPP:* ${nppDisplay}`,
      `💼 *Jabatan:* ${roleDisplay}`,
      `📅 *Hari/Tgl:* ${dateDisplay}`,
      `⏰ *Pukul:* ${timeDisplay}`,
      `📌 *Status:* ${params.status || 'HADIR TEPAT WAKTU'}`,
      `📍 *Lokasi:* ${distanceDisplay}`,
      `🔍 *Metode:* ${methodDisplay}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `_Smart Absensi Guru • Terverifikasi Sistem_`,
    ].join('\n');
  }

  /**
   * Generates WhatsApp universal Click-to-Chat link pre-filled with attendance summary.
   * Compatible with WhatsApp Mobile (Android/iOS) and WhatsApp Web.
   */
  public static generateWhatsAppShareUrl(params: WhatsAppAttendanceParams, targetPhone?: string): string {
    const text = this.generateWhatsAppShareText(params);
    const encoded = encodeURIComponent(text);
    if (targetPhone && targetPhone.trim()) {
      const cleanPhone = targetPhone.replace(/\D/g, '');
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    }
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }

  /**
   * Directly launches WhatsApp with the pre-filled text in 1 click.
   */
  public static openWhatsAppShare(params: WhatsAppAttendanceParams, targetPhone?: string): void {
    const url = this.generateWhatsAppShareUrl(params, targetPhone);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  /**
   * Generates formatted text for WhatsApp Click-to-Chat for Leave / Absence requests.
   * Includes teacher identity, type (Izin, Sakit, Dinas, Cuti), dates, reason, and duty teacher notes.
   */
  public static generateWhatsAppLeaveShareText(params: WhatsAppLeaveParams): string {
    const rawType = String(params.leaveType || 'IZIN').toUpperCase();
    let badgeTitle = 'PERMOHONAN IZIN';
    let typeEmoji = '📝';
    let typeLabel = 'Izin Resmi / Keperluan Pribadi';

    if (rawType === 'SAKIT') {
      badgeTitle = 'SURAT KETERANGAN SAKIT';
      typeEmoji = '🤒';
      typeLabel = 'Izin Sakit';
    } else if (rawType === 'DINAS_LUAR') {
      badgeTitle = 'PEMBERITAHUAN DINAS LUAR';
      typeEmoji = '💼';
      typeLabel = 'Tugas / Dinas Luar Sekolah';
    } else if (rawType === 'CUTI') {
      badgeTitle = 'PERMOHONAN CUTI RESMI';
      typeEmoji = '🏖️';
      typeLabel = 'Cuti Tahunan / Resmi';
    }

    const nppDisplay = (params.npp || params.nip || '').trim() || '-';
    const roleDisplay =
      params.role === 'ADMIN'
        ? 'Administrator'
        : params.role === 'KEPSEK'
        ? 'Kepala Sekolah'
        : 'Guru / Tenaga Pendidik';

    const startDate = params.startDate;
    const endDate = params.endDate || params.startDate;
    const dateDisplay =
      startDate === endDate
        ? startDate
        : `${startDate} s.d. ${endDate}`;

    const dutyNotes = (params.dutyTeacherNotes || '').trim() || 'Siswa belajar mandiri / mengerjakan materi buku paket.';

    return [
      `📢 *${badgeTitle}*`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `${typeEmoji} *Jenis:* ${typeLabel}`,
      `👤 *Nama:* ${params.teacherName || 'Guru'}`,
      `🆔 *NPP:* ${nppDisplay}`,
      `💼 *Jabatan:* ${roleDisplay}`,
      `📅 *Tanggal:* ${dateDisplay}`,
      `📝 *Keterangan / Alasan:*`,
      `${params.reason || '-'}`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `📋 *TUGAS UNTUK GURU PIKET:*`,
      `"${dutyNotes}"`,
      `━━━━━━━━━━━━━━━━━━━━`,
      `_Smart Absensi Guru • Terverifikasi Otomatis_`,
    ].join('\n');
  }

  /**
   * Generates WhatsApp universal Click-to-Chat link pre-filled with leave request and piket task.
   */
  public static generateWhatsAppLeaveShareUrl(params: WhatsAppLeaveParams, targetPhone?: string): string {
    const text = this.generateWhatsAppLeaveShareText(params);
    const encoded = encodeURIComponent(text);
    if (targetPhone && targetPhone.trim()) {
      const cleanPhone = targetPhone.replace(/\D/g, '');
      return `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`;
    }
    return `https://api.whatsapp.com/send?text=${encoded}`;
  }

  /**
   * Directly launches WhatsApp with the pre-filled leave & piket task text in 1 click.
   */
  public static openWhatsAppLeaveShare(params: WhatsAppLeaveParams, targetPhone?: string): void {
    const url = this.generateWhatsAppLeaveShareUrl(params, targetPhone);
    if (typeof window !== 'undefined') {
      window.open(url, '_blank');
    }
  }

  /**
   * Dispatches text-only leave notification with piket tasks to the School WhatsApp Group via serverless proxy.
   * Fire-and-forget: never throws unhandled errors or blocks the UI flow.
   */
  public static async sendLeaveNotification(params: WhatsAppLeaveParams): Promise<boolean> {
    try {
      const sanitizedPayload = {
        teacherName: params.teacherName || 'Guru',
        npp: params.npp || params.nip || undefined,
        role: params.role || 'GURU',
        leaveType: params.leaveType || 'IZIN',
        startDate: params.startDate,
        endDate: params.endDate || params.startDate,
        reason: params.reason || '',
        dutyTeacherNotes: params.dutyTeacherNotes || '',
      };

      const response = await fetch(this.PROXY_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'send_leave_notification',
          leave: sanitizedPayload,
        }),
      });

      if (!response.ok) {
        logger.warn(
          'WhatsAppNotificationService',
          `Serverless proxy returned status ${response.status}. Notifikasi izin WA grup dilewati.`
        );
        return false;
      }

      const resData = await response.json().catch(() => ({}));
      if (resData.status === 'ignored') {
        logger.info(
          'WhatsAppNotificationService',
          'WhatsApp Gateway belum dikonfigurasi di Vercel env. Notifikasi izin dilewati dengan aman.'
        );
        return true;
      }

      logger.info(
        'WhatsAppNotificationService',
        'Notifikasi izin & tugas guru piket berhasil dikirim ke Grup WhatsApp Sekolah'
      );
      return true;
    } catch (err: any) {
      logger.warn(
        'WhatsAppNotificationService',
        'Kendala pengiriman notifikasi izin WhatsApp ke grup:',
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

