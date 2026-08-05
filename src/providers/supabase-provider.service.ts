import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IDataProvider } from './data-provider.interface';
import type {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SystemSettings,
  HolidayRecord,
  AttendanceStatus,
  LeaveType,
  ApprovalStatus,
  HolidayType,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type {
  ScanAttendanceDTO,
  AttendanceResponseDTO,
  CorrectAttendanceDTO,
} from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';
import { calculateDistanceMeters } from '../utils/geofence.utils';

export class SupabaseProvider implements IDataProvider {
  private client: SupabaseClient;

  constructor() {
    const url =
      (typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_SUPABASE_URL as string)
        : '') || 'https://YOUR_SUPABASE_PROJECT_ID.supabase.co';

    const key =
      (typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
        : '') || 'YOUR_SUPABASE_ANON_KEY';

    this.client = createClient(url, key);
  }

  // ─── AUTHENTICATION API ───────────────────────────────────────────────────

  public async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    const { data: user, error } = await this.client
      .from('users')
      .select('*')
      .or(`phone_number.eq.${dto.identity},nip.eq.${dto.identity}`)
      .single();

    if (error || !user) {
      throw new Error('Akun pengguna tidak ditemukan. Periksa No HP / NPP Anda.');
    }

    if (user.account_status === 'LOCKED' || user.account_status === 'INACTIVE') {
      throw new Error('Akun Anda sedang terblokir / tidak aktif. Hubungi Admin Sekolah.');
    }

    const userProfile: UserProfile = {
      id: user.id,
      nip: user.nip,
      full_name: user.full_name,
      phone_number: user.phone_number,
      role: user.role,
      position: user.position,
      avatar_url: user.avatar_url || null,
      is_active: user.account_status === 'ACTIVE',
      created_at: user.created_at,
    };

    const mockToken = `SB_JWT_${user.id}_${Date.now()}`;

    return {
      token: mockToken,
      user: userProfile,
    };
  }

  public async verifySession(token: string): Promise<UserProfile> {
    const parts = token.split('_');
    const userId = parts.length >= 3 ? parts[2] : null;

    if (userId) {
      const { data: user } = await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (user) {
        return {
          id: user.id,
          nip: user.nip,
          full_name: user.full_name,
          phone_number: user.phone_number,
          role: user.role,
          position: user.position,
          avatar_url: user.avatar_url || null,
          is_active: user.account_status === 'ACTIVE',
          created_at: user.created_at,
        };
      }
    }

    const { data: firstUser } = await this.client
      .from('users')
      .select('*')
      .limit(1)
      .single();

    if (!firstUser) {
      throw new Error('Sesi tidak valid.');
    }

    return {
      id: firstUser.id,
      nip: firstUser.nip,
      full_name: firstUser.full_name,
      phone_number: firstUser.phone_number,
      role: firstUser.role,
      position: firstUser.position,
      avatar_url: null,
      is_active: true,
      created_at: firstUser.created_at,
    };
  }

  public async resetDevice(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  public async changePin(userId: string, newPin: string, _token: string): Promise<boolean> {
    const { error } = await this.client
      .from('users')
      .update({ pin_hash: newPin })
      .eq('id', userId);

    if (error) throw new Error('Gagal mengubah PIN: ' + error.message);
    return true;
  }

  public async resetPin(userId: string, newPin: string, _token: string): Promise<boolean> {
    const { error } = await this.client
      .from('users')
      .update({ pin_hash: newPin })
      .eq('id', userId);

    if (error) throw new Error('Gagal mereset PIN: ' + error.message);
    return true;
  }

  // ─── ATTENDANCE API ───────────────────────────────────────────────────────

  public async scanAttendance(dto: ScanAttendanceDTO): Promise<AttendanceResponseDTO> {
    const settings = await this.getSettings();

    const userLat = dto.user_lat;
    const userLng = dto.user_lng;
    const distanceMeters = calculateDistanceMeters(
      userLat,
      userLng,
      settings.geofence_lat,
      settings.geofence_lng
    );

    if (distanceMeters > settings.geofence_radius) {
      throw new Error(
        `Absensi Ditolak! Anda terdeteksi berada ${distanceMeters} meter dari gerbang sekolah. Radius maksimal: ${settings.geofence_radius}m.`
      );
    }

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('id-ID', { hour12: false });

    const checkinEnd = settings.work_checkin_end || '07:15';
    const status: AttendanceStatus = timeStr > checkinEnd ? 'TERLAMBAT' : 'HADIR';

    const userId = dto.token.split('_')[2] || 'usr_guru_001';
    const attId = `att_${userId}_${todayStr}`;

    const { error } = await this.client.from('attendance').upsert(
      {
        id: attId,
        user_id: userId,
        date: todayStr,
        check_in_time: timeStr,
        status: status,
        distance_meters: distanceMeters,
        device_uuid: dto.device_uuid,
        check_in_lat: userLat,
        check_in_lng: userLng,
      },
      { onConflict: 'user_id,date' }
    );

    if (error) {
      throw new Error('Gagal menyimpan absensi ke Supabase: ' + error.message);
    }

    return {
      attendance_id: attId,
      status: status,
      timestamp: `${timeStr} WIB`,
      distance_meters: distanceMeters,
      geofence_verified: true,
    };
  }

  public async getTodayAttendance(userId: string, _token: string): Promise<AttendanceRecord | null> {
    const todayStr = new Date().toISOString().split('T')[0];
    const { data } = await this.client
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle();

    if (!data) return null;

    return {
      id: data.id,
      user_id: data.user_id,
      date: data.date,
      check_in_time: data.check_in_time,
      check_out_time: data.check_out_time,
      status: data.status as AttendanceStatus,
      check_in_lat: data.check_in_lat ? parseFloat(data.check_in_lat) : null,
      check_in_lng: data.check_in_lng ? parseFloat(data.check_in_lng) : null,
      check_in_distance_meters: data.distance_meters || 0,
      verification_method: 'QR_GPS',
      attendance_source: 'QR',
      is_offline: false,
      created_at: data.created_at,
    };
  }

  public async getMonthlyAttendance(
    userId: string,
    _month: string,
    _year: string,
    _token: string
  ): Promise<AttendanceRecord[]> {
    const { data } = await this.client
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false });

    return (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      check_in_time: row.check_in_time,
      check_out_time: row.check_out_time,
      status: row.status as AttendanceStatus,
      check_in_lat: row.check_in_lat ? parseFloat(row.check_in_lat) : null,
      check_in_lng: row.check_in_lng ? parseFloat(row.check_in_lng) : null,
      check_in_distance_meters: row.distance_meters || 0,
      verification_method: 'QR_GPS',
      attendance_source: 'QR',
      is_offline: false,
      created_at: row.created_at,
    }));
  }

  public async correctAttendance(dto: CorrectAttendanceDTO): Promise<boolean> {
    const { error } = await this.client.from('attendance').upsert(
      {
        id: `att_${dto.target_user_id}_${dto.date}`,
        user_id: dto.target_user_id,
        date: dto.date,
        status: dto.status,
        check_in_time: dto.check_in_time || '07:00:00',
      },
      { onConflict: 'user_id,date' }
    );

    if (error) throw new Error('Gagal koreksi absensi: ' + error.message);
    return true;
  }

  public async getDailyAttendance(date: string, _token: string): Promise<AttendanceRecord[]> {
    const { data } = await this.client
      .from('attendance')
      .select('*')
      .eq('date', date);

    return (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      date: row.date,
      check_in_time: row.check_in_time,
      check_out_time: row.check_out_time,
      status: row.status as AttendanceStatus,
      check_in_lat: row.check_in_lat ? parseFloat(row.check_in_lat) : null,
      check_in_lng: row.check_in_lng ? parseFloat(row.check_in_lng) : null,
      check_in_distance_meters: row.distance_meters || 0,
      verification_method: 'QR_GPS',
      attendance_source: 'QR',
      is_offline: false,
      created_at: row.created_at,
    }));
  }

  // ─── LEAVE & APPROVAL API ─────────────────────────────────────────────────

  public async submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest> {
    const leaveId = `lev_${Date.now()}`;
    const userId = dto.token.split('_')[2] || 'usr_guru_001';

    const newLeave = {
      id: leaveId,
      user_id: userId,
      type: dto.leave_type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      status: 'PENDING',
    };

    const { error } = await this.client.from('leaves').insert(newLeave);
    if (error) throw new Error('Gagal mengajukan izin: ' + error.message);

    return {
      id: leaveId,
      user_id: userId,
      leave_type: dto.leave_type as LeaveType,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_url: dto.attachment_base64 || null,
      approval_status: 'PENDING',
      approval_deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
      created_at: new Date().toISOString(),
    };
  }

  public async approveLeave(
    leaveId: string,
    decision: 'APPROVED' | 'REJECTED',
    notes: string,
    _token: string
  ): Promise<boolean> {
    const { error } = await this.client
      .from('leaves')
      .update({
        status: decision,
        rejection_notes: notes,
        approved_at: new Date().toISOString(),
      })
      .eq('id', leaveId);

    if (error) throw new Error('Gagal memproses persetujuan izin: ' + error.message);
    return true;
  }

  public async getPendingLeaves(_token: string): Promise<LeaveRequest[]> {
    const { data } = await this.client
      .from('leaves')
      .select('*')
      .order('created_at', { ascending: false });

    return (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      leave_type: (row.type || 'IZIN') as LeaveType,
      start_date: row.start_date,
      end_date: row.end_date,
      reason: row.reason,
      attachment_url: row.attachment_url || null,
      approval_status: (row.status || 'PENDING') as ApprovalStatus,
      approval_deadline: new Date(Date.now() + 86400000 * 3).toISOString(),
      approved_by: row.approved_by || null,
      approval_notes: row.rejection_notes || null,
      created_at: row.created_at,
    }));
  }

  // ─── SYSTEM SETTINGS API ──────────────────────────────────────────────────

  public async getSettings(): Promise<SystemSettings> {
    const { data } = await this.client.from('system_settings').select('*');

    const map: Record<string, string> = {};
    (data || []).forEach((row) => {
      map[row.key] = row.value;
    });

    return {
      app_name: map.app_name || 'Smart Absensi Guru',
      institution_name: map.institution_name || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
      work_checkin_start: map.work_checkin_start || CONSTANTS.DEFAULTS.WORK_CHECKIN_START,
      work_checkin_end: map.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END,
      work_checkout_start: map.work_checkout_start || CONSTANTS.DEFAULTS.WORK_CHECKOUT_START,
      friday_checkout_start: map.friday_checkout_start || CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START,
      saturday_is_holiday: map.saturday_is_holiday !== 'false',
      sunday_is_holiday: map.sunday_is_holiday !== 'false',
      geofence_lat: map.geofence_lat ? parseFloat(map.geofence_lat) : CONSTANTS.DEFAULTS.GEOFENCE_LAT,
      geofence_lng: map.geofence_lng ? parseFloat(map.geofence_lng) : CONSTANTS.DEFAULTS.GEOFENCE_LNG,
      geofence_radius: map.geofence_radius ? parseInt(map.geofence_radius, 10) : CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
    };
  }

  public async updateSettings(settings: SystemSettings, _token: string): Promise<boolean> {
    const updates = [
      { key: 'geofence_lat', value: String(settings.geofence_lat) },
      { key: 'geofence_lng', value: String(settings.geofence_lng) },
      { key: 'geofence_radius', value: String(settings.geofence_radius) },
      { key: 'work_checkin_start', value: settings.work_checkin_start },
      { key: 'work_checkin_end', value: settings.work_checkin_end },
      { key: 'work_checkout_start', value: settings.work_checkout_start },
      { key: 'friday_checkout_start', value: settings.friday_checkout_start },
      { key: 'saturday_is_holiday', value: String(settings.saturday_is_holiday) },
      { key: 'sunday_is_holiday', value: String(settings.sunday_is_holiday) },
    ];

    const { error } = await this.client.from('system_settings').upsert(updates, { onConflict: 'key' });
    if (error) throw new Error('Gagal menyimpan pengaturan di Supabase: ' + error.message);
    return true;
  }

  // ─── USER MANAGEMENT API (ADMIN) ──────────────────────────────────────────

  public async getAllUsers(_token: string): Promise<UserProfile[]> {
    const { data } = await this.client
      .from('users')
      .select('*')
      .order('created_at', { ascending: false });

    return (data || []).map((row) => ({
      id: row.id,
      nip: row.nip,
      full_name: row.full_name,
      phone_number: row.phone_number,
      role: row.role,
      position: row.position,
      avatar_url: row.avatar_url || null,
      is_active: row.account_status === 'ACTIVE',
      created_at: row.created_at,
    }));
  }

  public async createUser(user: Partial<UserProfile>, _token: string): Promise<UserProfile> {
    const newId = user.id || `usr_${Date.now()}`;
    const newUser = {
      id: newId,
      nip: user.nip || `NIP_${Date.now()}`,
      full_name: user.full_name || 'Guru Baru',
      phone_number: user.phone_number || '080000000000',
      pin_hash: 'c2bf3192f155981775e0329976378e9324025d57b545fbc5f764a856bf8f4702',
      role: user.role || 'GURU',
      position: user.position || 'Pendidik',
      account_status: 'ACTIVE',
    };

    const { error } = await this.client.from('users').insert(newUser);
    if (error) throw new Error('Gagal menambahkan pengguna baru: ' + error.message);

    return {
      id: newId,
      nip: newUser.nip,
      full_name: newUser.full_name,
      phone_number: newUser.phone_number,
      role: newUser.role as 'ADMIN' | 'OPERATOR' | 'KEPSEK' | 'GURU',
      position: newUser.position,
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };
  }

  public async deleteUser(userId: string, _token: string): Promise<boolean> {
    const { error } = await this.client.from('users').delete().eq('id', userId);
    if (error) throw new Error('Gagal menghapus pengguna: ' + error.message);
    return true;
  }

  public async toggleUserStatus(userId: string, _token: string): Promise<boolean> {
    const { data: user } = await this.client.from('users').select('account_status').eq('id', userId).single();
    const newStatus = user?.account_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const { error } = await this.client.from('users').update({ account_status: newStatus }).eq('id', userId);
    if (error) throw new Error('Gagal merubah status pengguna: ' + error.message);
    return true;
  }

  // ─── ACADEMIC CALENDAR & HOLIDAYS API ──────────────────────────────────────

  public async getHolidays(_token?: string): Promise<HolidayRecord[]> {
    const { data } = await this.client.from('holidays').select('*').order('date', { ascending: true });
    return (data || []).map((row) => ({
      id: row.id,
      date: row.date,
      name: row.name,
      type: (row.type || 'SCHOOL_HOLIDAY') as HolidayType,
      description: row.description,
      created_at: row.created_at,
    }));
  }

  public async createHoliday(
    holiday: Omit<HolidayRecord, 'id' | 'created_at'>,
    _token?: string
  ): Promise<HolidayRecord> {
    const newId = `hol_${Date.now()}`;
    const newRec = {
      id: newId,
      date: holiday.date,
      name: holiday.name,
      type: holiday.type || 'SCHOOL_HOLIDAY',
      description: holiday.description,
    };

    const { error } = await this.client.from('holidays').insert(newRec);
    if (error) throw new Error('Gagal menambahkan hari libur: ' + error.message);

    return {
      ...newRec,
      created_at: new Date().toISOString(),
    };
  }

  public async updateHoliday(
    id: string,
    holiday: Partial<HolidayRecord>,
    _token?: string
  ): Promise<HolidayRecord> {
    const { error } = await this.client.from('holidays').update(holiday).eq('id', id);
    if (error) throw new Error('Gagal memperbarui hari libur: ' + error.message);

    return {
      id,
      date: holiday.date || '',
      name: holiday.name || '',
      type: holiday.type || 'SCHOOL_HOLIDAY',
      description: holiday.description,
      created_at: new Date().toISOString(),
    };
  }

  public async deleteHoliday(id: string, _token?: string): Promise<boolean> {
    const { error } = await this.client.from('holidays').delete().eq('id', id);
    if (error) throw new Error('Gagal menghapus hari libur: ' + error.message);
    return true;
  }
}
