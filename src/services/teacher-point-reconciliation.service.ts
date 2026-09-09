import { ProviderFactory } from '../providers/provider-factory';
import type {
  AttendanceRecord,
  TeacherPointLog,
  TeacherPointActivityType,
  TeacherDutySchedule,
} from '../types/database.types';
import { logger } from '../utils/logger.utils';

export class TeacherPointReconciliationService {
  /**
   * Mengambil hari dalam seminggu (1 = Senin, 2 = Selasa, ..., 5 = Jumat, 6 = Sabtu, 0 = Minggu)
   * dari format tanggal YYYY-MM-DD secara konsisten tanpa terpengaruh offset UTC.
   */
  private static getDayOfWeekFromDateString(dateStr: string): number {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      return new Date(year, month, day).getDay();
    }
    return new Date(dateStr).getDay();
  }

  /**
   * Rekonsiliasi idempoten antara riwayat kehadiran fisik (attendance records)
   * dengan buku besar poin guru (teacher_point_history).
   *
   * Jika terdapat kehadiran nyata (misal tanggal 8-9 September 2026):
   * - Hadir Tepat Waktu -> +15 Poin (CHECK_IN_ON_TIME)
   * - Hadir Terlambat   -> +5 Poin  (CHECK_IN_LATE)
   * - Presensi Pulang    -> +10 Poin (CHECK_OUT)
   * - Petugas Piket      -> +10 Poin (DUTY_PIKET)
   *
   * Menjamin tidak ada transaksi ganda karena mengecek keberadaan
   * kombinasi (user_id + date + activity_type).
   */
  public static async reconcilePoints(
    userId: string,
    teacherName: string,
    attendanceList: AttendanceRecord[],
    currentPointLogs: TeacherPointLog[],
    dutySchedules?: TeacherDutySchedule[],
    token?: string
  ): Promise<TeacherPointLog[]> {
    if (!userId || !Array.isArray(attendanceList) || attendanceList.length === 0) {
      return currentPointLogs || [];
    }

    const provider = ProviderFactory.getProvider();
    const updatedLogs = [...(currentPointLogs || [])];
    let hasChanges = false;

    // Ambil jadwal piket jika belum disediakan
    let activeDuties = dutySchedules;
    if (!activeDuties || activeDuties.length === 0) {
      try {
        const fetched = await provider.getDutySchedules(token);
        activeDuties = fetched || [];
      } catch (eDuty) {
        logger.warn('TeacherPointReconciliationService', 'Gagal memuat jadwal piket:', eDuty);
        activeDuties = [];
      }
    }

    for (const att of attendanceList) {
      if (!att.date || att.user_id !== userId) continue;
      const dateStr = att.date;
      const dayOfWeek = this.getDayOfWeekFromDateString(dateStr);

      // 1. Rekonsiliasi CHECK_IN (Tepat Waktu atau Terlambat)
      if (att.status === 'HADIR' || att.status === 'TERLAMBAT') {
        const isLate = att.status === 'TERLAMBAT';
        const expectedType: TeacherPointActivityType = isLate ? 'CHECK_IN_LATE' : 'CHECK_IN_ON_TIME';
        const expectedPoints = isLate ? 5 : 15;
        const expectedTitle = isLate
          ? 'Presensi Masuk Sekolah (> 07:30 WIB)'
          : 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)';
        const checkInTimeStr = att.check_in_time || (isLate ? '07:35 WIB' : '07:15 WIB');
        const expectedDesc = `Tercatat hadir pada pukul ${checkInTimeStr} via ${att.verification_method || 'QR'}`;

        const hasCheckInPoint = updatedLogs.some(
          (l) => l.user_id === userId && l.date === dateStr && (l.activity_type === 'CHECK_IN_ON_TIME' || l.activity_type === 'CHECK_IN_LATE')
        );

        if (!hasCheckInPoint) {
          try {
            const newLog = await provider.recordTeacherPoint(
              {
                user_id: userId,
                teacher_name: teacherName,
                date: dateStr,
                points: expectedPoints,
                activity_type: expectedType,
                title: expectedTitle,
                description: expectedDesc,
              },
              token
            );
            updatedLogs.unshift(newLog);
            hasChanges = true;
            logger.info('TeacherPointReconciliationService', `Reconciled check-in point for ${dateStr}: +${expectedPoints}`);
          } catch (eRec) {
            logger.warn('TeacherPointReconciliationService', `Gagal merekonsiliasi check-in ${dateStr}:`, eRec);
          }
        }
      }

      // 2. Rekonsiliasi CHECK_OUT (Presensi Pulang)
      if (att.check_out_time) {
        const hasCheckoutPoint = updatedLogs.some(
          (l) => l.user_id === userId && l.date === dateStr && l.activity_type === 'CHECK_OUT'
        );

        if (!hasCheckoutPoint) {
          try {
            const checkoutTimeStr = att.check_out_time || '13:00 WIB';
            const newLog = await provider.recordTeacherPoint(
              {
                user_id: userId,
                teacher_name: teacherName,
                date: dateStr,
                points: 10,
                activity_type: 'CHECK_OUT',
                title: 'Presensi Pulang Tuntas Bertugas',
                description: `Tercatat menyelesaikan dinas sekolah pada pukul ${checkoutTimeStr} via ${att.verification_method || 'QR'}`,
              },
              token
            );
            updatedLogs.unshift(newLog);
            hasChanges = true;
            logger.info('TeacherPointReconciliationService', `Reconciled check-out point for ${dateStr}: +10`);
          } catch (eRec) {
            logger.warn('TeacherPointReconciliationService', `Gagal merekonsiliasi check-out ${dateStr}:`, eRec);
          }
        }
      }

      // 3. Rekonsiliasi DUTY_PIKET (Tugas Piket Harian Sekolah)
      if (att.status === 'HADIR' || att.status === 'TERLAMBAT') {
        const isScheduledDuty = (activeDuties || []).some(
          (d) =>
            d.day_of_week === dayOfWeek &&
            (d.teacher_id === userId ||
              (Boolean(d.teacher_name) &&
                Boolean(teacherName) &&
                d.teacher_name.toLowerCase().includes(teacherName.toLowerCase())))
        );

        if (isScheduledDuty) {
          const hasDutyPoint = updatedLogs.some(
            (l) => l.user_id === userId && l.date === dateStr && l.activity_type === 'DUTY_PIKET'
          );

          if (!hasDutyPoint) {
            try {
              const newLog = await provider.recordTeacherPoint(
                {
                  user_id: userId,
                  teacher_name: teacherName,
                  date: dateStr,
                  points: 10,
                  activity_type: 'DUTY_PIKET',
                  title: 'Tugas Piket Harian Sekolah',
                  description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah',
                },
                token
              );
              updatedLogs.unshift(newLog);
              hasChanges = true;
              logger.info('TeacherPointReconciliationService', `Reconciled duty piket point for ${dateStr}: +10`);
            } catch (eRec) {
              logger.warn('TeacherPointReconciliationService', `Gagal merekonsiliasi piket ${dateStr}:`, eRec);
            }
          }
        }
      }
    }

    if (hasChanges) {
      return updatedLogs.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime() ||
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    }

    return currentPointLogs;
  }
}
