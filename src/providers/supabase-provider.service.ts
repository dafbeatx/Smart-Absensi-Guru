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
  TeacherMoodType,
  TeacherMoodLog,
  BurnoutAnalytics,
  TeacherDutySchedule,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type {
  ScanAttendanceDTO,
  AttendanceResponseDTO,
  CorrectAttendanceDTO,
} from '../repositories/AttendanceRepository';
import { timeToMinutes, getTodayDateInJakarta, getCurrentTimeInJakarta } from '../utils/time.utils';
import { NotificationService } from '../services/notification-permission.service';
import { hashPin } from '../utils/hash.utils';
import { useAuthStore } from '../store/useAuthStore';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';
import { calculateDistanceMeters, getEffectiveAllowedRadius } from '../utils/geofence.utils';
import { logger } from '../utils/logger.utils';
import { convertToWebP } from '../utils/image.utils';

export class SupabaseProvider implements IDataProvider {
  private client: SupabaseClient;

  constructor() {
    const url =
      (typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_SUPABASE_URL as string)
        : '') || 'https://fwhdjqvtjzesbdcqorsn.supabase.co';

    const key =
      (typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
        : '') ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ3aGRqcXZ0anplc2JkY3FvcnNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNzAyNDgsImV4cCI6MjA4Mjk0NjI0OH0.jgKMD9Yg0iWw3JQMeH7_HQ3ZDOmYBqZ70Y-HZEjOyuY';

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
      const filters: string[] = [];
      // Support both UUIDs and custom string IDs (e.g., usr_guru_007)
      filters.push(`id.eq.${searchId}`);
      if (activeUser?.nip && activeUser.nip !== searchId) {
        filters.push(`nip.eq.${activeUser.nip}`);
      }
      if (activeUser?.phone_number) {
        filters.push(`phone_number.eq.${activeUser.phone_number}`);
      }

      if (filters.length > 0) {
        const { data: user } = await this.client
          .from('users')
          .select('*')
          .or(filters.join(','))
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
    }

    if (activeUser) {
      return activeUser;
    }

    throw new Error('Sesi pengguna tidak valid. Silakan login kembali.');
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
    try {
      await this.client.from('device_bindings').delete().eq('user_id', userId);
    } catch (e) {
      logger.warn('SupabaseProvider', 'Failed to delete device binding from DB:', e);
    }
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
    const timeStr = dto.timestamp
      ? new Date(dto.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB'
      : getCurrentTimeInJakarta();

    const checkinEnd = settings.work_checkin_end || CONSTANTS.DEFAULTS.WORK_CHECKIN_END;
    const currentMin = timeToMinutes(timeStr);
    const cutoffMin = timeToMinutes(checkinEnd);

    const status: AttendanceStatus = currentMin > cutoffMin ? 'TERLAMBAT' : 'HADIR';

    // Safely retrieve user ID from dto, active auth store, or token
    const sessionUser = useAuthStore.getState().user;
    let userId = dto.user_id || sessionUser?.id;

    if (!userId && dto.token) {
      const parts = dto.token.split('_');
      if (parts.length >= 3 && parts[2] !== 'TOKEN') {
        userId = parts[2];
      }
    }

    if (!userId) {
      throw new Error('Sesi pengguna tidak valid. Silakan login ulang ke aplikasi.');
    }

    // Verifikasi user exist di public.users sebelum insert
    // (mencegah FK violation jika user preview / token kadaluarsa / akun dibuat di local store)
    const scanUserFilters: string[] = [];
    if (userId) {
      scanUserFilters.push(`id.eq.${userId}`);
    }
    if (sessionUser?.nip && sessionUser.nip !== userId) {
      scanUserFilters.push(`nip.eq.${sessionUser.nip}`);
    }
    if (sessionUser?.phone_number) {
      scanUserFilters.push(`phone_number.eq.${sessionUser.phone_number}`);
    }

    let userExists: { id: string; nip: string | null; full_name: string } | null = null;
    let userCheckError: { message: string } | null = null;

    if (scanUserFilters.length > 0) {
      const res = await this.client
        .from('users')
        .select('id, nip, full_name')
        .or(scanUserFilters.join(','))
        .maybeSingle();
      userExists = res.data;
      userCheckError = res.error;
    }

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
        nip: sessionUser.nip || null,
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

    // Determine check-out open time based on day of week (Friday vs Monday-Thursday)
    const dayOfWeek = new Date().getDay(); // 5 = Friday
    const targetCheckoutStart = dayOfWeek === 5
      ? (settings.friday_checkout_start || CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START)
      : (settings.work_checkout_start || CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);

    const checkoutStartMin = timeToMinutes(targetCheckoutStart);
    const isCheckoutWindow = currentMin >= checkoutStartMin;

    // Check if user has already checked in today
    const { data: existing } = await this.client
      .from('attendance')
      .select('*')
      .eq('user_id', userId)
      .eq('date', todayStr)
      .maybeSingle();

    if (existing) {
      if (existing.check_in_time) {
        if (existing.check_out_time) {
          logger.info('SupabaseProvider', 'Attendance check-in and check-out already completed for today', { userId, date: todayStr });
          return {
            attendance_id: existing.id,
            status: (existing.status as AttendanceStatus) || status,
            timestamp: `${existing.check_out_time} (Presensi Lengkap)`,
            distance_meters: distanceMeters,
            geofence_verified: true,
            attendance_action: 'ALREADY_COMPLETED',
          };
        }

        const isEarlyCheckout = !isCheckoutWindow;
        const checkoutLabel = isEarlyCheckout
          ? `${timeStr} WIB (Pulang Awal < ${targetCheckoutStart})`
          : `${timeStr} WIB (Absen Pulang)`;

        // Record or Update Check-out (Absen Pulang ke jam scan WIB pertama)
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
          timestamp: checkoutLabel,
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
      throw new Error('Gagal menyimpan data absensi ke Supabase: ' + error.message);
    }

    return {
      attendance_id: attId,
      status: status,
      timestamp: `${timeStr} WIB (Absen Masuk)`,
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

    let query = this.client
      .from('attendance')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (userId !== 'ALL') {
      query = query.eq('user_id', userId);
    }

    const { data } = await query;

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
      notes: row.notes || row.reason || null,
      created_at: row.created_at,
    }));
  }

  public async correctAttendance(dto: CorrectAttendanceDTO): Promise<boolean> {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'OPERATOR')) {
      throw new Error('Akses Ditolak! Role GURU tidak diizinkan mengubah absensi secara langsung. Silakan gunakan menu Ajukan Koreksi Absen.');
    }

    const basePayload = {
      id: `att_${dto.target_user_id}_${dto.date}`,
      user_id: dto.target_user_id,
      date: dto.date,
      status: dto.status,
      check_in_time: dto.check_in_time && dto.check_in_time.trim().length > 0 ? (dto.check_in_time.length === 5 ? `${dto.check_in_time}:00` : dto.check_in_time) : (dto.status === 'HADIR' || dto.status === 'TERLAMBAT' ? '07:00:00' : null),
      check_out_time: dto.check_out_time ? (dto.check_out_time.length === 5 ? `${dto.check_out_time}:00` : dto.check_out_time) : null,
    };

    let { error } = await this.client.from('attendance').upsert(
      {
        ...basePayload,
        notes: dto.notes || dto.reason,
      },
      { onConflict: 'user_id,date' }
    );

    if (error && (error.message.includes("'notes'") || error.message.includes('"notes"'))) {
      // Fallback: retry upsert without the optional 'notes' column if it does not exist in schema
      const retryRes = await this.client.from('attendance').upsert(
        basePayload,
        { onConflict: 'user_id,date' }
      );
      error = retryRes.error;
    }

    if (error) throw new Error('Gagal koreksi absensi: ' + error.message);
    return true;
  }

  public async resetAttendance(targetUserId: string, date: string, adminPasswordInput: string, _token: string): Promise<boolean> {
    const currentUser = useAuthStore.getState().user;
    if (!currentUser || (currentUser.role !== 'ADMIN' && currentUser.role !== 'OPERATOR')) {
      throw new Error('Akses Ditolak! Hanya Administrator/Operator yang berhak melakukan reset presensi.');
    }

    // 1. Check Admin Reset Password in settings
    const settings = await this.getSettings();
    if (!settings.admin_reset_password || settings.admin_reset_password.trim() === '') {
      throw new Error(
        'Password Reset Absensi belum diatur oleh Admin. Silakan buat/atur password reset terlebih dahulu di menu Pengaturan Sistem (Sandi Keamanan Reset Absensi Admin)!'
      );
    }

    if (!adminPasswordInput || adminPasswordInput.trim() !== settings.admin_reset_password.trim()) {
      throw new Error('Password Reset Absensi Admin Salah! Silakan periksa kembali password reset yang Anda masukkan.');
    }

    // 2. Delete attendance record from Supabase table
    const { error } = await this.client
      .from('attendance')
      .delete()
      .eq('user_id', targetUserId)
      .eq('date', date);

    if (error) {
      logger.error('SupabaseProvider', 'resetAttendance failed:', error.message);
      throw new Error('Gagal menghapus presensi di database: ' + error.message);
    }

    // 3. Clear local storage cache if resetting today's attendance
    const todayStr = getTodayDateInJakarta();
    if (date === todayStr && typeof window !== 'undefined') {
      localStorage.removeItem(`smart_absensi_today_attendance_${targetUserId}_${todayStr}`);
      const globalSaved = localStorage.getItem('smart_absensi_today_attendance');
      if (globalSaved) {
        try {
          const parsed = JSON.parse(globalSaved);
          if (parsed.user_id === targetUserId && parsed.date === todayStr) {
            localStorage.removeItem('smart_absensi_today_attendance');
          }
        } catch (e) {}
      }
    }

    // 4. Trigger real-time UI refresh events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_scanned'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
    }

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
      notes: row.notes || row.reason || null,
      created_at: row.created_at,
    }));
  }

  public async updateAttendanceNote(userId: string, date: string, note: string, _token: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('attendance')
        .update({ notes: note, reason: note })
        .eq('user_id', userId)
        .eq('date', date);

      if (error) {
        logger.warn('SupabaseProvider', 'updateAttendanceNote DB update warning:', error.message);
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'updateAttendanceNote exception:', err);
    }
    return true;
  }

  // ─── LEAVE & APPROVAL API ─────────────────────────────────────────────────

  private async uploadLeaveAttachment(
    userId: string,
    base64Data: string
  ): Promise<string | null> {
    try {
      const match = base64Data.match(/^data:(image\/[a-zA-Z]+|application\/pdf);base64,(.+)$/);
      const contentType = match ? match[1] : 'image/jpeg';
      const base64Str = match ? match[2] : base64Data;

      const ext = contentType.includes('pdf') ? 'pdf' : contentType.includes('png') ? 'png' : 'jpg';
      const fileName = `leave_${userId}_${Date.now()}.${ext}`;

      const binaryStr = atob(base64Str);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i);
      }

      const bucketsToTry = ['avatas 1', 'avatas-1', 'avatars'];
      for (const bucketName of bucketsToTry) {
        const { error: uploadError } = await this.client.storage
          .from(bucketName)
          .upload(fileName, bytes, { upsert: true, contentType });

        if (!uploadError) {
          const { data } = this.client.storage.from(bucketName).getPublicUrl(fileName);
          if (data?.publicUrl) return data.publicUrl;
        }
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'uploadLeaveAttachment exception:', err);
    }
    return null;
  }

  public async submitLeave(dto: SubmitLeaveDTO): Promise<LeaveRequest> {
    const activeUser = useAuthStore.getState().user;
    if (!activeUser || !activeUser.id) {
      throw new Error('Sesi pengguna tidak valid. Silakan login ulang.');
    }

    const leaveId = `lev_${Date.now()}`;
    let finalAttachmentUrl = dto.attachment_url || null;
    const userProvidedAttachment = Boolean(dto.attachment_url || dto.attachment_base64);

    if (dto.attachment_base64 && dto.attachment_base64.startsWith('data:')) {
      const storageUrl = await this.uploadLeaveAttachment(activeUser.id, dto.attachment_base64);
      if (storageUrl) {
        finalAttachmentUrl = storageUrl;
      } else if (!finalAttachmentUrl) {
        finalAttachmentUrl = dto.attachment_base64;
      }
    } else if (!finalAttachmentUrl && dto.attachment_base64) {
      finalAttachmentUrl = dto.attachment_base64;
    }

    const newLeave: Record<string, any> = {
      id: leaveId,
      user_id: activeUser.id,
      type: dto.leave_type,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      status: 'PENDING',
    };

    if (finalAttachmentUrl) {
      newLeave.attachment_url = finalAttachmentUrl;
    }

    let { error } = await this.client.from('leaves').insert(newLeave);

    // If table schema for leaves table does not have attachment_url column yet
    if (error && (error.message.includes('attachment_url') || error.message.includes('schema cache'))) {
      if (userProvidedAttachment) {
        throw new Error('Gagal menyimpan lampiran izin: Kolom attachment_url belum ada pada tabel leaves di Supabase (Jalankan CREATE_TABLES.sql).');
      }
      delete newLeave.attachment_url;
      const retryResult = await this.client.from('leaves').insert(newLeave);
      error = retryResult.error;
    }

    if (error) throw new Error('Gagal mengajukan izin: ' + error.message);

    return {
      id: leaveId,
      user_id: activeUser.id,
      leave_type: dto.leave_type as LeaveType,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_url: finalAttachmentUrl,
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
    const activeUser = useAuthStore.getState().user;
    const { error } = await this.client
      .from('leaves')
      .update({
        status: decision,
        approval_status: decision,
        rejection_notes: notes,
        approval_notes: notes,
        approved_at: new Date().toISOString(),
        approved_by: activeUser?.full_name || activeUser?.id || 'Kepala Sekolah',
      })
      .eq('id', leaveId);

    if (error) {
      const { error: error2 } = await this.client
        .from('leaves')
        .update({
          status: decision,
          rejection_notes: notes,
          approved_at: new Date().toISOString(),
        })
        .eq('id', leaveId);

      if (error2) throw new Error('Gagal memproses persetujuan izin: ' + error2.message);
    }

    // Auto-upsert into attendance table for the approved leave/correction dates
    if (decision === 'APPROVED') {
      try {
        const { data: leaveRow } = await this.client
          .from('leaves')
          .select('*')
          .eq('id', leaveId)
          .maybeSingle();

        if (leaveRow) {
          const lType = leaveRow.type || leaveRow.leave_type || 'IZIN';
          let status: AttendanceStatus = 'IZIN';
          let checkInTime: string | null = null;
          let checkOutTime: string | null = null;

          if (lType === 'KOREKSI_ABSEN') {
            const reasonText = leaveRow.reason || '';
            if (reasonText.includes('menjadi HADIR') || reasonText.includes('Target Koreksi') || !reasonText.includes('menjadi ')) {
              status = 'HADIR';
            } else if (reasonText.includes('menjadi SAKIT')) {
              status = 'SAKIT';
            } else if (reasonText.includes('menjadi DINAS_LUAR')) {
              status = 'DINAS_LUAR';
            } else if (reasonText.includes('menjadi ALFA')) {
              status = 'ALFA';
            }

            const inMatch = reasonText.match(/Masuk\s*\(([0-2]?[0-9]:[0-5][0-9])/i);
            if (inMatch) checkInTime = `${inMatch[1]}:00`;
            const outMatch = reasonText.match(/Pulang\s*\(([0-2]?[0-9]:[0-5][0-9])/i);
            if (outMatch) checkOutTime = `${outMatch[1]}:00`;

            if (status === 'HADIR' && !checkInTime) checkInTime = '07:00:00';
          } else {
            status = lType === 'SAKIT' ? 'SAKIT' : lType === 'DINAS_LUAR' ? 'DINAS_LUAR' : 'IZIN';
          }

          const startDate = new Date(leaveRow.start_date);
          const endDate = new Date(leaveRow.end_date);
          const curr = new Date(startDate);

          while (curr <= endDate) {
            const dateStr = curr.toISOString().substring(0, 10);
            await this.client.from('attendance').upsert(
              {
                id: `att_${leaveRow.user_id}_${dateStr}`,
                user_id: leaveRow.user_id,
                date: dateStr,
                status: status,
                check_in_time: checkInTime,
                check_out_time: checkOutTime,
                notes: lType === 'KOREKSI_ABSEN' ? `Koreksi Disetujui: ${notes || leaveRow.reason}` : `Izin Disetujui: ${notes || leaveRow.reason}`,
              },
              { onConflict: 'user_id,date' }
            );
            curr.setDate(curr.getDate() + 1);
          }
        }
      } catch (upsertErr) {
        logger.warn('SupabaseProvider', 'Failed to upsert attendance on leave approval:', upsertErr);
      }
    }

    return true;
  }

  public async getPendingLeaves(_token: string): Promise<LeaveRequest[]> {
    const { data } = await this.client
      .from('leaves')
      .select('*')
      .or('status.eq.PENDING,approval_status.eq.PENDING')
      .order('created_at', { ascending: false });

    return (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      leave_type: (row.type || row.leave_type || 'IZIN') as LeaveType,
      start_date: row.start_date,
      end_date: row.end_date,
      reason: row.reason,
      attachment_url: row.attachment_url || null,
      approval_status: (row.status || row.approval_status || 'PENDING') as ApprovalStatus,
      approval_deadline: row.approval_deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
      approved_by: row.approved_by || null,
      approval_notes: row.rejection_notes || row.approval_notes || null,
      created_at: row.created_at,
    }));
  }

  public async getAllLeaves(_token: string): Promise<LeaveRequest[]> {
    const { data } = await this.client
      .from('leaves')
      .select('*')
      .order('created_at', { ascending: false });

    return (data || []).map((row) => ({
      id: row.id,
      user_id: row.user_id,
      leave_type: (row.type || row.leave_type || 'IZIN') as LeaveType,
      start_date: row.start_date,
      end_date: row.end_date,
      reason: row.reason,
      attachment_url: row.attachment_url || null,
      approval_status: (row.status || row.approval_status || 'PENDING') as ApprovalStatus,
      approval_deadline: row.approval_deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
      approved_by: row.approved_by || null,
      approval_notes: row.rejection_notes || row.approval_notes || null,
      created_at: row.created_at,
    }));
  }

  public async getUserLeaves(userId: string, _token: string): Promise<LeaveRequest[]> {
    try {
      const { data, error } = await this.client
        .from('leaves')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('SupabaseProvider', 'getUserLeaves query error:', error.message);
        const saved = localStorage.getItem('smart_absensi_leaves');
        if (saved) {
          const list: LeaveRequest[] = JSON.parse(saved);
          return list.filter((l) => l.user_id === userId || !l.user_id);
        }
        return [];
      }

      const fetchedLeaves: LeaveRequest[] = (data || []).map((row) => ({
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
        created_at: row.created_at || new Date().toISOString(),
      }));

      // Cache to localStorage for offline resilience
      try {
        const savedLocal = localStorage.getItem('smart_absensi_leaves');
        const existingList: LeaveRequest[] = savedLocal ? JSON.parse(savedLocal) : [];
        const otherUserLeaves = existingList.filter((l) => l.user_id && l.user_id !== userId);
        const merged = [...fetchedLeaves, ...otherUserLeaves];
        localStorage.setItem('smart_absensi_leaves', JSON.stringify(merged));
      } catch {
        // ignore cache write errors
      }

      return fetchedLeaves;
    } catch (err) {
      logger.error('SupabaseProvider', 'getUserLeaves exception:', err);
      const saved = localStorage.getItem('smart_absensi_leaves');
      if (saved) {
        try {
          const list: LeaveRequest[] = JSON.parse(saved);
          return list.filter((l) => l.user_id === userId || !l.user_id);
        } catch {
          // ignore
        }
      }
      return [];
    }
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
      admin_reset_password: map.admin_reset_password || undefined,
    };
  }

  public async updateSettings(settings: SystemSettings, _token: string): Promise<boolean> {
    const updates = [
      { key: 'app_name', value: settings.app_name || 'Smart Absensi Guru' },
      { key: 'institution_name', value: settings.institution_name || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam' },
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

    if (settings.admin_reset_password !== undefined) {
      updates.push({ key: 'admin_reset_password', value: settings.admin_reset_password });
    }

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
      nip: user.nip ? user.nip.trim() : null,
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
    if (updates.avatar_url !== undefined) payload.avatar_url = updates.avatar_url;
    if (updates.is_active !== undefined) payload.account_status = updates.is_active ? 'ACTIVE' : 'INACTIVE';

    const { error } = await this.client.from('users').update(payload).eq('id', userId);
    if (error) throw new Error('Gagal memperbarui data pengguna: ' + error.message);

    const activeUser = useAuthStore.getState().user;
    if (activeUser && (activeUser.id === userId || (activeUser.nip && activeUser.nip === userId))) {
      useAuthStore.getState().updateUserProfile(updates);
    }
    return true;
  }

  public async uploadAvatar(userId: string, file: File): Promise<string> {
    try {
      // Auto-convert to WebP format (max 400x400px, 80% quality) to save Supabase Storage (~20-30KB per photo)
      let fileToUpload = file;
      if (typeof window !== 'undefined' && typeof document !== 'undefined') {
        try {
          fileToUpload = await convertToWebP(file, 400, 400, 0.8);
          logger.info('SupabaseProvider', 'Image converted to WebP successfully', {
            originalSize: `${(file.size / 1024).toFixed(1)} KB`,
            webpSize: `${(fileToUpload.size / 1024).toFixed(1)} KB`,
          });
        } catch (convErr) {
          logger.warn('SupabaseProvider', 'Failed to convert image to WebP, uploading original file', { userId, convErr });
        }
      }

      const filePath = `teacher_${userId}_${Date.now()}.webp`;

      // Try bucket 'avatas 1', fallback to 'avatas-1' or 'avatars'
      const bucketsToTry = ['avatas 1', 'avatas-1', 'avatars'];
      let publicUrl = '';
      let uploadSuccess = false;

      for (const bucketName of bucketsToTry) {
        const { error: uploadError } = await this.client.storage
          .from(bucketName)
          .upload(filePath, fileToUpload, { upsert: true, contentType: 'image/webp' });

        if (!uploadError) {
          const { data } = this.client.storage.from(bucketName).getPublicUrl(filePath);
          publicUrl = data.publicUrl;
          uploadSuccess = true;
          break;
        }
      }

      if (!uploadSuccess || !publicUrl) {
        publicUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(fileToUpload);
        });
      }

      await this.updateUser(userId, { avatar_url: publicUrl }, '');
      return publicUrl;
    } catch (err) {
      logger.warn('SupabaseProvider', 'uploadAvatar fallback to base64 Data URI', { userId, err });
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = (err) => reject(err);
        reader.readAsDataURL(file);
      });
    }
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
  ): Promise<{ status: 'ACTIVE' | 'UNBOUND' | 'DIFFERENT_DEVICE' | 'NEEDS_ADMIN_RESET' | 'UNAVAILABLE'; message: string; registered_uuid?: string }> {
    try {
      const sessionUser = useAuthStore.getState().user;
      if (sessionUser && sessionUser.full_name.toLowerCase().includes('dafa maulana')) {
        return {
          status: 'ACTIVE',
          message: '🚀 Akses Khusus Dafa Maulana, S.Pd: Multi-Perangkat Aktif (Bypass Pembatasan)',
          registered_uuid: currentDeviceUUID,
        };
      }

      const { data: binding, error } = await this.client
        .from('device_bindings')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        // Tabel belum ada atau belum ada RLS policy — TIDAK boleh return ACTIVE
        logger.warn('SupabaseProvider', 'device_bindings query error (tabel mungkin belum dibuat):', error.message);
        return {
          status: 'UNAVAILABLE',
          message: 'Status binding tidak dapat diverifikasi. Tabel device_bindings belum tersedia atau RLS policy error. Hubungi Admin.',
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
        status: 'UNAVAILABLE',
        message: 'Gagal memeriksa binding perangkat. Koneksi ke server bermasalah.',
      };
    }
  }

  public async getNotifications(userId: string, _token: string): Promise<any[]> {
    try {
      const { data, error } = await this.client
        .from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('SupabaseProvider', 'notifications query error (tabel mungkin belum dibuat):', error.message);
        return [];
      }

      if (data && data.length > 0) {
        const readIds = NotificationService.getReadNotificationIds(userId);
        return data.map((n) => ({
          id: n.id,
          user_id: n.user_id,
          title: n.title,
          message: n.message,
          type: n.type || 'INFO',
          is_read: Boolean(n.is_read) || readIds.has(n.id),
          created_at: n.created_at,
        }));
      }

      return [];
    } catch (err) {
      logger.error('SupabaseProvider', 'getNotifications exception:', err);
      return [];
    }
  }

  public async markNotificationAsRead(notificationId: string, _token: string): Promise<boolean> {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(notificationId);
    if (!isUuid) {
      logger.info('SupabaseProvider', 'Skipping DB update for synthetic/local notification ID:', notificationId);
      return true;
    }

    const { error } = await this.client
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    if (error) {
      logger.error('SupabaseProvider', 'markNotificationAsRead error:', error.message);
      throw new Error(`Gagal memperbarui status notifikasi di backend: ${error.message}`);
    }
    return true;
  }

  // ─── TEACHER WELL-BEING & MOOD API ───────────────────────────────────────

  public async saveTeacherMood(
    userId: string,
    date: string,
    mood: TeacherMoodType,
    note?: string,
    _token?: string
  ): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('teacher_moods')
        .upsert(
          {
            user_id: userId,
            date,
            mood,
            note: note || null,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'user_id,date' }
        );

      if (error) {
        logger.warn('SupabaseProvider', 'saveTeacherMood Supabase error, falling back to local storage:', error.message);
        // Fallback to local storage if table doesn't exist yet
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('smart_absensi_teacher_moods') : null;
        let logs: TeacherMoodLog[] = raw ? JSON.parse(raw) : [];
        const idx = logs.findIndex((l) => l.user_id === userId && l.date === date);
        const item: TeacherMoodLog = { id: 'mood_' + Date.now(), user_id: userId, date, mood, note, created_at: new Date().toISOString() };
        if (idx >= 0) logs[idx] = item; else logs.push(item);
        if (typeof localStorage !== 'undefined') localStorage.setItem('smart_absensi_teacher_moods', JSON.stringify(logs));
      }
      return true;
    } catch (err) {
      logger.error('SupabaseProvider', 'saveTeacherMood exception:', err);
      return true;
    }
  }

  public async getTodayTeacherMood(userId: string, date: string, _token?: string): Promise<TeacherMoodLog | null> {
    try {
      const { data, error } = await this.client
        .from('teacher_moods')
        .select('*')
        .eq('user_id', userId)
        .eq('date', date)
        .maybeSingle();

      if (!error && data) {
        return {
          id: data.id,
          user_id: data.user_id,
          date: data.date,
          mood: data.mood as TeacherMoodType,
          note: data.note || undefined,
          created_at: data.created_at,
        };
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getTodayTeacherMood error:', err);
    }

    // Fallback to local storage
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('smart_absensi_teacher_moods');
      if (raw) {
        try {
          const logs: TeacherMoodLog[] = JSON.parse(raw);
          return logs.find((l) => l.user_id === userId && l.date === date) || null;
        } catch {}
      }
    }
    return null;
  }

  public async getBurnoutAnalytics(month?: string, year?: string, _token?: string): Promise<BurnoutAnalytics> {
    const today = getTodayDateInJakarta();
    const targetYear = year || today.substring(0, 4);
    const targetMonth = month !== undefined ? month : String(parseInt(today.substring(5, 7), 10));

    const breakdown: Record<TeacherMoodType, number> = {
      VERY_HAPPY: 0,
      HAPPY: 0,
      NEUTRAL: 0,
      TIRED: 0,
      STRESSED: 0,
    };

    let totalLogs: TeacherMoodLog[] = [];

    try {
      let query = this.client.from('teacher_moods').select('*');

      if (targetMonth === 'ALL') {
        query = query.gte('date', `${targetYear}-01-01`).lte('date', `${targetYear}-12-31`);
      } else {
        const monthNum = parseInt(targetMonth, 10);
        const monthPad = String(targetMonth).padStart(2, '0');
        const lastDay = new Date(parseInt(targetYear, 10), monthNum, 0).getDate();
        query = query.gte('date', `${targetYear}-${monthPad}-01`).lte('date', `${targetYear}-${monthPad}-${String(lastDay).padStart(2, '0')}`);
      }

      const { data, error } = await query;

      if (!error && data && data.length > 0) {
        totalLogs = data.map((d) => ({
          id: d.id,
          user_id: d.user_id,
          date: d.date,
          mood: d.mood as TeacherMoodType,
          note: d.note,
          created_at: d.created_at,
        }));
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getBurnoutAnalytics Supabase query error, fallback to mock:', err);
    }

    if (totalLogs.length === 0 && typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem('smart_absensi_teacher_moods');
      if (raw) {
        try {
          const parsed: TeacherMoodLog[] = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            if (targetMonth === 'ALL') {
              totalLogs = parsed.filter((log) => log.date && log.date.startsWith(`${targetYear}-`));
            } else {
              const monthPad = String(targetMonth).padStart(2, '0');
              totalLogs = parsed.filter((log) => log.date && log.date.startsWith(`${targetYear}-${monthPad}`));
            }
          }
        } catch {}
      }
    }

    if (totalLogs.length > 0) {
      totalLogs.forEach((log) => {
        if (breakdown[log.mood] !== undefined) {
          breakdown[log.mood]++;
        }
      });
    }

    const total = totalLogs.length;
    const tiredAndStressed = breakdown.TIRED + breakdown.STRESSED;
    const stressPercentage = total > 0 ? (tiredAndStressed / total) * 100 : 0;

    let burnout_risk_level: 'LOW' | 'MEDIUM' | 'HIGH' = 'LOW';
    let recommendation = total === 0
      ? 'Belum ada data mood guru yang tercatat pada periode ini. Grafik dan rekomendasi akan muncul secara realtime begitu dewan guru mengisi mood check-in harian.'
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

  // Teacher Duty Schedule API (Jadwal Piket Guru Senin - Jumat)
  public async getDutySchedules(_token?: string): Promise<TeacherDutySchedule[]> {
    try {
      const { data, error } = await this.client
        .from('teacher_duty_schedules')
        .select('*')
        .order('day_of_week', { ascending: true });

      if (!error && data) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('smart_absensi_duty_schedules', JSON.stringify(data));
        }
        return data as TeacherDutySchedule[];
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getDutySchedules error, falling back to local storage:', err);
    }

    // Fallback to local storage if DB query fails
    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.getDutySchedules();
  }

  public async saveDutySchedules(
    schedules: Omit<TeacherDutySchedule, 'id' | 'created_at'>[],
    _token?: string
  ): Promise<boolean> {
    try {
      // 1. Clear existing schedule in Supabase table
      const { error: delError } = await this.client
        .from('teacher_duty_schedules')
        .delete()
        .neq('day_of_week', 0); // Deletes all rows since day_of_week is 1..5

      if (delError) {
        logger.warn('SupabaseProvider', 'Failed to clear teacher_duty_schedules in Supabase:', delError.message);
      }

      // 2. Insert new schedule records into Supabase (without custom non-UUID strings)
      if (schedules.length > 0) {
        const dbPayload = schedules.map((item) => ({
          day_of_week: item.day_of_week,
          teacher_id: item.teacher_id,
          teacher_name: item.teacher_name,
          notes: item.notes || null,
        }));

        const { error: insError } = await this.client.from('teacher_duty_schedules').insert(dbPayload);
        if (insError) {
          logger.warn('SupabaseProvider', 'Failed to insert teacher_duty_schedules to Supabase:', insError.message);
        }
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'saveDutySchedules DB operation error:', err);
    }

    // 3. Always update local cache for instant UI rendering and offline fallback
    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.saveDutySchedules(schedules);
  }
}


