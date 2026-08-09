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
  TeacherMoodType,
  TeacherMoodLog,
  BurnoutAnalytics,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO, CorrectAttendanceDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';
import { useAuthStore } from '../store/useAuthStore';
import { getTodayDateInJakarta, getCurrentTimeInJakarta, timeToMinutes } from '../utils/time.utils';

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
    let name = 'Guru Pengajar, S.Pd';
    let position = 'Guru Utama / Pendidik';
    let nip: string | null = '198905202014021003';

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

  public async verifySession(token: string): Promise<UserProfile> {
    if (token && token.includes('ADMIN')) {
      return {
        id: 'usr_admin_1001',
        nip: '199501012020011001',
        full_name: 'Rina Fitriani, S.Kom.',
        phone_number: '0895351251395',
        role: 'ADMIN',
        position: 'Admin Website & IT Sekolah',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
    }
    if (token && token.includes('KEPSEK')) {
      return {
        id: 'usr_kepsek_1001',
        nip: '197504122003121001',
        full_name: 'Drs. H. M. Yusuf, M.Pd.',
        phone_number: '081234567891',
        role: 'KEPSEK',
        position: 'Kepala Sekolah Utama',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      };
    }
    return {
      id: 'usr_guru_1001',
      nip: '198905202014021003',
      full_name: 'Guru Pengajar, S.Pd',
      phone_number: '081234567890',
      role: 'GURU',
      position: 'Guru Utama / Pendidik',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  public async resetDevice(userId: string, _token: string): Promise<boolean> {
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem(`smart_absensi_bound_device_${userId}`);
        window.dispatchEvent(new CustomEvent('smart_absensi_device_reset', { detail: { userId } }));
      } catch (e) {
        console.warn('Failed to reset device binding in localStorage:', e);
      }
    }
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
    const sessionUser = useAuthStore.getState().user;
    const isExempted = sessionUser && sessionUser.full_name.toLowerCase().includes('dafa maulana');

    if (isExempted) {
      return {
        status: 'ACTIVE',
        message: '🚀 Akses Khusus Dafa Maulana, S.Pd: Multi-Perangkat Aktif (Bypass Pembatasan)',
        registered_uuid: currentDeviceUUID,
      };
    }

    const boundUUID = safeGetStorage(`smart_absensi_bound_device_${userId}`);
    if (!boundUUID) {
      safeSetStorage(`smart_absensi_bound_device_${userId}`, currentDeviceUUID);
      return {
        status: 'ACTIVE',
        message: '🔒 Strict Device Binding: HP ini telah terikat aktif dengan akun Anda (1 Akun = 1 HP).',
        registered_uuid: currentDeviceUUID,
      };
    }

    if (boundUUID === currentDeviceUUID) {
      return {
        status: 'ACTIVE',
        message: '🔒 Strict Device Binding: HP ini telah terikat aktif dengan akun Anda (1 Akun = 1 HP).',
        registered_uuid: boundUUID,
      };
    }

    return {
      status: 'DIFFERENT_DEVICE',
      message: '🚨 Terdeteksi HP Berbeda! Pembatasan Strict (1 Akun = 1 HP) aktif. Mencegah titip absen antar guru. Hubungi Admin jika Anda resmi mengganti HP.',
      registered_uuid: boundUUID,
    };
  }

  public async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    await new Promise((r) => setTimeout(r, 400));
    
    const sessionUser = useAuthStore.getState().user;
    const userId = dto.user_id || sessionUser?.id || 'usr_uuid_1001';

    const timeStr = dto.timestamp
      ? new Date(dto.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
      : getCurrentTimeInJakarta();
    const dateStr = getTodayDateInJakarta();

    const settings = await this.getSettings();
    const checkInEndStr = settings.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;

    const nowMinutes = timeToMinutes(timeStr);
    const cutoffMinutes = timeToMinutes(checkInEndStr);

    let initialStatus: AttendanceStatus = 'HADIR';
    if (nowMinutes > cutoffMinutes) {
      initialStatus = 'TERLAMBAT';
    }

    const existingSaved = safeGetStorage(`smart_absensi_today_attendance_${userId}_${dateStr}`);
    let record: AttendanceRecord;
    let action: AttendanceAction = 'CHECK_IN';

    if (existingSaved) {
      try {
        const parsed = JSON.parse(existingSaved);
        if (parsed && parsed.check_in_time && parsed.check_out_time) {
          record = parsed;
          action = 'ALREADY_COMPLETED';
        } else if (parsed && parsed.check_in_time) {
          // Check-out / Update Check-out (Absen Pulang)
          record = {
            ...parsed,
            check_out_time: timeStr,
          };
          action = 'CHECK_OUT';
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
            created_at: new Date().toISOString(),
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
          created_at: new Date().toISOString(),
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
        created_at: new Date().toISOString(),
      };
      action = 'CHECK_IN';
    }

    safeSetStorage(`smart_absensi_today_attendance_${userId}_${dateStr}`, JSON.stringify(record));
    safeSetStorage('smart_absensi_today_attendance', JSON.stringify(record));

    // Save to global mock attendance history storage
    const ALL_KEY = 'smart_absensi_all_attendance_history';
    try {
      const savedAll = safeGetStorage(ALL_KEY);
      let allRecords: AttendanceRecord[] = savedAll ? JSON.parse(savedAll) : [];
      if (!Array.isArray(allRecords)) allRecords = [];
      const idx = allRecords.findIndex((r) => r.user_id === record.user_id && r.date === record.date);
      if (idx >= 0) allRecords[idx] = record;
      else allRecords.push(record);
      safeSetStorage(ALL_KEY, JSON.stringify(allRecords));
    } catch (e) {
      console.error('Failed to save to all attendance history:', e);
    }

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
    const todayStr = getTodayDateInJakarta();
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
    const ALL_KEY = 'smart_absensi_all_attendance_history';
    let allRecords: AttendanceRecord[] = [];
    try {
      const savedAll = safeGetStorage(ALL_KEY);
      if (savedAll) {
        const parsed = JSON.parse(savedAll);
        if (Array.isArray(parsed)) allRecords = parsed;
      }
    } catch (e) {
      console.error('Failed to parse all attendance history:', e);
    }

    const todayStr = getTodayDateInJakarta();
    const savedToday = safeGetStorage(`smart_absensi_today_attendance_${userId}_${todayStr}`) || safeGetStorage('smart_absensi_today_attendance');
    if (savedToday) {
      try {
        const rec: AttendanceRecord = JSON.parse(savedToday);
        if (rec && rec.user_id === userId && !allRecords.some((r) => r.user_id === userId && r.date === rec.date)) {
          allRecords.push(rec);
        }
      } catch (e) {
        console.error('Failed to parse today attendance for monthly:', e);
      }
    }

    return allRecords.filter((r) => (r.user_id === userId || userId === 'ALL') && r.date.startsWith(monthPrefix));
  }

  public async correctAttendance(dto: CorrectAttendanceDTO): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 200));

    let finalStatus = (dto.status || 'HADIR') as AttendanceStatus;
    if (dto.status === 'HADIR' && dto.check_in_time) {
      let checkinEnd = '07:15';
      try {
        const settings = await this.getSettings();
        if (settings?.work_checkin_end) {
          checkinEnd = settings.work_checkin_end.slice(0, 5);
        }
      } catch {
        // fallback
      }
      const cleanTime = dto.check_in_time.slice(0, 5);
      if (cleanTime > checkinEnd) {
        finalStatus = 'TERLAMBAT';
      }
    }

    const record: AttendanceRecord = {
      id: `att_${dto.target_user_id}_${dto.date}`,
      user_id: dto.target_user_id,
      date: dto.date,
      check_in_time: dto.check_in_time && dto.check_in_time.trim().length > 0 ? (dto.check_in_time.length === 5 ? `${dto.check_in_time}:00` : dto.check_in_time) : (finalStatus === 'HADIR' || finalStatus === 'TERLAMBAT' ? '07:00:00' : null),
      check_out_time: dto.check_out_time ? (dto.check_out_time.length === 5 ? `${dto.check_out_time}:00` : dto.check_out_time) : null,
      status: finalStatus,
      verification_method: 'MANUAL_OPERATOR',
      attendance_source: 'MANUAL',
      check_in_lat: -6.2,
      check_in_lng: 106.8,
      check_in_distance_meters: 10,
      is_offline: false,
      created_at: new Date().toISOString(),
    };

    const ALL_KEY = 'smart_absensi_all_attendance_history';
    try {
      const savedAll = safeGetStorage(ALL_KEY);
      let allRecords: AttendanceRecord[] = savedAll ? JSON.parse(savedAll) : [];
      if (!Array.isArray(allRecords)) allRecords = [];
      const idx = allRecords.findIndex((r) => r.user_id === record.user_id && r.date === record.date);
      if (idx >= 0) allRecords[idx] = record;
      else allRecords.push(record);
      safeSetStorage(ALL_KEY, JSON.stringify(allRecords));
    } catch (e) {
      console.error('Failed to save correction to all attendance history:', e);
    }

    const todayStr = getTodayDateInJakarta();
    if (dto.date === todayStr) {
      safeSetStorage(`smart_absensi_today_attendance_${dto.target_user_id}_${todayStr}`, JSON.stringify(record));
      safeSetStorage('smart_absensi_today_attendance', JSON.stringify(record));
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_scanned'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
    }

    return true;
  }

  public async getDailyAttendance(date: string, _token: string): Promise<AttendanceRecord[]> {
    const targetDate = date || getTodayDateInJakarta();
    const ALL_KEY = 'smart_absensi_all_attendance_history';
    try {
      const savedAll = safeGetStorage(ALL_KEY);
      if (savedAll) {
        const parsed = JSON.parse(savedAll);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: AttendanceRecord) => r.date === targetDate);
        }
      }
    } catch (e) {
      console.error('Failed to parse daily attendance:', e);
    }
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

  public async getUserLeaves(userId: string, _token: string): Promise<LeaveRequest[]> {
    const saved = safeGetStorage('smart_absensi_leaves');
    if (saved) {
      try {
        const list: LeaveRequest[] = JSON.parse(saved);
        if (Array.isArray(list)) {
          return list
            .filter((l) => l.user_id === userId || !l.user_id)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        }
      } catch (e) {
        console.error('Failed to parse user leaves:', e);
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

  // Teacher Well-being & Mood API Implementation
  public async saveTeacherMood(userId: string, date: string, mood: TeacherMoodType, note?: string, _token?: string): Promise<boolean> {
    const raw = safeGetStorage('smart_absensi_teacher_moods');
    let logs: TeacherMoodLog[] = raw ? JSON.parse(raw) : [];

    const existingIndex = logs.findIndex((l) => l.user_id === userId && l.date === date);
    const newLog: TeacherMoodLog = {
      id: 'mood_' + Date.now(),
      user_id: userId,
      date,
      mood,
      note: note || undefined,
      created_at: new Date().toISOString(),
    };

    if (existingIndex >= 0) {
      logs[existingIndex] = newLog;
    } else {
      logs.push(newLog);
    }

    safeSetStorage('smart_absensi_teacher_moods', JSON.stringify(logs));
    return true;
  }

  public async getTodayTeacherMood(userId: string, date: string, _token?: string): Promise<TeacherMoodLog | null> {
    const raw = safeGetStorage('smart_absensi_teacher_moods');
    if (!raw) return null;
    try {
      const logs: TeacherMoodLog[] = JSON.parse(raw);
      const found = logs.find((l) => l.user_id === userId && l.date === date);
      return found || null;
    } catch {
      return null;
    }
  }

  public async getBurnoutAnalytics(_month?: string, _year?: string, _token?: string): Promise<BurnoutAnalytics> {
    const raw = safeGetStorage('smart_absensi_teacher_moods');
    let logs: TeacherMoodLog[] = [];
    if (raw) {
      try {
        logs = JSON.parse(raw);
      } catch {
        logs = [];
      }
    }

    const breakdown: Record<TeacherMoodType, number> = {
      VERY_HAPPY: 0,
      HAPPY: 0,
      NEUTRAL: 0,
      TIRED: 0,
      STRESSED: 0,
    };

    if (logs.length > 0) {
      logs.forEach((log) => {
        if (breakdown[log.mood] !== undefined) {
          breakdown[log.mood]++;
        }
      });
    }

    const total = logs.length;
    const tiredAndStressed = breakdown.TIRED + breakdown.STRESSED;
    const stressPercentage = total > 0 ? (tiredAndStressed / total) * 100 : 0;

    let burnout_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let recommendation = total === 0
      ? 'Belum ada data mood guru yang tercatat. Grafik dan rekomendasi akan muncul secara realtime begitu dewan guru mengisi mood check-in harian.'
      : 'Tingkat kesejahteraan dewan guru dalam kondisi prima. Pertahankan iklim kerja kondusif dan apresiasi kinerja guru secara berkala.';

    if (stressPercentage >= 35) {
      burnout_risk_level = 'HIGH';
      recommendation = '⚠️ PERHATIAN KEPSEK: Indikasi burnout tinggi (>35% guru merasa lelah/stres). Disarankan melakukan evaluasi beban mengajar/JTM dan mengadakan sesi kebersamaan/refreshment.';
    } else if (stressPercentage >= 15) {
      burnout_risk_level = 'MEDIUM';
      recommendation = '⚡ WASPADA: Terdapat peningkatan indikasi kelelahan kerja pada beberapa guru. Pertimbangkan sesi apresiasi ringan atau optimasi distribusi jadwal mengajar.';
    }

    return {
      total_responses: total,
      burnout_risk_level,
      burnout_score: Math.round(stressPercentage),
      mood_breakdown: breakdown,
      recommendation,
    };
  }
}

