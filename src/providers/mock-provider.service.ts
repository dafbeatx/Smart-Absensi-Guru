import type { IDataProvider } from './data-provider.interface';
import type { UserProfile, AttendanceRecord, LeaveRequest, SystemSettings, HolidayRecord, AttendanceStatus } from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO, CorrectAttendanceDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';
import { useAuthStore } from '../store/useAuthStore';

export class MockProvider implements IDataProvider {
  public async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    await new Promise((r) => setTimeout(r, 300));

    if (dto.pin !== '123456' && dto.pin !== '030501') {
      throw new Error('PIN 6-digit yang Anda masukkan salah.');
    }

    let role: 'GURU' | 'KEPSEK' | 'ADMIN' = 'GURU';
    let name = 'Dafa Maulana, S.Pd';
    let position = 'Guru Utama / Pendidik';
    let nip: string | null = null; // Dafa Maulana, S.Pd does not use NIP

    if (dto.identity.toUpperCase().includes('KEPSEK') || dto.identity.startsWith('1975')) {
      role = 'KEPSEK';
      name = 'Drs. H. M. Yusuf, M.Pd.';
      position = 'Kepala Sekolah Utama';
      nip = '197504122003121001';
    } else if (
      dto.identity.toUpperCase().includes('ADMIN') ||
      dto.identity.toUpperCase().includes('OPERATOR') ||
      dto.identity === '0895351251395' ||
      dto.identity.startsWith('1995')
    ) {
      role = 'ADMIN';
      name = 'Rina Fitriani, S.Kom.';
      position = 'Admin Website & IT Sekolah';
      nip = '199501012020011001';
    }

    const mockUser: UserProfile = {
      id: 'usr_' + role.toLowerCase() + '_1001',
      nip: nip,
      full_name: name,
      phone_number: dto.identity,
      role: role,
      position: position,
      avatar_url: null,
      is_active: true,
      must_change_pin: dto.pin === '123456',
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
      nip: null,
      full_name: 'Dafa Maulana, S.Pd',
      phone_number: '081234567890',
      role: 'GURU',
      position: 'Guru Utama / Pendidik',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  public async resetDevice(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  public async changePin(_userId: string, _newPin: string, _token: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 400));
    return true;
  }

  public async resetPin(_userId: string, _newPin: string, _token: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 300));
    return true;
  }

  public async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    await new Promise((r) => setTimeout(r, 400));
    
    const now = new Date();
    const timeStr = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const dateStr = now.toISOString().split('T')[0];

    const settings = await this.getSettings();
    const checkInEndStr = settings.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

    // Helper to parse HH:mm or HH:mm:ss to minutes
    const parseMinutes = (tStr: string) => {
      const clean = tStr.replace(/[^\d:]/g, '');
      const parts = clean.split(':');
      if (parts.length >= 2) {
        return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
      }
      return 0;
    };

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    const cutoffMinutes = parseMinutes(checkInEndStr);

    let initialStatus: AttendanceStatus = 'HADIR';
    if (nowMinutes > cutoffMinutes) {
      initialStatus = 'TERLAMBAT';
    }

    const sessionUser = useAuthStore.getState().user;
    const userId = sessionUser?.id || 'usr_uuid_1001';

    const existingSaved = localStorage.getItem('smart_absensi_today_attendance');
    let record: AttendanceRecord = {
      id: 'att_' + Date.now(),
      user_id: userId,
      date: dateStr,
      check_in_time: timeStr,
      check_out_time: null,
      status: initialStatus,
      check_in_lat: dto.user_lat || -6.2088,
      check_in_lng: dto.user_lng || 106.8456,
      check_in_distance_meters: 12,
      verification_method: 'QR_GPS',
      attendance_source: 'QR',
      is_offline: false,
      created_at: now.toISOString(),
    };

    if (existingSaved) {
      try {
        const parsed = JSON.parse(existingSaved);
        if (parsed && parsed.check_in_time && !parsed.check_out_time) {
          // If check-in already recorded, save check-out time!
          record = {
            ...parsed,
            check_out_time: timeStr,
          };
        }
      } catch (e) {
        console.error('Error parsing today attendance:', e);
      }
    }

    localStorage.setItem('smart_absensi_today_attendance', JSON.stringify(record));

    return {
      attendance_id: record.id,
      status: record.status,
      timestamp: timeStr,
      distance_meters: 12,
      geofence_verified: true,
    };
  }

  public async getTodayAttendance(_userId: string, _token: string): Promise<AttendanceRecord | null> {
    const saved = localStorage.getItem('smart_absensi_today_attendance');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse today attendance:', e);
      }
    }
    return null;
  }

  public async getMonthlyAttendance(_userId: string, _month: string, _year: string, _token: string): Promise<AttendanceRecord[]> {
    const saved = localStorage.getItem('smart_absensi_today_attendance');
    if (saved) {
      try {
        const rec = JSON.parse(saved);
        return [rec];
      } catch (e) {
        console.error('Failed to parse today attendance for monthly:', e);
      }
    }
    return [];
  }

  public async correctAttendance(_dto: CorrectAttendanceDTO): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 300));
    return true;
  }

  public async getDailyAttendance(_date: string, _token: string): Promise<AttendanceRecord[]> {
    await new Promise((r) => setTimeout(r, 200));
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

  public async getPendingLeaves(_token: string): Promise<LeaveRequest[]> {
    return [];
  }

  public async getSettings(): Promise<SystemSettings> {
    const saved = localStorage.getItem('smart_absensi_system_settings');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved settings:', e);
      }
    }
    return {
      app_name: 'Smart Absensi Guru',
      institution_name: 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
      work_checkin_start: CONSTANTS.DEFAULTS.WORK_CHECKIN_START,
      work_checkin_end: CONSTANTS.DEFAULTS.WORK_CHECKIN_END,
      work_checkout_start: CONSTANTS.DEFAULTS.WORK_CHECKOUT_START,
      friday_checkout_start: CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START,
      saturday_is_holiday: true,
      sunday_is_holiday: true,
      geofence_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      geofence_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      geofence_radius: CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
    };
  }

  public async updateSettings(settings: SystemSettings, _token: string): Promise<boolean> {
    localStorage.setItem('smart_absensi_system_settings', JSON.stringify(settings));
    return true;
  }

  public async getAllUsers(_token: string): Promise<UserProfile[]> {
    return [];
  }

  public async createUser(user: Partial<UserProfile>, _token: string): Promise<UserProfile> {
    return {
      id: 'usr_mock_' + Date.now(),
      nip: user.nip || '',
      full_name: user.full_name || '',
      phone_number: user.phone_number || '',
      role: user.role || 'GURU',
      position: user.position || '',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  public async updateUser(_userId: string, _updates: Partial<UserProfile>, _token: string): Promise<boolean> {
    return true;
  }

  public async deleteUser(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  public async toggleUserStatus(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  // Academic Calendar & Holidays API Implementation
  public async getHolidays(_token?: string): Promise<HolidayRecord[]> {
    const saved = localStorage.getItem('smart_absensi_holidays');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.error('Failed to parse saved holidays:', e);
      }
    }

    const defaultHolidays: HolidayRecord[] = [
      { id: 'hol_1001', date: '2026-01-01', name: 'Tahun Baru 2026 Masehi', type: 'NATIONAL_HOLIDAY', description: 'Libur Nasional', created_at: new Date().toISOString() },
      { id: 'hol_1002', date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1003', date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1004', date: '2026-03-19', name: 'Hari Raya Nyepi (Saka 1948)', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1005', date: '2026-03-20', name: 'Hari Raya Idul Fitri 1447 H (Hari 1)', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1006', date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H (Hari 2)', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1007', date: '2026-03-22', name: 'Cuti Bersama Idul Fitri 1447 H', type: 'CUTI_BERSAMA', description: 'Cuti Bersama Pemerintah', created_at: new Date().toISOString() },
      { id: 'hol_1008', date: '2026-03-23', name: 'Cuti Bersama Idul Fitri 1447 H', type: 'CUTI_BERSAMA', description: 'Cuti Bersama Pemerintah', created_at: new Date().toISOString() },
      { id: 'hol_1009', date: '2026-04-03', name: 'Wafat Yesus Kristus', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1010', date: '2026-05-01', name: 'Hari Buruh Internasional', type: 'NATIONAL_HOLIDAY', description: 'Libur Nasional', created_at: new Date().toISOString() },
      { id: 'hol_1011', date: '2026-05-14', name: 'Kenaikan Yesus Kristus', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1012', date: '2026-05-27', name: 'Hari Raya Waisak 2570 BE', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1013', date: '2026-06-01', name: 'Hari Lahir Pancasila', type: 'NATIONAL_HOLIDAY', description: 'Libur Nasional', created_at: new Date().toISOString() },
      { id: 'hol_1014', date: '2026-06-22', name: 'Libur Kenaikan Kelas (Semester Genap)', type: 'SCHOOL_HOLIDAY', description: 'Libur Sekolah Terpadu', created_at: new Date().toISOString() },
      { id: 'hol_1015', date: '2026-06-23', name: 'Libur Kenaikan Kelas (Semester Genap)', type: 'SCHOOL_HOLIDAY', description: 'Libur Sekolah Terpadu', created_at: new Date().toISOString() },
      { id: 'hol_1016', date: '2026-08-17', name: 'Proklamasi Kemerdekaan RI Ke-81', type: 'NATIONAL_HOLIDAY', description: 'HUT Kemerdekaan Indonesia', created_at: new Date().toISOString() },
      { id: 'hol_1017', date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1018', date: '2026-12-25', name: 'Hari Raya Natal', type: 'NATIONAL_HOLIDAY', description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1019', date: '2026-12-28', name: 'Libur Akhir Semester Ganjil T.A 2026/2027', type: 'SCHOOL_HOLIDAY', description: 'Libur Semester Sekolah', created_at: new Date().toISOString() },
    ];

    localStorage.setItem('smart_absensi_holidays', JSON.stringify(defaultHolidays));
    return defaultHolidays;
  }

  public async createHoliday(holiday: Omit<HolidayRecord, 'id' | 'created_at'>, _token?: string): Promise<HolidayRecord> {
    const list = await this.getHolidays();
    const newRecord: HolidayRecord = {
      ...holiday,
      id: 'hol_' + Date.now(),
      created_at: new Date().toISOString(),
    };
    const updated = [...list, newRecord];
    localStorage.setItem('smart_absensi_holidays', JSON.stringify(updated));
    return newRecord;
  }

  public async updateHoliday(id: string, holiday: Partial<HolidayRecord>, _token?: string): Promise<HolidayRecord> {
    const list = await this.getHolidays();
    let targetRecord: HolidayRecord | null = null;
    const updated = list.map((item) => {
      if (item.id === id) {
        targetRecord = { ...item, ...holiday };
        return targetRecord;
      }
      return item;
    });
    if (!targetRecord) throw new Error('Hari libur tidak ditemukan');
    localStorage.setItem('smart_absensi_holidays', JSON.stringify(updated));
    return targetRecord;
  }

  public async deleteHoliday(id: string, _token?: string): Promise<boolean> {
    const list = await this.getHolidays();
    const updated = list.filter((item) => item.id !== id);
    localStorage.setItem('smart_absensi_holidays', JSON.stringify(updated));
    return true;
  }
}
