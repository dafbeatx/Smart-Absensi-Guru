import { ProviderFactory } from '../providers/provider-factory';
import type { AttendanceRecord, AttendanceAction, VerificationMethod, AttendanceSource } from '../types/database.types';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger.utils';
import { indexedDBService } from '../services/indexed-db.service';
import { useSyncQueueStore } from '../store/useSyncQueueStore';
import { CONSTANTS } from '../config/constants';
import { TelegramService } from '../services/telegram.service';
import { getTodayDateInJakarta } from '../utils/time.utils';

export interface ScanAttendanceDTO {
  token: string;
  qr_seed: string;
  user_lat: number;
  user_lng: number;
  device_uuid: string;
  user_id?: string;
  timestamp?: string;
  /** Distance in meters from school geofence center */
  distance_meters?: number;
  /** GPS accuracy in meters at time of scan – used for audit logging */
  gps_accuracy?: number;
  verification_method?: VerificationMethod;
  attendance_source?: AttendanceSource;
  /** Optional silent auto-capture front camera photo for Telegram audit */
  photoBlob?: Blob | null;
  /** Optional silent photo promise that resolves asynchronously in the background */
  photoPromise?: Promise<Blob | null>;
  /** Optional intended attendance action to assist logging in case of failure */
  attempt_action?: 'CHECK_IN' | 'CHECK_OUT';
}

export interface AttendanceResponseDTO {
  attendance_id: string;
  status: string;
  timestamp: string;
  distance_meters: number;
  geofence_verified: boolean;
  attendance_action?: AttendanceAction;
  is_offline?: boolean;
}

export interface CorrectAttendanceDTO {
  token: string;
  target_user_id: string;
  date: string;
  status: string;
  check_in_time: string;
  check_out_time?: string;
  reason: string;
  notes?: string;
}

export interface ResetAttendanceDTO {
  token: string;
  target_user_id: string;
  date: string;
  admin_password?: string;
  reason: string;
}

export function isNetworkOrTimeoutError(err: unknown): boolean {
  if (!err) return false;
  const msg = typeof err === 'object' && err !== null && 'message' in err
    ? String((err as { message: string }).message)
    : String(err);

  const lower = msg.toLowerCase();
  const isExplicitNetworkMessage =
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('TypeError: Failed to fetch') ||
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('koneksi internet') ||
    lower.includes('sinyal lemah') ||
    lower.includes('timeout') ||
    (lower.includes('network') && !lower.includes('social network'));

  if (isExplicitNetworkMessage) return true;

  if (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.onLine === false) {
    return true;
  }

  return false;
}

export class AttendanceRepository {
  public static async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    logger.info('AttendanceRepository', 'Executing scanAttendance via active provider', {
      lat: dto.user_lat,
      lng: dto.user_lng,
      qr_seed: dto.qr_seed,
    });

    const isOffline = typeof navigator !== 'undefined' && !navigator.onLine;
    const effectiveDistance = dto.distance_meters !== undefined ? dto.distance_meters : 10;

    if (isOffline) {
      logger.info('AttendanceRepository', 'Device is offline. Enqueuing attendance to IndexedDB...');
      const userId = useAuthStore.getState().user?.id || 'usr_offline';
      const recordId = 'att_offline_' + Date.now();
      
      await indexedDBService.enqueue({
        id: recordId,
        user_id: userId,
        qr_seed: dto.qr_seed,
        user_lat: dto.user_lat,
        user_lng: dto.user_lng,
        distance_meters: effectiveDistance,
        gps_accuracy: dto.gps_accuracy,
        timestamp: new Date().toISOString(),
        sync_status: 'PENDING',
        retry_count: 0,
      });

      // Refresh queue count in Zustand store
      const pendingItems = await indexedDBService.getPendingQueue();
      useSyncQueueStore.getState().setPendingItems(pendingItems);

      const currentUser = useAuthStore.getState().user;
      const offlineTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';

      TelegramService.sendAttendanceNotification({
        teacherName: currentUser?.full_name || dto.user_id || 'Guru',
        nip: currentUser?.nip || undefined,
        role: currentUser?.role || 'GURU',
        type: 'CHECK_IN',
        timeStr: offlineTime,
        dateStr: getTodayDateInJakarta(),
        method: dto.verification_method || 'QR_CODE',
        distanceMeters: effectiveDistance,
        status: 'HADIR (MODE OFFLINE)',
        isOffline: true,
        photoBlob: dto.photoBlob || null,
        photoPromise: dto.photoPromise,
      }).catch((e) => console.warn('Telegram offline attendance log error:', e));

      return {
        attendance_id: recordId,
        status: 'HADIR (MODE OFFLINE)',
        timestamp: offlineTime,
        distance_meters: effectiveDistance,
        geofence_verified: true,
        attendance_action: 'CHECK_IN',
        is_offline: true,
      };
    }

    try {
      // Race online provider scan vs 8000ms timeout for weak/slow 2G/3G/4G connections
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Koneksi internet lambat / sinyal lemah (Timeout 8s). Mengalihkan ke simpan offline...')), 8000)
      );

      const result = await Promise.race([
        ProviderFactory.getProvider().scanAttendance(dto),
        timeoutPromise,
      ]);

      logger.info('AttendanceRepository', 'scanAttendance success:', result);

      // Dispatch Telegram attendance notification
      const currentUser = useAuthStore.getState().user;
      TelegramService.sendAttendanceNotification({
        teacherName: currentUser?.full_name || dto.user_id || 'Guru',
        nip: currentUser?.nip || undefined,
        role: currentUser?.role || 'GURU',
        type: result.attendance_action || 'CHECK_IN',
        timeStr: result.timestamp,
        dateStr: getTodayDateInJakarta(),
        method: dto.verification_method || 'QR_CODE',
        distanceMeters: result.distance_meters,
        status: result.status,
        isOffline: result.is_offline,
        photoBlob: dto.photoBlob || null,
        photoPromise: dto.photoPromise,
      }).catch((e) => console.warn('Telegram attendance log error:', e));

      return result;
    } catch (err: unknown) {
      const isCheckoutAttempt = dto.attempt_action === 'CHECK_OUT' ||
        dto.verification_method?.includes('PULANG') ||
        dto.qr_seed?.includes('CHECK_OUT') ||
        (() => {
          try {
            const raw = localStorage.getItem('smart_absensi_today_record') || localStorage.getItem('smart_absensi_my_today_record');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.check_in_time && !parsed?.check_out_time) return true;
            }
          } catch {}
          return false;
        })();

      if (!isNetworkOrTimeoutError(err)) {
        logger.warn('AttendanceRepository', 'scanAttendance rejected by backend/validation, rethrowing error to UI:', err);
        
        // Dispatch failure alert to Telegram so issues are immediately logged and monitored
        const currentUser = useAuthStore.getState().user;
        const errMsg = err && typeof err === 'object' && 'message' in err
          ? String((err as { message: string }).message)
          : String(err);

        TelegramService.sendAttendanceFailureNotification({
          teacherName: currentUser?.full_name || dto.user_id || 'Guru',
          nip: currentUser?.nip || undefined,
          role: currentUser?.role || 'GURU',
          attemptType: isCheckoutAttempt ? 'CHECK_OUT' : 'CHECK_IN',
          method: dto.verification_method || 'QR_CODE',
          distanceMeters: effectiveDistance,
          errorMessage: errMsg,
        }).catch((teleErr) => console.warn('Failed to send telegram failure alert:', teleErr));

        throw err;
      }

      logger.warn('AttendanceRepository', 'scanAttendance failed or timed out on weak network, switching to offline IndexedDB fallback:', err);
      
      // If network fetch fails or times out, fallback to IndexedDB Queue
      const userId = useAuthStore.getState().user?.id || 'usr_offline';
      const recordId = 'att_offline_' + Date.now();
      const currentUser = useAuthStore.getState().user;
      const offlineTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
      const effAction = isCheckoutAttempt ? 'CHECK_OUT' : 'CHECK_IN';
      const effStatus = isCheckoutAttempt ? 'PULANG (MODE OFFLINE)' : 'HADIR (MODE OFFLINE)';

      try {
        await indexedDBService.enqueue({
          id: recordId,
          user_id: userId,
          qr_seed: dto.qr_seed,
          user_lat: dto.user_lat,
          user_lng: dto.user_lng,
          distance_meters: effectiveDistance,
          gps_accuracy: dto.gps_accuracy,
          timestamp: new Date().toISOString(),
          sync_status: 'PENDING',
          retry_count: 0,
          attempt_action: effAction,
        });

        const pendingItems = await indexedDBService.getPendingQueue();
        useSyncQueueStore.getState().setPendingItems(pendingItems);

        // Always log offline attendance to Telegram so admin/kepsek are aware
        TelegramService.sendAttendanceNotification({
          teacherName: currentUser?.full_name || dto.user_id || 'Guru',
          nip: currentUser?.nip || undefined,
          role: currentUser?.role || 'GURU',
          type: effAction,
          timeStr: offlineTime,
          dateStr: getTodayDateInJakarta(),
          method: dto.verification_method || 'QR_CODE',
          distanceMeters: effectiveDistance,
          status: effStatus,
          isOffline: true,
          photoBlob: dto.photoBlob || null,
          photoPromise: dto.photoPromise,
        }).catch((e) => console.warn('Telegram offline attendance log error:', e));

        return {
          attendance_id: recordId,
          status: effStatus,
          timestamp: offlineTime,
          distance_meters: effectiveDistance,
          geofence_verified: true,
          attendance_action: effAction,
          is_offline: true,
        };
      } catch {
        throw err;
      }
    }
  }

  public static async getTodayAttendance(userId: string, token: string): Promise<AttendanceRecord | null> {
    return ProviderFactory.getProvider().getTodayAttendance(userId, token);
  }

  public static async getMonthlyHistory(userId: string, month: number | string, year: number | string, token: string): Promise<AttendanceRecord[]> {
    return ProviderFactory.getProvider().getMonthlyAttendance(userId, String(month), String(year), token);
  }

  public static async correctAttendance(dto: CorrectAttendanceDTO): Promise<boolean> {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'OPERATOR')) {
      logger.warn('AttendanceRepository', 'Unauthorized correctAttendance attempt by role:', currentUser?.role);
      throw new Error('Akses Ditolak! Role GURU tidak diizinkan mengubah absensi secara langsung. Silakan gunakan menu Ajukan Koreksi Absen.');
    }

    // Auto-evaluate HADIR vs TERLAMBAT cutoff based on settings.work_checkin_end
    let finalStatus = dto.status;
    if (dto.status === 'HADIR' && dto.check_in_time) {
      let checkinEnd: string = CONSTANTS.DEFAULTS.WORK_CHECKIN_END;
      try {
        const sysSettings = await ProviderFactory.getProvider().getSettings();
        if (sysSettings?.work_checkin_end) {
          checkinEnd = sysSettings.work_checkin_end.slice(0, 5);
        }
      } catch (e) {
        logger.warn('AttendanceRepository', 'Failed to fetch settings for checkin cutoff:', e);
      }

      const cleanTime = dto.check_in_time.slice(0, 5);
      if (cleanTime > checkinEnd) {
        finalStatus = 'TERLAMBAT';
      }
    }

    const payload = {
      ...dto,
      status: finalStatus,
    };

    logger.info('AttendanceRepository', 'Executing correctAttendance via active provider', {
      target_user_id: payload.target_user_id,
      date: payload.date,
      status: payload.status,
    });
    try {
      const result = await ProviderFactory.getProvider().correctAttendance(payload);
      logger.info('AttendanceRepository', 'correctAttendance success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('smart_absensi_scanned'));
        window.dispatchEvent(new Event('smart_absensi_records_updated'));
      }
      return result;
    } catch (err) {
      logger.error('AttendanceRepository', 'correctAttendance failed:', err);
      throw err;
    }
  }

  public static async resetAttendance(dto: ResetAttendanceDTO): Promise<boolean> {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'OPERATOR')) {
      logger.warn('AttendanceRepository', 'Unauthorized resetAttendance attempt by role:', currentUser?.role);
      throw new Error('Akses Ditolak! Hanya Administrator/Operator yang diizinkan melakukan reset absensi.');
    }

    if (!dto.admin_password || dto.admin_password.trim() === '') {
      throw new Error('Password Reset Admin wajib diisi untuk verifikasi keamanan!');
    }

    if (!dto.reason || dto.reason.trim().length < 5) {
      throw new Error('Alasan reset presensi wajib diisi minimal 5 karakter.');
    }

    logger.info('AttendanceRepository', 'Executing resetAttendance via active provider', {
      target_user_id: dto.target_user_id,
      date: dto.date,
    });

    try {
      const result = await ProviderFactory.getProvider().resetAttendance(
        dto.target_user_id,
        dto.date,
        dto.admin_password,
        dto.token
      );
      logger.info('AttendanceRepository', 'resetAttendance success');
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('smart_absensi_scanned'));
        window.dispatchEvent(new Event('smart_absensi_records_updated'));
      }
      return result;
    } catch (err) {
      logger.error('AttendanceRepository', 'resetAttendance failed:', err);
      throw err;
    }
  }
}
