import { apiClient } from '../lib/api-client';
import type { IDataProvider } from './data-provider.interface';
import type { UserProfile, AttendanceRecord, LeaveRequest, SystemSettings, HolidayRecord } from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO, CorrectAttendanceDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';

export class GasProvider implements IDataProvider {
  public async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    return apiClient.post<LoginResponseDTO>('LOGIN', {
      identity: dto.identity,
      pin: dto.pin,
      device_uuid: dto.device_uuid,
      device_model: dto.device_model,
      user_agent: dto.user_agent || navigator.userAgent,
    });
  }

  public async verifySession(token: string): Promise<UserProfile> {
    return apiClient.post<UserProfile>('VERIFY_SESSION', { token });
  }

  public async resetDevice(userId: string, token: string): Promise<boolean> {
    return apiClient.post<boolean>('RESET_DEVICE', { user_id: userId, token });
  }

  public async changePin(userId: string, newPin: string, token: string): Promise<boolean> {
    return apiClient.post<boolean>('CHANGE_PIN', { user_id: userId, new_pin: newPin, token });
  }

  public async resetPin(userId: string, newPin: string, token: string): Promise<boolean> {
    return apiClient.post<boolean>('RESET_PIN', { target_user_id: userId, new_pin: newPin, token });
  }

  public async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    return apiClient.post<AttendanceResponseDTO>('SCAN_ATTENDANCE', {
      token: dto.token,
      qr_seed: dto.qr_seed,
      user_lat: dto.user_lat,
      user_lng: dto.user_lng,
      device_uuid: dto.device_uuid,
    });
  }

  public async getTodayAttendance(userId: string, token: string): Promise<AttendanceRecord | null> {
    return apiClient.post<AttendanceRecord | null>('GET_TODAY_ATTENDANCE', { user_id: userId, token });
  }

  public async getMonthlyAttendance(userId: string, month: string, year: string, token: string): Promise<AttendanceRecord[]> {
    return apiClient.post<AttendanceRecord[]>('GET_MONTHLY_ATTENDANCE', {
      user_id: userId,
      month,
      year,
      token,
    });
  }

  public async correctAttendance(dto: CorrectAttendanceDTO): Promise<boolean> {
    return apiClient.post<boolean>('CORRECT_ATTENDANCE', {
      token: dto.token,
      target_user_id: dto.target_user_id,
      date: dto.date,
      status: dto.status,
      check_in_time: dto.check_in_time,
      reason: dto.reason,
    });
  }

  public async submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest> {
    return apiClient.post<LeaveRequest>('SUBMIT_LEAVE', {
      token: dto.token,
      leave_type: dto.leave_type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_base64: dto.attachment_base64 || '',
    });
  }

  public async approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, token: string): Promise<boolean> {
    return apiClient.post<boolean>('APPROVE_LEAVE', {
      leave_id: leaveId,
      decision,
      notes,
      token,
    });
  }

  public async getPendingLeaves(token: string): Promise<LeaveRequest[]> {
    return apiClient.post<LeaveRequest[]>('GET_PENDING_LEAVES', { token });
  }

  public async getSettings(): Promise<SystemSettings> {
    return apiClient.get<SystemSettings>('GET_PUBLIC_SETTINGS');
  }

  public async updateSettings(settings: SystemSettings, token: string): Promise<boolean> {
    return apiClient.post<boolean>('UPDATE_SETTINGS', { settings, token });
  }

  public async getAllUsers(token: string): Promise<UserProfile[]> {
    return apiClient.post<UserProfile[]>('GET_ALL_USERS', { token });
  }

  public async createUser(user: Partial<UserProfile>, token: string): Promise<UserProfile> {
    return apiClient.post<UserProfile>('CREATE_USER', { ...user, token });
  }

  public async deleteUser(userId: string, token: string): Promise<boolean> {
    return apiClient.post<boolean>('DELETE_USER', { target_user_id: userId, token });
  }

  public async toggleUserStatus(userId: string, token: string): Promise<boolean> {
    return apiClient.post<boolean>('TOGGLE_USER_STATUS', { target_user_id: userId, token });
  }

  // Academic Calendar & Holidays API
  public async getHolidays(token?: string): Promise<HolidayRecord[]> {
    return apiClient.post<HolidayRecord[]>('GET_HOLIDAYS', { token });
  }

  public async createHoliday(holiday: Omit<HolidayRecord, 'id' | 'created_at'>, token?: string): Promise<HolidayRecord> {
    return apiClient.post<HolidayRecord>('CREATE_HOLIDAY', { ...holiday, token });
  }

  public async updateHoliday(id: string, holiday: Partial<HolidayRecord>, token?: string): Promise<HolidayRecord> {
    return apiClient.post<HolidayRecord>('UPDATE_HOLIDAY', { id, ...holiday, token });
  }

  public async deleteHoliday(id: string, token?: string): Promise<boolean> {
    return apiClient.post<boolean>('DELETE_HOLIDAY', { id, token });
  }
}
