import { BimtekManagementView } from '../../bimtek/components/BimtekManagementView';
import { CounselingManagementView } from '../../counseling/components/CounselingManagementView';
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  usePageModalBackStack,
  useBackHandler,
  useTabBackNavigation,
  BACK_PRIORITIES,
} from '../../../hooks/useBackNavigation';
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
import { TeacherEducationView } from '../../guru/components/TeacherEducationView';
import { AboutAppView } from '../../guru/components/AboutAppView';
import { TeachingScheduleModal } from '../../guru/components/TeachingScheduleModal';
import { MoodCheckinModal } from '../../guru/components/MoodCheckinModal';
import { AnonymousComplaintModal } from '../../guru/components/AnonymousComplaintModal';
import { AttendanceRecapModal } from '../../guru/components/AttendanceRecapModal';
import { TeacherAnnouncementModal } from '../../guru/components/TeacherAnnouncementModal';
import { ClassroomManagementModal } from '../../guru/components/ClassroomManagementModal';
import { TeacherLocationModal } from '../../guru/components/TeacherLocationModal';
import { StudentDirectoryModal } from '../../guru/components/StudentDirectoryModal';
import { TeachingMaterialsModal } from '../../guru/components/TeachingMaterialsModal';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { SchoolEventsCalendarModal } from '../../guru/components/SchoolEventsCalendarModal';
import { MoreFeaturesModal } from '../../guru/components/MoreFeaturesModal';
import { StudentExamCardModal } from '../../guru/components/StudentExamCardModal';
import { QuestionCorrectionModal } from '../../guru/components/QuestionCorrectionModal';
import { HomeroomModal } from '../../homeroom/components/HomeroomModal';
import { StudentRfidKioskModal } from '../../attendance/components/StudentRfidKioskModal';
import { AttendancePermissionBlockedModal } from '../../guru/components/AttendancePermissionBlockedModal';
import { WebTrafficService } from '../../../services/web-traffic.service';
import { OfflineSyncIndicator } from '../../../components/ui/OfflineSyncIndicator';
import { BiometricEnrollmentPromptModal } from '../../guru/components/BiometricEnrollmentPromptModal';
import { StudentBehaviorView } from '../../guru/components/StudentBehaviorView';
import { ClassroomEmergencyModal } from '../../guru/components/ClassroomEmergencyModal';
import { AdministrationHubModal } from '../../administration/components/AdministrationHubModal';
import { ExamScheduleAndProctorModal } from '../../administration/components/ExamScheduleAndProctorModal';
import { MeetingMinutesView } from '../../meeting-minutes/components/MeetingMinutesView';

const OralExamAssessmentModal = React.lazy(() =>
  import('../../administration/components/OralExamAssessmentModal').then((m) => ({
    default: m.OralExamAssessmentModal,
  }))
);
import { CustomizeQuickIconsModal, sanitizeQuickIconIds } from '../../guru/components/CustomizeQuickIconsModal';
import { SarprasInventoryModal } from '../../sarpras/components/SarprasInventoryModal';
import { SurveyAnalyticsView } from '../../survey/components/SurveyAnalyticsView';
import { DailySurveyReminderBanner } from '../../../components/survey/DailySurveyReminderBanner';
import {
  syncSurveyCompletionFromPointLogs,
  shouldShowDailySurveyBanner,
} from '../../../services/research-survey.service';
import { isUserSarprasOfficer } from '../../sarpras/utils/sarpras-access.utils';
import { PermissionGuardService } from '../../../services/permission-guard.service';
import { ArrowLeft, ArrowRight, ChevronRight } from 'lucide-react';
import {
  SagaAdminHubIcon,
  SagaAppDownloadIcon,
  SagaAspirationIcon,
  SagaAttachmentClipIcon,
  SagaBellIcon,
  SagaBimtekIcon,
  SagaBookMaterialIcon,
  SagaCalendarAgendaIcon,
  SagaChallengeTrophyIcon,
  SagaCheckBadgeIcon,
  SagaClassroomIcon,
  SagaClockStatusIcon,
  SagaCounselingIcon,
  SagaCreateExamIcon,
  SagaDeviceShieldIcon,
  SagaEditPencilIcon,
  SagaEmergencySosIcon,
  SagaEmptyListIllustration,
  SagaExamCardIcon,
  SagaFingerprintIcon,
  SagaGamePidIcon,
  SagaGradingIcon,
  SagaHistoryIcon,
  SagaHolidayIcon,
  SagaHomeroomIcon,
  SagaInfoCircleIcon,
  SagaKeyPinIcon,
  SagaLeavePermitIcon,
  SagaLogoutDoorIcon,
  SagaMapPinIcon,
  SagaMedalRankIcon,
  SagaMoodFaceIcon,
  SagaMoreAppsIcon,
  SagaNotulenIcon,
  SagaOralExamIcon,
  SagaPrinterIcon,
  SagaRfidKioskIcon,
  SagaRoleSwitchIcon,
  SagaScanQrIcon,
  SagaScheduleIcon,
  SagaStudentsIcon,
  type SagaAttendanceStatusVariant,
} from '../../../components/ui/SagaServiceIcons';
import { GuruDashboardHeader } from '../components/GuruDashboardHeader';
import { GuruAttendanceHeroCard } from '../components/GuruAttendanceHeroCard';
import { GuruQuickMenuGrid } from '../components/GuruQuickMenuGrid';
import { GuruTodayScheduleCard } from '../components/GuruTodayScheduleCard';
import { GuruAdminHubTabView } from '../components/GuruAdminHubTabView';
import {
  GuruBottomNavBar,
  GuruDesktopNavBar,
  type GuruMainTab,
} from '../components/GuruBottomNavBar';
import { pwaService } from '../../../services/pwa.service';
import {
  OralExamAssignmentRepository,
  ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT,
} from '../../../repositories/OralExamAssignmentRepository';
import { findAssignmentsForTeacher } from '../../../data/oral-exam-groups';
import { ORAL_EXAM_SCHEDULE_LABEL, type OralExamAssignment } from '../../../types/oral-exam.types';
import { getOralExamPeriodStatus } from '../../../utils/oral-exam-scoring.utils';
import { BiometricAttendanceModal } from '../../guru/components/BiometricAttendanceModal';
import { AttendanceMethodChoiceModal } from '../../guru/components/AttendanceMethodChoiceModal';
import { BiometricService } from '../../../services/biometric.service';
import { ExportReportModal } from '../../../components/dashboard/ExportReportModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { ComplaintRepository } from '../../../repositories/ComplaintRepository';
import { GPSService } from '../../../services/gps.service';
import { CONSTANTS } from '../../../config/constants';
import { handleAppError } from '../../../utils/error.utils';
import {
  isDateOffDay,
  getTodayDateInJakarta,
  getTomorrowDateInJakarta,
  getCurrentTimeInJakarta,
  getJakartaDayOfWeek,
  formatTimeForInput,
  getMonthWorkingDays,
  getPaydayReminderInfo,
  evaluateDisciplinePeriodTiming,
  isAutoCheckInRecord,
  isAutoCheckOutRecord,
} from '../../../utils/time.utils';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { VoiceSettingsCard } from '../../../components/dashboard/VoiceSettingsCard';
import { NotificationPermissionBanner } from '../../../components/dashboard/NotificationPermissionBanner';
import { NotificationPreferencesModal } from '../../../components/dashboard/NotificationPreferencesModal';
import { PWAInstallPrompt } from '../../../components/ui/PWAInstallPrompt';
import { NotificationService } from '../../../services/notification-permission.service';
import { SyncEngine } from '../../../services/sync-engine.service';
import { DutyScheduleRepository } from '../../../repositories/DutyScheduleRepository';
import {
  TeachingScheduleRepository,
  TEACHING_SCHEDULES_UPDATED_EVENT,
} from '../../../repositories/TeachingScheduleRepository';
import {
  EmergencyRepository,
  EMERGENCY_UPDATED_EVENT,
} from '../../../repositories/EmergencyRepository';
import { useCrossDeviceSync } from '../../../hooks/useCrossDeviceSync';
import {
  calculateTeacherAppreciationScore,
  getTeacherDisciplineLeaderboard,
  type DisciplinePeriodType,
} from '../../../utils/teacher-appreciation.utils';
import { getSafeInitialTeacherPointLogs } from '../../../utils/teacher-point-seed.utils';
import { TeacherDisciplineBadgeModal } from '../../guru/components/TeacherDisciplineBadgeModal';
import { TeacherPointHistoryModal } from '../../guru/components/TeacherPointHistoryModal';
import { TopDisciplineCelebrationModal } from '../../guru/components/TopDisciplineCelebrationModal';
import { TeacherDailyChallengeWidget } from '../../guru/components/TeacherDailyChallengeWidget';
import { TeacherChallengeModal } from '../../guru/components/TeacherChallengeModal';
import { GamePidView } from '../../guru/components/GamePidView';
import { GamePidPromoModal } from '../../guru/components/GamePidPromoModal';
import { TeacherChallengeService } from '../../../services/teacher-challenge.service';
import { CheckoutReminderBanner } from '../components/CheckoutReminderBanner';
import { AttendancePolicyAgreementModal } from '../../guru/components/AttendancePolicyAgreementModal';

const TeacherDailyBoardModal = React.lazy(() =>
  import('../../guru/components/TeacherDailyBoardModal').then((m) => ({
    default: m.TeacherDailyBoardModal,
  }))
);

const ExamQuestionCreatorModal = React.lazy(() =>
  import('../../guru/components/ExamQuestionCreatorModal').then((m) => ({
    default: m.ExamQuestionCreatorModal,
  }))
);
import { evaluateSmartClassAlarm } from '../../../utils/smart-class-alarm.utils';
import { normalizeDayOfWeek, sanitizeTimeString, getDayNameIndonesian } from '../../../utils/teaching-schedule.utils';
import {
  ExamCommitteeRepository,
  EXAM_COMMITTEE_CHANGED_EVENT,
} from '../../../repositories/ExamCommitteeRepository';
import {
  ExamPeriodRepository,
  EXAM_PERIOD_CHANGED_EVENT,
} from '../../../repositories/ExamPeriodRepository';
import { ExamPeriodSettingsModal } from '../../administration/components/ExamPeriodSettingsModal';
import {
  ExamScheduleRepository,
  EXAM_SCHEDULE_PUBLISHED_EVENT,
  EXAM_SCHEDULE_UPDATED_EVENT,
} from '../../../repositories/ExamScheduleRepository';
import { ExamWordExporterService } from '../../../services/exam-word-exporter.service';
import {
  AdministrationRepository,
  ADMIN_YEAR_CHANGED_EVENT,
} from '../../../repositories/AdministrationRepository';
import type {
  CommitteeRole,
  ExamScheduleData,
  ExamProctorItem,
  ExamPeriodStatus,
} from '../../../types/exam-schedule.types';
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
  ClassroomEmergencyAlert,
  TeacherPointLog,
} from '../../../types/database.types';

export interface GuruDashboardPageProps {
  onOpenScanner?: () => void;
  onOpenLeaveForm?: () => void;
  onOpenCorrectionForm?: () => void;
  previewUser?: UserProfile;
  isPreviewMode?: boolean;
  isDualRoleUser?: boolean;
  currentRoleMode?: 'GURU' | 'ADMIN' | 'OPERATOR' | 'KEPSEK';
  onSwitchRoleMode?: () => void;
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
  timeStr: string | null | undefined,
  now: Date
): 'CURRENT' | 'NEXT' | 'FINISHED' | 'UPCOMING' => {
  try {
    if (!timeStr || typeof timeStr !== 'string') return 'UPCOMING';
    const parts = timeStr.replace(' WIB', '').split('-').map((p) => p.trim());
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

const FALLBACK_GURU_USER: UserProfile = {
  id: 'usr_guru_sample',
  nip: null,
  full_name: 'Guru Utama',
  phone_number: '081234567890',
  role: 'GURU',
  position: 'Guru Utama / Pendidik',
  avatar_url: null,
  is_active: true,
  created_at: '2025-01-01T00:00:00.000Z',
};

export const GuruDashboardPage: React.FC<GuruDashboardPageProps> = ({
  onOpenScanner,
  onOpenLeaveForm,
  onOpenCorrectionForm,
  previewUser,
  isPreviewMode = false,
  isDualRoleUser = false,
  currentRoleMode: _currentRoleMode = 'GURU',
  onSwitchRoleMode,
}) => {
  const { user: authUser, token, logout, deviceUUID } = useAuthStore();
  const { showToast } = useToastStore();

  // Effective user: merge previewUser with authUser (prioritize authUser.avatar_url if present)
  const effectiveUser: UserProfile = useMemo(() => {
    if (previewUser) {
      return {
        ...previewUser,
        avatar_url: authUser?.avatar_url || previewUser.avatar_url || null,
      };
    }
    return authUser || FALLBACK_GURU_USER;
  }, [previewUser, authUser]);

  const [activeTab, setActiveTab] = useState<GuruMainTab>('BERANDA');
  const [notifReturnTab, setNotifReturnTab] = useState<Exclude<GuruMainTab, 'NOTIFIKASI'>>('BERANDA');
  const [berandaLayer, setBerandaLayer] = useState<'HOME' | 'ALL_FEATURES' | 'CHALLENGE' | 'ABOUT' | 'EDUCATION' | 'STUDENT_BEHAVIOR' | 'NOTULEN' | 'SURVEY_ANALYTICS' | 'GAME_PID' | 'BIMTEK' | 'COUNSELING_BK' | 'ORAL_EXAM'>('HOME');
  const [bimtekReturnTarget, setBimtekReturnTarget] = useState<'HOME' | 'ALL_FEATURES'>('HOME');
  const [counselingReturnTarget, setCounselingReturnTarget] = useState<'HOME' | 'ALL_FEATURES'>('HOME');
  const [oralExamReturnTarget, setOralExamReturnTarget] = useState<'HOME' | 'ALL_FEATURES'>('HOME');
  const berandaLayerRef = React.useRef(berandaLayer);
  berandaLayerRef.current = berandaLayer;
  const [gamePidReturnTarget, setGamePidReturnTarget] = useState<'HOME' | 'ALL_FEATURES'>('HOME');
  const [surveyAnalyticsReturnTarget, setSurveyAnalyticsReturnTarget] = useState<'HOME' | 'ALL_FEATURES' | 'ADMIN' | 'AKUN'>('HOME');
  const [notulenReturnTarget, setNotulenReturnTarget] = useState<'HOME' | 'ALL_FEATURES'>('HOME');
  const [studentBehaviorReturnTarget, setStudentBehaviorReturnTarget] = useState<'HOME' | 'ALL_FEATURES'>('HOME');
  const [aboutReturnTarget, setAboutReturnTarget] = useState<'HOME' | 'ALL_FEATURES' | 'AKUN'>('HOME');
  const [educationReturnTarget, setEducationReturnTarget] = useState<'HOME' | 'ALL_FEATURES' | 'AKUN'>('AKUN');
  const [profilSubView, setProfilSubView] = useState<'MAIN' | 'EDUCATION'>('MAIN');
  const [educationViewTab, setEducationViewTab] = useState<'QR' | 'BIOMETRIC' | 'POINTS' | 'SECURITY'>('QR');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [correctionInitialDate, setCorrectionInitialDate] = useState<string | undefined>(undefined);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isTermsModalOpen, setIsTermsModalOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isAttendanceChoiceModalOpen, setIsAttendanceChoiceModalOpen] = useState(false);
  const [isQuestionCorrectionModalOpen, setIsQuestionCorrectionModalOpen] = useState(false);

  const handleOpenAboutLayer = useCallback((returnTo: 'HOME' | 'ALL_FEATURES' | 'AKUN' = 'HOME') => {
    setAboutReturnTarget(returnTo);
    setActiveTab('BERANDA');
    setBerandaLayer('ABOUT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  const handleBackFromAboutLayer = useCallback(() => {
    if (aboutReturnTarget === 'AKUN') {
      setActiveTab('AKUN');
    } else if (aboutReturnTarget === 'ALL_FEATURES') {
      setActiveTab('BERANDA');
      setBerandaLayer('ALL_FEATURES');
    } else {
      setActiveTab('BERANDA');
      setBerandaLayer('HOME');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [aboutReturnTarget]);

  const handleOpenEducationLayer = useCallback(
    (
      tab: 'QR' | 'BIOMETRIC' | 'POINTS' | 'SECURITY' = 'QR',
      returnTo: 'HOME' | 'ALL_FEATURES' | 'AKUN' = 'AKUN'
    ) => {
      setEducationViewTab(tab);
      setEducationReturnTarget(returnTo);
      if (returnTo === 'AKUN') {
        setActiveTab('AKUN');
        setProfilSubView('EDUCATION');
      } else {
        setActiveTab('BERANDA');
        setBerandaLayer('EDUCATION');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    []
  );

  const handleBackFromEducation = useCallback(() => {
    if (educationReturnTarget === 'AKUN') {
      setActiveTab('AKUN');
      setProfilSubView('MAIN');
    } else if (educationReturnTarget === 'ALL_FEATURES') {
      setActiveTab('BERANDA');
      setBerandaLayer('ALL_FEATURES');
    } else {
      setActiveTab('BERANDA');
      setBerandaLayer('HOME');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [educationReturnTarget]);

  const handleCloseQuestionCorrectionModal = useCallback(() => {
    setIsQuestionCorrectionModalOpen(false);
  }, []);

  // Change PIN Form State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // System Settings & Work Schedule State (Dynamically synchronized)
  const settings = useSettingsStore((s) => s.settings);

  // Date selection state for monthly history
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(currentDate.getFullYear());

  // Today Attendance Status, History, & Holiday Info
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [todayHoliday, setTodayHoliday] = useState<HolidayRecord | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<HolidayRecord | null>(null);
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
    isSchedule?: boolean;
    scheduleTitle?: string;
    scheduleDesc?: string;
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
  const [isTeacherBoardOpen, setIsTeacherBoardOpen] = useState(false);
  const [isExamCreatorModalOpen, setIsExamCreatorModalOpen] = useState(false);
  const [isHomeroomModalOpen, setIsHomeroomModalOpen] = useState(false);
  const [isExamCardModalOpen, setIsExamCardModalOpen] = useState(false);
  const [isStudentKioskOpen, setIsStudentKioskOpen] = useState(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [isBioEnrolled, setIsBioEnrolled] = useState(false);
  const [isBiometricPromptOpen, setIsBiometricPromptOpen] = useState(false);
  const [isPermissionBlockedModalOpen, setIsPermissionBlockedModalOpen] = useState(false);
  const [permissionBlockedRequiresCamera, setPermissionBlockedRequiresCamera] = useState(false);
  const [isDisciplineBadgeModalOpen, setIsDisciplineBadgeModalOpen] = useState(false);
  const [isCelebrationModalOpen, setIsCelebrationModalOpen] = useState(false);
  const [isGamePidPromoOpen, setIsGamePidPromoOpen] = useState(false);
  const [pointHistory, setPointHistory] = useState<TeacherPointLog[]>([]);
  const [allTeacherPointLogs, setAllTeacherPointLogs] = useState<TeacherPointLog[]>(() => {
    return getSafeInitialTeacherPointLogs();
  });
  const [allRegisteredTeachers, setAllRegisteredTeachers] = useState<UserProfile[]>(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem('smart_absensi_teachers') : null;
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [isPointHistoryModalOpen, setIsPointHistoryModalOpen] = useState(false);
  const [isAdministrationModalOpen, setIsAdministrationModalOpen] = useState(false);
  const [guruOralAssignments, setGuruOralAssignments] = useState<OralExamAssignment[]>([]);

  useEffect(() => {
    let mounted = true;
    const syncOralAssignments = async () => {
      try {
        const list = await OralExamAssignmentRepository.getAssignments(undefined, token || undefined);
        if (mounted) {
          setGuruOralAssignments(findAssignmentsForTeacher(list, effectiveUser));
        }
      } catch {
        // fallback handled by repository
      }
    };
    syncOralAssignments();
    window.addEventListener(ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT, syncOralAssignments);
    return () => {
      mounted = false;
      window.removeEventListener(ORAL_EXAM_ASSIGNMENTS_CHANGED_EVENT, syncOralAssignments);
    };
  }, [effectiveUser?.id, effectiveUser?.full_name, token]);
  const [isExamScheduleModalOpen, setIsExamScheduleModalOpen] = useState(false);
  const [isExamScheduleReadOnly, setIsExamScheduleReadOnly] = useState(false);
  const [examScheduleInitialTab, setExamScheduleInitialTab] = useState<'proctors' | 'subjects' | 'my_schedule' | 'ai_prompt' | 'form'>('proctors');
  const [studentBehaviorInitialTab, setStudentBehaviorInitialTab] = useState<'KEBAIKAN' | 'KEDISIPLINAN'>('KEBAIKAN');
  const [isEmergencyModalOpen, setIsEmergencyModalOpen] = useState(false);
  const [activeEmergencies, setActiveEmergencies] = useState<ClassroomEmergencyAlert[]>([]);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [isPolicyModalOpen, setIsPolicyModalOpen] = useState(false);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);
  const pendingAttendanceActionRef = useRef<(() => void) | null>(null);

  // Exam Committee State (Hak Panitia Ujian & Role Title)
  const [committeeInfo, setCommitteeInfo] = useState<{
    isCommittee: boolean;
    role: CommitteeRole | 'CUSTOM';
    roleLabel: string;
    academicYear: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    const loadCommittee = async () => {
      if (!effectiveUser?.id) {
        if (isMounted) setCommitteeInfo(null);
        return;
      }
      try {
        const activeYear = AdministrationRepository.getActiveAcademicYear();
        const roleData = await ExamCommitteeRepository.getTeacherCommitteeRole(effectiveUser, activeYear);
        if (isMounted) {
          setCommitteeInfo(roleData);
        }
      } catch (err) {
        console.warn('Failed to load committee role in GuruDashboardPage:', err);
      }
    };

    loadCommittee();

    const handleCommitteeChanged = () => {
      loadCommittee();
    };

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('committee') || e.key.includes('exam')) {
        loadCommittee();
      }
    };

    window.addEventListener(EXAM_COMMITTEE_CHANGED_EVENT, handleCommitteeChanged);
    window.addEventListener(ADMIN_YEAR_CHANGED_EVENT, handleCommitteeChanged);
    window.addEventListener('smart_absensi_teachers_updated', handleCommitteeChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener(EXAM_COMMITTEE_CHANGED_EVENT, handleCommitteeChanged);
      window.removeEventListener(ADMIN_YEAR_CHANGED_EVENT, handleCommitteeChanged);
      window.removeEventListener('smart_absensi_teachers_updated', handleCommitteeChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [effectiveUser?.id, effectiveUser?.position, effectiveUser?.full_name, effectiveUser?.nip]);

  // Exam Period Active / Auto-Expire State (Toggle On-Off & Waktu Usai)
  const [examPeriodStatus, setExamPeriodStatus] = useState<ExamPeriodStatus | null>(null);
  const [isExamPeriodModalOpen, setIsExamPeriodModalOpen] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const loadExamPeriod = async () => {
      try {
        const activeYear = AdministrationRepository.getActiveAcademicYear();
        const status = await ExamPeriodRepository.getPeriodStatus(activeYear);
        if (isMounted) {
          setExamPeriodStatus(status);
        }
      } catch (err) {
        console.warn('Failed to load exam period status in GuruDashboardPage:', err);
      }
    };

    loadExamPeriod();

    const handlePeriodChanged = () => {
      loadExamPeriod();
    };

    window.addEventListener(EXAM_PERIOD_CHANGED_EVENT, handlePeriodChanged);
    window.addEventListener(ADMIN_YEAR_CHANGED_EVENT, handlePeriodChanged);
    return () => {
      isMounted = false;
      window.removeEventListener(EXAM_PERIOD_CHANGED_EVENT, handlePeriodChanged);
      window.removeEventListener(ADMIN_YEAR_CHANGED_EVENT, handlePeriodChanged);
    };
  }, []);

  const isExamPeriodActive = examPeriodStatus ? examPeriodStatus.isActive : true;

  // Published Exam Schedule & Personal Duty Assignments (Teacher View across SMP & SMA)
  const [smpExamDuty, setSmpExamDuty] = useState<{
    schedule: ExamScheduleData;
    duties: ExamProctorItem[];
    teacherCode?: string;
  } | null>(null);
  const [smaExamDuty, setSmaExamDuty] = useState<{
    schedule: ExamScheduleData;
    duties: ExamProctorItem[];
    teacherCode?: string;
  } | null>(null);
  const [smpSchoolSchedule, setSmpSchoolSchedule] = useState<ExamScheduleData | null>(null);
  const [smaSchoolSchedule, setSmaSchoolSchedule] = useState<ExamScheduleData | null>(null);
  const [selectedExamDutyLevel, setSelectedExamDutyLevel] = useState<'ALL' | 'SMP' | 'SMA'>('ALL');

  const combinedExamDuties = useMemo(() => {
    const smpDuties = (smpExamDuty?.duties || []).map((d) => ({ ...d, educationLevel: 'SMP' as const }));
    const smaDuties = (smaExamDuty?.duties || []).map((d) => ({ ...d, educationLevel: 'SMA' as const }));
    const combined = [...smpDuties, ...smaDuties];
    return combined.sort((a, b) => {
      const dateCmp = a.date.localeCompare(b.date);
      if (dateCmp !== 0) return dateCmp;
      return a.sessionNumber - b.sessionNumber;
    });
  }, [smpExamDuty, smaExamDuty]);

  const activeExamDuty = useMemo(() => {
    if (selectedExamDutyLevel === 'SMP') return smpExamDuty;
    if (selectedExamDutyLevel === 'SMA') return smaExamDuty;
    if (smpExamDuty && smaExamDuty) {
      return {
        schedule: smpExamDuty.schedule,
        duties: combinedExamDuties,
        teacherCode: smpExamDuty.teacherCode || smaExamDuty.teacherCode,
      };
    }
    return smpExamDuty || smaExamDuty;
  }, [selectedExamDutyLevel, smpExamDuty, smaExamDuty, combinedExamDuties]);

  const hasMultipleLevels = Boolean(smpExamDuty || smpSchoolSchedule) && Boolean(smaExamDuty || smaSchoolSchedule);
  const shouldShowDutyCard = isExamPeriodActive && Boolean(smpExamDuty || smaExamDuty || smpSchoolSchedule || smaSchoolSchedule);

  useEffect(() => {
    let isMounted = true;
    const loadExamDuties = async () => {
      if (!effectiveUser?.id && !effectiveUser?.full_name) {
        if (isMounted) {
          setSmpExamDuty(null);
          setSmaExamDuty(null);
          setSmpSchoolSchedule(null);
          setSmaSchoolSchedule(null);
        }
        return;
      }
      try {
        const activeYear = AdministrationRepository.getActiveAcademicYear();
        const [smpData, smaData, smpSched, smaSched] = await Promise.all([
          ExamScheduleRepository.getTeacherExamDuties(effectiveUser.id, activeYear, 'SMP', effectiveUser.full_name),
          ExamScheduleRepository.getTeacherExamDuties(effectiveUser.id, activeYear, 'SMA', effectiveUser.full_name),
          ExamScheduleRepository.getSchedule(activeYear, 'ASTS', 'SMP').then(async (s) => s || await ExamScheduleRepository.getSchedule(activeYear, 'ASAS', 'SMP')),
          ExamScheduleRepository.getSchedule(activeYear, 'ASTS', 'SMA').then(async (s) => s || await ExamScheduleRepository.getSchedule(activeYear, 'ASAS', 'SMA')),
        ]);
        if (isMounted) {
          setSmpExamDuty(smpData);
          setSmaExamDuty(smaData);
          setSmpSchoolSchedule(smpSched);
          setSmaSchoolSchedule(smaSched);
          // Auto-select level based on available duties:
          if (smpData && smaData) {
            setSelectedExamDutyLevel('ALL');
          } else if (smpData && !smaData) {
            setSelectedExamDutyLevel('SMP');
          } else if (!smpData && smaData) {
            setSelectedExamDutyLevel('SMA');
          } else if (!smpData && !smaData) {
            if (smpSched && !smaSched) setSelectedExamDutyLevel('SMP');
            else if (!smpSched && smaSched) setSelectedExamDutyLevel('SMA');
            else setSelectedExamDutyLevel('ALL');
          }
        }
      } catch (err) {
        console.warn('Failed to load teacher exam duties in GuruDashboardPage:', err);
      }
    };

    loadExamDuties();

    const handleScheduleChanged = () => {
      loadExamDuties();
    };

    const handleStorage = (e: StorageEvent) => {
      if (!e.key || e.key.includes('exam_schedule')) {
        loadExamDuties();
      }
    };

    window.addEventListener(EXAM_SCHEDULE_PUBLISHED_EVENT, handleScheduleChanged);
    window.addEventListener(EXAM_SCHEDULE_UPDATED_EVENT, handleScheduleChanged);
    window.addEventListener(ADMIN_YEAR_CHANGED_EVENT, handleScheduleChanged);
    window.addEventListener('storage', handleStorage);

    return () => {
      isMounted = false;
      window.removeEventListener(EXAM_SCHEDULE_PUBLISHED_EVENT, handleScheduleChanged);
      window.removeEventListener(EXAM_SCHEDULE_UPDATED_EVENT, handleScheduleChanged);
      window.removeEventListener(ADMIN_YEAR_CHANGED_EVENT, handleScheduleChanged);
      window.removeEventListener('storage', handleStorage);
    };
  }, [effectiveUser?.id, effectiveUser?.full_name, effectiveUser?.nip]);

  // 8 Quick Icons Customization State & Hak Akses Wakasek Sarpras
  const isSarprasOfficer = isUserSarprasOfficer(effectiveUser);
  const isHomeroomTeacher =
    effectiveUser?.role !== 'GURU' ||
    /wali\s*kelas|walas|homeroom/i.test(effectiveUser?.position || '');
  const defaultHomeQuickIcons = useMemo(
    () => [
      'jadwal',
      'riwayat',
      'administrasi',
      isHomeroomTeacher ? 'homeroom_plan' : 'oral_exam',
      'buat_soal_ai',
      'koreksi_soal',
      'direktori_siswa',
      'lainnya',
    ],
    [isHomeroomTeacher]
  );

  const [isSarprasModalOpen, setIsSarprasModalOpen] = useState(false);
  const [isCustomizeIconsModalOpen, setIsCustomizeIconsModalOpen] = useState(false);
  const [quickIconIds, setQuickIconIds] = useState<string[]>(() => {
    const allowSarpras = isUserSarprasOfficer(effectiveUser);
    try {
      const stored = localStorage.getItem(`smart_absensi_quick_icons_v2_${effectiveUser?.id || 'default'}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return sanitizeQuickIconIds(parsed, allowSarpras, defaultHomeQuickIcons);
        }
      }
    } catch {
      // ignore
    }
    return defaultHomeQuickIcons;
  });

  useEffect(() => {
    if (!effectiveUser?.id) return;
    const allowSarpras = isUserSarprasOfficer(effectiveUser);
    try {
      const stored = localStorage.getItem(`smart_absensi_quick_icons_v2_${effectiveUser.id}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setQuickIconIds(sanitizeQuickIconIds(parsed, allowSarpras, defaultHomeQuickIcons));
          return;
        }
      }
    } catch {
      // ignore
    }
    setQuickIconIds(sanitizeQuickIconIds(defaultHomeQuickIcons, allowSarpras, defaultHomeQuickIcons));
  }, [effectiveUser?.id, isSarprasOfficer, defaultHomeQuickIcons]);

  const handleSaveQuickIcons = (newIds: string[]) => {
    const sanitized = sanitizeQuickIconIds(newIds, isSarprasOfficer, defaultHomeQuickIcons);
    setQuickIconIds(sanitized);
    try {
      localStorage.setItem(`smart_absensi_quick_icons_v2_${effectiveUser?.id || 'default'}`, JSON.stringify(sanitized));
    } catch {
      // ignore
    }
    showToast('success', 'Menu Utama Diperbarui', 'Susunan 8 ikon menu utama berhasil disimpan!');
  };

  // 🛡️ Mobile Hardware & Gesture Back Navigation Stack (Guru Dashboard)
  usePageModalBackStack([
    { id: 'guru_leave', isOpen: isLeaveModalOpen, onClose: () => setIsLeaveModalOpen(false), title: 'Formulir Izin / Cuti' },
    { id: 'guru_correction', isOpen: isCorrectionModalOpen, onClose: () => setIsCorrectionModalOpen(false), title: 'Koreksi Absensi' },
    { id: 'guru_schedule', isOpen: isScheduleModalOpen, onClose: () => setIsScheduleModalOpen(false), title: 'Jadwal Mengajar' },
    { id: 'guru_terms', isOpen: isTermsModalOpen, onClose: () => setIsTermsModalOpen(false), title: 'Syarat & Ketentuan' },
    { id: 'guru_change_pin', isOpen: isChangePinOpen, onClose: () => setIsChangePinOpen(false), title: 'Ubah PIN' },
    { id: 'guru_export', isOpen: isExportModalOpen, onClose: () => setIsExportModalOpen(false), title: 'Export Rekap' },
    { id: 'guru_attendance_choice', isOpen: isAttendanceChoiceModalOpen, onClose: () => setIsAttendanceChoiceModalOpen(false), title: 'Pilih Metode Absensi' },
    { id: 'guru_question_correction', isOpen: isQuestionCorrectionModalOpen, onClose: () => setIsQuestionCorrectionModalOpen(false), title: 'Koreksi Soal Ujian' },
    { id: 'guru_mood', isOpen: isMoodModalOpen, onClose: () => setIsMoodModalOpen(false), title: 'Check-in Mood' },
    { id: 'guru_complaint', isOpen: isComplaintModalOpen, onClose: () => setIsComplaintModalOpen(false), title: 'Kotak Aspirasi' },
    { id: 'guru_recap', isOpen: isRecapModalOpen, onClose: () => setIsRecapModalOpen(false), title: 'Rekap Presensi' },
    { id: 'guru_announcement', isOpen: isAnnouncementModalOpen, onClose: () => setIsAnnouncementModalOpen(false), title: 'Pengumuman Guru' },
    { id: 'guru_classroom', isOpen: isClassroomModalOpen, onClose: () => setIsClassroomModalOpen(false), title: 'Manajemen Kelas' },
    { id: 'guru_location', isOpen: isLocationModalOpen, onClose: () => setIsLocationModalOpen(false), title: 'Lokasi Sekolah' },
    { id: 'guru_student_directory', isOpen: isStudentDirectoryModalOpen, onClose: () => setIsStudentDirectoryModalOpen(false), title: 'Direktori Siswa' },
    { id: 'guru_teaching_materials', isOpen: isTeachingMaterialsModalOpen, onClose: () => setIsTeachingMaterialsModalOpen(false), title: 'Bahan Ajar' },
    { id: 'guru_events_calendar', isOpen: isEventsCalendarModalOpen, onClose: () => setIsEventsCalendarModalOpen(false), title: 'Kalender Kegiatan' },
    { id: 'guru_more_features', isOpen: isMoreFeaturesModalOpen, onClose: () => setIsMoreFeaturesModalOpen(false), title: 'Fitur Lainnya' },
    { id: 'guru_teacher_board', isOpen: isTeacherBoardOpen, onClose: () => setIsTeacherBoardOpen(false), title: 'Papan Kerja Harian' },
    { id: 'guru_exam_creator', isOpen: isExamCreatorModalOpen, onClose: () => setIsExamCreatorModalOpen(false), title: 'Pembuat Soal Ujian' },
    { id: 'guru_homeroom', isOpen: isHomeroomModalOpen, onClose: () => setIsHomeroomModalOpen(false), title: 'Wali Kelas Hub' },
    { id: 'guru_exam_card', isOpen: isExamCardModalOpen, onClose: () => setIsExamCardModalOpen(false), title: 'Kartu Asesmen Ujian' },
    { id: 'guru_student_kiosk', isOpen: isStudentKioskOpen, onClose: () => setIsStudentKioskOpen(false), title: 'Kiosk Presensi Siswa' },
    { id: 'guru_biometric_modal', isOpen: isBiometricModalOpen, onClose: () => setIsBiometricModalOpen(false), title: 'Biometrik Sidik Jari' },
    { id: 'guru_biometric_prompt', isOpen: isBiometricPromptOpen, onClose: () => setIsBiometricPromptOpen(false), title: 'Aktivasi Biometrik' },
    { id: 'guru_permission_blocked', isOpen: isPermissionBlockedModalOpen, onClose: () => setIsPermissionBlockedModalOpen(false), title: 'Izin Perangkat Ditolak' },
    { id: 'guru_discipline_badge', isOpen: isDisciplineBadgeModalOpen, onClose: () => setIsDisciplineBadgeModalOpen(false), title: 'Lencana Disiplin' },
    { id: 'guru_celebration_modal', isOpen: isCelebrationModalOpen, onClose: () => setIsCelebrationModalOpen(false), title: 'Apresiasi Guru Teladan' },
    { id: 'guru_point_history', isOpen: isPointHistoryModalOpen, onClose: () => setIsPointHistoryModalOpen(false), title: 'Riwayat Poin Guru' },
    { id: 'guru_administration', isOpen: isAdministrationModalOpen, onClose: () => setIsAdministrationModalOpen(false), title: 'Hub Administrasi' },
    { id: 'guru_exam_schedule', isOpen: isExamScheduleModalOpen, onClose: () => setIsExamScheduleModalOpen(false), title: 'Jadwal & Pengawas Ujian' },
    { id: 'guru_emergency', isOpen: isEmergencyModalOpen, onClose: () => setIsEmergencyModalOpen(false), title: 'Darurat Kelas / UKS' },
    { id: 'guru_preferences', isOpen: isPreferencesModalOpen, onClose: () => setIsPreferencesModalOpen(false), title: 'Preferensi Notifikasi' },
    { id: 'guru_policy', isOpen: isPolicyModalOpen, onClose: () => setIsPolicyModalOpen(false), title: 'Kebijakan Presensi' },
    { id: 'guru_challenge', isOpen: isChallengeModalOpen, onClose: () => setIsChallengeModalOpen(false), title: 'Tantangan Mingguan' },
    { id: 'guru_exam_period', isOpen: isExamPeriodModalOpen, onClose: () => setIsExamPeriodModalOpen(false), title: 'Periode Ujian' },
    { id: 'guru_sarpras', isOpen: isSarprasModalOpen, onClose: () => setIsSarprasModalOpen(false), title: 'Inventaris Sarpras' },
    { id: 'guru_customize_icons', isOpen: isCustomizeIconsModalOpen, onClose: () => setIsCustomizeIconsModalOpen(false), title: 'Kustomisasi Menu Utama' },
    { id: 'guru_game_pid_promo', isOpen: isGamePidPromoOpen, onClose: () => setIsGamePidPromoOpen(false), title: 'Promosi Game PID' },
  ]);

  // 🛡️ Sub-Layer Back Navigation (berandaLayer -> returnTarget / HOME)
  useBackHandler({
    id: 'guru_beranda_layer',
    isOpen: berandaLayer !== 'HOME',
    priority: BACK_PRIORITIES.SUB_LAYER,
    title: `Sub-Layer Beranda (${berandaLayer})`,
    onBack: () => {
      if (berandaLayer === 'ABOUT') {
        handleBackFromAboutLayer();
      } else if (berandaLayer === 'EDUCATION') {
        handleBackFromEducation();
      } else if (berandaLayer === 'NOTULEN') {
        setBerandaLayer(notulenReturnTarget || 'HOME');
      } else if (berandaLayer === 'STUDENT_BEHAVIOR') {
        setBerandaLayer(studentBehaviorReturnTarget || 'HOME');
      } else if (berandaLayer === 'SURVEY_ANALYTICS') {
        if (surveyAnalyticsReturnTarget === 'AKUN') {
          setActiveTab('AKUN');
          setBerandaLayer('HOME');
        } else if (surveyAnalyticsReturnTarget === 'ADMIN') {
          setActiveTab('ADMIN');
          setBerandaLayer('HOME');
        } else {
          setBerandaLayer(surveyAnalyticsReturnTarget || 'HOME');
        }
      } else if (berandaLayer === 'BIMTEK') {
        setBerandaLayer(bimtekReturnTarget || 'HOME');
      } else if (berandaLayer === 'COUNSELING_BK') {
        setBerandaLayer(counselingReturnTarget || 'HOME');
      } else if (berandaLayer === 'ORAL_EXAM') {
        setBerandaLayer(oralExamReturnTarget || 'HOME');
      } else if (berandaLayer === 'GAME_PID') {
        setBerandaLayer(gamePidReturnTarget || 'HOME');
      } else {
        setBerandaLayer('HOME');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  // Tab Navigation Back Handler (RIWAYAT / ADMIN / NOTIFIKASI / AKUN -> BERANDA)
  useTabBackNavigation({
    id: 'guru_active_tab',
    activeTab,
    defaultTab: 'BERANDA',
    onBackToDefault: () => {
      if (activeTab === 'NOTIFIKASI') {
        setActiveTab(notifReturnTab);
      } else {
        setActiveTab('BERANDA');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
  });

  const handleQuickIconClick = (iconId: string) => {
    if (effectiveUser) {
      WebTrafficService.recordFeatureVisit({
        user_id: effectiveUser.id,
        user_name: effectiveUser.full_name,
        user_npp: effectiveUser.nip,
        user_role: effectiveUser.role,
        feature_id: iconId,
      });
    }

    switch (iconId) {
      case 'sarpras_inventory':
        if (isSarprasOfficer) {
          setIsSarprasModalOpen(true);
        } else {
          showToast('warning', 'Akses Terbatas', 'Menu ini hanya dapat diakses oleh Wakasek Sarpras.');
        }
        break;
      case 'presensi':
        handleOpenAttendanceChoice();
        break;
      case 'izin_cuti':
        handleOpenLeaveModal();
        break;
      case 'jadwal':
        setIsScheduleModalOpen(true);
        break;
      case 'rekap':
        setIsRecapModalOpen(true);
        break;
      case 'riwayat':
        setActiveTab('RIWAYAT');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'administrasi':
        setIsAdministrationModalOpen(true);
        break;
      case 'notulen':
        setNotulenReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setBerandaLayer('NOTULEN');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'koreksi':
        handleOpenCorrectionModal();
        break;
      case 'buat_soal_ai':
        if (effectiveUser) {
          WebTrafficService.recordFeatureVisit({
            user_id: effectiveUser.id,
            user_name: effectiveUser.full_name,
            user_npp: effectiveUser.nip,
            user_role: effectiveUser.role,
            feature_id: 'buat_soal_ai',
          });
        }
        setIsExamCreatorModalOpen(true);
        break;
      case 'koreksi_soal':
        setIsQuestionCorrectionModalOpen(true);
        break;
      case 'direktori_siswa':
        setIsStudentDirectoryModalOpen(true);
        break;
      case 'homeroom_plan':
        setIsHomeroomModalOpen(true);
        break;
      case 'kalender':
        setIsEventsCalendarModalOpen(true);
        break;
      case 'classroom':
        setIsClassroomModalOpen(true);
        break;
      case 'materials':
        setIsTeachingMaterialsModalOpen(true);
        break;
      case 'exam_card':
        setIsExamCardModalOpen(true);
        break;
      case 'oral_exam':
        setOralExamReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setActiveTab('BERANDA');
        setBerandaLayer('ORAL_EXAM');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'jadwal_ujian_ngawas':
        setIsExamScheduleReadOnly(true);
        setExamScheduleInitialTab('proctors');
        setIsExamScheduleModalOpen(true);
        break;
      case 'exam_schedule':
        setIsExamScheduleReadOnly(effectiveUser?.role !== 'ADMIN' && !committeeInfo?.isCommittee);
        setExamScheduleInitialTab('proctors');
        setIsExamScheduleModalOpen(true);
        break;
      case 'student_good':
        setStudentBehaviorInitialTab('KEBAIKAN');
        setStudentBehaviorReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setBerandaLayer('STUDENT_BEHAVIOR');
        break;
      case 'student_discipline':
        setStudentBehaviorInitialTab('KEDISIPLINAN');
        setStudentBehaviorReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setBerandaLayer('STUDENT_BEHAVIOR');
        break;
      case 'emergency':
        setIsEmergencyModalOpen(true);
        break;
      case 'location':
        setIsLocationModalOpen(true);
        break;
      case 'student_kiosk':
        setIsStudentKioskOpen(true);
        break;
      case 'complaint':
        setIsComplaintModalOpen(true);
        break;
      case 'mood':
        setIsMoodModalOpen(true);
        break;
      case 'survey_hasil':
        setSurveyAnalyticsReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setBerandaLayer('SURVEY_ANALYTICS');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'bimtek':
        setBimtekReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setBerandaLayer('BIMTEK');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'counseling_bk':
        setCounselingReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setBerandaLayer('COUNSELING_BK');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'game_pid':
        setGamePidReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
        setBerandaLayer('GAME_PID');
        window.scrollTo({ top: 0, behavior: 'smooth' });
        break;
      case 'lainnya':
      default:
        setActiveTab('BERANDA');
        setBerandaLayer('ALL_FEATURES');
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Listener untuk membuka layer Suara Pendidik & Hasil Survei Guru (Layer dedicated, bukan popup)
  // Gunakan ref agar handler selalu membaca nilai berandaLayer terkini tanpa re-register listener
  useEffect(() => {
    const handleOpenSurveyAnalytics = () => {
      setSurveyAnalyticsReturnTarget(berandaLayerRef.current === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
      setActiveTab('BERANDA');
      setBerandaLayer('SURVEY_ANALYTICS');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };
    window.addEventListener('smart_absensi_open_survey_analytics', handleOpenSurveyAnalytics);
    return () => {
      window.removeEventListener('smart_absensi_open_survey_analytics', handleOpenSurveyAnalytics);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
  const [activeDutyLeavesToday, setActiveDutyLeavesToday] = useState<LeaveRequest[]>([]);
  const [isCopiedDutyTaskId, setIsCopiedDutyTaskId] = useState<string | null>(null);

  // Pre-scan GPS Health Status State
  const [gpsHealth, setGpsHealth] = useState<{ status: 'READY' | 'REFINING' | 'OFF' | 'INVALID'; text: string; accuracy?: number }>({
    status: 'REFINING',
    text: 'Mengukur lokasi GPS...',
  });

  useEffect(() => {
    GPSService.startBackgroundWarmUp();
    setGpsHealth(GPSService.getGPSHealthStatus());

    const interval = setInterval(() => {
      setGpsHealth(GPSService.getGPSHealthStatus());
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

  const allowOverrideScanForHome = settings.auto_attendance_allow_override_scan !== false;
  const hasCheckedInToday = Boolean(
    todayAttendance?.check_in_time &&
      (!(allowOverrideScanForHome && isAutoCheckInRecord(todayAttendance)) || Boolean(todayAttendance?.check_out_time))
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !effectiveUser?.id) return;
    window.dispatchEvent(
      new CustomEvent('smart_absensi_teacher_checkin_state', {
        detail: {
          userId: effectiveUser.id,
          checkedIn: hasCheckedInToday && !isTodayOff.isOff,
        },
      })
    );
  }, [effectiveUser?.id, hasCheckedInToday, isTodayOff.isOff]);

  // Check if tomorrow is a non-working day (Weekend or Holiday)
  const isTomorrowOff = useMemo(() => {
    const tomorrowStr = getTomorrowDateInJakarta();
    return isDateOffDay(tomorrowStr, settings, allHolidays).isOff;
  }, [settings, allHolidays]);

  // Indonesian Voice Announcement Initial Welcome Greeting Trigger
  const hasGreetedRef = React.useRef<boolean>(false);

  useEffect(() => {
    if (effectiveUser?.id) {
      SpeechService.setUser(effectiveUser.id);
    }
    if (!hasGreetedRef.current && effectiveUser?.full_name) {
      hasGreetedRef.current = true;
      setTimeout(() => {
        if (SpeechService.getIsEnabled() && !SpeechService.isWithinQuietHours()) {
          if (isTodayOff.isOff) {
            const cleanName = effectiveUser.full_name.replace(/S\.Pd\.|M\.Pd\.|Drs\.|Dra\.|H\.|Hj\./g, '').trim();
            SpeechService.speak(`Assalamu'alaikum ${cleanName}. Selamat hari libur, selamat beristirahat.`, undefined, undefined, undefined, 'GREETING');
          } else {
            SpeechService.speakWelcomeGreeting(effectiveUser.full_name, settings.institution_name);
          }
        }
      }, 1000);
    }
  }, [effectiveUser?.id, effectiveUser?.full_name, isTodayOff.isOff, settings.institution_name]);

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
      const isEnrolled = BiometricService.isEnrolled(effectiveUser.id);
      setIsBioEnrolled(isEnrolled);
      const provider = ProviderFactory.getProvider();
      const bindingRes = await provider.checkDeviceBinding(
        effectiveUser.id,
        deviceUUID || 'DEV_UUID',
        token || ''
      );
      setDeviceBindingStatus(bindingRes);
    } catch (err) {
      console.warn('Failed to check device binding or biometric status:', err);
    }
  };

  // Tawarkan aktivasi biometrik HP hanya SETELAH guru absen hari ini (zero interruption pre-check-in)
  useEffect(() => {
    if (!effectiveUser?.id || isPreviewMode || isBioEnrolled || isTodayOff.isOff || !hasCheckedInToday) {
      return;
    }
    const todayStr = getTodayDateInJakarta();
    const dismissKey = `smart_absensi_bio_prompt_dismissed_${effectiveUser.id}_${todayStr}`;
    if (sessionStorage.getItem(dismissKey) === 'true') {
      return;
    }
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    BiometricService.checkAvailability(effectiveUser.id)
      .then((availability) => {
        if (!cancelled && availability.isSupported && availability.hasPlatformSensor && !availability.isEnrolled) {
          timer = setTimeout(() => {
            setIsBiometricPromptOpen(true);
          }, 600);
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [effectiveUser?.id, isPreviewMode, isBioEnrolled, isTodayOff.isOff, hasCheckedInToday]);

  const handleCloseBiometricPrompt = () => {
    if (effectiveUser?.id) {
      const todayStr = getTodayDateInJakarta();
      sessionStorage.setItem(`smart_absensi_bio_prompt_dismissed_${effectiveUser.id}_${todayStr}`, 'true');
    }
    setIsBiometricPromptOpen(false);
  };

  const handleBiometricEnrollmentSuccess = () => {
    setIsBioEnrolled(true);
    if (effectiveUser?.id) {
      const todayStr = getTodayDateInJakarta();
      sessionStorage.setItem(`smart_absensi_bio_prompt_dismissed_${effectiveUser.id}_${todayStr}`, 'true');
    }
  };

  useEffect(() => {
    // loadUserLeaves is handled in loadAllData() on mount to prevent duplicate requests
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
        if (Array.isArray(teacherList) && teacherList.length > 0) {
          setAllRegisteredTeachers(teacherList);
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
          useSettingsStore.getState().setSettingsLocally(sysSettings);
          loadedSettings = sysSettings;
        }
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadSettings', 'Gagal memuat pengaturan jam kerja', false);
      }

      // 2. Today Attendance
      let loadedTodayAttendance: AttendanceRecord | null = null;
      try {
        const today = await provider.getTodayAttendance(effectiveUser.id, authToken);
        loadedTodayAttendance = today;
        setTodayAttendance(today);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadTodayAttendance', 'Gagal memuat presensi hari ini', false);
      }

      // 3. Holidays & School Schedules
      let loadedHolidays: HolidayRecord[] = [];
      try {
        const holidays = await provider.getHolidays(authToken);
        loadedHolidays = holidays || [];
        setAllHolidays(loadedHolidays);
        const todayIso = new Date().toISOString().substring(0, 10);

        // Cari apakah ada Libur Resmi hari ini (bukan schedule agenda)
        const holidayToday = loadedHolidays.find((h) => {
          if (h.date !== todayIso) return false;
          if (h.category_type === 'SCHEDULE' || h.is_holiday === false) return false;
          if (
            h.is_holiday === undefined &&
            ['RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP'].includes(h.type)
          ) {
            return false;
          }
          return true;
        });
        setTodayHoliday(holidayToday || null);

        // Cari apakah ada Agenda Acara (Schedule) hari ini (Rapat, UTS/UAS, Upacara, dll)
        const scheduleToday = loadedHolidays.find((h) => {
          if (h.date !== todayIso) return false;
          if (h.category_type === 'SCHEDULE' || h.is_holiday === false) return true;
          if (
            h.is_holiday === undefined &&
            ['RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP'].includes(h.type)
          ) {
            return true;
          }
          return false;
        });
        setTodaySchedule(scheduleToday || null);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadHolidays', 'Gagal memuat data hari libur & agenda', false);
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
        setUserLeaves(loadedLeaves);
      } catch (err) {
        console.warn('Failed to load user leaves for unabsented check:', err);
      }

      // 4.6. Intelligent Attendance Reminder Scheduling
      // Hanya jadwalkan pengingat jika hari kerja aktif dan TIDAK sedang dalam status Izin/Cuti/Sakit/Koreksi
      try {
        const todayStr = getTodayDateInJakarta();
        const hasLeaveOrCorrectionToday = loadedLeaves.some((l) => {
          const isPendingOrApproved =
            l.approval_status === 'APPROVED' ||
            l.approval_status === 'PENDING' ||
            (l as any).status === 'APPROVED' ||
            (l as any).status === 'PENDING';
          return isPendingOrApproved && l.start_date <= todayStr && todayStr <= l.end_date;
        });

        let hasLocalPendingCorrectionToday = false;
        if (typeof localStorage !== 'undefined') {
          try {
            hasLocalPendingCorrectionToday = Boolean(
              localStorage.getItem(`smart_absensi_pending_correction_${effectiveUser.id}_${todayStr}`)
            );
          } catch {}
        }

        const isTodayNonAttendingStatus =
          loadedTodayAttendance?.status === 'IZIN' ||
          loadedTodayAttendance?.status === 'SAKIT' ||
          (loadedTodayAttendance?.status as any) === 'CUTI' ||
          loadedTodayAttendance?.status === 'DINAS_LUAR';

        if (
          !loadedTodayAttendance?.check_in_time &&
          !hasLeaveOrCorrectionToday &&
          !hasLocalPendingCorrectionToday &&
          !isTodayNonAttendingStatus
        ) {
          NotificationService.scheduleCheckinReminder(effectiveUser.full_name, effectiveUser.id);
        } else if (
          loadedTodayAttendance?.check_in_time &&
          !loadedTodayAttendance?.check_out_time &&
          !hasLeaveOrCorrectionToday &&
          !hasLocalPendingCorrectionToday
        ) {
          NotificationService.scheduleCheckoutReminder(effectiveUser.full_name, effectiveUser.id);
        }
      } catch (errReminder) {
        console.warn('Failed to schedule attendance reminders:', errReminder);
      }

      // 5. Backend-Driven Notifications & Official School Announcements
      try {
        const notifs = await provider.getNotifications(effectiveUser.id, authToken, effectiveUser.role).catch(() => []);
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
              title: 'Ketertiban & Batas Waktu Absensi Masuk',
              message: 'Batas toleransi absensi masuk adalah sesuai jadwal kerja sekolah (pukul 07:30 WIB). Pastikan melakukan scan QR Code saat tiba di lingkungan sekolah.',
              type: 'INFO',
              is_read: readIds.has(`ann_checkin_guide_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
            {
              id: `ann_device_guide_${effectiveUser.id}`,
              user_id: effectiveUser.id,
              title: 'Keamanan Perangkat (1 Akun = 1 HP)',
              message: 'Akun presensi Anda terikat secara aman dengan HP aktif Anda untuk menjamin keabsahan data kehadiran.',
              type: 'SUCCESS',
              is_read: readIds.has(`ann_device_guide_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
            {
              id: `ann_leave_guide_${effectiveUser.id}`,
              user_id: effectiveUser.id,
              title: 'Pengajuan Izin & Koreksi Presensi',
              message: 'Bapak/Ibu Guru dapat mengajukan permohonan Cuti, Izin, Sakit, atau Koreksi Presensi langsung dari tombol layanan di menu Beranda.',
              type: 'INFO',
              is_read: readIds.has(`ann_leave_guide_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
            {
              id: `ann_security_pin_${effectiveUser.id}`,
              user_id: effectiveUser.id,
              title: 'Keamanan Akun & PIN Presensi',
              message: 'Jaga kerahasiaan PIN 6-digit Anda. Anda dapat memperbarui PIN secara berkala melalui tab Akun.',
              type: 'WARNING',
              is_read: readIds.has(`ann_security_pin_${effectiveUser.id}`),
              created_at: new Date().toISOString(),
            },
          ];
          allItems = defaultAnnouncements;
        }

        // 5.2 Merge with Realtime Cached Notifications
        const cachedNotifs = NotificationService.getCachedNotifications(effectiveUser.id, effectiveUser.role);
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
              title: `Jadwal Mengajar Hari Ini (${todayDayName})`,
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

      // 7.6 Load Teacher Point History & Ledger (Pure Read-Only, No Side Effects on Load)
      try {
        const myPointLogs = await provider.getTeacherPointHistory(effectiveUser.id, authToken);
        setPointHistory(myPointLogs || []);
        syncSurveyCompletionFromPointLogs(effectiveUser.id, myPointLogs || []);
      } catch (err) {
        console.warn('Failed to load teacher point history:', err);
      }

      try {
        const allLogs = await provider.getTeacherPointHistory('ALL', authToken);
        if (allLogs && allLogs.length > 0) {
          setAllTeacherPointLogs(allLogs);
          try {
            localStorage.setItem('smart_absensi_teacher_point_history', JSON.stringify(allLogs));
          } catch {}
        }
      } catch (err) {
        console.warn('Failed to load all teacher point history:', err);
      }

      // 8. Teacher Duty Schedule Check (Jadwal Piket Guru Senin - Jumat)
      try {
        const fetchedDuty = await DutyScheduleRepository.getDutySchedules(authToken);
        setDutySchedules(fetchedDuty || []);

        const todayDayOfWeek = new Date().getDay(); // 1 = Senin, ..., 5 = Jumat
        if (todayDayOfWeek >= 1 && todayDayOfWeek <= 5) {
          const todayPikets = (fetchedDuty || []).filter((s) => s && Number(s.day_of_week) === Number(todayDayOfWeek));
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
                title: 'Pengingat Jadwal Piket Guru Hari Ini',
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

      // 8b. Load Active Leave Requests for Today (Titipan Tugas Guru Piket)
      try {
        const todayStr = getTodayDateInJakarta();
        const allLeavesList = await LeaveRepository.getAllLeaves(authToken || '');

        // 1. Cek apakah pengguna yang sedang login sedang cuti / izin hari ini
        const isUserOnLeaveToday = (allLeavesList || []).some((l) => {
          if (!l || l.approval_status === 'REJECTED' || l.status === 'REJECTED') return false;
          if (l.user_id !== effectiveUser.id) return false;
          const sDate = l.start_date;
          const eDate = l.end_date || l.start_date;
          return sDate <= todayStr && eDate >= todayStr;
        });

        if (isUserOnLeaveToday) {
          // Guru yang sedang cuti/izin tidak bertugas piket dan tidak dibebani tugas titipan
          setIsDutyTeacherToday(false);
          setActiveDutyLeavesToday([]);
        } else {
          // 2. Filter izin dari rekan guru: JIKA YANG CUTI, JANGAN ADA TUGAS TITIPAN DARI GURU IZIN
          const activeLeaves = (allLeavesList || []).filter((l) => {
            if (!l || l.approval_status === 'REJECTED' || l.status === 'REJECTED') return false;
            if (l.user_id === effectiveUser.id) return false;
            const lType = String(l.leave_type || (l as any).type || '').toUpperCase();
            // Cuti resmi tidak dibebani tugas titipan untuk guru piket
            if (lType === 'CUTI') return false;
            const sDate = l.start_date;
            const eDate = l.end_date || l.start_date;
            return sDate <= todayStr && eDate >= todayStr;
          });
          setActiveDutyLeavesToday(activeLeaves);
        }
      } catch (errLeaves) {
        console.warn('Failed to load active duty leaves today:', errLeaves);
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

          // 1. Check if teacher has physical attendance record
          const hasAttendance = loadedHistory.some(
            (r) => r.date === dateStr && r.status && r.status !== 'BELUM_ABSEN'
          );
          if (hasAttendance) {
            NotificationService.dismissMissingAttendanceNotification(effectiveUser.id, dateStr);
            continue;
          }

          // 2. Check if teacher has approved OR pending leave / koreksi absen
          const hasLeaveOrCorrection = loadedLeaves.some((l) => {
            const isApprovedOrPending =
              l.approval_status === 'APPROVED' ||
              l.approval_status === 'PENDING' ||
              (l as any).status === 'APPROVED' ||
              (l as any).status === 'PENDING';
            return isApprovedOrPending && l.start_date <= dateStr && dateStr <= l.end_date;
          });

          // 3. Check local pending correction draft
          let hasLocalPendingCorrection = false;
          if (typeof localStorage !== 'undefined') {
            try {
              hasLocalPendingCorrection = Boolean(
                localStorage.getItem(`smart_absensi_pending_correction_${effectiveUser.id}_${dateStr}`)
              );
            } catch {
              hasLocalPendingCorrection = false;
            }
          }

          if (hasLeaveOrCorrection || hasLocalPendingCorrection) {
            // Guru sudah mengajukan izin / koreksi absen untuk tanggal ini!
            // Bersihkan notifikasi peringatan lama yang mungkin tersisa
            NotificationService.dismissMissingAttendanceNotification(effectiveUser.id, dateStr);
            continue;
          }

          // Masuk tetap manual / mandiri guru (tidak otomatis mengisi masuk saat buka dashboard);
          // tampilkan notifikasi peringatan agar guru dapat absen, mengajukan izin, atau koreksi.
          const notifId = `notif_missing_att_${effectiveUser.id}_${dateStr}`;
          const isRead = NotificationService.isNotificationRead(effectiveUser.id, notifId);

          const missingItem: AppNotification = {
            id: notifId,
            user_id: effectiveUser.id,
            title: `Presensi Belum Tercatat: ${dateStr}`,
            message: `Anda belum tercatat presensi pada ${dateStr}. Ketuk di sini untuk langsung mengajukan Koreksi Absen.`,
            type: 'WARNING',
            is_read: isRead,
            action_type: 'CORRECTION',
            action_date: dateStr,
            created_at: `${dateStr}T12:00:00.000Z`,
          };

          missingAttNotifs.push(missingItem);

          // HANYA tembakkan OS notification/push untuk hari ini (BUKAN tanggal lampau) dan dibatasi 1x per hari
          const todayAlertKey = `smart_absensi_missing_att_alert_fired_${effectiveUser.id}_${todayStr}`;
          const alreadyFiredToday = typeof window !== 'undefined' && localStorage.getItem(todayAlertKey) === '1';

          if (dateStr === todayStr && !isRead && !alreadyFiredToday) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(todayAlertKey, '1');
            }
            NotificationService.notifyTeacherMissingAttendance(effectiveUser.full_name, dateStr, effectiveUser.id);
          }
        }

        setNotifications((prev) => {
          const validMissingIds = new Set(missingAttNotifs.map((m) => m.id));
          // Filter out missing attendance notifications for dates that are now resolved/attended/excused
          const filtered = prev.filter((n) => {
            if (n.id && n.id.startsWith(`notif_missing_att_${effectiveUser.id}_`)) {
              return validMissingIds.has(n.id);
            }
            return true;
          });

          const combined = [...filtered];
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
      } catch (err) {
        console.warn('Failed to detect unabsented working days for guru:', err);
      }

      // 10. Automated Payday Detection & Notification Push (H-2 s/d Hari H Tanggal 10)
      try {
        const todayDate = new Date();
        const reminderInfo = getPaydayReminderInfo(todayDate, effectiveUser.full_name);
        const todayIsoStr = getTodayDateInJakarta();

        if (reminderInfo.isReminderActive) {
          const paydayNotifId = `notif_payday_${effectiveUser.id}_${todayIsoStr}_${reminderInfo.status}`;
          const isPaydayRead = NotificationService.isNotificationRead(effectiveUser.id, paydayNotifId);

          const paydayNotif: AppNotification = {
            id: paydayNotifId,
            user_id: effectiveUser.id,
            title: reminderInfo.title,
            message: reminderInfo.message,
            type: 'SUCCESS',
            is_read: isPaydayRead,
            created_at: `${todayIsoStr}T07:00:00.000Z`,
          };

          setNotifications((prev) => {
            const existingIdx = prev.findIndex(
              (n) => n.id === paydayNotifId || (n.title.includes('Hari Gajian') && n.created_at.startsWith(todayIsoStr))
            );
            if (existingIdx !== -1) {
              return prev.map((n, idx) =>
                idx === existingIdx
                  ? { ...n, is_read: Boolean(n.is_read) || isPaydayRead }
                  : n
              );
            }
            return [paydayNotif, ...prev];
          });

          // Batasi penembakan native notification maksimal 1x per hari di browser/device ini
          const isRealUser = !isPreviewMode && !!effectiveUser?.id && effectiveUser.id !== 'usr_guru_sample';
          const paydayDeviceKey = `smart_absensi_payday_fired_${todayIsoStr}`;
          const paydayUserKey = `smart_absensi_payday_fired_${effectiveUser.id}_${todayIsoStr}`;
          const alreadyFiredToday =
            typeof window !== 'undefined' &&
            (localStorage.getItem(paydayDeviceKey) === '1' || localStorage.getItem(paydayUserKey) === '1');

          if (isRealUser && !alreadyFiredToday) {
            if (typeof window !== 'undefined') {
              localStorage.setItem(paydayDeviceKey, '1');
              localStorage.setItem(paydayUserKey, '1');
            }
            NotificationService.notifyPayday(
              effectiveUser.full_name,
              todayIsoStr,
              effectiveUser.id,
              reminderInfo.title,
              reminderInfo.message,
              reminderInfo.status || undefined
            );
          }
        }
      } catch (err) {
        console.warn('Failed to process payday notification:', err);
      }
    };

    loadAllData();
    loadAllDataRef.current = loadAllData;

    // Auto-ensure Web Push registration to cloud if permission is already granted
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      NotificationService.subscribeUserToPush(effectiveUser.id).catch(() => {});
    }

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const debouncedLoadAllData = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        loadAllData();
      }, 500);
    };

    const handleScannedEvent = () => debouncedLoadAllData();
    const handleTeachersInstantSync = () => {
      try {
        const saved = localStorage.getItem('smart_absensi_teachers');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setAllRegisteredTeachers(parsed);
          }
        }
      } catch {
        // ignore
      }
      debouncedLoadAllData();
    };
    const handleNotificationPushed = (e: Event) => {
      try {
        const customEv = e as CustomEvent<any>;
        const payload = customEv?.detail;
        if (payload && payload.id) {
          setNotifications((prev) => {
            if (prev.some((n) => n.id === payload.id)) return prev;
            return [
              {
                id: payload.id,
                user_id: payload.userId || effectiveUser.id,
                title: payload.title,
                message: payload.body || payload.message || '',
                type: payload.type === 'LEAVE_REQUEST' ? 'WARNING' : payload.type === 'EVENT' ? 'INFO' : 'SUCCESS',
                is_read: false,
                action_type: payload.actionType,
                action_date: payload.actionDate,
                action_target_id: payload.actionTargetId,
                created_at: payload.createdAt || new Date().toISOString(),
              },
              ...prev,
            ];
          });
        }
      } catch {
        // ignore
      }
    };

    const handlePointsUpdated = async () => {
      try {
        const prov = ProviderFactory.getProvider();
        const myPointLogs = await prov.getTeacherPointHistory(effectiveUser.id, token || '');
        if (myPointLogs) {
          setPointHistory(myPointLogs);
          syncSurveyCompletionFromPointLogs(effectiveUser.id, myPointLogs);
        }
        const allLogs = await prov.getTeacherPointHistory('ALL', token || '');
        if (allLogs && allLogs.length > 0) {
          setAllTeacherPointLogs(allLogs);
          try {
            localStorage.setItem('smart_absensi_teacher_point_history', JSON.stringify(allLogs));
          } catch {}
        }
      } catch {}
    };

    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_records_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_points_updated', handlePointsUpdated);
    window.addEventListener('smart_absensi_notification_pushed', handleNotificationPushed);
    window.addEventListener('smart_absensi_teachers_updated', handleTeachersInstantSync);
    window.addEventListener('smart_absensi_holidays_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_notifications_read_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_policy_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_settings_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_leaves_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_leave_updated', handleScannedEvent);
    window.addEventListener('storage', handleTeachersInstantSync);
    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_records_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_points_updated', handlePointsUpdated);
      window.removeEventListener('smart_absensi_notification_pushed', handleNotificationPushed);
      window.removeEventListener('smart_absensi_teachers_updated', handleTeachersInstantSync);
      window.removeEventListener('smart_absensi_holidays_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_notifications_read_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_policy_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_settings_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_leaves_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_leave_updated', handleScannedEvent);
      window.removeEventListener('storage', handleTeachersInstantSync);
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

  // Real-time Classroom Emergency Alerts (SOS UKS & Piket) Listener
  useEffect(() => {
    const handleEmergencyUpdated = () => {
      EmergencyRepository.getActiveAlerts(token || undefined).then((activeSos) => {
        setActiveEmergencies((prev) => {
          if (activeSos.length > prev.length) {
            SoundService.playEmergencyAlert();
          }
          return activeSos;
        });
      });
    };

    window.addEventListener(EMERGENCY_UPDATED_EVENT, handleEmergencyUpdated);
    window.addEventListener('storage', handleEmergencyUpdated);

    // Initial load
    EmergencyRepository.getActiveAlerts(token || undefined).then((activeSos) => {
      setActiveEmergencies(activeSos);
    });

    return () => {
      window.removeEventListener(EMERGENCY_UPDATED_EVENT, handleEmergencyUpdated);
      window.removeEventListener('storage', handleEmergencyUpdated);
    };
  }, [token]);

  useCrossDeviceSync({
    onSync: handleCrossDeviceSync,
    cooldownMs: 180000,
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

  // Teacher Discipline Leaderboard & Top Teacher Recognition (Sinkron dengan selectedMonth)
  const currentJakartaToday = getTodayDateInJakarta();
  const currentJakartaYear = parseInt(currentJakartaToday.substring(0, 4), 10);
  const currentJakartaMonth = parseInt(currentJakartaToday.substring(5, 7), 10);
  const isCurrentCalendarMonth = selectedYear === currentJakartaYear && selectedMonth === currentJakartaMonth;
  const disciplinePeriod: DisciplinePeriodType = isCurrentCalendarMonth ? 'CURRENT_MONTH' : 'PREVIOUS_MONTH';
  const selectedYearMonthStr = `${selectedYear}-${String(selectedMonth).padStart(2, '0')}`;

  // Teacher Appreciation & Gamification Score Calculation (Isolasi ketat per bulan terpilih)
  const appreciationScore = calculateTeacherAppreciationScore(
    attendanceHistory,
    _dutySchedules,
    todayMood,
    effectiveUser?.id,
    pointHistory,
    selectedYearMonthStr
  );

  const disciplineLeaderboard = useMemo(() => {
    return getTeacherDisciplineLeaderboard(
      effectiveUser,
      null, // DILARANG mengirim currentUserScore untuk mengoverride ledger global!
      disciplinePeriod,
      allTeacherPointLogs,
      allRegisteredTeachers,
      { targetYearMonth: selectedYearMonthStr }
    );
  }, [effectiveUser, disciplinePeriod, selectedYearMonthStr, allTeacherPointLogs, allRegisteredTeachers]);

  const currentUserLeaderboardItem = useMemo(() => {
    if (!disciplineLeaderboard?.leaderboard) return null;
    return disciplineLeaderboard.leaderboard.find(
      (item) => item.isCurrentUser || item.id === effectiveUser?.id
    );
  }, [disciplineLeaderboard?.leaderboard, effectiveUser?.id]);

  const effectiveTotalPoints = currentUserLeaderboardItem?.totalPoints ?? 0;

  // Automated Pop-up Apresiasi Kehormatan untuk Juara 1, 2, dan 3 Disiplin Sekolah
  // Hanya tampil SETELAH guru menyelesaikan absen masuk hari ini dan akhir bulan SYNCED
  useEffect(() => {
    if (!effectiveUser?.id || !hasCheckedInToday || isTodayOff.isOff) {
      setIsCelebrationModalOpen(false);
      return;
    }
    const rank = disciplineLeaderboard.currentUserRank;
    if (!rank || rank < 1 || rank > 3) {
      setIsCelebrationModalOpen(false);
      return;
    }

    // Hindari race-condition saat log poin seluruh guru sekolah belum selesai dimuat atau belum SYNCED
    if (!allTeacherPointLogs || allTeacherPointLogs.length === 0 || disciplineLeaderboard.dataStatus !== 'SYNCED') {
      setIsCelebrationModalOpen(false);
      return;
    }

    const timing = evaluateDisciplinePeriodTiming(new Date(), selectedYear, selectedMonth);
    if (!timing.isEndOfMonth) return;

    const todayStr = getTodayDateInJakarta();
    const storageKey = `smart_absensi_celebrated_top3_${effectiveUser.id}_${todayStr}`;
    const alreadyCelebrated = sessionStorage.getItem(storageKey);
    if (!alreadyCelebrated) {
      const timer = setTimeout(() => {
        const currentFreshRank = disciplineLeaderboard.currentUserRank;
        if (currentFreshRank && currentFreshRank >= 1 && currentFreshRank <= 3 && disciplineLeaderboard.dataStatus === 'SYNCED') {
          setIsCelebrationModalOpen(true);
          SoundService.play('SUCCESS');
          sessionStorage.setItem(storageKey, 'true');
        }
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [
    effectiveUser?.id,
    hasCheckedInToday,
    isTodayOff.isOff,
    disciplineLeaderboard.currentUserRank,
    disciplineLeaderboard.dataStatus,
    selectedYear,
    selectedMonth,
    allTeacherPointLogs,
  ]);

  // ── Teacher Challenge & Streak Engine ─────────────────
  const streakInfo = useMemo(() => {
    return TeacherChallengeService.calculateStreak(attendanceHistory, pointHistory);
  }, [attendanceHistory, pointHistory]);

  const todayDateStr = useMemo(() => getTodayDateInJakarta(), []);

  // Promosi Pop-up Game PID & Deep Link Handler (Pop-up hanya SETELAH absen masuk)
  useEffect(() => {
    if (!effectiveUser?.id) return;

    // 1. Periksa Tautan Deep Link (?portal=game-pid / ?open=game-pid / ?tab=game_pid)
    if (typeof window !== 'undefined' && window.location?.search) {
      const searchParams = new URLSearchParams(window.location.search);
      const portalParam = searchParams.get('portal') || searchParams.get('open') || searchParams.get('tab');
      if (portalParam === 'game-pid' || portalParam === 'game_pid') {
        setActiveTab('BERANDA');
        setGamePidReturnTarget('HOME');
        setBerandaLayer('GAME_PID');
        return; // Deep-link langsung membuka portal game tanpa memunculkan popup promo
      }
    }

    // Auto-popup PID dinonaktifkan: modal hanya dibuka melalui aksi eksplisit pengguna
  }, [effectiveUser?.id, todayDateStr]);

  const hasFilledMoodToday = useMemo(() => {
    if (todayMood) return true;
    if (pointHistory.some((p) => p.date === todayDateStr && p.activity_type === 'MOOD_CHECKIN')) return true;
    try {
      return localStorage.getItem(`smart_absensi_quest_mood_${effectiveUser?.id}_${todayDateStr}`) === 'true';
    } catch {
      return false;
    }
  }, [todayMood, pointHistory, effectiveUser?.id, todayDateStr]);

  const hasSubmittedComplaintToday = useMemo(() => {
    if (pointHistory.some((p) => p.date === todayDateStr && p.activity_type === 'COMPLAINT_SUBMIT')) return true;
    if (userComplaints.some((c) => c.created_at && getTodayDateInJakarta(c.created_at) === todayDateStr)) return true;
    try {
      return localStorage.getItem(`smart_absensi_quest_complaint_${effectiveUser?.id}_${todayDateStr}`) === 'true';
    } catch {
      return false;
    }
  }, [pointHistory, userComplaints, effectiveUser?.id, todayDateStr]);

  const hasAwardedMeritToday = useMemo(() => {
    if (pointHistory.some((p) => p.date === todayDateStr && p.activity_type === 'STUDENT_MERIT')) return true;
    try {
      return localStorage.getItem(`smart_absensi_quest_merit_${effectiveUser?.id}_${todayDateStr}`) === 'true';
    } catch {
      return false;
    }
  }, [pointHistory, effectiveUser?.id, todayDateStr]);

  const hasRecordedDemeritToday = useMemo(() => {
    if (pointHistory.some((p) => p.date === todayDateStr && p.activity_type === 'STUDENT_DEMERIT')) return true;
    try {
      return localStorage.getItem(`smart_absensi_quest_demerit_${effectiveUser?.id}_${todayDateStr}`) === 'true';
    } catch {
      return false;
    }
  }, [pointHistory, effectiveUser?.id, todayDateStr]);

  const dailyQuests = useMemo(() => {
    return TeacherChallengeService.getDailyQuests(todayAttendance, isDutyTeacherToday, {
      hasFilledMood: hasFilledMoodToday,
      hasSubmittedComplaint: hasSubmittedComplaintToday,
      hasAwardedMerit: hasAwardedMeritToday,
      hasRecordedDemerit: hasRecordedDemeritToday,
    });
  }, [
    todayAttendance,
    isDutyTeacherToday,
    hasFilledMoodToday,
    hasSubmittedComplaintToday,
    hasAwardedMeritToday,
    hasRecordedDemeritToday,
  ]);

  const handleOpenQuestAction = useCallback((actionType: 'MOOD' | 'COMPLAINT' | 'MERIT' | 'DEMERIT') => {
    if (actionType === 'MOOD') {
      setIsMoodModalOpen(true);
    } else if (actionType === 'COMPLAINT') {
      setIsComplaintModalOpen(true);
    } else if (actionType === 'MERIT') {
      setStudentBehaviorInitialTab('KEBAIKAN');
      setStudentBehaviorReturnTarget('HOME');
      setBerandaLayer('STUDENT_BEHAVIOR');
    } else if (actionType === 'DEMERIT') {
      setStudentBehaviorInitialTab('KEDISIPLINAN');
      setStudentBehaviorReturnTarget('HOME');
      setBerandaLayer('STUDENT_BEHAVIOR');
    }
  }, []);

  const nightlyMotivation = useMemo(() => {
    if (isTomorrowOff) return null;
    const rival = disciplineLeaderboard.leaderboard.find((t) => t.rank === 1 && !t.isCurrentUser);
    return TeacherChallengeService.generateNightlyMotivation(
      effectiveUser,
      streakInfo,
      appreciationScore,
      disciplineLeaderboard.currentUserRank ?? undefined,
      rival?.name
    );
  }, [isTomorrowOff, effectiveUser, streakInfo, appreciationScore, disciplineLeaderboard]);

  // Evaluasi Pengiriman Notifikasi Malam Gaya Duolingo (Pukul 18:30 - 22:30 WIB)
  useEffect(() => {
    if (!effectiveUser?.id || isTomorrowOff) return;
    const rival = disciplineLeaderboard.leaderboard.find((t) => t.rank === 1 && !t.isCurrentUser);
    TeacherChallengeService.evaluateNightlyChallengeNotification(
      effectiveUser,
      streakInfo,
      appreciationScore,
      disciplineLeaderboard.currentUserRank ?? undefined,
      rival?.name,
      { isTomorrowOff, settings, holidays: allHolidays }
    );
  }, [effectiveUser, isTomorrowOff, streakInfo, appreciationScore, disciplineLeaderboard, settings, allHolidays]);

  // Auto-open modal jika dibuka dari link notifikasi PWA (openChallenge=true)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('openChallenge') === 'true') {
        setIsChallengeModalOpen(true);
      }
    }
  }, []);

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
      const todayDateStr = getTodayDateInJakarta();
      const slotKey = `${smartAlarmStatus.upcomingSlot.id}_${todayDateStr}_UPCOMING_10MIN`;
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

  const executeWithPermissionGuard = async (action: () => void, requiresCamera = false) => {
    try {
      const report = await PermissionGuardService.evaluatePermissions(requiresCamera);
      if (!report.isReadyForAttendance) {
        pendingAttendanceActionRef.current = action;
        setPermissionBlockedRequiresCamera(requiresCamera);
        setIsPermissionBlockedModalOpen(true);
        return;
      }
      action();
    } catch {
      action();
    }
  };

  const handleOpenScannerClick = () => {
    executeWithPermissionGuard(() => {
      if (onOpenScanner) onOpenScanner();
    }, true);
  };

  const handleOpenAttendanceChoice = () => {
    executeWithPermissionGuard(() => {
      setIsAttendanceChoiceModalOpen(true);
    }, false);
  };

  const handleOpenBiometricModal = () => {
    executeWithPermissionGuard(() => {
      setIsBiometricModalOpen(true);
    }, false);
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
      } else if (
        notifObj.action_type === 'NAVIGATE_TAB' &&
        (notifObj.title.toLowerCase().includes('survey') || notifObj.message.toLowerCase().includes('survey'))
      ) {
        window.dispatchEvent(new CustomEvent('smart_absensi_open_survey_modal'));
      }
    }
  };

  const handleChangePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.length !== 6 || confirmPin.length !== 6) {
      showToast('error', 'PIN Harus 6 Angka!', 'Masukkan 6 digit angka untuk PIN baru.');
      return;
    }
    if (newPin === '123456') {
      showToast('error', 'PIN Tidak Diizinkan', 'PIN baru tidak boleh menggunakan PIN bawaan (123456).');
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
  const isInitialUnreadMountRef = React.useRef<boolean>(true);

  // Play audio chime HANYA saat notifikasi baru tiba setelah inisialisasi awal (anti-chime mount/refresh)
  useEffect(() => {
    if (isInitialUnreadMountRef.current) {
      isInitialUnreadMountRef.current = false;
      prevGuruUnreadRef.current = unreadCount;
      return;
    }
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
      isSchedule?: boolean;
      scheduleTitle?: string;
      scheduleDesc?: string;
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

      const isScheduleEvent = Boolean(
        holiday &&
          (holiday.category_type === 'SCHEDULE' ||
            holiday.is_holiday === false ||
            ['RAPAT', 'UJIAN', 'UPACARA', 'WORKSHOP'].includes(holiday.type))
      );

      const isActualHoliday = Boolean(
        holiday &&
          !isScheduleEvent &&
          (holiday.category_type === 'HOLIDAY' ||
            holiday.is_holiday === true ||
            ['NATIONAL_HOLIDAY', 'SCHOOL_HOLIDAY', 'CUTI_BERSAMA'].includes(holiday.type))
      );

      const isHoliday = isWeekendHoliday || isActualHoliday;

      cells.push({
        isPadding: false,
        key: dateStr,
        dayNumber: day,
        dateStr,
        record,
        isHoliday,
        holidayDesc: isActualHoliday
          ? holiday?.name || holiday?.description
          : isWeekendHoliday
          ? 'Libur Akhir Pekan'
          : undefined,
        isSchedule: isScheduleEvent,
        scheduleTitle: isScheduleEvent ? holiday?.name : undefined,
        scheduleDesc: isScheduleEvent ? holiday?.description : undefined,
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
            } else if (cell.isSchedule) {
              tileClass = 'bg-blue-50/70 border-blue-200 hover:border-blue-400 hover:bg-blue-50 text-blue-950 shadow-2xs';
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
                    isSchedule: cell.isSchedule,
                    scheduleTitle: cell.scheduleTitle,
                    scheduleDesc: cell.scheduleDesc,
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
                  {cell.isToday ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#0D5C46] shrink-0" />
                  ) : cell.isSchedule ? (
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600 shrink-0" title="Ada Agenda Sekolah" />
                  ) : null}
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
                  ) : cell.isSchedule ? (
                    <span
                      className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200 shrink-0 shadow-2xs"
                      title={`Agenda: ${cell.scheduleTitle}`}
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
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-600 ring-2 ring-blue-200" /> Agenda (Tetap Masuk)</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-slate-300" /> Libur Resmi</span>
        </div>
      </div>
    );
  };

  const hasActiveAssignmentCards = Boolean(
    (committeeInfo?.isCommittee && isExamPeriodActive) ||
      shouldShowDutyCard ||
      (isDutyTeacherToday && activeDutyLeavesToday.length > 0) ||
      todaySchedule
  );

  const activeAssignmentCardsNode = hasActiveAssignmentCards ? (
    <div className="space-y-3.5">
      {/* Kartu Tugas Kepanitiaan Ujian (SK Kepala Sekolah) */}
      {committeeInfo?.isCommittee && isExamPeriodActive && (
        <div
          id="committee-assignment-banner"
          className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3"
        >
          <div className="flex items-start justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <SagaMedalRankIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-[#0F172A] text-[10px] font-bold tracking-wider uppercase border border-slate-200">
                    SK Kepanitiaan Ujian
                  </span>
                  <span className="text-[11px] text-slate-500 font-mono font-semibold">
                    T.A. {committeeInfo.academicYear}
                  </span>
                </div>
                <h3 className="text-sm sm:text-base font-bold text-[#0F172A] leading-tight mt-0.5 truncate">
                  {committeeInfo.roleLabel}
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsExamPeriodModalOpen(true)}
              className="min-h-10 px-3 py-1 rounded-full bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-[#0D5C46] text-xs font-bold shrink-0 flex items-center gap-1.5 cursor-pointer transition-colors"
              title="Atur status aktif atau batas waktu otomatis masa ujian"
            >
              <span className="w-2 h-2 rounded-full bg-[#0D5C46]" />
              <span>Aktif</span>
            </button>
          </div>

          <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-1">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
              <SagaAdminHubIcon className="w-4 h-4 shrink-0" />
              <span>Surat Keputusan (SK) Kepala Sekolah</span>
            </div>
            <p className="text-xs text-slate-700 leading-relaxed font-medium">
              {committeeInfo.role === 'PENANGGUNG_JAWAB' ? (
                <>
                  Ditetapkan sebagai <strong className="text-[#0F172A]">Penanggung Jawab</strong> pelaksanaan Asesmen Sekolah (ASTS/ASAS). Bertanggung jawab penuh atas keseluruhan kebijakan, legalitas, kelancaran, dan penjaminan mutu asesmen di satuan pendidikan.
                </>
              ) : committeeInfo.role === 'KETUA' ? (
                <>
                  Ditetapkan oleh <strong className="text-[#0F172A]">Kepala Sekolah</strong> sebagai <strong className="text-[#0F172A]">Ketua Panitia</strong> pelaksanaan Asesmen Sekolah (ASTS/ASAS). Berwenang memimpin kepanitiaan, perencanaan jadwal, koordinasi ruang rombel, dan pengesahan pengawas ujian.
                </>
              ) : committeeInfo.role === 'SEKRETARIS' ? (
                <>
                  Ditetapkan oleh <strong className="text-[#0F172A]">Kepala Sekolah</strong> sebagai <strong className="text-[#0F172A]">Sekretaris Panitia</strong> pelaksanaan Asesmen Sekolah (ASTS/ASAS). Bertanggung jawab menyusun jadwal sesi ujian, administrasi pengawas, cetak kartu peserta, dan berita acara.
                </>
              ) : committeeInfo.role === 'BENDAHARA' ? (
                <>
                  Ditetapkan oleh <strong className="text-[#0F172A]">Kepala Sekolah</strong> sebagai <strong className="text-[#0F172A]">Bendahara Panitia</strong> pelaksanaan Asesmen Sekolah (ASTS/ASAS). Bertanggung jawab atas pengelolaan administrasi logistik, perlengkapan ujian, dan operasional kepanitiaan.
                </>
              ) : (
                <>
                  Ditetapkan oleh <strong className="text-[#0F172A]">Kepala Sekolah</strong> sebagai <strong className="text-[#0F172A]">Anggota Panitia</strong> pelaksanaan Asesmen Sekolah (ASTS/ASAS). Bertugas mendukung kelancaran teknis, distribusi ruangan, dan ketertiban ruang ujian.
                </>
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setIsExamScheduleReadOnly(false);
                setExamScheduleInitialTab('ai_prompt');
                setIsExamScheduleModalOpen(true);
              }}
              className="min-h-11 px-3.5 bg-[#0D5C46] hover:bg-[#094736] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-between gap-2 cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <SagaScheduleIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">Jadwal &amp; Pengawas AI</span>
              </div>
              <ChevronRight className="w-4 h-4 shrink-0" />
            </button>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsExamCardModalOpen(true)}
                className="min-h-11 px-2.5 bg-white hover:bg-slate-50 text-[#0F172A] font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <SagaExamCardIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">Kartu Ujian</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQuestionCorrectionModalOpen(true)}
                className="min-h-11 px-2.5 bg-white hover:bg-slate-50 text-[#0F172A] font-bold text-xs rounded-xl border border-slate-300 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <SagaGradingIcon className="w-4 h-4 shrink-0" />
                <span className="truncate">Koreksi Soal</span>
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 truncate">
              <SagaClockStatusIcon className="w-4 h-4 shrink-0" />
              <span className="truncate">{examPeriodStatus?.remainingText || 'Masa Ujian Sedang Berlangsung'}</span>
            </div>
            <button
              type="button"
              onClick={() => setIsExamPeriodModalOpen(true)}
              className="min-h-10 px-2 text-xs font-bold text-[#0D5C46] hover:underline shrink-0 cursor-pointer"
            >
              Atur Batas Waktu
            </button>
          </div>
        </div>
      )}

      {/* Kartu Tugas Mengawas Asesmen Sekolah */}
      {shouldShowDutyCard && (
        <div
          id="teacher-exam-duty-card"
          className="bg-white rounded-2xl p-4 border border-slate-200 space-y-3"
        >
          {hasMultipleLevels && (
            <div className="grid grid-cols-3 gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={() => setSelectedExamDutyLevel('ALL')}
                className={`min-h-10 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer truncate ${
                  selectedExamDutyLevel === 'ALL'
                    ? 'bg-[#0D5C46] text-white'
                    : 'text-slate-600 hover:text-[#0F172A] hover:bg-white'
                }`}
              >
                Semua ({(smpExamDuty?.duties.length || 0) + (smaExamDuty?.duties.length || 0)})
              </button>
              <button
                type="button"
                onClick={() => setSelectedExamDutyLevel('SMP')}
                className={`min-h-10 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer truncate ${
                  selectedExamDutyLevel === 'SMP'
                    ? 'bg-[#0D5C46] text-white'
                    : 'text-slate-600 hover:text-[#0F172A] hover:bg-white'
                }`}
              >
                SMP ({smpExamDuty?.duties.length || 0})
              </button>
              <button
                type="button"
                onClick={() => setSelectedExamDutyLevel('SMA')}
                className={`min-h-10 px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer truncate ${
                  selectedExamDutyLevel === 'SMA'
                    ? 'bg-[#0D5C46] text-white'
                    : 'text-slate-600 hover:text-[#0F172A] hover:bg-white'
                }`}
              >
                SMA ({smaExamDuty?.duties.length || 0})
              </button>
            </div>
          )}

          {activeExamDuty && activeExamDuty.duties.length > 0 ? (
            <>
              <div
                role="button"
                tabIndex={0}
                onClick={() => {
                  setIsExamScheduleReadOnly(true);
                  setExamScheduleInitialTab('my_schedule');
                  setIsExamScheduleModalOpen(true);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setIsExamScheduleReadOnly(true);
                    setExamScheduleInitialTab('my_schedule');
                    setIsExamScheduleModalOpen(true);
                  }
                }}
                className="rounded-xl p-3.5 border border-slate-200 bg-slate-50 hover:border-[#0D5C46] transition-colors cursor-pointer"
                title="Klik untuk membuka jadwal mengawas dan rincian lengkap"
              >
                <div className="flex items-start justify-between gap-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                      <SagaScheduleIcon className="w-6 h-6" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-[#0D5C46] border border-emerald-200 text-[10px] font-bold tracking-wider uppercase">
                          Tugas Mengawas ({selectedExamDutyLevel === 'ALL' ? 'SMP & SMA' : selectedExamDutyLevel})
                        </span>
                        {activeExamDuty.teacherCode && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 text-[10px] font-bold border border-amber-300">
                            Kode {activeExamDuty.teacherCode}
                          </span>
                        )}
                      </div>
                      <h3 className="text-sm font-bold text-[#0F172A] leading-snug mt-0.5 line-clamp-1">
                        {selectedExamDutyLevel === 'ALL'
                          ? 'Jadwal Tugas Mengawas Ujian (SMP & SMA)'
                          : activeExamDuty.schedule?.config?.examTitle || `Jadwal Tugas Mengawas (${selectedExamDutyLevel})`}
                      </h3>
                      <p className="text-xs text-slate-600 font-medium">
                        <strong className="text-[#0F172A]">{effectiveUser?.full_name}</strong>
                        {effectiveUser?.nip ? ` (NPP: ${effectiveUser.nip})` : ''}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {activeExamDuty.duties.some((d) => d.date === getTodayDateInJakarta()) ? (
                      <span className="px-2.5 py-0.5 rounded-full bg-rose-700 text-white text-[10px] font-bold shrink-0">
                        HARI INI
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-full bg-white text-[#0D5C46] border border-emerald-200 text-[11px] font-bold shrink-0">
                        {activeExamDuty.duties.length} Sesi
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-2.5 pt-2.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-slate-600 font-medium">Jadwal Tugas:</span>
                    {activeExamDuty.duties.map((duty, idx) => {
                      const isToday = duty.date === getTodayDateInJakarta();
                      return (
                        <div
                          key={duty.id || idx}
                          className={`px-2 py-0.5 rounded-lg text-[11px] font-bold border flex items-center gap-1 ${
                            isToday
                              ? 'bg-amber-100 text-amber-950 border-amber-300'
                              : 'bg-white text-[#0F172A] border-slate-200'
                          }`}
                        >
                          <span className="text-slate-600 font-medium">{duty.dayName}:</span>
                          <span className="text-[#0F172A]">{duty.subject}</span>
                          <span className="px-1 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                            {duty.educationLevel ? `${duty.educationLevel} • ` : ''}{duty.roomName || `R.${duty.className}`}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-1 text-xs font-bold text-[#0D5C46] shrink-0">
                    <span>Buka Detail</span>
                    <ChevronRight className="w-4 h-4 shrink-0" />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const institutionForSlip = selectedExamDutyLevel === 'SMA'
                      ? 'SMA Terpadu As Salaam'
                      : selectedExamDutyLevel === 'ALL'
                      ? 'SMP & SMA Terpadu As Salaam'
                      : 'SMP Terpadu Al-Ittihadiyah';
                    const titleForSlip = selectedExamDutyLevel === 'ALL'
                      ? 'Jadwal Tugas Mengawas Ujian (SMP & SMA)'
                      : activeExamDuty.schedule?.config?.examTitle || `Jadwal Tugas Mengawas Ujian (${selectedExamDutyLevel})`;
                    ExamWordExporterService.printTeacherDutySlip(
                      effectiveUser?.full_name || 'Bapak/Ibu Guru',
                      activeExamDuty.teacherCode,
                      activeExamDuty.duties,
                      institutionForSlip,
                      titleForSlip
                    );
                  }}
                  className="min-h-11 px-3 bg-[#0D5C46] hover:bg-[#094736] text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <SagaPrinterIcon className="w-4 h-4 shrink-0" />
                  <span>Cetak Kartu (A4)</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsExamScheduleReadOnly(true);
                    setExamScheduleInitialTab('proctors');
                    setIsExamScheduleModalOpen(true);
                  }}
                  className="min-h-11 px-3 bg-slate-100 hover:bg-slate-200 text-[#0F172A] font-bold text-xs rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <SagaScheduleIcon className="w-4 h-4 shrink-0" />
                  <span>Jadwal Sekolah</span>
                </button>
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center space-y-2.5 bg-slate-50">
              <p className="text-xs font-semibold text-slate-600">
                Tidak ada penugasan mengawas untuk Anda di jenjang <strong className="text-[#0F172A]">{selectedExamDutyLevel === 'ALL' ? 'SMP maupun SMA' : selectedExamDutyLevel}</strong>.
              </p>
              <button
                type="button"
                onClick={() => {
                  setIsExamScheduleReadOnly(true);
                  setExamScheduleInitialTab('proctors');
                  setIsExamScheduleModalOpen(true);
                }}
                className="min-h-11 px-3.5 bg-white hover:bg-slate-100 text-[#0D5C46] border border-slate-300 rounded-xl text-xs font-bold transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <SagaScheduleIcon className="w-4 h-4 shrink-0" />
                <span>Lihat Roster Sekolah ({selectedExamDutyLevel === 'ALL' ? 'SMP' : selectedExamDutyLevel})</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Banner Pengingat Jadwal Agenda Sekolah Hari Ini */}
      {todaySchedule && (
        <button
          type="button"
          onClick={() => setIsEventsCalendarModalOpen(true)}
          className="w-full text-left bg-blue-50 hover:bg-blue-100/70 rounded-2xl p-4 text-[#0F172A] border border-blue-200 flex items-center justify-between gap-3 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0">
              <SagaCalendarAgendaIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="px-2 py-0.5 bg-blue-700 text-white text-[10px] font-bold rounded-md tracking-wider uppercase">
                  Agenda Hari Ini
                </span>
                <span className="text-xs text-blue-900 font-semibold">
                  Tetap Masuk &amp; Presensi
                </span>
              </div>
              <p className="text-xs sm:text-sm font-bold truncate leading-tight mt-0.5">
                {todaySchedule.name}
                {todaySchedule.description ? ` • ${todaySchedule.description}` : ''}
              </p>
            </div>
          </div>
          <span className="text-xs text-[#0D5C46] font-bold shrink-0">Detail Agenda</span>
        </button>
      )}

      {/* Kartu Tugas Titipan dari Guru Izin Hari Ini (Khusus Guru Piket) */}
      {isDutyTeacherToday && activeDutyLeavesToday.length > 0 && (
        <div
          id="duty-teacher-tasks-banner"
          className="bg-white rounded-2xl p-4 border border-amber-200 space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                <SagaAdminHubIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[10px] font-bold rounded-md tracking-wider uppercase border border-amber-300">
                    Tugas Piket Hari Ini
                  </span>
                  <span className="text-xs font-bold text-amber-800">
                    {activeDutyLeavesToday.length} Guru Izin
                  </span>
                </div>
                <h4 className="text-sm font-bold text-[#0F172A] leading-snug mt-0.5">
                  Tugas Titipan dari Guru Izin
                </h4>
              </div>
            </div>
            <span className="text-xs font-semibold text-slate-500 shrink-0">
              {new Date().toLocaleDateString('id-ID', { weekday: 'long' })}
            </span>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed">
            Berikut instruksi dan materi kelas yang dititipkan oleh rekan pendidik yang sedang izin hari ini:
          </p>

          <div className="space-y-2.5">
            {activeDutyLeavesToday.map((leave) => {
              const teacher = allRegisteredTeachers.find(
                (t) =>
                  t.id === leave.user_id ||
                  (Boolean(t.full_name) &&
                    Boolean(leave.teacher_name) &&
                    t.full_name.toLowerCase() === leave.teacher_name?.toLowerCase())
              );
              const tName = leave.teacher_name || teacher?.full_name || leave.user_name || 'Rekan Guru';
              const tNpp = teacher?.nip || '-';
              const tPhone = (teacher as any)?.phone || null;
              const hasTask = Boolean(leave.duty_teacher_notes && leave.duty_teacher_notes.trim().length > 0);
              const taskText = leave.duty_teacher_notes?.trim() || 'Tidak ada catatan tugas khusus yang dititipkan.';
              const isCopied = isCopiedDutyTaskId === leave.id;

              const handleCopyTask = () => {
                const copyText = `*Tugas Titipan dari ${tName} (${leave.leave_type})*\nAlasan: ${leave.reason}\nInstruksi untuk Guru Piket:\n"${taskText}"`;
                if (typeof navigator !== 'undefined' && navigator.clipboard) {
                  navigator.clipboard
                    .writeText(copyText)
                    .then(() => {
                      setIsCopiedDutyTaskId(leave.id);
                      showToast('success', 'Tugas Disalin!', `Instruksi kelas dari ${tName} berhasil disalin.`);
                      setTimeout(() => setIsCopiedDutyTaskId(null), 2500);
                    })
                    .catch(() => {
                      showToast('info', 'Tugas Guru Izin', taskText);
                    });
                } else {
                  showToast('info', 'Tugas Guru Izin', taskText);
                }
              };

              return (
                <div
                  key={leave.id}
                  className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-[#0D5C46] text-white flex items-center justify-center text-xs font-bold shrink-0">
                        {tName.charAt(0)}
                      </div>
                      <div className="min-w-0">
                        <span className="text-xs font-bold text-[#0F172A] truncate block">
                          {tName}
                        </span>
                        <span className="text-[11px] text-slate-600 font-mono block">
                          NPP: {tNpp}
                        </span>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${
                        leave.leave_type === 'SAKIT'
                          ? 'bg-rose-50 text-rose-800 border-rose-200'
                          : leave.leave_type === 'DINAS_LUAR'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : 'bg-amber-100 text-amber-900 border-amber-300'
                      }`}
                    >
                      {leave.leave_type === 'SAKIT'
                        ? 'Sakit'
                        : leave.leave_type === 'DINAS_LUAR'
                        ? 'Dinas Luar'
                        : 'Izin'}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 leading-tight">
                    <span className="font-semibold text-[#0F172A]">Keterangan:</span> {leave.reason}
                  </p>

                  <div className="p-2.5 rounded-xl bg-white border border-amber-200 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-amber-900 uppercase tracking-wider">
                        Instruksi / Tugas Kelas
                      </span>
                      {hasTask && (
                        <button
                          type="button"
                          onClick={handleCopyTask}
                          className="min-h-9 px-2 text-xs font-bold text-[#0D5C46] hover:bg-emerald-50 rounded-lg cursor-pointer transition-colors"
                        >
                          {isCopied ? 'Tersalin' : 'Salin Tugas'}
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-semibold text-[#0F172A] leading-relaxed italic">
                      "{taskText}"
                    </p>
                  </div>

                  {tPhone && (
                    <div className="pt-0.5 flex justify-end">
                      <a
                        href={`https://wa.me/${tPhone.replace(/\D/g, '')}?text=${encodeURIComponent(
                          `Halo Bapak/Ibu ${tName}, terkait tugas kelas yang dititipkan untuk piket hari ini: "${taskText}".`
                        )}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="min-h-10 px-2.5 text-xs font-bold text-[#0D5C46] hover:underline flex items-center gap-1.5"
                      >
                        <span>Konfirmasi via WhatsApp</span>
                        <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                      </a>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  ) : null;

  // Koordinator Prioritas 1-Banner Beranda (Maksimal 1 banner aktif & Zero Interruption sebelum absen masuk)
  const activeHomeBannerNode = (() => {
    // Prioritas 1: Darurat Kelas SOS Aktif
    if (activeEmergencies.length > 0) {
      return (
        <div className="bg-[#9F1239] text-white rounded-2xl p-4 border border-[#881337] space-y-2.5">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-white text-[#9F1239] flex items-center justify-center shrink-0">
                <SagaEmergencySosIcon className="w-6 h-6" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 bg-amber-300 text-slate-950 text-[10px] font-bold rounded-md uppercase">
                    SOS Kelas Aktif
                  </span>
                  <span className="text-xs text-rose-100 font-semibold">
                    {activeEmergencies.length} Panggilan Darurat
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold truncate leading-tight mt-0.5 flex items-center gap-1">
                  <SagaMapPinIcon tone="dark" className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">
                    {activeEmergencies[0].room_name}
                    {activeEmergencies[0].class_name ? ` (${activeEmergencies[0].class_name})` : ''} • {activeEmergencies[0].teacher_name}
                  </span>
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsEmergencyModalOpen(true)}
              className="min-h-11 px-3.5 bg-white hover:bg-rose-50 text-[#9F1239] font-bold text-xs rounded-xl shrink-0 cursor-pointer transition-colors"
            >
              Lihat &amp; Tangani
            </button>
          </div>
          {isDutyTeacherToday && (
            <div className="bg-black/20 rounded-xl px-3 py-2 text-xs font-semibold text-amber-200 border border-white/15">
              Anda bertugas sebagai Guru Piket hari ini. Segera menuju lokasi bantuan.
            </div>
          )}
        </div>
      );
    }

    // Prioritas 2: Window Pengingat Pulang
    const dayOfWeekJakarta = getJakartaDayOfWeek();
    const isFridayJakarta = dayOfWeekJakarta === 5;
    const isWeekdayJakarta = dayOfWeekJakarta >= 1 && dayOfWeekJakarta <= 5;
    const targetCheckoutForBanner = (
      isFridayJakarta
        ? settings?.reminder_friday_checkout_time || settings?.friday_checkout_start || CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME || '11:00'
        : settings?.reminder_checkout_time || settings?.work_checkout_start || CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME || '13:00'
    ).slice(0, 5);
    const [coH, coM] = targetCheckoutForBanner.split(':').map((n) => parseInt(n, 10));
    const earlyWarningHour = ((Number.isNaN(coH) ? 13 : coH) - 1 + 24) % 24;
    const earlyWarningThreshold = `${String(earlyWarningHour).padStart(2, '0')}:${String(Number.isNaN(coM) ? 0 : coM).padStart(2, '0')}`;
    const currentJakartaHm = getCurrentTimeInJakarta().slice(0, 5);
    const isCheckoutWindowActive =
      !isTodayOff.isOff &&
      Boolean(todayAttendance?.check_in_time) &&
      !todayAttendance?.check_out_time &&
      isWeekdayJakarta &&
      currentJakartaHm >= earlyWarningThreshold;

    if (isCheckoutWindowActive) {
      return (
        <CheckoutReminderBanner
          todayAttendance={todayAttendance}
          settings={settings}
          isTodayOff={Boolean(isTodayOff?.isOff)}
          userId={effectiveUser?.id}
          onOpenBiometric={handleOpenBiometricModal}
          onOpenScanner={handleOpenScannerClick}
          onOpenPolicyModal={() => setIsPolicyModalOpen(true)}
        />
      );
    }

    // Prioritas 3: Maksimal 1 Ringkasan Tugas / Agenda Operasional Hari Ini
    if (isDutyTeacherToday && activeDutyLeavesToday.length > 0) {
      return (
        <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white border border-amber-200 flex items-center justify-center shrink-0">
              <SagaAdminHubIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-amber-900 uppercase tracking-wide">
                Tugas Piket Hari Ini
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                {activeDutyLeavesToday.length} Guru Izin dengan Catatan Tugas Kelas
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ADMIN');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-11 px-3.5 rounded-xl bg-white hover:bg-amber-100 border border-amber-300 text-xs font-bold text-[#0F172A] shrink-0 cursor-pointer"
          >
            Buka Tugas
          </button>
        </div>
      );
    }

    if (committeeInfo?.isCommittee && isExamPeriodActive) {
      return (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
              <SagaMedalRankIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#0D5C46] uppercase tracking-wide">
                SK Kepanitiaan Ujian • T.A. {committeeInfo.academicYear}
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                {committeeInfo.roleLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveTab('ADMIN');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className="min-h-11 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0F172A] shrink-0 cursor-pointer"
          >
            Buka Admin
          </button>
        </div>
      );
    }

    if (shouldShowDutyCard && activeExamDuty && activeExamDuty.duties.length > 0) {
      const hasDutyToday = activeExamDuty.duties.some((d) => d.date === getTodayDateInJakarta());
      return (
        <div className="bg-white rounded-2xl p-4 border border-slate-200 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <SagaScheduleIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-[#0D5C46] uppercase tracking-wide">
                {hasDutyToday ? 'Jadwal Mengawas Hari Ini' : 'Tugas Mengawas Ujian'}
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                {activeExamDuty.duties.length} Sesi Mengawas ({selectedExamDutyLevel === 'ALL' ? 'SMP & SMA' : selectedExamDutyLevel})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsExamScheduleReadOnly(true);
              setExamScheduleInitialTab('my_schedule');
              setIsExamScheduleModalOpen(true);
            }}
            className="min-h-11 px-3.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-[#0F172A] shrink-0 cursor-pointer"
          >
            Lihat Jadwal
          </button>
        </div>
      );
    }

    if (todaySchedule) {
      return (
        <button
          type="button"
          onClick={() => setIsEventsCalendarModalOpen(true)}
          className="w-full text-left bg-blue-50 hover:bg-blue-100/70 rounded-2xl p-4 border border-blue-200 flex items-center justify-between gap-3 cursor-pointer transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 flex items-center justify-center shrink-0">
              <SagaCalendarAgendaIcon className="w-6 h-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-bold text-blue-800 uppercase tracking-wide">
                Agenda Sekolah Hari Ini
              </p>
              <p className="text-xs sm:text-sm font-bold text-[#0F172A] truncate">
                {todaySchedule.name}
              </p>
            </div>
          </div>
          <span className="text-xs font-bold text-[#0D5C46] shrink-0">Detail</span>
        </button>
      );
    }

    // Prioritas 4: Banner Non-Kritis (HANYA setelah absen masuk hari ini dan bukan hari libur)
    if (hasCheckedInToday && !isTodayOff.isOff) {
      const isSurveyEligible =
        Boolean(effectiveUser?.id) &&
        shouldShowDailySurveyBanner(effectiveUser.id) &&
        (typeof sessionStorage === 'undefined' ||
          sessionStorage.getItem(`smart_absensi_survey_banner_dismissed_${effectiveUser.id}`) !== '1');
      if (isSurveyEligible) {
        return <DailySurveyReminderBanner />;
      }

      const isNotifEligible =
        typeof window !== 'undefined' &&
        'Notification' in window &&
        !NotificationService.isPermissionGranted() &&
        (typeof localStorage === 'undefined' ||
          (localStorage.getItem(`smart_absensi_notif_banner_dismissed_${effectiveUser?.id || 'guest'}`) !== 'true' &&
            localStorage.getItem('smart_absensi_notif_banner_dismissed_all') !== 'true'));
      if (isNotifEligible) {
        return (
          <NotificationPermissionBanner
            user={effectiveUser}
            onOpenPreferences={() => setIsPreferencesModalOpen(true)}
          />
        );
      }

      const isPwaEligible =
        typeof window !== 'undefined' &&
        !pwaService.isStandalone() &&
        (typeof localStorage === 'undefined' || localStorage.getItem('smart_absensi_pwa_dismissed') !== 'true');
      if (isPwaEligible) {
        return <PWAInstallPrompt />;
      }
    }

    return null;
  })();

  return (
    <div className="min-h-dvh bg-[#F8FAFC] text-[#0F172A] pb-28 md:pb-12">
      {/* ── PREVIEW MODE WARNING BANNER ───────────────────────────────────── */}
      {isPreviewMode && !isDualRoleUser && (
        <div className="bg-slate-800 text-slate-100 px-4 py-2 text-xs font-semibold text-center border-b border-slate-700">
          MODE PREVIEW GURU (ADMIN / KEPSEK) — Menggunakan data simulasi guru.
        </div>
      )}

      {/* ── TOP HEADER RINGKAS GAYA SUPER-APP ───────────────────────────── */}
      <GuruDashboardHeader
        greeting={getTimeBasedGreeting()}
        userName={effectiveUser.full_name}
        avatarUrl={effectiveUser.avatar_url}
        institutionName={settings.institution_name || 'Portal Smart Absensi Guru'}
        dateLabel={new Date().toLocaleDateString('id-ID', {
          weekday: 'long',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })}
        unreadCount={unreadCount}
        isDualRoleUser={isDualRoleUser}
        onSwitchRoleMode={onSwitchRoleMode}
        onOpenNotifications={() => {
          if (activeTab !== 'NOTIFIKASI') {
            setNotifReturnTab(activeTab);
          }
          setActiveTab('NOTIFIKASI');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* ── NAVIGASI DESKTOP / TABLET (MD+) ─────────────────────────────── */}
      <GuruDesktopNavBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'BERANDA') setBerandaLayer('HOME');
          if (tab === 'AKUN') setProfilSubView('MAIN');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onPressAbsen={handleOpenAttendanceChoice}
      />

      <main className="w-full max-w-120 md:max-w-3xl mx-auto px-4 md:px-6 pt-4 space-y-5">
        {/* ── TAB 1: BERANDA UTAMA (SUPER-APP CLEAN HIERARCHY) ─────────────── */}
        {activeTab === 'BERANDA' && berandaLayer === 'HOME' && (
          <>
            {/* 1. Hero Card Utama Absensi (Solid Hijau Tua #0D5C46) */}
            {(() => {
              const isFriday = getJakartaDayOfWeek() === 5;
              const checkoutStart = (isFriday
                ? settings.friday_checkout_start || CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START
                : settings.work_checkout_start || CONSTANTS.DEFAULTS.WORK_CHECKOUT_START
              ).slice(0, 5);
              const checkinStart = (settings.work_checkin_start || CONSTANTS.DEFAULTS.WORK_CHECKIN_START).slice(0, 5);
              const checkinEnd = (settings.work_checkin_end || '07:30').slice(0, 5);

              const todayDateJakarta = getTodayDateInJakarta();
              const nowTimeJakarta = getCurrentTimeInJakarta().slice(0, 5);

              const pendingCorrectionToday = (() => {
                try {
                  if (!effectiveUser?.id) return null;
                  const key = `smart_absensi_pending_correction_${effectiveUser.id}_${todayDateJakarta}`;
                  const raw = localStorage.getItem(key);
                  if (raw) return JSON.parse(raw);
                } catch {}
                return null;
              })();

              const allowOverrideScan = settings.auto_attendance_allow_override_scan !== false;
              const isAutoCheckInToday = allowOverrideScan && isAutoCheckInRecord(todayAttendance);
              const isAutoCheckOutToday = isAutoCheckOutRecord(todayAttendance);

              let statusVariant: SagaAttendanceStatusVariant = 'WAITING';
              let statusHeadline = 'Belum Absen Masuk';
              let scheduleHint = `Batas tepat waktu ${checkinEnd.replace(':', '.')} WIB • Pulang ${checkoutStart.replace(':', '.')} WIB`;

              if (isTodayOff.isOff) {
                statusVariant = 'HOLIDAY';
                statusHeadline = 'Hari Libur Sekolah';
                scheduleHint = isTodayOff.reason || 'Tidak ada kewajiban presensi hari ini';
              } else if (isAutoCheckInToday) {
                const isReadyToCheckout = nowTimeJakarta >= checkoutStart;
                statusVariant = isReadyToCheckout ? 'READY_OUT' : 'WAITING';
                statusHeadline = isReadyToCheckout
                  ? isAutoCheckOutToday
                    ? 'Presensi Sistem • Ganti Mandiri'
                    : 'Waktunya Absen Pulang'
                  : 'Presensi Sistem Aktif';
                scheduleHint = 'Ketuk Scan QR atau Sidik Jari untuk mencatat absensi mandiri';
              } else if (todayAttendance?.check_out_time) {
                statusVariant = 'DONE';
                statusHeadline = `Presensi Selesai • ${formatTimeForInput(todayAttendance.check_out_time).replace(':', '.')} WIB`;
                scheduleHint = todayAttendance.check_in_time
                  ? `Masuk ${formatTimeForInput(todayAttendance.check_in_time).replace(':', '.')} WIB`
                  : isAutoCheckOutToday
                  ? 'Tercatat pulang otomatis sistem'
                  : 'Kehadiran hari ini lengkap';
              } else if (todayAttendance?.check_in_time) {
                const isReadyToCheckout = nowTimeJakarta >= checkoutStart;
                if (isReadyToCheckout) {
                  statusVariant = 'READY_OUT';
                  statusHeadline = 'Waktunya Absen Pulang';
                  scheduleHint = `Masuk ${formatTimeForInput(todayAttendance.check_in_time).replace(':', '.')} WIB • Siap absen pulang`;
                } else {
                  statusVariant = 'CHECKED_IN';
                  statusHeadline = `Sudah Absen • ${formatTimeForInput(todayAttendance.check_in_time).replace(':', '.')} WIB`;
                  scheduleHint = `Absen pulang dibuka mulai ${checkoutStart.replace(':', '.')} WIB`;
                }
              } else if (pendingCorrectionToday?.checkInTime) {
                const isReadyToCheckout = nowTimeJakarta >= checkoutStart;
                if (isReadyToCheckout) {
                  statusVariant = 'READY_OUT';
                  statusHeadline = 'Waktunya Absen Pulang';
                  scheduleHint = `Koreksi masuk ${String(pendingCorrectionToday.checkInTime).slice(0, 5).replace(':', '.')} WIB diajukan`;
                } else {
                  statusVariant = 'CHECKED_IN';
                  statusHeadline = `Koreksi Masuk • ${String(pendingCorrectionToday.checkInTime).slice(0, 5).replace(':', '.')} WIB`;
                  scheduleHint = `Absen pulang dibuka mulai ${checkoutStart.replace(':', '.')} WIB`;
                }
              } else if (nowTimeJakarta < checkinStart) {
                statusVariant = 'BEFORE_OPEN';
                statusHeadline = `Presensi Dibuka ${checkinStart.replace(':', '.')} WIB`;
                scheduleHint = `Jam masuk sekolah sampai ${checkinEnd.replace(':', '.')} WIB`;
              }

              const currentTimeLabel = `${currentTime
                .toLocaleTimeString('id-ID', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                  timeZone: 'Asia/Jakarta',
                })
                .replace(/:/g, '.')} WIB`;

              const cleanGpsText = gpsHealth.text
                .replace(/[📍🟢🟡🔴]|⚠️/gu, '')
                .replace(/\.{2,}$/, '')
                .replace(/\s+/g, ' ')
                .trim();

              return (
                <GuruAttendanceHeroCard
                  statusVariant={statusVariant}
                  statusHeadline={statusHeadline}
                  scheduleHint={scheduleHint}
                  currentTimeLabel={currentTimeLabel}
                  isOnline={isOnline}
                  gpsStatus={gpsHealth.status}
                  gpsText={cleanGpsText || 'Mengukur lokasi GPS'}
                  onScanQr={handleOpenScannerClick}
                  onBiometric={handleOpenBiometricModal}
                  onLeave={handleOpenLeaveModal}
                  onOpenLocation={() => setIsLocationModalOpen(true)}
                  onOpenTeacherBoard={() => setIsTeacherBoardOpen(true)}
                />
              );
            })()}

            {/* 2. Kisi Menu 8 Layanan Utama (4x2 Gaya Gojek) */}
            <GuruQuickMenuGrid
              menuIds={quickIconIds}
              activeEmergenciesCount={activeEmergencies.length}
              onSelectMenu={handleQuickIconClick}
              onOpenCustomize={() => setIsCustomizeIconsModalOpen(true)}
            />

            {/* 3. Jadwal Mengajar Hari Ini */}
            {(() => {
              const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
              const todayDayName = dayNames[new Date().getDay()];
              const targetDayNum = normalizeDayOfWeek(todayDayName);
              const todaySlots = teachingSlots.filter((s) => {
                if (!s || s.is_active === false) return false;
                const slotDay = normalizeDayOfWeek(s.day_of_week !== undefined ? s.day_of_week : s.day);
                return slotDay === targetDayNum;
              });

              let activeOrNextSlot = todaySlots.find((s) => getSlotLiveStatus(s.time, currentTime) === 'CURRENT');
              if (!activeOrNextSlot) {
                activeOrNextSlot = todaySlots.find((s) => getSlotLiveStatus(s.time, currentTime) === 'NEXT');
              }
              if (!activeOrNextSlot) {
                activeOrNextSlot = todaySlots.find((s) => getSlotLiveStatus(s.time, currentTime) === 'UPCOMING');
              }
              if (!activeOrNextSlot && todaySlots.length > 0) {
                activeOrNextSlot = todaySlots[todaySlots.length - 1];
              }

              const slotStatus = activeOrNextSlot ? getSlotLiveStatus(activeOrNextSlot.time, currentTime) : null;
              const otherDaysSummary = [
                ...new Set(
                  teachingSlots
                    .map((s) => s.day || (s.day_of_week != null ? getDayNameIndonesian(s.day_of_week) : ''))
                    .filter(Boolean)
                ),
              ].join(', ');

              const activeSlotPreview = activeOrNextSlot
                ? {
                    subject: activeOrNextSlot.subject,
                    className: activeOrNextSlot.className,
                    timeText: `${
                      activeOrNextSlot.start_time && activeOrNextSlot.end_time
                        ? `${sanitizeTimeString(activeOrNextSlot.start_time)} - ${sanitizeTimeString(activeOrNextSlot.end_time)}`
                        : activeOrNextSlot.time
                        ? activeOrNextSlot.time
                            .replace(' WIB', '')
                            .split('-')
                            .map((t) => sanitizeTimeString(t.trim()))
                            .join(' - ')
                        : '08:00 - 08:40'
                    } WIB`,
                    room: activeOrNextSlot.room || 'Kelas',
                  }
                : null;

              return (
                <GuruTodayScheduleCard
                  todayDayName={todayDayName}
                  totalTodaySlots={todaySlots.length}
                  activeSlot={activeSlotPreview}
                  slotStatus={slotStatus}
                  hasOtherDays={teachingSlots.length > 0}
                  otherDaysSummary={otherDaysSummary}
                  onOpenSchedule={() => setIsScheduleModalOpen(true)}
                />
              );
            })()}

            {/* 4. Koordinator Prioritas 1-Banner */}
            {activeHomeBannerNode}
          </>
        )}

        {/* ── TAB ADMIN: ADMINISTRASI & KARYA GURU ─────────────────────────── */}
        {activeTab === 'ADMIN' && (
          <GuruAdminHubTabView
            oralExamBadgeText={getOralExamPeriodStatus().badgeText}
            oralExamSubtitle={
              guruOralAssignments.length > 0
                ? `${guruOralAssignments[0].roomNumber} (${
                    guruOralAssignments[0].className === 'SMA' ? 'SMA' : `Kls ${guruOralAssignments[0].className}`
                  }) • ${ORAL_EXAM_SCHEDULE_LABEL}`
                : `Nilai penguji • ${ORAL_EXAM_SCHEDULE_LABEL}`
            }
            isSarprasOfficer={isSarprasOfficer}
            activeEmergenciesCount={activeEmergencies.length}
            streakDays={streakInfo?.currentStreak ?? 0}
            userPoints={effectiveTotalPoints}
            userRank={disciplineLeaderboard?.currentUserRank ?? 1}
            activeAssignmentSection={activeAssignmentCardsNode}
            onOpenAdministration={() => setIsAdministrationModalOpen(true)}
            onOpenOralExam={() => {
              setOralExamReturnTarget('HOME');
              setActiveTab('BERANDA');
              setBerandaLayer('ORAL_EXAM');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenExamCreator={() => handleQuickIconClick('buat_soal_ai')}
            onOpenQuestionCorrection={() => handleQuickIconClick('koreksi_soal')}
            onOpenExamCard={() => handleQuickIconClick('exam_card')}
            onOpenSchedule={() => setIsScheduleModalOpen(true)}
            onOpenMaterials={() => setIsTeachingMaterialsModalOpen(true)}
            onOpenNotulen={() => handleQuickIconClick('notulen')}
            onOpenBimtek={() => handleQuickIconClick('bimtek')}
            onOpenCalendar={() => setIsEventsCalendarModalOpen(true)}
            onOpenHomeroom={() => handleQuickIconClick('homeroom_plan')}
            onOpenStudents={() => setIsStudentDirectoryModalOpen(true)}
            onOpenClassroom={() => setIsClassroomModalOpen(true)}
            onOpenStudentBehavior={(tab) =>
              handleQuickIconClick(tab === 'KEBAIKAN' ? 'student_good' : 'student_discipline')
            }
            onOpenCounseling={() => handleQuickIconClick('counseling_bk')}
            onOpenTeacherBoard={() => setIsTeacherBoardOpen(true)}
            onOpenChallenge={() => {
              setActiveTab('BERANDA');
              setBerandaLayer('CHALLENGE');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenLeaderboard={() => setIsDisciplineBadgeModalOpen(true)}
            onOpenSurveyAnalytics={() => {
              setSurveyAnalyticsReturnTarget('ADMIN');
              setActiveTab('BERANDA');
              setBerandaLayer('SURVEY_ANALYTICS');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenRfidKiosk={() => setIsStudentKioskOpen(true)}
            onOpenGamePid={() => handleQuickIconClick('game_pid')}
            onOpenSarpras={() => setIsSarprasModalOpen(true)}
            onOpenEmergency={() => setIsEmergencyModalOpen(true)}
          />
        )}

        {/* ── LAYER: SEMUA FITUR GURU (PENGGANTI POPUP) ───────────────────── */}
        {activeTab === 'BERANDA' && berandaLayer === 'ALL_FEATURES' && (
          <section className="space-y-4">
            {/* Top Navigation Bar */}
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setBerandaLayer('HOME');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="min-h-11 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-[#0F172A] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Kembali ke Beranda</span>
              </button>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Semua Layanan
              </span>
            </div>

            {/* Banner Header Layer */}
            <div className="bg-[#0D5C46] rounded-2xl p-4 sm:p-5 text-white flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold">Semua Menu &amp; Fitur Guru</h2>
                <p className="text-xs text-emerald-100 mt-0.5 font-medium">
                  Akses modul presensi, akademik KBM, dan layanan administrasi sekolah
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <SagaMoreAppsIcon tone="dark" className="w-6 h-6" />
              </div>
            </div>

            {/* Grid Lengkap Seluruh Fitur Guru (Wadah Putih Bersih + Doodle Berwarna) */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 space-y-6">
              {/* Kategori 1: Presensi & Absensi */}
              <div className="space-y-3">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-0.5">
                  Presensi &amp; Absensi
                </h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  <button
                    type="button"
                    onClick={handleOpenAttendanceChoice}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaFingerprintIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Presensi
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenBiometricModal}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaFingerprintIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Sidik Jari
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenScannerClick}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaScanQrIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Scan QR
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={handleOpenLeaveModal}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaLeavePermitIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Izin Cuti
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenCorrectionModal()}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaEditPencilIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Koreksi Absen
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsRecapModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaHistoryIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Rekap
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsLocationModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaMapPinIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Lokasi GPS
                    </span>
                  </button>
                </div>
              </div>

              {/* Kategori 2: Akademik & KBM */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-0.5">
                  Akademik &amp; KBM
                </h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  <button
                    type="button"
                    onClick={() => setIsScheduleModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaScheduleIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Jadwal
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsClassroomModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaClassroomIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Kelas
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsStudentDirectoryModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaStudentsIcon className="w-8 h-8" />
                      {isDutyTeacherToday && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-[#0D5C46] text-white rounded-full ring-2 ring-white">
                          RFID
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Siswa
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickIconClick('homeroom_plan')}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaHomeroomIcon className="w-8 h-8" />
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-[#0D5C46] text-white rounded-full ring-2 ring-white">
                        Kls 9
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Wali Kelas
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickIconClick('buat_soal_ai')}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaCreateExamIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Buat Soal
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickIconClick('koreksi_soal')}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaGradingIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Koreksi Soal
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTeachingMaterialsModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaBookMaterialIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Materi
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsEventsCalendarModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaCalendarAgendaIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Acara
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setNotulenReturnTarget('ALL_FEATURES');
                      setBerandaLayer('NOTULEN');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaNotulenIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Notulen
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setBimtekReturnTarget('ALL_FEATURES');
                      setBerandaLayer('BIMTEK');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaBimtekIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Bimtek
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickIconClick('exam_card')}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaExamCardIcon className="w-8 h-8" />
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-500 text-white rounded-full ring-2 ring-white">
                        A4
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Kartu Ujian
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setOralExamReturnTarget('ALL_FEATURES');
                      setActiveTab('BERANDA');
                      setBerandaLayer('ORAL_EXAM');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                    title={`Penilaian Ujian Lisan Bahasa & BTQ (${ORAL_EXAM_SCHEDULE_LABEL})`}
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaOralExamIcon className="w-8 h-8" />
                      {guruOralAssignments.length > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-[#0D5C46] text-white rounded-full ring-2 ring-white">
                          Tugas
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Ujian Lisan
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickIconClick('game_pid')}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaGamePidIcon className="w-8 h-8" />
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-400 text-slate-950 rounded-full ring-2 ring-white">
                        Baru
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Game PID
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudentBehaviorInitialTab('KEBAIKAN');
                      setStudentBehaviorReturnTarget('ALL_FEATURES');
                      setBerandaLayer('STUDENT_BEHAVIOR');
                    }}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaCheckBadgeIcon className="w-8 h-8" />
                      <span
                        className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full ring-2 ring-white whitespace-nowrap ${
                          hasAwardedMeritToday
                            ? 'bg-[#0D5C46] text-white'
                            : 'bg-amber-300 text-slate-950'
                        }`}
                      >
                        {hasAwardedMeritToday ? 'Selesai' : '+5 Poin'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Poin Kebaikan
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setStudentBehaviorInitialTab('KEDISIPLINAN');
                      setStudentBehaviorReturnTarget('ALL_FEATURES');
                      setBerandaLayer('STUDENT_BEHAVIOR');
                    }}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaEmergencySosIcon className="w-8 h-8" />
                      <span
                        className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full ring-2 ring-white whitespace-nowrap ${
                          hasRecordedDemeritToday
                            ? 'bg-[#0D5C46] text-white'
                            : 'bg-amber-300 text-slate-950'
                        }`}
                      >
                        {hasRecordedDemeritToday ? 'Selesai' : '+5 Poin'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Kedisiplinan
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleQuickIconClick('counseling_bk')}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaCounselingIcon className="w-8 h-8" />
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-blue-700 text-white rounded-full ring-2 ring-white">
                        BK
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Catatan BK
                    </span>
                  </button>

                  {isDutyTeacherToday && (
                    <button
                      type="button"
                      onClick={() => setIsStudentKioskOpen(true)}
                      className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                    >
                      <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                        <SagaRfidKioskIcon className="w-8 h-8" />
                      </div>
                      <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                        Kiosk RFID
                      </span>
                    </button>
                  )}
                </div>
              </div>

              {/* Kategori 3: Layanan & Pengaturan */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider px-0.5">
                  Layanan &amp; Pengaturan
                </h3>
                <div className="grid grid-cols-4 gap-y-4 gap-x-2">
                  <button
                    type="button"
                    onClick={() => setIsEmergencyModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaEmergencySosIcon className="w-8 h-8" />
                      {activeEmergencies.length > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-[#DC2626] text-white rounded-full ring-2 ring-white">
                          {activeEmergencies.length}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      SOS Kelas
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsAnnouncementModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaBellIcon className="w-8 h-8" />
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-[#DC2626] text-white rounded-full ring-2 ring-white">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Pengumuman
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsComplaintModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaAspirationIcon className="w-8 h-8" />
                      <span
                        className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full ring-2 ring-white whitespace-nowrap ${
                          hasSubmittedComplaintToday
                            ? 'bg-[#0D5C46] text-white'
                            : 'bg-amber-300 text-slate-950'
                        }`}
                      >
                        {hasSubmittedComplaintToday ? 'Selesai' : '+5 Poin'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Aspirasi
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsMoodModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0 relative">
                      <SagaMoodFaceIcon mood="VERY_HAPPY" className="w-8 h-8" />
                      <span
                        className={`absolute -top-1.5 -right-1.5 px-1.5 py-0.5 text-[9px] font-bold rounded-full ring-2 ring-white whitespace-nowrap ${
                          hasFilledMoodToday
                            ? 'bg-[#0D5C46] text-white'
                            : 'bg-amber-300 text-slate-950'
                        }`}
                      >
                        {hasFilledMoodToday ? 'Selesai' : '+5 Poin'}
                      </span>
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Mood
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsChangePinOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaKeyPinIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Ubah PIN
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsTermsModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaBookMaterialIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Aturan
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsExportModalOpen(true)}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaPrinterIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Ekspor
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenAboutLayer('ALL_FEATURES')}
                    className="group flex flex-col items-center justify-start text-center cursor-pointer p-1 min-w-0"
                  >
                    <div className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center group-active:scale-95 transition-transform shrink-0">
                      <SagaInfoCircleIcon className="w-8 h-8" />
                    </div>
                    <span className="text-xs font-semibold text-[#0F172A] mt-1.5 leading-tight text-center line-clamp-2 w-full">
                      Tentang
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
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-[#0F172A] flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-12"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Kembali ke Beranda Utama</span>
            </button>
          </section>
        )}

        {/* ── LAYER: TANTANGAN DISIPLIN & MISI LENGKAP ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'CHALLENGE' && (
          <section className="space-y-4">
            <div className="bg-white rounded-2xl p-3.5 border border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setBerandaLayer('HOME');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="min-h-11 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-[#0F172A] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Kembali ke Beranda</span>
              </button>
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                Papan Tantangan
              </span>
            </div>

            <div className="bg-[#0D5C46] rounded-2xl p-4 sm:p-5 text-white flex items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold flex items-center gap-2">
                  <span>Tantangan Disiplin &amp; Misi Pendidik</span>
                </h2>
                <p className="text-xs text-emerald-100 mt-0.5 font-medium">
                  Bangun konsistensi rekor kehadiran tepat waktu dan lengkapi aktivitas harian
                </p>
              </div>
              <div className="w-11 h-11 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                <SagaChallengeTrophyIcon tone="dark" className="w-6 h-6" />
              </div>
            </div>

            <TeacherDailyChallengeWidget
              streakInfo={streakInfo}
              quests={dailyQuests}
              nightlyMotivation={nightlyMotivation}
              isTomorrowOff={isTomorrowOff}
              onOpenChallengeModal={() => setIsChallengeModalOpen(true)}
              onOpenLeaderboard={() => setIsDisciplineBadgeModalOpen(true)}
              onOpenQuestAction={handleOpenQuestAction}
              userRank={(disciplineLeaderboard?.currentUserRank) ?? 1}
              totalPoints={effectiveTotalPoints}
            />

            <div className="bg-white rounded-2xl p-4 border border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <SagaMedalRankIcon className="w-6 h-6" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-xs sm:text-sm font-bold text-[#0F172A] leading-tight">
                      Peringkat &amp; Piagam Penghargaan
                    </h3>
                    <p className="text-xs text-slate-600 font-medium truncate">
                      Peringkat #{(disciplineLeaderboard?.currentUserRank) ?? 1} dari {(disciplineLeaderboard?.totalTeachers) ?? 12} Guru ({effectiveTotalPoints} Poin)
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDisciplineBadgeModalOpen(true)}
                  className="min-h-11 px-3.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200 text-xs font-bold transition-colors cursor-pointer shrink-0"
                >
                  Klasemen
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                setBerandaLayer('HOME');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="w-full py-3 px-4 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-bold text-[#0F172A] flex items-center justify-center gap-2 transition-colors cursor-pointer min-h-12"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" />
              <span>Kembali ke Beranda Utama</span>
            </button>
          </section>
        )}

        {/* ── LAYER: TENTANG APLIKASI & PENGEMBANG (PINDAH LAYER, BUKAN CARD / POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'ABOUT' && (
          <AboutAppView
            onBack={handleBackFromAboutLayer}
            backLabel={
              aboutReturnTarget === 'AKUN'
                ? 'Kembali ke Akun'
                : aboutReturnTarget === 'ALL_FEATURES'
                ? 'Kembali ke Semua Fitur'
                : 'Kembali ke Beranda'
            }
            role="GURU"
          />
        )}

        {/* ── LAYER: PUSAT EDUKASI & PANDUAN PRESENSI (DEDICATED PAGE / VIEW) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'EDUCATION' && (
          <TeacherEducationView
            onBack={handleBackFromEducation}
            backLabel={
              educationReturnTarget === 'ALL_FEATURES'
                ? 'Kembali ke Semua Fitur'
                : 'Kembali ke Beranda'
            }
            defaultTab={educationViewTab}
            onOpenBiometricEnroll={handleOpenBiometricModal}
            isBioEnrolled={isBioEnrolled}
          />
        )}

        {/* ── LAYER: POIN KARAKTER SISWA (DEDICATED PAGE / VIEW) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'STUDENT_BEHAVIOR' && (
          <StudentBehaviorView
            onBack={() => {
              setBerandaLayer(studentBehaviorReturnTarget);
            }}
            backLabel={
              studentBehaviorReturnTarget === 'ALL_FEATURES'
                ? 'Kembali ke Semua Fitur'
                : 'Kembali ke Beranda'
            }
            initialTab={studentBehaviorInitialTab}
            currentTeacherName={effectiveUser?.full_name || 'Guru'}
          />
        )}

        {/* ── LAYER: NOTULEN RAPAT AI (DEDICATED FULL VIEW - NON-POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'NOTULEN' && (
          <MeetingMinutesView
            currentUser={effectiveUser}
            layoutMode="mobile"
            onBack={() => {
              setBerandaLayer(notulenReturnTarget);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ── LAYER: SUARA GURU & EVALUASI SEKOLAH (DEDICATED FULL SCREEN - NON-POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'SURVEY_ANALYTICS' && (
          <div className="fixed inset-0 z-50 bg-[#F4F6F8] overflow-y-auto">
            <SurveyAnalyticsView
              onBack={() => {
                if (surveyAnalyticsReturnTarget === 'AKUN') {
                  setActiveTab('AKUN');
                  setBerandaLayer('HOME');
                } else if (surveyAnalyticsReturnTarget === 'ADMIN') {
                  setActiveTab('ADMIN');
                  setBerandaLayer('HOME');
                } else {
                  setBerandaLayer(surveyAnalyticsReturnTarget === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
                }
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              backLabel={
                surveyAnalyticsReturnTarget === 'AKUN'
                  ? 'Kembali ke Akun'
                  : surveyAnalyticsReturnTarget === 'ADMIN'
                  ? 'Kembali ke Administrasi Guru'
                  : surveyAnalyticsReturnTarget === 'ALL_FEATURES'
                  ? 'Kembali ke Semua Fitur'
                  : 'Kembali ke Beranda'
              }
            />
          </div>
        )}

        {/* ── LAYER: PENCATATAN BIMTEK & DIKLAT GURU (DEDICATED FULL VIEW - NON-POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'BIMTEK' && (
          <BimtekManagementView
            currentUser={effectiveUser}
            onBack={() => {
              setBerandaLayer(bimtekReturnTarget);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            initialTab="MY_BIMTEK"
            academicYear="2026/2027"
          />
        )}

        {/* ── LAYER: GAME PID (PEKAN INOVASI DIGITAL - DEDICATED FULL VIEW - NON-POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'GAME_PID' && (
          <GamePidView
            onBack={() => {
              setBerandaLayer(gamePidReturnTarget);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            backLabel={gamePidReturnTarget === 'ALL_FEATURES' ? 'Kembali ke Semua Fitur' : 'Kembali ke Beranda'}
            user={effectiveUser}
            totalPoints={effectiveTotalPoints}
          />
        )}

        {/* ── LAYER: CATATAN BIMBINGAN KONSELING (BK) (DEDICATED FULL VIEW - NON-POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'COUNSELING_BK' && (
          <CounselingManagementView
            currentUser={effectiveUser}
            onBack={() => {
              setBerandaLayer(counselingReturnTarget);
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {/* ── LAYER: PENILAIAN UJIAN LISAN (DEDICATED FULL VIEW - NON-POPUP) ─── */}
        {activeTab === 'BERANDA' && berandaLayer === 'ORAL_EXAM' && (
          <React.Suspense fallback={<div className="p-6 text-center text-xs font-semibold text-slate-500">Memuat Penilaian Ujian Lisan...</div>}>
            <OralExamAssessmentModal
              isOpen={true}
              displayMode="page"
              onClose={() => {
                setBerandaLayer(oralExamReturnTarget);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              roleMode="GURU"
            />
          </React.Suspense>
        )}

        {/* ── TAB 2: RIWAYAT BULANAN ──────────────────────────────────────── */}
        {activeTab === 'RIWAYAT' && (() => {
          const izinRiwayatCount = attendanceHistory.filter((r) => r.status === 'IZIN' || r.status === 'SAKIT').length;
          const alpaRiwayatCount = attendanceHistory.filter((r) => r.status === 'ALFA').length;

          return (
          <section className="space-y-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              {/* Riwayat Category Sub-Tab Switcher */}
              <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setHistorySubTab('ATTENDANCE')}
                  className={`min-h-11 py-2 px-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                    historySubTab === 'ATTENDANCE'
                      ? 'bg-white text-[#0F172A] border border-slate-200'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  <SagaScheduleIcon className="w-4 h-4 shrink-0 hidden min-[380px]:block" />
                  <span className="truncate">Presensi</span>
                  <span className="px-1.5 py-0.5 bg-slate-200 text-slate-800 rounded-full text-[10px] font-bold shrink-0">
                    {attendanceHistory.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHistorySubTab('LEAVES')}
                  className={`min-h-11 py-2 px-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                    historySubTab === 'LEAVES'
                      ? 'bg-white text-[#0F172A] border border-slate-200'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  <SagaLeavePermitIcon className="w-4 h-4 shrink-0 hidden min-[380px]:block" />
                  <span className="truncate">Izin / Cuti</span>
                  <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-900 font-bold rounded-full text-[10px] shrink-0">
                    {userLeaves.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setHistorySubTab('COMPLAINTS')}
                  className={`min-h-11 py-2 px-1 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center justify-center gap-1 min-w-0 ${
                    historySubTab === 'COMPLAINTS'
                      ? 'bg-white text-[#0F172A] border border-slate-200'
                      : 'text-slate-600 hover:text-[#0F172A]'
                  }`}
                >
                  <SagaAspirationIcon className="w-4 h-4 shrink-0 hidden min-[380px]:block" />
                  <span className="truncate">Aspirasi</span>
                  <span className="px-1.5 py-0.5 bg-amber-100 text-amber-900 font-bold rounded-full text-[10px] shrink-0">
                    {userComplaints.length}
                  </span>
                </button>
              </div>

              {/* SUB-TAB 1: PRESENSI HARIAN */}
              {historySubTab === 'ATTENDANCE' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <h2 className="font-bold text-[#0F172A] text-base">Presensi &amp; Statistik</h2>
                      <p className="text-xs text-slate-500 font-medium">Data kehadiran per bulan</p>
                    </div>

                    {/* Dynamic Month / Year Filter Controls */}
                    <div className="flex items-center gap-2">
                      <select
                        value={selectedMonth}
                        onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                        className="min-h-11 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-[#0F172A] outline-none"
                        aria-label="Pilih bulan riwayat"
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
                        className="min-h-11 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl px-2.5 text-[#0F172A] outline-none"
                        aria-label="Pilih tahun riwayat"
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
                    className="w-full min-h-12 py-2.5 px-4 saga-btn-primary text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <SagaPrinterIcon tone="dark" className="w-4 h-4 shrink-0" />
                    <span>Cetak Laporan Presensi Saya (PDF / Excel)</span>
                  </button>

                  {/* View Mode Toggle Switcher: CALENDAR vs LIST */}
                  <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700 pl-2">
                      Mode Tampilan:
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setHistoryViewMode('CALENDAR')}
                        className={`min-h-10 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                          historyViewMode === 'CALENDAR'
                            ? 'bg-[#0D5C46] text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <SagaScheduleIcon tone={historyViewMode === 'CALENDAR' ? 'dark' : 'light'} className="w-4 h-4 shrink-0" />
                        <span>Kalender</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setHistoryViewMode('LIST')}
                        className={`min-h-10 px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                          historyViewMode === 'LIST'
                            ? 'bg-[#0D5C46] text-white'
                            : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <SagaHistoryIcon tone={historyViewMode === 'LIST' ? 'dark' : 'light'} className="w-4 h-4 shrink-0" />
                        <span>Daftar Log</span>
                      </button>
                    </div>
                  </div>

                  {/* Dynamic Stats Cards */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-0.5">
                      <span className="text-[11px] font-bold text-[#0D5C46] block uppercase truncate">Kehadiran {activeMonthName}</span>
                      <p className="text-xl font-bold text-[#0F172A]">{attendancePercentage}%</p>
                      <span className="text-[11px] text-slate-600 font-medium block truncate">{hadirCount + terlambatCount} dari {effectiveWorkingDays} Hari Kerja</span>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 space-y-0.5">
                      <span className="text-[11px] font-bold text-amber-800 block uppercase">Terlambat</span>
                      <p className="text-xl font-bold text-amber-950">{terlambatCount} <span className="text-xs font-semibold text-amber-700">Kali</span></p>
                      <span className="text-[11px] text-slate-600 font-medium block truncate">{terlambatPercent.toFixed(0)}% dari presensi</span>
                    </div>
                  </div>

                  {/* Ringkasan Status Bulanan */}
                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-600 block">Hadir</span>
                      <span className="text-base font-bold text-[#0D5C46] font-mono">{hadirCount}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-600 block">Terlambat</span>
                      <span className="text-base font-bold text-amber-700 font-mono">{terlambatCount}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-600 block">Izin/Sakit</span>
                      <span className="text-base font-bold text-blue-700 font-mono">{izinRiwayatCount}</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200">
                      <span className="text-[11px] font-medium text-slate-600 block">Alpa</span>
                      <span className={`text-base font-bold font-mono ${alpaRiwayatCount > 0 ? 'text-rose-700' : 'text-slate-500'}`}>{alpaRiwayatCount}</span>
                    </div>
                  </div>

                  {/* Calendar Grid Mode vs List Mode */}
                  {isLoadingHistory ? (
                    <SkeletonList count={4} />
                  ) : historyViewMode === 'CALENDAR' ? (
                    renderCalendarGrid()
                  ) : (
                    <div className="space-y-2 pt-1">
                      <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Catatan Harian {activeMonthName} {selectedYear}</h3>

                      {attendanceHistory.length === 0 ? (
                        <EmptyState
                          icon={<SagaEmptyListIllustration className="w-12 h-12" />}
                          title="Belum Ada Presensi Bulan Ini"
                          description={`Belum ada rekaman presensi pada ${activeMonthName} ${selectedYear}. Mulai dengan melakukan scan QR Code absensi.`}
                        />
                      ) : (
                        attendanceHistory.map((rec) => (
                          <div key={rec.id} className="p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between text-xs transition-colors">
                            <div className="space-y-0.5">
                              <p className="font-bold text-[#0F172A] text-xs">{rec.date}</p>
                              <p className="text-[11px] text-slate-600 font-medium">
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
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                    <div>
                      <h2 className="font-bold text-[#0F172A] text-base">Permohonan Izin &amp; Cuti</h2>
                      <p className="text-xs text-slate-500 font-medium">Daftar pengajuan izin dikirim</p>
                    </div>

                    <Button
                      variant="primary"
                      onClick={() => setIsLeaveModalOpen(true)}
                      className="min-h-11 px-3 py-2 text-xs font-bold flex items-center gap-1.5 cursor-pointer rounded-xl shrink-0"
                    >
                      <span>Ajukan Izin</span>
                    </Button>
                  </div>

                  {/* Leaves Overview Badges Summary */}
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="p-2.5 bg-amber-50 rounded-xl border border-amber-200 min-w-0">
                      <span className="text-[10px] font-bold text-amber-800 uppercase block truncate">Menunggu</span>
                      <p className="text-base font-bold text-amber-950 mt-0.5">
                        {userLeaves.filter((l) => l.approval_status === 'PENDING').length}
                      </p>
                    </div>

                    <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-200 min-w-0">
                      <span className="text-[10px] font-bold text-emerald-800 uppercase block truncate">Disetujui</span>
                      <p className="text-base font-bold text-emerald-950 mt-0.5">
                        {userLeaves.filter((l) => l.approval_status === 'APPROVED').length}
                      </p>
                    </div>

                    <div className="p-2.5 bg-red-50 rounded-xl border border-red-200 min-w-0">
                      <span className="text-[10px] font-bold text-red-800 uppercase block truncate">Ditolak</span>
                      <p className="text-base font-bold text-red-950 mt-0.5">
                        {userLeaves.filter((l) => l.approval_status === 'REJECTED').length}
                      </p>
                    </div>
                  </div>

                  {/* List of Leave Applications */}
                  <div className="space-y-2.5 pt-1">
                    {isLoadingLeaves ? (
                      <SkeletonList count={3} />
                    ) : userLeaves.length === 0 ? (
                      <EmptyState
                        icon={<SagaEmptyListIllustration className="w-12 h-12" />}
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
                            ? 'DISETUJUI'
                            : leave.approval_status === 'REJECTED'
                            ? 'DITOLAK'
                            : 'MENUNGGU';

                        return (
                          <div
                            key={leave.id}
                            className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <span className="inline-block px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-100 text-blue-900 border border-blue-200 mb-1">
                                  {leave.leave_type}
                                </span>
                                <h4 className="font-bold text-[#0F172A] text-xs">
                                  {leave.start_date} {leave.end_date !== leave.start_date ? `s/d ${leave.end_date}` : ''}
                                </h4>
                              </div>

                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded-md border shrink-0 inline-flex items-center gap-1 ${statusColor}`}>
                                {leave.approval_status === 'APPROVED' ? (
                                  <SagaCheckBadgeIcon className="w-3 h-3 shrink-0" />
                                ) : leave.approval_status === 'PENDING' ? (
                                  <SagaClockStatusIcon className="w-3 h-3 shrink-0" />
                                ) : null}
                                <span>{statusText}</span>
                              </span>
                            </div>

                            <p className="text-xs text-slate-700 font-medium leading-relaxed bg-white p-2.5 rounded-xl border border-slate-200">
                              "{leave.reason}"
                            </p>

                            {leave.attachment_url && (
                              <div className="flex items-center gap-1.5 text-[11px] text-[#0D5C46] font-semibold">
                                <SagaAttachmentClipIcon className="w-3.5 h-3.5 shrink-0" />
                                <span>Ada Lampiran Surat / Bukti Foto</span>
                              </div>
                            )}

                            {leave.approval_notes && (
                              <p className="text-[11px] text-slate-600 font-medium italic bg-amber-50 p-2 rounded-lg border border-amber-200">
                                Catatan Kepala Sekolah: {leave.approval_notes}
                              </p>
                            )}

                            <span className="text-[10px] text-slate-500 font-mono block pt-0.5">
                              Diajukan pada: {new Date(leave.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* SUB-TAB 3: ASPIRASI & KELUHAN ANONIM */}
              {historySubTab === 'COMPLAINTS' && (
                <div className="space-y-4">
                  {/* Header Row */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
                    <div>
                      <h2 className="font-bold text-[#0F172A] text-base flex items-center gap-2">
                        <SagaAspirationIcon className="w-5 h-5 shrink-0" />
                        <span>Aspirasi &amp; Keluhan Saya</span>
                      </h2>
                      <p className="text-xs text-slate-500 font-medium mt-0.5">
                        Daftar catatan rahasia yang Anda kirimkan ke manajemen sekolah
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => setIsComplaintModalOpen(true)}
                      className="min-h-11 px-4 py-2 bg-[#0D5C46] hover:bg-[#094736] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 self-start sm:self-auto w-full sm:w-auto"
                    >
                      <span>Tulis Catatan Baru</span>
                    </button>
                  </div>

                  {/* 100% Guaranteed Privacy Assurance Pill */}
                  <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                      <SagaDeviceShieldIcon className="w-5 h-5" />
                    </div>
                    <div className="text-xs leading-relaxed min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-[#0F172A] text-xs">
                          Identitas Anda 100% Terjaga
                        </span>
                        <span className="px-2 py-0.5 bg-white text-[#0D5C46] border border-emerald-300 text-[10px] font-bold rounded-full">
                          Aman &amp; Terlindungi
                        </span>
                      </div>
                      <p className="text-slate-600 font-medium text-[11px] mt-0.5">
                        Admin &amp; Kepala Sekolah membaca isi laporan Anda sebagai <em>"Pendidik Anonim"</em> tanpa mengetahui identitas pengirim.
                      </p>
                    </div>
                  </div>

                  {/* Complaints List or Empty State */}
                  <div className="space-y-3">
                    {isLoadingComplaints ? (
                      <SkeletonList count={3} />
                    ) : userComplaints.length === 0 ? (
                      <EmptyState
                        icon={<SagaEmptyListIllustration className="w-12 h-12" />}
                        title="Belum Ada Catatan atau Aspirasi"
                        description="Anda belum pernah mengirimkan catatan atau keluhan anonim. Tekan tombol 'Tulis Catatan Baru' jika ada masukan untuk sekolah."
                        actionLabel="Tulis Aspirasi Pertama"
                        onAction={() => setIsComplaintModalOpen(true)}
                      />
                    ) : (
                      userComplaints.map((item) => {
                        const catMeta = ComplaintRepository.CATEGORY_META[item.category] || {
                          label: item.category,
                          emoji: '',
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
                            className="p-4 rounded-2xl bg-white border border-slate-200 text-xs space-y-3"
                          >
                            {/* Card Top Meta */}
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border inline-flex items-center gap-1.5 ${catMeta.bgClass} ${catMeta.colorClass} ${catMeta.borderClass}`}>
                                  <SagaAspirationIcon className="w-3.5 h-3.5 shrink-0" />
                                  <span>{catMeta.label}</span>
                                </span>
                                <span className="text-[11px] font-mono text-slate-500 font-medium">
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

                              <span className={`px-2.5 py-1 text-[11px] font-bold rounded-xl border shrink-0 inline-flex items-center gap-1.5 ${statusMeta.bgClass} ${statusMeta.colorClass} ${statusMeta.borderClass}`}>
                                {(item.status === 'SUBMITTED' || item.status === 'IN_REVIEW') && (
                                  <span
                                    className={`w-2 h-2 rounded-full shrink-0 ${
                                      item.status === 'SUBMITTED' ? 'bg-amber-500' : 'bg-sky-500'
                                    }`}
                                  />
                                )}
                                <span>{statusMeta.label}</span>
                              </span>
                            </div>

                            {/* Complaint Body Message */}
                            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 text-xs sm:text-sm text-[#0F172A] font-medium leading-relaxed">
                              "{item.content}"
                            </div>

                            {/* Official School Management Response */}
                            {item.admin_response ? (
                              <div className="bg-emerald-50 border border-emerald-300 border-l-4 border-l-[#0D5C46] p-3.5 rounded-xl space-y-1.5">
                                <div className="flex flex-wrap items-center justify-between gap-1 text-xs font-bold text-emerald-950">
                                  <span className="flex items-center gap-1.5">
                                    <SagaAspirationIcon className="w-4 h-4 shrink-0" />
                                    <span>
                                      Tanggapan Resmi ({item.responded_by_role === 'KEPSEK' ? 'Kepala Sekolah' : 'Tim Manajemen Sekolah'}):
                                    </span>
                                  </span>
                                  {item.responded_at && (
                                    <span className="font-mono text-[10px] text-[#0D5C46] font-bold">
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
                                <p className="text-xs sm:text-sm text-[#0F172A] font-medium leading-relaxed">
                                  {item.admin_response}
                                </p>
                              </div>
                            ) : (
                              <div className="text-[11px] text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 flex items-center gap-2 font-medium">
                                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
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
          );
        })()}

        {/* ── TAB 3: NOTIFIKASI (Akses lewat Ikon Lonceng Header) ──────────── */}
        {activeTab === 'NOTIFIKASI' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between gap-2 bg-white p-3.5 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setActiveTab(notifReturnTab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="min-h-11 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-bold text-[#0F172A] transition-colors cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4 shrink-0" />
                <span>Kembali</span>
              </button>
              <span className="text-xs font-semibold text-slate-500">
                {unreadCount > 0 ? `${unreadCount} belum dibaca` : 'Semua terbaca'}
              </span>
            </div>

            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
                    <SagaBellIcon className="w-5 h-5 text-[#0D5C46]" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-bold text-[#0F172A] text-base">Notifikasi &amp; Pengumuman</h2>
                    <p className="text-xs text-slate-500 font-medium">{unreadCount} belum dibaca</p>
                  </div>
                </div>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={handleMarkAllNotificationsRead}
                    className="min-h-11 px-3 rounded-xl text-xs font-bold text-[#0D5C46] hover:bg-emerald-50 cursor-pointer shrink-0"
                  >
                    Tandai Dibaca
                  </button>
                )}
              </div>

              <div className="space-y-2.5">
                {notifications.length === 0 ? (
                  <EmptyState
                    icon={<SagaEmptyListIllustration className="w-12 h-12" />}
                    title="Tidak Ada Notifikasi"
                    description="Semua pengumuman dan pengingat presensi terbaru akan tampil di sini."
                  />
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      onClick={() => handleMarkSingleNotificationRead(n)}
                      className={`p-3.5 sm:p-4 rounded-xl border text-xs space-y-1.5 transition-colors cursor-pointer ${
                        !n.is_read
                          ? n.action_type === 'CORRECTION'
                            ? 'bg-amber-50 border-amber-300 hover:border-amber-400'
                            : 'bg-emerald-50 border-emerald-300 hover:border-[#0D5C46]'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-bold text-[#0F172A] text-xs sm:text-sm flex items-center gap-1.5 min-w-0">
                          {n.action_type === 'CORRECTION' && (
                            <SagaEditPencilIcon className="w-4 h-4 shrink-0" />
                          )}
                          <span className="truncate">{n.title}</span>
                        </h3>
                        {!n.is_read && (
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              n.action_type === 'CORRECTION' ? 'bg-amber-500' : 'bg-[#0D5C46]'
                            }`}
                          />
                        )}
                      </div>
                      <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {n.message}
                      </p>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[11px] text-slate-500 font-mono block">
                          {n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : 'Hari ini'}
                        </span>
                        {n.action_type === 'CORRECTION' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-900 bg-amber-100 px-2.5 py-1 rounded-lg border border-amber-300">
                            <SagaEditPencilIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>Ajukan Koreksi</span>
                            <ArrowRight className="w-3 h-3 shrink-0" />
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

        {/* ── TAB 4: AKUN ───────────────────────────────────────────────── */}
        {activeTab === 'AKUN' && (
          profilSubView === 'EDUCATION' ? (
            <TeacherEducationView
              onBack={handleBackFromEducation}
              backLabel="Kembali ke Akun"
              defaultTab={educationViewTab}
              onOpenBiometricEnroll={handleOpenBiometricModal}
              isBioEnrolled={isBioEnrolled}
            />
          ) : (
          <section className="space-y-4">
            <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 space-y-4">
              <div className="text-center space-y-2 pb-4 border-b border-slate-100">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-emerald-50 text-[#0D5C46] font-bold text-3xl flex items-center justify-center mx-auto border-2 border-emerald-200 overflow-hidden shrink-0">
                  <UserAvatar
                    avatarUrl={effectiveUser.avatar_url}
                    name={effectiveUser.full_name}
                    className="w-full h-full rounded-full"
                    textClassName="text-3xl"
                  />
                </div>

                <div>
                  <h2 className="font-bold text-[#0F172A] text-base sm:text-lg">{effectiveUser.full_name}</h2>
                  <p className="text-xs text-slate-600 font-medium">{effectiveUser.position || 'Guru Pengajar'}</p>
                  {committeeInfo?.isCommittee && isExamPeriodActive && (
                    <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-200 text-[#0F172A] font-bold text-xs">
                      <SagaMedalRankIcon className="w-4 h-4 shrink-0" />
                      <span>{committeeInfo.roleLabel}</span>
                      <span className="text-[11px] text-slate-500 font-mono">• SK Kepala Sekolah</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Dual-Role Account Switcher Card */}
              {isDualRoleUser && onSwitchRoleMode && (
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        <SagaRoleSwitchIcon className="w-5 h-5 text-[#0D5C46]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-xs sm:text-sm text-[#0F172A]">Akses Peran Ganda</h3>
                        <p className="text-xs text-slate-600">
                          Sedang aktif: <strong className="text-[#0D5C46]">Mode Guru Pendidik</strong>
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0D5C46] border border-emerald-200 shrink-0">
                      Dual-Role
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Akun Anda memiliki hak akses administratif sekolah. Anda dapat beralih ke panel pengelolaan kapan saja.
                  </p>
                  <button
                    type="button"
                    onClick={onSwitchRoleMode}
                    className="w-full min-h-12 py-2.5 px-4 bg-[#0D5C46] hover:bg-[#094736] text-white font-bold rounded-xl text-xs sm:text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <SagaRoleSwitchIcon tone="dark" className="w-4 h-4 shrink-0" />
                    <span>Beralih ke Mode Admin / Operator</span>
                  </button>
                </div>
              )}

              {/* Teacher Education & Guidance Card */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-emerald-200 flex items-center justify-center shrink-0">
                      <SagaBookMaterialIcon className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-[#0F172A]">Pusat Edukasi &amp; Panduan Presensi</h3>
                      <p className="text-xs text-slate-600">Tips GPS, sidik jari HP, dan perolehan poin disiplin</p>
                    </div>
                  </div>
                  <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#0D5C46] border border-emerald-200 shrink-0">
                    Panduan
                  </span>
                </div>

                {/* Quick 4-Card Shortcut */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEducationLayer('QR', 'AKUN')}
                    className="min-h-20 p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center"
                  >
                    <SagaScanQrIcon className="w-6 h-6 text-[#0D5C46]" />
                    <span className="text-xs font-bold text-[#0F172A] leading-tight block">Scan QR &amp; GPS</span>
                    <span className="text-[11px] text-[#0D5C46] font-medium block leading-tight">Tips Akurasi</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEducationLayer('BIOMETRIC', 'AKUN')}
                    className="min-h-20 p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center"
                  >
                    <SagaFingerprintIcon className="w-6 h-6 text-[#0D5C46]" />
                    <span className="text-xs font-bold text-[#0F172A] leading-tight block">Sidik Jari HP</span>
                    <span className="text-[11px] text-[#0D5C46] font-medium block leading-tight">Privasi Aman</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEducationLayer('POINTS', 'AKUN')}
                    className="min-h-20 p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center"
                  >
                    <SagaChallengeTrophyIcon className="w-6 h-6" />
                    <span className="text-xs font-bold text-[#0F172A] leading-tight block">Poin Disiplin</span>
                    <span className="text-[11px] text-[#0D5C46] font-medium block leading-tight">Lencana Guru</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleOpenEducationLayer('SECURITY', 'AKUN')}
                    className="min-h-20 p-2.5 rounded-xl bg-white hover:bg-emerald-50 border border-emerald-200 transition-colors cursor-pointer flex flex-col items-center justify-center gap-1.5 text-center"
                  >
                    <SagaDeviceShieldIcon className="w-6 h-6" />
                    <span className="text-xs font-bold text-[#0F172A] leading-tight block">Privasi &amp; Aman</span>
                    <span className="text-[11px] text-[#0D5C46] font-medium block leading-tight">Perlindungan Data</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => handleOpenEducationLayer('QR', 'AKUN')}
                  className="w-full min-h-11 py-2.5 px-4 bg-[#0D5C46] hover:bg-[#094736] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <SagaBookMaterialIcon tone="dark" className="w-4 h-4 shrink-0" />
                  <span>Buka Panduan Lengkap &amp; Solusi Kendala</span>
                </button>
              </div>

              {/* Device Binding Status Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                  <span className="font-bold text-[#0F172A] text-xs sm:text-sm flex items-center gap-2">
                    <SagaDeviceShieldIcon className="w-5 h-5 shrink-0" />
                    <span>Keamanan Perangkat (1 Akun = 1 HP)</span>
                  </span>
                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border shrink-0 ${
                    Boolean(effectiveUser?.full_name) && effectiveUser.full_name.toLowerCase().includes('dafa maulana')
                      ? 'bg-sky-100 text-sky-900 border-sky-300'
                      : deviceBindingStatus.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                      : deviceBindingStatus.status === 'DIFFERENT_DEVICE'
                      ? 'bg-red-100 text-red-900 border-red-300'
                      : deviceBindingStatus.status === 'UNAVAILABLE'
                      ? 'bg-orange-100 text-orange-900 border-orange-300'
                      : 'bg-amber-100 text-amber-900 border-amber-300'
                  }`}>
                    {Boolean(effectiveUser?.full_name) && effectiveUser.full_name.toLowerCase().includes('dafa maulana')
                      ? 'MULTI-PERANGKAT'
                      : deviceBindingStatus.status === 'ACTIVE'
                      ? 'TERIKAT AKTIF (1 HP)'
                      : deviceBindingStatus.status === 'DIFFERENT_DEVICE'
                      ? 'HP BERBEDA (DIBLOKIR)'
                      : deviceBindingStatus.status === 'UNAVAILABLE'
                      ? 'TIDAK TERVERIFIKASI'
                      : 'PERLU BINDING'}
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {deviceBindingStatus.message}
                </p>

                <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-0.5">
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
                    className="min-h-11 px-3 bg-white hover:bg-slate-100 text-[#0F172A] font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <SagaRoleSwitchIcon className="w-4 h-4 text-[#0D5C46] shrink-0" />
                    <span>Sinkron Ulang HP</span>
                  </button>
                </div>
              </div>

              {/* Biometric Fingerprint HP Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                  <span className="font-bold text-[#0F172A] text-xs sm:text-sm flex items-center gap-2">
                    <SagaFingerprintIcon className="w-5 h-5 text-[#0D5C46] shrink-0" />
                    <span>Sidik Jari HP Guru (Biometrik)</span>
                  </span>
                  <span className={`px-2.5 py-0.5 text-[11px] font-bold rounded-full border shrink-0 inline-flex items-center gap-1 ${
                    isBioEnrolled ? 'bg-emerald-100 text-emerald-900 border-emerald-300' : 'bg-slate-200 text-slate-700 border-slate-300'
                  }`}>
                    {isBioEnrolled && <SagaCheckBadgeIcon className="w-3.5 h-3.5 shrink-0" />}
                    <span>{isBioEnrolled ? 'TERDAFTAR DI HP INI' : 'BELUM TERDAFTAR'}</span>
                  </span>
                </div>

                <p className="text-xs text-slate-600 font-medium leading-relaxed bg-white p-3 rounded-xl border border-slate-200">
                  {isBioEnrolled
                    ? 'Sensor sidik jari HP Anda aktif dan siap digunakan untuk presensi masuk & pulang saat berada di area sekolah.'
                    : 'Daftarkan sidik jari HP ini agar Anda bisa langsung absen dengan menyentuh sensor fingerprint HP tanpa perlu scan QR.'}
                </p>

                <div className="flex justify-end gap-2 pt-0.5">
                  <button
                    type="button"
                    onClick={handleOpenBiometricModal}
                    className="min-h-11 px-3.5 bg-[#0D5C46] hover:bg-[#094736] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center gap-1.5"
                  >
                    <SagaFingerprintIcon tone="dark" className="w-4 h-4 shrink-0" />
                    <span>{isBioEnrolled ? 'Uji Coba Sidik Jari' : 'Daftarkan Sidik Jari'}</span>
                  </button>
                </div>
              </div>

              {/* Unduh Aplikasi Native / PWA Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <SagaAppDownloadIcon className="w-5 h-5 shrink-0" />
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-[#0F172A]">Unduh Aplikasi SAGA</h3>
                      <p className="text-xs text-slate-600">Versi Android APK &amp; Windows PC (.exe)</p>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => window.dispatchEvent(new CustomEvent('smart_absensi_open_app_install'))}
                  className="w-full min-h-11 py-2.5 px-4 bg-white hover:bg-slate-100 text-[#0F172A] border border-slate-300 text-xs font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <SagaAppDownloadIcon className="w-4 h-4 shrink-0" />
                  <span>Pasang atau Unduh Aplikasi</span>
                </button>
              </div>

              {/* Teacher Appreciation Badge Showcase Section */}
              <div className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between gap-2 border-b border-amber-200/70 pb-2.5">
                  <div className="flex items-center gap-2.5">
                    <SagaMedalRankIcon className="w-6 h-6 shrink-0" />
                    <div>
                      <h3 className="font-bold text-xs sm:text-sm text-[#0F172A]">Lencana Penghargaan &amp; Apresiasi</h3>
                      <p className="text-xs text-slate-600">Monitoring performa disiplin internal sekolah</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 bg-amber-600 text-white text-xs font-bold rounded-xl shrink-0">
                    {effectiveTotalPoints} Poin
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  {appreciationScore.badges.map((badge) => (
                    <div
                      key={badge.id}
                      className={`p-3 rounded-2xl border space-y-1.5 ${
                        badge.isUnlocked
                          ? 'bg-white border-amber-300 text-[#0F172A]'
                          : 'bg-slate-50 border-slate-200 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        {badge.isUnlocked ? (
                          <SagaMedalRankIcon className="w-6 h-6 shrink-0" />
                        ) : (
                          <SagaChallengeTrophyIcon className="w-6 h-6 opacity-45 shrink-0" />
                        )}
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                          badge.isUnlocked
                            ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                            : 'bg-slate-100 text-slate-600 border-slate-200'
                        }`}>
                          {badge.isUnlocked ? 'TERBUKA' : `${badge.progressPercent}%`}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-[#0F172A] leading-tight pt-0.5">{badge.title}</h4>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{badge.description}</p>
                    </div>
                  ))}
                </div>

                <div className="p-3 bg-white rounded-xl border border-amber-200 text-xs text-slate-600 leading-relaxed flex items-start gap-2">
                  <SagaInfoCircleIcon className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    <b>Catatan Kepala Sekolah:</b> Poin dan lencana kehadiran dihitung otomatis untuk pertimbangan apresiasi periodik guru teladan sekolah.
                  </span>
                </div>
              </div>

              {/* Voice Announcement Audio & Customization Card */}
              <VoiceSettingsCard teacherName={effectiveUser.full_name} institutionName={settings.institution_name} />

              {/* Syarat & Ketentuan Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <SagaBookMaterialIcon className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-xs sm:text-sm text-[#0F172A]">Syarat &amp; Ketentuan Presensi</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#0D5C46] bg-emerald-100 px-2.5 py-0.5 rounded-full">
                    Resmi
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Aturan penggunaan presensi digital, geofence GPS, binding HP, serta tata cara pengajuan izin &amp; koreksi absen.
                </p>
                <button
                  type="button"
                  onClick={() => setIsTermsModalOpen(true)}
                  className="w-full min-h-11 py-2.5 px-4 bg-[#0D5C46] hover:bg-[#094736] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <SagaBookMaterialIcon tone="dark" className="w-4 h-4 shrink-0" />
                  <span>Lihat Syarat &amp; Ketentuan Lengkap</span>
                </button>
              </div>

              {/* Hasil Survei & Suara Guru Section */}
              <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SagaAspirationIcon className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-xs sm:text-sm text-[#0F172A]">Suara Guru &amp; Solusi Sekolah</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#0D5C46] bg-emerald-100 px-2.5 py-0.5 rounded-full shrink-0">
                    100% Anonim
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Evaluasi bersama seluruh pendidik, grafik tingkat kepuasan guru, serta langkah perbaikan nyata dari sekolah.
                </p>
                <button
                  type="button"
                  id="btn-guru-open-survey-analytics"
                  onClick={() => {
                    setSurveyAnalyticsReturnTarget('AKUN');
                    setActiveTab('BERANDA');
                    setBerandaLayer('SURVEY_ANALYTICS');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="w-full min-h-11 py-2.5 px-4 bg-[#0D5C46] hover:bg-[#094736] text-white text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <SagaAspirationIcon tone="dark" className="w-4 h-4 shrink-0" />
                  <span>Buka Suara Guru &amp; Solusi Sekolah</span>
                </button>
              </div>

              {/* Tentang Aplikasi & Pengembang Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <SagaInfoCircleIcon className="w-5 h-5 shrink-0" />
                    <span className="font-bold text-xs sm:text-sm text-[#0F172A]">Tentang Aplikasi &amp; Pengembang</span>
                  </div>
                  <span className="text-[11px] font-bold text-[#0F172A] bg-slate-200 px-2.5 py-0.5 rounded-full shrink-0">
                    Dafa Maulana, S.Pd
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Inovasi mandiri Guru Informatika bersama AI Agent Google Gemini / Antigravity. Dari scan barcode hingga biometrik sidik jari.
                </p>
                <button
                  type="button"
                  onClick={() => handleOpenAboutLayer('AKUN')}
                  className="w-full min-h-11 py-2.5 px-4 bg-white hover:bg-slate-100 text-[#0F172A] border border-slate-300 text-xs sm:text-sm font-bold rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <SagaInfoCircleIcon className="w-4 h-4 shrink-0" />
                  <span>Lihat Informasi &amp; Kisah Pengembang</span>
                </button>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-1">
                <Button
                  variant="secondary"
                  onClick={() => setIsChangePinOpen(true)}
                  leftIcon={<SagaKeyPinIcon className="w-4 h-4 text-[#0F172A]" />}
                  className="w-full text-xs sm:text-sm font-bold py-3 flex items-center justify-center gap-2 cursor-pointer rounded-xl min-h-12"
                >
                  Ubah PIN Keamanan 6-Digit
                </Button>

                <Button
                  variant="danger"
                  onClick={logout}
                  leftIcon={<SagaLogoutDoorIcon tone="dark" className="w-4 h-4" />}
                  className="w-full text-xs sm:text-sm font-bold py-3 flex items-center justify-center gap-2 cursor-pointer rounded-xl min-h-12"
                >
                  Keluar dari Akun
                </Button>
              </div>
            </div>
          </section>
          )
        )}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION DOCK (5-SLOT SUPER-APP) ── */}
      <GuruBottomNavBar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          if (tab === 'BERANDA') setBerandaLayer('HOME');
          if (tab === 'AKUN') setProfilSubView('MAIN');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onPressAbsen={handleOpenAttendanceChoice}
      />

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
          loadAllDataRef.current?.();
        }}
      />

      {/* Change PIN Modal */}
      <Modal isOpen={isChangePinOpen} onClose={() => setIsChangePinOpen(false)} title="Ubah PIN Keamanan 6-Digit">
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
        schedule={teachingSlots}
        user={effectiveUser}
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
          title={`Detail Presensi: ${selectedCalendarDay.dateStr}`}
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
                <SagaHolidayIcon className="w-5 h-5 shrink-0" />
                <span>{selectedCalendarDay.holidayDesc || 'Hari Libur Kerja / Akhir Pekan'}</span>
              </div>
            ) : (
              <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 font-bold flex items-center gap-2">
                <SagaInfoCircleIcon className="w-5 h-5 shrink-0" />
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
                className="text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                <SagaEditPencilIcon className="w-4 h-4 shrink-0" />
                <span>Ajukan Koreksi Tanggal Ini</span>
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
        hasFilledMoodToday={hasFilledMoodToday}
        hasSubmittedComplaintToday={hasSubmittedComplaintToday}
        hasAwardedMeritToday={hasAwardedMeritToday}
        hasRecordedDemeritToday={hasRecordedDemeritToday}
        onOpenComplaintModal={() => setIsComplaintModalOpen(true)}
        onOpenMoodModal={() => setIsMoodModalOpen(true)}
        onOpenVoiceSettings={() => setActiveTab('AKUN')}
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
        onOpenStudentBehaviorModal={(tab) => {
          setIsMoreFeaturesModalOpen(false);
          setStudentBehaviorInitialTab(tab || 'KEBAIKAN');
          setStudentBehaviorReturnTarget('HOME');
          setBerandaLayer('STUDENT_BEHAVIOR');
        }}
        onOpenEmergencyModal={() => setIsEmergencyModalOpen(true)}
        onOpenSarprasModal={() => setIsSarprasModalOpen(true)}
        onOpenExamCardModal={() => setIsExamCardModalOpen(true)}
        onOpenExamCreatorModal={() => setIsExamCreatorModalOpen(true)}
        onOpenQuestionCorrectionModal={() => setIsQuestionCorrectionModalOpen(true)}
        onOpenHomeroomModal={() => setIsHomeroomModalOpen(true)}
        onOpenAdministrationModal={() => {
          setIsMoreFeaturesModalOpen(false);
          setIsAdministrationModalOpen(true);
        }}
        onOpenAboutModal={() => {
          setIsMoreFeaturesModalOpen(false);
          handleOpenAboutLayer('HOME');
        }}
        onOpenTeacherBoard={() => {
          setIsMoreFeaturesModalOpen(false);
          setIsTeacherBoardOpen(true);
        }}
        onOpenGamePidModal={() => {
          setIsMoreFeaturesModalOpen(false);
          setGamePidReturnTarget('ALL_FEATURES');
          setBerandaLayer('GAME_PID');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* 📋 Papan Presensi Harian Guru — Read-Only, Semua Guru Bisa Lihat */}
      {isTeacherBoardOpen && (
        <React.Suspense fallback={null}>
          <TeacherDailyBoardModal
            isOpen={isTeacherBoardOpen}
            onClose={() => setIsTeacherBoardOpen(false)}
          />
        </React.Suspense>
      )}

      {/* 🎓 Ruang Wali Kelas (Pendataan & Verifikasi Rencana Lanjutan Siswa Kelas 9) */}
      <HomeroomModal
        isOpen={isHomeroomModalOpen}
        onClose={() => setIsHomeroomModalOpen(false)}
        user={effectiveUser}
        token={token || ''}
      />

      {/* ⚙️ Modal Kustomisasi 8 Ikon Menu Utama Guru */}
      <CustomizeQuickIconsModal
        isOpen={isCustomizeIconsModalOpen}
        onClose={() => setIsCustomizeIconsModalOpen(false)}
        currentIconIds={quickIconIds}
        onSave={handleSaveQuickIcons}
        currentUser={effectiveUser}
      />

      {/* 📦 Modal Inventaris Sarana & Prasarana (Khusus Wakasek Sarpras M. Iqbal Gustiawan) */}
      <SarprasInventoryModal
        isOpen={isSarprasModalOpen}
        onClose={() => setIsSarprasModalOpen(false)}
        currentUser={effectiveUser}
      />

      {/* 🚨 Panggilan Bantuan Darurat Kelas (SOS UKS / Piket) */}
      <ClassroomEmergencyModal
        isOpen={isEmergencyModalOpen}
        onClose={() => setIsEmergencyModalOpen(false)}
        currentUser={effectiveUser}
        teachingSlots={teachingSlots}
        dutyTeachersToday={fellowDutyTeachers.concat(todayDutyDetails ? [todayDutyDetails] : [])}
      />



      {/* 📁 Modal Pusat Administrasi Sekolah & KBM */}
      <AdministrationHubModal
        isOpen={isAdministrationModalOpen}
        onClose={() => setIsAdministrationModalOpen(false)}
        currentUser={effectiveUser}
        onOpenModule={(actionId) => {
          setIsAdministrationModalOpen(false);
          switch (actionId) {
            case 'buat_soal_ai':
              setIsExamCreatorModalOpen(true);
              break;
            case 'koreksi_soal':
              setIsQuestionCorrectionModalOpen(true);
              break;
            case 'exam_card':
              setIsExamCardModalOpen(true);
              break;
            case 'materials':
              setIsTeachingMaterialsModalOpen(true);
              break;
            case 'jadwal':
              setIsScheduleModalOpen(true);
              break;
            case 'classroom':
              setIsClassroomModalOpen(true);
              break;
            case 'direktori_siswa':
              setIsStudentDirectoryModalOpen(true);
              break;
            case 'homeroom_plan':
              setIsHomeroomModalOpen(true);
              break;
            case 'kalender':
              setIsEventsCalendarModalOpen(true);
              break;
            case 'exam_schedule':
              setIsExamScheduleReadOnly(effectiveUser?.role !== 'ADMIN' && !committeeInfo?.isCommittee);
              setExamScheduleInitialTab('proctors');
              setIsExamScheduleModalOpen(true);
              break;
            case 'rekap':
              setIsRecapModalOpen(true);
              break;
            case 'oral_exam':
              setOralExamReturnTarget(berandaLayer === 'ALL_FEATURES' ? 'ALL_FEATURES' : 'HOME');
              setActiveTab('BERANDA');
              setBerandaLayer('ORAL_EXAM');
              window.scrollTo({ top: 0, behavior: 'smooth' });
              break;
            default:
              break;
          }
        }}
      />

      {/* ⚙️ Modal Kontrol Periode Ujian & Kepanitiaan (Toggle On-Off & Waktu Berakhir Otomatis) */}
      <ExamPeriodSettingsModal
        isOpen={isExamPeriodModalOpen}
        onClose={() => setIsExamPeriodModalOpen(false)}
        onSettingsSaved={(_newSettings, newStatus) => {
          setExamPeriodStatus(newStatus);
        }}
      />

      {/* 📋 Modal Layer Jadwal Ujian & Pengawas AI (Hak Panitia / Mode Pratinjau Sekolah) */}
      {effectiveUser && (
        <ExamScheduleAndProctorModal
          isOpen={isExamScheduleModalOpen}
          onClose={() => setIsExamScheduleModalOpen(false)}
          currentUser={effectiveUser}
          initialLevel={selectedExamDutyLevel === 'SMA' ? 'SMA' : 'SMP'}
          initialTab={examScheduleInitialTab}
          readOnly={isExamScheduleReadOnly}
        />
      )}

      {/* 13. Terminal Presensi RFID Siswa 2 (Akses Cepat Guru Piket & Pengajar) */}
      <StudentRfidKioskModal
        isOpen={isStudentKioskOpen}
        onClose={() => setIsStudentKioskOpen(false)}
      />

      {/* Modal Pilihan Metode Presensi (Scan Barcode / QR vs Sidik Jari HP) */}
      <AttendanceMethodChoiceModal
        isOpen={isAttendanceChoiceModalOpen}
        onClose={() => setIsAttendanceChoiceModalOpen(false)}
        onSelectBiometric={handleOpenBiometricModal}
        onSelectQrScan={handleOpenScannerClick}
      />

      {/* Modal Pemblokiran Presensi & Panduan Perizinan Perangkat Transparan (Anti Hide Error) */}
      <AttendancePermissionBlockedModal
        isOpen={isPermissionBlockedModalOpen}
        onClose={() => setIsPermissionBlockedModalOpen(false)}
        requiresCamera={permissionBlockedRequiresCamera}
        onPermissionsSatisfied={() => {
          if (pendingAttendanceActionRef.current) {
            const action = pendingAttendanceActionRef.current;
            pendingAttendanceActionRef.current = null;
            action();
          }
        }}
      />

      {/* Modal Ajakan Pendaftaran Sidik Jari Saat Absensi Baru Dibuka */}
      <BiometricEnrollmentPromptModal
        isOpen={isBiometricPromptOpen}
        onClose={handleCloseBiometricPrompt}
        onSuccess={handleBiometricEnrollmentSuccess}
        user={effectiveUser}
      />

      {/* 13. Modal Presensi Sidik Jari HP Terintegrasi GPS Geofence */}
      <BiometricAttendanceModal
        isOpen={isBiometricModalOpen}
        onClose={() => setIsBiometricModalOpen(false)}
        settings={settings}
        user={effectiveUser}
        onSwitchToQR={() => {
          setIsBiometricModalOpen(false);
          onOpenScanner?.();
        }}
        onSuccess={() => {
          setIsBioEnrolled(true);
          loadAllDataRef.current?.();
          showToast('success', 'Presensi Sidik Jari Berhasil', 'Data kehadiran Anda telah tercatat.');
        }}
      />

      {/* 14. Modal Lencana Penghargaan & Apresiasi Kepsek (Layer Penjelasan & Peringkat) */}
      <TeacherDisciplineBadgeModal
        isOpen={isDisciplineBadgeModalOpen}
        onClose={() => setIsDisciplineBadgeModalOpen(false)}
        currentUser={effectiveUser}
        currentUserScore={appreciationScore ? { ...appreciationScore, totalPoints: effectiveTotalPoints } : undefined}
        allRegisteredTeachers={allRegisteredTeachers}
        allPointLogs={allTeacherPointLogs}
        initialPeriod={isCurrentCalendarMonth ? 'CURRENT_MONTH' : 'PREVIOUS_MONTH'}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* 14b. Modal Riwayat Pendapatan Poin Transparan Disiplin Guru */}
      <TeacherPointHistoryModal
        isOpen={isPointHistoryModalOpen}
        onClose={() => setIsPointHistoryModalOpen(false)}
        teacher={{
          ...effectiveUser,
          totalPoints: effectiveTotalPoints,
        }}
        pointHistory={pointHistory.length > 0 ? pointHistory : allTeacherPointLogs.filter((l) => l.user_id === effectiveUser?.id)}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />

      {/* 14c. Modal Papan Tantangan & Rekor Disiplin Pendidik (Duolingo Style) */}
      <TeacherChallengeModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        user={effectiveUser}
        streakInfo={streakInfo}
        quests={dailyQuests}
        appreciationScore={{ ...appreciationScore, totalPoints: effectiveTotalPoints }}
        onOpenQuestAction={handleOpenQuestAction}
        userRank={disciplineLeaderboard.currentUserRank ?? undefined}
        totalTeachers={disciplineLeaderboard.totalTeachers}
        selectedMonth={selectedMonth}
        selectedYear={selectedYear}
      />


      {/* 15. Modal Pop-up Apresiasi Kehormatan Juara 1, 2, dan 3 */}
      <TopDisciplineCelebrationModal
        isOpen={isCelebrationModalOpen && (disciplineLeaderboard?.currentUserRank ?? 99) <= 3}
        onClose={() => setIsCelebrationModalOpen(false)}
        onOpenLeaderboard={() => {
          setIsCelebrationModalOpen(false);
          setIsDisciplineBadgeModalOpen(true);
        }}
        rank={disciplineLeaderboard?.currentUserRank ?? 99}
        totalPoints={effectiveTotalPoints}
        user={effectiveUser}
        teacherData={disciplineLeaderboard?.leaderboard?.find((t) => t.isCurrentUser)}
        topTeachers={disciplineLeaderboard?.leaderboard?.slice(0, 3)}
        periodMonthYear={`${disciplineLeaderboard.monthName} ${disciplineLeaderboard.year}`}
      />

      {/* 15c. Modal Pop-up Promosi Pekan Inovasi Digital (Game PID) */}
      <GamePidPromoModal
        isOpen={isGamePidPromoOpen}
        onClose={() => setIsGamePidPromoOpen(false)}
        onOpenPortal={() => {
          setIsGamePidPromoOpen(false);
          setActiveTab('BERANDA');
          setGamePidReturnTarget('HOME');
          setBerandaLayer('GAME_PID');
        }}
        todayDateStr={todayDateStr}
      />

      {/* 15b. Modal Syarat & Ketentuan Kebijakan Presensi Wajib Datang & Pulang */}
      <AttendancePolicyAgreementModal
        isOpen={isPolicyModalOpen}
        onClose={() => setIsPolicyModalOpen(false)}
        user={effectiveUser}
        onAgreed={() => {
          loadAllDataRef.current?.();
          showToast('success', 'Pakta Integritas Disetujui', 'Kebijakan disiplin jam kepulangan resmi telah aktif.');
        }}
      />

      {/* 16. Modal Pengaturan Notifikasi & Suara Mobile-first */}
      <NotificationPreferencesModal
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
      />

      {/* 17. Modal Generator Kartu Ujian & Barcode Siswa (JsBarcode) */}
      <StudentExamCardModal
        isOpen={isExamCardModalOpen}
        onClose={() => setIsExamCardModalOpen(false)}
      />

      {/* 18. Layer Koreksi Soal & Input Nilai Siswa (GradeMaster In-App) */}
      <QuestionCorrectionModal
        isOpen={isQuestionCorrectionModalOpen}
        onClose={handleCloseQuestionCorrectionModal}
        currentUser={effectiveUser}
      />

      {/* ✨ Modal Pembuat Soal Otomatis AI, Kunci Jawaban & Kisi-Kisi (KOP SMPT Al-Ittihadiyah) */}
      {isExamCreatorModalOpen && (
        <React.Suspense fallback={null}>
          <ExamQuestionCreatorModal
            isOpen={isExamCreatorModalOpen}
            onClose={() => setIsExamCreatorModalOpen(false)}
            currentUser={effectiveUser}
            defaultViewMode="MOBILE"
            onOpenCorrectionWithSession={(_session) => {
              setIsQuestionCorrectionModalOpen(true);
            }}
          />
        </React.Suspense>
      )}

      {/* Indikator Status Koneksi & Antrean Sinkronisasi Dexie.js */}
      <OfflineSyncIndicator />
    </div>
  );
};
