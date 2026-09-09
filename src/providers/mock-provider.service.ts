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
  TeacherDutySchedule,
  TeacherComplaint,
  SubmitComplaintDTO,
  UpdateComplaintStatusDTO,
  TeachingSlot,
  StudentItem,
  StudentAttendanceRecord,
  StudentBehaviorRecord,
  StudentBehaviorLog,
  RecordStudentBehaviorParams,
  VerificationMethod,
  AttendanceSource,
  PushSubscriptionPayload,
  NotificationPreferences,
  TeacherPointLog,
  TeacherPointActivityType,
} from '../types/database.types';
import type { LoginDTO, LoginResponseDTO } from '../repositories/AuthRepository';
import type { ScanAttendanceDTO, AttendanceResponseDTO, CorrectAttendanceDTO } from '../repositories/AttendanceRepository';
import type { SubmitLeaveDTO } from '../repositories/LeaveRepository';
import { CONSTANTS } from '../config/constants';
import { useAuthStore } from '../store/useAuthStore';
import { NotificationService } from '../services/notification-permission.service';
import { getTodayDateInJakarta, getCurrentTimeInJakarta, timeToMinutes, generatePaydayEventsForYear } from '../utils/time.utils';

const memoryStore = new Map<string, string>();

function safeGetStorage(key: string): string | null {
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.getItem === 'function') {
      const val = localStorage.getItem(key);
      if (val !== null) return val;
    }
  } catch {
    // Memory fallback
  }
  return memoryStore.get(key) || null;
}

function safeSetStorage(key: string, val: string): void {
  memoryStore.set(key, val);
  try {
    if (typeof localStorage !== 'undefined' && localStorage && typeof localStorage.setItem === 'function') {
      localStorage.setItem(key, val);
    }
  } catch {
    // Memory fallback
  }
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
    let nip: string | null = null;
    let userId = 'usr_' + role.toLowerCase() + '_1001';

    // Official 11 Users Lookup Table (from SEED_USERS.sql)
    const officialTeachers: Record<string, { id: string; name: string; role: 'GURU' | 'KEPSEK' | 'ADMIN'; position: string }> = {
      '081947674030': { id: 'usr_guru_002', name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', role: 'GURU', position: 'Wakasek Sarana dan Prasarana' },
      '085716117717': { id: 'usr_kepsek_002', name: 'Farhan Sopian Sahid, S.Pd.I', role: 'KEPSEK', position: 'Kepala Sekolah' },
      '081213134916': { id: 'usr_guru_003', name: 'Adi Prasetyo, S.Pd., G.r', role: 'GURU', position: 'Guru Mapel Bahasa Inggris' },
      '081802107009': { id: 'usr_op_002', name: 'Qodiatul Asrof Ramadhoni, S.E., G.r', role: 'ADMIN', position: 'Operator Sekolah' },
      '08159185700':  { id: 'usr_guru_004', name: 'Mira Nurdianti, S.Pd', role: 'GURU', position: 'Tata Usaha (TU)' },
      '0881024136818':{ id: 'usr_guru_005', name: 'Fitri Ani Rahayu', role: 'GURU', position: 'Guru Mapel Matematika' },
      '089611651623': { id: 'usr_guru_006', name: 'Nurul Fahriya, S.Pd., G.r', role: 'GURU', position: 'Wakasek Kurikulum' },
      '08989462357':  { id: 'usr_guru_007', name: 'Septi Nur Aeni, S.E', role: 'GURU', position: 'Guru Mapel B. Indonesia' },
      '081646035486': { id: 'usr_guru_008', name: 'Windiani, S.E., G.r', role: 'GURU', position: 'Bendahara Sekolah' },
      '085885460842': { id: 'usr_guru_009', name: 'Widianingsih, S.Si., G.r', role: 'GURU', position: 'Guru Mapel IPA' },
      '085122948690': { id: 'usr_guru_010', name: 'Mawar Andinia, S.Pd., G.r', role: 'GURU', position: 'Bimbingan Konseling (BK)' },
    };

    const foundOfficial = officialTeachers[dto.identity.trim()];

    if (foundOfficial) {
      role = foundOfficial.role;
      name = foundOfficial.name;
      position = foundOfficial.position;
      userId = foundOfficial.id;
    } else if (dto.identity.toUpperCase().includes('KEPSEK') || dto.identity.startsWith('1975')) {
      role = 'KEPSEK';
      name = 'Drs. H. M. Yusuf, M.Pd.';
      position = 'Kepala Sekolah Utama';
      nip = null;
      userId = 'usr_kepsek_1001';
    } else if (
      dto.identity.toUpperCase().includes('ADMIN') ||
      dto.identity.toUpperCase().includes('OPERATOR') ||
      dto.identity === '0895351251395' ||
      dto.identity.startsWith('1995')
    ) {
      role = 'ADMIN';
      name = 'Rina Fitriani, S.Kom.';
      position = 'Admin Website & IT Sekolah';
      nip = null;
      userId = 'usr_admin_1001';
    }

    const mockUser: UserProfile = {
      id: userId,
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
        nip: null,
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
        nip: null,
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
      nip: null,
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
        message: '🔒 Keamanan Perangkat Presensi: HP ini telah terikat aktif dengan akun Anda (1 Akun = 1 HP).',
        registered_uuid: currentDeviceUUID,
      };
    }

    if (boundUUID === currentDeviceUUID) {
      return {
        status: 'ACTIVE',
        message: '🔒 Keamanan Perangkat Presensi: HP ini telah terikat aktif dengan akun Anda (1 Akun = 1 HP).',
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

    const vMethod: VerificationMethod = dto.verification_method || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC_GPS' : 'QR_GPS');
    const aSource: AttendanceSource = dto.attendance_source || (dto.qr_seed?.includes('BIOMETRIC') ? 'BIOMETRIC' : 'QR');

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
            verification_method: vMethod,
            attendance_source: aSource,
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
            verification_method: vMethod,
            attendance_source: aSource,
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
          verification_method: vMethod,
          attendance_source: aSource,
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
        verification_method: vMethod,
        attendance_source: aSource,
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

    // AUTOMATIC TEACHER POINT RECORDING (Check-in On-Time / Late & Duty Piket)
    if (action === 'CHECK_IN') {
      try {
        const isLate = record.status === 'TERLAMBAT';
        const attendancePts = isLate ? 5 : 15;
        const attendanceType: TeacherPointActivityType = isLate ? 'CHECK_IN_LATE' : 'CHECK_IN_ON_TIME';
        const attendanceTitle = isLate
          ? 'Presensi Masuk Sekolah (> 07:30 WIB)'
          : 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)';
        const attendanceDesc = `Tercatat hadir pada pukul ${timeStr} via ${record.verification_method || 'QR'}`;

        await this.recordTeacherPoint({
          user_id: userId,
          teacher_name: sessionUser?.full_name || undefined,
          date: dateStr,
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
              s.day_of_week === todayDayOfWeek &&
              (s.teacher_id === userId ||
                (sessionUser?.full_name &&
                  s.teacher_name &&
                  s.teacher_name.toLowerCase().includes(sessionUser.full_name.toLowerCase())))
          );

          if (isDutyToday) {
            await this.recordTeacherPoint({
              user_id: userId,
              teacher_name: sessionUser?.full_name || undefined,
              date: dateStr,
              points: 10,
              activity_type: 'DUTY_PIKET',
              title: 'Tugas Piket Harian Sekolah',
              description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah',
            });
          }
        } catch (eDuty) {
          console.warn('Failed to verify duty schedule for points:', eDuty);
        }
      } catch (e) {
        console.warn('Failed to auto-record teacher points on check-in:', e);
      }
    } else if (action === 'CHECK_OUT') {
      try {
        const checkoutPts = 10;
        const checkoutTitle = 'Presensi Pulang Tuntas Bertugas';
        const checkoutDesc = `Tercatat menyelesaikan dinas sekolah pada pukul ${timeStr} via ${record.verification_method || 'QR'}`;

        await this.recordTeacherPoint({
          user_id: userId,
          teacher_name: sessionUser?.full_name || undefined,
          date: dateStr,
          points: checkoutPts,
          activity_type: 'CHECK_OUT',
          title: checkoutTitle,
          description: checkoutDesc,
        });
      } catch (ePoint) {
        console.warn('Failed to auto-record teacher points on check-out:', ePoint);
      }
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
    const ALL_KEY = 'smart_absensi_all_attendance_history';
    try {
      const savedAll = safeGetStorage(ALL_KEY);
      if (savedAll) {
        const allRecords: AttendanceRecord[] = JSON.parse(savedAll);
        if (Array.isArray(allRecords)) {
          const match = allRecords.find((r) => r.user_id === userId && r.date === todayStr);
          if (match) return match;
        }
      }
    } catch (e) {
      console.error('Failed to parse all attendance history in getTodayAttendance:', e);
    }

    const saved = safeGetStorage(`smart_absensi_today_attendance_${userId}_${todayStr}`);
    if (saved) {
      try {
        const parsed: AttendanceRecord = JSON.parse(saved);
        if (parsed && parsed.user_id === userId && parsed.date === todayStr) {
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse today attendance:', e);
      }
    }

    const globalSaved = safeGetStorage('smart_absensi_today_attendance');
    if (globalSaved) {
      try {
        const parsed: AttendanceRecord = JSON.parse(globalSaved);
        if (parsed && parsed.user_id === userId && parsed.date === todayStr) {
          return parsed;
        }
      } catch (e) {}
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
    const savedToday = safeGetStorage(`smart_absensi_today_attendance_${userId}_${todayStr}`);
    if (savedToday) {
      try {
        const rec: AttendanceRecord = JSON.parse(savedToday);
        if (rec && rec.user_id === userId && rec.date === todayStr && !allRecords.some((r) => r.user_id === userId && r.date === rec.date)) {
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
      let checkinEnd: string = CONSTANTS.DEFAULTS.WORK_CHECKIN_END;
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
      notes: dto.notes || dto.reason,
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

  public async resetAttendance(targetUserId: string, date: string, adminPasswordInput: string, _token: string): Promise<boolean> {
    await new Promise((r) => setTimeout(r, 200));

    // 1. Fetch system settings to verify Admin Reset Password
    const settings = await this.getSettings();
    if (!settings.admin_reset_password || settings.admin_reset_password.trim() === '') {
      throw new Error(
        'Password Reset Absensi belum diatur oleh Admin. Silakan buat/atur password reset terlebih dahulu di menu Pengaturan Sistem (Sandi Keamanan Reset Absensi Admin)!'
      );
    }

    if (!adminPasswordInput || adminPasswordInput.trim() !== settings.admin_reset_password.trim()) {
      throw new Error('Password Reset Absensi Admin Salah! Silakan periksa kembali password reset yang Anda masukkan.');
    }

    // 2. Remove record from global history storage
    const ALL_KEY = 'smart_absensi_all_attendance_history';
    try {
      const savedAll = safeGetStorage(ALL_KEY);
      let allRecords: AttendanceRecord[] = savedAll ? JSON.parse(savedAll) : [];
      if (Array.isArray(allRecords)) {
        allRecords = allRecords.filter((r) => !(r.user_id === targetUserId && r.date === date));
        safeSetStorage(ALL_KEY, JSON.stringify(allRecords));
      }
    } catch (e) {
      console.error('Failed to reset attendance from all history:', e);
    }

    // 3. Clean local storage for target user's today attendance if date matches today
    const todayStr = getTodayDateInJakarta();
    if (date === todayStr) {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(`smart_absensi_today_attendance_${targetUserId}_${todayStr}`);

        // Also check if global smart_absensi_today_attendance matches this user
        const globalSaved = safeGetStorage('smart_absensi_today_attendance');
        if (globalSaved) {
          try {
            const parsed: AttendanceRecord = JSON.parse(globalSaved);
            if (parsed.user_id === targetUserId && parsed.date === todayStr) {
              localStorage.removeItem('smart_absensi_today_attendance');
            }
          } catch (e) {}
        }
      }
    }

    // 4. Trigger real-time UI refresh events
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('smart_absensi_scanned'));
      window.dispatchEvent(new Event('smart_absensi_records_updated'));
    }

    return true;
  }

  public async updateAttendanceNote(userId: string, date: string, note: string, _token: string): Promise<boolean> {
    const ALL_KEY = 'smart_absensi_all_attendance_history';
    try {
      const savedAll = safeGetStorage(ALL_KEY);
      let allRecords: AttendanceRecord[] = savedAll ? JSON.parse(savedAll) : [];
      if (!Array.isArray(allRecords)) allRecords = [];

      const idx = allRecords.findIndex((r) => (r.user_id === userId || (Boolean(r.user_id) && r.user_id.includes(userId))) && r.date === date);
      if (idx >= 0) {
        allRecords[idx] = {
          ...allRecords[idx],
          notes: note,
        };
        safeSetStorage(ALL_KEY, JSON.stringify(allRecords));
      } else {
        const newRecord: AttendanceRecord = {
          id: `att_${userId}_${date}`,
          user_id: userId,
          date,
          check_in_time: '07:35:00',
          check_out_time: null,
          status: 'TERLAMBAT',
          verification_method: 'QR_GPS',
          attendance_source: 'QR',
          check_in_lat: -6.2,
          check_in_lng: 106.8,
          check_in_distance_meters: 15,
          is_offline: false,
          notes: note,
          created_at: new Date().toISOString(),
        };
        allRecords.push(newRecord);
        safeSetStorage(ALL_KEY, JSON.stringify(allRecords));
      }

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smart_absensi_records_updated'));
      }
      return true;
    } catch (e) {
      console.warn('Failed to update attendance note:', e);
      return false;
    }
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

  private getInitialMockLeaves(): LeaveRequest[] {
    const saved = safeGetStorage('smart_absensi_leaves');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse saved leaves in MockProvider:', e);
      }
    }

    const defaultLeaves: LeaveRequest[] = [
      {
        id: 'leave_demo_01',
        user_id: 'usr_guru_01',
        leave_type: 'CUTI',
        start_date: new Date().toISOString().substring(0, 10),
        end_date: new Date().toISOString().substring(0, 10),
        reason: 'Permohonan Cuti Tahunan untuk Keperluan Keluarga',
        approval_status: 'PENDING',
        attachment_url: null,
        approval_deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      },
      {
        id: 'leave_demo_02',
        user_id: 'usr_guru_02',
        leave_type: 'SAKIT',
        start_date: new Date().toISOString().substring(0, 10),
        end_date: new Date().toISOString().substring(0, 10),
        reason: 'Pemeriksaan Kesehatan dan Rawat Jalan di Rumah Sakit',
        approval_status: 'PENDING',
        attachment_url: null,
        approval_deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    safeSetStorage('smart_absensi_leaves', JSON.stringify(defaultLeaves));
    return defaultLeaves;
  }

  public async approveLeave(leaveId: string, decision: 'APPROVED' | 'REJECTED', notes: string, _token: string): Promise<boolean> {
    const leaves = this.getInitialMockLeaves();
    const activeUser = useAuthStore.getState().user;
    let targetIdx = leaves.findIndex((l) => l.id === leaveId);
    let targetLeave: LeaveRequest;

    if (targetIdx !== -1) {
      leaves[targetIdx] = {
        ...leaves[targetIdx],
        approval_status: decision,
        approval_notes: notes,
        approved_by: activeUser?.full_name || 'Kepala Sekolah',
      };
      targetLeave = leaves[targetIdx];
    } else {
      // If leave record was not in mock storage yet, append updated synthetic record
      targetLeave = {
        id: leaveId,
        user_id: 'usr_guru',
        leave_type: 'IZIN',
        start_date: new Date().toISOString().substring(0, 10),
        end_date: new Date().toISOString().substring(0, 10),
        reason: 'Pengajuan Izin Presensi Guru',
        approval_status: decision,
        approval_notes: notes,
        approved_by: activeUser?.full_name || 'Kepala Sekolah',
        attachment_url: null,
        approval_deadline: new Date(Date.now() + 3 * 24 * 3600 * 1000).toISOString(),
        created_at: new Date().toISOString(),
      };
      leaves.push(targetLeave);
    }

    safeSetStorage('smart_absensi_leaves', JSON.stringify(leaves));

    // Trigger Push Notification for Guru & Sync Attendance Record
    if (decision === 'APPROVED') {
      let leaveStatus: AttendanceStatus = 'IZIN';
      let checkInTime: string | null = null;
      let checkOutTime: string | null = null;

      if (targetLeave.leave_type === 'KOREKSI_ABSEN') {
        const reasonText = targetLeave.reason || '';
        if (reasonText.includes('menjadi HADIR') || reasonText.includes('Target Koreksi') || !reasonText.includes('menjadi ')) {
          leaveStatus = 'HADIR';
        } else if (reasonText.includes('menjadi SAKIT')) {
          leaveStatus = 'SAKIT';
        } else if (reasonText.includes('menjadi DINAS_LUAR')) {
          leaveStatus = 'DINAS_LUAR';
        } else if (reasonText.includes('menjadi ALFA')) {
          leaveStatus = 'ALFA';
        }

        // Try extracting check-in / check-out time from reason
        const inMatch = reasonText.match(/Masuk\s*\(([0-2]?[0-9]:[0-5][0-9])/i);
        if (inMatch) checkInTime = `${inMatch[1]}:00`;
        const outMatch = reasonText.match(/Pulang\s*\(([0-2]?[0-9]:[0-5][0-9])/i);
        if (outMatch) checkOutTime = `${outMatch[1]}:00`;

        if (leaveStatus === 'HADIR' && !checkInTime) {
          checkInTime = '07:00:00';
        }
      } else {
        leaveStatus =
          targetLeave.leave_type === 'SAKIT' ? 'SAKIT' : targetLeave.leave_type === 'DINAS_LUAR' ? 'DINAS_LUAR' : 'IZIN';
      }

      const startDate = new Date(targetLeave.start_date);
      const endDate = new Date(targetLeave.end_date);
      const curr = new Date(startDate);

      const ALL_KEY = 'smart_absensi_all_attendance_history';
      const todayStr = getTodayDateInJakarta();
      let allRecords: AttendanceRecord[] = [];
      try {
        const savedAll = safeGetStorage(ALL_KEY);
        if (savedAll) {
          allRecords = JSON.parse(savedAll);
          if (!Array.isArray(allRecords)) allRecords = [];
        }
      } catch (e) {
        allRecords = [];
      }

      while (curr <= endDate) {
        const dateStr = curr.toISOString().substring(0, 10);
        const existingIdx = allRecords.findIndex((r) => r.user_id === targetLeave.user_id && r.date === dateStr);

        const newRec: AttendanceRecord = {
          id: existingIdx !== -1 ? allRecords[existingIdx].id : 'att_leave_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          user_id: targetLeave.user_id,
          date: dateStr,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
          status: leaveStatus,
          check_in_lat: null,
          check_in_lng: null,
          check_in_distance_meters: null,
          verification_method: 'MANUAL_OPERATOR',
          attendance_source: 'MANUAL',
          is_offline: false,
          notes: targetLeave.leave_type === 'KOREKSI_ABSEN' ? `Koreksi Disetujui: ${notes || targetLeave.reason}` : `Izin Disetujui Kepsek: ${notes || targetLeave.reason}`,
          created_at: new Date().toISOString(),
        };

        if (existingIdx !== -1) {
          allRecords[existingIdx] = newRec;
        } else {
          allRecords.push(newRec);
        }

        safeSetStorage(`smart_absensi_daily_attendance_${dateStr}`, JSON.stringify([newRec]));
        if (dateStr === todayStr) {
          safeSetStorage(`smart_absensi_today_attendance_${targetLeave.user_id}_${todayStr}`, JSON.stringify(newRec));
        }
        curr.setDate(curr.getDate() + 1);
      }

      safeSetStorage(ALL_KEY, JSON.stringify(allRecords));
      safeSetStorage('smart_absensi_daily_attendance', JSON.stringify(allRecords));
    }

    const notifKey = `smart_absensi_notifications_${targetLeave.user_id}`;
    const savedNotifs = safeGetStorage(notifKey);
    let notifs: AppNotification[] = [];
    if (savedNotifs) {
      try {
        notifs = JSON.parse(savedNotifs);
      } catch (e) {
        notifs = [];
      }
    }
    const newNotif: AppNotification = {
      id: 'notif_leave_' + Date.now(),
      user_id: targetLeave.user_id,
      title: decision === 'APPROVED' ? '✅ Pengajuan Izin Disetujui' : '❌ Pengajuan Izin Ditolak',
      message: decision === 'APPROVED'
        ? `Pengajuan ${targetLeave.leave_type} Anda (${targetLeave.start_date}) telah DISETUJUI oleh Kepala Sekolah.`
        : `Pengajuan ${targetLeave.leave_type} Anda (${targetLeave.start_date}) DITOLAK oleh Kepala Sekolah.${notes ? ` Alasan: ${notes}` : ''}`,
      type: decision === 'APPROVED' ? 'SUCCESS' : 'WARNING',
      is_read: false,
      created_at: new Date().toISOString(),
    };
    notifs.unshift(newNotif);
    safeSetStorage(notifKey, JSON.stringify(notifs));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('smart_absensi_leave_updated'));
      window.dispatchEvent(new CustomEvent('smart_absensi_records_updated'));
      window.dispatchEvent(new CustomEvent('smart_absensi_notification_pushed'));
    }

    return true;
  }

  public async getPendingLeaves(_token: string): Promise<LeaveRequest[]> {
    const list = this.getInitialMockLeaves();
    return list
      .filter((l) => l.approval_status === 'PENDING' || l.approval_status === 'SUBMITTED' || l.approval_status === 'UNDER_REVIEW' || !l.approval_status)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getAllLeaves(_token: string): Promise<LeaveRequest[]> {
    const list = this.getInitialMockLeaves();
    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getUserLeaves(userId: string, _token: string): Promise<LeaveRequest[]> {
    const list = this.getInitialMockLeaves();
    return list
      .filter((l) => l.user_id === userId || !l.user_id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async getNotifications(userId: string, _token: string): Promise<AppNotification[]> {
    const key = `smart_absensi_notifications_${userId}`;
    const saved = safeGetStorage(key);
    let items: AppNotification[] = [];

    if (saved) {
      try {
        items = JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse notifications:', e);
      }
    }

    if (!items || items.length === 0) {
      items = [
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
      safeSetStorage(key, JSON.stringify(items));
    }

    const readIds = NotificationService.getReadNotificationIds(userId);
    return items.map((n) => ({
      ...n,
      is_read: Boolean(n.is_read) || readIds.has(n.id),
    }));
  }

  public async markNotificationAsRead(notificationId: string, token: string): Promise<boolean> {
    const sessionUser = useAuthStore.getState().user;
    const userId = sessionUser?.id || 'usr_uuid_1001';
    NotificationService.markIdAsRead(userId, notificationId);

    const key = `smart_absensi_notifications_${userId}`;
    const notifications = await this.getNotifications(userId, token);
    const updated = notifications.map((n) => (n.id === notificationId ? { ...n, is_read: true } : n));
    safeSetStorage(key, JSON.stringify(updated));
    return true;
  }

  public async markNotificationsAsRead(
    userIdOrIds: string | string[],
    idsOrToken?: string[] | string,
    _token?: string
  ): Promise<boolean> {
    let effectiveUserId: string;
    let notificationIds: string[];

    if (Array.isArray(userIdOrIds)) {
      notificationIds = userIdOrIds;
      effectiveUserId =
        typeof idsOrToken === 'string' &&
        !idsOrToken.startsWith('mock-jwt-') &&
        !idsOrToken.startsWith('MOCK_') &&
        idsOrToken
          ? idsOrToken
          : useAuthStore.getState().user?.id || 'usr_uuid_1001';
    } else {
      effectiveUserId = userIdOrIds || useAuthStore.getState().user?.id || 'usr_uuid_1001';
      notificationIds = Array.isArray(idsOrToken) ? idsOrToken : [];
    }

    NotificationService.markAllIdsAsRead(effectiveUserId, notificationIds);

    const key = `smart_absensi_notifications_${effectiveUserId}`;
    const notifications = await this.getNotifications(effectiveUserId, _token || '');
    const idSet = new Set(notificationIds);
    const updated = notifications.map((n) => (idSet.has(n.id) ? { ...n, is_read: true } : n));
    safeSetStorage(key, JSON.stringify(updated));
    return true;
  }

  public async getNotificationPreferences(userId: string, _token?: string): Promise<NotificationPreferences | null> {
    const effectiveUserId = userId || useAuthStore.getState().user?.id || 'usr_uuid_1001';
    const key = `smart_absensi_notif_prefs_${effectiveUserId}`;
    const saved = safeGetStorage(key);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          user_id: effectiveUserId,
          push_enabled: parsed.push_enabled ?? true,
          attendance_enabled: parsed.attendance_enabled ?? parsed.attendance_alerts ?? true,
          leave_enabled: parsed.leave_enabled ?? parsed.leave_alerts ?? true,
          schedule_enabled: parsed.schedule_enabled ?? parsed.event_alerts ?? true,
          announcement_enabled: parsed.announcement_enabled ?? true,
          critical_enabled: parsed.critical_enabled ?? true,
          voice_enabled: parsed.voice_enabled ?? true,
          sound_enabled: parsed.sound_enabled ?? true,
          attendance_sound_enabled: parsed.attendance_sound_enabled ?? true,
          chime_enabled: parsed.chime_enabled ?? true,
          auto_greeting_enabled: parsed.auto_greeting_enabled ?? false,
          quiet_hours_enabled: parsed.quiet_hours_enabled ?? false,
          quiet_hours_start: parsed.quiet_hours_start ?? '21:00',
          quiet_hours_end: parsed.quiet_hours_end ?? '05:00',
          attendance_alerts: parsed.attendance_alerts ?? parsed.attendance_enabled ?? true,
          leave_alerts: parsed.leave_alerts ?? parsed.leave_enabled ?? true,
          event_alerts: parsed.event_alerts ?? parsed.schedule_enabled ?? true,
          ...parsed,
        };
      } catch (e) {
        console.error('Failed to parse notification preferences:', e);
      }
    }
    return {
      user_id: effectiveUserId,
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
      quiet_hours_enabled: false,
      quiet_hours_start: '21:00',
      quiet_hours_end: '05:00',
      attendance_alerts: true,
      leave_alerts: true,
      event_alerts: true,
      updated_at: new Date().toISOString(),
    };
  }

  public async saveNotificationPreferences(
    userIdOrPrefs: string | Partial<NotificationPreferences>,
    prefsOrToken?: Partial<NotificationPreferences> | string,
    _token?: string
  ): Promise<NotificationPreferences> {
    const prefs: Partial<NotificationPreferences> =
      typeof userIdOrPrefs === 'string'
        ? ((prefsOrToken as Partial<NotificationPreferences>) || {})
        : userIdOrPrefs;
    const userId = prefs?.user_id || (typeof userIdOrPrefs === 'string' ? userIdOrPrefs : 'unknown');
    const key = `smart_absensi_notif_prefs_${userId}`;
    const toSave: NotificationPreferences = {
      ...prefs,
      user_id: userId,
      push_enabled: prefs?.push_enabled ?? true,
      attendance_enabled: prefs?.attendance_alerts ?? prefs?.attendance_enabled ?? true,
      leave_enabled: prefs?.leave_alerts ?? prefs?.leave_enabled ?? true,
      schedule_enabled: prefs?.event_alerts ?? prefs?.schedule_enabled ?? true,
      announcement_enabled: prefs?.announcement_enabled ?? true,
      critical_enabled: prefs?.critical_enabled ?? true,
      voice_enabled: prefs?.voice_enabled ?? true,
      sound_enabled: prefs?.sound_enabled ?? true,
      attendance_sound_enabled: prefs?.attendance_sound_enabled ?? true,
      chime_enabled: prefs?.chime_enabled ?? true,
      auto_greeting_enabled: prefs?.auto_greeting_enabled ?? false,
      quiet_hours_enabled: prefs?.quiet_hours_enabled ?? false,
      quiet_hours_start: prefs?.quiet_hours_start ?? '21:00',
      quiet_hours_end: prefs?.quiet_hours_end ?? '05:00',
      attendance_alerts: prefs?.attendance_alerts ?? prefs?.attendance_enabled ?? true,
      leave_alerts: prefs?.leave_alerts ?? prefs?.leave_enabled ?? true,
      event_alerts: prefs?.event_alerts ?? prefs?.schedule_enabled ?? true,
      updated_at: new Date().toISOString(),
    };
    safeSetStorage(key, JSON.stringify(toSave));
    return toSave;
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
    const saved = safeGetStorage('smart_absensi_teachers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Failed to parse cached teachers:', e);
      }
    }
    const defaultUsers: UserProfile[] = [
      {
        id: 'usr_admin_1001',
        nip: null,
        full_name: 'Rina Fitriani, S.Kom.',
        phone_number: '0895351251395',
        role: 'ADMIN',
        position: 'Admin Website & IT Sekolah',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_kepsek_1001',
        nip: null,
        full_name: 'Drs. H. M. Yusuf, M.Pd.',
        phone_number: '081234567891',
        role: 'KEPSEK',
        position: 'Kepala Sekolah Utama',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_guru_1001',
        nip: null,
        full_name: 'Guru Pengajar, S.Pd',
        phone_number: '081234567890',
        role: 'GURU',
        position: 'Guru Utama / Pendidik',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];
    safeSetStorage('smart_absensi_teachers', JSON.stringify(defaultUsers));
    return defaultUsers;
  }

  public async createUser(user: Partial<UserProfile>, _token: string): Promise<UserProfile> {
    const newUser: UserProfile = {
      id: user.id || 'usr_mock_' + Date.now(),
      nip: user.nip ? user.nip.trim() : null,
      full_name: user.full_name || '',
      phone_number: user.phone_number || '',
      role: user.role || 'GURU',
      position: user.position || '',
      avatar_url: user.avatar_url || null,
      is_active: user.is_active !== undefined ? user.is_active : true,
      created_at: new Date().toISOString(),
    };
    const allUsers = await this.getAllUsers(_token);
    const updated = [...allUsers.filter((u) => u.id !== newUser.id), newUser];
    safeSetStorage('smart_absensi_teachers', JSON.stringify(updated));
    return newUser;
  }

  public async updateUser(userId: string, updates: Partial<UserProfile>, _token: string): Promise<boolean> {
    const allUsers = await this.getAllUsers(_token);
    const updated = allUsers.map((u) => (u.id === userId || (u.nip && u.nip === userId) ? { ...u, ...updates } : u));
    safeSetStorage('smart_absensi_teachers', JSON.stringify(updated));

    const activeUser = useAuthStore.getState().user;
    if (activeUser && (activeUser.id === userId || (activeUser.nip && activeUser.nip === userId))) {
      useAuthStore.getState().updateUserProfile(updates);
    }
    return true;
  }

  public async uploadAvatar(userId: string, file: File): Promise<string> {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });

    await this.updateUser(userId, { avatar_url: dataUrl }, '');
    return dataUrl;
  }

  public async deleteUser(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  public async toggleUserStatus(_userId: string, _token: string): Promise<boolean> {
    return true;
  }

  // Academic Calendar & Holidays API Implementation
  public async getHolidays(_token?: string): Promise<HolidayRecord[]> {
    const paydays2026 = generatePaydayEventsForYear(2026);

    const saved = safeGetStorage('smart_absensi_holidays');
    if (saved) {
      try {
        const parsed: HolidayRecord[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Pastikan 12 Hari Gajian bulanan (setiap tanggal 10) tersinkronisasi
          const missingPaydays = paydays2026.filter(
            (p) => !parsed.some((item) => item.date === p.date && item.name.toLowerCase().includes('gajian'))
          );
          if (missingPaydays.length > 0) {
            const merged = [...parsed, ...missingPaydays].sort((a, b) => a.date.localeCompare(b.date));
            safeSetStorage('smart_absensi_holidays', JSON.stringify(merged));
            return merged;
          }
          return parsed;
        }
      } catch (e) {
        console.error('Failed to parse saved holidays:', e);
      }
    }

    const baseHolidays: HolidayRecord[] = [
      { id: 'hol_1001', date: '2026-01-01', name: 'Tahun Baru 2026 Masehi', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Nasional', created_at: new Date().toISOString() },
      { id: 'hol_1002', date: '2026-01-05', name: 'Rapat Dinas Awal Semester Genap', type: 'RAPAT', category_type: 'SCHEDULE', is_holiday: false, description: 'Rapat koordinasi guru dan wali kelas di aula utama (Tetap Presensi)', created_at: new Date().toISOString() },
      { id: 'hol_1003', date: '2026-01-16', name: 'Isra Mikraj Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1004', date: '2026-02-17', name: 'Tahun Baru Imlek 2577 Kongzili', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1005', date: '2026-03-09', name: 'Pekan Penilaian Tengah Semester (PTS)', type: 'UJIAN', category_type: 'SCHEDULE', is_holiday: false, description: 'Pelaksanaan ujian tertulis & CBT untuk siswa seluruh kelas', created_at: new Date().toISOString() },
      { id: 'hol_1006', date: '2026-03-19', name: 'Hari Raya Nyepi (Saka 1948)', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1007', date: '2026-03-20', name: 'Hari Raya Idul Fitri 1447 H (Hari 1)', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1008', date: '2026-03-21', name: 'Hari Raya Idul Fitri 1447 H (Hari 2)', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1009', date: '2026-03-22', name: 'Cuti Bersama Idul Fitri 1447 H', type: 'CUTI_BERSAMA', category_type: 'HOLIDAY', is_holiday: true, description: 'Cuti Bersama Pemerintah', created_at: new Date().toISOString() },
      { id: 'hol_1010', date: '2026-03-23', name: 'Cuti Bersama Idul Fitri 1447 H', type: 'CUTI_BERSAMA', category_type: 'HOLIDAY', is_holiday: true, description: 'Cuti Bersama Pemerintah', created_at: new Date().toISOString() },
      { id: 'hol_1011', date: '2026-04-03', name: 'Wafat Yesus Kristus', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1012', date: '2026-05-01', name: 'Hari Buruh Internasional', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Nasional', created_at: new Date().toISOString() },
      { id: 'hol_1013', date: '2026-05-14', name: 'Kenaikan Yesus Kristus', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1014', date: '2026-05-27', name: 'Hari Raya Waisak 2570 BE', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1015', date: '2026-06-01', name: 'Hari Lahir Pancasila', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Nasional', created_at: new Date().toISOString() },
      { id: 'hol_1016', date: '2026-06-08', name: 'Penilaian Akhir Tahun (PAT) Genap', type: 'UJIAN', category_type: 'SCHEDULE', is_holiday: false, description: 'Pekan ujian semester genap tahun ajaran 2025/2026', created_at: new Date().toISOString() },
      { id: 'hol_1017', date: '2026-06-15', name: 'Rapat Pleno Kenaikan Kelas & Kelulusan', type: 'RAPAT', category_type: 'SCHEDULE', is_holiday: false, description: 'Rapat dewan guru penentuan kelulusan dan kenaikan kelas', created_at: new Date().toISOString() },
      { id: 'hol_1018', date: '2026-06-22', name: 'Libur Kenaikan Kelas (Semester Genap)', type: 'SCHOOL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Sekolah Terpadu', created_at: new Date().toISOString() },
      { id: 'hol_1019', date: '2026-06-23', name: 'Libur Kenaikan Kelas (Semester Genap)', type: 'SCHOOL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Sekolah Terpadu', created_at: new Date().toISOString() },
      { id: 'hol_1020', date: '2026-08-17', name: 'Proklamasi Kemerdekaan RI Ke-81', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'HUT Kemerdekaan Indonesia', created_at: new Date().toISOString() },
      { id: 'hol_1021', date: '2026-08-25', name: 'Maulid Nabi Muhammad SAW', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1022', date: '2026-11-25', name: 'Upacara Hari Guru Nasional (HGN)', type: 'UPACARA', category_type: 'SCHEDULE', is_holiday: false, description: 'Apel peringatan Hari Guru Nasional di lapangan utama', created_at: new Date().toISOString() },
      { id: 'hol_1023', date: '2026-12-25', name: 'Hari Raya Natal', type: 'NATIONAL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Keagamaan', created_at: new Date().toISOString() },
      { id: 'hol_1024', date: '2026-12-28', name: 'Libur Akhir Semester Ganjil T.A 2026/2027', type: 'SCHOOL_HOLIDAY', category_type: 'HOLIDAY', is_holiday: true, description: 'Libur Semester Sekolah', created_at: new Date().toISOString() },
    ];

    const defaultHolidays: HolidayRecord[] = [...paydays2026, ...baseHolidays].sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    safeSetStorage('smart_absensi_holidays', JSON.stringify(defaultHolidays));
    return defaultHolidays;
  }

  public async createHoliday(holiday: Omit<HolidayRecord, 'id' | 'created_at'>, _token?: string): Promise<HolidayRecord> {
    const list = await this.getHolidays();
    const isSchedule =
      holiday.category_type === 'SCHEDULE' ||
      holiday.is_holiday === false ||
      (holiday.is_holiday === undefined &&
        ['RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP', 'OTHER'].includes(holiday.type));

    const newRecord: HolidayRecord = {
      ...holiday,
      category_type: holiday.category_type || (isSchedule ? 'SCHEDULE' : 'HOLIDAY'),
      is_holiday: holiday.is_holiday !== undefined ? holiday.is_holiday : !isSchedule,
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

  public async getBurnoutAnalytics(month?: string, year?: string, _token?: string): Promise<BurnoutAnalytics> {
    const today = getTodayDateInJakarta();
    const targetYear = year || today.substring(0, 4);
    const targetMonth = month !== undefined ? month : String(parseInt(today.substring(5, 7), 10));

    const raw = safeGetStorage('smart_absensi_teacher_moods');
    let allLogs: TeacherMoodLog[] = [];
    if (raw) {
      try {
        allLogs = JSON.parse(raw);
      } catch {
        allLogs = [];
      }
    }

    // Filter by period:
    let logs: TeacherMoodLog[] = [];
    if (targetMonth === 'ALL') {
      // Yearly recap: filter by year
      logs = allLogs.filter((log) => log.date && log.date.startsWith(`${targetYear}-`));
    } else {
      // Monthly recap: filter by year and month
      const monthPad = String(targetMonth).padStart(2, '0');
      logs = allLogs.filter((log) => log.date && log.date.startsWith(`${targetYear}-${monthPad}`));
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
    const raw = safeGetStorage('smart_absensi_duty_schedules');
    if (raw !== null) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch (e) {
        console.warn('Failed to parse duty schedules from storage:', e);
      }
    }

    // Return empty array by default so Admin can populate the actual school teachers
    return [];
  }

  public async saveDutySchedules(
    schedules: Omit<TeacherDutySchedule, 'id' | 'created_at'>[],
    _token?: string
  ): Promise<boolean> {
    const formatted: TeacherDutySchedule[] = schedules.map((item) => ({
      ...item,
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : '00000000-0000-4000-8000-' + Math.random().toString(16).substring(2, 14),
      created_at: new Date().toISOString(),
    }));

    safeSetStorage('smart_absensi_duty_schedules', JSON.stringify(formatted));
    return true;
  }

  // ─── ANONYMOUS TEACHER COMPLAINTS & FEEDBACK API ──────────────────────────

  private getStorageComplaints(): TeacherComplaint[] {
    const raw = safeGetStorage('smart_absensi_teacher_complaints');
    if (!raw) return [];
    try {
      const list: TeacherComplaint[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        // Purge any legacy sample seed dummy items
        const cleanList = list.filter((c) => !c.id.startsWith('comp_sample_'));
        if (cleanList.length !== list.length) {
          safeSetStorage('smart_absensi_teacher_complaints', JSON.stringify(cleanList));
        }
        return cleanList;
      }
    } catch {
      // ignore parse error
    }
    return [];
  }

  public async submitComplaint(
    userId: string,
    dto: SubmitComplaintDTO,
    _token?: string
  ): Promise<TeacherComplaint> {
    const list = this.getStorageComplaints();

    const todayStr = getTodayDateInJakarta();
    const newComplaint: TeacherComplaint = {
      id: 'comp_' + (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
      user_id: userId,
      date: todayStr,
      category: dto.category,
      content: dto.content.trim(),
      status: 'SUBMITTED',
      admin_response: null,
      responded_at: null,
      responded_by_role: null,
      is_anonymous: dto.is_anonymous ?? true,
      created_at: new Date().toISOString(),
    };

    list.unshift(newComplaint);
    safeSetStorage('smart_absensi_teacher_complaints', JSON.stringify(list));

    return newComplaint;
  }

  public async getUserComplaints(userId: string, _token?: string): Promise<TeacherComplaint[]> {
    const list = this.getStorageComplaints();
    return list.filter((c) => c.user_id === userId);
  }

  public async getAllComplaints(_token?: string): Promise<TeacherComplaint[]> {
    const list = this.getStorageComplaints();
    
    // Strict Anonymity: Mask user_id to 'ANONYMOUS' so neither Admin nor Kepsek can trace the author
    return list.map((c) => ({
      ...c,
      user_id: 'ANONYMOUS',
    }));
  }

  public async updateComplaintStatus(
    dto: UpdateComplaintStatusDTO,
    _token?: string
  ): Promise<boolean> {
    const list = this.getStorageComplaints();

    const index = list.findIndex((c) => c.id === dto.complaintId);
    if (index === -1) return false;

    list[index] = {
      ...list[index],
      status: dto.status,
      admin_response: dto.adminResponse !== undefined ? dto.adminResponse.trim() : list[index].admin_response,
      responded_at: dto.adminResponse !== undefined ? new Date().toISOString() : list[index].responded_at,
      responded_by_role: dto.respondedByRole || list[index].responded_by_role || 'ADMIN',
    };

    safeSetStorage('smart_absensi_teacher_complaints', JSON.stringify(list));
    return true;
  }

  // ── TEACHING SCHEDULES API ────────────────────────────────────────────────
  public async getTeachingSchedules(_token?: string): Promise<TeachingSlot[]> {
    const raw = safeGetStorage('smart_absensi_teaching_schedules');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public async saveTeachingSchedules(
    schedules: TeachingSlot[],
    _token?: string
  ): Promise<boolean> {
    safeSetStorage('smart_absensi_teaching_schedules', JSON.stringify(schedules));
    return true;
  }

  // ── STUDENT DIRECTORY & RFID ATTENDANCE API ──────────────────────────────
  public async getStudents(_token?: string): Promise<StudentItem[]> {
    const raw = safeGetStorage('smart_absensi_students');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  public async saveStudents(
    students: StudentItem[],
    _token?: string
  ): Promise<boolean> {
    safeSetStorage('smart_absensi_students', JSON.stringify(students));
    return true;
  }

  public async createStudent(
    student: Omit<StudentItem, 'id' | 'created_at'>,
    token?: string
  ): Promise<StudentItem> {
    const list = await this.getStudents(token);
    const newStudent: StudentItem = {
      ...student,
      id: `std_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    list.unshift(newStudent);
    await this.saveStudents(list, token);
    return newStudent;
  }

  public async updateStudent(
    id: string,
    updates: Partial<StudentItem>,
    token?: string
  ): Promise<boolean> {
    const list = await this.getStudents(token);
    const index = list.findIndex((s) => s.id === id);
    if (index === -1) return false;
    list[index] = { ...list[index], ...updates, updated_at: new Date().toISOString() };
    await this.saveStudents(list, token);
    return true;
  }

  public async deleteStudent(id: string, token?: string): Promise<boolean> {
    const list = await this.getStudents(token);
    const filtered = list.filter((s) => s.id !== id);
    if (filtered.length === list.length) return false;
    await this.saveStudents(filtered, token);
    return true;
  }

  public async syncStudentsFromGradeMaster(
    academicYear = '2026/2027',
    token?: string
  ): Promise<{ syncedCount: number; classesCount: number }> {
    // Initial 2026/2027 roster of promoted & new students for offline / fallback
    const defaultRoster = [
      // Kelas 7 (Siswa Baru)
      { name: 'ADIBA KHANSA AZ-ZAHRA', class: '7' },
      { name: 'AKBAR AZHI MUGHNI', class: '7' },
      { name: 'CALISA CANIA MARYAM', class: '7' },
      { name: 'HANIFAH AL-QUSYARI', class: '7' },
      { name: 'IFHAM FATHAR MUBAROK', class: '7' },
      { name: 'MUHAMAD IBNU ZIKRA', class: '7' },
      // Kelas 8A (Naik dari 7A)
      { name: 'BILQIS AINUN NISSA', class: '8A' },
      { name: 'KIRANA AURA ANWARUDIN', class: '8A' },
      { name: 'NAJWA NUR FADILLAH', class: '8A' },
      { name: 'RADISTI PUTRI RIANTI', class: '8A' },
      { name: 'SUCI RAHMAWATI', class: '8A' },
      { name: 'TASYIRA AFIFA', class: '8A' },
      { name: 'YOLA AULIA SANTOSO', class: '8A' },
      // Kelas 8B (Naik dari 7B)
      { name: 'ABILA YAZID RIZAQI', class: '8B' },
      { name: 'FARDHAN HANIF', class: '8B' },
      { name: 'MARVHEL PUTRA IHSANUL ALIM', class: '8B' },
      { name: 'MUHAMAD RAKA ADITYA', class: '8B' },
      { name: 'ROMADONI', class: '8B' },
      // Kelas 9A (Naik dari 8A)
      { name: 'AJENG ALIFATUL KHOIR', class: '9A' },
      { name: 'AZZAHRA ASHILA ROHMAH', class: '9A' },
      { name: 'FUJI HIKMAH', class: '9A' },
      { name: 'SEPTI MUJIANTI', class: '9A' },
      { name: 'SIFA NURKHALIFAH', class: '9A' },
      // Kelas 9B (Naik dari 8B)
      { name: 'ANDIKA PRATAMA', class: '9B' },
      { name: 'FAIRUZ PRASETIA', class: '9B' },
      { name: 'FARIZ ABQORI MAULANA', class: '9B' },
      { name: 'FITRA RAMADHAN', class: '9B' },
      { name: 'WILDAN KHOER BASUKI', class: '9B' },
      // Kelas SMA
      { name: 'ARNESTA HADIWINATA', class: 'SMA' },
      { name: 'EVIANA', class: 'SMA' },
      { name: 'HAYATUSSIFA', class: 'SMA' },
      { name: 'NAZWATUNNISA', class: 'SMA' },
      { name: 'NYIMAS RANI RAHMAWATI', class: 'SMA' },
    ];

    const currentList = await this.getStudents(token);
    const existingRfid = new Map<string, string>();
    currentList.forEach((s) => {
      if (s.rfidUid) existingRfid.set(`${s.className}|||${s.fullName}`, s.rfidUid);
    });

    const synced: StudentItem[] = defaultRoster.map((item, idx) => {
      const key = `${item.class}|||${item.name}`;
      return {
        id: `std_mock_${item.class.toLowerCase()}_${String(idx + 1).padStart(3, '0')}`,
        nisn: '',
        fullName: item.name,
        className: item.class,
        academicYear,
        gender: item.class === '8A' || item.class === '9A' ? 'P' : 'L',
        rfidUid: existingRfid.get(key) || undefined,
        cardStatus: 'ACTIVE',
        attendanceRate: 100,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });

    await this.saveStudents(synced, token);
    const classes = new Set(synced.map((s) => s.className));
    return {
      syncedCount: synced.length,
      classesCount: classes.size,
    };
  }

  public async recordStudentRfidAttendance(
    rfidUid: string,
    subject = 'Presensi Harian',
    token?: string
  ): Promise<{
    success: boolean;
    student?: StudentItem;
    attendance?: StudentAttendanceRecord;
    message: string;
    isDuplicate?: boolean;
  }> {
    const cleanRfid = rfidUid.trim().toUpperCase();
    const students = await this.getStudents(token);
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
    const rawAttendance = safeGetStorage('smart_absensi_gm_attendance') || '[]';
    let attendanceList: StudentAttendanceRecord[] = [];
    try {
      attendanceList = JSON.parse(rawAttendance);
    } catch {
      attendanceList = [];
    }

    const exist = attendanceList.find(
      (a) => a.studentName === student.fullName && a.className === student.className && a.date === todayDate
    );

    if (exist) {
      return {
        success: true,
        isDuplicate: true,
        student,
        attendance: exist,
        message: `Siswa ${student.fullName} (${student.className}) sudah tercatat hadir hari ini pukul ${exist.checkInTime || currentTime}.`,
      };
    }

    const newRecord: StudentAttendanceRecord = {
      id: `att_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      studentName: student.fullName,
      className: student.className,
      subject,
      academicYear: student.academicYear || '2026/2027',
      status: 'Hadir',
      date: todayDate,
      checkInTime: currentTime,
      rfidUid: cleanRfid,
      createdAt: new Date().toISOString(),
    };

    attendanceList.unshift(newRecord);
    safeSetStorage('smart_absensi_gm_attendance', JSON.stringify(attendanceList));

    // Update last tap
    await this.updateStudent(student.id, { lastTapAt: `${todayDate} ${currentTime}` }, token);

    return {
      success: true,
      student,
      attendance: newRecord,
      message: `Presensi Hadir berhasil dicatat untuk ${student.fullName} (${student.className}) pukul ${currentTime}.`,
    };
  }

  public async getStudentAttendance(
    date: string,
    className?: string,
    academicYear = '2026/2027',
    _token?: string
  ): Promise<StudentAttendanceRecord[]> {
    const raw = safeGetStorage('smart_absensi_gm_attendance') || '[]';
    try {
      const parsed: StudentAttendanceRecord[] = JSON.parse(raw);
      return parsed.filter((r) => {
        const matchDate = r.date === date;
        const matchClass = !className || className === 'ALL' || r.className === className;
        const matchYear = !r.academicYear || r.academicYear === academicYear;
        return matchDate && matchClass && matchYear;
      });
    } catch {
      return [];
    }
  }

  // ==============================================================================
  // STUDENT BEHAVIOR & POINTS API (Mock Provider / LocalStorage)
  // ==============================================================================

  public async getStudentBehaviors(
    className?: string,
    academicYear = '2026/2027',
    _token?: string
  ): Promise<StudentBehaviorRecord[]> {
    const raw = safeGetStorage('smart_absensi_gm_behaviors');
    let list: StudentBehaviorRecord[] = [];

    if (raw) {
      try {
        list = JSON.parse(raw);
      } catch {
        list = [];
      }
    }

    // Jika belum ada data di storage, inisialisasi dari daftar siswa aktif
    if (list.length === 0) {
      const students = await this.getStudents();
      list = students.map((s) => ({
        id: `gm_beh_${s.id}`,
        student_name: s.fullName,
        class_name: s.className,
        academic_year: s.academicYear || academicYear,
        total_points: 10,
        merits_points: 0,
        demerits_points: 0,
        behavior_logs: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));
      safeSetStorage('smart_absensi_gm_behaviors', JSON.stringify(list));
    }

    // Ensure merits_points and demerits_points are calculated
    const computedList = list.map((record) => {
      let merits = 0;
      let demerits = 0;
      if (Array.isArray(record.behavior_logs)) {
        record.behavior_logs.forEach((log) => {
          const pts = Math.abs(log.points || 0);
          if (log.type === 'GOOD') {
            merits += pts;
          } else {
            demerits += pts;
          }
        });
      }
      return {
        ...record,
        merits_points: merits,
        demerits_points: demerits,
      };
    });

    return computedList.filter((b) => {
      const matchYear = !b.academic_year || b.academic_year === academicYear;
      const matchClass = !className || className === 'ALL' || b.class_name === className;
      return matchYear && matchClass;
    });
  }

  public async recordStudentBehavior(
    params: RecordStudentBehaviorParams,
    _token?: string
  ): Promise<{
    success: boolean;
    newTotal: number;
    record?: StudentBehaviorRecord;
    message: string;
  }> {
    const list = await this.getStudentBehaviors('ALL', params.academicYear || '2026/2027');
    const cleanName = params.studentName.trim().toUpperCase();
    const cleanClass = params.className.trim().toUpperCase();
    const academicYear = params.academicYear || '2026/2027';
    const violationDate = params.violationDate || new Date().toISOString();
    const pointsAbs = Math.abs(params.points);

    let idx = list.findIndex(
      (b) => b.student_name.toUpperCase() === cleanName && b.academic_year === academicYear
    );

    const newLog: StudentBehaviorLog = {
      type: params.type,
      points: pointsAbs,
      reason: params.reason.trim(),
      timestamp: violationDate,
      violation_date: violationDate,
      recordedBy: params.teacherName || 'Guru',
    };

    let targetRecord: StudentBehaviorRecord;

    // Handle legacy point calculation for test compatibility
    const pointDelta = params.points !== 0 ? (params.type === 'GOOD' ? pointsAbs : -pointsAbs) : 0;

    if (idx !== -1) {
      const existing = list[idx];
      const currentTotal = typeof existing.total_points === 'number' ? existing.total_points : 10;
      const newTotal = currentTotal + pointDelta;
      const updatedLogs = [newLog, ...(existing.behavior_logs || [])];

      let merits = 0;
      let demerits = 0;
      updatedLogs.forEach((l) => {
        const p = Math.abs(l.points || 0);
        if (l.type === 'GOOD') merits += p;
        else demerits += p;
      });

      targetRecord = {
        ...existing,
        total_points: newTotal,
        merits_points: merits,
        demerits_points: demerits,
        behavior_logs: updatedLogs,
        updated_at: new Date().toISOString(),
      };
      list[idx] = targetRecord;
    } else {
      const startingTotal = 10 + pointDelta;
      targetRecord = {
        id: `gm_beh_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        student_name: cleanName,
        class_name: cleanClass,
        academic_year: academicYear,
        total_points: startingTotal,
        merits_points: params.type === 'GOOD' ? pointsAbs : 0,
        demerits_points: params.type === 'BAD' ? pointsAbs : 0,
        behavior_logs: [newLog],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      list.unshift(targetRecord);
    }

    safeSetStorage('smart_absensi_gm_behaviors', JSON.stringify(list));

    return {
      success: true,
      newTotal: targetRecord.total_points,
      record: targetRecord,
      message: `Poin ${params.type === 'GOOD' ? 'kebaikan' : 'kedisiplinan'} (+${pointsAbs}) berhasil dicatat untuk ${cleanName}. Total: ${targetRecord.total_points} poin.`,
    };
  }

  public async getStudentBehaviorHistory(
    studentName: string,
    _className: string,
    _token?: string
  ): Promise<StudentBehaviorLog[]> {
    const list = await this.getStudentBehaviors('ALL');
    const cleanName = studentName.trim().toUpperCase();
    const record = list.find((b) => b.student_name.toUpperCase() === cleanName);
    if (!record || !Array.isArray(record.behavior_logs)) return [];
    return [...record.behavior_logs].sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  public async savePushSubscription(
    subscription: PushSubscriptionPayload,
    _token?: string
  ): Promise<boolean> {
    const raw = safeGetStorage('smart_absensi_push_subscriptions');
    let list: PushSubscriptionPayload[] = [];
    if (raw) {
      try {
        list = JSON.parse(raw);
        if (!Array.isArray(list)) list = [];
      } catch {
        list = [];
      }
    }
    const filtered = list.filter((s) => s.endpoint !== subscription.endpoint);
    filtered.unshift({
      ...subscription,
      device_type: subscription.device_type || 'MOBILE',
    });
    safeSetStorage('smart_absensi_push_subscriptions', JSON.stringify(filtered));
    return true;
  }

  public async deletePushSubscription(
    endpoint: string,
    _token?: string
  ): Promise<boolean> {
    const raw = safeGetStorage('smart_absensi_push_subscriptions');
    if (!raw) return true;
    try {
      const list: PushSubscriptionPayload[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        const filtered = list.filter((s) => s.endpoint !== endpoint);
        safeSetStorage('smart_absensi_push_subscriptions', JSON.stringify(filtered));
      }
      return true;
    } catch {
      return false;
    }
  }

  // TEACHER DISCIPLINE POINT HISTORY API (Mock Provider / LocalStorage)
  public async getTeacherPointHistory(userId: string, _token?: string): Promise<TeacherPointLog[]> {
    const KEY = 'smart_absensi_teacher_point_history';
    let allLogs: TeacherPointLog[] = [];
    try {
      const saved = safeGetStorage(KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          allLogs = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to parse teacher point history:', e);
    }

    if (allLogs.length === 0) {
      allLogs = this.generateSeedTeacherPointLogs();
      safeSetStorage(KEY, JSON.stringify(allLogs));
    } else {
      // Auto-reconcile with updated seeds to ensure missing dates (e.g. 2026-09-08 & 2026-09-09) are seamlessly merged
      const seeds = this.generateSeedTeacherPointLogs();
      let hasNewSeed = false;
      for (const seed of seeds) {
        const exists = allLogs.some(
          (l) => l.user_id === seed.user_id && l.date === seed.date && l.activity_type === seed.activity_type
        );
        if (!exists) {
          allLogs.push(seed);
          hasNewSeed = true;
        }
      }
      if (hasNewSeed) {
        safeSetStorage(KEY, JSON.stringify(allLogs));
      }
    }

    if (userId === 'ALL') {
      return [...allLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    }

    return allLogs
      .filter((l) => l.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  public async recordTeacherPoint(
    log: Omit<TeacherPointLog, 'id' | 'created_at'>,
    _token?: string
  ): Promise<TeacherPointLog> {
    const KEY = 'smart_absensi_teacher_point_history';
    const allLogs = await this.getTeacherPointHistory('ALL');

    // Idempotency check: prevent duplicate point for the exact same user, date, and activity_type
    const existing = allLogs.find(
      (l) => l.user_id === log.user_id && l.date === log.date && l.activity_type === log.activity_type
    );
    if (existing) {
      return existing;
    }

    const newLog: TeacherPointLog = {
      ...log,
      id: 'pt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      created_at: new Date().toISOString(),
    };

    allLogs.unshift(newLog);
    safeSetStorage(KEY, JSON.stringify(allLogs));

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('smart_absensi_points_updated', {
          detail: {
            userId: log.user_id,
            teacherName: log.teacher_name,
            points: log.points,
            activity_type: log.activity_type,
            title: log.title,
            description: log.description,
          },
        })
      );
    }

    return newLog;
  }

  private generateSeedTeacherPointLogs(): TeacherPointLog[] {
    const seeds: TeacherPointLog[] = [
      // Muhammad Iqbal Gustiawan (usr_guru_002)
      { id: 'pt_iqbal_01', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-01', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:10 WIB di gerbang sekolah (Radius 8m)', created_at: '2026-09-01T07:10:00.000Z' },
      { id: 'pt_iqbal_02', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-02', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:12 WIB di gerbang sekolah (Radius 9m)', created_at: '2026-09-02T07:12:00.000Z' },
      { id: 'pt_iqbal_03', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-03', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:08 WIB di gerbang sekolah (Radius 11m)', created_at: '2026-09-03T07:08:00.000Z' },
      { id: 'pt_iqbal_04', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-04', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:15 WIB di gerbang sekolah (Radius 7m)', created_at: '2026-09-04T07:15:00.000Z' },
      { id: 'pt_iqbal_05', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-07', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:05 WIB di gerbang sekolah (Radius 6m)', created_at: '2026-09-07T07:05:00.000Z' },
      { id: 'pt_iqbal_06', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-07', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-07T07:30:00.000Z' },
      { id: 'pt_iqbal_07', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-08', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:30 WIB di gerbang sekolah', created_at: '2026-09-08T07:30:29.000Z' },
      { id: 'pt_iqbal_08', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:40 WIB via QR', created_at: '2026-09-08T10:40:53.000Z' },
      { id: 'pt_iqbal_09', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 06:56 WIB di gerbang sekolah', created_at: '2026-09-09T06:56:34.000Z' },
      { id: 'pt_iqbal_10', user_id: 'usr_guru_002', teacher_name: 'Muhammad Iqbal Gustiawan, S.Pd., G.r', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 12:59 WIB via QR', created_at: '2026-09-09T12:59:37.000Z' },

      // Widianingsih (usr_guru_009)
      { id: 'pt_widia_01', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-01', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:14 WIB di gerbang sekolah', created_at: '2026-09-01T07:14:00.000Z' },
      { id: 'pt_widia_02', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-02', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:11 WIB di gerbang sekolah', created_at: '2026-09-02T07:11:00.000Z' },
      { id: 'pt_widia_03', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-03', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:09 WIB di gerbang sekolah', created_at: '2026-09-03T07:09:00.000Z' },
      { id: 'pt_widia_04', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-04', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:16 WIB di gerbang sekolah', created_at: '2026-09-04T07:16:00.000Z' },
      { id: 'pt_widia_05', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-07', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:07 WIB di gerbang sekolah', created_at: '2026-09-07T07:07:00.000Z' },
      { id: 'pt_widia_06', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-07', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-07T07:30:00.000Z' },
      { id: 'pt_widia_07', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-08', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:28 WIB di gerbang sekolah', created_at: '2026-09-08T07:28:00.000Z' },
      { id: 'pt_widia_08', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:41 WIB via QR', created_at: '2026-09-08T10:41:20.000Z' },
      { id: 'pt_widia_09', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:12 WIB di gerbang sekolah', created_at: '2026-09-09T07:12:09.000Z' },
      { id: 'pt_widia_10', user_id: 'usr_guru_009', teacher_name: 'Widianingsih, S.Si., G.r', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 13:01 WIB via QR', created_at: '2026-09-09T13:01:09.000Z' },

      // Septi Nur Aeni (usr_guru_007)
      { id: 'pt_septi_01', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-01', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:09 WIB di gerbang sekolah', created_at: '2026-09-01T07:09:00.000Z' },
      { id: 'pt_septi_02', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-02', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:13 WIB di gerbang sekolah', created_at: '2026-09-02T07:13:00.000Z' },
      { id: 'pt_septi_03', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-03', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:10 WIB di gerbang sekolah', created_at: '2026-09-03T07:10:00.000Z' },
      { id: 'pt_septi_04', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-04', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:18 WIB di gerbang sekolah', created_at: '2026-09-04T07:18:00.000Z' },
      { id: 'pt_septi_05', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-07', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:06 WIB di gerbang sekolah', created_at: '2026-09-07T07:06:00.000Z' },
      { id: 'pt_septi_06', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-07', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-07T07:30:00.000Z' },
      { id: 'pt_septi_07', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-08', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:26 WIB di gerbang sekolah', created_at: '2026-09-08T07:26:15.000Z' },
      { id: 'pt_septi_08', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:40 WIB via QR', created_at: '2026-09-08T10:40:05.000Z' },
      { id: 'pt_septi_09', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:24 WIB di gerbang sekolah', created_at: '2026-09-09T07:24:00.000Z' },
      { id: 'pt_septi_10', user_id: 'usr_guru_007', teacher_name: 'Septi Nur Aeni, S.E', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 13:00 WIB via QR', created_at: '2026-09-09T13:00:00.000Z' },

      // Mira Nurdianti (usr_guru_004)
      { id: 'pt_mira_01', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-01', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:15 WIB di gerbang sekolah', created_at: '2026-09-01T07:15:00.000Z' },
      { id: 'pt_mira_02', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-02', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:20 WIB di gerbang sekolah', created_at: '2026-09-02T07:20:00.000Z' },
      { id: 'pt_mira_03', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-03', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:38 WIB di gerbang sekolah', created_at: '2026-09-03T07:38:00.000Z' },
      { id: 'pt_mira_04', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-04', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:11 WIB di gerbang sekolah', created_at: '2026-09-04T07:11:00.000Z' },
      { id: 'pt_mira_05', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-07', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:10 WIB di gerbang sekolah', created_at: '2026-09-07T10:00:00.000Z' },
      { id: 'pt_mira_06', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-07', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-07T07:30:00.000Z' },
      { id: 'pt_mira_07', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-08', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:38 WIB di gerbang sekolah', created_at: '2026-09-08T07:38:35.000Z' },
      { id: 'pt_mira_08', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:39 WIB via QR', created_at: '2026-09-08T10:39:06.000Z' },
      { id: 'pt_mira_09', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:00 WIB di gerbang sekolah', created_at: '2026-09-09T07:00:36.000Z' },
      { id: 'pt_mira_10', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 13:10 WIB via QR', created_at: '2026-09-09T13:10:53.000Z' },
      { id: 'pt_mira_11', user_id: 'usr_guru_004', teacher_name: 'Mira Nurdianti, S.Pd', date: '2026-09-09', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-09T07:30:00.000Z' },

      // Adi Prasetyo (usr_guru_003)
      { id: 'pt_adi_01', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-01', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:12 WIB di gerbang sekolah', created_at: '2026-09-01T07:12:00.000Z' },
      { id: 'pt_adi_02', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-02', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:08 WIB di gerbang sekolah', created_at: '2026-09-02T07:08:00.000Z' },
      { id: 'pt_adi_03', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-04', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:14 WIB di gerbang sekolah', created_at: '2026-09-04T07:14:00.000Z' },
      { id: 'pt_adi_04', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-07', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:05 WIB di gerbang sekolah', created_at: '2026-09-07T07:05:00.000Z' },
      { id: 'pt_adi_05', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-07', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-07T07:30:00.000Z' },
      { id: 'pt_adi_06', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-08', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:30 WIB di gerbang sekolah', created_at: '2026-09-08T07:30:00.000Z' },
      { id: 'pt_adi_07', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:42 WIB via QR', created_at: '2026-09-08T10:42:46.000Z' },
      { id: 'pt_adi_08', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-08', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-08T07:30:00.000Z' },
      { id: 'pt_adi_09', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:18 WIB di gerbang sekolah', created_at: '2026-09-09T07:18:12.000Z' },
      { id: 'pt_adi_10', user_id: 'usr_guru_003', teacher_name: 'Adi Prasetyo, S.Pd., G.r', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 12:59 WIB via QR', created_at: '2026-09-09T12:59:39.000Z' },

      // Dafa Maulana (usr_admin_001)
      { id: 'pt_dafa_01', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-01', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:16 WIB di gerbang sekolah', created_at: '2026-09-01T07:16:00.000Z' },
      { id: 'pt_dafa_02', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-02', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:18 WIB di gerbang sekolah', created_at: '2026-09-02T07:18:00.000Z' },
      { id: 'pt_dafa_03', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-03', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:42 WIB di gerbang sekolah', created_at: '2026-09-03T07:42:00.000Z' },
      { id: 'pt_dafa_04', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-04', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:35 WIB di gerbang sekolah', created_at: '2026-09-04T07:35:00.000Z' },
      { id: 'pt_dafa_05', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-07', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:39 WIB di gerbang sekolah', created_at: '2026-09-07T07:39:00.000Z' },
      { id: 'pt_dafa_06', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-07', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-07T07:30:00.000Z' },
      { id: 'pt_dafa_07', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-08', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:42 WIB di gerbang sekolah', created_at: '2026-09-08T07:42:12.000Z' },
      { id: 'pt_dafa_08', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:40 WIB via QR', created_at: '2026-09-08T10:40:08.000Z' },
      { id: 'pt_dafa_09', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 07:19 WIB di gerbang sekolah', created_at: '2026-09-09T07:19:57.000Z' },
      { id: 'pt_dafa_10', user_id: 'usr_admin_001', teacher_name: 'Dafa Maulana, S.Pd', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 13:04 WIB via QR', created_at: '2026-09-09T13:04:21.000Z' },

      // Fitri Ani Rahayu (usr_guru_005)
      { id: 'pt_fitri_01', user_id: 'usr_guru_005', teacher_name: 'Fitri Ani Rahayu, S.Mat', date: '2026-09-08', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:31 WIB di gerbang sekolah', created_at: '2026-09-08T07:31:39.000Z' },
      { id: 'pt_fitri_02', user_id: 'usr_guru_005', teacher_name: 'Fitri Ani Rahayu, S.Mat', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:43 WIB via QR', created_at: '2026-09-08T10:43:31.000Z' },
      { id: 'pt_fitri_03', user_id: 'usr_guru_005', teacher_name: 'Fitri Ani Rahayu, S.Mat', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 06:51 WIB di gerbang sekolah', created_at: '2026-09-09T06:51:25.000Z' },
      { id: 'pt_fitri_04', user_id: 'usr_guru_005', teacher_name: 'Fitri Ani Rahayu, S.Mat', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 13:12 WIB via QR', created_at: '2026-09-09T13:12:05.000Z' },
      { id: 'pt_fitri_05', user_id: 'usr_guru_005', teacher_name: 'Fitri Ani Rahayu, S.Mat', date: '2026-09-09', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-09T07:30:00.000Z' },

      // Mawar Andinia (usr_guru_010)
      { id: 'pt_mawar_01', user_id: 'usr_guru_010', teacher_name: 'Mawar Andinia, S.Pd., G.r', date: '2026-09-08', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:34 WIB di gerbang sekolah', created_at: '2026-09-08T07:34:37.000Z' },
      { id: 'pt_mawar_02', user_id: 'usr_guru_010', teacher_name: 'Mawar Andinia, S.Pd., G.r', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:40 WIB via QR', created_at: '2026-09-08T10:40:18.000Z' },
      { id: 'pt_mawar_03', user_id: 'usr_guru_010', teacher_name: 'Mawar Andinia, S.Pd., G.r', date: '2026-09-08', points: 10, activity_type: 'DUTY_PIKET', title: 'Tugas Piket Harian Sekolah', description: 'Aktif bertugas sebagai Guru Piket harian dan membina ketertiban sekolah', created_at: '2026-09-08T07:30:00.000Z' },
      { id: 'pt_mawar_04', user_id: 'usr_guru_010', teacher_name: 'Mawar Andinia, S.Pd., G.r', date: '2026-09-09', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:42 WIB di gerbang sekolah', created_at: '2026-09-09T07:42:09.000Z' },
      { id: 'pt_mawar_05', user_id: 'usr_guru_010', teacher_name: 'Mawar Andinia, S.Pd., G.r', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 12:59 WIB via QR', created_at: '2026-09-09T12:59:20.000Z' },

      // Nurul Fahriya (usr_guru_006)
      { id: 'pt_nurul_01', user_id: 'usr_guru_006', teacher_name: 'Nurul Fahriya, S.Pd., G.r', date: '2026-09-08', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 07:51 WIB di gerbang sekolah', created_at: '2026-09-08T07:51:59.000Z' },
      { id: 'pt_nurul_02', user_id: 'usr_guru_006', teacher_name: 'Nurul Fahriya, S.Pd., G.r', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:43 WIB via QR', created_at: '2026-09-08T10:43:00.000Z' },
      { id: 'pt_nurul_03', user_id: 'usr_guru_006', teacher_name: 'Nurul Fahriya, S.Pd., G.r', date: '2026-09-09', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 09:27 WIB di gerbang sekolah', created_at: '2026-09-09T09:27:29.000Z' },
      { id: 'pt_nurul_04', user_id: 'usr_guru_006', teacher_name: 'Nurul Fahriya, S.Pd., G.r', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 13:00 WIB via QR', created_at: '2026-09-09T13:00:14.000Z' },

      // Ridho Maulana Al Farizi (usr_1786512137742)
      { id: 'pt_ridho_01', user_id: 'usr_1786512137742', teacher_name: 'Ridho Maulana Al Farizi', date: '2026-09-08', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 08:39 WIB di gerbang sekolah', created_at: '2026-09-08T08:39:58.000Z' },
      { id: 'pt_ridho_02', user_id: 'usr_1786512137742', teacher_name: 'Ridho Maulana Al Farizi', date: '2026-09-08', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 10:40 WIB via QR', created_at: '2026-09-08T10:40:15.000Z' },
      { id: 'pt_ridho_03', user_id: 'usr_1786512137742', teacher_name: 'Ridho Maulana Al Farizi', date: '2026-09-09', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 08:34 WIB di gerbang sekolah', created_at: '2026-09-09T08:34:43.000Z' },

      // Farhan Sopian Sahid, S.Pd.I (usr_kepsek_002)
      { id: 'pt_kepsek_01', user_id: 'usr_kepsek_002', teacher_name: 'Farhan Sopian Sahid, S.Pd.I', date: '2026-09-09', points: 15, activity_type: 'CHECK_IN_ON_TIME', title: 'Presensi Masuk Tepat Waktu (≤ 07:30 WIB)', description: 'Tercatat hadir pukul 06:48 WIB di gerbang sekolah', created_at: '2026-09-09T06:48:47.000Z' },
      { id: 'pt_kepsek_02', user_id: 'usr_kepsek_002', teacher_name: 'Farhan Sopian Sahid, S.Pd.I', date: '2026-09-09', points: 10, activity_type: 'CHECK_OUT', title: 'Presensi Pulang Tuntas Bertugas', description: 'Tercatat menyelesaikan dinas sekolah pada pukul 13:21 WIB via QR', created_at: '2026-09-09T13:21:42.000Z' },

      // Qodiatul Asrof Ramadhoni (usr_op_002)
      { id: 'pt_op_01', user_id: 'usr_op_002', teacher_name: 'Qodiatul Asrof Ramadhoni, S.E., G.r', date: '2026-09-09', points: 5, activity_type: 'CHECK_IN_LATE', title: 'Presensi Masuk Sekolah (> 07:30 WIB)', description: 'Tercatat hadir pukul 09:12 WIB di gerbang sekolah', created_at: '2026-09-09T09:12:34.000Z' },
    ];

    return seeds;

  }
}

