import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { Sidebar } from '../../../components/ui/Sidebar';
import type { SidebarItem } from '../../../components/ui/Sidebar';
import { TeacherManagementTable } from '../../admin/components/TeacherManagementTable';
import { QRCodeGeneratorModal } from '../../admin/components/QRCodeGeneratorModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import { TopDashboardNavbar } from '../../../components/dashboard/TopDashboardNavbar';
import { ExecutiveDashboardOverview } from '../../../components/dashboard/ExecutiveDashboardOverview';
import { AnonymousComplaintManagement } from '../../admin/components/AnonymousComplaintManagement';
import { ComplaintRepository } from '../../../repositories/ComplaintRepository';
import { DevTestPage } from '../../admin/pages/DevTestPage';
import { getTodayDateInJakarta, isDateOffDay } from '../../../utils/time.utils';
import { isDevTestModeEnabled } from '../../../utils/dev-test.utils';
import { AnalyticsService } from '../../../services/analytics.service';
import type { HistoricalUnabsentedRecord } from '../../../services/analytics.service';
import type { LeaveRequest, UserProfile, AttendanceRecord, HolidayRecord, SystemSettings } from '../../../types/database.types';
import { useCrossDeviceSync } from '../../../hooks/useCrossDeviceSync';
import { useLiveAttendanceSync } from '../../../hooks/useLiveAttendanceSync';
import { CONSTANTS } from '../../../config/constants';
import { BiometricAttendanceModal } from '../../guru/components/BiometricAttendanceModal';
import { QrCodeScanIcon } from '../../../components/ui/QrCodeScanIcon';
import { NotificationPermissionBanner } from '../../../components/dashboard/NotificationPermissionBanner';
import { NotificationPreferencesModal } from '../../../components/dashboard/NotificationPreferencesModal';
import { KepsekRewardSuggestionModal } from '../components/KepsekRewardSuggestionModal';
import { TeacherExcellenceCertificateModal } from '../../guru/components/TeacherExcellenceCertificateModal';
import { SarprasExecutiveView } from '../../sarpras/components/SarprasExecutiveView';
import {
  getTeacherDisciplineLeaderboard,
  type TeacherLeaderboardItem,
} from '../../../utils/teacher-appreciation.utils';
import type { TeacherPointLog } from '../../../types/database.types';

export interface KepsekDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const KepsekDashboardPage: React.FC<KepsekDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, logout } = useAuthStore();
  const { showToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [isPreferencesModalOpen, setIsPreferencesModalOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [pendingComplaintsCount, setPendingComplaintsCount] = useState<number>(0);

  // Status absensi pribadi Kepala Sekolah hari ini
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoadingMyAttendance, setIsLoadingMyAttendance] = useState(false);

  // Leaderboard Poin & Juara 1 Apresiasi States (Hak Prerogatif Kepala Sekolah)
  const [allTeacherPointLogs, setAllTeacherPointLogs] = useState<TeacherPointLog[]>([]);
  const [championTeacher, setChampionTeacher] = useState<TeacherLeaderboardItem | null>(null);
  const [isRewardModalOpen, setIsRewardModalOpen] = useState(false);
  const [isCertificateModalOpen, setIsCertificateModalOpen] = useState(false);
  const [savedChampionReward, setSavedChampionReward] = useState<string | null>(null);

  // Settings for Geofence & Work Hours
  const [settings, setSettings] = useState<SystemSettings>({
    app_name: 'Smart Absensi Guru',
    institution_name: 'SMK Smart Absensi',
    work_checkin_start: CONSTANTS.DEFAULTS.WORK_CHECKIN_START,
    work_checkin_end: CONSTANTS.DEFAULTS.WORK_CHECKIN_END,
    work_checkout_start: CONSTANTS.DEFAULTS.WORK_CHECKOUT_START,
    friday_checkout_start: CONSTANTS.DEFAULTS.FRIDAY_CHECKOUT_START,
    saturday_is_holiday: CONSTANTS.DEFAULTS.SATURDAY_IS_HOLIDAY,
    sunday_is_holiday: CONSTANTS.DEFAULTS.SUNDAY_IS_HOLIDAY,
    geofence_lat: CONSTANTS.DEFAULTS.GEOFENCE_LAT,
    geofence_lng: CONSTANTS.DEFAULTS.GEOFENCE_LNG,
    geofence_radius: CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS,
  });

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const st = await ProviderFactory.getProvider().getSettings();
        if (st) setSettings(st);
      } catch (err) {
        console.warn('Gagal memuat pengaturan kepsek:', err);
      }
    };
    loadSettings();
    window.addEventListener('smart_absensi_settings_updated', loadSettings);
    return () => window.removeEventListener('smart_absensi_settings_updated', loadSettings);
  }, []);

  // Memuat Buku Besar Poin Guru & Menentukan Juara 1 Bulan Ini
  useEffect(() => {
    const fetchPointLogs = async () => {
      try {
        const provider = ProviderFactory.getProvider();
        const logs = await provider.getTeacherPointHistory('ALL');
        setAllTeacherPointLogs(logs || []);
      } catch (err) {
        console.warn('Gagal memuat buku besar poin guru:', err);
      }
    };
    fetchPointLogs();
    window.addEventListener('smart_absensi_points_updated', fetchPointLogs);
    return () => window.removeEventListener('smart_absensi_points_updated', fetchPointLogs);
  }, []);

  // Evaluasi Juara 1 & Popup Otomatis ke Kepala Sekolah
  useEffect(() => {
    const res = getTeacherDisciplineLeaderboard(
      null,
      {
        totalPoints: 0,
        level: '',
        nextLevelPoints: 0,
        levelProgressPercent: 0,
        hadirTepatWaktuCount: 0,
        terlambatCount: 0,
        piketCount: 0,
        moodCheckinCount: 0,
        badges: [],
        pointHistory: [],
      },
      'CURRENT_MONTH',
      allTeacherPointLogs
    );

    const top1 = res.leaderboard?.[0] || null;
    setChampionTeacher(top1);

    // Cek Hadiah Tersimpan
    const periodKey = 'September_2026';
    const storageKey = `smart_absensi_kepsek_reward_champion_${periodKey}`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.rewardText) setSavedChampionReward(parsed.rewardText);
      } else if (top1) {
        // Otomatis munculkan popup saran hadiah ke Kepala Sekolah saat login jika belum ditentukan
        const popupSessionKey = `smart_absensi_kepsek_popup_shown_${periodKey}`;
        const hasShown = sessionStorage.getItem(popupSessionKey);
        if (!hasShown) {
          setIsRewardModalOpen(true);
          sessionStorage.setItem(popupSessionKey, 'true');
        }
      }
    } catch {
      // Ignored
    }
  }, [allTeacherPointLogs]);

  const fetchMyAttendance = useCallback(async () => {
    if (!user) return;
    setIsLoadingMyAttendance(true);
    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      const record = await provider.getTodayAttendance(user.id, token);
      setTodayAttendance(record);
    } catch (err) {
      console.warn('Gagal memuat absensi pribadi kepsek:', err);
    } finally {
      setIsLoadingMyAttendance(false);
    }
  }, [user]);

  useEffect(() => {
    fetchMyAttendance();
  }, [fetchMyAttendance]);

  const fetchComplaintsCount = async () => {
    try {
      const tkn = useAuthStore.getState().token;
      const list = await ComplaintRepository.getAllComplaints(tkn || undefined);
      const unhandled = list.filter((c) => c.status === 'SUBMITTED' || c.status === 'IN_REVIEW');
      setPendingComplaintsCount(unhandled.length);
    } catch (err) {
      console.warn('Gagal memuat count keluhan kepsek:', err);
    }
  };

  // Data Source Sync Status States
  const [dataSyncStatus, setDataSyncStatus] = useState<'LIVE' | 'OFFLINE_CACHED' | 'ERROR_FALLBACK'>(() => {
    const saved = localStorage.getItem('smart_absensi_teachers');
    return saved ? 'OFFLINE_CACHED' : 'ERROR_FALLBACK';
  });
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Attendance Records Sync Status States
  const [attendanceSyncStatus, setAttendanceSyncStatus] = useState<'SYNCED' | 'ERROR' | 'SYNCING'>('SYNCED');
  const [attendanceErrorMsg, setAttendanceErrorMsg] = useState<string | null>(null);
  const [attendanceLastSynced, setAttendanceLastSynced] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('smart_absensi_teachers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved teachers:', e);
      }
    }
    return [
      {
        id: 'usr_1001',
        nip: null,
        full_name: 'Ahmad Hidayat, S.Pd.',
        phone_number: '081234567890',
        role: 'GURU',
        position: 'Guru Matematika Utama',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_1002',
        nip: null,
        full_name: 'Budi Santoso, M.Pd.',
        phone_number: '081398765432',
        role: 'GURU',
        position: 'Guru Fisika',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];
  });

  const handleTeachersChange = (updated: UserProfile[]) => {
    setTeachers(updated);
    localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
    window.dispatchEvent(new Event('smart_absensi_teachers_updated'));
  };

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  const fetchPendingRequests = async () => {
    try {
      const tkn = useAuthStore.getState().token || '';
      if (tkn) {
        const fetched = await LeaveRepository.getAllLeaves(tkn);
        setAllLeaves(fetched || []);
        setPendingRequests(
          (fetched || []).filter(
            (r) => r.approval_status === 'PENDING' || r.approval_status === 'SUBMITTED' || r.approval_status === 'UNDER_REVIEW' || !r.approval_status
          )
        );
      }
    } catch (err) {
      console.warn('Gagal memuat pengajuan izin:', err);
    }
  };

  const fetchAttendanceRecords = async () => {
    setAttendanceSyncStatus('SYNCING');
    try {
      const provider = ProviderFactory.getProvider();
      const tkn = useAuthStore.getState().token || '';
      if (tkn) {
        const todayStr = getTodayDateInJakarta();
        const records = await provider.getDailyAttendance(todayStr, tkn);
        setAttendanceRecords(records || []);
        setAttendanceSyncStatus('SYNCED');
        setAttendanceErrorMsg(null);
        setAttendanceLastSynced(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err: unknown) {
      console.warn('Kepsek fetch attendance records error:', err);
      setAttendanceSyncStatus('ERROR');
      const friendlyMsg = err instanceof Error ? err.message : 'Koneksi database presensi terganggu.';
      setAttendanceErrorMsg(friendlyMsg);
      showToast(
        'error',
        'Gagal Memuat Presensi Hari Ini',
        'Data presensi harian gagal diperbarui dari server database.'
      );
    }
  };

  const fetchUsersFromBackend = async () => {
    setIsSyncing(true);
    try {
      const provider = ProviderFactory.getProvider();
      const tkn = useAuthStore.getState().token || '';
      const fetched = await provider.getAllUsers(tkn);
      if (fetched && fetched.length > 0) {
        setTeachers(fetched);
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(fetched));
        setDataSyncStatus('LIVE');
        setLastSyncedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      } else {
        const saved = localStorage.getItem('smart_absensi_teachers');
        setDataSyncStatus(saved ? 'OFFLINE_CACHED' : 'ERROR_FALLBACK');
      }
    } catch (err: unknown) {
      console.warn('Backend fetch users fallback:', err);
      const saved = localStorage.getItem('smart_absensi_teachers');
      setDataSyncStatus(saved ? 'OFFLINE_CACHED' : 'ERROR_FALLBACK');
      showToast(
        'warning',
        'Gagal Memuat Data Server Terupdate',
        'Sistem beralih ke data offline/cache lokal. Data mungkin tidak 100% realtime.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualRefresh = useCallback(() => {
    fetchUsersFromBackend();
    fetchPendingRequests();
    fetchAttendanceRecords();
    fetchComplaintsCount();
  }, []);

  useEffect(() => {
    const handleSyncTeachers = () => {
      const saved = localStorage.getItem('smart_absensi_teachers');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setTeachers(parsed);
        } catch (e) {
          console.error('Failed to parse teachers:', e);
        }
      } else {
        fetchUsersFromBackend();
      }
    };

    const handleLeaveUpdated = () => {
      fetchPendingRequests();
      fetchAttendanceRecords();
    };

    const handleComplaintsUpdated = () => {
      fetchComplaintsCount();
    };

    fetchUsersFromBackend();
    fetchPendingRequests();
    fetchAttendanceRecords();
    fetchComplaintsCount();

    const handleScannedEvent = () => {
      fetchAttendanceRecords();
      fetchComplaintsCount();
    };

    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_records_updated', handleScannedEvent);
    window.addEventListener('smart_absensi_leave_updated', handleLeaveUpdated);
    window.addEventListener('smart_absensi_leaves_updated', handleLeaveUpdated);
    window.addEventListener('smart_absensi_teachers_updated', handleSyncTeachers);
    window.addEventListener('smart_absensi_complaints_updated', handleComplaintsUpdated);
    window.addEventListener('storage', handleSyncTeachers);
    window.addEventListener('storage', handleLeaveUpdated);
    window.addEventListener('storage', handleComplaintsUpdated);

    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_records_updated', handleScannedEvent);
      window.removeEventListener('smart_absensi_leave_updated', handleLeaveUpdated);
      window.removeEventListener('smart_absensi_leaves_updated', handleLeaveUpdated);
      window.removeEventListener('smart_absensi_teachers_updated', handleSyncTeachers);
      window.removeEventListener('smart_absensi_complaints_updated', handleComplaintsUpdated);
      window.removeEventListener('storage', handleSyncTeachers);
      window.removeEventListener('storage', handleLeaveUpdated);
      window.removeEventListener('storage', handleComplaintsUpdated);
    };
  }, []);

  // Cross-device sync: auto-refresh data when Kepsek returns to the app
  useCrossDeviceSync({
    onSync: handleManualRefresh,
    cooldownMs: 30000,
    enabled: !!user?.id,
  });

  // Real-time Supabase channel & heartbeat live tracking sync for Kepsek
  useLiveAttendanceSync({
    onSync: handleManualRefresh,
    heartbeatIntervalMs: 30000,
    enabled: !!user?.id,
  });

  const [holidays, setHolidays] = useState<HolidayRecord[]>(() => {
    try {
      const saved = localStorage.getItem('smart_absensi_holidays');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const fetchHolidaysFromBackend = async () => {
    try {
      const provider = ProviderFactory.getProvider();
      const fetched = await provider.getHolidays();
      if (fetched) {
        setHolidays(fetched);
        localStorage.setItem('smart_absensi_holidays', JSON.stringify(fetched));
      }
    } catch (err) {
      console.warn('Kepsek fetch holidays error:', err);
    }
  };

  useEffect(() => {
    fetchHolidaysFromBackend();
    window.addEventListener('smart_absensi_holidays_updated', fetchHolidaysFromBackend);
    return () => window.removeEventListener('smart_absensi_holidays_updated', fetchHolidaysFromBackend);
  }, []);

  const todayStr = getTodayDateInJakarta();
  const [unabsentedFilterScope, setUnabsentedFilterScope] = useState<
    'TODAY' | 'PAST_DAYS' | 'ALFA' | 'ALL_7_DAYS'
  >('TODAY');

  // Dynamic calculation of active GURU teachers who haven't absented today (Returns [] on Weekends / Holidays)
  const unabsentedTeachers = AnalyticsService.getUnabsentedTeachers(
    todayStr,
    teachers,
    attendanceRecords,
    allLeaves,
    null,
    holidays
  );

  // Dynamic calculation of historical unabsented & ALFA teachers across the full month
  const historicalUnabsented: HistoricalUnabsentedRecord[] = useMemo(() => {
    return AnalyticsService.getHistoricalUnabsentedTeachers(
      teachers,
      attendanceRecords,
      allLeaves,
      null,
      holidays,
      'FULL_MONTH',
      todayStr
    );
  }, [teachers, attendanceRecords, allLeaves, holidays, todayStr]);

  const historicalPastOnly: HistoricalUnabsentedRecord[] = useMemo(() => {
    return historicalUnabsented.filter((h: HistoricalUnabsentedRecord) => h.date !== todayStr);
  }, [historicalUnabsented, todayStr]);

  const historicalAlfaOnly: HistoricalUnabsentedRecord[] = useMemo(() => {
    return historicalUnabsented.filter((h: HistoricalUnabsentedRecord) => h.status === 'ALFA');
  }, [historicalUnabsented]);

  const displayedUnabsentedList: HistoricalUnabsentedRecord[] = useMemo(() => {
    if (unabsentedFilterScope === 'TODAY') {
      return unabsentedTeachers.map((t) => ({
        date: todayStr,
        dayName: 'Hari Ini',
        dateFormatted: `Hari Ini (${todayStr})`,
        teacher: t,
        status: 'BELUM_ABSEN' as const,
      }));
    }
    if (unabsentedFilterScope === 'PAST_DAYS') {
      return historicalPastOnly;
    }
    if (unabsentedFilterScope === 'ALFA') {
      return historicalAlfaOnly;
    }
    return historicalUnabsented;
  }, [
    unabsentedFilterScope,
    unabsentedTeachers,
    todayStr,
    historicalPastOnly,
    historicalAlfaOnly,
    historicalUnabsented,
  ]);

  const hasKepsekCheckedIn = Boolean(
    todayAttendance && (todayAttendance.status === 'HADIR' || todayAttendance.status === 'TERLAMBAT' || todayAttendance.check_in_time)
  );

  const sidebarItems: SidebarItem[] = [
    {
      id: 'DASHBOARD',
      label: 'Dashboard',
      icon: '🏠',
    },
    {
      id: 'MY_ATTENDANCE',
      label: 'Absensi Pribadi',
      icon: '👆',
      badge: !hasKepsekCheckedIn && !isDateOffDay(new Date(), settings, holidays).isOff ? 1 : undefined,
      badgeVariant: 'RED',
    },
    {
      id: 'ACCOUNT_APPLICATIONS',
      label: 'Manajemen Guru & Staf',
      icon: '👥',
    },
    {
      id: 'COMPLAINTS',
      label: 'Kotak Aspirasi Guru',
      icon: '💬',
      badge: pendingComplaintsCount > 0 ? pendingComplaintsCount : undefined,
      badgeVariant: 'RED',
    },
    {
      id: 'APPROVALS',
      label: 'Persetujuan Izin/Cuti',
      icon: '📝',
      badge: pendingRequests.length > 0 ? pendingRequests.length : undefined,
      badgeVariant: 'RED',
      hasDropdown: true,
    },
    {
      id: 'UNABSENTED',
      label: 'Daftar Belum Absen',
      icon: '⚠️',
      badge: unabsentedTeachers.length > 0 ? unabsentedTeachers.length : undefined,
      badgeVariant: 'RED',
    },
    {
      id: 'SARPRAS',
      label: 'Inventaris Sarpras',
      icon: '📦',
    },
    ...(isDevTestModeEnabled() ? [{ id: 'DEV_TEST', label: 'Mode Tes Developer', icon: '🧪' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#023246] flex flex-col lg:flex-row dashboard-density-scaled overflow-x-hidden">
      {/* ── LEFT SIDEBAR PANEL (DESKTOP & MOBILE) ────────────────────────── */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title={user?.full_name || 'Kepala Sekolah'}
        roleBadge="👑 Executive Principal Access"
        roleColor="bg-[#287094]/30 text-[#F6F6F6] border-[#287094]"
        items={sidebarItems}
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as typeof activeTab)}
        onSwitchToGuruView={onSwitchToGuruView}
        onOpenScanner={onOpenScanner}
        onLogout={logout}
        isDesktopFixed={true}
      />

      {/* ── RIGHT MAIN CONTAINER ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-60">
        {/* Top Header Navbar */}
        <TopDashboardNavbar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onNavigateTab={(tab) => setActiveTab(tab as any)}
          onOpenPreferences={() => setIsPreferencesModalOpen(true)}
          onLogout={logout}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-3.5 sm:p-6 pb-28 sm:pb-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
          <NotificationPermissionBanner
            user={user || undefined}
            onOpenPreferences={() => setIsPreferencesModalOpen(true)}
          />

          {/* Data Source Sync Status Indicator Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-slate-700">Sumber Data:</span>
              {dataSyncStatus === 'LIVE' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live dari Server Database
                </span>
              )}
              {dataSyncStatus === 'OFFLINE_CACHED' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-extrabold text-[11px]">
                  <span>⚠️</span> Mode Offline / Cache Lokal
                </span>
              )}
              {dataSyncStatus === 'ERROR_FALLBACK' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 font-extrabold text-[11px]">
                  <span>🚫</span> Gagal Terhubung Server (Data Stub)
                </span>
              )}
              {lastSyncedTime && (
                <span className="text-[11px] text-slate-500 font-mono font-medium">
                  Terakhir diperbarui: {lastSyncedTime} WIB
                </span>
              )}
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isSyncing || attendanceSyncStatus === 'SYNCING'}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={isSyncing || attendanceSyncStatus === 'SYNCING' ? 'animate-spin' : ''}>🔄</span>
              {isSyncing || attendanceSyncStatus === 'SYNCING' ? 'Menyinkronkan...' : 'Sinkronkan Data Server'}
            </button>
          </div>

          {/* ATTENDANCE FETCH ERROR BANNER */}
          {attendanceSyncStatus === 'ERROR' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-lg shrink-0">
                  ⚠️
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-red-950">Gagal Memuat Data Presensi Server</h4>
                  <p className="text-xs text-red-700 font-medium mt-0.5">
                    {attendanceErrorMsg || 'Koneksi ke database presensi terganggu. Data presensi yang ditampilkan mungkin tidak terbaru.'}
                    {attendanceLastSynced && ` (Pembaruan terakhir: ${attendanceLastSynced} WIB)`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleManualRefresh}
                disabled={isSyncing}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition-all shrink-0"
              >
                🔄 Muat Ulang Presensi
              </button>
            </div>
          )}

          {/* BANNER APRESIASI RESMI JUARA 1 DISIPLIN GURU (HAK KEPALA SEKOLAH) */}
          {championTeacher && (
            <div className="p-4 rounded-3xl bg-linear-to-r from-[#023246] via-[#0A4158] to-[#18536B] text-white shadow-md flex flex-col md:flex-row md:items-center justify-between gap-3 border border-amber-400/40 animate-fade-in">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-300/40 flex items-center justify-center text-2xl shadow-inner shrink-0">
                  🥇
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] uppercase tracking-wider">
                      Juara 1 Disiplin Bulan Ini
                    </span>
                    <span className="text-xs text-amber-200 font-bold">
                      {championTeacher.totalPoints} PTS
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-black text-white truncate mt-0.5">
                    {championTeacher.name}
                  </h3>
                  <p className="text-xs text-slate-300 truncate">
                    {savedChampionReward
                      ? `🎁 Hadiah: ${savedChampionReward}`
                      : '⚠️ Hadiah khusus dari Kepala Sekolah belum ditentukan.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 pt-1 md:pt-0">
                <button
                  type="button"
                  onClick={() => setIsRewardModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-500 active:scale-95 text-slate-950 text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer shadow-xs"
                >
                  <span>🎁</span>
                  <span>{savedChampionReward ? 'Ubah Hadiah (AI ✨)' : 'Tetapkan Hadiah (AI ✨)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsCertificateModalOpen(true)}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 active:scale-95 text-white border border-white/20 text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  title="Lihat Piagam Penghargaan Juara 1"
                >
                  <span>📜</span>
                  <span>Cetak Piagam</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 1: EXECUTIVE DASHBOARD OVERVIEW (DEFAULT) */}
          {(activeTab === 'DASHBOARD' || activeTab === 'OVERVIEW') && (
            <ExecutiveDashboardOverview
              roleTitle="Kepala Sekolah"
              teachers={teachers}
              pendingRequests={pendingRequests}
              allLeaves={allLeaves}
              attendanceRecords={attendanceRecords}
              onOpenScanner={onOpenScanner}
              onOpenBiometric={() => setIsBiometricModalOpen(true)}
              onOpenQrGenerator={() => setIsQrGeneratorOpen(true)}
              onSwitchToGuruView={onSwitchToGuruView}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          )}

          {/* TAB: MY_ATTENDANCE (Absensi Pribadi Kepala Sekolah) */}
          {activeTab === 'MY_ATTENDANCE' && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 bg-[#287094]/10 text-[#287094] font-bold text-[11px] rounded-full border border-[#287094]/30">
                    Kartu Absensi Pribadi Kepala Sekolah
                  </span>
                  <h3 className="font-extrabold text-[#023246] text-lg">Absensi Harian Kepala Sekolah</h3>
                  <p className="text-xs text-slate-500">
                    Sebagai Pimpinan Sekolah, kehadiran Anda tercatat resmi dalam daftar presensi harian.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBiometricModalOpen(true)}
                    className="px-4 py-2 bg-[#023246] hover:bg-[#0D7A5F] text-white text-xs sm:text-sm font-bold rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                  >
                    <span>👆</span>
                    <span>Absen Sidik Jari HP</span>
                  </button>
                  {onOpenScanner && (
                    <button
                      type="button"
                      onClick={onOpenScanner}
                      className="px-4 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs sm:text-sm font-bold rounded-xl border border-slate-200 shadow-2xs transition-all flex items-center gap-2 cursor-pointer active:scale-95"
                    >
                      <QrCodeScanIcon className="w-4 h-4 text-[#023246]" />
                      <span>Scan QR Code</span>
                    </button>
                  )}
                </div>
              </div>

              {isLoadingMyAttendance ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-[#287094] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Status Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Status Kehadiran Hari Ini</p>
                      <p className="font-black text-[#023246] text-base">
                        {todayAttendance
                          ? todayAttendance.status === 'HADIR'
                            ? '✅ HADIR'
                            : todayAttendance.status === 'TERLAMBAT'
                              ? '⚠️ TERLAMBAT'
                              : `📋 ${todayAttendance.status}`
                          : isDateOffDay(new Date(), settings, holidays).isOff
                            ? '🏖️ LIBUR SEKOLAH'
                            : '⏳ BELUM ABSEN'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Jam Absen Masuk</p>
                      <p className="font-mono font-bold text-slate-800 text-base">
                        {todayAttendance?.check_in_time
                          ? `${todayAttendance.check_in_time} WIB`
                          : '-- : -- WIB'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Jam Absen Pulang</p>
                      <p className="font-mono font-bold text-slate-800 text-base">
                        {todayAttendance?.check_out_time
                          ? `${todayAttendance.check_out_time} WIB`
                          : '-- : -- WIB'}
                      </p>
                    </div>
                  </div>

                  {/* Extra info: distance & verification */}
                  {todayAttendance && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {todayAttendance.check_in_distance_meters != null && (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-200">
                          📍 Jarak: {todayAttendance.check_in_distance_meters.toFixed(0)}m dari sekolah
                        </span>
                      )}
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full border border-blue-200">
                        🔐 Verifikasi: {todayAttendance.verification_method === 'BIOMETRIC_GPS' ? '👆 Sidik Jari + GPS' : todayAttendance.verification_method === 'QR_GPS' ? 'QR + GPS' : todayAttendance.verification_method}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: ACCOUNT APPLICATIONS */}
          {(activeTab === 'ACCOUNT_APPLICATIONS' || activeTab === 'TEACHERS') && (
            <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} isReadOnly={true} />
          )}

          {/* TAB: COMPLAINTS (KOTAK ASPIRASI GURU) */}
          {activeTab === 'COMPLAINTS' && <AnonymousComplaintManagement role="KEPSEK" />}

          {/* TAB 3: APPROVALS */}
          {(activeTab === 'APPROVALS' || activeTab === 'APPROVAL') && (
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base">📝 Approval Pengajuan Izin / Cuti Guru</h3>
              <PendingApprovalWidget requests={allLeaves.length > 0 ? allLeaves : pendingRequests} teachers={teachers} onRefresh={fetchPendingRequests} />
            </div>
          )}

          {/* TAB 4: UNABSENTED (HARI INI & HARI-HARI KEMARIN) */}
          {activeTab === 'UNABSENTED' && (
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 font-extrabold text-[11px] rounded-full">
                      ⚠️ Monitoring Presensi
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Real-time &amp; Audit Riwayat</span>
                  </div>
                  <h3 className="font-extrabold text-[#023246] text-base mt-1">
                    Daftar Guru Belum Absen &amp; Tanpa Keterangan
                  </h3>
                  <p className="text-xs text-slate-500">
                    Memantau guru yang belum melakukan presensi atau berstatus tanpa keterangan (hari ini &amp; hari-hari kemarin).
                  </p>
                </div>
                <div className="flex items-center gap-1.5 self-start sm:self-auto">
                  <span className="px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-full font-extrabold text-xs">
                    {unabsentedTeachers.length} Belum Absen Hari Ini
                  </span>
                </div>
              </div>

              {/* Scope Sub-Filter Tabs */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs no-scrollbar">
                {[
                  { id: 'TODAY', label: `Hari Ini (${unabsentedTeachers.length})` },
                  { id: 'ALL_7_DAYS', label: `Bulan Ini: Semua (${historicalUnabsented.length})` },
                  { id: 'PAST_DAYS', label: `Hari-Hari Kemarin (${historicalPastOnly.length})` },
                  { id: 'ALFA', label: `Tanpa Keterangan (${historicalAlfaOnly.length})` },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setUnabsentedFilterScope(st.id as any)}
                    className={`px-3 py-1.5 rounded-xl font-bold transition-all whitespace-nowrap cursor-pointer ${
                      unabsentedFilterScope === st.id
                        ? 'bg-[#023246] text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* UNABSENTED LIST RENDERING */}
              {displayedUnabsentedList.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                  <span className="text-3xl block">🎉</span>
                  <p className="font-bold text-emerald-900 text-sm">Semua Presensi Tertib &amp; Lengkap</p>
                  <p className="text-xs text-emerald-700">
                    Tidak ada guru yang tercatat belum absen atau berstatus tanpa keterangan pada kategori ini.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {displayedUnabsentedList.map((item, idx) => (
                    <div
                      key={`${item.teacher.id}_${item.date}_${idx}`}
                      className={`p-3.5 rounded-2xl border flex flex-col justify-between gap-2.5 transition-all ${
                        item.status === 'ALFA'
                          ? 'bg-rose-50/40 border-rose-200/80'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                            {item.teacher.full_name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="font-bold text-slate-900 text-xs truncate">{item.teacher.full_name}</p>
                            <p className="text-[10px] text-slate-500 truncate">
                              NPP: {item.teacher.nip && !item.teacher.nip.startsWith('NIP_') ? item.teacher.nip : '-'} • {item.teacher.position || 'Guru Pengajar'}
                            </p>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[10px] shrink-0 border ${
                            item.status === 'ALFA'
                              ? 'bg-rose-100 text-rose-800 border-rose-300'
                              : 'bg-red-100 text-red-700 border-red-200'
                          }`}
                        >
                          {item.status === 'ALFA' ? '🚫 Tanpa Keterangan' : '⏳ Belum Absen'}
                        </span>
                      </div>

                      <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600 font-bold">
                        <span>📅 {item.dateFormatted}</span>
                        <span className="text-amber-800 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px]">
                          {item.dayName}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB: INVENTARIS SARANA DAN PRASARANA (SARPRAS) */}
          {activeTab === 'SARPRAS' && (
            <SarprasExecutiveView
              currentUser={user}
              onBackToDashboard={() => setActiveTab('DASHBOARD')}
            />
          )}

          {/* TAB 5: DEV TEST MODE */}
          {activeTab === 'DEV_TEST' && <DevTestPage onBackToDashboard={() => setActiveTab('DASHBOARD')} />}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ───────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-3 py-1 shadow-lg">
        <div className="flex items-center justify-around max-w-md mx-auto relative">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-all cursor-pointer active:scale-95 ${
              activeTab === 'DASHBOARD' || activeTab === 'OVERVIEW' ? 'text-[#023246] font-black scale-105' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('UNABSENTED')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-all cursor-pointer active:scale-95 ${
              activeTab === 'UNABSENTED' ? 'text-[#023246] font-black scale-105' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">⬡</span>
            <span>Live Tracking</span>
          </button>

          {/* Center FAB Scan QR Button */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={() => onOpenScanner && onOpenScanner()}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-tr from-[#023246] to-[#287094] text-white flex items-center justify-center text-xl shadow-lg shadow-[#023246]/30 ring-4 ring-white active:scale-95 transition-transform cursor-pointer"
              title="Scan QR Absensi"
            >
              📷
            </button>
            <span className="text-[9px] font-extrabold text-[#023246] mt-0.5">Scan QR</span>
          </div>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 relative transition-all cursor-pointer active:scale-95 ${
              activeTab === 'APPROVALS' || activeTab === 'APPROVAL' ? 'text-[#023246] font-black scale-105' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">☑️</span>
            <span>Approval</span>
            {pendingRequests.length > 0 ? (
              <span className="absolute top-0.5 right-2 px-1.5 py-0.2 text-[8px] font-black bg-red-500 text-white rounded-full min-w-4 text-center animate-pulse shadow-2xs">
                {pendingRequests.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 text-slate-400 font-semibold cursor-pointer active:scale-95 hover:text-[#023246]"
          >
            <span className="text-lg">🎛️</span>
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Official QR Code Poster Generator Modal */}
      <QRCodeGeneratorModal
        isOpen={isQrGeneratorOpen}
        onClose={() => setIsQrGeneratorOpen(false)}
      />

      {/* Modal Presensi Sidik Jari HP Terintegrasi GPS Geofence */}
      {user && (
        <BiometricAttendanceModal
          isOpen={isBiometricModalOpen}
          onClose={() => setIsBiometricModalOpen(false)}
          settings={settings}
          user={user}
          onSwitchToQR={() => {
            setIsBiometricModalOpen(false);
            onOpenScanner?.();
          }}
          onSuccess={() => {
            fetchMyAttendance();
            handleManualRefresh();
            showToast('success', 'Presensi Berhasil', 'Absensi Sidik Jari Kepala Sekolah berhasil dicatat.');
          }}
        />
      )}

      {/* Modal Pengaturan Notifikasi & Suara Mobile-first */}
      <NotificationPreferencesModal
        isOpen={isPreferencesModalOpen}
        onClose={() => setIsPreferencesModalOpen(false)}
      />

      {/* Modal Penetapan Hadiah Juara 1 Apresiasi Kepala Sekolah (Dengan AI) */}
      <KepsekRewardSuggestionModal
        isOpen={isRewardModalOpen}
        onClose={() => setIsRewardModalOpen(false)}
        championTeacher={championTeacher}
        periodMonthYear="September 2026"
        onRewardSaved={(rewardText) => setSavedChampionReward(rewardText)}
      />

      {/* Modal Pratinjau & Cetak Piagam Resmi Juara 1 */}
      {championTeacher && (
        <TeacherExcellenceCertificateModal
          isOpen={isCertificateModalOpen}
          onClose={() => setIsCertificateModalOpen(false)}
          user={{
            id: championTeacher.id,
            full_name: championTeacher.name,
            nip: championTeacher.nip || null,
            position: championTeacher.position || 'Pendidik Profesional',
            role: 'GURU',
            phone_number: '',
            avatar_url: null,
            is_active: true,
            created_at: '',
          }}
          periodMonthYear="September 2026"
          totalPoints={championTeacher.totalPoints}
          rank={1}
        />
      )}
    </div>
  );
};
