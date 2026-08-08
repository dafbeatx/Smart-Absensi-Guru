import { ProviderFactory } from '../providers/provider-factory';
import type { AttendanceRecord, AttendanceAction } from '../types/database.types';
import { useAuthStore } from '../store/useAuthStore';
import { logger } from '../utils/logger.utils';
import { indexedDBService } from '../services/indexed-db.service';
import { useSyncQueueStore } from '../store/useSyncQueueStore';

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
    lower.includes('timeout 2.5s') ||
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

      return {
        attendance_id: recordId,
        status: 'HADIR (MODE OFFLINE)',
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        distance_meters: effectiveDistance,
        geofence_verified: true,
        attendance_action: 'CHECK_IN',
        is_offline: true,
      };
    }

    try {
      // Race online provider scan vs 2500ms timeout for weak/slow 2G/3G/4G connections
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Koneksi internet lambat / sinyal lemah (Timeout 2.5s). Mengalihkan ke simpan offline...')), 2500)
      );

      const result = await Promise.race([
        ProviderFactory.getProvider().scanAttendance(dto),
        timeoutPromise,
      ]);

      logger.info('AttendanceRepository', 'scanAttendance success:', result);
      return result;
    } catch (err: unknown) {
      if (!isNetworkOrTimeoutError(err)) {
        logger.warn('AttendanceRepository', 'scanAttendance rejected by backend/validation, rethrowing error to UI:', err);
        throw err;
      }

      logger.warn('AttendanceRepository', 'scanAttendance failed or timed out on weak network, switching to offline IndexedDB fallback:', err);
      
      // If network fetch fails or times out, fallback to IndexedDB Queue
      const userId = useAuthStore.getState().user?.id || 'usr_offline';
      const recordId = 'att_offline_' + Date.now();

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
        });

        const pendingItems = await indexedDBService.getPendingQueue();
        useSyncQueueStore.getState().setPendingItems(pendingItems);

        return {
          attendance_id: recordId,
          status: 'HADIR (MODE OFFLINE)',
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
          distance_meters: effectiveDistance,
          geofence_verified: true,
          attendance_action: 'CHECK_IN',
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
      let checkinEnd = '07:15';
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
}
