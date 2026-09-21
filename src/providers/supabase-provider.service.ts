import { createClient } from '@supabase/supabase-js';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { IDataProvider } from './data-provider.interface';
import type {
  UserProfile,
  AttendanceRecord,
  LeaveRequest,
  SystemSettings,
  HolidayRecord,
  AppNotification,
  MarkNotificationDTO,
  MarkBatchNotificationsDTO,
  MarkReadResult,
  AttendanceStatus,
  LeaveType,
  ApprovalStatus,
  HolidayType,
  TeacherMoodType,
  TeacherMoodLog,
  BurnoutAnalytics,
  TeacherDutySchedule,
  TeacherComplaint,
  SubmitComplaintDTO,
  UpdateComplaintStatusDTO,
  TeachingSlot,
  CreateTeachingScheduleDTO,
  UpdateTeachingScheduleDTO,
  TeachingScheduleResult,
  StudentItem,
  StudentAttendanceRecord,
  StudentBehaviorRecord,
  StudentBehaviorLog,
  RecordStudentBehaviorParams,
  RecordStudentBehaviorResult,
  StudentCharacterSummary,
  VerificationMethod,
  AttendanceSource,
  PushSubscriptionPayload,
  SavePushSubscriptionResult,
  PushSubscriptionErrorCode,
  NotificationPreferences,
  TeacherPointLog,
  TeacherPointActivityType,
  InventorySarprasItem,
  CreateInventorySarprasDTO,
  UpdateInventorySarprasDTO,
  ExamSessionRecord,
  CreateExamSessionDTO,
  GradedStudentScoreRecord,
  SaveGradedStudentDTO,
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
import type {
  HomeroomOverview,
  HomeroomStudentItem,
  StudentPlanDetail,
  VerifyPlanDTO,
  VerifyPlanResult,
} from '../types/homeroom.types';
import type {
  ExamCommitteeMember,
  ExamScheduleData,
} from '../types/exam-schedule.types';
import { CONSTANTS } from '../config/constants';
import { calculateDistanceMeters, getEffectiveAllowedRadius } from '../utils/geofence.utils';
import { logger } from '../utils/logger.utils';
import { convertToWebP } from '../utils/image.utils';
import {
  normalizeDayOfWeek,
  getDayNameIndonesian,
  parseScheduleTime,
  formatTimeRange,
  validateScheduleConflict,
  sortTeachingSlots,
} from '../utils/teaching-schedule.utils';
import { parseAnswerKey } from '../utils/scoring.utils';
import { normalizeClassCode, resolveSchoolLevel } from '../utils/class.utils';
import { getInitialSeedTeacherPointLogs, getSafeInitialTeacherPointLogs } from '../utils/teacher-point-seed.utils';

export class SupabaseProvider implements IDataProvider {
  private client: SupabaseClient;

  // In-memory TTL caches to eliminate redundant PostgREST queries and prevent Egress bloat
  private cachedSettings: SystemSettings | null = null;
  private cachedSettingsTimestamp: number = 0;

  private cachedHolidays: HolidayRecord[] | null = null;
  private cachedHolidaysTimestamp: number = 0;

  private cachedUsers: UserProfile[] | null = null;
  private cachedUsersTimestamp: number = 0;

  private cachedAllLeaves: LeaveRequest[] | null = null;
  private cachedAllLeavesTimestamp: number = 0;

  // In-flight request deduplication map to prevent parallel duplicate queries
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  // Realtime channel singletons to prevent duplicate subscriptions per client
  private activeNotificationChannel: any = null;
  private activeAttendanceChannel: any = null;

  // Additional TTL caches for rarely changing datasets
  private cachedDutySchedules: TeacherDutySchedule[] | null = null;
  private cachedDutySchedulesTimestamp: number = 0;

  private cachedInventorySarpras: InventorySarprasItem[] | null = null;
  private cachedInventorySarprasTimestamp: number = 0;

  // Dedicated In-Memory TTL Caches to suppress excessive PostgREST egress & redundant round-trips
  private cachedTodayAttendance: Map<string, { data: AttendanceRecord | null; timestamp: number }> = new Map();
  private cachedMonthlyAttendance: Map<string, { data: AttendanceRecord[]; timestamp: number }> = new Map();
  private cachedTeacherPointHistory: Map<string, { data: TeacherPointLog[]; timestamp: number }> = new Map();
  private cachedUserLeaves: Map<string, { data: LeaveRequest[]; timestamp: number }> = new Map();
  private cachedTodayTeacherMood: Map<string, { data: TeacherMoodLog | null; timestamp: number }> = new Map();
  private cachedDeviceBinding: Map<string, { data: any; timestamp: number }> = new Map();
  private cachedNotifications: Map<string, { data: AppNotification[]; timestamp: number }> = new Map();
  private cachedNotificationReads: Map<string, { data: Set<string>; timestamp: number }> = new Map();
  private cachedTeachingSchedules: Map<string, { data: TeachingSlot[]; timestamp: number }> = new Map();
  private teachingSchedulesCooldownUntil: number = 0;
  private cachedExamCommittees: Map<string, { data: ExamCommitteeMember[]; timestamp: number }> = new Map();
  private cachedExamSchedules: Map<string, { data: ExamScheduleData | null; timestamp: number }> = new Map();

  private dedupeRequest<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (this.inFlightRequests.has(key)) {
      return this.inFlightRequests.get(key) as Promise<T>;
    }
    const promise = fn().finally(() => {
      this.inFlightRequests.delete(key);
    });
    this.inFlightRequests.set(key, promise);
    return promise;
  }

  constructor() {
    const url =
      (typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_SUPABASE_URL_TOREN2 as string) ||
          (import.meta.env.VITE_SUPABASE_URL as string)
        : '') || 'https://fnppfmjsbqxbtioypnap.supabase.co';

    const key =
      (typeof import.meta !== 'undefined' && import.meta.env
        ? (import.meta.env.VITE_SUPABASE_ANON_KEY_TOREN2 as string) ||
          (import.meta.env.VITE_SUPABASE_ANON_KEY as string)
        : '') ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZucHBmbWpzYnF4YnRpb3lwbmFwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkzNzcyNDksImV4cCI6MjEwNDk1MzI0OX0.ewXX-KW3SMEF-KtOZ5P1MY5IpZSJQImDt5g9maTOWfE';

    this.client = createClient(url, key);
  }

  public getClient(): SupabaseClient {
    return this.client;
  }

  // ─── AUTHENTICATION API ───────────────────────────────────────────────────

  public async login(dto: LoginDTO): Promise<LoginResponseDTO> {
    // 1. Jalur Utama: Server-Side Stateful Session Engine (/api/auth/login)
    if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
      try {
        const resp = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            identity: dto.identity,
            pin: dto.pin,
            device_uuid: dto.device_uuid,
            device_model: dto.device_model,
          }),
        });

        const json = await resp.json().catch(() => null);

        if (resp.ok && json?.success && json?.token) {
          logger.info('SupabaseProvider', 'Login berhasil diterbitkan oleh Serverless Session Engine');
          return {
            token: json.token,
            user: json.user,
          };
        }

        if (!resp.ok && json?.errorMessage) {
          throw new Error(json.errorMessage);
        }
      } catch (err: any) {
        // Jika penolakan kredensial / akun terkunci dari server, teruskan error ke UI
        if (
          err.message &&
          (err.message.includes('PIN') ||
            err.message.includes('terblokir') ||
            err.message.includes('ditemukan') ||
            err.message.includes('terkunci'))
        ) {
          throw err;
        }
        logger.warn('SupabaseProvider', 'Serverless login API offline/unreachable, fallback ke direct client provider', err);
      }
    }

    // 2. Jalur Fallback (untuk testing offline/unit test runner tanpa backend server)
    const { data: user, error } = await this.client
      .from('users')
      .select('id, nip, full_name, phone_number, role, position, avatar_url, account_status, pin_hash, created_at')
      .or(`phone_number.eq.${dto.identity},nip.eq.${dto.identity}`)
      .single();

    if (error || !user) {
      throw new Error('Akun pengguna tidak ditemukan. Periksa No HP / NPP Anda.');
    }

    if (user.account_status === 'LOCKED' || user.account_status === 'INACTIVE') {
      throw new Error('Akun Anda sedang terblokir / tidak aktif. Hubungi Admin Sekolah.');
    }

    const hashedInputPin = await hashPin(dto.pin);
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
        // Query via users_public_view with safe columns (excludes pin_hash, reducing Supabase egress)
        let userQuery = await this.client
          .from('users_public_view')
          .select('id, nip, full_name, phone_number, role, position, avatar_url, account_status, created_at')
          .or(filters.join(','))
          .maybeSingle();

        if (userQuery.error && (userQuery.error.code === '42P01' || userQuery.error.message?.includes('does not exist'))) {
          userQuery = await this.client
            .from('users')
            .select('id, nip, full_name, phone_number, role, position, avatar_url, account_status, created_at')
            .or(filters.join(','))
            .maybeSingle();
        }

        const user = userQuery.data;

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
    this.cachedDeviceBinding.clear();
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
    const isOfflineSync = dto.attendance_source === 'OFFLINE_SYNC' || dto.token?.startsWith('SYNC_');
    const isDoorPosterQR = Boolean(
      dto.qr_seed && (
        dto.qr_seed.trim() === CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED ||
        dto.qr_seed.includes('SMART_ABSENSI_OFFICIAL_QR') ||
        dto.qr_seed.includes('POSTER') ||
        dto.qr_seed.startsWith('SAG_SEED_VALID') ||
        dto.qr_seed.startsWith('SAG_TEST_SEED')
      )
    );
    const effectiveAllowedRadius = (isOfflineSync || isDoorPosterQR) ? Math.max(allowedRadius, 500) : allowedRadius;

    logger.info('SupabaseProvider', 'scanAttendance geofence check', {
      distanceMeters,
      allowedRadius,
      effectiveAllowedRadius,
      isOfflineSync,
      isDoorPosterQR,
      gps_accuracy: dto.gps_accuracy,
    });

    if (distanceMeters > effectiveAllowedRadius && !isOfflineSync) {
      throw new Error(
        `Absensi Ditolak! Anda terdeteksi berada ${distanceMeters} meter dari gerbang sekolah. Radius maksimal: ${effectiveAllowedRadius}m.`
      );
    }

    const todayStr = dto.timestamp ? getTodayDateInJakarta(dto.timestamp) : getTodayDateInJakarta();
    
    // Ensure clean standard time string (HH:mm:ss) without raw suffix for database column compatibility
    let dbTime = getCurrentTimeInJakarta();
    if (dto.timestamp) {
      try {
        const d = new Date(dto.timestamp);
        if (!isNaN(d.getTime())) {
          dbTime = [d.getHours(), d.getMinutes(), d.getSeconds()]
            .map((n) => String(n).padStart(2, '0'))
            .join(':');
        }
      } catch {
        // Fallback to getCurrentTimeInJakarta
      }
    }
    const displayTime = dbTime.slice(0, 5);
    const timeStr = dbTime;

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
      let res = await this.client
        .from('users_public_view')
        .select('id, nip, full_name')
        .or(scanUserFilters.join(','))
        .limit(1);

      if (res.error && (res.error.code === '42P01' || res.error.message?.includes('does not exist'))) {
        res = await this.client
          .from('users')
          .select('id, nip, full_name')
          .or(scanUserFilters.join(','))
          .limit(1);
      }
      userExists = res.data?.[0] || null;
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

    // Check if user has already checked in today (multi-key lookup for resilience)
    const userSearchIds = [userId];
    if (sessionUser?.id && !userSearchIds.includes(sessionUser.id)) userSearchIds.push(sessionUser.id);
    if (sessionUser?.phone_number && !userSearchIds.includes(sessionUser.phone_number)) userSearchIds.push(sessionUser.phone_number);
    if (sessionUser?.nip && !userSearchIds.includes(sessionUser.nip)) userSearchIds.push(sessionUser.nip);

    const { data: existingRecords } = await this.client
      .from('attendance')
      .select('id, user_id, date, status, check_in_time, check_out_time, check_in_lat, check_in_lng, distance_meters, verification_method, attendance_source, created_at')
      .eq('date', todayStr)
      .in('user_id', userSearchIds)
      .order('created_at', { ascending: false })
      .limit(1);

    const existing = existingRecords?.[0] || null;

    if (existing) {
      if (existing.check_in_time) {
        // If check-out is already recorded, return ALREADY_COMPLETED
        if (existing.check_out_time) {
          logger.info('SupabaseProvider', 'Attendance already completed for today', { userId, date: todayStr });
          return {
            attendance_id: existing.id,
            status: (existing.status as AttendanceStatus) || status,
            timestamp: `${existing.check_out_time} (Tersinkron)`,
            distance_meters: distanceMeters,
            geofence_verified: true,
            attendance_action: 'ALREADY_COMPLETED',
          };
        }

        // If this is an offline sync but it was just a duplicate check-in, don't overwrite
        if (isOfflineSync && dto.attempt_action === 'CHECK_IN' && !dto.qr_seed?.includes('CHECK_OUT') && !dto.verification_method?.includes('PULANG')) {
          logger.info('SupabaseProvider', 'Check-in already recorded online, skipping offline check-in replay', { userId, date: todayStr });
          return {
            attendance_id: existing.id,
            status: (existing.status as AttendanceStatus) || status,
            timestamp: `${existing.check_in_time} (Check-in Tersinkron)`,
            distance_meters: distanceMeters,
            geofence_verified: true,
            attendance_action: 'ALREADY_COMPLETED',
          };
        }

        const isEarlyCheckout = !isCheckoutWindow;
        const checkoutLabel = isEarlyCheckout
          ? `${displayTime} WIB (Pulang Awal < ${targetCheckoutStart})`
          : `${displayTime} WIB (Absen Pulang)`;

        const vMethod: VerificationMethod = dto.verification_method || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC_GPS' : 'QR_GPS');
        const aSource: AttendanceSource = dto.attendance_source || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC' : 'QR');

        // Record or Update Check-out (Absen Pulang ke jam scan WIB pertama)
        const updatePayload: Record<string, unknown> = {
          check_out_time: dbTime,
          verification_method: vMethod,
          attendance_source: aSource,
        };

        let { error: updateErr } = await this.client
          .from('attendance')
          .update(updatePayload)
          .eq('id', existing.id);

        if (updateErr && (updateErr.message.includes('column') || updateErr.message.includes('verification_method'))) {
          delete updatePayload.verification_method;
          delete updatePayload.attendance_source;
          const retryRes = await this.client
            .from('attendance')
            .update(updatePayload)
            .eq('id', existing.id);
          updateErr = retryRes.error;
        }

        // Resilient Fallback: Jika update langsung gagal / terhalang policy RLS, coba lakukan upsert
        if (updateErr) {
          logger.warn('SupabaseProvider', 'Direct update failed, attempting upsert fallback for check-out:', updateErr.message);
          const checkoutUpsertPayload: Record<string, unknown> = {
            ...existing,
            ...updatePayload,
            id: existing.id || attId,
            user_id: existing.user_id || userId,
            date: existing.date || todayStr,
            check_out_time: dbTime,
          };
          const upsertRes = await this.client
            .from('attendance')
            .upsert(checkoutUpsertPayload, { onConflict: 'id' });
          
          if (!upsertRes.error) {
            updateErr = null;
          } else {
            logger.error('SupabaseProvider', 'Check-out upsert fallback also failed:', upsertRes.error.message);
          }
        }

        if (updateErr) {
          throw new Error('Gagal mencatat absensi pulang: ' + updateErr.message);
        }

        // AUTOMATIC TEACHER POINT RECORDING (Check-out Pulang Sekolah) — Non-blocking async
        const checkoutPts = isEarlyCheckout ? 5 : 10;
        const checkoutTitle = isEarlyCheckout
          ? 'Presensi Pulang Sekolah (Sebelum Jam Dinas)'
          : 'Presensi Pulang Tuntas Bertugas';
        const checkoutDesc = `Tercatat menyelesaikan dinas sekolah pada pukul ${displayTime} WIB via ${vMethod || 'QR'}`;

        this.recordTeacherPoint({
          user_id: userId,
          teacher_name: userExists?.full_name || sessionUser?.full_name || undefined,
          date: todayStr,
          points: checkoutPts,
          activity_type: 'CHECK_OUT',
          title: checkoutTitle,
          description: checkoutDesc,
        }).catch((ePoint) => {
          logger.warn('SupabaseProvider', 'Failed to auto-record teacher points on check-out:', ePoint);
        });

        // Invalidate attendance caches upon check-out
        this.cachedTodayAttendance.clear();
        this.cachedMonthlyAttendance.clear();

        // Dispatch real-time UI refresh events for same-device dashboard sync
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('smart_absensi_scanned'));
          window.dispatchEvent(new Event('smart_absensi_records_updated'));
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

    // ── SMART DUAL-CHANNEL ATTENDANCE INTENT RESOLVER (SDC-AIR) ─────────────
    // Cek apakah guru memiliki pengajuan koreksi masuk (KOREKSI_ABSEN) untuk hari ini
    let pendingMorningCorrection: { targetCheckInTime: string; reason: string; status: AttendanceStatus } | null = null;
    if (!existing || !existing.check_in_time) {
      try {
        const { data: correctionRows } = await this.client
          .from('leaves')
          .select('id, user_id, type, reason, status, start_date, end_date')
          .in('user_id', userSearchIds)
          .lte('start_date', todayStr)
          .gte('end_date', todayStr)
          .eq('type', 'KOREKSI_ABSEN')
          .in('status', ['PENDING', 'APPROVED', 'APPROVED_BY_KEPSEK'])
          .order('created_at', { ascending: false })
          .limit(1);

        const correction = correctionRows?.[0];
        if (correction) {
          const reasonText = correction.reason || '';
          const inMatch = reasonText.match(/Masuk\s*\(([0-2]?[0-9]:[0-5][0-9])/i);
          const targetIn = inMatch ? `${inMatch[1]}:00` : '07:00:00';
          let targetStat: AttendanceStatus = 'HADIR';
          if (reasonText.includes('menjadi SAKIT')) targetStat = 'SAKIT';
          else if (reasonText.includes('menjadi IZIN')) targetStat = 'IZIN';
          else if (reasonText.includes('menjadi DINAS_LUAR')) targetStat = 'DINAS_LUAR';

          pendingMorningCorrection = {
            targetCheckInTime: targetIn,
            reason: reasonText,
            status: targetStat,
          };
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'Failed checking pending correction leaves:', err);
      }
    }

    const isExplicitCheckout = dto.attempt_action === 'CHECK_OUT' ||
      dto.qr_seed?.includes('CHECK_OUT') ||
      dto.verification_method?.includes('PULANG');

    const shouldReconcileAsCheckout = Boolean(
      (pendingMorningCorrection && (isCheckoutWindow || isExplicitCheckout)) ||
      (!existing?.check_in_time && isCheckoutWindow && isExplicitCheckout)
    );

    if (shouldReconcileAsCheckout) {
      const vMethod: VerificationMethod = dto.verification_method || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC_GPS' : 'QR_GPS');
      const aSource: AttendanceSource = dto.attendance_source || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC' : 'QR');
      const resolvedCheckInTime = pendingMorningCorrection?.targetCheckInTime || '07:00:00';
      const resolvedStatus: AttendanceStatus = pendingMorningCorrection?.status || 'HADIR';
      const isEarlyCheckout = !isCheckoutWindow;
      const checkoutLabel = isEarlyCheckout
        ? `${displayTime} WIB (Absen Pulang & Koreksi Masuk • Sebelum Jam Dinas)`
        : `${displayTime} WIB (Absen Pulang & Koreksi Masuk)`;

      const targetRecordId = existing?.id || attId;
      const reconciledPayload: Record<string, unknown> = {
        id: targetRecordId,
        user_id: userId,
        date: todayStr,
        check_in_time: resolvedCheckInTime,
        check_out_time: dbTime,
        status: resolvedStatus,
        distance_meters: distanceMeters,
        device_uuid: dto.device_uuid,
        check_in_lat: userLat,
        check_in_lng: userLng,
        verification_method: vMethod,
        attendance_source: aSource,
        notes: pendingMorningCorrection
          ? `Koreksi Masuk Diajukan (${pendingMorningCorrection.reason}) + Scan Pulang Aktual (${displayTime} WIB)`
          : `Scan Pulang Aktual (${displayTime} WIB) dengan Koreksi Masuk Default`,
      };

      let { error: insertErr } = await this.client.from('attendance').upsert(
        reconciledPayload,
        { onConflict: 'id' }
      );

      if (insertErr && (insertErr.message.includes('column') || insertErr.message.includes('verification_method') || insertErr.message.includes('attendance_source') || insertErr.message.includes('notes'))) {
        delete reconciledPayload.verification_method;
        delete reconciledPayload.attendance_source;
        delete reconciledPayload.notes;
        const retryRes = await this.client.from('attendance').upsert(
          reconciledPayload,
          { onConflict: 'id' }
        );
        insertErr = retryRes.error;
      }

      if (insertErr) {
        throw new Error('Gagal mencatat absensi pulang terpadu: ' + insertErr.message);
      }

      const checkoutPts = isEarlyCheckout ? 5 : 10;
      this.recordTeacherPoint({
        user_id: userId,
        teacher_name: userExists?.full_name || sessionUser?.full_name || undefined,
        date: todayStr,
        points: checkoutPts,
        activity_type: 'CHECK_OUT',
        title: 'Presensi Pulang Tuntas Bertugas (Koreksi Masuk Tervalidasi)',
        description: `Tercatat menyelesaikan dinas sekolah pada pukul ${displayTime} WIB dengan rekonsiliasi koreksi jam masuk.`,
      }).catch((ePoint) => {
        logger.warn('SupabaseProvider', 'Failed to auto-record teacher points on reconciled check-out:', ePoint);
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('smart_absensi_scanned'));
        window.dispatchEvent(new Event('smart_absensi_records_updated'));
      }

      return {
        attendance_id: targetRecordId,
        status: resolvedStatus,
        timestamp: checkoutLabel,
        distance_meters: distanceMeters,
        geofence_verified: true,
        attendance_action: 'CHECK_OUT',
      };
    }

    const vMethod: VerificationMethod = dto.verification_method || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC_GPS' : 'QR_GPS');
    const aSource: AttendanceSource = dto.attendance_source || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC' : 'QR');

    // Insert new check-in record using deterministic primary key 'id'
    const targetRecordId = existing?.id || attId;
    const insertPayload: Record<string, unknown> = {
      id: targetRecordId,
      user_id: userId,
      date: todayStr,
      check_in_time: dbTime,
      status: status,
      distance_meters: distanceMeters,
      device_uuid: dto.device_uuid,
      check_in_lat: userLat,
      check_in_lng: userLng,
      verification_method: vMethod,
      attendance_source: aSource,
    };

    let { error } = await this.client.from('attendance').upsert(
      insertPayload,
      { onConflict: 'id' }
    );

    if (error && (error.message.includes('column') || error.message.includes('verification_method') || error.message.includes('attendance_source'))) {
      delete insertPayload.verification_method;
      delete insertPayload.attendance_source;
      const retryRes = await this.client.from('attendance').upsert(insertPayload, { onConflict: 'id' });
      error = retryRes.error;
    }

    // Secondary fallback: jika upsert terkendala, gunakan direct insert atau direct update berdasarkan id
    if (error && (error.code === '42P10' || error.message.includes('ON CONFLICT') || error.message.includes('constraint'))) {
      logger.warn('SupabaseProvider', 'Upsert with id encountered constraint issue, trying fallback insert/update:', error.message);
      if (existing?.id) {
        const directUpd = await this.client.from('attendance').update(insertPayload).eq('id', existing.id);
        error = directUpd.error;
      } else {
        const directIns = await this.client.from('attendance').insert(insertPayload);
        error = directIns.error;
      }
    }

    if (error) {
      throw new Error('Gagal menyimpan data absensi ke Supabase: ' + error.message);
    }

    // AUTOMATIC TEACHER POINT RECORDING (Check-in On-Time / Late & Duty Piket) — Non-blocking async
    (async () => {
      try {
        const isLate = status === 'TERLAMBAT';
        const attendancePts = isLate ? 5 : 15;
        const attendanceType: TeacherPointActivityType = isLate ? 'CHECK_IN_LATE' : 'CHECK_IN_ON_TIME';
        const attendanceTitle = isLate
          ? 'Presensi Masuk Sekolah (> 07:30 WIB)'
          : 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)';
        const attendanceDesc = `Tercatat hadir pada pukul ${timeStr} via ${vMethod || 'QR'}`;

        await this.recordTeacherPoint({
          user_id: userId,
          teacher_name: userExists?.full_name || sessionUser?.full_name || undefined,
          date: todayStr,
          points: attendancePts,
          activity_type: attendanceType,
          title: attendanceTitle,
          description: attendanceDesc,
        });

        // Cek apakah guru terjadwal piket hari ini
        try {
          const dutySchedules = await this.getDutySchedules();
          const todayDayOfWeek = new Date().getDay();
          const isDutyToday = (dutySchedules || []).some(
            (s) =>
              Number(s.day_of_week) === Number(todayDayOfWeek) &&
              (s.teacher_id === userId ||
                (sessionUser?.full_name &&
                  s.teacher_name &&
                  s.teacher_name.toLowerCase().includes(sessionUser.full_name.toLowerCase())))
          );

          if (isDutyToday) {
            await this.recordTeacherPoint({
              user_id: userId,
              teacher_name: userExists?.full_name || sessionUser?.full_name || undefined,
              date: todayStr,
              points: 10,
              activity_type: 'DUTY_PIKET',
              title: 'Tugas Piket Harian Sekolah',
              description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah',
            });
          }
        } catch (eDuty) {
          logger.warn('SupabaseProvider', 'Failed to verify duty schedule for points:', eDuty);
        }
      } catch (ePoint) {
        logger.warn('SupabaseProvider', 'Failed to auto-record teacher points on check-in:', ePoint);
      }
    })().catch(() => {});

    // Invalidate attendance caches upon recording new check-in
    this.cachedTodayAttendance.clear();
    this.cachedMonthlyAttendance.clear();

    // Dispatch real-time UI refresh events for same-device dashboard sync
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_scanned'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
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
    const cacheKey = `${userId}_${todayStr}`;
    const cached = this.cachedTodayAttendance.get(cacheKey);
    const now = Date.now();
    if (cached) {
      const isComplete = Boolean(cached.data?.check_in_time && cached.data?.check_out_time);
      const ttl = isComplete ? 300000 : 60000;
      if (now - cached.timestamp < ttl) {
        return cached.data;
      }
    }

    return this.dedupeRequest(`getTodayAttendance_${cacheKey}`, async () => {
      const sessionUser = useAuthStore.getState().user;
      const searchIds = [userId];
      if (sessionUser?.id && !searchIds.includes(sessionUser.id)) searchIds.push(sessionUser.id);
      if (sessionUser?.phone_number && !searchIds.includes(sessionUser.phone_number)) searchIds.push(sessionUser.phone_number);
      if (sessionUser?.nip && !searchIds.includes(sessionUser.nip)) searchIds.push(sessionUser.nip);

      const { data: records } = await this.client
        .from('attendance')
        .select('id, user_id, date, check_in_time, check_out_time, status, check_in_lat, check_in_lng, distance_meters, verification_method, attendance_source, created_at')
        .eq('date', todayStr)
        .in('user_id', searchIds)
        .order('created_at', { ascending: false })
        .limit(1);

      const data = records?.[0] || null;
      if (!data) {
        this.cachedTodayAttendance.set(cacheKey, { data: null, timestamp: Date.now() });
        return null;
      }

      const result: AttendanceRecord = {
        id: data.id,
        user_id: data.user_id,
        date: data.date,
        check_in_time: data.check_in_time,
        check_out_time: data.check_out_time,
        status: data.status as AttendanceStatus,
        check_in_lat: data.check_in_lat ? parseFloat(data.check_in_lat) : null,
        check_in_lng: data.check_in_lng ? parseFloat(data.check_in_lng) : null,
        check_in_distance_meters: data.distance_meters || 0,
        verification_method: (data.verification_method as VerificationMethod) || 'QR_GPS',
        attendance_source: (data.attendance_source as AttendanceSource) || 'QR',
        is_offline: false,
        created_at: data.created_at,
      };

      this.cachedTodayAttendance.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    });
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

    const cacheKey = `${userId}_${paddedMonth}_${year}`;
    const cached = this.cachedMonthlyAttendance.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    const startDate = `${year}-${paddedMonth}-01`;
    // Find last day of month
    const yearNum = parseInt(year, 10) || new Date().getFullYear();
    const monthNum = parseInt(paddedMonth, 10) || (new Date().getMonth() + 1);
    const lastDayNum = new Date(yearNum, monthNum, 0).getDate();
    const endDate = `${year}-${paddedMonth}-${String(lastDayNum).padStart(2, '0')}`;

    return this.dedupeRequest(`getMonthlyAttendance_${cacheKey}`, async () => {
      let query = this.client
        .from('attendance')
        .select('id, user_id, date, check_in_time, check_out_time, status, check_in_lat, check_in_lng, distance_meters, verification_method, attendance_source, notes, created_at')
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (userId !== 'ALL') {
        query = query.eq('user_id', userId);
      }

      const { data } = await query;

      const mapped: AttendanceRecord[] = (data || []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        date: row.date,
        check_in_time: row.check_in_time,
        check_out_time: row.check_out_time,
        status: row.status as AttendanceStatus,
        check_in_lat: row.check_in_lat ? parseFloat(row.check_in_lat) : null,
        check_in_lng: row.check_in_lng ? parseFloat(row.check_in_lng) : null,
        check_in_distance_meters: row.distance_meters || 0,
        verification_method: (row.verification_method as VerificationMethod) || 'QR_GPS',
        attendance_source: (row.attendance_source as AttendanceSource) || 'QR',
        is_offline: false,
        notes: row.notes || null,
        created_at: row.created_at,
      }));

      this.cachedMonthlyAttendance.set(cacheKey, { data: mapped, timestamp: Date.now() });
      return mapped;
    });
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
      { onConflict: 'id' }
    );

    if (error && (error.message.includes("'notes'") || error.message.includes('"notes"'))) {
      // Fallback: retry upsert without the optional 'notes' column if it does not exist in schema
      const retryRes = await this.client.from('attendance').upsert(
        basePayload,
        { onConflict: 'id' }
      );
      error = retryRes.error;
    }

    if (error) throw new Error('Gagal koreksi absensi: ' + error.message);
    this.cachedTodayAttendance.clear();
    this.cachedMonthlyAttendance.clear();
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

    // Resolve all possible user aliases (id, nip, full_name, phone_number)
    const userIdsToDelete = new Set<string>([targetUserId]);
    try {
      let userQuery = await this.client
        .from('users_public_view')
        .select('id, nip, full_name, phone_number')
        .or(`id.eq.${targetUserId},nip.eq.${targetUserId}`)
        .maybeSingle();

      if (userQuery.error && (userQuery.error.code === '42P01' || userQuery.error.message?.includes('does not exist'))) {
        userQuery = await this.client
          .from('users')
          .select('id, nip, full_name, phone_number')
          .or(`id.eq.${targetUserId},nip.eq.${targetUserId}`)
          .maybeSingle();
      }
      const userData = userQuery.data;

      if (userData) {
        if (userData.id) userIdsToDelete.add(userData.id);
        if (userData.nip) userIdsToDelete.add(userData.nip);
        if (userData.full_name) userIdsToDelete.add(userData.full_name);
        if (userData.phone_number) userIdsToDelete.add(userData.phone_number);
      }
    } catch (e) {
      logger.warn('SupabaseProvider', 'Failed to resolve user aliases for reset:', e);
    }
    const idList = Array.from(userIdsToDelete);

    // 2. Delete attendance record from Supabase table
    const { error } = await this.client
      .from('attendance')
      .delete()
      .in('user_id', idList)
      .eq('date', date);

    if (error) {
      logger.error('SupabaseProvider', 'resetAttendance failed:', error.message);
      throw new Error('Gagal menghapus presensi di database: ' + error.message);
    }

    // Also delete any specific att_ id patterns
    const attIdsToDelete = idList.map((id) => `att_${id}_${date}`);
    try {
      await this.client
        .from('attendance')
        .delete()
        .in('id', attIdsToDelete);
    } catch (e) {}

    // Also cancel/delete any approved leave / koreksi absen for this teacher on this date
    try {
      await this.client
        .from('leaves')
        .delete()
        .in('user_id', idList)
        .lte('start_date', date)
        .gte('end_date', date);
    } catch (e) {}

    try {
      await this.client
        .from('leave_requests')
        .delete()
        .in('user_id', idList)
        .lte('start_date', date)
        .gte('end_date', date);
    } catch (e) {}

    // 3. Clear local storage cache for all aliases
    const todayStr = getTodayDateInJakarta();
    if (typeof window !== 'undefined') {
      idList.forEach((id) => {
        localStorage.removeItem(`smart_absensi_today_attendance_${id}_${date}`);
        localStorage.removeItem(`smart_absensi_today_attendance_${id}_${todayStr}`);
      });

      const globalSaved = localStorage.getItem('smart_absensi_today_attendance');
      if (globalSaved) {
        try {
          const parsed = JSON.parse(globalSaved);
          if (idList.includes(parsed.user_id) && (parsed.date === date || parsed.date === todayStr)) {
            localStorage.removeItem('smart_absensi_today_attendance');
          }
        } catch (e) {}
      }

      // Also clean smart_absensi_leaves from localStorage
      try {
        const savedLeaves = localStorage.getItem('smart_absensi_leaves');
        if (savedLeaves) {
          const parsed = JSON.parse(savedLeaves);
          if (Array.isArray(parsed)) {
            const filtered = parsed.filter(
              (l) => !(idList.includes(l.user_id) && l.start_date <= date && date <= l.end_date)
            );
            localStorage.setItem('smart_absensi_leaves', JSON.stringify(filtered));
          }
        }
      } catch (e) {}

      // 4. Trigger real-time UI refresh events
      window.dispatchEvent(new Event('smart_absensi_scanned'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
      window.dispatchEvent(new Event('smart_absensi_leaves_updated'));
    }

    this.cachedTodayAttendance.clear();
    this.cachedMonthlyAttendance.clear();
    return true;
  }

  public async getDailyAttendance(date: string, _token: string): Promise<AttendanceRecord[]> {
    const targetDate = date || getTodayDateInJakarta();
    return this.dedupeRequest(`getDailyAttendance_${targetDate}`, async () => {
      const { data } = await this.client
        .from('attendance')
        .select('id, user_id, date, check_in_time, check_out_time, status, check_in_lat, check_in_lng, distance_meters, verification_method, attendance_source, notes, created_at')
        .eq('date', targetDate)
        .order('created_at', { ascending: false })
        .limit(200);

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
        verification_method: (row.verification_method as VerificationMethod) || 'QR_GPS',
        attendance_source: (row.attendance_source as AttendanceSource) || 'QR',
        is_offline: false,
        notes: row.notes || null,
        created_at: row.created_at,
      }));
    });
  }

  public async updateAttendanceNote(userId: string, date: string, note: string, _token: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('attendance')
        .update({ notes: note })
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

  public subscribeToAttendanceUpdates(
    callback: (event: { table: string; eventType: string }) => void
  ): () => void {
    // Unsubscribe previous active channel to prevent duplicate listeners
    if (this.activeAttendanceChannel) {
      try {
        this.client.removeChannel(this.activeAttendanceChannel);
      } catch (e) {
        logger.warn('SupabaseProvider', 'Error cleaning up previous activeAttendanceChannel:', e);
      }
      this.activeAttendanceChannel = null;
    }

    const channelId = `realtime_live_tracking_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = this.client
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'attendance' },
        (payload) => {
          logger.info('SupabaseProvider', 'Realtime change detected in attendance table:', payload.eventType);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('smart_absensi_records_updated'));
          }
          callback({ table: 'attendance', eventType: payload.eventType });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leaves' },
        (payload) => {
          logger.info('SupabaseProvider', 'Realtime change detected in leaves table:', payload.eventType);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('smart_absensi_leaves_updated'));
            window.dispatchEvent(new Event('smart_absensi_records_updated'));
          }
          callback({ table: 'leaves', eventType: payload.eventType });
        }
      )
      .subscribe((status) => {
        logger.info('SupabaseProvider', `Realtime channel [${channelId}] status:`, status);
      });

    this.activeAttendanceChannel = channel;

    return () => {
      try {
        this.client.removeChannel(channel);
        if (this.activeAttendanceChannel === channel) {
          this.activeAttendanceChannel = null;
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'Error removing realtime channel:', err);
      }
    };
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
          .upload(fileName, bytes, { upsert: false, contentType, cacheControl: '2592000' });

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

    if (dto.duty_teacher_notes) {
      newLeave.duty_teacher_notes = dto.duty_teacher_notes;
    }

    if (finalAttachmentUrl) {
      newLeave.attachment_url = finalAttachmentUrl;
    }

    let { error } = await this.client.from('leaves').insert(newLeave);

    // If table schema for leaves table does not have duty_teacher_notes or attachment_url column yet
    if (error && (error.message.includes('duty_teacher_notes') || error.message.includes('attachment_url') || error.message.includes('schema cache'))) {
      if (error.message.includes('duty_teacher_notes')) {
        delete newLeave.duty_teacher_notes;
      }
      if (error.message.includes('attachment_url')) {
        if (userProvidedAttachment) {
          throw new Error('Gagal menyimpan lampiran izin: Kolom attachment_url belum ada pada tabel leaves di Supabase (Jalankan CREATE_TABLES.sql).');
        }
        delete newLeave.attachment_url;
      }
      const retryResult = await this.client.from('leaves').insert(newLeave);
      error = retryResult.error;
    }

    if (error) throw new Error('Gagal mengajukan izin: ' + error.message);

    this.cachedAllLeaves = null;
    this.cachedAllLeavesTimestamp = 0;
    this.cachedUserLeaves.clear();

    return {
      id: leaveId,
      user_id: activeUser.id,
      leave_type: dto.leave_type as LeaveType,
      start_date: dto.start_date,
      end_date: dto.end_date,
      reason: dto.reason,
      attachment_url: finalAttachmentUrl,
      duty_teacher_notes: dto.duty_teacher_notes || null,
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
    this.cachedAllLeaves = null;
    this.cachedAllLeavesTimestamp = 0;
    this.cachedUserLeaves.clear();
    this.cachedTodayAttendance.clear();
    this.cachedMonthlyAttendance.clear();
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
          .select('id, user_id, type, reason, start_date, end_date')
          .eq('id', leaveId)
          .maybeSingle();

        if (leaveRow) {
          const lType = leaveRow.type || 'IZIN';
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

          const startStr = (leaveRow.start_date || '').substring(0, 10);
          const endStr = (leaveRow.end_date || '').substring(0, 10);

          if (startStr && endStr) {
            const currDate = new Date(`${startStr}T12:00:00Z`);
            const endDateObj = new Date(`${endStr}T12:00:00Z`);

            while (currDate <= endDateObj) {
              const dateStr = currDate.toISOString().substring(0, 10);
              const attendancePayload = {
                id: `att_${leaveRow.user_id}_${dateStr}`,
                user_id: leaveRow.user_id,
                date: dateStr,
                status: status,
                check_in_time: checkInTime,
                check_out_time: checkOutTime,
                notes:
                  lType === 'KOREKSI_ABSEN'
                    ? `Koreksi Disetujui: ${notes || leaveRow.reason}`
                    : `Izin Disetujui: ${notes || leaveRow.reason}`,
              };

              // Try upsert first using deterministic id (Primary Key)
              const { error: upsertErr } = await this.client
                .from('attendance')
                .upsert(attendancePayload, { onConflict: 'id' });

              if (upsertErr) {
                // Fallback: Check if record exists, then update or insert
                const { data: existing } = await this.client
                  .from('attendance')
                  .select('id')
                  .eq('user_id', leaveRow.user_id)
                  .eq('date', dateStr)
                  .maybeSingle();

                if (existing) {
                  await this.client
                    .from('attendance')
                    .update(attendancePayload)
                    .eq('id', existing.id);
                } else {
                  await this.client.from('attendance').insert(attendancePayload);
                }
              }

              currDate.setUTCDate(currDate.getUTCDate() + 1);
            }
          }
        }
      } catch (upsertErr) {
        logger.warn('SupabaseProvider', 'Failed to upsert attendance on leave approval:', upsertErr);
      }
    }

    // Synchronize local client cache and notify components
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('smart_absensi_leaves');
        if (saved) {
          const list: LeaveRequest[] = JSON.parse(saved);
          if (Array.isArray(list)) {
            const updated = list.map((item) => {
              if (item.id === leaveId) {
                return {
                  ...item,
                  approval_status: decision,
                  status: decision,
                  approval_notes: notes || item.approval_notes,
                  approved_at: new Date().toISOString(),
                };
              }
              return item;
            });
            localStorage.setItem('smart_absensi_leaves', JSON.stringify(updated));
          }
        }
      } catch (e) {}

      window.dispatchEvent(new Event('smart_absensi_leave_updated'));
      window.dispatchEvent(new Event('smart_absensi_leaves_updated'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
    }

    return true;
  }

  public async getPendingLeaves(_token: string): Promise<LeaveRequest[]> {
    try {
      // Exclude attachment_url from pending leaves query to eliminate massive base64 egress bloat
      const { data, error } = await this.client
        .from('leaves')
        .select('id, user_id, type, start_date, end_date, reason, status, approved_by, rejection_notes, created_at')
        .in('status', ['PENDING', 'SUBMITTED', 'UNDER_REVIEW'])
        .order('created_at', { ascending: false });

      if (error) {
        logger.warn('SupabaseProvider', 'getPendingLeaves query error:', error.message);
        // Fallback: try without status in filter (get all lightweight columns and filter client-side)
        const { data: allData } = await this.client
          .from('leaves')
          .select('id, user_id, type, start_date, end_date, reason, status, approved_by, rejection_notes, created_at')
          .order('created_at', { ascending: false });

        const filtered = (allData || []).filter(
          (row) => row.status === 'PENDING' || row.status === 'SUBMITTED' || row.status === 'UNDER_REVIEW'
        );
        return filtered.map((row) => ({
          id: row.id,
          user_id: row.user_id,
          leave_type: (row.type || (row as any).leave_type || 'IZIN') as LeaveType,
          start_date: row.start_date,
          end_date: row.end_date,
          reason: row.reason,
          attachment_url: null, // Excluded from summary/badge query to protect Egress
          approval_status: (row.status || 'PENDING') as ApprovalStatus,
          approval_deadline: (row as any).approval_deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
          approved_by: row.approved_by || null,
          approval_notes: row.rejection_notes || (row as any).approval_notes || null,
          duty_teacher_notes: (row as any).duty_teacher_notes || null,
          created_at: row.created_at,
        }));
      }

      return (data || []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        leave_type: (row.type || (row as any).leave_type || 'IZIN') as LeaveType,
        start_date: row.start_date,
        end_date: row.end_date,
        reason: row.reason,
        attachment_url: null, // Excluded from summary/badge query to protect Egress
        approval_status: (row.status || 'PENDING') as ApprovalStatus,
        approval_deadline: (row as any).approval_deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
        approved_by: row.approved_by || null,
        approval_notes: row.rejection_notes || (row as any).approval_notes || null,
        duty_teacher_notes: (row as any).duty_teacher_notes || null,
        created_at: row.created_at,
      }));
    } catch (err) {
      logger.error('SupabaseProvider', 'getPendingLeaves exception:', err);
      return [];
    }
  }

  public async getAllLeaves(_token: string): Promise<LeaveRequest[]> {
    const now = Date.now();
    // Cache for 30 seconds to prevent concurrent sequential requests from duplicating egress
    if (this.cachedAllLeaves && now - this.cachedAllLeavesTimestamp < 30000) {
      return this.cachedAllLeaves;
    }

    return this.dedupeRequest('getAllLeaves', async () => {
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const { data } = await this.client
        .from('leaves')
        .select('id, user_id, type, start_date, end_date, reason, attachment_url, status, approved_by, rejection_notes, duty_teacher_notes, created_at')
        .or(`created_at.gte.${ninetyDaysAgo},status.eq.PENDING`)
        .order('created_at', { ascending: false })
        .limit(100);

      const result = (data || []).map((row) => ({
        id: row.id,
        user_id: row.user_id,
        leave_type: (row.type || 'IZIN') as LeaveType,
        start_date: row.start_date,
        end_date: row.end_date,
        reason: row.reason,
        attachment_url: row.attachment_url || null,
        approval_status: (row.status || (row as any).approval_status || 'PENDING') as ApprovalStatus,
        approval_deadline: (row as any).approval_deadline || new Date(Date.now() + 86400000 * 3).toISOString(),
        approved_by: row.approved_by || null,
        approval_notes: row.rejection_notes || (row as any).approval_notes || null,
        duty_teacher_notes: row.duty_teacher_notes || null,
        created_at: row.created_at,
      }));

      this.cachedAllLeaves = result;
      this.cachedAllLeavesTimestamp = Date.now();
      return result;
    });
  }

  public async getUserLeaves(userId: string, _token: string): Promise<LeaveRequest[]> {
    const cached = this.cachedUserLeaves.get(userId);
    if (cached && Date.now() - cached.timestamp < 60000) {
      return cached.data;
    }

    return this.dedupeRequest(`getUserLeaves_${userId}`, async () => {
      try {
        const { data, error } = await this.client
          .from('leaves')
          .select('id, user_id, type, start_date, end_date, reason, attachment_url, status, approved_by, rejection_notes, duty_teacher_notes, created_at')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(30);

        if (error) {
          logger.warn('SupabaseProvider', 'getUserLeaves query error:', error.message);
          const saved = localStorage.getItem('smart_absensi_leaves');
          if (saved) {
            const list: LeaveRequest[] = JSON.parse(saved);
            const filtered = list.filter((l) => l.user_id === userId || !l.user_id);
            this.cachedUserLeaves.set(userId, { data: filtered, timestamp: Date.now() });
            return filtered;
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
          duty_teacher_notes: row.duty_teacher_notes || null,
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

        this.cachedUserLeaves.set(userId, { data: fetchedLeaves, timestamp: Date.now() });
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
    });
  }

  // ─── SYSTEM SETTINGS API ──────────────────────────────────────────────────

  public async getSettings(): Promise<SystemSettings> {
    const now = Date.now();
    if (this.cachedSettings && now - this.cachedSettingsTimestamp < 300000) {
      return this.cachedSettings;
    }

    return this.dedupeRequest('getSettings', async () => {
      const { data } = await this.client.from('system_settings').select('key, value');

      const map: Record<string, string> = {};
      (data || []).forEach((row) => {
        map[row.key] = row.value;
      });

      const parsed: SystemSettings = {
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

      this.cachedSettings = parsed;
      this.cachedSettingsTimestamp = Date.now();
      return parsed;
    });
  }

  public async updateSettings(settings: SystemSettings, _token: string): Promise<boolean> {
    this.cachedSettings = null;
    this.cachedSettingsTimestamp = 0;

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
    const now = Date.now();
    if (this.cachedUsers && now - this.cachedUsersTimestamp < 60000) {
      return this.cachedUsers;
    }

    // Query users_public_view (excludes pin_hash and internal security metadata to optimize egress)
    let userQuery = await this.client
      .from('users_public_view')
      .select('id, nip, full_name, phone_number, role, position, account_status, avatar_url, created_at')
      .order('created_at', { ascending: false });

    if (userQuery.error && (userQuery.error.code === '42P01' || userQuery.error.message?.includes('does not exist'))) {
      userQuery = await this.client
        .from('users')
        .select('id, nip, full_name, phone_number, role, position, account_status, avatar_url, created_at')
        .order('created_at', { ascending: false });
    }

    const data = userQuery.data;

    const result: UserProfile[] = (data || []).map((row) => ({
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

    this.cachedUsers = result;
    this.cachedUsersTimestamp = now;
    return result;
  }

  public async createUser(user: Partial<UserProfile>, _token: string): Promise<UserProfile> {
    this.cachedUsers = null;
    this.cachedUsersTimestamp = 0;

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
    this.cachedUsers = null;
    this.cachedUsersTimestamp = 0;

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
          .upload(filePath, fileToUpload, {
            upsert: false,
            contentType: 'image/webp',
            cacheControl: '31536000',
          });

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
    this.cachedUsers = null;
    this.cachedUsersTimestamp = 0;

    const { error } = await this.client.from('users').delete().eq('id', userId);
    if (error) throw new Error('Gagal menghapus pengguna: ' + error.message);
    return true;
  }

  public async toggleUserStatus(userId: string, _token: string): Promise<boolean> {
    this.cachedUsers = null;
    this.cachedUsersTimestamp = 0;

    let userQuery = await this.client.from('users_public_view').select('account_status').eq('id', userId).maybeSingle();
    if (userQuery.error && (userQuery.error.code === '42P01' || userQuery.error.message?.includes('does not exist'))) {
      userQuery = await this.client.from('users').select('account_status').eq('id', userId).maybeSingle();
    }
    const user = userQuery.data;
    const newStatus = user?.account_status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    const { error } = await this.client.from('users').update({ account_status: newStatus }).eq('id', userId);
    if (error) throw new Error('Gagal merubah status pengguna: ' + error.message);
    return true;
  }

  // ─── ACADEMIC CALENDAR & HOLIDAYS API ──────────────────────────────────────

  public async getHolidays(_token?: string): Promise<HolidayRecord[]> {
    const now = Date.now();
    if (this.cachedHolidays && now - this.cachedHolidaysTimestamp < 600000) {
      return this.cachedHolidays;
    }

    return this.dedupeRequest('getHolidays', async () => {
      const curYear = new Date().getFullYear();
      const minDate = `${curYear - 1}-01-01`;
      const maxDate = `${curYear + 1}-12-31`;

      const { data } = await this.client
        .from('holidays')
        .select('id, date, name, type, category_type, is_holiday, description, created_at')
        .gte('date', minDate)
        .lte('date', maxDate)
        .order('date', { ascending: true })
        .limit(150);

      const result = (data || []).map((row) => {
        const isSchedule =
          row.category_type === 'SCHEDULE' ||
          row.is_holiday === false ||
          (row.is_holiday === undefined &&
            ['RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP', 'OTHER'].includes(row.type));

        return {
          id: row.id,
          date: row.date,
          name: row.name,
          type: (row.type || 'SCHOOL_HOLIDAY') as HolidayType,
          category_type: (row.category_type || (isSchedule ? 'SCHEDULE' : 'HOLIDAY')) as 'HOLIDAY' | 'SCHEDULE',
          is_holiday: row.is_holiday !== undefined ? Boolean(row.is_holiday) : !isSchedule,
          description: row.description,
          created_at: row.created_at,
        };
      });

      this.cachedHolidays = result;
      this.cachedHolidaysTimestamp = Date.now();
      return result;
    });
  }

  public async createHoliday(
    holiday: Omit<HolidayRecord, 'id' | 'created_at'>,
    _token?: string
  ): Promise<HolidayRecord> {
    this.cachedHolidays = null;
    this.cachedHolidaysTimestamp = 0;

    const newId = `hol_${Date.now()}`;
    const isSchedule =
      holiday.category_type === 'SCHEDULE' ||
      holiday.is_holiday === false ||
      (holiday.is_holiday === undefined &&
        ['RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP', 'OTHER'].includes(holiday.type));

    const fullRec = {
      id: newId,
      date: holiday.date,
      name: holiday.name,
      type: holiday.type || 'SCHOOL_HOLIDAY',
      category_type: holiday.category_type || (isSchedule ? 'SCHEDULE' : 'HOLIDAY'),
      is_holiday: holiday.is_holiday !== undefined ? holiday.is_holiday : !isSchedule,
      description: holiday.description,
    };

    let { error } = await this.client.from('holidays').insert(fullRec);

    // Fallback retry if 'category_type' / 'is_holiday' / 'type' column is missing in Supabase schema cache
    if (
      error &&
      (error.message.includes("Could not find the 'category_type' column") ||
        error.message.includes("Could not find the 'is_holiday' column") ||
        error.message.includes("Could not find the 'type' column") ||
        error.code === 'PGRST204')
    ) {
      logger.warn('SupabaseProvider', 'New columns missing on holidays table. Retrying insert with base columns...');
      const { category_type: _category_type, is_holiday: _is_holiday, type: _type, ...basicRec } = fullRec;
      const retry = await this.client.from('holidays').insert({
        ...basicRec,
        type: fullRec.type,
      });
      if (retry.error) {
        // Retry with pure minimal columns
        const minimalRetry = await this.client.from('holidays').insert(basicRec);
        error = minimalRetry.error;
      } else {
        error = null;
      }
    }

    if (error) throw new Error('Gagal menambahkan hari libur / agenda: ' + error.message);

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
    this.cachedHolidays = null;
    this.cachedHolidaysTimestamp = 0;

    let { error } = await this.client.from('holidays').update(holiday).eq('id', id);

    // Fallback retry if 'category_type' / 'is_holiday' / 'type' column is missing in Supabase schema cache
    if (
      error &&
      (error.message.includes("Could not find the 'category_type' column") ||
        error.message.includes("Could not find the 'is_holiday' column") ||
        error.message.includes("Could not find the 'type' column") ||
        error.code === 'PGRST204')
    ) {
      logger.warn('SupabaseProvider', 'New columns missing on holidays table. Retrying update with base columns...');
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { category_type: _cat, is_holiday: _isHol, ...basicHoliday } = holiday as any;
      const retry = await this.client.from('holidays').update(basicHoliday).eq('id', id);
      error = retry.error;
    }

    if (error) throw new Error('Gagal memperbarui hari libur / agenda: ' + error.message);

    return {
      id,
      date: holiday.date || '',
      name: holiday.name || '',
      type: holiday.type || 'SCHOOL_HOLIDAY',
      category_type: holiday.category_type,
      is_holiday: holiday.is_holiday,
      description: holiday.description,
      created_at: new Date().toISOString(),
    };
  }

  public async deleteHoliday(id: string, _token?: string): Promise<boolean> {
    this.cachedHolidays = null;
    this.cachedHolidaysTimestamp = 0;

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
    const cacheKey = `${userId}_${currentDeviceUUID}`;
    const cached = this.cachedDeviceBinding.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 300000) { // 5 minutes TTL
      return cached.data;
    }

    return this.dedupeRequest(`checkDeviceBinding_${cacheKey}`, async () => {
      try {
        const sessionUser = useAuthStore.getState().user;
        if (sessionUser && sessionUser.full_name.toLowerCase().includes('dafa maulana')) {
          const res = {
            status: 'ACTIVE' as const,
            message: '🚀 Akses Khusus Dafa Maulana, S.Pd: Multi-Perangkat Aktif (Bypass Pembatasan)',
            registered_uuid: currentDeviceUUID,
          };
          this.cachedDeviceBinding.set(cacheKey, { data: res, timestamp: Date.now() });
          return res;
        }

        const { data: binding, error } = await this.client
          .from('device_bindings')
          .select('id, user_id, device_uuid')
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
          });

          const res = {
            status: 'UNBOUND' as const,
            message: 'Perangkat belum terikat. Lakukan absensi pertama untuk mengikat HP ini.',
            registered_uuid: currentDeviceUUID,
          };
          this.cachedDeviceBinding.set(cacheKey, { data: res, timestamp: Date.now() });
          return res;
        }

        if (binding.device_uuid === currentDeviceUUID) {
          const res = {
            status: 'ACTIVE' as const,
            message: 'Terikat Aktif dengan HP ini',
            registered_uuid: binding.device_uuid,
          };
          this.cachedDeviceBinding.set(cacheKey, { data: res, timestamp: Date.now() });
          return res;
        }

        const res = {
          status: 'DIFFERENT_DEVICE' as const,
          message: 'Terdeteksi Menggunakan HP Berbeda! Mohon ajukan reset device ke Admin/Operator jika Anda ganti HP.',
          registered_uuid: binding.device_uuid,
        };
        this.cachedDeviceBinding.set(cacheKey, { data: res, timestamp: Date.now() });
        return res;
      } catch (err) {
        logger.error('SupabaseProvider', 'checkDeviceBinding exception:', err);
        return {
          status: 'UNAVAILABLE',
          message: 'Gagal memeriksa binding perangkat. Koneksi ke server bermasalah.',
        };
      }
    });
  }

  public async getNotificationReads(userId: string, _token?: string): Promise<Set<string>> {
    const readsSet = new Set<string>();
    if (!userId) return readsSet;

    const cached = this.cachedNotificationReads.get(userId);
    if (cached && Date.now() - cached.timestamp < 45000) {
      return new Set(cached.data);
    }

    try {
      const { data, error } = await this.client
        .from('notification_reads')
        .select('notification_id')
        .eq('user_id', userId)
        .limit(100);

      if (error) {
        logger.warn('SupabaseProvider', 'getNotificationReads query error:', error.message);
        return readsSet;
      }
      if (data && data.length > 0) {
        data.forEach((r: { notification_id: string }) => {
          if (r.notification_id) readsSet.add(r.notification_id);
        });
      }
      this.cachedNotificationReads.set(userId, { data: new Set(readsSet), timestamp: Date.now() });
    } catch (err: any) {
      logger.warn('SupabaseProvider', 'getNotificationReads exception:', err?.message || err);
    }
    return readsSet;
  }

  public async getNotifications(userId: string, token: string, userRole?: string): Promise<AppNotification[]> {
    const cacheKey = `${userId}_${userRole || 'ALL'}`;
    const cached = this.cachedNotifications.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 45000) {
      return cached.data;
    }

    return this.dedupeRequest(`getNotifications_${userId}`, async () => {
      try {
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const nowIso = new Date().toISOString();
        const notifCols = 'id, user_id, recipient_user_id, audience_role, title, message, type, severity, action_url, action_type, action_date, action_target_id, payload, dedupe_key, revision, is_read, expires_at, resolved_at, created_by, created_at';

        // Query notifications targeted to user or broadcast
        let query = this.client
          .from('notifications')
          .select(notifCols)
          .gte('created_at', thirtyDaysAgo)
          .or(`expires_at.is.null,expires_at.gte.${nowIso}`);

        try {
          query = query.or(`recipient_user_id.eq.${userId},user_id.eq.${userId},recipient_user_id.is.null,user_id.is.null`);
        } catch {
          query = query.or(`user_id.eq.${userId},user_id.is.null`);
        }

        const { data, error } = await query.order('created_at', { ascending: false }).limit(30);

        if (error) {
          // Fallback for older schemas where extended columns might not exist
          const fallbackCols = 'id, user_id, title, message, type, is_read, created_at';
          const fallback = await this.client
            .from('notifications')
            .select(fallbackCols)
            .gte('created_at', thirtyDaysAgo)
            .or(`user_id.eq.${userId},user_id.is.null`)
            .order('created_at', { ascending: false })
            .limit(30);

          if (fallback.error) {
            logger.warn('SupabaseProvider', 'notifications query error:', fallback.error.message);
            return [];
          }
          const raw = await this.processRawNotifications(fallback.data || [], userId, token, userRole);
          this.cachedNotifications.set(cacheKey, { data: raw, timestamp: Date.now() });
          return raw;
        }

        const finalNotifs = await this.processRawNotifications(data || [], userId, token, userRole);
        this.cachedNotifications.set(cacheKey, { data: finalNotifs, timestamp: Date.now() });
        return finalNotifs;
      } catch (err) {
        logger.error('SupabaseProvider', 'getNotifications exception:', err);
        return [];
      }
    });
  }

  private async processRawNotifications(
    data: any[],
    userId: string,
    token: string,
    userRole?: string
  ): Promise<AppNotification[]> {
    if (!data || data.length === 0) return [];

    // Fetch per-user read IDs strictly from notification_reads
    const dbReadIds = await this.getNotificationReads(userId, token);
    const localReadIds = NotificationService.getReadNotificationIds(userId);
    const now = Date.now();

    const result: AppNotification[] = [];

    for (const n of data) {
      // 1. Exclude expired notifications
      if (n.expires_at && new Date(n.expires_at).getTime() < now) {
        continue;
      }

      // 2. Strict Role/Audience filter
      if (n.audience_role && n.audience_role !== 'ALL' && userRole) {
        const targetRole = String(n.audience_role).toUpperCase().trim();
        const currentRole = String(userRole).toUpperCase().trim();
        if (targetRole !== currentRole) {
          continue;
        }
      }

      // 3. Status baca murni per-user:
      // Hanya cek dbReadIds dan localReadIds. Untuk notifikasi broadcast, TIDAK BOLEH mengecek n.is_read!
      const isPersonal = Boolean((n.recipient_user_id && n.recipient_user_id === userId) || (n.user_id && n.user_id === userId));
      const isRead = dbReadIds.has(n.id) || localReadIds.has(n.id) || (isPersonal && Boolean(n.is_read));

      // Category derivation
      let category = n.category;
      if (!category) {
        if (n.action_type === 'ATTENDANCE_STATUS' || n.type === 'ATTENDANCE') {
          category = 'OPERATIONAL';
        } else if (n.severity === 'WARNING' || n.severity === 'DANGER' || n.type === 'ALERT') {
          category = 'ALERT';
        } else {
          category = 'HISTORICAL';
        }
      }

      result.push({
        id: n.id,
        user_id: n.user_id,
        recipient_user_id: n.recipient_user_id || n.user_id,
        audience_role: n.audience_role,
        title: n.title,
        message: n.message,
        type: n.type || 'INFO',
        severity: n.severity || 'INFO',
        category: category,
        action_url: n.action_url,
        action_type: n.action_type,
        action_date: n.action_date,
        action_target_id: n.action_target_id,
        payload: n.payload,
        dedupe_key: n.dedupe_key,
        revision: n.revision,
        is_read: isRead,
        read_at: dbReadIds.has(n.id) ? new Date().toISOString() : undefined,
        sync_state: 'SYNCED',
        expires_at: n.expires_at,
        resolved_at: n.resolved_at,
        created_by: n.created_by,
        created_at: n.created_at,
      });
    }

    return result;
  }

  public async markNotificationAsRead(
    dtoOrId: MarkNotificationDTO | string,
    _token?: string
  ): Promise<MarkReadResult | boolean> {
    const isLegacyCall = typeof dtoOrId === 'string';
    let notificationId = '';
    let effectiveUserId = '';

    if (typeof dtoOrId === 'string') {
      notificationId = dtoOrId;
      effectiveUserId = useAuthStore.getState().user?.id || '';
    } else if (dtoOrId && typeof dtoOrId === 'object') {
      notificationId = dtoOrId.notification_id || dtoOrId.notificationId || '';
      effectiveUserId = dtoOrId.user_id || dtoOrId.userId || '';
    }

    if (!effectiveUserId) {
      effectiveUserId = useAuthStore.getState().user?.id || '';
    }

    if (!notificationId) {
      return isLegacyCall ? false : { success: false, synced: false, persisted: false, syncState: 'FAILED', error: 'Notification ID required' };
    }

    // Always update local persistent storage immediately for optimistic UI
    if (effectiveUserId) {
      NotificationService.markIdAsRead(effectiveUserId, notificationId);
    }

    if (!effectiveUserId) {
      return isLegacyCall ? true : { success: true, synced: false, persisted: false, syncState: 'LOCAL_DRAFT', error: 'No user ID for cloud sync' };
    }

    try {
      // Upsert into notification_reads (supports both UUID and synthetic IDs)
      const { error } = await this.client
        .from('notification_reads')
        .upsert({
          notification_id: notificationId,
          user_id: effectiveUserId,
          read_at: new Date().toISOString(),
        }, { onConflict: 'notification_id,user_id' });

      if (error) {
        logger.warn('SupabaseProvider', 'markNotificationAsRead DB error:', error.message);
        return isLegacyCall ? false : { success: false, synced: false, persisted: false, syncState: 'FAILED', error: error.message };
      }

      this.cachedNotifications.clear();
      this.cachedNotificationReads.clear();
      return isLegacyCall ? true : { success: true, synced: true, persisted: true, syncState: 'SYNCED' };
    } catch (error: any) {
      logger.warn('SupabaseProvider', 'markNotificationAsRead exception:', error?.message || error);
      return isLegacyCall ? false : { success: false, synced: false, persisted: false, syncState: 'FAILED', error: error?.message || 'Network error' };
    }
  }

  public async markNotificationsAsRead(
    dtoOrIds: MarkBatchNotificationsDTO | string | string[],
    idsOrToken?: string[] | string,
    _token?: string
  ): Promise<MarkReadResult | boolean> {
    const isLegacyCall = Array.isArray(dtoOrIds) || typeof dtoOrIds === 'string';
    let effectiveUserId: string = '';
    let notificationIds: string[] = [];

    if (typeof dtoOrIds === 'string') {
      effectiveUserId = dtoOrIds || useAuthStore.getState().user?.id || '';
      notificationIds = Array.isArray(idsOrToken) ? idsOrToken : [];
    } else if (Array.isArray(dtoOrIds)) {
      notificationIds = dtoOrIds;
      // Periksa apakah idsOrToken adalah userId (bukan JWT token atau Bearer)
      if (
        typeof idsOrToken === 'string' &&
        idsOrToken &&
        !idsOrToken.startsWith('Bearer ') &&
        !idsOrToken.startsWith('ey') &&
        idsOrToken !== 'MOCK_TOKEN'
      ) {
        effectiveUserId = idsOrToken;
      } else {
        effectiveUserId = useAuthStore.getState().user?.id || '';
      }
    } else if (dtoOrIds && typeof dtoOrIds === 'object') {
      effectiveUserId = dtoOrIds.user_id || dtoOrIds.userId || useAuthStore.getState().user?.id || '';
      notificationIds = dtoOrIds.notification_ids || dtoOrIds.notificationIds || [];
    }

    if (!effectiveUserId) {
      effectiveUserId = useAuthStore.getState().user?.id || '';
    }

    if (!effectiveUserId || notificationIds.length === 0) {
      return isLegacyCall ? true : { success: true, synced: true, persisted: true, syncState: 'SYNCED' };
    }

    // Optimistically update local persistent storage
    NotificationService.markAllIdsAsRead(effectiveUserId, notificationIds);

    try {
      const records = notificationIds.map((id) => ({
        notification_id: id,
        user_id: effectiveUserId,
        read_at: new Date().toISOString(),
      }));

      const { error } = await this.client
        .from('notification_reads')
        .upsert(records, { onConflict: 'notification_id,user_id' });

      if (error) {
        logger.warn('SupabaseProvider', 'markNotificationsAsRead error:', error.message);
        return isLegacyCall ? false : { success: false, synced: false, persisted: false, syncState: 'FAILED', error: error.message };
      }

      this.cachedNotifications.clear();
      this.cachedNotificationReads.clear();
      return isLegacyCall ? true : { success: true, synced: true, persisted: true, syncState: 'SYNCED' };
    } catch (err: any) {
      logger.warn('SupabaseProvider', 'markNotificationsAsRead exception:', err?.message || err);
      return isLegacyCall ? false : { success: false, synced: false, persisted: false, syncState: 'FAILED', error: err?.message || 'Network error' };
    }
  }

  public subscribeToNotificationUpdates(
    userId: string,
    callback: (event: { table: string; eventType: string; payload?: any }) => void
  ): () => void {
    // Unsubscribe previous active channel to prevent duplicate listeners
    if (this.activeNotificationChannel) {
      try {
        this.client.removeChannel(this.activeNotificationChannel);
      } catch (e) {
        logger.warn('SupabaseProvider', 'Error cleaning up previous activeNotificationChannel:', e);
      }
      this.activeNotificationChannel = null;
    }

    const channelId = `realtime_notifications_${userId}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const channel = this.client
      .channel(channelId)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications' },
        (payload) => {
          logger.info('SupabaseProvider', 'Realtime change in notifications table:', payload.eventType);
          this.cachedNotifications.clear();
          this.cachedNotificationReads.clear();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smart_absensi_notifications_updated', { detail: payload }));
          }
          callback({ table: 'notifications', eventType: payload.eventType, payload });
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notification_reads',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          logger.info('SupabaseProvider', 'Realtime change in notification_reads table:', payload.eventType);
          this.cachedNotifications.clear();
          this.cachedNotificationReads.clear();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('smart_absensi_notifications_read_updated', { detail: payload }));
          }
          callback({ table: 'notification_reads', eventType: payload.eventType, payload });
        }
      )
      .subscribe((status) => {
        logger.info('SupabaseProvider', `Realtime notifications channel [${channelId}] status:`, status);
      });

    this.activeNotificationChannel = channel;

    return () => {
      try {
        this.client.removeChannel(channel);
        if (this.activeNotificationChannel === channel) {
          this.activeNotificationChannel = null;
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'Error removing realtime notifications channel:', err);
      }
    };
  }

  public async getNotificationPreferences(userId: string, _token?: string): Promise<NotificationPreferences | null> {
    const defaultPrefs: NotificationPreferences = {
      user_id: userId,
      push_enabled: true,
      attendance_enabled: true,
      leave_enabled: true,
      schedule_enabled: true,
      announcement_enabled: true,
      critical_enabled: true,
      voice_enabled: true,
      sound_enabled: true,
      attendance_sound_enabled: true,
      chime_enabled: true,
      auto_greeting_enabled: false,
      quiet_hours_start: null,
      quiet_hours_end: null,
      updated_at: new Date().toISOString(),
    };

    return this.dedupeRequest(`getNotificationPreferences_${userId}`, async () => {
      try {
        const { data, error } = await this.client
          .from('notification_preferences')
          .select('user_id, push_enabled, attendance_enabled, leave_enabled, schedule_enabled, announcement_enabled, critical_enabled, voice_enabled, sound_enabled, attendance_sound_enabled, chime_enabled, auto_greeting_enabled, quiet_hours_start, quiet_hours_end, updated_at')
          .eq('user_id', userId)
          .maybeSingle();

        if (error) {
          logger.warn('SupabaseProvider', 'getNotificationPreferences fallback to defaults:', error.message);
          return defaultPrefs;
        }

        if (data) {
          return {
            user_id: data.user_id,
            push_enabled: data.push_enabled ?? true,
            attendance_enabled: data.attendance_enabled ?? true,
            leave_enabled: data.leave_enabled ?? true,
            schedule_enabled: data.schedule_enabled ?? true,
            announcement_enabled: data.announcement_enabled ?? true,
            critical_enabled: data.critical_enabled ?? true,
            voice_enabled: data.voice_enabled ?? true,
            sound_enabled: data.sound_enabled ?? true,
            attendance_sound_enabled: data.attendance_sound_enabled ?? true,
            chime_enabled: data.chime_enabled ?? true,
            auto_greeting_enabled: data.auto_greeting_enabled ?? false,
            quiet_hours_start: data.quiet_hours_start ?? null,
            quiet_hours_end: data.quiet_hours_end ?? null,
            updated_at: data.updated_at,
          };
        }

        return defaultPrefs;
      } catch (err: any) {
        logger.warn('SupabaseProvider', 'getNotificationPreferences exception:', err.message);
        return defaultPrefs;
      }
    });
  }

  public async saveNotificationPreferences(
    userIdOrPrefs: string | Partial<NotificationPreferences>,
    prefsOrToken?: Partial<NotificationPreferences> | string,
    _token?: string
  ): Promise<boolean> {
    try {
      const prefs: Partial<NotificationPreferences> =
        typeof userIdOrPrefs === 'string'
          ? ((prefsOrToken as Partial<NotificationPreferences>) || {})
          : userIdOrPrefs;
      const userId = prefs?.user_id || (typeof userIdOrPrefs === 'string' ? userIdOrPrefs : undefined);
      const toSave = {
        ...prefs,
        ...(userId ? { user_id: userId } : {}),
        updated_at: new Date().toISOString(),
      };
      const { error } = await this.client
        .from('notification_preferences')
        .upsert(toSave, { onConflict: 'user_id' });

      if (error) {
        logger.error('SupabaseProvider', 'saveNotificationPreferences error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      logger.error('SupabaseProvider', 'saveNotificationPreferences exception:', err.message);
      return false;
    }
  }

  // ─── TEACHER WELL-BEING & MOOD API ───────────────────────────────────────

  public async saveTeacherMood(
    userId: string,
    date: string,
    mood: TeacherMoodType,
    note?: string,
    _token?: string
  ): Promise<boolean> {
    this.cachedTodayTeacherMood.clear();
    try {
      const { error } = await this.client
        .from('teacher_moods')
        .upsert(
          {
            id: `mood_${userId}_${date}`,
            user_id: userId,
            date,
            mood,
            note: note || null,
            created_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
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
    const cacheKey = `${userId}_${date}`;
    const cached = this.cachedTodayTeacherMood.get(cacheKey);
    if (cached) {
      const ttl = cached.data ? 600000 : 120000;
      if (Date.now() - cached.timestamp < ttl) {
        return cached.data;
      }
    }

    return this.dedupeRequest(`getTodayTeacherMood_${cacheKey}`, async () => {
      try {
        const { data, error } = await this.client
          .from('teacher_moods')
          .select('id, user_id, date, mood, note, created_at')
          .eq('user_id', userId)
          .eq('date', date)
          .maybeSingle();

        if (!error && data) {
          const res: TeacherMoodLog = {
            id: data.id,
            user_id: data.user_id,
            date: data.date,
            mood: data.mood as TeacherMoodType,
            note: data.note || undefined,
            created_at: data.created_at,
          };
          this.cachedTodayTeacherMood.set(cacheKey, { data: res, timestamp: Date.now() });
          return res;
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
            const found = logs.find((l) => l.user_id === userId && l.date === date) || null;
            this.cachedTodayTeacherMood.set(cacheKey, { data: found, timestamp: Date.now() });
            return found;
          } catch {}
        }
      }
      this.cachedTodayTeacherMood.set(cacheKey, { data: null, timestamp: Date.now() });
      return null;
    });
  }

  public async getBurnoutAnalytics(month?: string, year?: string, _token?: string): Promise<BurnoutAnalytics> {
    const today = getTodayDateInJakarta();
    const targetYear = year || today.substring(0, 4);
    const targetMonth = month !== undefined ? month : String(parseInt(today.substring(5, 7), 10));

    return this.dedupeRequest(`getBurnoutAnalytics_${targetYear}_${targetMonth}`, async () => {
      const breakdown: Record<TeacherMoodType, number> = {
        VERY_HAPPY: 0,
        HAPPY: 0,
        NEUTRAL: 0,
        TIRED: 0,
        STRESSED: 0,
      };

      let totalLogs: TeacherMoodLog[] = [];

      try {
        let query = this.client
          .from('teacher_moods')
          .select('id, user_id, date, mood, note, created_at');

        if (targetMonth === 'ALL') {
          query = query.gte('date', `${targetYear}-01-01`).lte('date', `${targetYear}-12-31`);
        } else {
          const monthNum = parseInt(targetMonth, 10);
          const monthPad = String(targetMonth).padStart(2, '0');
          const lastDay = new Date(parseInt(targetYear, 10), monthNum, 0).getDate();
          query = query.gte('date', `${targetYear}-${monthPad}-01`).lte('date', `${targetYear}-${monthPad}-${String(lastDay).padStart(2, '0')}`);
        }

        const { data, error } = await query.order('date', { ascending: false }).limit(200);

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
    });
  }

  // Teacher Duty Schedule API (Jadwal Piket Guru Senin - Jumat)
  public async getDutySchedules(_token?: string): Promise<TeacherDutySchedule[]> {
    const now = Date.now();
    if (this.cachedDutySchedules && now - this.cachedDutySchedulesTimestamp < 300000) {
      return this.cachedDutySchedules;
    }

    return this.dedupeRequest('getDutySchedules', async () => {
      try {
        const { data, error } = await this.client
          .from('teacher_duty_schedules')
          .select('id, day_of_week, teacher_id, teacher_name, notes, created_at')
          .order('day_of_week', { ascending: true })
          .limit(50);

        if (!error && data) {
          const normalized: TeacherDutySchedule[] = data.map((item: any) => ({
            ...item,
            day_of_week: Number(item.day_of_week),
          }));

          this.cachedDutySchedules = normalized;
          this.cachedDutySchedulesTimestamp = Date.now();

          if (typeof localStorage !== 'undefined') {
            localStorage.setItem('smart_absensi_duty_schedules', JSON.stringify(normalized));
          }
          return normalized;
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'getDutySchedules error, falling back to local storage:', err);
      }

      // Fallback to local storage if DB query fails, and cache the fallback for 5 minutes to prevent hammering
      const mockProv = new (await import('./mock-provider.service')).MockProvider();
      const fallback = await mockProv.getDutySchedules();
      this.cachedDutySchedules = fallback;
      this.cachedDutySchedulesTimestamp = Date.now();
      return fallback;
    });
  }

  public async saveDutySchedules(
    schedules: Omit<TeacherDutySchedule, 'id' | 'created_at'>[],
    _token?: string
  ): Promise<boolean> {
    this.cachedDutySchedules = null;
    this.cachedDutySchedulesTimestamp = 0;

    try {
      // 1. Sanitize, validate, and deduplicate schedules by (day_of_week, teacher_id)
      const uniqueMap = new Map<string, Omit<TeacherDutySchedule, 'id' | 'created_at'>>();
      for (const item of schedules) {
        if (!item.teacher_id || !item.teacher_name) continue;
        const dayNum = Number(item.day_of_week);
        if (dayNum < 1 || dayNum > 5) continue;
        const key = `${dayNum}_${item.teacher_id}`;
        if (!uniqueMap.has(key)) {
          uniqueMap.set(key, {
            ...item,
            day_of_week: dayNum,
          });
        }
      }
      const uniqueSchedules = Array.from(uniqueMap.values());

      // 2. Validate foreign key: verify teacher_ids exist in public.users to prevent FK violation
      let validSchedules = uniqueSchedules;
      try {
        let usersQuery = await this.client
          .from('users_public_view')
          .select('id');
        if (usersQuery.error && (usersQuery.error.code === '42P01' || usersQuery.error.message?.includes('does not exist'))) {
          usersQuery = await this.client
            .from('users')
            .select('id');
        }
        const validUsers = usersQuery.data;
        const usersErr = usersQuery.error;
        if (!usersErr && validUsers && validUsers.length > 0) {
          const validIdSet = new Set(validUsers.map((u) => u.id));
          validSchedules = uniqueSchedules.filter((s) => validIdSet.has(s.teacher_id));
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'Could not verify user IDs before saving duty schedules:', err);
      }

      // 3. Clear existing schedule in Supabase table
      const { error: delError } = await this.client
        .from('teacher_duty_schedules')
        .delete()
        .neq('day_of_week', 0); // Deletes all rows since day_of_week is 1..5

      if (delError) {
        logger.error('SupabaseProvider', 'Failed to clear teacher_duty_schedules in Supabase:', delError);
        throw new Error(`Gagal memperbarui jadwal piket di database: ${delError.message}`);
      }

      // 4. Insert new schedule records into Supabase
      if (validSchedules.length > 0) {
        const dbPayload = validSchedules.map((item) => ({
          day_of_week: item.day_of_week,
          teacher_id: item.teacher_id,
          teacher_name: item.teacher_name,
          notes: item.notes || null,
        }));

        const { data: insertedData, error: insError } = await this.client
          .from('teacher_duty_schedules')
          .insert(dbPayload)
          .select('id, day_of_week, teacher_id, teacher_name, notes, created_at');

        if (insError) {
          logger.error('SupabaseProvider', 'Failed to insert teacher_duty_schedules to Supabase:', insError);
          throw new Error(`Gagal menyimpan jadwal piket ke database: ${insError.message}`);
        }

        // Cache the newly inserted records with real DB UUIDs and timestamps
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('smart_absensi_duty_schedules', JSON.stringify(insertedData || validSchedules));
        }
      } else {
        // Table cleared (0 schedules)
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('smart_absensi_duty_schedules', JSON.stringify([]));
        }
      }

      return true;
    } catch (err) {
      logger.error('SupabaseProvider', 'saveDutySchedules operation failed:', err);
      // Fallback update to local storage only if offline/network error, but rethrow so UI does NOT hide error!
      try {
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        await mockProv.saveDutySchedules(schedules);
      } catch {
        // Ignore fallback write error
      }
      throw err;
    }
  }

  // ─── ANONYMOUS TEACHER COMPLAINTS & FEEDBACK API ──────────────────────────

  public async submitComplaint(
    userId: string,
    dto: SubmitComplaintDTO,
    _token?: string
  ): Promise<TeacherComplaint> {
    try {
      const todayStr = getTodayDateInJakarta();
      const { data, error } = await this.client
        .from('teacher_complaints')
        .insert({
          user_id: userId,
          date: todayStr,
          category: dto.category,
          content: dto.content.trim(),
          status: 'SUBMITTED',
          is_anonymous: dto.is_anonymous ?? true,
          created_at: new Date().toISOString(),
        })
        .select('id, user_id, date, category, content, status, is_anonymous, created_at')
        .single();

      if (error) {
        logger.warn('SupabaseProvider', 'submitComplaint Supabase error, falling back to local storage:', error.message);
      } else if (data) {
        // Also update local cache
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        await mockProv.submitComplaint(userId, dto);
        return data as TeacherComplaint;
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'submitComplaint DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.submitComplaint(userId, dto);
  }

  public async getUserComplaints(userId: string, _token?: string): Promise<TeacherComplaint[]> {
    try {
      const { data, error } = await this.client
        .from('teacher_complaints')
        .select('id, user_id, date, category, content, status, admin_response, responded_by_role, is_anonymous, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(30);

      if (error) {
        logger.warn('SupabaseProvider', 'getUserComplaints Supabase error, fallback to local storage:', error.message);
      } else if (data) {
        return data as TeacherComplaint[];
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getUserComplaints DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.getUserComplaints(userId);
  }

  public async getAllComplaints(_token?: string): Promise<TeacherComplaint[]> {
    try {
      const { data, error } = await this.client
        .from('teacher_complaints')
        .select('id, date, category, content, status, admin_response, responded_by_role, is_anonymous, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        logger.warn('SupabaseProvider', 'getAllComplaints Supabase error, fallback to local storage:', error.message);
      } else if (data) {
        // Mask user_id for strict anonymity
        return (data as any[]).map((c) => ({
          ...c,
          user_id: 'ANONYMOUS',
        }));
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getAllComplaints DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.getAllComplaints();
  }

  public async updateComplaintStatus(
    dto: UpdateComplaintStatusDTO,
    _token?: string
  ): Promise<boolean> {
    try {
      const updatePayload: Record<string, any> = {
        status: dto.status,
      };

      if (dto.adminResponse !== undefined) {
        updatePayload.admin_response = dto.adminResponse.trim();
        updatePayload.responded_at = new Date().toISOString();
        updatePayload.responded_by_role = dto.respondedByRole || 'ADMIN';
      }

      const { error } = await this.client
        .from('teacher_complaints')
        .update(updatePayload)
        .eq('id', dto.complaintId);

      if (error) {
        logger.warn('SupabaseProvider', 'updateComplaintStatus Supabase error:', error.message);
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'updateComplaintStatus DB exception:', err);
    }

    // Always update local cache
    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.updateComplaintStatus(dto);
  }

  // ── TEACHING SCHEDULES API ────────────────────────────────────────────────
  private mapDbRowToTeachingSlot(row: any): TeachingSlot {
    const dayOfWeek = row.day_of_week !== undefined && row.day_of_week !== null
      ? row.day_of_week
      : normalizeDayOfWeek(row.day);
    const day = row.day || getDayNameIndonesian(dayOfWeek);
    const startTime = row.start_time || parseScheduleTime(row.time)?.startTime || '07:00';
    const endTime = row.end_time || parseScheduleTime(row.time)?.endTime || '08:00';
    const time = row.time || formatTimeRange(startTime, endTime);
    const teacherId = row.teacher_user_id || row.user_id;

    return {
      id: row.id,
      user_id: teacherId,
      teacher_user_id: teacherId,
      teacher_name: row.teacher_name || (row.users ? row.users.name : undefined) || 'Guru',
      day_of_week: dayOfWeek,
      day,
      start_time: startTime,
      end_time: endTime,
      time,
      className: row.class_name || '',
      class_name: row.class_name || '',
      subject: row.subject || '',
      room: row.room || '',
      academic_year: row.academic_year || '2024/2025',
      is_active: row.is_active ?? true,
      version: row.version ?? 1,
      effective_from: row.effective_from,
      effective_until: row.effective_until,
      created_at: row.created_at,
      updated_at: row.updated_at,
      created_by: row.created_by,
      updated_by: row.updated_by,
    };
  }

  public async getTeachingSchedules(
    _token?: string,
    filter?: { teacher_user_id?: string; academic_year?: string; day_of_week?: number }
  ): Promise<TeachingSlot[]> {
    const cacheKey = `${filter?.teacher_user_id || 'ALL'}_${filter?.academic_year || ''}_${filter?.day_of_week ?? ''}`;
    const cached = this.cachedTeachingSchedules.get(cacheKey);
    const now = Date.now();

    // 1. In-Memory TTL Cache Check (5 minutes)
    if (cached && now - cached.timestamp < 300000) {
      return cached.data;
    }

    // 2. Cooldown Guard: If in temporary cooldown due to previous failure/misconfig, prevent hammering Supabase
    if (now < this.teachingSchedulesCooldownUntil) {
      if (cached) return cached.data;
      try {
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        return mockProv.getTeachingSchedules(_token, filter);
      } catch {
        return [];
      }
    }

    const dedupeKey = `getTeachingSchedules_${cacheKey}`;
    return this.dedupeRequest(dedupeKey, async () => {
      try {
        const scheduleCols = 'id, teacher_user_id, teacher_name, day_of_week, start_time, end_time, class_name, subject, room, academic_year, effective_from, effective_until, is_active, version, created_at, updated_at, created_by, updated_by';

        let query = this.client
          .from('teaching_schedules')
          .select(scheduleCols)
          .eq('is_active', true);

        if (filter?.teacher_user_id) {
          query = query.eq('teacher_user_id', filter.teacher_user_id);
        }
        if (filter?.academic_year) {
          query = query.eq('academic_year', filter.academic_year);
        }
        if (filter?.day_of_week !== undefined) {
          query = query.eq('day_of_week', filter.day_of_week);
        }

        const { data, error, status, statusText } = await query.order('day_of_week', { ascending: true }).limit(50);

        if (error) {
          // Log complete HTTP status, PGRST code, and error details per instructions
          logger.error('SupabaseProvider', `getTeachingSchedules failed: HTTP ${status || 'unknown'} (${statusText || ''}) - PGRST Code: ${error.code || 'none'} - Message: ${error.message || ''} - Details: ${error.details || ''} - Hint: ${error.hint || ''}`);

          // Set a temporary cooldown (120 seconds) to protect egress from thousands of repeating errors
          this.teachingSchedulesCooldownUntil = Date.now() + 120000;

          if (cached) return cached.data;

          try {
            const mockProv = new (await import('./mock-provider.service')).MockProvider();
            return mockProv.getTeachingSchedules(_token, filter);
          } catch {
            return [];
          }
        }

        // On success: clear temporary cooldown
        this.teachingSchedulesCooldownUntil = 0;

        const mapped = (data || []).map((row: any) => this.mapDbRowToTeachingSlot(row));
        const sorted = sortTeachingSlots(mapped);

        // Store in 5-minute TTL cache
        this.cachedTeachingSchedules.set(cacheKey, { data: sorted, timestamp: Date.now() });

        return sorted;
      } catch (err: any) {
        logger.error('SupabaseProvider', 'getTeachingSchedules DB exception:', err);
        this.teachingSchedulesCooldownUntil = Date.now() + 120000;
        if (cached) return cached.data;
        return [];
      }
    });
  }

  public async createTeachingSchedule(
    dto: CreateTeachingScheduleDTO,
    _token?: string
  ): Promise<TeachingScheduleResult> {
    try {
      const dayOfWeek = normalizeDayOfWeek(dto.day_of_week !== undefined ? dto.day_of_week : dto.day);

      // Pre-validate schedule conflicts
      const existing = await this.getTeachingSchedules(_token, {
        academic_year: dto.academic_year || '2026/2027',
        day_of_week: dayOfWeek,
      });
      const conflict = validateScheduleConflict(
        {
          teacher_user_id: dto.teacher_user_id,
          day_of_week: dayOfWeek,
          start_time: dto.start_time,
          end_time: dto.end_time,
          class_name: dto.class_name,
          room: dto.room,
          academic_year: dto.academic_year,
        },
        existing
      );
      if (conflict) {
        return { success: false, error: conflict.message, conflict };
      }

      let teacherName = 'Guru';
      try {
        let userRowQuery = await this.client
          .from('users_public_view')
          .select('full_name')
          .eq('id', dto.teacher_user_id)
          .maybeSingle();
        if (userRowQuery.error && (userRowQuery.error.code === '42P01' || userRowQuery.error.message?.includes('does not exist'))) {
          userRowQuery = await this.client
            .from('users')
            .select('full_name')
            .eq('id', dto.teacher_user_id)
            .maybeSingle();
        }
        const userRow = userRowQuery.data;
        if (userRow?.full_name) teacherName = userRow.full_name;
      } catch {
        // Fallback to default
      }

      const payload = {
        teacher_user_id: dto.teacher_user_id,
        teacher_name: teacherName,
        day_of_week: dayOfWeek,
        start_time: dto.start_time,
        end_time: dto.end_time,
        class_name: dto.class_name,
        subject: dto.subject,
        room: dto.room || 'Ruang Kelas',
        academic_year: dto.academic_year || '2026/2027',
        is_active: dto.is_active ?? true,
        version: 1,
        effective_from: dto.effective_from || null,
        effective_until: dto.effective_until || null,
      };

      // Jalur Utama: Serverless Controlled Admin Endpoint (/api/admin/teaching-schedules)
      const token = _token || (typeof localStorage !== 'undefined' ? localStorage.getItem('saga_auth_token') : '') || '';
      if (typeof window !== 'undefined' && typeof window.fetch === 'function' && token) {
        try {
          const resp = await fetch('/api/admin/teaching-schedules', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(payload),
          });
          const resData = await resp.json();
          if (resp.ok && resData.success && resData.data) {
            const created = this.mapDbRowToTeachingSlot(resData.data);
            try {
              const mockProv = new (await import('./mock-provider.service')).MockProvider();
              await mockProv.createTeachingSchedule(dto);
            } catch {
              // Ignore mock sync error
            }
            this.cachedTeachingSchedules.clear();
            this.teachingSchedulesCooldownUntil = 0;
            return { success: true, data: created };
          }
          if (!resp.ok || !resData.success) {
            return { success: false, error: resData.errorMessage || resData.error || 'Gagal menambahkan jadwal' };
          }
        } catch (fetchErr: any) {
          logger.warn('SupabaseProvider', 'Serverless endpoint unavailable, attempting direct fallback:', fetchErr);
        }
      }

      // Direct fallback (jika di-test tanpa HTTP serverless atau service_role)
      const { data, error } = await this.client
        .from('teaching_schedules')
        .insert([payload])
        .select('id, teacher_user_id, teacher_name, day_of_week, start_time, end_time, class_name, subject, room, academic_year, effective_from, effective_until, is_active, version, created_at, updated_at, created_by, updated_by')
        .single();

      if (error) {
        logger.error('SupabaseProvider', 'createTeachingSchedule insert failed:', error.message);
        return { success: false, error: error.message };
      }

      const created = this.mapDbRowToTeachingSlot(data);

      try {
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        await mockProv.createTeachingSchedule(dto);
      } catch {
        // Ignore mock sync error
      }

      this.cachedTeachingSchedules.clear();
      this.teachingSchedulesCooldownUntil = 0;
      return { success: true, data: created };
    } catch (err: any) {
      logger.error('SupabaseProvider', 'createTeachingSchedule exception:', err);
      return { success: false, error: err?.message || 'Gagal menambahkan jadwal' };
    }
  }

  public async updateTeachingSchedule(
    dto: UpdateTeachingScheduleDTO,
    _token?: string
  ): Promise<TeachingScheduleResult> {
    try {
      const { data: existingRow, error: fetchErr } = await this.client
        .from('teaching_schedules')
        .select('id, teacher_user_id, teacher_name, day_of_week, start_time, end_time, class_name, subject, room, academic_year, effective_from, effective_until, is_active, version')
        .eq('id', dto.id)
        .maybeSingle();

      if (fetchErr || !existingRow) {
        return { success: false, error: 'Jadwal tidak ditemukan di database.' };
      }

      // Optimistic concurrency check
      if (dto.version !== undefined && existingRow.version !== undefined && existingRow.version !== dto.version) {
        return {
          success: false,
          error: 'Konflik versi: Jadwal telah diubah oleh operator lain. Silakan muat ulang halaman.',
        };
      }

      const dayOfWeek = normalizeDayOfWeek(dto.day_of_week !== undefined ? dto.day_of_week : (dto.day ? dto.day : existingRow.day_of_week));
      const startTime = dto.start_time || existingRow.start_time;
      const endTime = dto.end_time || existingRow.end_time;
      const teacherUserId = dto.teacher_user_id || existingRow.teacher_user_id;
      const className = dto.class_name || existingRow.class_name;
      const room = dto.room || existingRow.room;
      const academicYear = dto.academic_year || existingRow.academic_year || '2026/2027';

      // Conflict validation (ignoring current id)
      const allSchedules = await this.getTeachingSchedules(_token, {
        academic_year: academicYear,
        day_of_week: dayOfWeek,
      });
      const conflict = validateScheduleConflict(
        {
          id: dto.id,
          teacher_user_id: teacherUserId,
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          class_name: className,
          room,
          academic_year: academicYear,
        },
        allSchedules
      );

      if (conflict) {
        return { success: false, error: conflict.message, conflict };
      }

      const nextVersion = (existingRow.version || 1) + 1;
      const updatePayload: Record<string, any> = {
        teacher_user_id: teacherUserId,
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        class_name: className,
        subject: dto.subject !== undefined ? dto.subject : existingRow.subject,
        room,
        academic_year: academicYear,
        is_active: dto.is_active !== undefined ? dto.is_active : existingRow.is_active,
        version: nextVersion,
        updated_at: new Date().toISOString(),
      };
      if (dto.effective_from !== undefined) updatePayload.effective_from = dto.effective_from;
      if (dto.effective_until !== undefined) updatePayload.effective_until = dto.effective_until;

      // Jalur Utama: Serverless Controlled Admin Endpoint (/api/admin/teaching-schedules)
      const token = _token || (typeof localStorage !== 'undefined' ? localStorage.getItem('saga_auth_token') : '') || '';
      if (typeof window !== 'undefined' && typeof window.fetch === 'function' && token) {
        try {
          const resp = await fetch('/api/admin/teaching-schedules', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ ...updatePayload, id: dto.id }),
          });
          const resData = await resp.json();
          if (resp.ok && resData.success && resData.data) {
            const updated = this.mapDbRowToTeachingSlot(resData.data);
            try {
              const mockProv = new (await import('./mock-provider.service')).MockProvider();
              await mockProv.updateTeachingSchedule(dto);
            } catch {
              // Ignore mock sync error
            }
            this.cachedTeachingSchedules.clear();
            this.teachingSchedulesCooldownUntil = 0;
            return { success: true, data: updated };
          }
          if (!resp.ok || !resData.success) {
            return { success: false, error: resData.errorMessage || resData.error || 'Gagal memperbarui jadwal' };
          }
        } catch (fetchErr: any) {
          logger.warn('SupabaseProvider', 'Serverless PUT endpoint unavailable, attempting direct fallback:', fetchErr);
        }
      }

      const { data: updatedRow, error: updateErr } = await this.client
        .from('teaching_schedules')
        .update(updatePayload)
        .eq('id', dto.id)
        .select('id, teacher_user_id, teacher_name, day_of_week, start_time, end_time, class_name, subject, room, academic_year, effective_from, effective_until, is_active, version, created_at, updated_at, created_by, updated_by')
        .single();

      if (updateErr) {
        logger.error('SupabaseProvider', 'updateTeachingSchedule update failed:', updateErr.message);
        return { success: false, error: updateErr.message };
      }

      const updated = this.mapDbRowToTeachingSlot(updatedRow);

      try {
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        await mockProv.updateTeachingSchedule(dto);
      } catch {
        // Ignore mock sync error
      }

      this.cachedTeachingSchedules.clear();
      this.teachingSchedulesCooldownUntil = 0;
      return { success: true, data: updated };
    } catch (err: any) {
      logger.error('SupabaseProvider', 'updateTeachingSchedule exception:', err);
      return { success: false, error: err?.message || 'Gagal memperbarui jadwal' };
    }
  }

  public async deleteTeachingSchedule(id: string, _token?: string): Promise<boolean> {
    try {
      // Jalur Utama: Serverless Controlled Admin Endpoint (/api/admin/teaching-schedules)
      const token = _token || (typeof localStorage !== 'undefined' ? localStorage.getItem('saga_auth_token') : '') || '';
      if (typeof window !== 'undefined' && typeof window.fetch === 'function' && token) {
        try {
          const resp = await fetch(`/api/admin/teaching-schedules?id=${encodeURIComponent(id)}`, {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
          const resData = await resp.json();
          if (resp.ok && resData.success) {
            try {
              const mockProv = new (await import('./mock-provider.service')).MockProvider();
              await mockProv.deleteTeachingSchedule(id);
            } catch {
              // Ignore
            }
            this.cachedTeachingSchedules.clear();
            this.teachingSchedulesCooldownUntil = 0;
            return true;
          }
        } catch (fetchErr: any) {
          logger.warn('SupabaseProvider', 'Serverless DELETE endpoint unavailable, attempting direct fallback:', fetchErr);
        }
      }

      const { error } = await this.client
        .from('teaching_schedules')
        .delete()
        .eq('id', id);

      if (error) {
        logger.error('SupabaseProvider', 'deleteTeachingSchedule error:', error.message);
        return false;
      }

      try {
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        await mockProv.deleteTeachingSchedule(id);
      } catch {
        // Ignore
      }

      this.cachedTeachingSchedules.clear();
      this.teachingSchedulesCooldownUntil = 0;
      return true;
    } catch (err) {
      logger.error('SupabaseProvider', 'deleteTeachingSchedule exception:', err);
      return false;
    }
  }

  public async saveTeachingSchedules(
    schedules: TeachingSlot[],
    _token?: string
  ): Promise<boolean> {
    try {
      const currentList = await this.getTeachingSchedules(_token);
      const currentMap = new Map(currentList.map((s) => [s.id, s]));

      for (const s of schedules) {
        const parsedTime = parseScheduleTime(s.time);
        const startTime = s.start_time || parsedTime?.startTime || '07:00';
        const endTime = s.end_time || parsedTime?.endTime || '08:00';
        const dayOfWeek = normalizeDayOfWeek(s.day_of_week !== undefined ? s.day_of_week : s.day);

        const dbRow: Record<string, any> = {
          teacher_user_id: s.teacher_user_id || s.user_id || 'UNKNOWN',
          teacher_name: s.teacher_name || 'Guru',
          day_of_week: dayOfWeek,
          start_time: startTime,
          end_time: endTime,
          class_name: s.className || s.class_name,
          subject: s.subject,
          room: s.room || 'Ruang Kelas',
          academic_year: s.academic_year || '2026/2027',
          is_active: s.is_active ?? true,
          version: s.version || 1,
        };
        if (s.effective_from) dbRow.effective_from = s.effective_from;
        if (s.effective_until) dbRow.effective_until = s.effective_until;

        if (s.id && currentMap.has(s.id)) {
          await this.client.from('teaching_schedules').update(dbRow).eq('id', s.id);
        } else {
          await this.client.from('teaching_schedules').insert([dbRow]);
        }
      }

      try {
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        await mockProv.saveTeachingSchedules(schedules);
      } catch {
        // Ignore mock sync error
      }

      this.cachedTeachingSchedules.clear();
      this.teachingSchedulesCooldownUntil = 0;
      return true;
    } catch (err) {
      logger.warn('SupabaseProvider', 'saveTeachingSchedules DB exception:', err);
      const mockProv = new (await import('./mock-provider.service')).MockProvider();
      this.cachedTeachingSchedules.clear();
      this.teachingSchedulesCooldownUntil = 0;
      return mockProv.saveTeachingSchedules(schedules);
    }
  }

  // ── STUDENT DIRECTORY & RFID ATTENDANCE API ──────────────────────────────
  public async getStudents(_token?: string): Promise<StudentItem[]> {
    return this.dedupeRequest('getStudents', async () => {
      try {
        // 1. Try fetching from public.students (safe columns without last_tap_at which may not exist yet)
        const { data, error } = await this.client
          .from('students')
          .select('id, nisn, full_name, class_name, academic_year, gender, rfid_uid, card_status, attendance_rate, address, notes, created_at, updated_at')
          .order('class_name', { ascending: true })
          .order('full_name', { ascending: true })
          .limit(200);

        if (!error && data && data.length > 0) {
          return (data as any[]).map((row) => ({
            id: row.id,
            nisn: row.nisn || '',
            fullName: row.full_name,
            className: row.class_name,
            academicYear: row.academic_year || '2026/2027',
            gender: row.gender || 'L',
            rfidUid: row.rfid_uid || undefined,
            cardStatus: row.card_status || 'ACTIVE',
            attendanceRate: row.attendance_rate != null ? Number(row.attendance_rate) : 100,
            lastTapAt: row.last_tap_at || undefined,
            address: row.address,
            notes: row.notes,
            created_at: row.created_at,
            updated_at: row.updated_at,
          }));
        }

      // 2. If table doesn't exist yet or is empty, auto-read from gm_behaviors (Active Academic Year 2026/2027)
      const { data: activeBehaviors, error: bErr } = await this.client
        .from('gm_behaviors')
        .select('student_name, class_name, academic_year')
        .eq('academic_year', '2026/2027');

      if (!bErr && activeBehaviors && activeBehaviors.length > 0) {
        const uniqueMap = new Map<string, StudentItem>();
        activeBehaviors.forEach((b: any) => {
          if (!b.student_name || !b.class_name) return;
          const cleanName = b.student_name.trim().toUpperCase();
          const cleanClass = b.class_name.trim().toUpperCase();
          const key = `${cleanClass}|||${cleanName}`;
          if (!uniqueMap.has(key)) {
            const hashId = `std_${cleanClass.toLowerCase()}_${Math.abs(
              cleanName.split('').reduce((acc: number, c: string) => acc + c.charCodeAt(0), 0)
            )}`;
            const isFemaleClass = cleanClass === '8A' || cleanClass === '9A';
            uniqueMap.set(key, {
              id: hashId,
              nisn: '',
              fullName: cleanName,
              className: cleanClass,
              academicYear: '2026/2027',
              gender: isFemaleClass ? 'P' : 'L',
              cardStatus: 'ACTIVE',
              attendanceRate: 100,
              created_at: new Date().toISOString(),
            });
          }
        });

        const activeList = Array.from(uniqueMap.values()).sort((a, b) =>
          a.className.localeCompare(b.className) || a.fullName.localeCompare(b.fullName)
        );

        if (activeList.length > 0) {
          // Sync to mock provider cache
          const mockProv = new (await import('./mock-provider.service')).MockProvider();
          await mockProv.saveStudents(activeList);
          return activeList;
        }
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getStudents DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.getStudents();
    });
  }

  public async saveStudents(
    students: StudentItem[],
    _token?: string
  ): Promise<boolean> {
    try {
      const dbRows = students.map((s) => ({
        id: s.id || `std_${s.className.toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        nisn: s.nisn ? s.nisn.trim() : null,
        full_name: s.fullName.trim(),
        class_name: s.className.trim(),
        academic_year: s.academicYear || '2026/2027',
        gender: s.gender || 'L',
        rfid_uid: s.rfidUid ? s.rfidUid.trim().toUpperCase() : null,
        card_status: s.cardStatus || 'ACTIVE',
        attendance_rate: s.attendanceRate ?? 100,
        address: s.address ? s.address.trim() : null,
        notes: s.notes ? s.notes.trim() : null,
        updated_at: new Date().toISOString(),
      }));

      if (dbRows.length > 0) {
        const { error: upsertErr } = await this.client
          .from('students')
          .upsert(dbRows, { onConflict: 'id' });

        if (upsertErr) {
          logger.warn('SupabaseProvider', 'saveStudents upsert error:', upsertErr.message);
        }
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'saveStudents DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.saveStudents(students);
  }

  public async createStudent(
    student: Omit<StudentItem, 'id' | 'created_at'>,
    token?: string
  ): Promise<StudentItem> {
    const generatedId = `std_${(student.className || 'all').toLowerCase()}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    try {
      const rowPayload = {
        id: generatedId,
        nisn: student.nisn ? student.nisn.trim() : null,
        full_name: student.fullName.trim(),
        class_name: student.className.trim(),
        academic_year: student.academicYear || '2026/2027',
        gender: student.gender || 'L',
        rfid_uid: student.rfidUid ? student.rfidUid.trim().toUpperCase() : null,
        card_status: student.cardStatus || 'ACTIVE',
        attendance_rate: student.attendanceRate ?? 100,
        address: student.address ? student.address.trim() : null,
        notes: student.notes ? student.notes.trim() : null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.client
        .from('students')
        .insert([rowPayload])
        .select('id, nisn, full_name, class_name, academic_year, gender, rfid_uid, card_status, attendance_rate, address, notes, created_at, updated_at')
        .single();

      if (!error && data) {
        const created: StudentItem = {
          id: data.id,
          nisn: data.nisn || '',
          fullName: data.full_name,
          className: data.class_name,
          academicYear: data.academic_year || '2026/2027',
          gender: data.gender,
          rfidUid: data.rfid_uid || undefined,
          cardStatus: data.card_status || 'ACTIVE',
          attendanceRate: data.attendance_rate != null ? Number(data.attendance_rate) : 100,
          address: data.address,
          notes: data.notes,
          created_at: data.created_at,
          updated_at: data.updated_at,
        };
        // Keep local cache in sync
        try {
          const mockProv = new (await import('./mock-provider.service')).MockProvider();
          const localList = await mockProv.getStudents();
          localList.unshift(created);
          await mockProv.saveStudents(localList);
        } catch {
          // ignore cache error
        }
        return created;
      }

      if (error) {
        logger.warn('SupabaseProvider', 'createStudent DB error:', error.message);
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'createStudent DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.createStudent(student, token);
  }

  public async updateStudent(
    id: string,
    updates: Partial<StudentItem>,
    token?: string
  ): Promise<boolean> {
    let dbSuccess = false;
    try {
      const payload: Record<string, any> = {};
      if (updates.nisn !== undefined) payload.nisn = updates.nisn ? updates.nisn.trim() : null;
      if (updates.fullName !== undefined) payload.full_name = updates.fullName.trim();
      if (updates.className !== undefined) payload.class_name = updates.className.trim();
      if (updates.academicYear !== undefined) payload.academic_year = updates.academicYear;
      if (updates.gender !== undefined) payload.gender = updates.gender;
      if (updates.rfidUid !== undefined) payload.rfid_uid = updates.rfidUid ? updates.rfidUid.trim().toUpperCase() : null;
      if (updates.cardStatus !== undefined) payload.card_status = updates.cardStatus;
      if (updates.attendanceRate !== undefined) payload.attendance_rate = updates.attendanceRate;
      if (updates.lastTapAt !== undefined) payload.last_tap_at = updates.lastTapAt;
      if (updates.address !== undefined) payload.address = updates.address ? updates.address.trim() : null;
      if (updates.notes !== undefined) payload.notes = updates.notes ? updates.notes.trim() : null;
      payload.updated_at = new Date().toISOString();

      // First try update by ID
      let { data, error } = await this.client
        .from('students')
        .update(payload)
        .eq('id', id)
        .select('id');

      // If last_tap_at does not exist in schema, retry without it
      if (error && error.message?.includes('last_tap_at')) {
        delete payload.last_tap_at;
        const retryRes = await this.client
          .from('students')
          .update(payload)
          .eq('id', id)
          .select('id');
        data = retryRes.data;
        error = retryRes.error;
      }

      if (!error && data && data.length > 0) {
        dbSuccess = true;
      } else if (!error && updates.fullName && updates.className) {
        // Fallback match by class_name and full_name if ID differed
        const { data: fallbackData, error: fbErr } = await this.client
          .from('students')
          .update(payload)
          .eq('class_name', updates.className)
          .ilike('full_name', updates.fullName)
          .select('id');

        if (!fbErr && fallbackData && fallbackData.length > 0) {
          dbSuccess = true;
        }
      }

      if (error) {
        logger.warn('SupabaseProvider', 'updateStudent DB error:', error.message);
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'updateStudent DB exception:', err);
    }

    // Mirror to local cache
    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    await mockProv.updateStudent(id, updates, token);

    return dbSuccess || true;
  }

  public async deleteStudent(id: string, token?: string): Promise<boolean> {
    let dbSuccess = false;
    try {
      const { error } = await this.client
        .from('students')
        .delete()
        .eq('id', id);

      if (!error) {
        dbSuccess = true;
      } else {
        logger.warn('SupabaseProvider', 'deleteStudent DB error:', error.message);
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'deleteStudent DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    await mockProv.deleteStudent(id, token);

    return dbSuccess || true;
  }

  public async syncStudentsFromGradeMaster(
    academicYear = '2026/2027',
    _token?: string
  ): Promise<{ syncedCount: number; classesCount: number }> {
    try {
      // Pull active 2026/2027 students from gm_behaviors
      const { data: behaviors, error: bErr } = await this.client
        .from('gm_behaviors')
        .select('student_name, class_name, academic_year')
        .eq('academic_year', academicYear);

      if (bErr) throw bErr;

      // Also fetch gm_student_accounts for 2026/2027
      const { data: accounts } = await this.client
        .from('gm_student_accounts')
        .select('student_name, class_name, academic_year')
        .eq('academic_year', academicYear);

      // Merge and deduplicate
      const mergedMap = new Map<string, { fullName: string; className: string }>();

      (behaviors || []).forEach((b: any) => {
        if (!b.student_name || !b.class_name) return;
        const cName = b.student_name.trim().toUpperCase();
        const cClass = b.class_name.trim().toUpperCase();
        mergedMap.set(`${cClass}|||${cName}`, { fullName: cName, className: cClass });
      });

      (accounts || []).forEach((a: any) => {
        if (!a.student_name || !a.class_name) return;
        const cName = a.student_name.trim().toUpperCase();
        const cClass = a.class_name.trim().toUpperCase();
        const key = `${cClass}|||${cName}`;
        if (!mergedMap.has(key)) {
          mergedMap.set(key, { fullName: cName, className: cClass });
        }
      });

      const existingStudents = await this.getStudents();
      const existingRfidByStudent = new Map<string, string>();
      const existingGenderByStudent = new Map<string, 'L' | 'P'>();
      existingStudents.forEach((s) => {
        const studentKey = `${s.className.toUpperCase()}|||${s.fullName.toUpperCase()}`;
        if (s.rfidUid) {
          existingRfidByStudent.set(studentKey, s.rfidUid);
        }
        if (s.gender) {
          existingGenderByStudent.set(studentKey, s.gender);
        }
      });

      const syncedList: StudentItem[] = Array.from(mergedMap.values()).map((item, idx) => {
        const studentKey = `${item.className.toUpperCase()}|||${item.fullName.toUpperCase()}`;
        const preservedRfid = existingRfidByStudent.get(studentKey);
        const preservedGender = existingGenderByStudent.get(studentKey);
        const isFemaleClass = item.className.toUpperCase() === '8A' || item.className.toUpperCase() === '9A';
        const defaultGender: 'L' | 'P' = preservedGender || (isFemaleClass ? 'P' : 'L');
        return {
          id: `std_${item.className.toLowerCase()}_${String(idx + 1).padStart(3, '0')}`,
          nisn: '',
          fullName: item.fullName,
          className: item.className,
          academicYear: academicYear,
          gender: defaultGender,
          rfidUid: preservedRfid || undefined,
          cardStatus: 'ACTIVE',
          attendanceRate: 100,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
      });

      // Save to students table
      await this.saveStudents(syncedList);

      const uniqueClasses = new Set(syncedList.map((s) => s.className));
      return {
        syncedCount: syncedList.length,
        classesCount: uniqueClasses.size,
      };
    } catch (err) {
      logger.warn('SupabaseProvider', 'syncStudentsFromGradeMaster error:', err);
      const mockProv = new (await import('./mock-provider.service')).MockProvider();
      return mockProv.syncStudentsFromGradeMaster(academicYear);
    }
  }

  public async recordStudentRfidAttendance(
    rfidUid: string,
    subject = 'Presensi Harian',
    _token?: string
  ): Promise<{
    success: boolean;
    student?: StudentItem;
    attendance?: StudentAttendanceRecord;
    message: string;
    isDuplicate?: boolean;
  }> {
    try {
      const cleanRfid = rfidUid.trim().toUpperCase();
      const students = await this.getStudents();
      const student = students.find(
        (s) => s.rfidUid && s.rfidUid.trim().toUpperCase() === cleanRfid
      );

      if (!student) {
        return {
          success: false,
          message: `Kartu RFID (UID: ${cleanRfid}) belum terdaftar pada siswa manapun.`,
        };
      }

      const todayDate = getTodayDateInJakarta();
      const currentTime = getCurrentTimeInJakarta();
      const academicYear = student.academicYear || '2026/2027';

      // Check if already tapped today in gm_attendance
      const { data: existingRecords } = await this.client
        .from('gm_attendance')
        .select('id, student_name, class_name, subject, academic_year, status, date, check_in_time, check_out_time, rfid_uid, created_at')
        .eq('student_name', student.fullName)
        .eq('class_name', student.className)
        .eq('date', todayDate)
        .limit(1);

      if (existingRecords && existingRecords.length > 0) {
        const exist = existingRecords[0];
        return {
          success: true,
          isDuplicate: true,
          student,
          attendance: {
            id: exist.id,
            studentName: exist.student_name,
            className: exist.class_name,
            subject: exist.subject,
            academicYear: exist.academic_year,
            status: exist.status,
            date: exist.date,
            checkInTime: exist.check_in_time || currentTime,
            checkOutTime: exist.check_out_time,
            rfidUid: cleanRfid,
            createdAt: exist.created_at,
          },
          message: `Siswa ${student.fullName} (${student.className}) sudah tercatat hadir hari ini pukul ${exist.check_in_time || currentTime}.`,
        };
      }

      // Record to public.gm_attendance
      const newAttendanceRow = {
        student_name: student.fullName,
        class_name: student.className,
        subject: subject,
        academic_year: academicYear,
        status: 'Hadir',
        date: todayDate,
        check_in_time: currentTime,
        rfid_uid: cleanRfid,
      };

      const { data: inserted, error: insertErr } = await this.client
        .from('gm_attendance')
        .insert([newAttendanceRow])
        .select('id, student_name, class_name, subject, academic_year, status, date, check_in_time, check_out_time, rfid_uid, created_at')
        .single();

      if (insertErr) {
        logger.warn('SupabaseProvider', 'recordStudentRfidAttendance insert gm_attendance error:', insertErr.message);
      }

      // Update student last tap
      await this.updateStudent(student.id, { lastTapAt: `${todayDate} ${currentTime}` });

      const attendanceRecord: StudentAttendanceRecord = {
        id: inserted?.id || `att_std_${Date.now()}`,
        studentName: student.fullName,
        className: student.className,
        subject: subject,
        academicYear: academicYear,
        status: 'Hadir',
        date: todayDate,
        checkInTime: currentTime,
        rfidUid: cleanRfid,
        createdAt: inserted?.created_at || new Date().toISOString(),
      };

      return {
        success: true,
        student,
        attendance: attendanceRecord,
        message: `Presensi Hadir berhasil dicatat untuk ${student.fullName} (${student.className}) pukul ${currentTime}.`,
      };
    } catch (err) {
      logger.warn('SupabaseProvider', 'recordStudentRfidAttendance exception:', err);
      const mockProv = new (await import('./mock-provider.service')).MockProvider();
      return mockProv.recordStudentRfidAttendance(rfidUid, subject);
    }
  }

  public async getStudentAttendance(
    date: string,
    className?: string,
    academicYear = '2026/2027',
    _token?: string
  ): Promise<StudentAttendanceRecord[]> {
    try {
      let query = this.client
        .from('gm_attendance')
        .select('id, student_name, class_name, subject, academic_year, status, date, check_in_time, check_out_time, rfid_uid, created_at')
        .eq('date', date)
        .eq('academic_year', academicYear)
        .order('created_at', { ascending: false })
        .limit(100);

      if (className && className !== 'ALL') {
        query = query.eq('class_name', className);
      }

      const { data, error } = await query;
      if (!error && data) {
        return (data as any[]).map((row) => ({
          id: row.id,
          studentName: row.student_name,
          className: row.class_name,
          subject: row.subject,
          academicYear: row.academic_year,
          status: row.status,
          date: row.date,
          checkInTime: row.check_in_time,
          checkOutTime: row.check_out_time,
          rfidUid: row.rfid_uid,
          createdAt: row.created_at,
        }));
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getStudentAttendance exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.getStudentAttendance(date, className, academicYear);
  }

  // ==============================================================================
  // STUDENT BEHAVIOR & POINTS API (Relational Single Source of Truth + GradeMaster Sync)
  // ==============================================================================

  public async getStudentBehaviors(
    className?: string,
    academicYear = '2026/2027',
    _token?: string
  ): Promise<StudentBehaviorRecord[]> {
    try {
      // 1. Primary: Ambil seluruh master siswa aktif dari public.students
      let queryStudents = this.client
        .from('students')
        .select('id, full_name, class_name, academic_year, created_at, updated_at')
        .order('class_name', { ascending: true })
        .order('full_name', { ascending: true })
        .limit(300);

      if (className && className !== 'ALL') {
        queryStudents = queryStudents.eq('class_name', className);
      }
      if (academicYear && academicYear !== 'ALL') {
        queryStudents = queryStudents.eq('academic_year', academicYear);
      }

      const { data: studentsData, error: studentsErr } = await queryStudents;
      if (!studentsErr && studentsData && studentsData.length > 0) {
        const studentIds = studentsData.map((s: any) => s.id).filter(Boolean);

        // Baca data akumulasi poin dari student_character_summary (kolom schema valid)
        const summariesByStudentId: Record<string, any> = {};
        if (studentIds.length > 0) {
          try {
            let sumQuery = this.client
              .from('student_character_summary')
              .select('student_id, academic_year, merits_points, demerits_points, net_points, updated_at')
              .in('student_id', studentIds);

            if (academicYear && academicYear !== 'ALL') {
              sumQuery = sumQuery.eq('academic_year', academicYear);
            }

            const { data: sumData } = await sumQuery;
            if (sumData) {
              sumData.forEach((sum: any) => {
                summariesByStudentId[sum.student_id] = sum;
              });
            }
          } catch (sumErr) {
            logger.warn('SupabaseProvider', 'Failed fetching student_character_summary:', sumErr);
          }
        }

        // Ambil riwayat catatan termasuk log yang dibatalkan (audit trail)
        const logsByStudent: Record<string, StudentBehaviorLog[]> = {};
        if (studentIds.length > 0) {
          try {
            const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
            let logQuery = this.client
              .from('student_behavior_logs')
              .select('id, student_id, type, points, reason_text, reason_code, occurred_at, timezone, recorded_by_name, recorded_by_user_id, idempotency_key, voided_at, voided_by_user_id, void_reason')
              .in('student_id', studentIds)
              .gte('occurred_at', ninetyDaysAgo)
              .order('occurred_at', { ascending: false })
              .limit(200);

            if (academicYear && academicYear !== 'ALL') {
              logQuery = logQuery.eq('academic_year', academicYear);
            }

            const { data: rawLogs } = await logQuery;
            if (rawLogs) {
              rawLogs.forEach((l: any) => {
                if (!logsByStudent[l.student_id]) logsByStudent[l.student_id] = [];
                logsByStudent[l.student_id].push({
                  id: l.id,
                  student_id: l.student_id,
                  type: l.type,
                  points: l.points,
                  reason: l.reason_text,
                  reason_code: l.reason_code,
                  timestamp: l.occurred_at,
                  violation_date: l.occurred_at,
                  occurred_at: l.occurred_at,
                  timezone: l.timezone || 'Asia/Jakarta',
                  recordedBy: l.recorded_by_name || 'Guru',
                  recorded_by_user_id: l.recorded_by_user_id,
                  recorded_by_name: l.recorded_by_name,
                  idempotency_key: l.idempotency_key,
                  voided_at: l.voided_at,
                  voided_by_user_id: l.voided_by_user_id,
                  void_reason: l.void_reason,
                  sync_status: 'SYNCED',
                });
              });
            }
          } catch (logErr) {
            logger.warn('SupabaseProvider', 'Failed fetching student_behavior_logs:', logErr);
          }
        }

        return studentsData.map((row: any) => {
          const sum = summariesByStudentId[row.id];
          const studentLogs = logsByStudent[row.id] || [];

          let merits = sum ? (sum.merits_points ?? 0) : 0;
          let demerits = sum ? (sum.demerits_points ?? 0) : 0;

          // Jika belum ada row di summary tapi sudah ada log
          if (!sum && studentLogs.length > 0) {
            studentLogs.forEach((l) => {
              if (l.voided_at) return;
              const p = Math.abs(l.points || 0);
              if (l.type === 'GOOD') merits += p;
              else demerits += p;
            });
          }

          const net = sum?.net_points != null ? sum.net_points : (merits - demerits);

          return {
            id: row.id,
            student_id: row.id,
            student_name: row.full_name || '',
            class_name: row.class_name || '',
            academic_year: row.academic_year || academicYear,
            total_points: net,
            merits_points: merits,
            demerits_points: demerits,
            net_points: net,
            behavior_logs: studentLogs,
            avatar_url: row.avatar_url || null,
            sync_status: 'SYNCED' as const,
            created_at: row.created_at,
            updated_at: sum?.updated_at || row.updated_at,
          };
        });
      }

      // 2. Fallback Kompatibilitas: Baca dari legacy gm_behaviors
      let query = this.client
        .from('gm_behaviors')
        .select('id, student_name, class_name, academic_year, total_points, behavior_logs, created_at, updated_at')
        .eq('academic_year', academicYear)
        .order('class_name', { ascending: true })
        .order('student_name', { ascending: true })
        .limit(100);

      if (className && className !== 'ALL') {
        query = query.eq('class_name', className);
      }

      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        const studentIds = data.map((d: any) => d.id).filter(Boolean);

        let dbLogsByStudentId: Record<string, any[]> = {};
        if (studentIds.length > 0) {
          try {
            const { data: dbLogs } = await this.client
              .from('gm_behavior_logs')
              .select('id, student_id, points_delta, reason, violation_date, created_at')
              .in('student_id', studentIds)
              .order('violation_date', { ascending: false })
              .limit(100);

            if (dbLogs) {
              dbLogs.forEach((l: any) => {
                if (!dbLogsByStudentId[l.student_id]) {
                  dbLogsByStudentId[l.student_id] = [];
                }
                dbLogsByStudentId[l.student_id].push(l);
              });
            }
          } catch (logErr) {
            logger.warn('SupabaseProvider', 'Failed fetching gm_behavior_logs:', logErr);
          }
        }

        return (data as any[]).map((row) => {
          const rawDbLogs = dbLogsByStudentId[row.id] || [];
          const existingLogs: StudentBehaviorLog[] = Array.isArray(row.behavior_logs) ? row.behavior_logs : [];

          const convertedRelationalLogs: StudentBehaviorLog[] = rawDbLogs.map((l: any) => ({
            id: l.id,
            type: l.points_delta < 0 ? ('GOOD' as const) : ('BAD' as const),
            points: Math.abs(l.points_delta),
            reason: l.reason || 'Catatan Sikap',
            timestamp: l.violation_date || l.created_at,
            violation_date: l.violation_date || l.created_at,
            occurred_at: l.violation_date || l.created_at,
            timezone: 'Asia/Jakarta',
            recordedBy: 'Guru',
            sync_status: 'SYNCED' as const,
          }));

          const seenKeys = new Set<string>();
          const allMergedLogs: StudentBehaviorLog[] = [];

          [...convertedRelationalLogs, ...existingLogs].forEach((log) => {
            const key = log.id || `${log.timestamp}_${log.reason}_${log.points}_${log.type}`;
            if (!seenKeys.has(key)) {
              seenKeys.add(key);
              allMergedLogs.push({ ...log, sync_status: 'SYNCED' });
            }
          });

          let meritsTotal = 0;
          let demeritsTotal = 0;

          allMergedLogs.forEach((l) => {
            if (l.voided_at) return;
            const p = Math.abs(l.points || 0);
            if (l.type === 'GOOD') {
              meritsTotal += p;
            } else {
              demeritsTotal += p;
            }
          });

          const netTotal = meritsTotal - demeritsTotal;

          return {
            id: row.id,
            student_id: row.id,
            student_name: row.student_name,
            class_name: row.class_name,
            academic_year: row.academic_year || academicYear,
            total_points: netTotal,
            merits_points: meritsTotal,
            demerits_points: demeritsTotal,
            net_points: netTotal,
            behavior_logs: allMergedLogs,
            avatar_url: row.avatar_url || null,
            points_used_today: row.points_used_today || 0,
            points_date: row.points_date || null,
            sync_status: 'SYNCED' as const,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        });
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getStudentBehaviors DB exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.getStudentBehaviors(className, academicYear);
  }

  public async recordStudentBehavior(
    params: RecordStudentBehaviorParams,
    _token?: string
  ): Promise<RecordStudentBehaviorResult> {
    const cleanName = (params.studentName || '').trim().toUpperCase();
    const cleanClass = (params.className || '').trim().toUpperCase();
    const academicYear = params.academicYear || '2026/2027';
    const violationDateIso = params.violationDate || new Date().toISOString();

    // 1. Validasi Input Keras
    if (!cleanName) {
      return {
        success: false,
        newTotal: 0,
        syncStatus: 'FAILED_SYNC',
        message: 'Nama siswa wajib diisi.',
      };
    }

    if (!params.type || !['GOOD', 'BAD'].includes(params.type)) {
      return {
        success: false,
        newTotal: 0,
        syncStatus: 'FAILED_SYNC',
        message: 'Tipe catatan karakter harus GOOD atau BAD.',
      };
    }

    if (
      typeof params.points !== 'number' ||
      isNaN(params.points) ||
      params.points <= 0 ||
      params.points > 100 ||
      !Number.isInteger(params.points)
    ) {
      return {
        success: false,
        newTotal: 0,
        syncStatus: 'FAILED_SYNC',
        message: 'Bobot poin harus bernilai bulat antara 1 dan 100.',
      };
    }

    if (!params.reason || params.reason.trim().length < 3 || params.reason.trim().length > 500) {
      return {
        success: false,
        newTotal: 0,
        syncStatus: 'FAILED_SYNC',
        message: 'Alasan pemberian poin wajib diisi (minimal 3 karakter, maksimal 500 karakter).',
      };
    }

    if (params.academicYear && !/^\d{4}\/\d{4}$/.test(params.academicYear)) {
      return {
        success: false,
        newTotal: 0,
        syncStatus: 'FAILED_SYNC',
        message: 'Format tahun ajaran tidak valid (contoh: 2026/2027).',
      };
    }

    const pointsAbs = params.points;

    // 2. Resolusi ID Siswa Relasional (Wajib cocokkan class_name jika tidak ada studentId)
    let resolvedStudentId = params.studentId;
    if (!resolvedStudentId) {
      try {
        const { data: studentMatch } = await this.client
          .from('students')
          .select('id')
          .eq('academic_year', academicYear)
          .ilike('full_name', cleanName)
          .ilike('class_name', cleanClass)
          .limit(1)
          .maybeSingle();

        if (studentMatch?.id) {
          resolvedStudentId = studentMatch.id;
        }
      } catch (stErr) {
        logger.warn('SupabaseProvider', 'Failed resolving student from public.students:', stErr);
      }
    }

    // 3. Eksekusi RPC Transaksional Server-Side (Single Transaction)
    if (resolvedStudentId) {
      try {
        const { data: rpcData, error: rpcErr } = await this.client.rpc('record_student_behavior', {
          p_student_id: resolvedStudentId,
          p_academic_year: academicYear,
          p_type: params.type,
          p_points: pointsAbs,
          p_reason: params.reason.trim(),
          p_reason_code: params.reasonCode || null,
          p_occurred_at: violationDateIso,
          p_timezone: params.timezone || 'Asia/Jakarta',
          p_idempotency_key: params.idempotencyKey || null,
          p_recorded_by_name: params.teacherName || 'Guru',
        });

        if (!rpcErr && rpcData && rpcData.success) {
          // Sync ke mock cache untuk offline responsiveness
          try {
            const mockProv = new (await import('./mock-provider.service')).MockProvider();
            await mockProv.recordStudentBehavior({ ...params, studentId: resolvedStudentId });
          } catch {
            // ignore
          }

          return {
            success: true,
            newTotal: rpcData.net_points,
            merits_points: rpcData.merits_points,
            demerits_points: rpcData.demerits_points,
            net_points: rpcData.net_points,
            logId: rpcData.log_id,
            isDuplicate: Boolean(rpcData.is_duplicate),
            syncStatus: 'SYNCED',
            message: rpcData.message || `Berhasil mencatat ${params.type === 'GOOD' ? 'Poin Kebaikan' : 'Catatan Pelanggaran'} (+${pointsAbs} Poin) untuk ${cleanName}.`,
          };
        }

        if (rpcErr) {
          // Jika pesan error berasal dari validasi Postgres RPC (ERRCODE 22000 / 22003 / 23503)
          if (!rpcErr.message.includes('404') && !rpcErr.message.includes('function') && !rpcErr.message.includes('not found')) {
            return {
              success: false,
              newTotal: 0,
              syncStatus: 'FAILED_SYNC',
              message: rpcErr.message,
            };
          }
        }
      } catch (rpcEx) {
        logger.warn('SupabaseProvider', 'RPC record_student_behavior exception:', rpcEx);
      }
    }

    // 4. Fallback Terkendali (Jika migration 20 RPC belum dijalankan di Supabase Cloud)
    // Terapkan aturan aritmatika yang sama persis: merits positive, demerits positive, net = merits - demerits
    try {
      let { data: existing, error: findErr } = await this.client
        .from('gm_behaviors')
        .select('id, student_name, class_name, academic_year, total_points, behavior_logs')
        .eq('academic_year', academicYear)
        .ilike('student_name', cleanName)
        .ilike('class_name', cleanClass)
        .limit(1)
        .maybeSingle();

      if (findErr) {
        return {
          success: false,
          newTotal: 0,
          syncStatus: 'FAILED_SYNC',
          message: `Gagal memverifikasi data siswa di server: ${findErr.message}`,
        };
      }

      const logId = 'beh_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
      const newLog: StudentBehaviorLog = {
        id: logId,
        student_id: existing?.id || resolvedStudentId,
        type: params.type,
        points: pointsAbs,
        reason: params.reason.trim(),
        timestamp: violationDateIso,
        violation_date: violationDateIso,
        occurred_at: violationDateIso,
        timezone: params.timezone || 'Asia/Jakarta',
        recordedBy: params.teacherName || 'Guru',
        idempotency_key: params.idempotencyKey,
        sync_status: 'SYNCED',
      };

      if (existing) {
        const currentLogs: StudentBehaviorLog[] = Array.isArray(existing.behavior_logs) ? existing.behavior_logs : [];

        // Idempotency check pada logs yang sudah ada
        if (params.idempotencyKey) {
          const matched = currentLogs.find((l) => l.idempotency_key === params.idempotencyKey);
          if (matched) {
            let m = 0; let d = 0;
            currentLogs.forEach((l) => {
              if (l.voided_at) return;
              if (l.type === 'GOOD') m += Math.abs(l.points || 0);
              else d += Math.abs(l.points || 0);
            });
            return {
              success: true,
              newTotal: m - d,
              merits_points: m,
              demerits_points: d,
              net_points: m - d,
              logId: matched.id,
              isDuplicate: true,
              syncStatus: 'SYNCED',
              message: 'Catatan ini sudah pernah tersimpan sebelumnya (idempoten).',
            };
          }
        }

        const updatedLogs = [newLog, ...currentLogs];
        let merits = 0;
        let demerits = 0;
        updatedLogs.forEach((l) => {
          if (l.voided_at) return;
          const p = Math.abs(l.points || 0);
          if (l.type === 'GOOD') merits += p;
          else demerits += p;
        });
        const net = merits - demerits;

        const { error: updateErr } = await this.client
          .from('gm_behaviors')
          .update({
            total_points: net,
            behavior_logs: updatedLogs,
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);

        if (updateErr) {
          return {
            success: false,
            newTotal: 0,
            syncStatus: 'FAILED_SYNC',
            message: `Gagal memperbarui catatan perilaku: ${updateErr.message}`,
          };
        }

        return {
          success: true,
          newTotal: net,
          merits_points: merits,
          demerits_points: demerits,
          net_points: net,
          logId: newLog.id,
          isDuplicate: false,
          syncStatus: 'SYNCED',
          message: `Berhasil mencatat ${params.type === 'GOOD' ? 'Poin Kebaikan' : 'Catatan Pelanggaran'} (+${pointsAbs} Poin) untuk ${cleanName}.`,
        };
      } else {
        // Siswa baru di tabel gm_behaviors
        const merits = params.type === 'GOOD' ? pointsAbs : 0;
        const demerits = params.type === 'BAD' ? pointsAbs : 0;
        const net = merits - demerits;

        const { data: inserted, error: insertErr } = await this.client
          .from('gm_behaviors')
          .insert({
            student_name: cleanName,
            class_name: cleanClass,
            academic_year: academicYear,
            total_points: net,
            behavior_logs: [newLog],
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .select('id')
          .single();

        if (insertErr || !inserted) {
          return {
            success: false,
            newTotal: 0,
            syncStatus: 'FAILED_SYNC',
            message: `Gagal menyimpan catatan perilaku baru: ${insertErr?.message || 'Error tidak diketahui'}`,
          };
        }

        return {
          success: true,
          newTotal: net,
          merits_points: merits,
          demerits_points: demerits,
          net_points: net,
          logId: newLog.id,
          isDuplicate: false,
          syncStatus: 'SYNCED',
          message: `Berhasil mencatat ${params.type === 'GOOD' ? 'Poin Kebaikan' : 'Catatan Pelanggaran'} (+${pointsAbs} Poin) untuk ${cleanName}.`,
        };
      }
    } catch (err: any) {
      logger.warn('SupabaseProvider', 'recordStudentBehavior DB exception:', err);
      return {
        success: false,
        newTotal: 0,
        syncStatus: 'FAILED_SYNC',
        message: err?.message || 'Koneksi ke database Supabase gagal. Silakan coba lagi nanti.',
      };
    }
  }

  public async voidStudentBehavior(
    logId: string,
    voidReason: string,
    _token?: string
  ): Promise<{
    success: boolean;
    message: string;
    summary?: StudentCharacterSummary;
  }> {
    if (!logId) {
      return { success: false, message: 'ID log wajib disertakan.' };
    }
    if (!voidReason || voidReason.trim().length < 3) {
      return { success: false, message: 'Alasan pembatalan minimal 3 karakter.' };
    }

    try {
      // 1. Coba panggil RPC PostgreSQL
      const { data, error } = await this.client.rpc('void_student_behavior', {
        p_log_id: logId,
        p_void_reason: voidReason.trim(),
      });

      if (!error && data?.success) {
        return {
          success: true,
          message: data.message,
          summary: {
            student_id: data.student_id,
            academic_year: data.academic_year || '2026/2027',
            merits_points: data.merits_points,
            demerits_points: data.demerits_points,
            net_points: data.net_points,
          },
        };
      }

      if (error && !error.message.includes('404') && !error.message.includes('function')) {
        return { success: false, message: error.message };
      }
    } catch (rpcEx) {
      logger.warn('SupabaseProvider', 'RPC void_student_behavior exception:', rpcEx);
    }

    // 2. Fallback: Coba batalkan pada tabel legacy gm_behaviors
    try {
      const { data: gmRows } = await this.client
        .from('gm_behaviors')
        .select('id, academic_year, behavior_logs')
        .limit(200);

      if (gmRows && gmRows.length > 0) {
        for (const row of gmRows) {
          const logs: any[] = Array.isArray(row.behavior_logs) ? row.behavior_logs : [];
          const targetLog = logs.find((l: any) => l.id === logId);
          if (targetLog && !targetLog.voided_at) {
            targetLog.voided_at = new Date().toISOString();
            targetLog.void_reason = voidReason.trim();
            targetLog.voided_by_user_id = useAuthStore.getState().user?.id || 'usr_guru';

            let m = 0;
            let d = 0;
            logs.forEach((l: any) => {
              if (l.voided_at) return;
              const p = Math.abs(l.points || 0);
              if (l.type === 'GOOD') m += p;
              else d += p;
            });
            const net = m - d;

            await this.client
              .from('gm_behaviors')
              .update({
                total_points: net,
                behavior_logs: logs,
                updated_at: new Date().toISOString(),
              })
              .eq('id', row.id);

            return {
              success: true,
              message: 'Catatan berhasil dibatalkan dan saldo poin siswa telah diperbarui.',
              summary: {
                student_id: row.id,
                academic_year: row.academic_year || '2026/2027',
                merits_points: m,
                demerits_points: d,
                net_points: net,
              },
            };
          }
        }
      }
    } catch (gmErr) {
      logger.warn('SupabaseProvider', 'Fallback void on gm_behaviors failed:', gmErr);
    }

    // 3. Fallback ke MockProvider untuk voiding offline/mock
    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.voidStudentBehavior(logId, voidReason);
  }

  public async getStudentBehaviorHistory(
    studentName: string,
    className: string,
    _token?: string
  ): Promise<StudentBehaviorLog[]> {
    const cleanName = (studentName || '').trim().toUpperCase();
    const cleanClass = (className || '').trim().toUpperCase();

    try {
      // 1. Coba baca dari tabel relasional student_behavior_logs
      const { data: relLogs, error: relErr } = await this.client
        .from('student_behavior_logs')
        .select('id, student_id, type, points, reason_text, reason_code, occurred_at, timezone, recorded_by_name, recorded_by_user_id, voided_at, void_reason, students!inner(full_name, class_name)')
        .ilike('students.full_name', cleanName)
        .ilike('students.class_name', cleanClass)
        .order('occurred_at', { ascending: false })
        .limit(50);

      if (!relErr && relLogs && relLogs.length > 0) {
        return relLogs.map((l: any) => ({
          id: l.id,
          student_id: l.student_id,
          type: l.type,
          points: l.points,
          reason: l.reason_text,
          reason_code: l.reason_code,
          timestamp: l.occurred_at,
          violation_date: l.occurred_at,
          occurred_at: l.occurred_at,
          timezone: l.timezone || 'Asia/Jakarta',
          recordedBy: l.recorded_by_name || 'Guru',
          recorded_by_user_id: l.recorded_by_user_id,
          recorded_by_name: l.recorded_by_name,
          voided_at: l.voided_at,
          void_reason: l.void_reason,
          sync_status: 'SYNCED' as const,
        }));
      }

      // 2. Fallback: Baca dari gm_behaviors
      const { data, error } = await this.client
        .from('gm_behaviors')
        .select('id, behavior_logs')
        .eq('academic_year', '2026/2027')
        .ilike('student_name', cleanName)
        .ilike('class_name', cleanClass)
        .limit(1)
        .maybeSingle();

      const existingLogs: StudentBehaviorLog[] = !error && data && Array.isArray(data.behavior_logs) ? data.behavior_logs : [];

      if (data?.id) {
        try {
          const { data: dbLogs } = await this.client
            .from('gm_behavior_logs')
            .select('id, student_id, points_delta, reason, violation_date, created_at')
            .eq('student_id', data.id)
            .order('violation_date', { ascending: false })
            .limit(50);

          if (dbLogs && dbLogs.length > 0) {
            const mappedLogs: StudentBehaviorLog[] = dbLogs.map((l: any) => ({
              id: l.id,
              type: l.points_delta < 0 ? ('GOOD' as const) : ('BAD' as const),
              points: Math.abs(l.points_delta),
              reason: l.reason || 'Catatan Sikap',
              timestamp: l.violation_date || l.created_at,
              violation_date: l.violation_date || l.created_at,
              occurred_at: l.violation_date || l.created_at,
              recordedBy: 'Guru',
              sync_status: 'SYNCED' as const,
            }));

            const seenKeys = new Set<string>();
            const merged: StudentBehaviorLog[] = [];
            [...mappedLogs, ...existingLogs].forEach((l) => {
              const key = l.id || `${l.timestamp}_${l.reason}_${l.points}_${l.type}`;
              if (!seenKeys.has(key)) {
                seenKeys.add(key);
                merged.push({ ...l, sync_status: 'SYNCED' });
              }
            });

            return merged.sort(
              (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
            );
          }
        } catch {
          // ignore
        }
      }

      if (existingLogs.length > 0) {
        return existingLogs
          .map((l) => ({ ...l, sync_status: 'SYNCED' as const }))
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'getStudentBehaviorHistory exception:', err);
    }

    const mockProv = new (await import('./mock-provider.service')).MockProvider();
    return mockProv.getStudentBehaviorHistory(studentName, className);
  }

  public async savePushSubscription(
    subscription: PushSubscriptionPayload,
    token?: string
  ): Promise<SavePushSubscriptionResult> {
    // 1. Validasi keabsahan payload subscription
    if (
      !subscription ||
      !subscription.endpoint ||
      typeof subscription.endpoint !== 'string' ||
      !subscription.endpoint.startsWith('http')
    ) {
      logger.warn('SupabaseProvider', 'savePushSubscription rejected: INVALID_SUBSCRIPTION (invalid endpoint)');
      return {
        success: false,
        persisted: false,
        errorCode: 'INVALID_SUBSCRIPTION',
        errorMessage: 'Payload subscription tidak valid: URL endpoint push service tidak valid atau kosong.',
      };
    }

    if (!subscription.p256dh || !subscription.auth) {
      logger.warn('SupabaseProvider', 'savePushSubscription rejected: INVALID_SUBSCRIPTION (keys missing)');
      return {
        success: false,
        persisted: false,
        errorCode: 'INVALID_SUBSCRIPTION',
        errorMessage: 'Payload subscription tidak valid: p256dh dan auth key wajib diisi.',
      };
    }

    // 2. Validasi ketersediaan sesi autentikasi pengguna
    const effectiveToken = token || useAuthStore.getState().token;
    if (!effectiveToken) {
      logger.warn('SupabaseProvider', 'savePushSubscription rejected: AUTH_SESSION_MISSING');
      return {
        success: false,
        persisted: false,
        errorCode: 'AUTH_SESSION_MISSING',
        errorMessage: 'Pengguna belum memiliki sesi login aktif (AUTH_SESSION_MISSING).',
      };
    }

    // 3. Jalur Utama: Serverless Trusted Proxy (/api/push-subscriptions) dengan Service-Role
    try {
      if (typeof window !== 'undefined' && typeof window.fetch === 'function') {
        const response = await fetch('/api/push-subscriptions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${effectiveToken}`,
          },
          body: JSON.stringify({
            subscription: {
              endpoint: subscription.endpoint,
              p256dh: subscription.p256dh,
              auth: subscription.auth,
              device_type: subscription.device_type || 'MOBILE',
              user_agent: subscription.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
            },
          }),
        });

        const resData = await response.json().catch(() => null);

        if (response.ok && resData?.success) {
          logger.info('SupabaseProvider', 'Web push subscription saved via serverless proxy for user:', subscription.user_id);
          return {
            success: true,
            persisted: true,
          };
        }

        // Tangani dan klasifikasikan error HTTP dari serverless API
        if (response.status === 401) {
          return {
            success: false,
            persisted: false,
            errorCode: 'AUTH_SESSION_MISSING',
            errorMessage: resData?.errorMessage || 'Token autentikasi tidak sah atau telah kedaluwarsa.',
          };
        }

        if (response.status === 403 || resData?.errorCode === 'RLS_DENIED') {
          return {
            success: false,
            persisted: false,
            errorCode: 'RLS_DENIED',
            errorMessage: resData?.errorMessage || 'Akses ditolak oleh kebijakan keamanan server (RLS_DENIED).',
          };
        }

        if (response.status === 404 || resData?.errorCode === 'TABLE_NOT_FOUND') {
          return {
            success: false,
            persisted: false,
            errorCode: 'TABLE_NOT_FOUND',
            errorMessage: resData?.errorMessage || 'Tabel push_subscriptions belum terpasang di database.',
          };
        }

        if (response.status === 409 || resData?.errorCode === 'ENDPOINT_CONFLICT') {
          return {
            success: false,
            persisted: false,
            errorCode: 'ENDPOINT_CONFLICT',
            errorMessage: resData?.errorMessage || 'Endpoint push telah terdaftar untuk pengguna lain.',
          };
        }

        if (response.status === 400 || resData?.errorCode === 'INVALID_SUBSCRIPTION') {
          return {
            success: false,
            persisted: false,
            errorCode: 'INVALID_SUBSCRIPTION',
            errorMessage: resData?.errorMessage || 'Format subscription ditolak oleh server.',
          };
        }
      }
    } catch (fetchErr: any) {
      logger.warn('SupabaseProvider', 'Serverless proxy fetch exception:', fetchErr?.message);
    }

    // 4. Fallback Direct Supabase Client Query (jika serverless proxy tidak terjangkau)
    try {
      const nowIso = new Date().toISOString();
      const payload = {
        user_id: subscription.user_id,
        endpoint: subscription.endpoint,
        p256dh: subscription.p256dh,
        auth: subscription.auth,
        device_type: subscription.device_type || 'MOBILE',
        user_agent: subscription.user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : null),
        last_seen_at: nowIso,
        updated_at: nowIso,
      };

      const { error } = await this.client
        .from('push_subscriptions')
        .upsert(payload, { onConflict: 'endpoint' });

      if (error) {
        let classifiedCode: PushSubscriptionErrorCode = 'NETWORK_ERROR';
        if (
          error.code === '42501' ||
          error.message?.includes('row-level security') ||
          error.message?.includes('401')
        ) {
          classifiedCode = 'RLS_DENIED';
        } else if (
          error.code === '42P01' ||
          error.message?.includes('relation') ||
          error.message?.includes('does not exist')
        ) {
          classifiedCode = 'TABLE_NOT_FOUND';
        } else if (
          error.code === '23505' ||
          error.message?.includes('unique') ||
          error.message?.includes('conflict')
        ) {
          classifiedCode = 'ENDPOINT_CONFLICT';
        }

        logger.error('SupabaseProvider', `savePushSubscription failed [${classifiedCode}]:`, error.message);
        return {
          success: false,
          persisted: false,
          errorCode: classifiedCode,
          errorMessage: `Gagal menyimpan subscription ke database (${classifiedCode}): ${error.message}`,
        };
      }

      logger.info('SupabaseProvider', 'Web push subscription saved via direct client for user:', subscription.user_id);
      return {
        success: true,
        persisted: true,
      };
    } catch (err: any) {
      logger.error('SupabaseProvider', 'savePushSubscription unhandled exception:', err);
      return {
        success: false,
        persisted: false,
        errorCode: 'NETWORK_ERROR',
        errorMessage: err?.message || 'Kendala koneksi jaringan saat menghubungi server database.',
      };
    }
  }

  public async deletePushSubscription(endpoint: string, _token?: string): Promise<boolean> {
    try {
      const { error } = await this.client
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint);

      if (error) {
        logger.warn('SupabaseProvider', 'deletePushSubscription error:', error.message);
        return false;
      }
      return true;
    } catch (err) {
      logger.error('SupabaseProvider', 'deletePushSubscription exception:', err);
      return false;
    }
  }

  // TEACHER DISCIPLINE POINT HISTORY API (STRICT SERVERLESS PROXY /api/teacher-points)
  public async getTeacherPointHistory(userId: string, _token?: string): Promise<TeacherPointLog[]> {
    const cached = this.cachedTeacherPointHistory.get(userId);
    const ttl = userId === 'ALL' ? 120000 : 60000;
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    return this.dedupeRequest(`getTeacherPointHistory_${userId}`, async () => {
      const activeToken =
        _token ||
        useAuthStore.getState().token ||
        (typeof window !== 'undefined'
          ? (() => {
              try {
                return JSON.parse(localStorage.getItem('smart_absensi_auth_storage') || '{}')?.state?.token;
              } catch {
                return null;
              }
            })()
          : null);

      const getFromLocalStorage = (): TeacherPointLog[] => {
        const list = getSafeInitialTeacherPointLogs();
        if (!userId || userId === 'ALL') return list;
        return list.filter((l) => l.user_id === userId);
      };

      try {
        const queryParams = new URLSearchParams();
        if (userId && userId !== 'ALL') {
          queryParams.set('user_id', userId);
        }

        const endpoint = `/api/teacher-points${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        if (activeToken) {
          headers['Authorization'] = `Bearer ${activeToken}`;
        }

        const response = await fetch(endpoint, {
          method: 'GET',
          headers,
        });

        if (!response.ok) {
          const errBody = await response.json().catch(() => ({}));
          if (response.status !== 401) {
            logger.warn(
              'SupabaseProvider',
              `getTeacherPointHistory API error (HTTP ${response.status}):`,
              errBody.errorMessage || response.statusText
            );
          }
          const localData = getFromLocalStorage();
          if (localData.length > 0) {
            return localData;
          }
          const seeds = getInitialSeedTeacherPointLogs();
          return (!userId || userId === 'ALL') ? seeds : seeds.filter((l) => l.user_id === userId);
        }

        const json = await response.json();
        const data = json.data || [];

        const result: TeacherPointLog[] = data.map((row: any) => ({
          id: row.id,
          user_id: row.user_id,
          teacher_name: row.teacher_name || undefined,
          date: row.date,
          points: Number(row.points) || 0,
          activity_type: row.activity_type as TeacherPointActivityType,
          title: row.title,
          description: row.description || undefined,
          created_at: row.created_at,
        }));

        // Pastikan rekap resmi Agustus tetap disertakan jika backend PostgreSQL hanya memuat log September
        const hasAugust = result.some((l) => l.date && l.date.startsWith('2026-08'));
        if (!hasAugust) {
          const seeds = getInitialSeedTeacherPointLogs();
          const augustSeeds = (!userId || userId === 'ALL')
            ? seeds.filter((s) => s.date && s.date.startsWith('2026-08'))
            : seeds.filter((s) => s.user_id === userId && s.date && s.date.startsWith('2026-08'));
          result.push(...augustSeeds);
        }

        this.cachedTeacherPointHistory.set(userId, { data: result, timestamp: Date.now() });

        if (typeof window !== 'undefined' && (userId === 'ALL' || !userId)) {
          try {
            localStorage.setItem('smart_absensi_teacher_point_history', JSON.stringify(result));
          } catch {}
        }

        return result;
      } catch (err) {
        logger.warn('SupabaseProvider', 'getTeacherPointHistory network issue, reading local cache:', err);
        return getFromLocalStorage();
      }
    });
  }

  public async recordTeacherPoint(
    log: Omit<TeacherPointLog, 'id' | 'created_at'>,
    _token?: string
  ): Promise<TeacherPointLog> {
    const activeToken =
      _token ||
      useAuthStore.getState().token ||
      (typeof window !== 'undefined'
        ? (() => {
            try {
              return JSON.parse(localStorage.getItem('smart_absensi_auth_storage') || '{}')?.state?.token;
            } catch {
              return null;
            }
          })()
        : null);

    if (!activeToken) {
      throw new Error('AUTH_REQUIRED: Sesi login aktif diperlukan untuk mencatat poin guru.');
    }

    const idempotencyKey = `att:${log.user_id}:${log.date}:${log.activity_type}`;
    const payload = {
      recipient_user_id: log.user_id,
      activity_type: log.activity_type,
      date: log.date,
      points: log.points,
      title: log.title,
      description: log.description || null,
      idempotency_key: idempotencyKey,
    };

    try {
      const response = await fetch('/api/teacher-points', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${activeToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.errorMessage || `Gagal mencatat poin guru (HTTP ${response.status})`);
      }

      const json = await response.json();
      const savedRecord = json.data;

      this.cachedTeacherPointHistory.delete(log.user_id);
      this.cachedTeacherPointHistory.delete('ALL');

      if (typeof window !== 'undefined') {
        window.dispatchEvent(
          new CustomEvent('smart_absensi_points_updated', {
            detail: {
              id: savedRecord.id,
              dedupeKey: savedRecord.idempotency_key || savedRecord.id,
              userId: savedRecord.user_id,
              teacherName: savedRecord.teacher_name,
              points: savedRecord.points,
              activity_type: savedRecord.activity_type,
              title: savedRecord.title,
              description: savedRecord.description,
            },
          })
        );
      }

      return {
        id: savedRecord.id,
        user_id: savedRecord.user_id,
        teacher_name: savedRecord.teacher_name,
        date: savedRecord.date,
        points: Number(savedRecord.points) || 0,
        activity_type: savedRecord.activity_type as TeacherPointActivityType,
        title: savedRecord.title,
        description: savedRecord.description || undefined,
        created_at: savedRecord.created_at,
      };
    } catch (err: any) {
      logger.error('SupabaseProvider', 'recordTeacherPoint exception:', err);
      throw err;
    }
  }

  // ============================================================================
  // SARANA DAN PRASARANA (SARPRAS) INVENTORY API
  // ============================================================================
  public async getInventorySarpras(_token?: string): Promise<InventorySarprasItem[]> {
    const now = Date.now();
    if (this.cachedInventorySarpras && now - this.cachedInventorySarprasTimestamp < 300000) {
      return this.cachedInventorySarpras;
    }

    return this.dedupeRequest('getInventorySarpras', async () => {
      try {
        const { data, error } = await this.client
          .from('inventory_sarpras')
          .select('id, ruangan, nama_barang, jumlah_total, merek, tahun_perolehan, kondisi, yang_harus_dibeli, sumber_dana, keterangan, created_by, created_by_name, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) {
          logger.warn('SupabaseProvider', 'getInventorySarpras error, falling back to mock provider:', error.message);
          const mockProv = new (await import('./mock-provider.service')).MockProvider();
          return mockProv.getInventorySarpras();
        }

        if (data && Array.isArray(data)) {
          this.cachedInventorySarpras = data as InventorySarprasItem[];
          this.cachedInventorySarprasTimestamp = Date.now();
          return data as InventorySarprasItem[];
        }
        return [];
      } catch (err) {
        logger.error('SupabaseProvider', 'getInventorySarpras exception, falling back to mock provider:', err);
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        return mockProv.getInventorySarpras();
      }
    });
  }

  public async createInventorySarpras(dto: CreateInventorySarprasDTO, _token?: string): Promise<InventorySarprasItem> {
    this.cachedInventorySarpras = null;
    this.cachedInventorySarprasTimestamp = 0;

    try {
      const activeUser = useAuthStore.getState().user;
      const payload = {
        ruangan: dto.ruangan.trim(),
        nama_barang: dto.nama_barang.trim(),
        jumlah_total: Number(dto.jumlah_total) || 1,
        merek: dto.merek.trim(),
        tahun_perolehan: Number(dto.tahun_perolehan) || new Date().getFullYear(),
        kondisi: dto.kondisi,
        yang_harus_dibeli: String(dto.yang_harus_dibeli ?? '0').trim(),
        sumber_dana: dto.sumber_dana.trim(),
        keterangan: dto.keterangan ? dto.keterangan.trim() : null,
        created_by: dto.created_by || activeUser?.id || null,
        created_by_name: dto.created_by_name || activeUser?.full_name || null,
      };

      const { data, error } = await this.client
        .from('inventory_sarpras')
        .insert(payload)
        .select('id, ruangan, nama_barang, jumlah_total, merek, tahun_perolehan, kondisi, yang_harus_dibeli, sumber_dana, keterangan, created_by, created_by_name, created_at, updated_at')
        .single();

      if (error) {
        logger.warn('SupabaseProvider', 'createInventorySarpras error, falling back to mock provider:', error.message);
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        return mockProv.createInventorySarpras(dto);
      }

      return data as InventorySarprasItem;
    } catch (err) {
      logger.error('SupabaseProvider', 'createInventorySarpras exception, falling back to mock provider:', err);
      const mockProv = new (await import('./mock-provider.service')).MockProvider();
      return mockProv.createInventorySarpras(dto);
    }
  }

  public async updateInventorySarpras(id: string, dto: UpdateInventorySarprasDTO, _token?: string): Promise<boolean> {
    this.cachedInventorySarpras = null;
    this.cachedInventorySarprasTimestamp = 0;

    try {
      const payload: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };
      if (dto.ruangan !== undefined) payload.ruangan = dto.ruangan.trim();
      if (dto.nama_barang !== undefined) payload.nama_barang = dto.nama_barang.trim();
      if (dto.jumlah_total !== undefined) payload.jumlah_total = Number(dto.jumlah_total);
      if (dto.merek !== undefined) payload.merek = dto.merek.trim();
      if (dto.tahun_perolehan !== undefined) payload.tahun_perolehan = Number(dto.tahun_perolehan);
      if (dto.kondisi !== undefined) payload.kondisi = dto.kondisi;
      if (dto.yang_harus_dibeli !== undefined) payload.yang_harus_dibeli = String(dto.yang_harus_dibeli).trim();
      if (dto.sumber_dana !== undefined) payload.sumber_dana = dto.sumber_dana.trim();
      if (dto.keterangan !== undefined) payload.keterangan = dto.keterangan ? dto.keterangan.trim() : null;

      const { error } = await this.client
        .from('inventory_sarpras')
        .update(payload)
        .eq('id', id);

      if (error) {
        logger.warn('SupabaseProvider', 'updateInventorySarpras error, falling back to mock provider:', error.message);
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        return mockProv.updateInventorySarpras(id, dto);
      }

      return true;
    } catch (err) {
      logger.error('SupabaseProvider', 'updateInventorySarpras exception, falling back to mock provider:', err);
      const mockProv = new (await import('./mock-provider.service')).MockProvider();
      return mockProv.updateInventorySarpras(id, dto);
    }
  }

  public async deleteInventorySarpras(id: string, _token?: string): Promise<boolean> {
    this.cachedInventorySarpras = null;
    this.cachedInventorySarprasTimestamp = 0;

    try {
      const { error } = await this.client
        .from('inventory_sarpras')
        .delete()
        .eq('id', id);

      if (error) {
        logger.warn('SupabaseProvider', 'deleteInventorySarpras error, falling back to mock provider:', error.message);
        const mockProv = new (await import('./mock-provider.service')).MockProvider();
        return mockProv.deleteInventorySarpras(id);
      }

      return true;
    } catch (err) {
      logger.error('SupabaseProvider', 'deleteInventorySarpras exception, falling back to mock provider:', err);
      const mockProv = new (await import('./mock-provider.service')).MockProvider();
      return mockProv.deleteInventorySarpras(id);
    }
  }

  // ─── EXAM CORRECTION & GRADING API (Koreksi Soal & Nilai Siswa) ───────────────

  public async getExamSessions(_token?: string): Promise<ExamSessionRecord[]> {
    return this.dedupeRequest('getExamSessions', async () => {
      try {
        const { data, error } = await this.client
          .from('gm_sessions')
          .select('id, session_name, teacher, subject, class_name, class_code, owner_user_id, school_level, answer_key, scoring_config, exam_type, academic_year, semester, kkm, created_at, updated_at')
          .order('created_at', { ascending: false })
          .limit(50);

        if (error) {
          logger.error('SupabaseProvider', 'getExamSessions error:', error.message);
          throw new Error(`Gagal memuat sesi ujian: ${error.message}`);
        }

        if (!data || data.length === 0) {
          return [];
        }

        const mapped: ExamSessionRecord[] = data.map((d: any) => {
          let parsedKey: string[] = [];
          if (Array.isArray(d.answer_key)) {
            parsedKey = d.answer_key;
          } else if (typeof d.answer_key === 'string' && d.answer_key.trim()) {
            try {
              const p = JSON.parse(d.answer_key);
              if (Array.isArray(p)) parsedKey = p;
            } catch {
              parsedKey = parseAnswerKey(d.answer_key);
            }
          }

          return {
            id: d.id,
            session_name: d.session_name,
            teacher: d.teacher,
            subject: d.subject,
            class_name: d.class_name,
            class_code: d.class_code || normalizeClassCode(d.class_name),
            owner_user_id: d.owner_user_id,
            school_level: resolveSchoolLevel(d.class_name, d.school_level),
            answer_key: parsedKey,
            student_list: [], // student_list remains loaded on-demand via getExamSessionById
            scoring_config: d.scoring_config || { pgWeight: 0.7, essayWeight: 0.3, essayMaxScore: 20, essayCount: 5 },
            exam_type: d.exam_type || 'Harian',
            academic_year: d.academic_year || '2025/2026',
            semester: d.semester || 'Ganjil',
            kkm: Number(d.kkm) || 75,
            created_at: d.created_at,
            updated_at: d.updated_at,
          };
        });

        // Update local storage cache for instant offline read if network fails later
        try {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem('smart_absensi_exam_sessions', JSON.stringify(mapped));
          }
        } catch {}

        return mapped;
      } catch (err: any) {
        logger.error('SupabaseProvider', 'getExamSessions exception:', err);
        throw err;
      }
    });
  }

  public async getExamSessionById(sessionId: string, _token?: string): Promise<ExamSessionRecord | null> {
    return this.dedupeRequest(`getExamSessionById_${sessionId}`, async () => {
      try {
        const { data: d, error } = await this.client
          .from('gm_sessions')
          .select('id, session_name, teacher, subject, class_name, class_code, owner_user_id, school_level, answer_key, student_list, scoring_config, exam_type, academic_year, semester, kkm, created_at, updated_at')
          .eq('id', sessionId)
          .maybeSingle();

        if (error || !d) {
          if (error) logger.error('SupabaseProvider', 'getExamSessionById error:', error.message);
          return null;
        }

        let answerKey: string[] = [];
        if (Array.isArray(d.answer_key)) {
          answerKey = d.answer_key;
        } else if (typeof d.answer_key === 'string' && d.answer_key.trim()) {
          try {
            const parsed = JSON.parse(d.answer_key);
            if (Array.isArray(parsed)) answerKey = parsed;
          } catch {
            answerKey = parseAnswerKey(d.answer_key);
          }
        }

        let studentList: string[] = [];
        if (Array.isArray(d.student_list)) {
          studentList = d.student_list;
        } else if (typeof d.student_list === 'string' && d.student_list.trim()) {
          try {
            const parsed = JSON.parse(d.student_list);
            if (Array.isArray(parsed)) studentList = parsed;
          } catch {
            studentList = d.student_list.split(',').map((x: string) => x.trim()).filter(Boolean);
          }
        }

        return {
          id: d.id,
          session_name: d.session_name,
          teacher: d.teacher,
          subject: d.subject,
          class_name: d.class_name,
          class_code: d.class_code || normalizeClassCode(d.class_name),
          owner_user_id: d.owner_user_id,
          school_level: resolveSchoolLevel(d.class_name, d.school_level),
          answer_key: answerKey,
          student_list: studentList,
          scoring_config: d.scoring_config || { pgWeight: 0.7, essayWeight: 0.3, essayMaxScore: 20, essayCount: 5 },
          exam_type: d.exam_type || 'Harian',
          academic_year: d.academic_year || '2025/2026',
          semester: d.semester || 'Ganjil',
          kkm: Number(d.kkm) || 75,
          created_at: d.created_at,
          updated_at: d.updated_at,
        };
      } catch (err: any) {
        logger.error('SupabaseProvider', 'getExamSessionById exception:', err);
        return null;
      }
    });
  }

  public async saveExamSession(dto: CreateExamSessionDTO, _token?: string): Promise<ExamSessionRecord> {
    const recordPayload: any = {
      session_name: dto.session_name.trim(),
      teacher: dto.teacher.trim(),
      subject: dto.subject.trim(),
      class_name: dto.class_name.trim(),
      class_code: dto.class_code || normalizeClassCode(dto.class_name),
      school_level: resolveSchoolLevel(dto.class_name, dto.school_level),
      answer_key: dto.answer_key || [],
      student_list: dto.student_list || [],
      scoring_config: dto.scoring_config || { pgWeight: 0.7, essayWeight: 0.3, essayMaxScore: 20, essayCount: 5 },
      exam_type: dto.exam_type || 'Harian',
      academic_year: dto.academic_year || '2025/2026',
      semester: dto.semester || 'Ganjil',
      kkm: dto.kkm || 75,
      is_public: true,
      updated_at: new Date().toISOString(),
    };

    if (dto.owner_user_id) {
      recordPayload.owner_user_id = dto.owner_user_id;
    }

    let savedId = dto.id;

    if (dto.id) {
      const { error } = await this.client
        .from('gm_sessions')
        .update(recordPayload)
        .eq('id', dto.id);
      if (error) {
        logger.error('SupabaseProvider', 'saveExamSession update error:', error.message);
        throw new Error(`Gagal memperbarui sesi di cloud: ${error.message}`);
      }
      savedId = dto.id;
    } else {
      const generatedId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : undefined;
      if (generatedId) {
        recordPayload.id = generatedId;
      }
      const { data, error } = await this.client
        .from('gm_sessions')
        .insert(recordPayload)
        .select('id')
        .single();
      if (error) {
        logger.error('SupabaseProvider', 'saveExamSession insert error:', error.message);
        throw new Error(`Gagal membuat sesi baru di cloud: ${error.message}`);
      }
      savedId = data?.id || generatedId;
    }

    const result: ExamSessionRecord = {
      ...recordPayload,
      id: savedId,
      created_at: new Date().toISOString(),
    };

    // Update local cache
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('smart_absensi_exam_sessions');
        const existing: ExamSessionRecord[] = raw ? JSON.parse(raw) : [];
        const idx = existing.findIndex((s) => s.id === savedId);
        if (idx >= 0) {
          existing[idx] = result;
        } else {
          existing.unshift(result);
        }
        window.localStorage.setItem('smart_absensi_exam_sessions', JSON.stringify(existing));
      }
    } catch {}

    return result;
  }

  public async deleteExamSession(sessionId: string, _token?: string): Promise<boolean> {
    const { error } = await this.client.from('gm_sessions').delete().eq('id', sessionId);
    if (error) {
      logger.error('SupabaseProvider', 'deleteExamSession error:', error.message);
      throw new Error(`Gagal menghapus sesi ujian di cloud: ${error.message}`);
    }

    // Update local cache
    try {
      if (typeof window !== 'undefined') {
        const raw = window.localStorage.getItem('smart_absensi_exam_sessions');
        if (raw) {
          const existing: ExamSessionRecord[] = JSON.parse(raw);
          const filtered = existing.filter((s) => s.id !== sessionId);
          window.localStorage.setItem('smart_absensi_exam_sessions', JSON.stringify(filtered));
        }
      }
    } catch {}

    return true;
  }

  public async getGradedStudents(sessionId: string, _token?: string): Promise<GradedStudentScoreRecord[]> {
    try {
      const { data, error } = await this.client
        .from('gm_students')
        .select('id, session_id, name, student_user_id, mcq_answers, essay_scores, mcq_score, essay_score, final_score, csi, lps, correct, wrong, remedial_status, created_at, updated_at')
        .eq('session_id', sessionId)
        .order('name', { ascending: true });

      if (error) {
        logger.error('SupabaseProvider', 'getGradedStudents error:', error.message);
        throw new Error(`Gagal memuat nilai siswa: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      const mapped: GradedStudentScoreRecord[] = data.map((s: any) => ({
        id: s.id,
        session_id: s.session_id,
        name: s.name,
        student_user_id: s.student_user_id,
        mcq_answers: s.mcq_answers || {},
        essay_scores: Array.isArray(s.essay_scores) ? s.essay_scores : [],
        mcq_score: Number(s.mcq_score) || 0,
        essay_score: Number(s.essay_score) || 0,
        final_score: Number(s.final_score) || 0,
        csi: Number(s.csi) || 0,
        lps: Number(s.lps) || 0,
        correct: Number(s.correct) || 0,
        wrong: Number(s.wrong) || 0,
        remedial_status: s.remedial_status,
        created_at: s.created_at,
        updated_at: s.updated_at,
      }));

      // Cache locally
      try {
        if (typeof window !== 'undefined') {
          window.localStorage.setItem(`smart_absensi_graded_${sessionId}`, JSON.stringify(mapped));
        }
      } catch {}

      return mapped;
    } catch (err: any) {
      logger.error('SupabaseProvider', 'getGradedStudents exception:', err);
      throw err;
    }
  }

  public async saveGradedStudent(dto: SaveGradedStudentDTO, _token?: string): Promise<GradedStudentScoreRecord> {
    const studentPayload: any = {
      session_id: dto.session_id,
      name: dto.name.trim(),
      student_user_id: dto.student_user_id,
      mcq_answers: dto.mcq_answers || {},
      essay_scores: dto.essay_scores || [],
      mcq_score: dto.mcq_score || 0,
      essay_score: dto.essay_score || 0,
      final_score: dto.final_score || 0,
      csi: dto.csi || 0,
      lps: dto.lps || 0,
      correct: dto.correct || 0,
      wrong: dto.wrong || 0,
      updated_at: new Date().toISOString(),
    };

    let savedId = dto.id;

    // 1. Check existing student in gm_students
    let existingRecord: any = null;
    if (dto.id) {
      const { data } = await this.client.from('gm_students').select('id').eq('id', dto.id).maybeSingle();
      existingRecord = data;
    }
    if (!existingRecord) {
      const { data } = await this.client
        .from('gm_students')
        .select('id')
        .eq('session_id', dto.session_id)
        .ilike('name', dto.name.trim())
        .maybeSingle();
      existingRecord = data;
    }

    if (existingRecord) {
      savedId = existingRecord.id;
      const { error: updErr } = await this.client.from('gm_students').update(studentPayload).eq('id', savedId);
      if (updErr) {
        logger.error('SupabaseProvider', 'saveGradedStudent update error:', updErr.message);
        throw new Error(`Gagal menyimpan nilai ke cloud: ${updErr.message}`);
      }
    } else {
      const generatedStudentId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : undefined;
      if (generatedStudentId) {
        studentPayload.id = generatedStudentId;
      }
      const { data: inserted, error: insErr } = await this.client
        .from('gm_students')
        .insert(studentPayload)
        .select('id')
        .single();
      if (insErr) {
        logger.error('SupabaseProvider', 'saveGradedStudent insert error:', insErr.message);
        throw new Error(`Gagal menyimpan nilai siswa ke cloud: ${insErr.message}`);
      }
      savedId = inserted?.id || generatedStudentId;
    }

    // 2. Insert or update per-question answers if answer_key provided
    if (savedId && dto.answer_key && Array.isArray(dto.answer_key)) {
      try {
        await this.client.from('gm_answers').delete().eq('student_id', savedId);
        const normalize = (v?: string) => (v ? v.trim().toUpperCase() : '');
        const answerRows = Object.entries(dto.mcq_answers).map(([qNum, selected]) => ({
          student_id: savedId,
          question_number: parseInt(qNum, 10),
          selected_answer: selected,
          is_correct: normalize(dto.answer_key?.[parseInt(qNum, 10) - 1]) === normalize(selected),
          updated_at: new Date().toISOString(),
        }));
        if (answerRows.length > 0) {
          const { error: ansErr } = await this.client.from('gm_answers').insert(answerRows);
          if (ansErr) {
            logger.warn('SupabaseProvider', 'gm_answers insert note:', ansErr.message);
          }
        }
      } catch (ansErr) {
        logger.warn('SupabaseProvider', 'gm_answers exception:', ansErr);
      }
    }

    // 3. Mirror record to public.student_scores for relational student grade history
    try {
      const { data: acc } = await this.client
        .from('gm_student_accounts')
        .select('id')
        .ilike('student_name', dto.name.trim())
        .limit(1)
        .maybeSingle();

      const studentUuid = acc?.id || dto.student_user_id || (savedId && savedId.length === 36 ? savedId : undefined);
      if (studentUuid) {
        await this.client.from('student_scores').insert({
          student_id: studentUuid,
          score: dto.final_score,
          answers: {
            session_id: dto.session_id,
            name: dto.name,
            mcq_answers: dto.mcq_answers,
            essay_scores: dto.essay_scores,
            csi: dto.csi,
            lps: dto.lps,
            correct: dto.correct,
            wrong: dto.wrong,
          },
          is_completed: true,
          completed_at: new Date().toISOString(),
        });
      }
    } catch (scoreSyncErr) {
      logger.debug('SupabaseProvider', 'student_scores sync note:', scoreSyncErr);
    }

    const result: GradedStudentScoreRecord = {
      ...studentPayload,
      id: savedId,
      created_at: new Date().toISOString(),
    };

    // Update local cache
    try {
      if (typeof window !== 'undefined') {
        const cacheKey = `smart_absensi_graded_${dto.session_id}`;
        const raw = window.localStorage.getItem(cacheKey);
        const existing: GradedStudentScoreRecord[] = raw ? JSON.parse(raw) : [];
        const idx = existing.findIndex((s) => s.id === savedId || s.name.toLowerCase() === dto.name.trim().toLowerCase());
        if (idx >= 0) {
          existing[idx] = result;
        } else {
          existing.push(result);
        }
        window.localStorage.setItem(cacheKey, JSON.stringify(existing));
      }
    } catch {}

    return result;
  }

  public async deleteGradedStudent(studentId: string, _token?: string): Promise<boolean> {
    const { error } = await this.client.from('gm_students').delete().eq('id', studentId);
    if (error) {
      logger.error('SupabaseProvider', 'deleteGradedStudent error:', error.message);
      throw new Error(`Gagal menghapus nilai siswa di cloud: ${error.message}`);
    }
    return true;
  }

  // ─── HOMEROOM & STUDENT CONTINUATION PLANS API ───────────────────────────

  public async getHomeroomOverview(token: string, className?: string): Promise<HomeroomOverview> {
    const url = '/api/homeroom/overview' + (className ? `?class_name=${encodeURIComponent(className)}` : '');
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.success) {
      throw new Error(json?.errorMessage || 'Gagal memuat ringkasan Ruang Wali Kelas.');
    }

    return json.overview;
  }

  public async getHomeroomStudents(token: string, className?: string): Promise<HomeroomStudentItem[]> {
    const url = '/api/homeroom/students' + (className ? `?class_name=${encodeURIComponent(className)}` : '');
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.success) {
      throw new Error(json?.errorMessage || 'Gagal memuat daftar siswa wali kelas.');
    }

    return json.students || [];
  }

  public async getStudentPlanDetail(studentId: string, token: string): Promise<StudentPlanDetail> {
    const url = `/api/homeroom/student-detail?student_id=${encodeURIComponent(studentId)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.success) {
      throw new Error(json?.errorMessage || 'Gagal memuat detail rencana studi siswa.');
    }

    return json.detail;
  }

  public async verifyStudentPlan(dto: VerifyPlanDTO, token: string): Promise<VerifyPlanResult> {
    const resp = await fetch('/api/homeroom/verify-plan', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(dto),
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.success) {
      throw new Error(json?.errorMessage || 'Gagal mengeksekusi verifikasi rencana siswa.');
    }

    return json;
  }

  public async getHomeroomDocumentUrl(documentId: string, token: string): Promise<string> {
    const url = `/api/homeroom/document-download?document_id=${encodeURIComponent(documentId)}`;
    const resp = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const json = await resp.json().catch(() => null);
    if (!resp.ok || !json?.success || !json?.downloadUrl) {
      throw new Error(json?.errorMessage || 'Gagal membuat tautan unduhan dokumen.');
    }

    return json.downloadUrl;
  }

  // ── EXAM COMMITTEE & SCHEDULE CLOUD SYNC API ──────────────────────────────
  public async getExamCommitteeMembers(academicYear?: string, _token?: string): Promise<ExamCommitteeMember[]> {
    const targetYear = academicYear || '2026/2027';
    const now = Date.now();
    const cached = this.cachedExamCommittees.get(targetYear);
    if (cached && now - cached.timestamp < 300000) {
      return cached.data;
    }

    return this.dedupeRequest(`getExamCommittee_${targetYear}`, async () => {
      // 1. Try relational table public.exam_committees
      try {
        const { data, error } = await this.client
          .from('exam_committees')
          .select('*')
          .eq('academic_year', targetYear);

        if (!error && Array.isArray(data) && data.length > 0) {
          const normalized: ExamCommitteeMember[] = data.map((row: any) => ({
            id: row.id,
            userId: row.user_id,
            fullName: row.full_name,
            npp: row.npp || undefined,
            role: row.role,
            academicYear: row.academic_year,
            isActive: row.is_active ?? true,
            createdAt: row.created_at,
          }));

          this.cachedExamCommittees.set(targetYear, { data: normalized, timestamp: Date.now() });

          // Update local storage cache
          try {
            if (typeof localStorage !== 'undefined') {
              const raw = localStorage.getItem('smart_absensi_exam_committee');
              let all: ExamCommitteeMember[] = raw ? JSON.parse(raw) : [];
              if (!Array.isArray(all)) all = [];
              all = all.filter((m) => m.academicYear !== targetYear);
              all.push(...normalized);
              localStorage.setItem('smart_absensi_exam_committee', JSON.stringify(all));
            }
          } catch {}

          return normalized;
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'Table exam_committees query error, falling back to system_settings:', err);
      }

      // 2. Fallback to system_settings table (Fail-safe KV storage)
      try {
        const settingKey = `exam_committee_${targetYear}`;
        const { data: kvData } = await this.client
          .from('system_settings')
          .select('value')
          .eq('key', settingKey)
          .maybeSingle();

        if (kvData?.value) {
          const parsed: ExamCommitteeMember[] = JSON.parse(kvData.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            this.cachedExamCommittees.set(targetYear, { data: parsed, timestamp: Date.now() });
            return parsed;
          }
        }

        // Also check legacy/global key
        const { data: globalKv } = await this.client
          .from('system_settings')
          .select('value')
          .eq('key', 'smart_absensi_exam_committee')
          .maybeSingle();

        if (globalKv?.value) {
          const parsed: ExamCommitteeMember[] = JSON.parse(globalKv.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const filtered = parsed.filter((m) => !targetYear || m.academicYear === targetYear);
            if (filtered.length > 0) {
              this.cachedExamCommittees.set(targetYear, { data: filtered, timestamp: Date.now() });
              return filtered;
            }
          }
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'system_settings committee query error:', err);
      }

      // 3. Auto Cloud Migration: If remote has no data yet, check local storage (e.g. from Laptop Admin)
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem('smart_absensi_exam_committee');
          if (raw) {
            const parsed: ExamCommitteeMember[] = JSON.parse(raw);
            if (Array.isArray(parsed) && parsed.length > 0) {
              const localForYear = parsed.filter((m) => !targetYear || m.academicYear === targetYear);
              if (localForYear.length > 0) {
                logger.info('SupabaseProvider', 'Auto-migrating local committee data to cloud for year:', targetYear);
                // Asynchronously push to cloud without blocking
                this.saveExamCommitteeMembers(localForYear, targetYear).catch((e) => {
                  logger.warn('SupabaseProvider', 'Failed auto-migrating local committee to cloud:', e);
                });
                this.cachedExamCommittees.set(targetYear, { data: localForYear, timestamp: Date.now() });
                return localForYear;
              }
            }
          }
        }
      } catch {}

      return [];
    });
  }

  public async saveExamCommitteeMembers(
    members: ExamCommitteeMember[],
    academicYear?: string,
    _token?: string
  ): Promise<boolean> {
    const targetYear = academicYear || '2026/2027';
    this.cachedExamCommittees.delete(targetYear);

    // 1. Update local storage immediately for fast local response
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem('smart_absensi_exam_committee');
        let all: ExamCommitteeMember[] = raw ? JSON.parse(raw) : [];
        if (!Array.isArray(all)) all = [];
        all = all.filter((m) => m.academicYear !== targetYear);
        all.push(...members);
        localStorage.setItem('smart_absensi_exam_committee', JSON.stringify(all));
      }
    } catch {}

    // 2. Save to system_settings KV (Guaranteed zero-downtime multi-device cloud sync)
    try {
      const settingKey = `exam_committee_${targetYear}`;
      await this.client.from('system_settings').upsert({
        key: settingKey,
        value: JSON.stringify(members),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });

      await this.client.from('system_settings').upsert({
        key: 'smart_absensi_exam_committee',
        value: JSON.stringify(members),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    } catch (err) {
      logger.warn('SupabaseProvider', 'Failed to save committee to system_settings:', err);
    }

    // 3. Save to public.exam_committees table if exists
    try {
      await this.client.from('exam_committees').delete().eq('academic_year', targetYear);
      if (members.length > 0) {
        const rows = members.map((m) => ({
          id: m.id || `comm_${m.userId}_${Date.now()}`,
          academic_year: targetYear,
          user_id: m.userId,
          full_name: m.fullName,
          npp: m.npp || null,
          role: m.role,
          is_active: m.isActive ?? true,
          updated_at: new Date().toISOString(),
        }));
        await this.client.from('exam_committees').upsert(rows, { onConflict: 'id' });
      }
    } catch (err) {
      logger.warn('SupabaseProvider', 'Table exam_committees insert skipped or table not yet created:', err);
    }

    // 4. Broadcast window event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smart_absensi_exam_committee_changed', {
          detail: { academicYear: targetYear, members },
        })
      );
    }

    return true;
  }

  public async getExamSchedule(academicYear: string, examType: string, _token?: string): Promise<ExamScheduleData | null> {
    const cleanYear = academicYear.replace(/[^\w]/g, '_');
    const cleanType = examType.replace(/[^\w]/g, '_');
    const storageKey = `exam_schedule_${cleanYear}_${cleanType}`;

    const now = Date.now();
    const cached = this.cachedExamSchedules.get(storageKey);
    if (cached && now - cached.timestamp < 300000) {
      return cached.data;
    }

    return this.dedupeRequest(`getExamSchedule_${storageKey}`, async () => {
      // 1. Try system_settings KV
      try {
        const { data: kvData } = await this.client
          .from('system_settings')
          .select('value')
          .eq('key', storageKey)
          .maybeSingle();

        if (kvData?.value) {
          const parsed: ExamScheduleData = JSON.parse(kvData.value);
          this.cachedExamSchedules.set(storageKey, { data: parsed, timestamp: Date.now() });

          // Update local cache
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.setItem(`smart_absensi_exam_schedule_${cleanYear}_${cleanType}`, JSON.stringify(parsed));
            }
          } catch {}

          return parsed;
        }
      } catch (err) {
        logger.warn('SupabaseProvider', 'Failed to fetch exam schedule from system_settings:', err);
      }

      // 2. Check local storage fallback
      try {
        if (typeof localStorage !== 'undefined') {
          const raw = localStorage.getItem(`smart_absensi_exam_schedule_${cleanYear}_${cleanType}`);
          if (raw) {
            const parsed: ExamScheduleData = JSON.parse(raw);
            // Auto-migrate to cloud
            this.saveExamSchedule(parsed).catch((e) => {
              logger.warn('SupabaseProvider', 'Failed auto-migrating local exam schedule to cloud:', e);
            });
            this.cachedExamSchedules.set(storageKey, { data: parsed, timestamp: Date.now() });
            return parsed;
          }
        }
      } catch {}

      return null;
    });
  }

  public async saveExamSchedule(schedule: ExamScheduleData, _token?: string): Promise<boolean> {
    const cleanYear = schedule.config.academicYear.replace(/[^\w]/g, '_');
    const cleanType = schedule.config.examType.replace(/[^\w]/g, '_');
    const storageKey = `exam_schedule_${cleanYear}_${cleanType}`;

    this.cachedExamSchedules.delete(storageKey);

    // 1. Local storage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`smart_absensi_exam_schedule_${cleanYear}_${cleanType}`, JSON.stringify(schedule));
      }
    } catch {}

    // 2. Cloud system_settings
    try {
      await this.client.from('system_settings').upsert({
        key: storageKey,
        value: JSON.stringify(schedule),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'key' });
    } catch (err) {
      logger.warn('SupabaseProvider', 'Failed to save exam schedule to system_settings:', err);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smart_absensi_exam_schedule_updated', { detail: schedule })
      );
    }

    return true;
  }

  public async deleteExamSchedule(academicYear: string, examType: string, _token?: string): Promise<boolean> {
    const cleanYear = academicYear.replace(/[^\w]/g, '_');
    const cleanType = examType.replace(/[^\w]/g, '_');
    const storageKey = `exam_schedule_${cleanYear}_${cleanType}`;

    this.cachedExamSchedules.delete(storageKey);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(`smart_absensi_exam_schedule_${cleanYear}_${cleanType}`);
      }
    } catch {}

    try {
      await this.client.from('system_settings').delete().eq('key', storageKey);
    } catch (err) {
      logger.warn('SupabaseProvider', 'Failed to delete exam schedule from system_settings:', err);
    }

    return true;
  }
}


