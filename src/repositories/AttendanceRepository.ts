import { ProviderFactory } from '../providers/provider-factory';
import type { AttendanceRecord } from '../types/database.types';
import { logger } from '../utils/logger.utils';

export interface ScanAttendanceDTO {
  token: string;
  qr_seed: string;
  user_lat: number;
  user_lng: number;
  device_uuid: string;
}

export interface AttendanceResponseDTO {
  attendance_id: string;
  status: string;
  timestamp: string;
  distance_meters: number;
  geofence_verified: boolean;
}

export interface CorrectAttendanceDTO {
  token: string;
  target_user_id: string;
  date: string;
  status: string;
  check_in_time: string;
  reason: string;
}

export class AttendanceRepository {
  public static async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    logger.info('AttendanceRepository', 'Executing scanAttendance via active provider', {
      lat: dto.user_lat,
      lng: dto.user_lng,
      qr_seed: dto.qr_seed,
    });
    try {
      const result = await ProviderFactory.getProvider().scanAttendance(dto);
      logger.info('AttendanceRepository', 'scanAttendance success:', result);
      return result;
    } catch (err) {
      logger.error('AttendanceRepository', 'scanAttendance failed:', err);
      throw err;
    }
  }

  public static async getTodayAttendance(userId: string, token: string): Promise<AttendanceRecord | null> {
    return ProviderFactory.getProvider().getTodayAttendance(userId, token);
  }

  public static async getMonthlyHistory(userId: string, month: number, year: number, token: string): Promise<AttendanceRecord[]> {
    return ProviderFactory.getProvider().getMonthlyAttendance(userId, String(month), String(year), token);
  }

  public static async correctAttendance(dto: CorrectAttendanceDTO): Promise<boolean> {
    logger.info('AttendanceRepository', 'Executing correctAttendance via active provider', {
      target_user_id: dto.target_user_id,
      date: dto.date,
      status: dto.status,
    });
    try {
      const result = await ProviderFactory.getProvider().correctAttendance(dto);
      logger.info('AttendanceRepository', 'correctAttendance success');
      return result;
    } catch (err) {
      logger.error('AttendanceRepository', 'correctAttendance failed:', err);
      throw err;
    }
  }
}
