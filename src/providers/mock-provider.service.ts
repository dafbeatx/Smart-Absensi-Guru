import type { IDataProvider } from './data-provider.interface';
import type { UserProfile, AttendanceRecord, LeaveRequest, SystemSettings } from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';

export class MockProvider implements IDataProvider {
  public async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    await new Promise((r) => setTimeout(r, 300));

    if (dto.pin !== '123456' && dto.pin !== '030501') {
      throw new Error('PIN 6-digit yang Anda masukkan salah.');
    }

    let role: 'GURU' | 'KEPSEK' | 'ADMIN' = 'GURU';
    let name = 'Ahmad Hidayat, S.Pd.';
    let position = 'Guru Matematika Utama';

    if (dto.identity.toUpperCase().includes('KEPSEK') || dto.identity.startsWith('1975')) {
      role = 'KEPSEK';
      name = 'Drs. H. M. Yusuf, M.Pd.';
      position = 'Kepala Sekolah Utama';
    } else if (
      dto.identity.toUpperCase().includes('ADMIN') ||
      dto.identity.toUpperCase().includes('OPERATOR') ||
      dto.identity === '0895351251395' ||
      dto.identity.startsWith('1995')
    ) {
      role = 'ADMIN';
      name = 'Rina Fitriani, S.Kom.';
      position = 'Admin Website & IT Sekolah';
    }

    const mockUser: UserProfile = {
      id: 'usr_' + role.toLowerCase() + '_1001',
      nip: dto.identity.includes('19') ? dto.identity : '198507122010011008',
      full_name: name,
      phone_number: dto.identity,
      role: role,
      position: position,
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    return {
      token: `MOCK_JWT_${role}_TOKEN_2026`,
      user: mockUser,
    };
  }

  public async verifySession(_token: string): Promise<UserProfile> {
    return {
      id: 'usr_uuid_1001',
      nip: '198507122010011008',
      full_name: 'Ahmad Hidayat, S.Pd.',
      phone_number: '081234567890',
      role: 'GURU',
      position: 'Guru Matematika Utama',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  public async resetDevice(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  public async scanAttendance(_dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    await new Promise((r) => setTimeout(r, 500));
    return {
      attendance_id: 'att_mock_' + Date.now(),
      status: 'HADIR',
      timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      distance_meters: 12,
      geofence_verified: true,
    };
  }

  public async getTodayAttendance(_userId: string, _token: string): Promise<AttendanceRecord | null> {
    return null;
  }

  public async getMonthlyAttendance(_userId: string, _month: string, _year: string, _token: string): Promise<AttendanceRecord[]> {
    return [];
  }

  public async submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest> {
    return {
      id: 'leave_mock_' + Date.now(),
      user_id: 'usr_uuid_1001',
      leave_type: dto.leave_type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_url: dto.attachment_base64 ? 'https://drive.google.com/mock-file' : null,
      approval_status: 'PENDING',
      approval_deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  public async approveLeave(_leaveId: string, _decision: 'APPROVED' | 'REJECTED', _notes: string, _token: string): Promise<boolean> {
    return true;
  }

  public async getSettings(): Promise<SystemSettings> {
    return {
      app_name: 'Smart Absensi Guru',
      institution_name: 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
      work_checkin_start: CONSTANTS.DEFAULTS.WORK_CHECKIN_START,
      work_checkin_end: CONSTANTS.DEFAULTS.WORK_CHECKIN_END,
      work_checkout_start: CONSTANTS.DEFAULTS.WORK_CHECKOUT_START,
      geofence_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      geofence_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      geofence_radius: CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
    };
  }
}
