/**
 * Smart Absensi Guru - Attendance Policy & Terms Agreement Service
 * Mengelola persetujuan Syarat & Ketentuan Jam Pulang dan Kebijakan Penalti Poin
 */

import { ProviderFactory } from '../providers/provider-factory';
import { logger } from '../utils/logger.utils';
import { NotificationService } from './notification-permission.service';
import type { AttendanceRecord, HolidayRecord, TeacherPointLog } from '../types/database.types';

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
   * Evaluasi Otomatis Penalti Pengurangan Poin (-10 Pts) bagi Guru yang Lupa/Tidak Absen Pulang (TAP).
   * Berlaku universal (dengan atau tanpa ceklis persetujuan) untuk menjamin kedisiplinan.
   * Didesain dengan proteksi Zero-Egress (menggunakan array in-memory pointLogs jika disediakan).
   */
  public static async evaluateUncheckedOutPenalties(
    userId: string,
    teacherName: string,
    attendanceHistory: AttendanceRecord[],
    existingPointLogs?: TeacherPointLog[],
    token?: string
  ): Promise<void> {
    if (!userId) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const provider = ProviderFactory.getProvider();

    try {
      // Ambil point logs user (gunakan in-memory jika tersedia demi zero egress)
      const pointLogs = existingPointLogs || (await provider.getTeacherPointHistory(userId, token));

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
              description: `Pengurangan 10 poin atas kelalaian presensi pulang sekolah (${penaltyIdempotencyKey}).`,
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

  /**
   * Evaluasi Otomatis Penalti Pengurangan Poin (-10 Pts) bagi Guru yang Alpa (Tidak Hadir Tanpa Keterangan).
   * Berlaku universal pada hari kerja (Senin-Jumat) yang bukan hari libur sekolah.
   * Didesain Zero-Egress: memindai hanya bulan berjalan dan memakai array memori yang sudah di-fetch.
   */
  public static async evaluateAlpaPenalties(
    userId: string,
    teacherName: string,
    attendanceHistory: AttendanceRecord[],
    holidays?: HolidayRecord[],
    existingPointLogs?: TeacherPointLog[],
    token?: string,
    userCreatedAt?: string
  ): Promise<void> {
    if (!userId) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    // Batasi awal evaluasi: 1 bulan berjalan atau tanggal pembuatan user
    const firstDayOfMonthStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
    let startDateStr = firstDayOfMonthStr;
    if (userCreatedAt) {
      const userCreatedDateStr = userCreatedAt.slice(0, 10);
      if (userCreatedDateStr > startDateStr) {
        startDateStr = userCreatedDateStr;
      }
    }

    const provider = ProviderFactory.getProvider();

    try {
      // Gunakan log poin in-memory jika ada demi proteksi egress
      const pointLogs = existingPointLogs || (await provider.getTeacherPointHistory(userId, token));

      // Buat set tanggal libur untuk pencocokan O(1) cepat
      const holidayDateSet = new Set<string>();
      if (Array.isArray(holidays)) {
        for (const h of holidays) {
          if (
            h &&
            h.date &&
            h.category_type !== 'SCHEDULE' &&
            h.is_holiday !== false &&
            (h.type === 'NATIONAL_HOLIDAY' || h.type === 'SCHOOL_HOLIDAY' || h.type === 'CUTI_BERSAMA')
          ) {
            holidayDateSet.add(h.date);
          }
        }
      }

      // Buat map kehadiran user per tanggal untuk pencocokan O(1)
      const attendanceMap = new Map<string, AttendanceRecord>();
      for (const att of attendanceHistory || []) {
        if (att && att.date && att.user_id === userId) {
          attendanceMap.set(att.date, att);
        }
      }

      // Loop dari startDateStr hingga kemarin (< todayStr)
      const startDate = new Date(startDateStr);
      const endDate = new Date(todayStr);

      const curDate = new Date(startDate);
      while (curDate < endDate) {
        const curDateStr = curDate.toISOString().split('T')[0];
        const dayOfWeek = curDate.getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri, 6 = Sat

        // Maju 1 hari untuk iterasi berikutnya
        curDate.setDate(curDate.getDate() + 1);

        // Abaikan akhir pekan (Sabtu & Minggu)
        if (dayOfWeek === 0 || dayOfWeek === 6) continue;

        // Abaikan hari libur sekolah / nasional
        if (holidayDateSet.has(curDateStr)) continue;

        // Cek apakah ada kehadiran yang sah
        const att = attendanceMap.get(curDateStr);
        if (att) {
          if (
            att.status === 'HADIR' ||
            att.status === 'TERLAMBAT' ||
            att.status === 'IZIN' ||
            att.status === 'SAKIT'
          ) {
            continue;
          }
        }

        // Guru tidak hadir / ALPA pada hari kerja aktif
        const penaltyIdempotencyKey = `PENALTY_ALPA_${curDateStr}`;
        const alreadyPenalized = pointLogs.some(
          (p) =>
            p.date === curDateStr &&
            (p.title?.includes('Alpa') ||
              p.title?.includes('ALFA') ||
              p.description?.includes(penaltyIdempotencyKey))
        );

        if (!alreadyPenalized) {
          logger.info(
            'AttendancePolicyService',
            `Applying -10 points ALPA penalty for ${teacherName} on ${curDateStr}`
          );

          await provider.recordTeacherPoint(
            {
              user_id: userId,
              teacher_name: teacherName,
              date: curDateStr,
              points: -10,
              activity_type: 'PENALTY_ALFA',
              title: `Penalti Ketidakhadiran (Alpa) - ${curDateStr}`,
              description: `Pengurangan 10 poin atas ketidakhadiran tanpa keterangan pada hari kerja (${penaltyIdempotencyKey}).`,
            },
            token
          );

          // Push notifikasi ke guru
          NotificationService.sendNativeNotification({
            title: `⚠️ Pengurangan Poin: Ketidakhadiran (Alpa)`,
            body: `Poin kedisiplinan Anda dikurangi 10 poin karena tidak tercatat presensi atau izin pada ${curDateStr}.`,
            type: 'SYSTEM',
            teacherName,
            userId,
            roleTarget: 'GURU',
            actionUrl: '/?tab=BERANDA',
          });
        }
      }
    } catch (err) {
      logger.warn('AttendancePolicyService', 'Failed to evaluate ALPA penalties:', err);
    }
  }

  /**
   * Eksekusi Terpadu: Menjalankan evaluasi TAP dan ALPA sekaligus
   * Memanfaatkan in-memory data agar 0% membebani Egress Supabase.
   */
  public static async evaluateAllPenalties(
    userId: string,
    teacherName: string,
    attendanceHistory: AttendanceRecord[],
    holidays?: HolidayRecord[],
    existingPointLogs?: TeacherPointLog[],
    token?: string,
    userCreatedAt?: string
  ): Promise<void> {
    await this.evaluateUncheckedOutPenalties(userId, teacherName, attendanceHistory, existingPointLogs, token);
    await this.evaluateAlpaPenalties(userId, teacherName, attendanceHistory, holidays, existingPointLogs, token, userCreatedAt);
  }
}
