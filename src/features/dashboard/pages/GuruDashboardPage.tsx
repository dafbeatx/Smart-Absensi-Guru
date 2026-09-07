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
import { AnonymousComplaintModal } from '../../guru/components/AnonymousComplaintModal';
import { AttendanceRecapModal } from '../../guru/components/AttendanceRecapModal';
import { TeacherAnnouncementModal } from '../../guru/components/TeacherAnnouncementModal';
import { ClassroomManagementModal } from '../../guru/components/ClassroomManagementModal';
import { TeacherLocationModal } from '../../guru/components/TeacherLocationModal';
import { StudentDirectoryModal } from '../../guru/components/StudentDirectoryModal';
import { TeachingMaterialsModal } from '../../guru/components/TeachingMaterialsModal';
import { SchoolEventsCalendarModal } from '../../guru/components/SchoolEventsCalendarModal';
import { MoreFeaturesModal } from '../../guru/components/MoreFeaturesModal';
import { StudentRfidKioskModal } from '../../attendance/components/StudentRfidKioskModal';
import {
  Radio,
  Fingerprint,
  QrCode,
  Clock,
  Calendar,
  BarChart3,
  FileEdit,
  Megaphone,
  GraduationCap,
  School,
  BookOpen,
  CalendarRange,
  MapPin,
  MessageSquare,
  Smile,
  Lock,
  FileText,
  ArrowLeft,
  ArrowRight,
  LayoutGrid,
  FileSpreadsheet,
} from 'lucide-react';
import { BiometricAttendanceModal } from '../../guru/components/BiometricAttendanceModal';
import { AttendanceMethodChoiceModal } from '../../guru/components/AttendanceMethodChoiceModal';
import { BiometricService } from '../../../services/biometric.service';
import { ExportReportModal } from '../../../components/dashboard/ExportReportModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { ComplaintRepository } from '../../../repositories/ComplaintRepository';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { CONSTANTS } from '../../../config/constants';
import { handleAppError } from '../../../utils/error.utils';
import { isDateOffDay, getTodayDateInJakarta, getCurrentTimeInJakarta, getMonthWorkingDays } from '../../../utils/time.utils';
import { getEffectiveAllowedRadius } from '../../../utils/geofence.utils';
import { QrCodeScanIcon } from '../../../components/ui/QrCodeScanIcon';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { VoiceSettingsCard } from '../../../components/dashboard/VoiceSettingsCard';
import { NotificationPermissionBanner } from '../../../components/dashboard/NotificationPermissionBanner';
import { PWAInstallPrompt } from '../../../components/ui/PWAInstallPrompt';
import { NotificationService } from '../../../services/notification-permission.service';
import { SyncEngine } from '../../../services/sync-engine.service';
import { DutyScheduleRepository } from '../../../repositories/DutyScheduleRepository';
import {
  TeachingScheduleRepository,
  TEACHING_SCHEDULES_UPDATED_EVENT,
} from '../../../repositories/TeachingScheduleRepository';
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
  TeacherComplaint,
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

// Helper: Real-time Live Status for Teaching Slot
const getSlotLiveStatus = (
  timeStr: string,
  now: Date
): 'CURRENT' | 'NEXT' | 'FINISHED' | 'UPCOMING' => {
  try {
    const parts = timeStr.split('-').map((p) => p.trim());
    if (parts.length < 2) return 'UPCOMING';
    const [startStr, endStr] = parts;
    const [sh, sm] = startStr.split(':').map((n) => parseInt(n, 10));
    const [eh, em] = endStr.split(':').map((n) => parseInt(n, 10));
    if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 'UPCOMING';
    const currentMin = now.getHours() * 60 + now.getMinutes();
    const startMin = sh * 60 + sm;
    const endMin = eh * 60 + em;
    if (currentMin >= startMin && currentMin < endMin) return 'CURRENT';
    if (currentMin >= endMin) return 'FINISHED';
    if (startMin > currentMin && startMin - currentMin <= 30) return 'NEXT';
    return 'UPCOMING';
  } catch {
    return 'UPCOMING';
  }
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
  const [berandaLayer, setBerandaLayer] = useState<'HOME' | 'ALL_FEATURES'>('HOME');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionInitialDate, setCorrectionInitialDate] = useState<string | undefined>(undefined);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAttendanceChoiceModalOpen, setIsAttendanceChoiceModalOpen] = useState(false);

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
  const [historySubTab, setHistorySubTab] = useState<'ATTENDANCE' | 'LEAVES' | 'COMPLAINTS'>('ATTENDANCE');
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
  const [userComplaints, setUserComplaints] = useState<TeacherComplaint[]>([]);
  const [isLoadingComplaints, setIsLoadingComplaints] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const [teachingSlots, setTeachingSlots] = useState<TeachingSlot[]>([]);
  const lastChimedSlotKeyRef = useRef<string | null>(null);

  // Dedicated Modal Layer States for 12-Icon Grid
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [isAnnouncementModalOpen, setIsAnnouncementModalOpen] = useState(false);
  const [isClassroomModalOpen, setIsClassroomModalOpen] = useState(false);
  const [isLocationModalOpen, setIsLocationModalOpen] = useState(false);
  const [isStudentDirectoryModalOpen, setIsStudentDirectoryModalOpen] = useState(false);
  const [studentDirectoryClassFilter, setStudentDirectoryClassFilter] = useState<string | undefined>(undefined);
  const [isTeachingMaterialsModalOpen, setIsTeachingMaterialsModalOpen] = useState(false);
  const [isEventsCalendarModalOpen, setIsEventsCalendarModalOpen] = useState(false);
  const [isMoreFeaturesModalOpen, setIsMoreFeaturesModalOpen] = useState(false);
  const [isStudentKioskOpen, setIsStudentKioskOpen] = useState(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [isBioEnrolled, setIsBioEnrolled] = useState(false);
  const [isInfoExpanded, setIsInfoExpanded] = useState(false);

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

  // Real-time Network Connection & Offline Queue State
  const [isOnline, setIsOnline] = useState<boolean>(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));

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

  const loadUserComplaints = async () => {
    if (!effectiveUser) return;
    setIsLoadingComplaints(true);
    try {
      const complaints = await ComplaintRepository.getUserComplaints(effectiveUser.id, token || undefined);
      setUserComplaints(complaints);
    } catch (err) {
      console.warn('Failed to load user complaints:', err);
    } finally {
      setIsLoadingComplaints(false);
    }
  };

  const checkDeviceStatus = async () => {
    if (!effectiveUser) return;
    try {
      setIsBioEnrolled(BiometricService.isEnrolled(effectiveUser.id));
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
    loadUserComplaints();
    checkDeviceStatus();

    const handleLeaveUpdate = () => {
      loadUserLeaves();
    };

    const handleComplaintUpdate = () => {
      loadUserComplaints();
    };

    const handleDeviceReset = (e: Event) => {
      const customEv = e as CustomEvent<{ userId?: string }>;
      if (!customEv.detail || customEv.detail.userId === effectiveUser.id) {
        checkDeviceStatus();
        showToast('info', 'Binding HP Direset', 'Perangkat HP Anda telah di-reset oleh Admin/Operator.');
      }
    };

    window.addEventListener('smart_absensi_leave_updated', handleLeaveUpdate);
    window.addEventListener('smart_absensi_complaints_updated', handleComplaintUpdate);
    window.addEventListener('smart_absensi_device_reset', handleDeviceReset);
    window.addEventListener('storage', handleLeaveUpdate);
    window.addEventListener('storage', handleComplaintUpdate);
    window.addEventListener('storage', checkDeviceStatus);

    return () => {
      window.removeEventListener('smart_absensi_leave_updated', handleLeaveUpdate);
      window.removeEventListener('smart_absensi_complaints_updated', handleComplaintUpdate);
      window.removeEventListener('smart_absensi_device_reset', handleDeviceReset);
      window.removeEventListener('storage', handleLeaveUpdate);
      window.removeEventListener('storage', handleComplaintUpdate);
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

      // 7.5 Load Real Teaching Slots for Logged-In Teacher (Cloud + Local Cache Sync)
      try {
        const userSlots = await TeachingScheduleRepository.getTeacherSchedules(
          effectiveUser.id,
          effectiveUser.full_name || undefined,
          authToken
        );
        setTeachingSlots(userSlots);

        // Automated In-App Notification Push for Today's Teaching Schedule (e.g. Senin / today)
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const todayDayName = dayNames[new Date().getDay()];
        const todaySlots = userSlots.filter((s) => s && s.day === todayDayName);

        if (todaySlots.length > 0) {
          const schedNotifId = `notif_teaching_sched_${effectiveUser.id}_${getTodayDateInJakarta()}`;
          const isSchedRead = NotificationService.isNotificationRead(effectiveUser.id, schedNotifId);

          const slotSummary = todaySlots
            .map((s) => `${s.subject} (${s.className}, ${s.time.split('-')[0]?.trim()} WIB)`)
            .join(' • ');

          setNotifications((prev) => {
            const existingIdx = prev.findIndex(
              (n) => n.id === schedNotifId || (n.title.includes('Jadwal Mengajar') && n.title.includes(todayDayName))
            );
            if (existingIdx !== -1) {
              return prev.map((n, idx) =>
                idx === existingIdx
                  ? { ...n, is_read: Boolean(n.is_read) || isSchedRead }
                  : n
              );
            }
            const newNotif: AppNotification = {
              id: schedNotifId,
              user_id: effectiveUser.id,
              title: `📅 Jadwal Mengajar Hari Ini (${todayDayName})`,
              message: `Anda memiliki ${todaySlots.length} jadwal KBM hari ini: ${slotSummary}. Silakan bersiap-siap tepat waktu.`,
              type: 'INFO',
              is_read: isSchedRead,
              created_at: new Date().toISOString(),
            };
            return [newNotif, ...prev];
          });
        }
      } catch (err) {
        console.warn('Failed to load teaching schedules:', err);
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
    window.addEventListener('smart_absensi_holidays_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_notifications_read_updated', handleScannedEvent);
    window.addEventListener('storage', handleScannedEvent);
    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_records_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_notification_pushed', handleNotificationPushed);
      window.removeEventListener('smart_absensi_teachers_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_holidays_updated', handleScannedEvent);
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

  // Listen for real-time teaching schedule updates across windows/tabs
  useEffect(() => {
    const handleSchedulesUpdated = async () => {
      if (!effectiveUser?.id) return;
      try {
        const userSlots = await TeachingScheduleRepository.getTeacherSchedules(
          effectiveUser.id,
          effectiveUser.full_name || undefined,
          token || undefined
        );
        setTeachingSlots(userSlots);
      } catch (err) {
        console.warn('Failed to refresh teaching slots on event:', err);
      }
    };

    window.addEventListener(TEACHING_SCHEDULES_UPDATED_EVENT, handleSchedulesUpdated);
    return () => {
      window.removeEventListener(TEACHING_SCHEDULES_UPDATED_EVENT, handleSchedulesUpdated);
    };
  }, [effectiveUser?.id, effectiveUser?.full_name, token]);

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

  const handleOpenAttendanceChoice = () => {
    setIsAttendanceChoiceModalOpen(true);
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
    <div className="min-h-screen bg-slate-50 pb-28 text-[#023246]">
      {/* ── PREVIEW MODE WARNING BANNER ───────────────────────────────────── */}
      {isPreviewMode && (
        <div className="bg-purple-900 text-purple-100 px-4 py-2 text-xs font-bold text-center border-b border-purple-700 flex items-center justify-center gap-2">
          <span>⚠️</span> MODE PREVIEW GURU (ADMIN/KEPSEK ACCESS) — Menggunakan data simulasi guru.
        </div>
      )}

      {/* ── TOP NAV BAR (HEADER) ────────────────────────────────────────── */}
      <header className="bg-[#023246] text-white pt-4 pb-7 px-4 shadow-sm w-full max-w-120 mx-auto rounded-b-3xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 border-2 border-white/30 shadow-xs">
              <UserAvatar
                avatarUrl={effectiveUser.avatar_url}
                name={effectiveUser.full_name}
                className="w-full h-full object-cover"
                textClassName="text-sm font-bold text-white"
              />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-semibold text-cyan-200 uppercase tracking-wider truncate">
                {settings.institution_name || 'Portal Smart Absensi Guru'}
              </p>
              <h1 className="font-black text-white text-sm sm:text-base leading-tight truncate">
                {getTimeBasedGreeting()}, {effectiveUser.full_name}
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setActiveTab('NOTIFIKASI')}
            className="relative p-2.5 text-white/90 hover:text-white hover:bg-white/10 rounded-2xl transition-colors cursor-pointer shrink-0 min-h-11 min-w-11 flex items-center justify-center active:scale-95"
            aria-label="Notifikasi"
          >
            <Megaphone className="w-5 h-5 text-cyan-200" />
            {unreadCount > 0 && (
              <span className="absolute top-1.5 right-1.5 px-1.5 py-0.2 text-[9px] font-black bg-red-500 text-white rounded-full min-w-4 text-center ring-2 ring-[#023246] shadow-2xs animate-pulse">
                {unreadCount}
              </span>
            )}
          </button>
        </div>

        <div className="mt-3 pt-2.5 border-t border-white/10 flex items-center justify-between text-xs text-slate-200">
          <span className="font-medium">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </span>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-white/10 text-cyan-200 border border-white/15">
            {isOnline ? '● Online' : '○ Offline'}
          </span>
        </div>
      </header>

      <main className="px-4 -mt-3.5 pb-24 space-y-3.5 w-full max-w-120 mx-auto">
        <NotificationPermissionBanner />
        <PWAInstallPrompt />
        {/* ── TAB 1: BERANDA ──────────────────────────────────────────────── */}
        {activeTab === 'BERANDA' && berandaLayer === 'HOME' && (
          <>
            {/* 🌟 1. CARD LOG PRESENSI HARI INI (DEVICE LOG TODAY MODEL) ─────────── */}
            {(() => {
              const isFriday = new Date().getDay() === 5;
              const checkoutStart = isFriday
                ? (settings.friday_checkout_start || CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START)
                : settings.work_checkout_start;

              let statusLabel = 'Belum Absen';
              let statusBadgeStyle = 'bg-amber-50 text-amber-800 border-amber-200';
              let ctaText = 'Absen Masuk Sekarang';
              let ctaAction = handleOpenAttendanceChoice;
              let isCtaDisabled = false;

              if (isTodayOff.isOff) {
                statusLabel = 'Hari Libur';
                statusBadgeStyle = 'bg-slate-100 text-slate-700 border-slate-200';
                ctaText = `Hari Libur (${isTodayOff.reason || 'Tidak Ada KBM'})`;
                isCtaDisabled = true;
              } else if (todayAttendance?.check_out_time) {
                statusLabel = 'Presensi Selesai';
                statusBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                ctaText = 'Lihat Rekap Kehadiran Hari Ini';
                ctaAction = () => setIsRecapModalOpen(true);
              } else if (todayAttendance?.check_in_time) {
                const nowTimeJakarta = getCurrentTimeInJakarta();
                const isReadyToCheckout = nowTimeJakarta >= checkoutStart;

                if (isReadyToCheckout) {
                  statusLabel = 'Siap Check-out';
                  statusBadgeStyle = 'bg-blue-50 text-blue-800 border-blue-200';
                  ctaText = 'Absen Pulang Sekarang';
                  ctaAction = handleOpenAttendanceChoice;
                } else {
                  statusLabel = 'Sudah Check-in';
                  statusBadgeStyle = 'bg-emerald-50 text-emerald-800 border-emerald-200';
                  ctaText = `Absen Pulang (Mulai ${checkoutStart} WIB)`;
                  ctaAction = handleOpenAttendanceChoice;
                }
              }

              return (
                <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Log Presensi Hari Ini
                    </span>
                    <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border shrink-0 ${statusBadgeStyle}`}>
                      {statusLabel}
                    </span>
                  </div>

                  {/* 4 Kolom Log Jam seperti Referensi */}
                  <div className="grid grid-cols-4 gap-1.5 bg-slate-50/90 rounded-2xl p-2.5 border border-slate-200/70 text-center">
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Check In</span>
                      <p className="text-xs sm:text-sm font-black text-[#023246]">
                        {todayAttendance?.check_in_time ? todayAttendance.check_in_time.substring(0, 5) : '--:--'}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Check Out</span>
                      <p className="text-xs sm:text-sm font-black text-[#023246]">
                        {todayAttendance?.check_out_time ? todayAttendance.check_out_time.substring(0, 5) : '--:--'}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Batas In</span>
                      <p className="text-xs sm:text-sm font-bold text-slate-600">
                        {settings.work_checkin_end?.substring(0, 5) || '07:15'}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">Mulai Out</span>
                      <p className="text-xs sm:text-sm font-bold text-slate-600">
                        {checkoutStart}
                      </p>
                    </div>
                  </div>

                  {/* Tombol CTA Utama Biru Navy */}
                  <button
                    type="button"
                    disabled={isCtaDisabled}
                    onClick={ctaAction}
                    className={`w-full h-12 rounded-2xl text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs ${
                      isCtaDisabled
                        ? 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
                        : 'bg-[#023246] hover:bg-[#034560] text-white active:scale-[0.98]'
                    }`}
                  >
                    {!todayAttendance && !isTodayOff.isOff && (
                      <Fingerprint className="w-5 h-5 text-cyan-300 shrink-0" />
                    )}
                    {todayAttendance && !todayAttendance.check_out_time && !isTodayOff.isOff && (
                      <Fingerprint className="w-5 h-5 text-cyan-300 shrink-0" />
                    )}
                    <span>{ctaText}</span>
                  </button>

                  {/* Fast Action Links & GPS Row */}
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-0.5 border-t border-slate-100">
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        onClick={() => setIsBiometricModalOpen(true)}
                        className="text-slate-600 hover:text-[#023246] font-semibold flex items-center gap-1 cursor-pointer py-0.5"
                      >
                        <span>👆 Sidik Jari</span>
                      </button>
                      <span className="text-slate-300">•</span>
                      <button
                        type="button"
                        onClick={handleOpenScannerClick}
                        className="text-slate-600 hover:text-[#023246] font-semibold flex items-center gap-1 cursor-pointer py-0.5"
                      >
                        <span>📷 Scan QR</span>
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsLocationModalOpen(true)}
                      className="text-slate-600 hover:text-[#023246] font-semibold flex items-center gap-1.5 cursor-pointer py-0.5 truncate max-w-42.5"
                    >
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          gpsHealth.status === 'READY' ? 'bg-emerald-500' : 'bg-amber-500'
                        }`}
                      />
                      <span className="truncate">GPS: {gpsHealth.text.replace('📍 ', '')}</span>
                    </button>
                  </div>
                </section>
              );
            })()}

            {/* 🌟 2. CARD RINGKASAN KEHADIRAN BULAN INI (ATTENDANCE THIS MONTH MODEL) ── */}
            {(() => {
              const hadirCount = attendanceHistory.filter((r) => r.status === 'HADIR').length;
              const terlambatCount = attendanceHistory.filter((r) => r.status === 'TERLAMBAT').length;
              const izinCount = attendanceHistory.filter((r) => r.status === 'IZIN' || r.status === 'SAKIT').length;
              const alpaCount = attendanceHistory.filter((r) => r.status === 'ALFA').length;

              return (
                <section className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-sm space-y-2.5">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                      Rekap Kehadiran Bulan Ini
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsRecapModalOpen(true)}
                      className="text-xs font-bold text-[#023246] hover:underline cursor-pointer"
                    >
                      Detail →
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    {/* Hadir */}
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                      <p className="text-lg sm:text-xl font-black text-[#023246]">{hadirCount}</p>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mt-0.5">
                        Hadir
                      </span>
                    </div>

                    {/* Terlambat */}
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                      <p className="text-lg sm:text-xl font-black text-amber-600">{terlambatCount}</p>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mt-0.5">
                        Terlambat
                      </span>
                    </div>

                    {/* Izin/Sakit */}
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                      <p className="text-lg sm:text-xl font-black text-blue-600">{izinCount}</p>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mt-0.5">
                        Izin/Sakit
                      </span>
                    </div>

                    {/* Alpa */}
                    <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100">
                      <p className="text-lg sm:text-xl font-black text-slate-600">{alpaCount}</p>
                      <span className="text-[10px] font-bold text-slate-500 block uppercase tracking-wider mt-0.5">
                        Alpa
                      </span>
                    </div>
                  </div>
                </section>
              );
            })()}

            {/* 🌟 3. FITUR UTAMA GURU (4 ICON PENTING + MORE LAYER) ─────────── */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                  Menu Utama
                </span>
                <span className="text-[10px] font-semibold text-slate-400">
                  4 Fitur Harian
                </span>
              </div>

              {/* 4 Icon Utama Saja */}
              <div className="grid grid-cols-4 gap-2">
                {/* 1. Presensi */}
                <button
                  type="button"
                  onClick={handleOpenAttendanceChoice}
                  className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                >
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                    <Fingerprint className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                    Presensi
                  </span>
                </button>

                {/* 2. Izin & Cuti */}
                <button
                  type="button"
                  onClick={handleOpenLeaveModal}
                  className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                >
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                    <Clock className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                    Izin Cuti
                  </span>
                </button>

                {/* 3. Jadwal KBM */}
                <button
                  type="button"
                  onClick={() => setIsScheduleModalOpen(true)}
                  className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                >
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                    <Calendar className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                    Jadwal
                  </span>
                </button>

                {/* 4. Rekap Presensi */}
                <button
                  type="button"
                  onClick={() => setIsRecapModalOpen(true)}
                  className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                >
                  <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                    <BarChart3 className="w-6 h-6 stroke-[1.8]" />
                  </div>
                  <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                    Rekap
                  </span>
                </button>
              </div>

              {/* Tulisan & Tombol More: Pindah Layer ke Semua Fitur */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    setBerandaLayer('ALL_FEATURES');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full py-2.5 px-3.5 rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 active:scale-[0.99] border border-slate-200/80 text-xs font-bold text-[#023246] flex items-center justify-between transition-all cursor-pointer group"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-lg bg-[#023246] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <LayoutGrid className="w-3.5 h-3.5" />
                    </div>
                    <span className="truncate">Lihat Semua Menu &amp; Layanan (More)</span>
                  </div>
                  <div className="flex items-center gap-1 text-[11px] font-bold text-cyan-800 group-hover:text-[#023246] shrink-0">
                    <span>More</span>
                    <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </button>
              </div>
            </div>

            {/* 🌟 4. JADWAL MENGAJAR HARI INI ───────────────────────────────── */}
            {(() => {
              const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
              const todayDayName = dayNames[new Date().getDay()];
              const todaySlots = teachingSlots.filter((s) => s && s.day === todayDayName);

              let activeOrNextSlot = todaySlots.find((s) => {
                const status = getSlotLiveStatus(s.time, currentTime);
                return status === 'CURRENT';
              });
              if (!activeOrNextSlot) {
                activeOrNextSlot = todaySlots.find((s) => {
                  const status = getSlotLiveStatus(s.time, currentTime);
                  return status === 'NEXT';
                });
              }
              if (!activeOrNextSlot) {
                activeOrNextSlot = todaySlots.find((s) => {
                  const status = getSlotLiveStatus(s.time, currentTime);
                  return status === 'UPCOMING';
                });
              }
              if (!activeOrNextSlot && todaySlots.length > 0) {
                activeOrNextSlot = todaySlots[todaySlots.length - 1];
              }

              const slotStatus = activeOrNextSlot ? getSlotLiveStatus(activeOrNextSlot.time, currentTime) : null;

              if (todaySlots.length === 0) {
                return (
                  <section className="bg-white rounded-3xl p-4 border border-slate-200/90 shadow-sm flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-slate-500 shrink-0">
                        <Calendar className="w-5 h-5 text-[#023246]" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-800 leading-tight">
                          Tidak Ada Jadwal Mengajar Hari Ini
                        </h4>
                        <p className="text-[11px] text-slate-500 font-medium">Hari {todayDayName}</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="text-xs font-bold text-[#023246] hover:underline shrink-0 px-2 py-1 cursor-pointer"
                    >
                      Jadwal Mingguan →
                    </button>
                  </section>
                );
              }

              return (
                <section className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                        Jadwal Mengajar Hari Ini
                      </span>
                      <span className="text-[11px] text-slate-400 font-medium">• {todayDayName}</span>
                    </div>

                    {slotStatus === 'CURRENT' ? (
                      <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold rounded-full">
                        Sedang Berlangsung
                      </span>
                    ) : slotStatus === 'NEXT' ? (
                      <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold rounded-full">
                        Berikutnya
                      </span>
                    ) : slotStatus === 'FINISHED' ? (
                      <span className="px-2.5 py-0.5 bg-slate-100 text-slate-600 text-[10px] font-medium rounded-full">
                        Selesai
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold rounded-full">
                        Mendatang
                      </span>
                    )}
                  </div>

                  {activeOrNextSlot && (
                    <div className="bg-slate-50 rounded-2xl p-3 border border-slate-200/60 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-bold text-[#023246] truncate">
                          {activeOrNextSlot.subject}
                        </h4>
                        <span className="px-2 py-0.5 bg-white text-slate-700 border border-slate-200 text-[11px] font-bold rounded-lg shrink-0">
                          {activeOrNextSlot.className}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 font-medium pt-0.5">
                        <span className="flex items-center gap-1 font-mono font-semibold text-slate-700">
                          ⏱️ {activeOrNextSlot.time} WIB
                        </span>
                        <span>📍 {activeOrNextSlot.room || 'Kelas'}</span>
                      </div>
                    </div>
                  )}

                  <div className="pt-0.5">
                    <button
                      type="button"
                      onClick={() => setIsScheduleModalOpen(true)}
                      className="text-xs font-bold text-[#023246] hover:underline flex items-center justify-between w-full transition-colors cursor-pointer"
                    >
                      <span>
                        {todaySlots.length > 1
                          ? `Lihat semua jadwal hari ini (${todaySlots.length} mapel)`
                          : 'Lihat jadwal mingguan'}
                      </span>
                      <span className="text-slate-400">›</span>
                    </button>
                  </div>
                </section>
              );
            })()}

            {/* 🌟 5. CATATAN & AKTIVITAS UNTUK ANDA ──────────────────────────── */}
            {(() => {
              interface InfoItem {
                id: string;
                icon: React.ReactNode;
                title: string;
                description: string;
                action: () => void;
                badge?: string;
                badgeColor?: string;
              }

              const items: InfoItem[] = [];

              // 1. Guru Piket Hari Ini
              if (isDutyTeacherToday) {
                const dutyFellows = fellowDutyTeachers.length > 0
                  ? ` (Rekan: ${fellowDutyTeachers.map((t) => t.teacher_name).join(', ')})`
                  : '';
                items.push({
                  id: 'duty',
                  icon: <Radio className="w-5 h-5 text-cyan-600 animate-pulse" />,
                  title: 'Tugas Guru Piket Hari Ini',
                  description: (todayDutyDetails?.notes || 'Bantu absensi kartu RFID siswa & ketertiban gerbang') + dutyFellows,
                  action: () => setIsStudentKioskOpen(true),
                  badge: 'Terminal RFID →',
                  badgeColor: 'text-cyan-800 bg-cyan-50 border-cyan-300',
                });
              }

              // 2. Status Izin Aktif
              if (userLeaves.length > 0) {
                const latest = userLeaves[0];
                const statusText =
                  latest.approval_status === 'APPROVED'
                    ? 'Disetujui'
                    : latest.approval_status === 'REJECTED'
                    ? 'Ditolak'
                    : 'Menunggu Persetujuan';
                items.push({
                  id: 'leave_status',
                  icon: <span className="text-base">📋</span>,
                  title: `Status Izin: ${statusText}`,
                  description: `${latest.leave_type} (${latest.start_date}) • ${latest.reason}`,
                  action: () => {
                    setActiveTab('RIWAYAT');
                    setHistorySubTab('LEAVES');
                  },
                  badge: 'Detail Izin →',
                  badgeColor:
                    latest.approval_status === 'APPROVED'
                      ? 'text-emerald-800 bg-emerald-50 border-emerald-300'
                      : 'text-amber-800 bg-amber-50 border-amber-300',
                });
              }

              // 3. Smart Alarm KBM & Piket
              if (smartAlarmStatus.type !== 'NO_SCHEDULE') {
                items.push({
                  id: 'smart_alarm',
                  icon: <span className="text-base">⏰</span>,
                  title: 'Pengingat KBM & Kelas',
                  description: smartAlarmStatus.message,
                  action: () => {
                    SoundService.playNotificationChime();
                    if (smartAlarmStatus.speechText) {
                      SpeechService.speak(smartAlarmStatus.speechText);
                    }
                    showToast('info', 'Alarm KBM', 'Suara pengingat berfungsi normal.');
                  },
                  badge: 'Tes Suara',
                  badgeColor: 'text-blue-800 bg-blue-50 border-blue-300',
                });
              }

              // 4. Pengumuman Sekolah Terbaru
              if (notifications.length > 0) {
                items.push({
                  id: 'announcement',
                  icon: <span className="text-base">📢</span>,
                  title: notifications[0].title,
                  description: notifications[0].message,
                  action: () => setIsAnnouncementModalOpen(true),
                  badge: 'Buka Warta',
                  badgeColor: 'text-indigo-800 bg-indigo-50 border-indigo-300',
                });
              }

              // 5. Poin Apresiasi Dedikasi
              const appreciation = calculateTeacherAppreciationScore(
                attendanceHistory,
                _dutySchedules,
                todayMood,
                effectiveUser?.id
              );
              items.push({
                id: 'appreciation',
                icon: <span className="text-base">⭐</span>,
                title: `Poin Apresiasi: ${appreciation.totalPoints} Poin`,
                description: `${appreciation.level} • Dedikasi pengajar bulan ini`,
                action: () => {
                  setActiveTab('RIWAYAT');
                  setHistorySubTab('ATTENDANCE');
                },
                badge: 'Riwayat',
                badgeColor: 'text-amber-800 bg-amber-50 border-amber-300',
              });

              // 6. Lokasi & Peta GPS
              const rawAllowed = getEffectiveAllowedRadius(settings.geofence_radius);
              const effectiveAllowedRadius = (typeof navigator !== 'undefined' && !navigator.onLine)
                ? Math.max(rawAllowed, 500)
                : rawAllowed;
              const coordsAccuracy = userCoords?.accuracy ? ` (±${Math.round(userCoords.accuracy)}m)` : '';
              items.push({
                id: 'location',
                icon: <span className="text-base">📍</span>,
                title: 'Peta & Geofence Sekolah',
                description: `Radius izin: ${effectiveAllowedRadius}m • GPS: ${gpsHealth.text.replace('📍 ', '')}${coordsAccuracy}`,
                action: () => setIsLocationModalOpen(true),
                badge: 'Lihat Peta',
                badgeColor: 'text-slate-700 bg-slate-100 border-slate-300',
              });

              const visibleItems = isInfoExpanded ? items : items.slice(0, 2);

              return (
                <section className="space-y-2">
                  <div className="flex items-center justify-between px-0.5">
                    <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                      Catatan &amp; Aktivitas
                    </h3>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {items.length} Info
                    </span>
                  </div>

                  <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm overflow-hidden">
                    {visibleItems.map((item, idx) => (
                      <div
                        key={item.id}
                        onClick={item.action}
                        className={`p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer ${
                          idx > 0 ? 'border-t border-slate-100' : ''
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-9 h-9 rounded-2xl bg-slate-50 border border-slate-200/60 flex items-center justify-center text-base shrink-0">
                            {item.icon}
                          </div>
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-slate-800 leading-tight truncate">
                              {item.title}
                            </h4>
                            <p className="text-[11px] text-slate-500 font-medium truncate mt-0.5">
                              {item.description}
                            </p>
                          </div>
                        </div>
                        {item.badge ? (
                          <span className={`px-2 py-0.5 text-[10px] font-bold rounded-lg border shrink-0 ${item.badgeColor}`}>
                            {item.badge}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-sm shrink-0">›</span>
                        )}
                      </div>
                    ))}

                    {items.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setIsInfoExpanded(!isInfoExpanded)}
                        className="w-full py-2.5 px-4 text-xs font-bold text-[#023246] hover:bg-slate-50 active:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center gap-1 border-t border-slate-100"
                      >
                        <span>{isInfoExpanded ? 'Tampilkan Lebih Sedikit ▴' : `Lihat Semua Catatan (${items.length}) ▾`}</span>
                      </button>
                    )}
                  </div>
                </section>
              );
            })()}
          </>
        )}

        {/* ── LAYER: SEMUA FITUR GURU (PINDAH LAYER, BUKAN CARD / POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'ALL_FEATURES' && (
          <section className="space-y-3.5">
            {/* Top Navigation Bar: Tombol Kembali ke Beranda */}
            <div className="bg-white rounded-3xl p-3.5 sm:p-4 border border-slate-200/90 shadow-sm flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setBerandaLayer('HOME');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-2xl bg-slate-50 hover:bg-slate-100 active:scale-95 border border-slate-200 text-xs font-bold text-[#023246] transition-all cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Beranda</span>
              </button>
              <span className="text-[11px] font-extrabold text-slate-400 uppercase tracking-wider">
                Layer Semua Fitur
              </span>
            </div>

            {/* Banner Header Layer */}
            <div className="bg-linear-to-r from-[#023246] to-[#18536B] rounded-3xl p-4 sm:p-5 text-white shadow-sm flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm sm:text-base font-black">Semua Menu &amp; Fitur Guru</h2>
                <p className="text-[11px] sm:text-xs text-cyan-100/90 mt-0.5 font-medium">
                  Akses modul operasional presensi, akademik KBM, dan layanan sekolah
                </p>
              </div>
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-white shrink-0">
                <LayoutGrid className="w-5 h-5" />
              </div>
            </div>

            {/* Grid Lengkap Seluruh Fitur Guru dengan Icon Blue Squircle */}
            <div className="bg-white rounded-3xl p-4 sm:p-5 border border-slate-200/90 shadow-sm space-y-6">
              {/* Kategori 1: Presensi & Absensi */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Presensi &amp; Absensi
                </h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  {/* Absen Sekarang */}
                  <button
                    type="button"
                    onClick={handleOpenAttendanceChoice}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <Fingerprint className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Presensi
                    </span>
                  </button>

                  {/* Sidik Jari HP */}
                  <button
                    type="button"
                    onClick={() => setIsBiometricModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <Fingerprint className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Sidik Jari
                    </span>
                  </button>

                  {/* Scan Barcode QR */}
                  <button
                    type="button"
                    onClick={handleOpenScannerClick}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <QrCode className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Scan QR
                    </span>
                  </button>

                  {/* Izin & Cuti */}
                  <button
                    type="button"
                    onClick={handleOpenLeaveModal}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <Clock className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Izin Cuti
                    </span>
                  </button>

                  {/* Koreksi Absen */}
                  <button
                    type="button"
                    onClick={() => handleOpenCorrectionModal()}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <FileEdit className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Koreksi
                    </span>
                  </button>

                  {/* Rekap Presensi */}
                  <button
                    type="button"
                    onClick={() => setIsRecapModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <BarChart3 className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Rekap
                    </span>
                  </button>

                  {/* Peta Lokasi GPS */}
                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <MapPin className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Lokasi GPS
                    </span>
                  </button>
                </div>
              </div>

              {/* Kategori 2: Akademik & KBM */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Akademik &amp; KBM
                </h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  {/* Jadwal KBM */}
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <Calendar className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Jadwal
                    </span>
                  </button>

                  {/* Ruang Kelas & Rombel */}
                  <button
                    type="button"
                    onClick={() => setIsClassroomModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <School className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Kelas
                    </span>
                  </button>

                  {/* Direktori Siswa & RFID */}
                  <button
                    type="button"
                    onClick={() => setIsStudentDirectoryModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0 relative">
                      <GraduationCap className="w-6 h-6 stroke-[1.8]" />
                      {isDutyTeacherToday && (
                        <span className="absolute -top-1 -right-1 px-1 py-0.2 text-[8px] font-black bg-cyan-500 text-white rounded-full min-w-3 text-center ring-2 ring-white">
                          RFID
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Siswa
                    </span>
                  </button>

                  {/* Bahan Ajar KBM */}
                  <button
                    type="button"
                    onClick={() => setIsTeachingMaterialsModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <BookOpen className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Materi
                    </span>
                  </button>

                  {/* Kalender Acara */}
                  <button
                    type="button"
                    onClick={() => setIsEventsCalendarModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <CalendarRange className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Acara
                    </span>
                  </button>

                  {/* Terminal RFID Siswa (Jika Piket Aktif) */}
                  {isDutyTeacherToday && (
                    <button
                      type="button"
                      onClick={() => setIsStudentKioskOpen(true)}
                      className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                    >
                      <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                        <Radio className="w-6 h-6 stroke-[1.8] text-cyan-300" />
                      </div>
                      <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                        Kiosk RFID
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Kategori 3: Layanan & Pengaturan */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
                  Layanan &amp; Pengaturan
                </h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  {/* Pengumuman */}
                  <button
                    type="button"
                    onClick={() => setIsAnnouncementModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0 relative">
                      <Megaphone className="w-6 h-6 stroke-[1.8]" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.2 text-[8px] font-black bg-red-600 text-white rounded-full min-w-3.5 text-center ring-2 ring-white">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Pengumuman
                    </span>
                  </button>

                  {/* Kotak Aspirasi Guru */}
                  <button
                    type="button"
                    onClick={() => setIsComplaintModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <MessageSquare className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Aspirasi
                    </span>
                  </button>

                  {/* Mood Harian */}
                  <button
                    type="button"
                    onClick={() => setIsMoodModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <Smile className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Mood
                    </span>
                  </button>

                  {/* Ubah PIN */}
                  <button
                    type="button"
                    onClick={() => setIsChangePinOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <Lock className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Ubah PIN
                    </span>
                  </button>

                  {/* Aturan & SK */}
                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <FileText className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Aturan
                    </span>
                  </button>

                  {/* Ekspor Laporan */}
                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer active:scale-95 transition-all p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-xs group-hover:brightness-110 transition-all shrink-0">
                      <FileSpreadsheet className="w-6 h-6 stroke-[1.8]" />
                    </div>
                    <span className="text-[11px] font-bold text-slate-700 group-hover:text-[#023246] transition-colors mt-1.5 leading-tight tracking-tight text-center truncate w-full">
                      Ekspor
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Tombol Kembali di Bawah */}
            <button
              type="button"
              onClick={() => {
                setBerandaLayer('HOME');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 active:scale-98 border border-slate-200/90 shadow-xs text-xs font-bold text-[#023246] flex items-center justify-center gap-2 transition-all cursor-pointer min-h-12"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Beranda Utama</span>
            </button>
          </section>
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
                  <span>📅 Presensi</span>
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
                  <span>📝 Izin / Cuti</span>
                  <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 font-bold rounded-full text-[9px] sm:text-[10px]">
                    {userLeaves.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHistorySubTab('COMPLAINTS')}
                  className={`flex-1 py-1.5 sm:py-2 text-[11px] sm:text-xs font-extrabold rounded-lg sm:rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 sm:gap-1.5 ${
                    historySubTab === 'COMPLAINTS'
                      ? 'bg-white text-[#023246] shadow-xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <span>💬 Aspirasi</span>
                  <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 font-bold rounded-full text-[9px] sm:text-[10px]">
                    {userComplaints.length}
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

              {/* SUB-TAB 3: ASPIRASI & KELUHAN ANONIM (MOBILE NATIVE EXPERIENCE) */}
              {historySubTab === 'COMPLAINTS' && (
                <div className="space-y-3.5 sm:space-y-4">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                    <div>
                      <h2 className="font-black text-[#023246] text-sm sm:text-base flex items-center gap-2">
                        <span>💬</span>
                        <span>Aspirasi &amp; Keluhan Saya</span>
                      </h2>
                      <p className="text-[11px] sm:text-xs text-slate-500 font-medium mt-0.5">
                        Daftar catatan rahasia yang Anda kirimkan ke pihak manajemen sekolah
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsComplaintModalOpen(true)}
                      className="min-h-11 sm:min-h-9 px-4 py-2 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-black rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-1.5 active:scale-95 self-start sm:self-auto w-full sm:w-auto"
                    >
                      <span>+</span>
                      <span>Tulis Catatan Baru</span>
                    </button>
                  </div>

                  {/* 100% Guaranteed Privacy Assurance Pill */}
                  <div className="bg-linear-to-r from-emerald-50 via-teal-50/60 to-emerald-50/80 border border-emerald-200/90 p-3.5 rounded-2xl flex items-start gap-3 shadow-2xs">
                    <div className="w-8 h-8 rounded-xl bg-[#0D7A5F] text-white flex items-center justify-center text-sm shrink-0 shadow-xs ring-2 ring-emerald-300/60">
                      🔒
                    </div>
                    <div className="text-xs leading-relaxed min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-black text-[#023246] text-xs">
                          Identitas Anda 100% Terjaga
                        </span>
                        <span className="px-2 py-0.2 bg-emerald-100 text-emerald-900 border border-emerald-300 text-[9px] font-black rounded-full">
                          Aman &amp; Terlindungi
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium text-[11px] mt-0.5">
                        Admin &amp; Kepala Sekolah membaca seluruh isi laporan Anda sebagai <em>"Pendidik Anonim"</em> tanpa pernah mengetahui identitas pengirim.
                      </p>
                    </div>
                  </div>

                  {/* Complaints List or Empty State */}
                  <div className="space-y-3.5">
                    {isLoadingComplaints ? (
                      <SkeletonList count={3} />
                    ) : userComplaints.length === 0 ? (
                      <EmptyState
                        icon="💬"
                        title="Belum Ada Catatan atau Aspirasi"
                        description="Anda belum pernah mengirimkan catatan atau keluhan anonim. Tekan tombol '+ Tulis Catatan Baru' jika ada kendala fasilitas, sistem, jadwal, atau ide masukan untuk kemajuan sekolah."
                        actionLabel="+ Tulis Aspirasi Pertama"
                        onAction={() => setIsComplaintModalOpen(true)}
                      />
                    ) : (
                      userComplaints.map((item) => {
                        const catMeta = ComplaintRepository.CATEGORY_META[item.category] || {
                          label: item.category,
                          emoji: '💡',
                          colorClass: 'text-slate-800',
                          bgClass: 'bg-slate-100',
                          borderClass: 'border-slate-200',
                        };
                        const statusMeta = ComplaintRepository.STATUS_META[item.status] || {
                          label: item.status,
                          colorClass: 'text-slate-700',
                          bgClass: 'bg-slate-100',
                          borderClass: 'border-slate-200',
                          badgeStatus: 'DEFAULT' as const,
                        };

                        return (
                          <div
                            key={item.id}
                            className="p-4 sm:p-4.5 rounded-2xl sm:rounded-3xl bg-white hover:bg-slate-50/60 border border-slate-200/90 text-xs space-y-3 transition-all shadow-card"
                          >
                            {/* Card Top Meta */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`px-2.5 py-1 rounded-xl text-[11px] font-black border flex items-center gap-1.5 shadow-2xs ${catMeta.bgClass} ${catMeta.colorClass} ${catMeta.borderClass}`}>
                                  <span>{catMeta.emoji}</span>
                                  <span>{catMeta.label}</span>
                                </span>
                                <span className="text-[11px] font-mono text-slate-400 font-medium">
                                  {new Date(item.created_at).toLocaleDateString('id-ID', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}{' '}
                                  WIB
                                </span>
                              </div>

                              <span className={`px-2.5 py-1 text-[11px] font-black rounded-xl border shrink-0 shadow-2xs flex items-center gap-1.5 ${statusMeta.bgClass} ${statusMeta.colorClass} ${statusMeta.borderClass}`}>
                                {item.status === 'SUBMITTED' && (
                                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                )}
                                {item.status === 'IN_REVIEW' && (
                                  <span className="w-2 h-2 rounded-full bg-sky-500 animate-pulse shrink-0" />
                                )}
                                <span>{statusMeta.label}</span>
                              </span>
                            </div>

                            {/* Complaint Body Message */}
                            <div className="bg-slate-50 p-3.5 rounded-2xl border border-slate-200/80 text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                              "{item.content}"
                            </div>

                            {/* Official School Management Response */}
                            {item.admin_response ? (
                              <div className="bg-emerald-50/90 border border-emerald-300/90 border-l-4 border-l-[#0D7A5F] p-3.5 rounded-2xl space-y-1.5 shadow-2xs">
                                <div className="flex items-center justify-between text-xs font-black text-emerald-950">
                                  <span className="flex items-center gap-1.5">
                                    <span>💬</span>
                                    <span>
                                      Tanggapan Resmi ({item.responded_by_role === 'KEPSEK' ? '👑 Kepala Sekolah' : '🛡️ Tim Manajemen Sekolah'}):
                                    </span>
                                  </span>
                                  {item.responded_at && (
                                    <span className="font-mono text-[10px] text-emerald-800 font-bold">
                                      {new Date(item.responded_at).toLocaleDateString('id-ID', {
                                        day: 'numeric',
                                        month: 'short',
                                        hour: '2-digit',
                                        minute: '2-digit',
                                      })}{' '}
                                      WIB
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs sm:text-sm text-slate-900 font-semibold leading-relaxed">
                                  {item.admin_response}
                                </p>
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-800 bg-amber-50/80 px-3 py-2 rounded-xl border border-amber-200/70 flex items-center gap-2 font-medium">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse shrink-0" />
                                <span>Catatan telah diterima server &amp; menunggu peninjauan pihak sekolah.</span>
                              </div>
                            )}
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

              {/* Biometric Fingerprint HP Section */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                    <span>👆</span> Sidik Jari HP Guru (Biometric)
                  </span>
                  <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-black rounded-full border shrink-0 ${
                    isBioEnrolled ? 'bg-emerald-100 text-emerald-800 border-emerald-300' : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}>
                    {isBioEnrolled ? '✅ TERDAFTAR DI HP INI' : '⚪ BELUM TERDAFTAR'}
                  </span>
                </div>

                <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium leading-relaxed bg-white p-2 rounded-lg sm:rounded-xl border border-slate-200">
                  {isBioEnrolled
                    ? 'Sensor sidik jari HP Anda aktif dan siap digunakan untuk presensi masuk & pulang saat berada di area sekolah.'
                    : 'Daftarkan sidik jari HP ini agar Anda bisa langsung absen dengan menyentuh sensor fingerprint HP tanpa perlu scan QR.'}
                </p>

                <div className="flex justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={() => setIsBiometricModalOpen(true)}
                    className="px-3 py-1.5 bg-[#023246] hover:bg-[#0D7A5F] text-white font-extrabold text-[10px] sm:text-[11px] rounded-lg transition-all cursor-pointer flex items-center gap-1 shadow-2xs"
                  >
                    <span>👆</span>
                    <span>{isBioEnrolled ? 'Uji Coba Sidik Jari' : 'Daftarkan Sidik Jari Sekarang'}</span>
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
            onClick={() => {
              setActiveTab('BERANDA');
              setBerandaLayer('HOME');
            }}
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
              onClick={handleOpenAttendanceChoice}
              className="w-12 h-12 rounded-2xl bg-[#023246] hover:bg-[#0D7A5F] text-white flex items-center justify-center shadow-md ring-4 ring-white active:scale-95 transition-all cursor-pointer min-h-12 min-w-12"
              title="Presensi (Pilih Sidik Jari atau Scan Barcode)"
            >
              <QrCodeScanIcon className="w-6 h-6 text-white" />
            </button>
            <span className="text-[9px] font-extrabold text-[#023246] mt-0.5">Absen</span>
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

      {/* Anonymous Teacher Complaint & Feedback Modal */}
      <AnonymousComplaintModal
        isOpen={isComplaintModalOpen}
        onClose={() => setIsComplaintModalOpen(false)}
        onSuccess={() => {
          loadUserComplaints();
        }}
      />

      {/* ── 🌟 DEDICATED MODAL LAYERS FOR 12-ICON GRID ─────────────────────── */}
      {/* 4. Rekap Presensi Bulanan */}
      <AttendanceRecapModal
        isOpen={isRecapModalOpen}
        onClose={() => setIsRecapModalOpen(false)}
        attendanceRecords={attendanceHistory}
        user={effectiveUser}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenCorrectionModal={(targetDate) => handleOpenCorrectionModal(targetDate)}
      />

      {/* 6. Pengumuman & Warta Sekolah */}
      <TeacherAnnouncementModal
        isOpen={isAnnouncementModalOpen}
        onClose={() => setIsAnnouncementModalOpen(false)}
        notifications={notifications}
        onMarkAsRead={(id) => handleMarkSingleNotificationRead(id)}
        onMarkAllAsRead={() => handleMarkAllNotificationsRead()}
      />

      {/* 7. Kelas & Rombel Belajar */}
      <ClassroomManagementModal
        isOpen={isClassroomModalOpen}
        onClose={() => setIsClassroomModalOpen(false)}
        user={effectiveUser}
        onOpenSchedule={() => setIsScheduleModalOpen(true)}
        onOpenStudentDirectory={(cls) => {
          setStudentDirectoryClassFilter(cls);
          setIsStudentDirectoryModalOpen(true);
        }}
      />

      {/* 8. Lokasi & Peta Geofence GPS */}
      <TeacherLocationModal
        isOpen={isLocationModalOpen}
        onClose={() => setIsLocationModalOpen(false)}
        onOpenScanner={handleOpenAttendanceChoice}
        settings={settings}
      />

      {/* 9. Direktori Siswa & Kontak Wali */}
      <StudentDirectoryModal
        isOpen={isStudentDirectoryModalOpen}
        onClose={() => setIsStudentDirectoryModalOpen(false)}
        initialClassFilter={studentDirectoryClassFilter}
        onOpenKiosk={() => setIsStudentKioskOpen(true)}
      />

      {/* 10. Modul & Bahan Ajar KBM */}
      <TeachingMaterialsModal
        isOpen={isTeachingMaterialsModalOpen}
        onClose={() => setIsTeachingMaterialsModalOpen(false)}
        user={effectiveUser}
      />

      {/* 11. Kalender Acara & Agenda Sekolah */}
      <SchoolEventsCalendarModal
        isOpen={isEventsCalendarModalOpen}
        onClose={() => setIsEventsCalendarModalOpen(false)}
        initialHolidays={allHolidays}
      />

      {/* 12. Menu Fitur Tambahan & Pengaturan */}
      <MoreFeaturesModal
        isOpen={isMoreFeaturesModalOpen}
        onClose={() => setIsMoreFeaturesModalOpen(false)}
        user={effectiveUser}
        onOpenComplaintModal={() => setIsComplaintModalOpen(true)}
        onOpenMoodModal={() => setIsMoodModalOpen(true)}
        onOpenVoiceSettings={() => setActiveTab('PROFIL')}
        onOpenTermsModal={() => setIsTermsModalOpen(true)}
        onOpenChangePin={() => setIsChangePinOpen(true)}
        onLogout={logout}
        onOpenStudentKiosk={() => setIsStudentKioskOpen(true)}
        onOpenCorrectionModal={() => handleOpenCorrectionModal()}
        onOpenClassroomModal={() => setIsClassroomModalOpen(true)}
        onOpenLocationModal={() => setIsLocationModalOpen(true)}
        onOpenStudentDirectoryModal={() => setIsStudentDirectoryModalOpen(true)}
        onOpenTeachingMaterialsModal={() => setIsTeachingMaterialsModalOpen(true)}
        onOpenEventsCalendarModal={() => setIsEventsCalendarModalOpen(true)}
      />

      {/* 13. Terminal Presensi RFID Siswa 2 (Akses Cepat Guru Piket & Pengajar) */}
      <StudentRfidKioskModal
        isOpen={isStudentKioskOpen}
        onClose={() => setIsStudentKioskOpen(false)}
      />

      {/* Modal Pilihan Metode Presensi (Scan Barcode / QR vs Sidik Jari HP) */}
      <AttendanceMethodChoiceModal
        isOpen={isAttendanceChoiceModalOpen}
        onClose={() => setIsAttendanceChoiceModalOpen(false)}
        onSelectBiometric={() => setIsBiometricModalOpen(true)}
        onSelectQrScan={handleOpenScannerClick}
      />

      {/* 13. Modal Presensi Sidik Jari HP Terintegrasi GPS Geofence */}
      <BiometricAttendanceModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        settings={settings}
        user={effectiveUser}
        onSuccess={() => {
          setIsBioEnrolled(true);
          loadAllDataRef.current?.();
          showToast('success', 'Presensi Sidik Jari Berhasil', 'Data kehadiran Anda telah tercatat.');
        }}
      />
    </div>
  );
};
