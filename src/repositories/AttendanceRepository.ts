import { ProviderFactory } from '../providers/provider-factory';
import type { AttendanceRecord } from '../types/database.types';

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

export class AttendanceRepository {
  public static async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    return ProviderFactory.getProvider().scanAttendance(dto);
  }

  public static async getTodayAttendance(userId: string, token: string): Promise<AttendanceRecord | null> {
    return ProviderFactory.getProvider().getTodayAttendance(userId, token);
  }

  public static async getMonthlyHistory(userId: string, month: number, year: number, token: string): Promise<AttendanceRecord[]> {
    return ProviderFactory.getProvider().getMonthlyAttendance(userId, String(month), String(year), token);
  }
}
