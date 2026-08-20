import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { SkeletonList } from '../../../components/ui/Skeleton';
import { EmptyState } from '../../../components/ui/EmptyState';
import { LeaveApplicationModal } from '../../leave/components/LeaveApplicationModal';
import { GuruCorrectionRequestModal } from '../../guru/components/GuruCorrectionRequestModal';
import { TermsAndConditionsModal } from '../../guru/components/TermsAndConditionsModal';
import { TeachingScheduleModal } from '../../guru/components/TeachingScheduleModal';
import { MoodCheckinModal } from '../../guru/components/MoodCheckinModal';
import { TeacherLocationCard } from '../../guru/components/TeacherLocationCard';
import { ExportReportModal } from '../../../components/dashboard/ExportReportModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { CONSTANTS } from '../../../config/constants';
import { handleAppError } from '../../../utils/error.utils';
import { isDateOffDay, getTodayDateInJakarta, getCurrentTimeInJakarta, getMonthWorkingDays } from '../../../utils/time.utils';
import { getEffectiveAllowedRadius } from '../../../utils/geofence.utils';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';
import { QrCodeScanIcon } from '../../../components/ui/QrCodeScanIcon';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { VoiceSettingsCard } from '../../../components/dashboard/VoiceSettingsCard';
import { NotificationPermissionBanner } from '../../../components/dashboard/NotificationPermissionBanner';
import { PWAInstallPrompt } from '../../../components/ui/PWAInstallPrompt';
import { NotificationService } from '../../../services/notification-permission.service';
import { useSyncQueueStore } from '../../../store/useSyncQueueStore';
import { SyncEngine } from '../../../services/sync-engine.service';
import { DutyScheduleRepository } from '../../../repositories/DutyScheduleRepository';
import { useCrossDeviceSync } from '../../../hooks/useCrossDeviceSync';
import { calculateTeacherAppreciationScore } from '../../../utils/teacher-appreciation.utils';
import { evaluateSmartClassAlarm } from '../../../utils/smart-class-alarm.utils';
import type {
  AttendanceRecord,
  HolidayRecord,
  UserProfile,
  SystemSettings,
  AppNotification,
  DeviceBindingCheckResult,
  LeaveRequest,
  TeacherMoodLog,
  TeacherDutySchedule,
  TeachingSlot,
} from '../../../types/database.types';

export interface GuruDashboardPageProps {
  onOpenScanner?: () => void;
  onOpenLeaveForm?: () => void;
  onOpenCorrectionForm?: () => void;
  previewUser?: UserProfile;
  isPreviewMode?: boolean;
}

// Robust Avatar Component with graceful image onError fallback for mobile devices
const UserAvatar: React.FC<{
  avatarUrl?: string | null;
  name: string;
  className?: string;
  textClassName?: string;
}> = ({ avatarUrl, name, className = 'w-12 h-12 rounded-2xl', textClassName = 'text-xl font-black' }) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [avatarUrl]);

  const initial = name ? name.trim().charAt(0).toUpperCase() : 'G';

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`bg-slate-800 text-white flex items-center justify-center font-black ${className} ${textClassName}`}>
      {initial}
    </div>
  );
};

// Clean UI Icons (Anti AI-Slop standard)
const HomeIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 00-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
  </svg>
);

const ChartIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
  </svg>
);

const BellIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
  </svg>
);

const UserIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const DocumentTextIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

const PencilSquareIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
);

const CalendarDaysIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
  </svg>
);

const KeyIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
  </svg>
);

const LogOutIcon: React.FC<{ className?: string }> = ({ className = 'w-5 h-5' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
  </svg>
);


export const GuruDashboardPage: React.FC<GuruDashboardPageProps> = ({
  onOpenScanner,
  onOpenLeaveForm,
  onOpenCorrectionForm,
  previewUser,
  isPreviewMode = false,
}) => {
  const { user: authUser, token, logout, deviceUUID } = useAuthStore();
  const { showToast } = useToastStore();

  const fallbackUser: UserProfile = {
    id: 'usr_guru_sample',
    nip: null,
    full_name: 'Guru Utama',
    phone_number: '081234567890',
    role: 'GURU',
    position: 'Guru Utama / Pendidik',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  // Effective user: merge previewUser with authUser (prioritize authUser.avatar_url if present)
  const effectiveUser: UserProfile = previewUser
    ? {
        ...previewUser,
        avatar_url: authUser?.avatar_url || previewUser.avatar_url || null,
      }
    : (authUser || fallbackUser);

  const [activeTab, setActiveTab] = useState<'BERANDA' | 'RIWAYAT' | 'NOTIFIKASI' | 'PROFIL'>('BERANDA');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionInitialDate, setCorrectionInitialDate] = useState<string | undefined>(undefined);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Change PIN Form State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // System Settings & Work Schedule State
  const [settings, setSettings] = useState<SystemSettings>({
    app_name: 'Smart Absensi Guru',
    institution_name: 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam',
    work_checkin_start: CONSTANTS.DEFAULTS.WORK_CHECKIN_START,
    work_checkin_end: CONSTANTS.DEFAULTS.WORK_CHECKIN_END,
    work_checkout_start: CONSTANTS.DEFAULTS.WORK_CHECKOUT_START,
    geofence_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    geofence_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    geofence_radius: CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
  });

  // Date selection state for monthly history
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Today Attendance Status, History, & Holiday Info
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [todayHoliday, setTodayHoliday] = useState<HolidayRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [todayMood, setTodayMood] = useState<TeacherMoodLog | null>(null);
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);

  // Leave & Calendar History State
  const [historySubTab, setHistorySubTab] = useState<'ATTENDANCE' | 'LEAVES'>('ATTENDANCE');
  const [historyViewMode, setHistoryViewMode] = useState<'CALENDAR' | 'LIST'>('CALENDAR');
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<{
    dateStr: string;
    record?: AttendanceRecord;
    isHoliday?: boolean;
    holidayDesc?: string;
  } | null>(null);
  const [allHolidays, setAllHolidays] = useState<HolidayRecord[]>([]);
  const [userLeaves, setUserLeaves] = useState<LeaveRequest[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);
  const [teachingSlots, setTeachingSlots] = useState<TeachingSlot[]>([]);
  const lastChimedSlotKeyRef = useRef<string | null>(null);

  // Notifications List State (Backend-Driven)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deviceBindingStatus, setDeviceBindingStatus] = useState<DeviceBindingCheckResult>({
    status: 'UNAVAILABLE',
    message: 'Memeriksa status perangkat...',
  });

  // Teacher Duty Schedule (Jadwal Piket Guru) State
  const [_dutySchedules, setDutySchedules] = useState<TeacherDutySchedule[]>([]);
  const [isDutyTeacherToday, setIsDutyTeacherToday] = useState<boolean>(false);
  const [todayDutyDetails, setTodayDutyDetails] = useState<TeacherDutySchedule | null>(null);
  const [fellowDutyTeachers, setFellowDutyTeachers] = useState<TeacherDutySchedule[]>([]);

  // Pre-scan GPS Health Status & Realtime Coordinates State
  const [gpsHealth, setGpsHealth] = useState<{ status: 'READY' | 'REFINING' | 'OFF' | 'INVALID'; text: string; accuracy?: number }>({
    status: 'REFINING',
    text: '📍 Mengukur lokasi GPS...',
  });
  const [userCoords, setUserCoords] = useState<GPSCoordinates | null>(() => GPSService.getLatestCoords());

  useEffect(() => {
    GPSService.startBackgroundWarmUp();
    setGpsHealth(GPSService.getGPSHealthStatus());
    setUserCoords(GPSService.getLatestCoords());

    const interval = setInterval(() => {
      setGpsHealth(GPSService.getGPSHealthStatus());
      setUserCoords(GPSService.getLatestCoords());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  // Live running digital clock state
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  useEffect(() => {
    const clockTimer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  const formattedTimeStr = currentTime.toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).replace(/\./g, ':');

  const formattedFullDateStr = currentTime.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // Real-time Network Connection & Offline Queue State
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const { pendingItems, syncState } = useSyncQueueStore();

  useEffect(() => {
    SyncEngine.initAutoSync();

    const handleOnline = () => {
      setIsOnline(true);
      SyncEngine.processSyncQueue();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Check if today is a non-working day (Weekend or Holiday)
  const isTodayOff = isDateOffDay(new Date(), settings, todayHoliday ? [todayHoliday] : allHolidays);

  // Indonesian Voice Announcement Initial Welcome Greeting Trigger
  const hasGreetedRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (!hasGreetedRef.current && effectiveUser?.full_name) {
      hasGreetedRef.current = true;
      setTimeout(() => {
        if (isTodayOff.isOff) {
          const cleanName = effectiveUser.full_name.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();
          SpeechService.speak(`Assalamu'alaikum ${cleanName}. Selamat hari libur, selamat beristirahat.`);
        } else {
          SpeechService.speakWelcomeGreeting(effectiveUser.full_name, settings.institution_name);
        }
      }, 800);
    }
  }, [effectiveUser?.full_name, isTodayOff.isOff, settings.institution_name]);

  const loadUserLeaves = async () => {
    if (!effectiveUser) return;
    setIsLoadingLeaves(true);
    try {
      const leaves = await LeaveRepository.getUserLeaves(effectiveUser.id, token || '');
      setUserLeaves(leaves);
    } catch (err) {
      console.warn('Failed to load user leaves:', err);
    } finally {
      setIsLoadingLeaves(false);
    }
  };

  const checkDeviceStatus = async () => {
    if (!effectiveUser) return;
    try {
      const provider = ProviderFactory.getProvider();
      const bindingRes = await provider.checkDeviceBinding(
        effectiveUser.id,
        deviceUUID || 'DEV_UUID',
        token || ''
      );
      setDeviceBindingStatus(bindingRes);
    } catch (err) {
      console.warn('Failed to check device binding status:', err);
    }
  };

  useEffect(() => {
    loadUserLeaves();
    checkDeviceStatus();

    const handleLeaveUpdate = () => {
      loadUserLeaves();
    };

    const handleDeviceReset = (e: Event) => {
      const customEv = e as CustomEvent<{ userId?: string }>;
      if (!customEv.detail || customEv.detail.userId === effectiveUser.id) {
        checkDeviceStatus();
        showToast('info', 'Binding HP Direset', 'Perangkat HP Anda telah di-reset oleh Admin/Operator.');
      }
    };

    window.addEventListener('smart_absensi_leave_updated', handleLeaveUpdate);
    window.addEventListener('smart_absensi_device_reset', handleDeviceReset);
    window.addEventListener('storage', handleLeaveUpdate);
    window.addEventListener('storage', checkDeviceStatus);

    return () => {
      window.removeEventListener('smart_absensi_leave_updated', handleLeaveUpdate);
      window.removeEventListener('smart_absensi_device_reset', handleDeviceReset);
      window.removeEventListener('storage', handleLeaveUpdate);
      window.removeEventListener('storage', checkDeviceStatus);
    };
  }, [effectiveUser?.id]);

  // Ref to hold the latest loadAllData function for cross-device sync hook
  const loadAllDataRef = useRef<(() => void) | null>(null);

  // Load Settings, Today Attendance, Holidays, Monthly History, Notifications, & Device Binding
  useEffect(() => {
    const loadAllData = async () => {
      if (!effectiveUser) return;
      const provider = ProviderFactory.getProvider();
      const authToken = token || '';

      // 0. Sync Profile Avatar & Details from LocalStorage smart_absensi_teachers & DB
      try {
        const savedTeachersStr = typeof window !== 'undefined' ? localStorage.getItem('smart_absensi_teachers') : null;
        let teacherList: UserProfile[] = savedTeachersStr ? JSON.parse(savedTeachersStr) : [];
        if (!Array.isArray(teacherList) || teacherList.length === 0) {
          teacherList = await provider.getAllUsers(authToken).catch(() => []);
        }
        const matched = teacherList.find(
          (t) =>
            t &&
            (t.id === effectiveUser.id ||
              (Boolean(t.nip) && Boolean(effectiveUser.nip) && t.nip === effectiveUser.nip) ||
              (Boolean(t.full_name) &&
                Boolean(effectiveUser.full_name) &&
                t.full_name.toLowerCase() === effectiveUser.full_name.toLowerCase()))
        );
        if (matched && matched.avatar_url && matched.avatar_url !== effectiveUser.avatar_url) {
          useAuthStore.getState().updateUserProfile({ avatar_url: matched.avatar_url });
        }
      } catch (e) {
        // ignore profile sync warning
      }

      // 1. Settings
      let loadedSettings: SystemSettings | null = null;
      try {
        const sysSettings = await provider.getSettings();
        if (sysSettings) {
          setSettings(sysSettings);
          loadedSettings = sysSettings;
        }
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadSettings', 'Gagal memuat pengaturan jam kerja', false);
      }

      // 2. Today Attendance
      try {
        const today = await provider.getTodayAttendance(effectiveUser.id, authToken);
        setTodayAttendance(today);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadTodayAttendance', 'Gagal memuat presensi hari ini', false);
      }

      // 3. Holidays
      let loadedHolidays: HolidayRecord[] = [];
      try {
        const holidays = await provider.getHolidays(authToken);
        loadedHolidays = holidays || [];
        setAllHolidays(loadedHolidays);
        const todayIso = new Date().toISOString().substring(0, 10);
        const holidayToday = loadedHolidays.find((h) => h.date === todayIso);
        setTodayHoliday(holidayToday || null);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadHolidays', 'Gagal memuat data hari libur', false);
      }

      // 4. Monthly Attendance History
      let loadedHistory: AttendanceRecord[] = [];
      setIsLoadingHistory(true);
      try {
        const history = await provider.getMonthlyAttendance(
          effectiveUser.id,
          String(selectedMonth),
          String(selectedYear),
          authToken
        );
        loadedHistory = history || [];
        setAttendanceHistory(loadedHistory);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadMonthlyAttendance', 'Gagal memuat riwayat bulanan', false);
      } finally {
        setIsLoadingHistory(false);
      }

      // 4.5. User Approved Leaves for Period
      let loadedLeaves: LeaveRequest[] = [];
      try {
        loadedLeaves = await provider.getUserLeaves(effectiveUser.id, authToken).catch(() => []);
      } catch (err) {
        console.warn('Failed to load user leaves for unabsented check:', err);
      }

      // 5. Backend-Driven Notifications & Official School Announcements
      try {
        const notifs = await provider.getNotifications(effectiveUser.id, authToken).catch(() => []);
        const readIds = NotificationService.getReadNotificationIds(effectiveUser.id);

        let allItems: AppNotification[] = (notifs || []).map((n) => ({
          ...n,
          is_read: Boolean(n.is_read) || readIds.has(n.id),
        }));

        // 5.1 If backend returned no notifications (e.g., Supabase table empty or preview mode), provide standard institutional school announcements
        if (allItems.length === 0) {
          const defaultAnnouncements: AppNotification[] = [
            {
              id: `ann_checkin_guide_${effectiveUser.id}`,
              user_id: effectiveUser.id,
              title: '☀️ Ketertiban & Batas Waktu Absensi Masuk',
              message: 'Batas toleransi absensi masuk adalah sesuai jadwal kerja sekolah (pukul 07:30 WIB). Pastikan melakukan scan QR Code saat tiba di lingkungan sekolah.',
              type: 'INFO',
              is_read: readIds.has(`ann_checkin_guide_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
            {
              id: `ann_device_guide_${effectiveUser.id}`,
              user_id: effectiveUser.id,
              title: '📱 Keamanan Perangkat (1 Akun = 1 HP)',
              message: 'Akun presensi Anda terikat secara aman dengan HP aktif Anda untuk menjamin keabsahan data kehadiran.',
              type: 'SUCCESS',
              is_read: readIds.has(`ann_device_guide_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
            {
              id: `ann_leave_guide_${effectiveUser.id}`,
              user_id: effectiveUser.id,
              title: '📋 Pengajuan Izin & Koreksi Presensi',
              message: 'Bapak/Ibu Guru dapat mengajukan permohonan Cuti, Izin, Sakit, atau Koreksi Presensi langsung dari tombol layanan di menu Beranda.',
              type: 'INFO',
              is_read: readIds.has(`ann_leave_guide_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
            {
              id: `ann_security_pin_${effectiveUser.id}`,
              user_id: effectiveUser.id,
              title: '🔒 Keamanan Akun & PIN Presensi',
              message: 'Jaga kerahasiaan PIN 6-digit Anda. Anda dapat memperbarui PIN secara berkala melalui tab Profil.',
              type: 'WARNING',
              is_read: readIds.has(`ann_security_pin_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
          ];
          allItems = defaultAnnouncements;
        }

        // 5.2 Merge with Realtime Cached Notifications
        const cachedNotifs = NotificationService.getCachedNotifications(effectiveUser.id);
        if (Array.isArray(cachedNotifs) && cachedNotifs.length > 0) {
          cachedNotifs.forEach((cn) => {
            const cnId = cn.id || `cn_${cn.title}_${cn.time}`;
            if (!allItems.some((item) => item.id === cnId)) {
              allItems.push({
                id: cnId,
                user_id: effectiveUser.id,
                title: cn.title,
                message: cn.body,
                type: cn.type === 'LEAVE_REQUEST' ? 'WARNING' : cn.type === 'EVENT' ? 'INFO' : 'SUCCESS',
                is_read: Boolean(cn.isRead) || readIds.has(cnId),
                action_type: cn.actionType,
                action_date: cn.actionDate,
                action_target_id: cn.actionTargetId,
                created_at: cn.createdAt || new Date().toISOString(),
              });
            }
          });
        }

        setNotifications(allItems);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadNotifications', 'Gagal memuat notifikasi', false);
      }

      // 6. Device Binding Status Check
      try {
        const bindingRes = await provider.checkDeviceBinding(effectiveUser.id, deviceUUID || 'DEV_UUID', authToken);
        setDeviceBindingStatus(bindingRes);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.checkDeviceBinding', 'Gagal memeriksa status perangkat', false);
      }

      // 7. Today Teacher Mood Check-in
      try {
        const todayStr = getTodayDateInJakarta();
        const mood = await provider.getTodayTeacherMood(effectiveUser.id, todayStr, authToken);
        setTodayMood(mood);
      } catch (err) {
        console.warn('Failed to load today mood:', err);
      }

      // 7.5 Load Real Teaching Slots for Logged-In Teacher (No Fake AI Data!)
      try {
        const savedSchedules = localStorage.getItem('smart_absensi_teaching_schedules');
        if (savedSchedules) {
          const parsed = JSON.parse(savedSchedules);
          if (Array.isArray(parsed)) {
            const userSlots = parsed.filter(
              (s: any) =>
                s &&
                (s.user_id === effectiveUser.id ||
                  (effectiveUser.full_name && s.teacher_name === effectiveUser.full_name))
            );
            setTeachingSlots(userSlots);
          } else {
            setTeachingSlots([]);
          }
        } else {
          setTeachingSlots([]);
        }
      } catch (err) {
        console.warn('Failed to parse cached teaching schedules:', err);
        setTeachingSlots([]);
      }

      // 8. Teacher Duty Schedule Check (Jadwal Piket Guru Senin - Jumat)
      try {
        const fetchedDuty = await DutyScheduleRepository.getDutySchedules(authToken);
        setDutySchedules(fetchedDuty || []);

        const todayDayOfWeek = new Date().getDay(); // 1 = Senin, ..., 5 = Jumat
        if (todayDayOfWeek >= 1 && todayDayOfWeek <= 5) {
          const todayPikets = (fetchedDuty || []).filter((s) => s && s.day_of_week === todayDayOfWeek);
          const myPiket = todayPikets.find(
            (s) =>
              s &&
              (s.teacher_id === effectiveUser.id ||
                (Boolean(s.teacher_name) &&
                  Boolean(effectiveUser.full_name) &&
                  s.teacher_name.toLowerCase().includes(effectiveUser.full_name.toLowerCase())) ||
                (Boolean(effectiveUser.full_name) &&
                  Boolean(s.teacher_name) &&
                  effectiveUser.full_name.toLowerCase().includes(s.teacher_name.toLowerCase())))
          );

          if (myPiket) {
            setIsDutyTeacherToday(true);
            setTodayDutyDetails(myPiket);
            setFellowDutyTeachers(todayPikets.filter((s) => s.teacher_id !== myPiket.teacher_id));

            // Inject duty piket reminder to notifications list if not already present
            const dayNames = ['', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
            const dayName = dayNames[todayDayOfWeek] || 'Hari Ini';
            const piketNotifId = `notif_piket_${effectiveUser.id}_${getTodayDateInJakarta()}`;
            const isPiketRead = NotificationService.isNotificationRead(effectiveUser.id, piketNotifId);

            setNotifications((prev) => {
              const existingIdx = prev.findIndex((n) => n.id === piketNotifId || n.title.includes('Jadwal Piket'));
              if (existingIdx !== -1) {
                return prev.map((n, idx) =>
                  idx === existingIdx
                    ? { ...n, is_read: Boolean(n.is_read) || isPiketRead }
                    : n
                );
              }
              const newNotif: AppNotification = {
                id: piketNotifId,
                user_id: effectiveUser.id,
                title: '🛡️ Pengingat Jadwal Piket Guru Hari Ini',
                message: `Hari ini (${dayName}) Anda bertugas sebagai Guru Piket. ${
                  myPiket.notes ? `Tugas: ${myPiket.notes}` : 'Selamat bertugas dan jaga ketertiban sekolah!'
                }`,
                type: 'INFO',
                is_read: isPiketRead,
                created_at: new Date().toISOString(),
              };
              return [newNotif, ...prev];
            });
          } else {
            setIsDutyTeacherToday(false);
            setTodayDutyDetails(null);
            setFellowDutyTeachers([]);
          }
        } else {
          setIsDutyTeacherToday(false);
          setTodayDutyDetails(null);
          setFellowDutyTeachers([]);
        }
      } catch (err) {
        console.warn('Failed to check teacher duty schedule:', err);
      }

      // 9. Automated Unabsented Working Days Detection & Direct Notification Push
      try {
        const todayStr = getTodayDateInJakarta();
        const currentTime = getCurrentTimeInJakarta();
        const checkinEnd = loadedSettings?.work_checkin_end
          ? loadedSettings.work_checkin_end.slice(0, 5)
          : CONSTANTS.DEFAULTS.WORK_CHECKIN_END;
        const currentYear = parseInt(todayStr.substring(0, 4), 10);
        const currentMonth = parseInt(todayStr.substring(5, 7), 10);
        const currentDay = parseInt(todayStr.substring(8, 10), 10);

        const maxDayToCheck =
          selectedYear === currentYear && selectedMonth === currentMonth
            ? currentDay
            : new Date(selectedYear, selectedMonth, 0).getDate();

        const missingAttNotifs: AppNotification[] = [];

        for (let d = 1; d <= maxDayToCheck; d++) {
          const dayPad = String(d).padStart(2, '0');
          const monthPad = String(selectedMonth).padStart(2, '0');
          const dateStr = `${selectedYear}-${monthPad}-${dayPad}`;

          // If date is today, only trigger if time has passed check-in deadline
          if (dateStr === todayStr && currentTime < checkinEnd) {
            continue;
          }

          // Check if off day (weekend / holiday)
          const offCheck = isDateOffDay(dateStr, loadedSettings || undefined, loadedHolidays);
          if (offCheck.isOff) {
            continue;
          }

          // Check if teacher has physical attendance record
          const hasAttendance = loadedHistory.some(
            (r) => r.date === dateStr && r.status && r.status !== 'BELUM_ABSEN'
          );
          if (hasAttendance) continue;

          // Check if teacher has approved leave
          const hasLeave = loadedLeaves.some(
            (l) => l.approval_status === 'APPROVED' && l.start_date <= dateStr && dateStr <= l.end_date
          );
          if (hasLeave) continue;

          // Missing attendance identified!
          const notifId = `notif_missing_att_${effectiveUser.id}_${dateStr}`;
          const isRead = NotificationService.isNotificationRead(effectiveUser.id, notifId);

          const missingItem: AppNotification = {
            id: notifId,
            user_id: effectiveUser.id,
            title: `⚠️ Presensi Belum Tercatat: ${dateStr}`,
            message: `Anda belum tercatat presensi pada ${dateStr}. Ketuk di sini untuk langsung mengajukan Koreksi Absen.`,
            type: 'WARNING',
            is_read: isRead,
            action_type: 'CORRECTION',
            action_date: dateStr,
            created_at: `${dateStr}T12:00:00.000Z`,
          };

          missingAttNotifs.push(missingItem);

          if (!isRead) {
            NotificationService.notifyTeacherMissingAttendance(effectiveUser.full_name, dateStr, effectiveUser.id);
          }
        }

        if (missingAttNotifs.length > 0) {
          setNotifications((prev) => {
            const combined = [...prev];
            missingAttNotifs.forEach((newN) => {
              const idx = combined.findIndex((n) => n.id === newN.id);
              if (idx !== -1) {
                combined[idx] = { ...newN, is_read: Boolean(combined[idx].is_read) || newN.is_read };
              } else {
                combined.unshift(newN);
              }
            });
            return combined;
          });
        }
      } catch (err) {
        console.warn('Failed to detect unabsented working days for guru:', err);
      }
    };

    loadAllData();
    loadAllDataRef.current = loadAllData;

    const handleScannedEvent = () => loadAllData();
    const handleNotificationPushed = () => {
      loadAllData();
      SoundService.playNotificationChime();
    };

    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_records_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_notification_pushed', handleNotificationPushed);
    window.addEventListener('smart_absensi_teachers_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_notifications_read_updated', handleScannedEvent);
    window.addEventListener('storage', handleScannedEvent);
    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_records_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_notification_pushed', handleNotificationPushed);
      window.removeEventListener('smart_absensi_teachers_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_notifications_read_updated', handleScannedEvent);
      window.removeEventListener('storage', handleScannedEvent);
    };
  }, [effectiveUser?.id, token, selectedMonth, selectedYear, deviceUUID]);

  // Cross-device sync: auto-refresh data when user returns to the app from another device/tab
  const handleCrossDeviceSync = useCallback(() => {
    if (loadAllDataRef.current) {
      loadAllDataRef.current();
    }
  }, []);

  useCrossDeviceSync({
    onSync: handleCrossDeviceSync,
    cooldownMs: 30000,
    enabled: !isPreviewMode && !!effectiveUser?.id,
  });

  // Dynamic monthly attendance statistics calculation against working days
  const currentMonthInfo = getMonthWorkingDays(
    new Date().getMonth() + 1,
    new Date().getFullYear(),
    true,
    settings
  );
  const effectiveWorkingDays = Math.max(1, currentMonthInfo.effectiveWorkingDays);
  const hadirCount = attendanceHistory.filter((h) => h.status === 'HADIR').length;
  const terlambatCount = attendanceHistory.filter((h) => h.status === 'TERLAMBAT').length;
  const totalMasukCount = hadirCount + terlambatCount;

  const attendancePercentage = effectiveWorkingDays > 0
    ? (Math.min(100, Math.round((totalMasukCount / effectiveWorkingDays) * 1000) / 10)).toFixed(1)
    : '0.0';

  const terlambatPercent = totalMasukCount > 0 ? (terlambatCount / totalMasukCount) * 100 : 0;

  // Teacher Appreciation & Gamification Score Calculation
  const appreciationScore = calculateTeacherAppreciationScore(
    attendanceHistory,
    _dutySchedules,
    todayMood,
    effectiveUser?.id
  );

  // Smart Class & Duty Alarm Evaluation (No AI Fake Data!)
  const smartAlarmStatus = evaluateSmartClassAlarm(
    teachingSlots,
    todayDutyDetails,
    currentTime
  );

  // Trigger audio chime & speech announcement when entering 10-minute upcoming KBM window
  useEffect(() => {
    if (
      smartAlarmStatus.type === 'UPCOMING_10MIN' &&
      smartAlarmStatus.upcomingSlot &&
      smartAlarmStatus.minutesUntilNext !== undefined &&
      smartAlarmStatus.minutesUntilNext <= 10
    ) {
      const slotKey = `${smartAlarmStatus.upcomingSlot.id}-${smartAlarmStatus.upcomingSlot.day}-${smartAlarmStatus.minutesUntilNext}`;
      if (lastChimedSlotKeyRef.current !== slotKey) {
        lastChimedSlotKeyRef.current = slotKey;
        SoundService.playNotificationChime();
        if (smartAlarmStatus.speechText) {
          SpeechService.speak(smartAlarmStatus.speechText);
        }
      }
    }
  }, [smartAlarmStatus]);

  const monthNamesIndonesian = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const activeMonthName = monthNamesIndonesian[selectedMonth - 1] || 'Bulan Ini';

  const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 11) return 'Selamat Pagi';
    if (hour < 15) return 'Selamat Siang';
    if (hour < 18) return 'Selamat Sore';
    return 'Selamat Malam';
  };

  const handleOpenScannerClick = () => {
    if (onOpenScanner) onOpenScanner();
  };

  const handleOpenLeaveModal = () => {
    if (onOpenLeaveForm) {
      onOpenLeaveForm();
    } else {
      setIsLeaveModalOpen(true);
    }
  };

  const handleOpenCorrectionModal = (targetDate?: string) => {
    setCorrectionInitialDate(targetDate);
    if (onOpenCorrectionForm) {
      onOpenCorrectionForm();
    } else {
      setIsCorrectionModalOpen(true);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      if (effectiveUser) {
        NotificationService.markAllIdsAsRead(effectiveUser.id, notifications.map((n) => n.id));
      }
      const provider = ProviderFactory.getProvider();
      const authToken = token || '';
      for (const n of notifications) {
        if (!n.is_read) {
          await provider.markNotificationAsRead(n.id, authToken).catch((err) => {
            console.warn('GuruDashboardPage markNotificationAsRead error for item:', err);
          });
        }
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast('info', 'Notifikasi Diperbarui', 'Semua notifikasi telah ditandai dibaca.');
    } catch (err) {
      handleAppError(err, 'GuruDashboard.markRead', 'Gagal memperbarui notifikasi');
    }
  };

  const handleMarkSingleNotificationRead = (notifItem: AppNotification | string) => {
    const id = typeof notifItem === 'string' ? notifItem : notifItem.id;
    const notifObj = typeof notifItem === 'string' ? notifications.find((n) => n.id === id) : notifItem;

    if (effectiveUser) {
      NotificationService.markIdAsRead(effectiveUser.id, id);
    }
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
    const provider = ProviderFactory.getProvider();
    const authToken = token || '';
    provider.markNotificationAsRead(id, authToken).catch(() => {});

    // Auto-open attendance correction modal if this notification is for missing attendance
    if (notifObj) {
      if (
        notifObj.action_type === 'CORRECTION' ||
        notifObj.title.includes('Presensi Belum') ||
        notifObj.title.includes('Koreksi Absen')
      ) {
        let targetDate = notifObj.action_date;
        if (!targetDate) {
          const match = notifObj.title.match(/(\d{4}-\d{2}-\d{2})/) || notifObj.message.match(/(\d{4}-\d{2}-\d{2})/);
          if (match) targetDate = match[1];
        }
        handleOpenCorrectionModal(targetDate);
      }
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 6 || confirmPin.length !== 6) {
      showToast('error', 'PIN Harus 6 Angka!', 'Masukkan 6 digit angka untuk PIN baru.');
      return;
    }
    if (newPin !== confirmPin) {
      showToast('error', 'Konfirmasi PIN Tidak Cocok!', 'PIN baru dan konfirmasi PIN harus sama.');
      return;
    }

    setIsChangingPin(true);
    try {
      const provider = ProviderFactory.getProvider();
      const authToken = token || '';
      await provider.changePin(effectiveUser.id, newPin, authToken);

      showToast('success', 'Ganti PIN Berhasil!', 'PIN akun Anda telah diperbarui. Gunakan PIN baru di login berikutnya.');
      setIsChangePinOpen(false);
      setNewPin('');
      setConfirmPin('');
    } catch (err: unknown) {
      handleAppError(err, 'GuruDashboard.changePin', 'Gagal memperbarui PIN');
    } finally {
      setIsChangingPin(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const prevGuruUnreadRef = React.useRef<number>(0);

  // Play audio chime when new unread notification arrives for Guru
  useEffect(() => {
    if (unreadCount > prevGuruUnreadRef.current && prevGuruUnreadRef.current >= 0) {
      SoundService.playNotificationChime();
    }
    prevGuruUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Helper to render interactive monthly calendar grid
  const renderCalendarGrid = () => {
    const daysInMonth = new Date(selectedYear, selectedMonth, 0).getDate();
    const firstDayObj = new Date(selectedYear, selectedMonth - 1, 1);
    const rawFirstDay = firstDayObj.getDay(); // 0 = Sun, 1 = Mon... 6 = Sat
    const startPadding = rawFirstDay === 0 ? 6 : rawFirstDay - 1; // Mon = 0 start

    const monthStr = String(selectedMonth).padStart(2, '0');
    const todayIso = new Date().toISOString().substring(0, 10);
    const daysOfWeek = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];

    const cells: Array<{
      isPadding: boolean;
      key: string;
      dayNumber?: number;
      dateStr?: string;
      record?: AttendanceRecord;
      isHoliday?: boolean;
      holidayDesc?: string;
      isToday?: boolean;
      isWeekend?: boolean;
    }> = [];

    for (let p = 0; p < startPadding; p++) {
      cells.push({ isPadding: true, key: `pad-prev-${p}` });
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dayStr = String(day).padStart(2, '0');
      const dateStr = `${selectedYear}-${monthStr}-${dayStr}`;
      const dayDate = new Date(selectedYear, selectedMonth - 1, day);
      const dayOfWeek = dayDate.getDay();

      const isSaturday = dayOfWeek === 6;
      const isSunday = dayOfWeek === 0;
      const isWeekendHoliday =
        (isSaturday && settings.saturday_is_holiday !== false) ||
        (isSunday && settings.sunday_is_holiday !== false);

      const record = attendanceHistory.find((r) => r.date === dateStr);
      const holiday = allHolidays.find((h) => h.date === dateStr);
      const isHoliday = isWeekendHoliday || !!holiday;

      cells.push({
        isPadding: false,
        key: dateStr,
        dayNumber: day,
        dateStr,
        record,
        isHoliday,
        holidayDesc: holiday ? holiday.name || holiday.description : isWeekendHoliday ? 'Libur Akhir Pekan' : undefined,
        isToday: dateStr === todayIso,
        isWeekend: isWeekendHoliday,
      });
    }

    const totalCells = cells.length;
    const remainder = totalCells % 7;
    if (remainder !== 0) {
      const trailingPadding = 7 - remainder;
      for (let t = 0; t < trailingPadding; t++) {
        cells.push({ isPadding: true, key: `pad-next-${t}` });
      }
    }

    return (
      <div className="space-y-3 pt-1">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-[9px] sm:text-xs text-slate-500 uppercase tracking-wider bg-slate-100/90 p-1.5 sm:p-2 rounded-xl sm:rounded-2xl border border-slate-200/80 shadow-2xs">
          {daysOfWeek.map((d, i) => (
            <div key={d} className={`min-w-0 truncate ${i >= 5 ? 'text-red-500 font-black' : ''}`}>
              {d}
            </div>
          ))}
        </div>

        {/* Calendar Day Tiles Grid */}
        <div className="grid grid-cols-7 gap-1 sm:gap-2">
          {cells.map((cell) => {
            if (cell.isPadding) {
              return (
                <div
                  key={cell.key}
                  className="aspect-square rounded-xl sm:rounded-2xl bg-slate-50/40 border border-dashed border-slate-200/50 opacity-30 pointer-events-none"
                />
              );
            }

            const rec = cell.record;
            const status = rec?.status;

            let tileClass = 'bg-white border-slate-200/80 hover:border-emerald-500 hover:bg-emerald-50/20';

            if (rec) {
              if (status === 'HADIR') {
                tileClass = 'bg-emerald-500/10 border-emerald-400/80 hover:bg-emerald-500/20 text-emerald-950 shadow-2xs';
              } else if (status === 'TERLAMBAT') {
                tileClass = 'bg-amber-500/10 border-amber-400/80 hover:bg-amber-500/20 text-amber-950 shadow-2xs';
              } else if (status === 'IZIN' || status === 'SAKIT' || status === 'DINAS_LUAR') {
                tileClass = 'bg-blue-500/10 border-blue-400/80 hover:bg-blue-500/20 text-blue-950 shadow-2xs';
              } else if (status === 'ALFA') {
                tileClass = 'bg-red-500/10 border-red-400/80 hover:bg-red-500/20 text-red-950 shadow-2xs';
              }
            } else if (cell.isHoliday) {
              tileClass = 'bg-slate-100 border-slate-200 text-slate-400';
            }

            return (
              <button
                key={cell.key}
                type="button"
                onClick={() =>
                  setSelectedCalendarDay({
                    dateStr: cell.dateStr!,
                    record: cell.record,
                    isHoliday: cell.isHoliday,
                    holidayDesc: cell.holidayDesc,
                  })
                }
                className={`aspect-square p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border flex flex-col justify-between items-center transition-all cursor-pointer relative group ${tileClass} ${
                  cell.isToday ? 'ring-2 ring-emerald-500 ring-offset-1 font-black shadow-md' : ''
                }`}
              >
                <div className="flex items-center justify-between w-full min-w-0">
                  <span className={`text-[10px] sm:text-xs font-black leading-none ${cell.isToday ? 'text-emerald-700' : cell.isWeekend ? 'text-red-500' : 'text-slate-800'}`}>
                    {cell.dayNumber}
                  </span>
                  {cell.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
                  )}
                </div>

                <div className="w-full flex items-center justify-center mt-auto pb-0.5 min-w-0">
                  {rec ? (
                    <span
                      className={`w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full shadow-2xs shrink-0 ${
                        status === 'HADIR'
                          ? 'bg-emerald-500 ring-2 ring-emerald-200'
                          : status === 'TERLAMBAT'
                          ? 'bg-amber-500 ring-2 ring-amber-200'
                          : status === 'ALFA'
                          ? 'bg-red-500 ring-2 ring-red-200'
                          : 'bg-blue-500 ring-2 ring-blue-200'
                      }`}
                      title={status}
                    />
                  ) : cell.isHoliday ? (
                    <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-slate-300 shrink-0" title="Libur" />
                  ) : (
                    <span className="text-[8px] sm:text-[9px] text-slate-300 font-bold block truncate leading-none">
                      {cell.isWeekend ? '•' : '-'}
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2.5 text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Hadir</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> Terlambat</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Izin / Sakit</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Alfa</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Libur</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen guru-pattern-bg pb-28 text-[#023246]">
      {/* ── PREVIEW MODE WARNING BANNER ───────────────────────────────────── */}
      {isPreviewMode && (
        <div className="bg-purple-900 text-purple-100 px-4 py-2 text-xs font-bold text-center border-b border-purple-700 flex items-center justify-center gap-2">
          <span>⚠️</span> MODE PREVIEW GURU (ADMIN/KEPSEK ACCESS) — Menggunakan data simulasi guru.
        </div>
      )}

      {/* ── TOP NAV BAR (HEADER) ────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-md border-b border-[#DDD9D0] sticky top-0 z-30 shadow-2xs w-full max-w-120 mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full bg-white p-0.5 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-xs ring-2 ring-emerald-50">
            <img src="/school-logo.png" alt="Logo SMP Terpadu Al-Ittihadiyah" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="min-w-0">
            <h1 className="font-extrabold text-[#023246] text-xs tracking-tight leading-tight uppercase truncate">
              Smart Absensi Guru
            </h1>
            <p className="text-[10px] font-medium text-slate-500 mt-0.5 truncate max-w-50">
              {settings.institution_name}
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('NOTIFIKASI')}
          className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0 min-h-11 min-w-11 flex items-center justify-center active:scale-95"
          aria-label="Notifikasi"
        >
          <BellIcon className={`w-5 h-5 transition-transform ${unreadCount > 0 ? 'animate-bell-ring text-amber-500' : 'text-slate-600'}`} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 px-1.5 py-0.2 text-[9px] font-black bg-red-600 text-white rounded-full min-w-4 text-center ring-2 ring-white shadow-2xs animate-pulse">
              {unreadCount}
            </span>
          )}
        </button>
      </header>

      <main className="px-4 pt-4 pb-20 space-y-4 w-full max-w-120 mx-auto">
        <NotificationPermissionBanner />
        <PWAInstallPrompt />
        {/* ── TAB 1: BERANDA ──────────────────────────────────────────────── */}
        {activeTab === 'BERANDA' && (
          <>
            {/* 🌟 1. MASTER UNIFIED HERO HEADER CARD ──────────────────────────── */}
            <div className="bg-[#023246] text-white rounded-3xl p-4.5 sm:p-5 shadow-sm border border-slate-700/60 relative overflow-hidden space-y-4">
              {/* Profile Greeting & Avatar Row */}
              <div className="flex items-center justify-between gap-3 relative z-10">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-12 h-12 rounded-2xl bg-white/10 p-0.5 border border-white/20 text-white font-black text-xl flex items-center justify-center overflow-hidden shrink-0 ring-2 ring-white/10">
                    <UserAvatar
                      avatarUrl={effectiveUser.avatar_url}
                      name={effectiveUser.full_name}
                      className="w-full h-full rounded-xl"
                      textClassName="text-xl"
                    />
                  </div>
                  <div className="space-y-0.5 min-w-0">
                    <span className="text-[10px] font-extrabold text-emerald-400 tracking-wider uppercase flex items-center gap-1">
                      <span>{getTimeBasedGreeting()}</span>
                    </span>
                    <h2 className="text-sm sm:text-base font-black text-white leading-tight truncate">
                      {effectiveUser.full_name}
                    </h2>
                    <p className="text-[10px] sm:text-[11px] font-semibold text-slate-300 truncate">
                      {effectiveUser.nip ? `NPP: ${effectiveUser.nip}` : effectiveUser.position || 'Guru Pengajar'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setActiveTab('NOTIFIKASI')}
                    className="relative p-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shrink-0 flex items-center justify-center min-h-11 min-w-11"
                    title="Buka Notifikasi & Pengumuman"
                    aria-label="Pusat Notifikasi & Pengumuman"
                  >
                    <BellIcon className={`w-5 h-5 ${unreadCount > 0 ? 'text-amber-400 animate-bell-ring' : 'text-slate-200'}`} />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[9px] font-black bg-red-500 text-white rounded-full min-w-4 text-center ring-2 ring-[#023246]">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('PROFIL')}
                    className="px-3 py-2 bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold rounded-xl transition-all active:scale-95 cursor-pointer shrink-0 flex items-center gap-1.5 min-h-11"
                  >
                    <UserIcon className="w-4 h-4 text-emerald-300" />
                    <span>Profil</span>
                  </button>
                </div>
              </div>

              {/* Digital Clock & Date Row */}
              <div className="bg-slate-900/80 p-3.5 rounded-2xl border border-white/10 flex items-center justify-between gap-3 relative z-10">
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                    </span>
                    <span>Waktu Perangkat</span>
                  </div>
                  <p className="text-xs font-semibold text-slate-200 truncate capitalize">
                    {formattedFullDateStr}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-xl sm:text-2xl font-black font-mono tracking-tight text-white flex items-center justify-end gap-1">
                    <span>{formattedTimeStr}</span>
                    <span className="text-[10px] font-extrabold text-emerald-400">WIB</span>
                  </div>
                </div>
              </div>

              {/* Status Badges Row (Network Signal & Mood & Piket) */}
              <div className="flex flex-wrap items-center gap-2 relative z-10 pt-0.5">
                {/* Network Signal Badge */}
                <div className={`px-2.5 py-1 rounded-xl border text-[10px] font-extrabold flex items-center gap-1.5 ${
                  isOnline
                    ? 'bg-emerald-500/20 border-emerald-400/30 text-emerald-200'
                    : 'bg-amber-500/30 border-amber-400/50 text-amber-200 animate-pulse'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400 animate-ping'}`} />
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                  {pendingItems.length > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        SyncEngine.processSyncQueue();
                      }}
                      disabled={syncState === 'SYNCING'}
                      className="ml-1 px-1.5 py-0.2 bg-emerald-600 text-white rounded font-black cursor-pointer hover:bg-emerald-700"
                    >
                      {syncState === 'SYNCING' ? '⏳' : `Sync (${pendingItems.length})`}
                    </button>
                  )}
                </div>

                {/* Mood Check-in Pill */}
                <button
                  type="button"
                  onClick={() => setIsMoodModalOpen(true)}
                  className="px-2.5 py-1.5 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 text-white text-[10px] font-extrabold transition-all active:scale-95 cursor-pointer flex items-center gap-1.5 min-h-9"
                >
                  <span>
                    {todayMood ? (
                      todayMood.mood === 'VERY_HAPPY' ? '😊' :
                      todayMood.mood === 'HAPPY' ? '🙂' :
                      todayMood.mood === 'NEUTRAL' ? '😐' :
                      todayMood.mood === 'TIRED' ? '😟' : '😫'
                    ) : '💙'}
                  </span>
                  <span>{todayMood ? `Mood: ${todayMood.mood === 'VERY_HAPPY' ? 'Semangat' : todayMood.mood === 'HAPPY' ? 'Baik' : todayMood.mood === 'NEUTRAL' ? 'Biasa' : todayMood.mood === 'TIRED' ? 'Lelah' : 'Stres'}` : 'Isi Mood'}</span>
                </button>

                {/* Duty Piket Pill if Active Today */}
                {isDutyTeacherToday && (
                  <div className="px-2.5 py-1 rounded-xl border border-amber-300/40 bg-amber-500/30 text-amber-100 text-[10px] font-black flex items-center gap-1">
                    <span>Guru Piket Hari Ini</span>
                  </div>
                )}
              </div>
            </div>

            {/* 📍 REAL-TIME GEOFENCE LOCATION CARD WIDGET ──────────────────── */}
            <TeacherLocationCard onOpenScanner={handleOpenScannerClick} />

            {/* 🌟 1.5 TEACHER APPRECIATION & GAMIFICATION WIDGET ─────────── */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-lg font-bold shrink-0 shadow-2xs">
                    🏆
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-black text-amber-800 uppercase tracking-wider block truncate">Apresiasi & Disiplin Guru</span>
                    <h3 className="text-xs font-black text-[#023246] truncate">{appreciationScore.level}</h3>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-base font-black text-amber-600 font-mono leading-none block">{appreciationScore.totalPoints}</span>
                  <span className="text-[9px] font-bold text-slate-500 block">Poin Kehadiran</span>
                </div>
              </div>

              {/* Level Progress Bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-[10px] font-bold text-slate-600">
                  <span>Kemajuan Level</span>
                  <span>{appreciationScore.levelProgressPercent}% (Target: {appreciationScore.nextLevelPoints} Poin)</span>
                </div>
                <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden border border-slate-200/60">
                  <div
                    className="bg-amber-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${appreciationScore.levelProgressPercent}%` }}
                  />
                </div>
              </div>

              {/* Badges Carousel / Grid */}
              <div className="grid grid-cols-4 gap-1.5 pt-0.5">
                {appreciationScore.badges.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => setActiveTab('PROFIL')}
                    title={`${b.title}: ${b.description}`}
                    className={`p-2 rounded-2xl border text-center flex flex-col items-center justify-center transition-all cursor-pointer ${
                      b.isUnlocked
                        ? 'bg-amber-50/80 border-amber-200 text-amber-950 shadow-2xs hover:scale-105'
                        : 'bg-slate-50 border-slate-200/80 text-slate-400 opacity-60 hover:opacity-80'
                    }`}
                  >
                    <span className="text-xl mb-0.5 leading-none">{b.icon}</span>
                    <span className="text-[9px] font-extrabold leading-tight truncate w-full">{b.title.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Piket Details Expand Banner if duty teacher */}
            {isDutyTeacherToday && (
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3.5 space-y-1.5 text-amber-950 shadow-2xs">
                <div className="flex items-center gap-2 font-black text-xs text-amber-900">
                  <span>🛡️ Selamat Bertugas Menjadi Guru Piket Hari Ini!</span>
                </div>
                <p className="text-[11px] text-amber-900 font-medium leading-relaxed">
                  {todayDutyDetails?.notes || 'Mari sambut siswa dengan senyuman dan bina ketertiban sekolah.'}
                </p>
                {fellowDutyTeachers.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 text-[10px] pt-1 border-t border-amber-200/60">
                    <span className="font-bold text-amber-800">Rekan Piket:</span>
                    {fellowDutyTeachers.map((t) => (
                      <span key={t.id} className="bg-amber-100 px-1.5 py-0.2 rounded font-extrabold text-amber-900">
                        👤 {t.teacher_name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Active Leave Request Status Alert Banner */}
            {userLeaves.length > 0 && (() => {
              const latestLeave = userLeaves[0];
              const isApproved = latestLeave.approval_status === 'APPROVED';
              const isRejected = latestLeave.approval_status === 'REJECTED';

              let bannerStyle = 'bg-amber-500/10 border-amber-400/80 text-amber-950';
              if (isApproved) bannerStyle = 'bg-emerald-500/10 border-emerald-400/80 text-emerald-950';
              if (isRejected) bannerStyle = 'bg-rose-500/10 border-rose-400/80 text-rose-950';

              return (
                <div className={`p-4 rounded-3xl border shadow-card transition-all space-y-2 ${bannerStyle}`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-base">
                        {isApproved ? '🟢' : isRejected ? '🔴' : '🟡'}
                      </span>
                      <span className="font-extrabold text-xs tracking-tight">
                        Status Izin ({latestLeave.leave_type}): {isApproved ? 'DISETUJUI KEPSEK' : isRejected ? 'DITOLAK KEPSEK' : 'MENUNGGU PERSETUJUAN KEPSEK'}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('RIWAYAT');
                        setHistorySubTab('LEAVES');
                      }}
                      className="text-[10px] font-extrabold px-2.5 py-1 bg-white/80 border border-slate-200 rounded-xl hover:bg-white cursor-pointer shrink-0 shadow-2xs"
                    >
                      Detail →
                    </button>
                  </div>

                  <div className="text-[11px] font-medium leading-relaxed bg-white/90 p-2.5 rounded-2xl border border-slate-200/60 space-y-1">
                    <p className="font-bold text-slate-800">
                      📅 Periode: {latestLeave.start_date} {latestLeave.end_date !== latestLeave.start_date ? `s/d ${latestLeave.end_date}` : ''}
                    </p>
                    <p className="text-slate-600 italic">"{latestLeave.reason}"</p>
                    {latestLeave.approval_notes && (
                      <div className={`pt-1.5 mt-1 border-t text-[11px] font-semibold ${
                        isApproved ? 'border-emerald-200 text-emerald-900' : 'border-rose-200 text-rose-900'
                      }`}>
                        💬 <strong className="uppercase font-bold text-[10px]">{isApproved ? 'Catatan Kepala Sekolah:' : 'Alasan Penolakan:'}</strong>{' '}
                        <span>{latestLeave.approval_notes}</span>
                        {latestLeave.approved_by && (
                          <span className="block text-[9px] text-slate-400 font-normal mt-0.5">
                            Oleh: {latestLeave.approved_by}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* 🌟 2. TODAY ATTENDANCE & WORK SCHEDULE HUB ────────────────────── */}
            <section className="bg-white rounded-3xl p-4 sm:p-4.5 shadow-card border border-slate-200/80 space-y-4">
              {/* Card Header & Status Badge */}
              <div className="flex items-center justify-between gap-2 pb-1 border-b border-slate-100">
                <div>
                  <h3 className="text-xs font-black text-[#023246] uppercase tracking-wider">
                    Status Presensi Hari Ini
                  </h3>
                  <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {isTodayOff.isOff ? (
                  <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-black rounded-full border border-emerald-300 shrink-0 flex items-center gap-1 shadow-2xs">
                    <span>🌴</span>
                    <span>{isTodayOff.reason}</span>
                  </span>
                ) : todayHoliday ? (
                  <Badge status="SAKIT">🎉 {todayHoliday.name}</Badge>
                ) : todayAttendance ? (
                  <Badge status={todayAttendance.status}>
                    {todayAttendance.status === 'HADIR'
                      ? '✅ Hadir'
                      : todayAttendance.status === 'TERLAMBAT'
                      ? '⚠️ Terlambat'
                      : todayAttendance.status}
                  </Badge>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-800 text-xs font-black rounded-full border border-amber-300 shrink-0">
                    ⏳ Belum Presensi
                  </span>
                )}
              </div>

              {/* Work Hours Schedule Banner */}
              {(() => {
                const isFriday = new Date().getDay() === 5;
                const checkoutStart = isFriday
                  ? (settings.friday_checkout_start || CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START)
                  : settings.work_checkout_start;

                return (
                  <div className="bg-slate-50 p-3 rounded-2xl flex items-center justify-between text-xs border border-slate-200/80">
                    <div className="space-y-0.5">
                      <span className="text-slate-500 font-extrabold block text-[10px] uppercase tracking-wider">Batas Absen Masuk</span>
                      <span className="font-black text-[#023246] text-xs sm:text-sm">{settings.work_checkin_end} WIB</span>
                    </div>
                    <div className="h-7 w-px bg-slate-200 mx-2" />
                    <div className="space-y-0.5 text-right">
                      <span className="text-slate-500 font-extrabold block text-[10px] uppercase tracking-wider">
                        Absen Pulang {isFriday ? '(Jumat)' : ''}
                      </span>
                      <span className="font-black text-[#023246] text-xs sm:text-sm">{checkoutStart} WIB</span>
                    </div>
                  </div>
                );
              })()}

              {/* Check-In / Check-Out Log Details Grid (Interactive Clickable Cards) */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200/80 space-y-1 shadow-2xs text-left cursor-pointer hover:border-emerald-400 hover:shadow-md active:scale-95 transition-all"
                  title="Klik untuk membuka Kamera Scanner QR Presensi Masuk"
                >
                  <span className="text-[10px] font-black text-emerald-800 uppercase tracking-wider block">Jam Masuk (Klik Absen)</span>
                  <p className="font-black text-emerald-950 text-base sm:text-lg">
                    {todayAttendance?.check_in_time ? todayAttendance.check_in_time.substring(0, 5) : '--:--'}
                  </p>
                  <span className="text-[10px] text-emerald-700 font-bold block truncate">
                    {todayAttendance?.check_in_time ? 'Tercatat Valid ✨' : isTodayOff.isOff ? 'Hari Libur' : 'Scan Sekarang →'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={onOpenScanner}
                  className="p-3 rounded-2xl bg-blue-50/70 border border-blue-200/80 space-y-1 shadow-2xs text-left cursor-pointer hover:border-blue-400 hover:shadow-md active:scale-95 transition-all"
                  title="Klik untuk membuka Kamera Scanner QR Presensi Pulang"
                >
                  <span className="text-[10px] font-black text-blue-800 uppercase tracking-wider block">Jam Pulang (Klik Absen)</span>
                  <p className="font-black text-blue-950 text-base sm:text-lg">
                    {todayAttendance?.check_out_time ? todayAttendance.check_out_time.substring(0, 5) : '--:--'}
                  </p>
                  <span className="text-[10px] text-blue-700 font-bold block truncate">
                    {todayAttendance?.check_out_time ? 'Absen Pulang Selesai ✨' : isTodayOff.isOff ? 'Hari Libur' : 'Scan Sekarang →'}
                  </span>
                </button>
              </div>

              {/* GPS Readiness & Live Map Box */}
              {(() => {
                const isOfflineMode = typeof navigator !== 'undefined' && !navigator.onLine;
                const rawAllowed = getEffectiveAllowedRadius(settings.geofence_radius);
                const effectiveAllowedRadius = isOfflineMode ? Math.max(rawAllowed, 500) : rawAllowed;

                return (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-700 px-0.5">
                      <span className="flex items-center gap-1.5 font-black text-[#023246]">
                        <span>🗺️ Lokasi Real-time Anda</span>
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-black rounded-lg border ${
                        gpsHealth.status === 'READY'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                          : 'bg-amber-50 text-amber-800 border-amber-300'
                      }`}>
                        📍 {gpsHealth.text}
                      </span>
                    </div>

                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner">
                      <LiveLocationMap
                        userLat={userCoords?.latitude}
                        userLng={userCoords?.longitude}
                        schoolLat={settings.geofence_lat || CONSTANTS.DEFAULTS.GEOFENCE_LAT}
                        schoolLng={settings.geofence_lng || CONSTANTS.DEFAULTS.GEOFENCE_LNG}
                        allowedRadius={effectiveAllowedRadius}
                        accuracy={userCoords?.accuracy}
                        height="160px"
                      />
                    </div>
                  </div>
                );
              })()}

              {/* Action Button or Off-Day Informative Banner */}
              {isTodayOff.isOff ? (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-center gap-3 shadow-2xs">
                  <span className="text-3xl shrink-0">🌴</span>
                  <div className="space-y-0.5 text-xs">
                    <p className="font-black text-emerald-950 text-sm">Hari Ini Libur ({isTodayOff.reason})</p>
                    <p className="text-[11px] text-emerald-800 font-medium leading-relaxed">
                      Sesuai jadwal sekolah, tidak ada kewajiban presensi hari ini. Selamat beristirahat!
                    </p>
                  </div>
                </div>
              ) : (
                <Button
                  variant="primary"
                  leftIcon={<QrCodeScanIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white shrink-0" />}
                  onClick={handleOpenScannerClick}
                  onMouseEnter={() => {
                    import('html5-qrcode').catch(() => {});
                  }}
                  onTouchStart={() => {
                    import('html5-qrcode').catch(() => {});
                  }}
                  className="w-full py-3.5 sm:py-4 text-xs sm:text-sm font-black tracking-tight shadow-md shadow-emerald-700/20 flex-row items-center justify-center gap-2 sm:gap-2.5 cursor-pointer rounded-2xl bg-linear-to-r from-[#0D7A5F] to-[#095744] hover:from-[#095744] hover:to-[#023246] transition-all active:scale-[0.98] whitespace-normal leading-tight text-center"
                >
                  PINDAI QR CODE ABSENSI
                </Button>
              )}
            </section>

            {/* 🌟 2.5 SMART CLASS ALARM BANNER (PENGINGAT KBM & PIKET) ─────────── */}
            <div className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xl shrink-0">
                    {smartAlarmStatus.type === 'UPCOMING_10MIN' ? '⏰' :
                     smartAlarmStatus.type === 'CURRENTLY_TEACHING' ? '📚' :
                     smartAlarmStatus.type === 'DUTY_TODAY' ? '🛡️' : '📅'}
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-xs font-black text-[#023246] tracking-tight uppercase truncate">
                      Pengingat Smart KBM & Piket
                    </h3>
                    <p className="text-[10px] text-slate-500 font-semibold truncate">Alarm Persiapan Kelas Hari Ini</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    SoundService.playNotificationChime();
                    if (smartAlarmStatus.speechText) {
                      SpeechService.speak(smartAlarmStatus.speechText);
                    }
                    showToast('info', 'Tes Suara Alarm KBM', 'Suara chime dan pengingat audio berfungsi normal.');
                  }}
                  className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-xl text-[10px] font-extrabold cursor-pointer transition-all active:scale-95 flex items-center gap-1 shadow-2xs shrink-0"
                >
                  <span>🔊 Tes Alarm</span>
                </button>
              </div>

              <div className={`p-3 rounded-2xl border text-xs leading-relaxed space-y-1 ${
                smartAlarmStatus.type === 'UPCOMING_10MIN'
                  ? 'bg-amber-500/10 border-amber-400 text-amber-950 font-semibold animate-pulse'
                  : smartAlarmStatus.type === 'CURRENTLY_TEACHING'
                  ? 'bg-emerald-500/10 border-emerald-400 text-emerald-950 font-semibold'
                  : smartAlarmStatus.type === 'DUTY_TODAY'
                  ? 'bg-blue-500/10 border-blue-400 text-blue-950 font-semibold'
                  : 'bg-slate-50 border-slate-200 text-slate-600 font-medium'
              }`}>
                <p className="font-extrabold text-[11px] leading-tight">{smartAlarmStatus.message}</p>
                {smartAlarmStatus.type === 'NO_SCHEDULE' && (
                  <div className="flex items-center justify-between pt-1 border-t border-slate-200/60 mt-1">
                    <span className="text-[10px] text-slate-500 italic">Jadwal resmi dikelola oleh Kurikulum / Operator.</span>
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="text-[10px] font-black text-[#0D7A5F] underline cursor-pointer"
                    >
                      Lihat Jadwal →
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* 🌟 3. QUICK ACTION FEATURE CARDS (INTUITIVE & MINIMALIST) ─────────── */}
            <section className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={handleOpenLeaveModal}
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs transition-all text-left flex flex-col items-start justify-between space-y-2 cursor-pointer group active:scale-95 min-w-0 w-full min-h-21"
              >
                <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-200 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <DocumentTextIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-extrabold text-[#023246] text-[11px] sm:text-xs leading-tight truncate">Ajukan Izin</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold truncate mt-0.5">Sakit / Cuti</p>
                </div>
              </button>

              <button
                onClick={() => handleOpenCorrectionModal()}
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs transition-all text-left flex flex-col items-start justify-between space-y-2 cursor-pointer group active:scale-95 min-w-0 w-full min-h-21"
              >
                <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <PencilSquareIcon className="w-5 h-5 text-amber-600" />
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-extrabold text-[#023246] text-[11px] sm:text-xs leading-tight truncate">Koreksi Absen</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold truncate mt-0.5">Lapor Admin</p>
                </div>
              </button>

              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="p-3 bg-white hover:bg-slate-50 rounded-2xl border border-slate-200 shadow-2xs transition-all text-left flex flex-col items-start justify-between space-y-2 cursor-pointer group active:scale-95 min-w-0 w-full min-h-21"
              >
                <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <CalendarDaysIcon className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="min-w-0 w-full">
                  <h3 className="font-extrabold text-[#023246] text-[11px] sm:text-xs leading-tight truncate">Jadwal Kelas</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold truncate mt-0.5">Jam Mengajar</p>
                </div>
              </button>
            </section>
          </>
        )}

        {/* ── TAB 2: RIWAYAT BULANAN ──────────────────────────────────────── */}
        {activeTab === 'RIWAYAT' && (
          <section className="space-y-3 sm:space-y-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#D4D4CE]/30 shadow-xs sm:shadow-card space-y-3 sm:space-y-4">
              {/* Riwayat Category Sub-Tab Switcher */}
              <div className="flex bg-slate-100 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl gap-1 border border-slate-200/80">
                <button
                  type="button"
                  onClick={() => setHistorySubTab('ATTENDANCE')}
                  className={`flex-1 py-1.5 sm:py-2 text-[11px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                    historySubTab === 'ATTENDANCE'
                      ? 'bg-white text-[#023246] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>📅 Presensi Harian</span>
                  <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded-full text-[9px] sm:text-[10px]">
                    {attendanceHistory.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHistorySubTab('LEAVES')}
                  className={`flex-1 py-1.5 sm:py-2 text-[11px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                    historySubTab === 'LEAVES'
                      ? 'bg-white text-[#023246] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>📝 Riwayat Izin</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[9px] sm:text-[10px]">
                    {userLeaves.length}
                  </span>
                </button>
              </div>

              {/* SUB-TAB 1: PRESENSI HARIAN */}
              {historySubTab === 'ATTENDANCE' && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                    <div>
                      <h2 className="font-black text-[#023246] text-xs sm:text-base">Presensi & Statistik</h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-semibold">Tampilkan data presensi per bulan</p>
                    </div>

                    {/* Dynamic Month / Year Filter Controls */}
                    <div className="flex items-center gap-1.5">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                        className="text-[11px] sm:text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl px-2 py-1 text-slate-700 outline-none"
                      >
                        {monthNamesIndonesian.map((mName, idx) => (
                          <option key={idx + 1} value={idx + 1}>
                            {mName}
                          </option>
                        ))}
                      </select>

                      <select
                        value={selectedYear}
                        onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
                        className="text-[11px] sm:text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg sm:rounded-xl px-2 py-1 text-slate-700 outline-none"
                      >
                        <option value={2026}>2026</option>
                        <option value={2025}>2025</option>
                      </select>
                    </div>
                  </div>

                  {/* Cetak Rekap Mandiri PDF/Excel Button */}
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(true)}
                    className="w-full py-2.5 px-3 bg-linear-to-r from-[#0D7A5F] to-[#095744] hover:from-[#095744] hover:to-[#023246] text-white text-xs font-black rounded-xl transition-all flex items-center justify-center gap-2 shadow-xs active:scale-98 cursor-pointer"
                  >
                    <span>🖨️</span> CETAK LAPORAN PRESENSI SAYA (PDF / EXCEL BER-QR CODE)
                  </button>

                  {/* View Mode Toggle Switcher: CALENDAR vs LIST */}
                  <div className="flex items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-2xl border border-slate-200/80">
                    <span className="text-[11px] font-extrabold text-slate-700 pl-1">
                      Mode Tampilan:
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setHistoryViewMode('CALENDAR')}
                        className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          historyViewMode === 'CALENDAR'
                            ? 'bg-[#023246] text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>📅 Kalender Grid</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryViewMode('LIST')}
                        className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5 ${
                          historyViewMode === 'LIST'
                            ? 'bg-[#023246] text-white shadow-xs'
                            : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>📋 Daftar Log</span>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Stats Cards */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                    <div className="p-3 bg-[#C8F2E0]/40 rounded-xl sm:rounded-2xl border border-[#0D7A5F]/20 space-y-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#0D7A5F] block uppercase truncate">Kehadiran {activeMonthName}</span>
                      <p className="text-lg sm:text-xl font-black text-[#023246]">{attendancePercentage}%</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block truncate">{hadirCount + terlambatCount} dari {effectiveWorkingDays} Hari Kerja</span>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl sm:rounded-2xl border border-amber-200 space-y-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 block uppercase">Terlambat</span>
                      <p className="text-lg sm:text-xl font-black text-amber-950">{terlambatCount} <span className="text-xs font-bold text-amber-700">Kali</span></p>
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block truncate">{terlambatPercent.toFixed(0)}% dari presensi</span>
                    </div>
                  </div>

                  {/* Calendar Grid Mode vs List Mode */}
                  {isLoadingHistory ? (
                    <SkeletonList count={4} />
                  ) : historyViewMode === 'CALENDAR' ? (
                    renderCalendarGrid()
                  ) : (
                    <div className="space-y-2 pt-1">
                      <h3 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Catatan Harian {activeMonthName} {selectedYear}</h3>
                      
                      {attendanceHistory.length === 0 ? (
                        <EmptyState
                          icon="📅"
                          title="Belum Ada Presensi Bulan Ini"
                          description={`Belum ada rekaman presensi pada ${activeMonthName} ${selectedYear}. Mulai dengan melakukan scan QR Code absensi.`}
                        />
                      ) : (
                        attendanceHistory.map((rec) => (
                          <div key={rec.id} className="p-3 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 flex items-center justify-between text-xs transition-colors">
                            <div className="space-y-0.5">
                              <p className="font-extrabold text-[#023246] text-xs">{rec.date}</p>
                              <p className="text-[10px] text-slate-500 font-semibold">
                                Masuk: {rec.check_in_time ? rec.check_in_time.substring(0, 5) : '--:--'} • Pulang: {rec.check_out_time ? rec.check_out_time.substring(0, 5) : '--:--'}
                              </p>
                            </div>

                            <Badge status={rec.status}>
                              {rec.status === 'HADIR' ? 'Hadir' : rec.status === 'TERLAMBAT' ? 'Terlambat' : rec.status}
                            </Badge>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* SUB-TAB 2: RIWAYAT PENGAJUAN IZIN / CUTI */}
              {historySubTab === 'LEAVES' && (
                <div className="space-y-3 sm:space-y-4">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 gap-2">
                    <div>
                      <h2 className="font-black text-[#023246] text-xs sm:text-base">Permohonan Izin & Cuti</h2>
                      <p className="text-[10px] sm:text-xs text-slate-400 font-semibold">Daftar pengajuan izin dikirim</p>
                    </div>

                    <Button
                      variant="primary"
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="px-2.5 py-1 text-xs font-bold flex items-center gap-1 cursor-pointer rounded-lg sm:rounded-xl shrink-0"
                    >
                      <span>➕ Ajukan Izin</span>
                    </Button>
                  </div>

                  {/* Leaves Overview Badges Summary */}
                  <div className="grid grid-cols-3 gap-1.5 sm:gap-2 text-center text-xs">
                    <div className="p-1.5 sm:p-2.5 bg-amber-50 rounded-xl border border-amber-200 min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-800 uppercase block truncate">Menunggu</span>
                      <p className="text-xs sm:text-base font-black text-amber-950 mt-0.5">
                        {userLeaves.filter((l) => l.approval_status === 'PENDING').length}
                      </p>
                    </div>

                    <div className="p-1.5 sm:p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-800 uppercase block truncate">Disetujui</span>
                      <p className="text-xs sm:text-base font-black text-emerald-950 mt-0.5">
                        {userLeaves.filter((l) => l.approval_status === 'APPROVED').length}
                      </p>
                    </div>

                    <div className="p-1.5 sm:p-2.5 bg-red-50 rounded-xl border border-red-200 min-w-0">
                      <span className="text-[9px] sm:text-[10px] font-extrabold text-red-800 uppercase block truncate">Ditolak</span>
                      <p className="text-xs sm:text-base font-black text-red-950 mt-0.5">
                        {userLeaves.filter((l) => l.approval_status === 'REJECTED').length}
                      </p>
                    </div>
                  </div>

                  {/* List of Leave Applications */}
                  <div className="space-y-2 pt-1">
                    {isLoadingLeaves ? (
                      <SkeletonList count={3} />
                    ) : userLeaves.length === 0 ? (
                      <EmptyState
                        icon="📝"
                        title="Belum Ada Pengajuan Izin"
                        description="Anda belum pernah mengajukan izin atau cuti. Tekan tombol 'Ajukan Izin' di atas jika Anda perlu izin tidak hadir."
                      />
                    ) : (
                      userLeaves.map((leave) => {
                        const statusColor =
                          leave.approval_status === 'APPROVED'
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : leave.approval_status === 'REJECTED'
                            ? 'bg-red-100 text-red-800 border-red-300'
                            : 'bg-amber-100 text-amber-800 border-amber-300';

                        const statusText =
                          leave.approval_status === 'APPROVED'
                            ? '✓ DISETUJUI'
                            : leave.approval_status === 'REJECTED'
                            ? '✕ DITOLAK'
                            : '⏳ MENUNGGU REVIEW';

                        return (
                          <div
                            key={leave.id}
                            className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 text-xs space-y-1.5 transition-all"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block px-1.5 py-0.2 rounded-md text-[9px] sm:text-[10px] font-black bg-blue-100 text-blue-900 border border-blue-200 mb-0.5">
                                  {leave.leave_type}
                                </span>
                                <h4 className="font-extrabold text-slate-900 text-[11px] sm:text-xs">
                                  {leave.start_date} {leave.end_date !== leave.start_date ? `s/d ${leave.end_date}` : ''}
                                </h4>
                              </div>

                              <span className={`px-1.5 py-0.5 text-[9px] sm:text-[10px] font-black rounded-md sm:rounded-lg border shrink-0 ${statusColor}`}>
                                {statusText}
                              </span>
                            </div>

                            <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium leading-relaxed bg-white p-2 rounded-lg sm:rounded-xl border border-slate-200">
                              "{leave.reason}"
                            </p>

                            {leave.attachment_url && (
                              <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-emerald-700 font-bold">
                                <span>📎</span> Ada Lampiran Surat/Bukti Foto
                              </div>
                            )}

                            {leave.approval_notes && (
                              <p className="text-[9px] sm:text-[10px] text-slate-500 font-semibold italic bg-amber-50/60 p-1.5 rounded-lg border border-amber-200/60">
                                Catatan Kepala Sekolah: {leave.approval_notes}
                              </p>
                            )}

                            <span className="text-[9px] text-slate-400 font-mono block pt-0.5">
                              Diajukan pada: {new Date(leave.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ── TAB 3: NOTIFIKASI ───────────────────────────────────────────── */}
        {activeTab === 'NOTIFIKASI' && (
          <section className="space-y-3 sm:space-y-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#D4D4CE]/30 shadow-xs sm:shadow-card space-y-3 sm:space-y-4">
              <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                <div>
                  <h2 className="font-black text-[#023246] text-xs sm:text-base">Notifikasi & Pengumuman</h2>
                  <p className="text-[10px] sm:text-xs text-slate-400 font-semibold">{unreadCount} belum dibaca</p>
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllNotificationsRead}
                    className="text-xs font-bold text-[#0D7A5F] hover:underline cursor-pointer"
                  >
                    Tandai Dibaca
                  </button>
                )}
              </div>

              <div className="space-y-2">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Tidak ada notifikasi baru.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkSingleNotificationRead(n)}
                      className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-xs space-y-1.5 transition-all cursor-pointer ${
                        !n.is_read
                          ? n.action_type === 'CORRECTION'
                            ? 'bg-amber-50/70 border-amber-300/80 hover:border-amber-500 shadow-xs'
                            : 'bg-[#C8F2E0]/20 border-[#0D7A5F]/30 hover:border-[#0D7A5F]'
                          : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-[#023246] text-xs flex items-center gap-1.5">
                          {n.action_type === 'CORRECTION' && <span>✏️</span>}
                          <span>{n.title}</span>
                        </h3>
                        {!n.is_read && (
                          <span
                            className={`w-2 h-2 rounded-full ${
                              n.action_type === 'CORRECTION' ? 'bg-amber-500 animate-pulse' : 'bg-[#0D7A5F]'
                            }`}
                          />
                        )}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium leading-relaxed">
                        {n.message}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[9px] text-slate-400 font-mono block">
                          {n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : 'Hari ini'}
                        </span>
                        {n.action_type === 'CORRECTION' && (
                          <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-900 bg-amber-100/90 hover:bg-amber-200 px-2 py-0.5 rounded-lg border border-amber-300/80 transition-colors">
                            <span>✏️ Ajukan Koreksi</span>
                            <span>➔</span>
                          </span>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── TAB 4: PROFIL ───────────────────────────────────────────────── */}
        {activeTab === 'PROFIL' && (
          <section className="space-y-3 sm:space-y-4">
            <div className="bg-white p-3.5 sm:p-5 rounded-2xl sm:rounded-3xl border border-[#D4D4CE]/30 shadow-xs sm:shadow-card space-y-4">
              <div className="text-center space-y-2 pb-3.5 border-b border-slate-100">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-[#C8F2E0] text-[#0D7A5F] font-black text-3xl flex items-center justify-center mx-auto shadow-inner border-2 border-[#0D7A5F]/20 overflow-hidden shrink-0 ring-4 ring-emerald-50">
                  <UserAvatar
                    avatarUrl={effectiveUser.avatar_url}
                    name={effectiveUser.full_name}
                    className="w-full h-full rounded-full"
                    textClassName="text-3xl"
                  />
                </div>

                <div>
                  <h2 className="font-black text-[#023246] text-base sm:text-lg">{effectiveUser.full_name}</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">{effectiveUser.position || 'Guru Pengajar'}</p>
                </div>
              </div>

              {/* Device Binding Status Section */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-slate-700 text-xs">📱 Keamanan Perangkat Presensi (1 Akun = 1 HP)</span>
                  <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-black rounded-full border shrink-0 ${
                    Boolean(effectiveUser?.full_name) && effectiveUser.full_name.toLowerCase().includes('dafa maulana')
                      ? 'bg-sky-100 text-sky-800 border-sky-300'
                      : deviceBindingStatus.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : deviceBindingStatus.status === 'DIFFERENT_DEVICE'
                      ? 'bg-red-100 text-red-800 border-red-300'
                      : deviceBindingStatus.status === 'UNAVAILABLE'
                      ? 'bg-orange-100 text-orange-800 border-orange-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {Boolean(effectiveUser?.full_name) && effectiveUser.full_name.toLowerCase().includes('dafa maulana')
                      ? '🚀 BYPASS MULTI-DEVICE'
                      : deviceBindingStatus.status === 'ACTIVE'
                      ? '🔒 TERIKAT AKTIF (1 HP)'
                      : deviceBindingStatus.status === 'DIFFERENT_DEVICE'
                      ? '⚠️ HP BERBEDA (DIBLOKIR)'
                      : deviceBindingStatus.status === 'UNAVAILABLE'
                      ? '⚠️ TIDAK TERVERIFIKASI'
                      : '🟡 PERLU BINDING'}
                  </span>
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium leading-relaxed bg-white p-2 rounded-lg sm:rounded-xl border border-slate-200">
                  {deviceBindingStatus.message}
                </p>

                <div className="flex items-center justify-between text-[9px] sm:text-[10px] font-mono text-slate-500 pt-0.5">
                  <span>HP Ini: <b>{deviceUUID ? deviceUUID.substring(0, 8) + '...' : 'Browser'}</b></span>
                  <span>Terdaftar: <b>{deviceBindingStatus.registered_uuid ? deviceBindingStatus.registered_uuid.substring(0, 8) + '...' : '-'}</b></span>
                </div>

                <div className="flex justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      checkDeviceStatus();
                      showToast('success', 'Status Perangkat Diperbarui', 'Pengecekan ulang binding HP selesai.');
                    }}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 font-extrabold text-[10px] sm:text-[11px] rounded-lg border border-slate-300 transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>🔄 Re-Sync HP</span>
                  </button>
                </div>
              </div>

              {/* Teacher Appreciation Badge Showcase Section */}
              <div className="p-3.5 sm:p-4 rounded-2xl bg-[#FFFDF7] border border-amber-200/90 space-y-3 shadow-2xs">
                <div className="flex items-center justify-between gap-2 border-b border-amber-200/60 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎖️</span>
                    <div>
                      <h3 className="font-extrabold text-xs text-[#023246]">Lencana Penghargaan & Apresiasi Kepsek</h3>
                      <p className="text-[10px] text-slate-500 font-medium">Monitoring performa disiplin internal sekolah</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-500 text-white text-[10px] font-black rounded-xl shadow-2xs">
                    {appreciationScore.totalPoints} Poin
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  {appreciationScore.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`p-3 rounded-2xl border space-y-1 transition-all ${
                        badge.isUnlocked
                          ? 'bg-amber-50/60 border-amber-200/90 shadow-2xs text-slate-900'
                          : 'bg-slate-50/80 border-slate-200 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-2xl">{badge.icon}</span>
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded-lg border ${
                          badge.isUnlocked
                            ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}>
                          {badge.isUnlocked ? 'TERBUKA ✨' : `${badge.progressPercent}%`}
                        </span>
                      </div>
                      <h4 className="font-extrabold text-[11px] text-slate-900 leading-tight pt-1">{badge.title}</h4>
                      <p className="text-[9px] text-slate-500 leading-relaxed font-medium">{badge.description}</p>
                    </div>
                  ))}
                </div>

                <div className="p-2.5 bg-amber-50/40 rounded-xl border border-amber-200/60 text-[10px] text-slate-600 font-medium leading-relaxed">
                  💡 <b>Catatan Kepala Sekolah:</b> Poin dan lencana kehadiran ini dihitung otomatis untuk pertimbangan apresiasi dan reward periodik guru teladan sekolah.
                </div>
              </div>

              {/* Voice Announcement Audio & Customization Card */}
              <VoiceSettingsCard teacherName={effectiveUser.full_name} institutionName={settings.institution_name} />

              {/* Syarat & Ketentuan Section */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-[#0D7A5F]/5 border border-[#0D7A5F]/20 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-base">📜</span>
                    <span className="font-bold text-xs text-[#023246]">Syarat & Ketentuan Presensi</span>
                  </div>
                  <span className="text-[10px] font-extrabold text-[#0D7A5F] bg-[#0D7A5F]/10 px-2 py-0.5 rounded-full">
                    Resmi
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Aturan penggunaan presensi digital, geofence GPS, binding HP, serta tata cara pengajuan izin & koreksi absen.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="w-full mt-1 py-2 px-3 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-xs active:scale-98 cursor-pointer"
                >
                  <span>📋</span> Lihat Syarat & Ketentuan Lengkap
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  variant="secondary"
                  onClick={() => setIsChangePinOpen(true)}
                  leftIcon={<KeyIcon className="w-4 h-4 text-slate-700" />}
                  className="w-full text-xs font-extrabold py-3 flex items-center justify-center gap-2 cursor-pointer rounded-xl min-h-11"
                >
                  UBAH PIN KEAMANAN 6-DIGIT
                </Button>

                <Button
                  variant="danger"
                  onClick={logout}
                  leftIcon={<LogOutIcon className="w-4 h-4 text-white" />}
                  className="w-full text-xs font-extrabold py-3 flex items-center justify-center gap-2 cursor-pointer rounded-xl min-h-11"
                >
                  KELUAR DARI AKUN (LOGOUT)
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION DOCK (Compact & Sleek) ── */}
      <nav className="fixed bottom-0 left-0 right-0 w-full max-w-120 mx-auto bg-white/95 backdrop-blur-xl border-t border-[#DDD9D0] px-2 py-1.5 z-40 shadow-xl rounded-t-2xl">
        <div className="flex items-center justify-around relative">
          <button
            onClick={() => setActiveTab('BERANDA')}
            className={`flex flex-col items-center gap-1 text-[10px] w-14 py-1 transition-all cursor-pointer min-h-11 justify-center active:scale-95 ${
              activeTab === 'BERANDA' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <HomeIcon className={`w-5 h-5 ${activeTab === 'BERANDA' ? 'text-[#023246]' : 'text-slate-400'}`} />
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('RIWAYAT')}
            className={`flex flex-col items-center gap-1 text-[10px] w-14 py-1 transition-all cursor-pointer min-h-11 justify-center active:scale-95 ${
              activeTab === 'RIWAYAT' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <ChartIcon className={`w-5 h-5 ${activeTab === 'RIWAYAT' ? 'text-[#023246]' : 'text-slate-400'}`} />
            <span>Riwayat</span>
          </button>

          {/* Center Compact FAB Scanner Button */}
          <div className="relative -top-3 flex flex-col items-center">
            <button
              onClick={handleOpenScannerClick}
              className="w-12 h-12 rounded-2xl bg-[#023246] hover:bg-[#0D7A5F] text-white flex items-center justify-center shadow-md ring-4 ring-white active:scale-95 transition-all cursor-pointer min-h-12 min-w-12"
              title="Pindai QR Code Absensi"
            >
              <QrCodeScanIcon className="w-6 h-6 text-white" />
            </button>
            <span className="text-[9px] font-extrabold text-[#023246] mt-0.5">Scan QR</span>
          </div>

          <button
            onClick={() => setActiveTab('NOTIFIKASI')}
            className={`flex flex-col items-center gap-1 text-[10px] w-14 py-1 transition-all cursor-pointer relative min-h-11 justify-center active:scale-95 ${
              activeTab === 'NOTIFIKASI' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-2 px-1.5 py-0.2 text-[8px] font-black bg-red-600 text-white rounded-full min-w-4 text-center ring-2 ring-white animate-pulse">
                {unreadCount}
              </span>
            )}
            <BellIcon className={`w-5 h-5 ${activeTab === 'NOTIFIKASI' ? 'text-[#023246]' : unreadCount > 0 ? 'text-amber-500 animate-bell-ring' : 'text-slate-400'}`} />
            <span>Notif</span>
          </button>

          <button
            onClick={() => setActiveTab('PROFIL')}
            className={`flex flex-col items-center gap-1 text-[10px] w-14 py-1 transition-all cursor-pointer min-h-11 justify-center active:scale-95 ${
              activeTab === 'PROFIL' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <UserIcon className={`w-5 h-5 ${activeTab === 'PROFIL' ? 'text-[#023246]' : 'text-slate-400'}`} />
            <span>Profil</span>
          </button>
        </div>
      </nav>

      {/* Leave Application Modal */}
      <LeaveApplicationModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSuccess={() => {
          showToast('success', 'Pengajuan Terikirim', 'Izin Anda akan ditinjau oleh Kepala Sekolah.');
        }}
      />

      {/* Dedicated Guru Correction Request Modal */}
      <GuruCorrectionRequestModal
        isOpen={isCorrectionModalOpen}
        initialDate={correctionInitialDate}
        onClose={() => {
          setIsCorrectionModalOpen(false);
          setCorrectionInitialDate(undefined);
        }}
        onSuccess={() => {
          showToast('success', 'Pengajuan Terkirim', 'Permohonan koreksi absen akan ditinjau Admin.');
        }}
      />

      {/* Change PIN Modal */}
      <Modal isOpen={isChangePinOpen} onClose={() => setIsChangePinOpen(false)} title="🔑 Ubah PIN Keamanan 6-Digit">
        <form onSubmit={handleChangePinSubmit} className="space-y-4 py-1">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">PIN Baru (6 Angka)</label>
            <Input
              type="password"
              maxLength={6}
              placeholder="Masukkan 6 Digit Angka Baru"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Konfirmasi PIN Baru</label>
            <Input
              type="password"
              maxLength={6}
              placeholder="Ulangi 6 Digit Angka Baru"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsChangePinOpen(false)} disabled={isChangingPin}>
              Batal
            </Button>
            <Button variant="primary" type="submit" isLoading={isChangingPin}>
              Simpan PIN Baru
            </Button>
          </div>
        </form>
      </Modal>

      {/* Teaching Schedule Modal */}
      <TeachingScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
      />

      {/* Terms & Conditions Modal */}
      <TermsAndConditionsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />

      {/* ── DAY DETAIL CALENDAR MODAL ───────────────────────────────────── */}
      {selectedCalendarDay && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedCalendarDay(null)}
          title={`📅 Detail Presensi: ${selectedCalendarDay.dateStr}`}
          maxWidth="md"
        >
          <div className="space-y-4 py-1">
            {selectedCalendarDay.record ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-600">Status Kehadiran</span>
                  <Badge status={selectedCalendarDay.record.status}>
                    {selectedCalendarDay.record.status === 'HADIR'
                      ? 'Hadir Tepat Waktu'
                      : selectedCalendarDay.record.status === 'TERLAMBAT'
                      ? 'Terlambat'
                      : selectedCalendarDay.record.status}
                  </Badge>
                </div>
                <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">Jam Masuk</span>
                  <p className="text-sm font-black text-slate-900">
                    {selectedCalendarDay.record.check_in_time ? `${selectedCalendarDay.record.check_in_time.substring(0, 5)} WIB` : 'Tidak Ada Data'}
                  </p>
                </div>
              </div>
            ) : selectedCalendarDay.isHoliday ? (
              <div className="p-3.5 bg-slate-100 rounded-2xl border border-slate-200 text-xs text-slate-700 font-bold flex items-center gap-2">
                <span className="text-lg">🏖️</span>
                <span>{selectedCalendarDay.holidayDesc || 'Hari Libur Kerja / Akhir Pekan'}</span>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-bold flex items-center gap-2">
                <span>⚠️</span>
                <span>Tidak ada catatan presensi fisik pada tanggal ini.</span>
              </div>
            )}

            <div className="pt-2 flex justify-between gap-2 border-t border-slate-100">
              <Button
                variant="secondary"
                type="button"
                onClick={() => {
                  const targetDay = selectedCalendarDay.dateStr;
                  setSelectedCalendarDay(null);
                  handleOpenCorrectionModal(targetDay);
                }}
                className="text-xs font-bold flex items-center gap-1 cursor-pointer"
              >
                <span>✏️ Ajukan Koreksi Date Ini</span>
              </Button>
              <Button variant="primary" type="button" onClick={() => setSelectedCalendarDay(null)} className="text-xs font-bold cursor-pointer">
                Tutup
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Mood Check-in Modal */}
      <MoodCheckinModal
        isOpen={isMoodModalOpen}
        onClose={() => setIsMoodModalOpen(false)}
        onSaved={() => {
          setIsMoodModalOpen(false);
          const provider = ProviderFactory.getProvider();
          const todayStr = getTodayDateInJakarta();
          provider.getTodayTeacherMood(effectiveUser.id, todayStr, token || undefined).then((m) => setTodayMood(m));
        }}
      />

      {/* Export Report Modal for Self PDF/Excel Download */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        teachers={[effectiveUser]}
        attendanceRecords={attendanceHistory}
        leaveRequests={userLeaves}
        defaultTeacherId={effectiveUser.id}
      />
    </div>
  );
};
