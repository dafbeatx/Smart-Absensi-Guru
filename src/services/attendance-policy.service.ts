/**
 * Smart Absensi Guru - Attendance Policy & Terms Agreement Service
 * Mengelola persetujuan Syarat & Ketentuan Jam Pulang dan Kebijakan Penalti Poin
 */

import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger.utils';
import { NotificationService } from './notification-permission.service';
import type { AttendanceRecord } from '../types/database.types';

export interface AttendancePolicyAgreement {
  agreed: boolean;
  agreed_at: string;
  version: string;
}

export class AttendancePolicyService {
  private static readonly STORAGE_PREFIX = 'smart_absensi_policy_agreed_';
  private static readonly POLICY_VERSION = 'v1.0';

  /**
   * Cek apakah guru telah menceklis & menyetujui Kebijakan Disiplin Absensi Datang & Pulang
   */
  public static isPolicyAgreed(userId?: string): boolean {
    if (!userId || typeof window === 'undefined') return false;
    try {
      const key = `${this.STORAGE_PREFIX}${userId}`;
      const saved = localStorage.getItem(key);
      if (!saved) return false;
      const parsed: AttendancePolicyAgreement = JSON.parse(saved);
      return Boolean(parsed && parsed.agreed);
    } catch {
      return false;
    }
  }

  /**
   * Menyimpan persetujuan Syarat & Ketentuan secara persistent (localStorage + backend provider)
   */
  public static async savePolicyAgreement(
    userId: string,
    agreed: boolean,
    token?: string
  ): Promise<boolean> {
    if (!userId || typeof window === 'undefined') return false;

    const payload: AttendancePolicyAgreement = {
      agreed,
      agreed_at: new Date().toISOString(),
      version: this.POLICY_VERSION,
    };

    try {
      const key = `${this.STORAGE_PREFIX}${userId}`;
      localStorage.setItem(key, JSON.stringify(payload));

      // Sinkronkan ke backend provider (cross-device sync HP & Laptop)
      try {
        const provider = ProviderFactory.getProvider();
        await provider.saveNotificationPreferences(
          userId,
          {
            user_id: userId,
            attendance_policy_agreed: agreed,
            attendance_policy_agreed_at: payload.agreed_at,
          },
          token
        );
      } catch (errBackend) {
        logger.warn('AttendancePolicyService', 'Failed to sync policy agreement to backend:', errBackend);
      }

      // Dispatch event lintas window
      window.dispatchEvent(
        new CustomEvent('smart_absensi_policy_updated', {
          detail: { userId, agreed, agreedAt: payload.agreed_at },
        })
      );

      return true;
    } catch (e) {
      logger.error('AttendancePolicyService', 'Failed to save policy agreement:', e);
      return false;
    }
  }

  /**
   * Evaluasi Otomatis Penalti Pengurangan Poin (-10 Pts) bagi Guru yang Lupa/Tidak Absen Pulang (TAP)
   * Hanya berlaku JIKA guru telah menceklis dan menyetujui Kebijakan Disiplin Presensi Sekolah.
   */
  public static async evaluateUncheckedOutPenalties(
    userId: string,
    teacherName: string,
    attendanceHistory: AttendanceRecord[],
    token?: string
  ): Promise<void> {
    if (!userId || !this.isPolicyAgreed(userId)) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const provider = ProviderFactory.getProvider();

    try {
      // Ambil point logs user untuk mengecek idempotensi penalti per tanggal
      const pointLogs = await provider.getTeacherPointHistory(userId, token);

      // Cari record hari-hari sebelum hari ini di mana guru Check-in tapi TIDAK Check-out
      const pastUncheckedOut = (attendanceHistory || []).filter((rec) => {
        if (!rec.date || rec.date >= todayStr) return false; // Jangan penalti hari yang sedang berjalan
        if (rec.status === 'BELUM_ABSEN' || rec.status === 'IZIN' || rec.status === 'SAKIT') return false;
        // Hadir check_in tapi tidak ada check_out_time
        return Boolean(rec.check_in_time && !rec.check_out_time);
      });

      for (const rec of pastUncheckedOut) {
        const penaltyIdempotencyKey = `PENALTY_TAP_${rec.date}`;
        const alreadyPenalized = pointLogs.some(
          (p) =>
            p.date === rec.date &&
            (p.title?.includes('Penalti TAP') || p.description?.includes(penaltyIdempotencyKey))
        );

        if (!alreadyPenalized) {
          logger.info(
            'AttendancePolicyService',
            `Applying -10 points TAP penalty for ${teacherName} on ${rec.date}`
          );

          await provider.recordTeacherPoint(
            {
              user_id: userId,
              teacher_name: teacherName,
              date: rec.date,
              points: -10,
              activity_type: 'PENALTY_ALFA',
              title: `Penalti TAP (Tidak Absen Pulang) - ${rec.date}`,
              description: `Pengurangan 10 poin atas kelalaian presensi pulang sekolah (${penaltyIdempotencyKey}) sesuai Kebijakan Disiplin yang disetujui.`,
            },
            token
          );

          // Push notifikasi peringatan pengurangan poin ke guru
          NotificationService.sendNativeNotification({
            title: `⚠️ Pengurangan Poin: Kelalaian Presensi Pulang`,
            body: `Poin kedisiplinan Anda dikurangi 10 poin karena tidak tercatat presensi pulang pada ${rec.date}.`,
            type: 'SYSTEM',
            teacherName,
            userId,
            roleTarget: 'GURU',
            actionUrl: '/?tab=BERANDA',
          });
        }
      }
    } catch (err) {
      logger.warn('AttendancePolicyService', 'Failed to evaluate unchecked out penalties:', err);
    }
  }
}
