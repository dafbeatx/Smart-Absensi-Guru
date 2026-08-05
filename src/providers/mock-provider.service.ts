import type { IDataProvider } from './data-provider.interface';
import type {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SystemSettings,
  HolidayRecord,
  AttendanceStatus,
  AppNotification,
  DeviceBindingCheckResult,
  AttendanceAction,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO, CorrectAttendanceDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';
import { useAuthStore } from '../store/useAuthStore';

const memoryStore = new Map<string, string>();

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      return localStorage.getItem(key);
    }
  } catch {
    // Memory fallback
  }
  return memoryStore.get(key) || null;
}

function safeSetStorage(key: string, val: string): void {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, val);
      return;
    }
  } catch {
    // Memory fallback
  }
  memoryStore.set(key, val);
}

export class MockProvider implements IDataProvider {
  public async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    await new Promise((r) => setTimeout(r, 300));

    if (dto.pin !== '123456' && dto.pin !== '030501') {
      throw new Error('PIN 6-digit yang Anda masukkan salah.');
    }

    let role: 'GURU' | 'KEPSEK' | 'ADMIN' = 'GURU';
    let name = 'Dafa Maulana, S.Pd';
    let position = 'Guru Utama / Pendidik';
    let nip: string | null = null;

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

  public async checkDeviceBinding(userId: string, currentDeviceUUID: string, _token: string): Promise<DeviceBindingCheckResult> {
    const boundUUID = safeGetStorage(`smart_absensi_bound_device_${userId}`);
    if (!boundUUID) {
      safeSetStorage(`smart_absensi_bound_device_${userId}`, currentDeviceUUID);
      return {
        status: 'ACTIVE',
        message: 'Perangkat terikat aktif dengan HP ini.',
        registered_uuid: currentDeviceUUID,
      };
    }

    if (boundUUID === currentDeviceUUID) {
      return {
        status: 'ACTIVE',
        message: 'Terikat Aktif dengan HP ini',
        registered_uuid: boundUUID,
      };
    }

    return {
      status: 'DIFFERENT_DEVICE',
      message: 'Terdeteksi Menggunakan HP Berbeda! Mohon ajukan reset device ke Admin/Operator jika Anda ganti HP.',
      registered_uuid: boundUUID,
    };
  }

  public async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    await new Promise((r) => setTimeout(r, 400));
    
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const timeStr = `${hours}:${minutes}:${seconds}`;
    const dateStr = now.toISOString().split('T')[0];

    const settings = await this.getSettings();
    const checkInEndStr = settings.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

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

    const existingSaved = safeGetStorage(`smart_absensi_today_attendance_${userId}_${dateStr}`);
    let record: AttendanceRecord;
    let action: AttendanceAction = 'CHECK_IN';

    if (existingSaved) {
      try {
        const parsed = JSON.parse(existingSaved);
        if (parsed && parsed.check_in_time && !parsed.check_out_time) {
          // Check-out (Absen Pulang)
          record = {
            ...parsed,
            check_out_time: timeStr,
          };
          action = 'CHECK_OUT';
        } else if (parsed && parsed.check_in_time && parsed.check_out_time) {
          return {
            attendance_id: parsed.id,
            status: parsed.status,
            timestamp: timeStr,
            distance_meters: 12,
            geofence_verified: true,
            attendance_action: 'ALREADY_COMPLETED',
          };
        } else {
          record = {
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
          action = 'CHECK_IN';
        }
      } catch {
        record = {
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
        action = 'CHECK_IN';
      }
    } else {
      record = {
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
      action = 'CHECK_IN';
    }

    safeSetStorage(`smart_absensi_today_attendance_${userId}_${dateStr}`, JSON.stringify(record));
    safeSetStorage('smart_absensi_today_attendance', JSON.stringify(record));

    return {
      attendance_id: record.id,
      status: record.status,
      timestamp: timeStr,
      distance_meters: 12,
      geofence_verified: true,
      attendance_action: action,
    };
  }

  public async getTodayAttendance(userId: string, _token: string): Promise<AttendanceRecord | null> {
    const todayStr = new Date().toISOString().split('T')[0];
    const saved = safeGetStorage(`smart_absensi_today_attendance_${userId}_${todayStr}`) || safeGetStorage('smart_absensi_today_attendance');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse today attendance:', e);
      }
    }
    return null;
  }

  public async getMonthlyAttendance(userId: string, month: string, year: string, _token: string): Promise<AttendanceRecord[]> {
    const monthMap: Record<string, string> = {
      januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
      juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
    };

    let paddedMonth = month.padStart(2, '0');
    if (monthMap[month.toLowerCase()]) {
      paddedMonth = monthMap[month.toLowerCase()];
    }

    const monthPrefix = `${year}-${paddedMonth}`;
    const todayStr = new Date().toISOString().split('T')[0];
    const records: AttendanceRecord[] = [];

    const saved = safeGetStorage(`smart_absensi_today_attendance_${userId}_${todayStr}`) || safeGetStorage('smart_absensi_today_attendance');
    if (saved) {
      try {
        const rec: AttendanceRecord = JSON.parse(saved);
        if (rec && rec.user_id === userId && rec.date.startsWith(monthPrefix)) {
          records.push(rec);
        }
      } catch (e) {
        console.error('Failed to parse today attendance for monthly:', e);
      }
    }
    return records;
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
    const activeUser = useAuthStore.getState().user;
    if (!activeUser || !activeUser.id) {
      throw new Error('Sesi pengguna tidak valid. Silakan login ulang.');
    }

    const leaveRecord: LeaveRequest = {
      id: 'leave_mock_' + Date.now(),
      user_id: activeUser.id,
      leave_type: dto.leave_type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_url: dto.attachment_url || dto.attachment_base64 || null,
      approval_status: 'PENDING',
      approval_deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
      created_at: new Date().toISOString(),
    };

    const savedLeaves = safeGetStorage('smart_absensi_leaves') || '[]';
    try {
      const parsed = JSON.parse(savedLeaves);
      parsed.push(leaveRecord);
      safeSetStorage('smart_absensi_leaves', JSON.stringify(parsed));
    } catch {
      safeSetStorage('smart_absensi_leaves', JSON.stringify([leaveRecord]));
    }

    return leaveRecord;
  }

  public async approveLeave(_leaveId: string, _decision: 'APPROVED' | 'REJECTED', _notes: string, _token: string): Promise<boolean> {
    return true;
  }

  public async getPendingLeaves(_token: string): Promise<LeaveRequest[]> {
    const saved = safeGetStorage('smart_absensi_leaves');
    if (saved) {
      try {
        const list: LeaveRequest[] = JSON.parse(saved);
        return list.filter((l) => l.approval_status === 'PENDING');
      } catch (e) {
        console.error('Failed to parse leaves:', e);
      }
    }
    return [];
  }

  public async getNotifications(userId: string, _token: string): Promise<AppNotification[]> {
    const key = `smart_absensi_notifications_${userId}`;
    const saved = safeGetStorage(key);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse notifications:', e);
      }
    }

    const defaults: AppNotification[] = [
      {
        id: 'n1',
        user_id: userId,
        title: '☀️ Selalu Absen Masuk Tepat Waktu',
        message: 'Batas toleransi absen masuk adalah sesuai jam operasional sekolah. Gunakan QR Code resmi di sekolah.',
        type: 'INFO',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n2',
        user_id: userId,
        title: '🔒 Keamanan Perangkat (Device Binding)',
        message: 'Akun Anda terikat pada HP aktif. Pembatasan 1 akun 1 HP aktif.',
        type: 'SUCCESS',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n3',
        user_id: userId,
        title: '🔑 Pengingat PIN Kemanan',
        message: 'Apabila Anda masih menggunakan PIN default 123456, segera ubah PIN melalui tab Profil.',
        type: 'WARNING',
        is_read: true,
        created_at: new Date().toISOString(),
      },
    ];

    safeSetStorage(key, JSON.stringify(defaults));
    return defaults;
  }

  public async markNotificationAsRead(notificationId: string, token: string): Promise<boolean> {
    const sessionUser = useAuthStore.getState().user;
    const userId = sessionUser?.id || 'usr_uuid_1001';
    const key = `smart_absensi_notifications_${userId}`;
    const notifications = await this.getNotifications(userId, token);
    const updated = notifications.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n));
    safeSetStorage(key, JSON.stringify(updated));
    return true;
  }

  public async getSettings(): Promise<SystemSettings> {
    const saved = safeGetStorage('smart_absensi_system_settings');
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
    safeSetStorage('smart_absensi_system_settings', JSON.stringify(settings));
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
    const saved = safeGetStorage('smart_absensi_holidays');
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

    safeSetStorage('smart_absensi_holidays', JSON.stringify(defaultHolidays));
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
    safeSetStorage('smart_absensi_holidays', JSON.stringify(updated));
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
    safeSetStorage('smart_absensi_holidays', JSON.stringify(updated));
    return targetRecord;
  }

  public async deleteHoliday(id: string, _token?: string): Promise<boolean> {
    const list = await this.getHolidays();
    const updated = list.filter((item) => item.id !== id);
    safeSetStorage('smart_absensi_holidays', JSON.stringify(updated));
    return true;
  }
}
