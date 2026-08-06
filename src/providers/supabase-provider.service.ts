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
import { timeToMinutes, getTodayDateInJakarta, getCurrentTimeInJakarta } from '../utils/time.utils';
import { hashPin } from '../utils/hash.utils';
import { useAuthStore } from '../store/useAuthStore';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';
import { calculateDistanceMeters, getEffectiveAllowedRadius } from '../utils/geofence.utils';
import { logger } from '../utils/logger.utils';

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

    const hashedInputPin = await hashPin(dto.pin);
    logger.info('SupabaseProvider', 'PIN comparison debug', {
      storedHashPrefix: user.pin_hash ? user.pin_hash.substring(0, 8) + '...' : '(null)',
      inputHashPrefix: hashedInputPin.substring(0, 8) + '...',
      storedLen: user.pin_hash?.length ?? 0,
      inputLen: hashedInputPin.length,
      match: user.pin_hash === hashedInputPin,
    });
    const isPinMatch = user.pin_hash === hashedInputPin || user.pin_hash === dto.pin;

    if (!user.pin_hash || !isPinMatch) {
      throw new Error('PIN 6-digit yang Anda masukkan salah.');
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
    const activeUser = useAuthStore.getState().user;
    const parts = token.split('_');
    const userIdFromToken = parts.length >= 3 ? parts[2] : null;
    const searchId = activeUser?.id || userIdFromToken;

    if (searchId) {
      const { data: user } = await this.client
        .from('users')
        .select('*')
        .or(`id.eq.${searchId},nip.eq.${activeUser?.nip || searchId},phone_number.eq.${activeUser?.phone_number || searchId}`)
        .maybeSingle();

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

    if (activeUser) {
      return activeUser;
    }

    throw new Error('Sesi pengguna tidak valid. Silakan login kembali.');
  }

  public async resetDevice(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  public async changePin(userId: string, newPin: string, _token: string): Promise<boolean> {
    const hashedPin = await hashPin(newPin);
    const { error } = await this.client
      .from('users')
      .update({ pin_hash: hashedPin })
      .eq('id', userId);

    if (error) throw new Error('Gagal mengubah PIN: ' + error.message);
    return true;
  }

  public async resetPin(userId: string, newPin: string, _token: string): Promise<boolean> {
    const hashedPin = await hashPin(newPin);
    const { error } = await this.client
      .from('users')
      .update({ pin_hash: hashedPin })
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

    // Use shared effective radius — same rule applied on the frontend
    const allowedRadius = getEffectiveAllowedRadius(settings.geofence_radius);

    logger.info('SupabaseProvider', 'scanAttendance geofence check', {
      distanceMeters,
      allowedRadius,
      gps_accuracy: dto.gps_accuracy,
    });

    if (distanceMeters > allowedRadius) {
      throw new Error(
        `Absensi Ditolak! Anda terdeteksi berada ${distanceMeters} meter dari gerbang sekolah. Radius maksimal: ${allowedRadius}m.`
      );
    }

    const todayStr = getTodayDateInJakarta();
    const timeStr = getCurrentTimeInJakarta();

    const checkinEnd = settings.work_checkin_end || '07:15';
    const currentMin = timeToMinutes(timeStr);
    const cutoffMin = timeToMinutes(checkinEnd);

    const status: AttendanceStatus = currentMin > cutoffMin ? 'TERLAMBAT' : 'HADIR';

    // Safely retrieve user ID from active auth store or token
    const sessionUser = useAuthStore.getState().user;
    let userId = sessionUser?.id;

    if (!userId && dto.token) {
      const parts = dto.token.split('_');
      if (parts.length >= 3) {
        userId = parts[2];
      }
    }

    if (!userId) {
      throw new Error('Sesi pengguna tidak valid. Silakan login ulang ke aplikasi.');
    }

    // Verifikasi user exist di public.users sebelum insert
    // (mencegah FK violation jika user preview / token kadaluarsa / akun dibuat di local store)
    let { data: userExists, error: userCheckError } = await this.client
      .from('users')
      .select('id, nip, full_name')
      .or(`id.eq.${userId},nip.eq.${sessionUser?.nip || userId}`)
      .maybeSingle();

    if (userCheckError) {
      logger.warn('SupabaseProvider', 'User existence check error:', userCheckError.message);
    }

    // Jika user ditemukan via NIP atau ID lain, pastikan userId menggunakan ID asli dari Supabase
    if (userExists?.id) {
      userId = userExists.id;
    }

    // Fallback: Jika akun belum ada di Supabase public.users tetapi sessionUser aktif di HP guru,
    // lakukan auto-sync/upsert profil guru agar absensi tidak gagal (tertolak).
    if (!userExists && sessionUser) {
      logger.info('SupabaseProvider', 'Auto-syncing session user to public.users table', { userId, name: sessionUser.full_name });
      const defaultPinHash = await hashPin('123456');
      const newUserRecord = {
        id: sessionUser.id || userId,
        nip: sessionUser.nip || `NIP_${Date.now()}`,
        full_name: sessionUser.full_name || 'Guru Active',
        phone_number: sessionUser.phone_number || '080000000000',
        pin_hash: defaultPinHash,
        role: sessionUser.role || 'GURU',
        position: sessionUser.position || 'Pendidik',
        account_status: 'ACTIVE',
      };

      const { error: autoSyncErr } = await this.client
        .from('users')
        .upsert(newUserRecord, { onConflict: 'id' });

      if (!autoSyncErr) {
        userId = newUserRecord.id;
        userExists = { id: newUserRecord.id, nip: newUserRecord.nip, full_name: newUserRecord.full_name };
      } else {
        logger.error('SupabaseProvider', 'Failed auto-sync user to database:', autoSyncErr.message);
      }
    }

    if (!userExists) {
      logger.error('SupabaseProvider', 'scanAttendance: userId not found in public.users', { userId });
      throw new Error(
        'Akun guru tidak ditemukan di database. Pastikan akun Anda sudah terdaftar di sistem dan tidak sedang dalam Mode Preview. Hubungi Admin jika masalah berlanjut.'
      );
    }

    const attId = `att_${userId}_${todayStr}`;

    // Check if user has already checked in today
    const { data: existing } = await this.client
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle();

    if (existing) {
      if (existing.check_in_time) {
        // Record or Update Check-out (Absen Pulang ke jam scan WIB terbaru)
        const { error: updateErr } = await this.client
          .from('attendance')
          .update({ check_out_time: timeStr })
          .eq('id', existing.id);

        if (updateErr) {
          throw new Error('Gagal mencatat absensi pulang: ' + updateErr.message);
        }

        return {
          attendance_id: existing.id,
          status: (existing.status as AttendanceStatus) || status,
          timestamp: `${timeStr} WIB (Absen Pulang)`,
          distance_meters: distanceMeters,
          geofence_verified: true,
          attendance_action: 'CHECK_OUT',
        };
      }
    }

    // Insert new check-in record
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
      attendance_action: 'CHECK_IN',
    };
  }

  public async getTodayAttendance(userId: string, _token: string): Promise<AttendanceRecord | null> {
    const todayStr = getTodayDateInJakarta();
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
    month: string,
    year: string,
    _token: string
  ): Promise<AttendanceRecord[]> {
    const monthMap: Record<string, string> = {
      januari: '01', februari: '02', maret: '03', april: '04', mei: '05', juni: '06',
      juli: '07', agustus: '08', september: '09', oktober: '10', november: '11', desember: '12',
    };

    let paddedMonth = month.padStart(2, '0');
    if (monthMap[month.toLowerCase()]) {
      paddedMonth = monthMap[month.toLowerCase()];
    }

    const startDate = `${year}-${paddedMonth}-01`;
    // Find last day of month
    const yearNum = parseInt(year, 10) || new Date().getFullYear();
    const monthNum = parseInt(paddedMonth, 10) || (new Date().getMonth() + 1);
    const lastDayNum = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${year}-${paddedMonth}-${String(lastDayNum).padStart(2, '0')}`;

    const { data } = await this.client
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
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
    const currentUser = useAuthStore.getState().user;
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'OPERATOR')) {
      throw new Error('Akses Ditolak! Role GURU tidak diizinkan mengubah absensi secara langsung. Silakan gunakan menu Ajukan Koreksi Absen.');
    }

    const { error } = await this.client.from('attendance').upsert(
      {
        id: `att_${dto.target_user_id}_${dto.date}`,
        user_id: dto.target_user_id,
        date: dto.date,
        status: dto.status,
        check_in_time: dto.check_in_time || '07:00:00',
        check_out_time: dto.check_out_time ? (dto.check_out_time.length === 5 ? `${dto.check_out_time}:00` : dto.check_out_time) : null,
      },
      { onConflict: 'user_id,date' }
    );

    if (error) throw new Error('Gagal koreksi absensi: ' + error.message);
    return true;
  }

  public async getDailyAttendance(date: string, _token: string): Promise<AttendanceRecord[]> {
    const targetDate = date || getTodayDateInJakarta();
    const { data } = await this.client
      .from('attendance')
      .select('*')
      .eq('date', targetDate);

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
    const activeUser = useAuthStore.getState().user;
    if (!activeUser || !activeUser.id) {
      throw new Error('Sesi pengguna tidak valid. Silakan login ulang.');
    }

    const leaveId = `lev_${Date.now()}`;
    const attachmentUrl = dto.attachment_url || dto.attachment_base64 || null;

    const newLeave = {
      id: leaveId,
      user_id: activeUser.id,
      type: dto.leave_type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_url: attachmentUrl,
      status: 'PENDING',
    };

    const { error } = await this.client.from('leaves').insert(newLeave);
    if (error) throw new Error('Gagal mengajukan izin: ' + error.message);

    return {
      id: leaveId,
      user_id: activeUser.id,
      leave_type: dto.leave_type as LeaveType,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_url: attachmentUrl,
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
    const defaultPin = (user as Partial<UserProfile> & { pin?: string }).pin || '123456';
    const hashedPin = await hashPin(defaultPin);

    const newUser = {
      id: newId,
      nip: user.nip || `NIP_${Date.now()}`,
      full_name: user.full_name || 'Guru Baru',
      phone_number: user.phone_number || '080000000000',
      pin_hash: hashedPin,
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

  public async updateUser(userId: string, updates: Partial<UserProfile>, _token: string): Promise<boolean> {
    const payload: Record<string, unknown> = {};
    if (updates.full_name !== undefined) payload.full_name = updates.full_name;
    if (updates.nip !== undefined) payload.nip = updates.nip;
    if (updates.phone_number !== undefined) payload.phone_number = updates.phone_number;
    if (updates.role !== undefined) payload.role = updates.role;
    if (updates.position !== undefined) payload.position = updates.position;
    if (updates.is_active !== undefined) payload.account_status = updates.is_active ? 'ACTIVE' : 'INACTIVE';

    const { error } = await this.client.from('users').update(payload).eq('id', userId);
    if (error) throw new Error('Gagal memperbarui data pengguna: ' + error.message);
    return true;
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
    const fullRec = {
      id: newId,
      date: holiday.date,
      name: holiday.name,
      type: holiday.type || 'SCHOOL_HOLIDAY',
      description: holiday.description,
    };

    let { error } = await this.client.from('holidays').insert(fullRec);

    // Fallback retry if 'type' column is missing in Supabase schema cache
    if (error && (error.message.includes("Could not find the 'type' column") || error.code === 'PGRST204')) {
      logger.warn('SupabaseProvider', "'type' column missing on holidays table. Retrying insert without 'type' column...");
      const { type, ...recWithoutType } = fullRec;
      const retry = await this.client.from('holidays').insert(recWithoutType);
      error = retry.error;
    }

    if (error) throw new Error('Gagal menambahkan hari libur: ' + error.message);

    return {
      ...fullRec,
      created_at: new Date().toISOString(),
    };
  }

  public async updateHoliday(
    id: string,
    holiday: Partial<HolidayRecord>,
    _token?: string
  ): Promise<HolidayRecord> {
    let { error } = await this.client.from('holidays').update(holiday).eq('id', id);

    // Fallback retry if 'type' column is missing in Supabase schema cache
    if (error && (error.message.includes("Could not find the 'type' column") || error.code === 'PGRST204')) {
      logger.warn('SupabaseProvider', "'type' column missing on holidays table. Retrying update without 'type' column...");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { type, ...holidayWithoutType } = holiday as any;
      const retry = await this.client.from('holidays').update(holidayWithoutType).eq('id', id);
      error = retry.error;
    }

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

  // ─── DEVICE BINDING & NOTIFICATIONS API ─────────────────────────────────

  public async checkDeviceBinding(
    userId: string,
    currentDeviceUUID: string,
    _token: string
  ): Promise<{ status: 'ACTIVE' | 'UNBOUND' | 'DIFFERENT_DEVICE' | 'NEEDS_ADMIN_RESET'; message: string; registered_uuid?: string }> {
    try {
      const { data: binding, error } = await this.client
        .from('device_bindings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        // Tabel belum ada atau belum ada RLS policy — fallback ke ACTIVE
        logger.warn('SupabaseProvider', 'device_bindings query error (tabel mungkin belum dibuat):', error.message);
        return {
          status: 'ACTIVE',
          message: 'Perangkat aktif (tabel device_bindings belum ada, jalankan CREATE_TABLES.sql).',
          registered_uuid: currentDeviceUUID,
        };
      }

      if (!binding) {
        // Auto-register device pertama kali
        await this.client.from('device_bindings').insert({
          user_id: userId,
          device_uuid: currentDeviceUUID,
          bound_at: new Date().toISOString(),
        }).select().maybeSingle();

        return {
          status: 'UNBOUND',
          message: 'Perangkat belum terikat. Lakukan absensi pertama untuk mengikat HP ini.',
          registered_uuid: currentDeviceUUID,
        };
      }

      if (binding.device_uuid === currentDeviceUUID) {
        return {
          status: 'ACTIVE',
          message: 'Terikat Aktif dengan HP ini',
          registered_uuid: binding.device_uuid,
        };
      }

      return {
        status: 'DIFFERENT_DEVICE',
        message: 'Terdeteksi Menggunakan HP Berbeda! Mohon ajukan reset device ke Admin/Operator jika Anda ganti HP.',
        registered_uuid: binding.device_uuid,
      };
    } catch (err) {
      logger.error('SupabaseProvider', 'checkDeviceBinding exception:', err);
      return {
        status: 'ACTIVE',
        message: 'Gagal memeriksa binding perangkat. Lanjutkan sebagai aktif.',
        registered_uuid: currentDeviceUUID,
      };
    }
  }

  public async getNotifications(userId: string, _token: string): Promise<any[]> {
    const fallbackNotifications = [
      {
        id: 'n_default_1',
        user_id: userId,
        title: 'Selalu Absen Masuk Tepat Waktu',
        message: 'Batas toleransi absen masuk adalah sesuai jam operasional sekolah. Gunakan QR Code resmi di sekolah.',
        type: 'INFO',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n_default_2',
        user_id: userId,
        title: 'Keamanan Perangkat (Device Binding)',
        message: 'Akun Anda terikat pada HP aktif. Pembatasan 1 akun 1 HP aktif.',
        type: 'SUCCESS',
        is_read: false,
        created_at: new Date().toISOString(),
      },
      {
        id: 'n_default_3',
        user_id: userId,
        title: 'Pengingat PIN Keamanan',
        message: 'Apabila Anda masih menggunakan PIN default 123456, segera ubah PIN melalui tab Profil.',
        type: 'WARNING',
        is_read: true,
        created_at: new Date().toISOString(),
      },
    ];

    try {
      const { data, error } = await this.client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('SupabaseProvider', 'notifications query error (tabel mungkin belum dibuat):', error.message);
        return fallbackNotifications;
      }

      if (data && data.length > 0) {
        return data.map((n) => ({
          id: n.id,
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          type: n.type || 'INFO',
          is_read: n.is_read || false,
          created_at: n.created_at,
        }));
      }

      return fallbackNotifications;
    } catch (err) {
      logger.error('SupabaseProvider', 'getNotifications exception:', err);
      return fallbackNotifications;
    }
  }

  public async markNotificationAsRead(notificationId: string, _token: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('notifications')
        .update({ is_read: true })
        .eq('id', notificationId);

      if (error) {
        logger.warn('SupabaseProvider', 'markNotificationAsRead error:', error.message);
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'markNotificationAsRead exception:', err);
    }
    return true;
  }
}
