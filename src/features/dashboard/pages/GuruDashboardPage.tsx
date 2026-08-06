import React, { useState, useEffect } from 'react';
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
import { TeachingScheduleModal } from '../../guru/components/TeachingScheduleModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { CONSTANTS } from '../../../config/constants';
import { handleAppError } from '../../../utils/error.utils';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';
import type {
  AttendanceRecord,
  HolidayRecord,
  UserProfile,
  SystemSettings,
  AppNotification,
  DeviceBindingCheckResult,
  LeaveRequest,
} from '../../../types/database.types';

export interface GuruDashboardPageProps {
  onOpenScanner?: () => void;
  onOpenLeaveForm?: () => void;
  onOpenCorrectionForm?: () => void;
  previewUser?: UserProfile;
  isPreviewMode?: boolean;
}

export const GuruDashboardPage: React.FC<GuruDashboardPageProps> = ({
  onOpenScanner,
  onOpenLeaveForm,
  onOpenCorrectionForm,
  previewUser,
  isPreviewMode = false,
}) => {
  const { user: authUser, token, logout, deviceUUID } = useAuthStore();
  const { showToast } = useToastStore();

  // Effective user: previewUser when in Preview Mode, otherwise authUser
  const effectiveUser: UserProfile = previewUser || authUser || {
    id: 'usr_guru_sample',
    nip: '198905202014021003',
    full_name: 'Dafa Maulana, S.Pd',
    phone_number: '081234567890',
    role: 'GURU',
    position: 'Guru Utama / Pendidik',
    avatar_url: null,
    is_active: true,
    created_at: new Date().toISOString(),
  };

  const [activeTab, setActiveTab] = useState<'BERANDA' | 'RIWAYAT' | 'NOTIFIKASI' | 'PROFIL'>('BERANDA');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

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

  // Leave History State (Sub-tab inside Riwayat)
  const [historySubTab, setHistorySubTab] = useState<'ATTENDANCE' | 'LEAVES'>('ATTENDANCE');
  const [userLeaves, setUserLeaves] = useState<LeaveRequest[]>([]);
  const [isLoadingLeaves, setIsLoadingLeaves] = useState(false);

  // Notifications List State (Backend-Driven)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deviceBindingStatus, setDeviceBindingStatus] = useState<DeviceBindingCheckResult>({
    status: 'ACTIVE',
    message: 'Memeriksa status perangkat...',
  });

  // Pre-scan GPS Health Status & Realtime Coordinates State
  const [gpsHealth, setGpsHealth] = useState<{ status: 'READY' | 'REFINING' | 'OFF'; text: string; accuracy?: number }>({
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

  // Load Settings, Today Attendance, Holidays, Monthly History, Notifications, & Device Binding
  useEffect(() => {
    const loadAllData = async () => {
      if (!effectiveUser) return;
      const provider = ProviderFactory.getProvider();
      const authToken = token || '';

      // 1. Settings
      try {
        const sysSettings = await provider.getSettings();
        if (sysSettings) setSettings(sysSettings);
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
      try {
        const holidays = await provider.getHolidays(authToken);
        const todayIso = new Date().toISOString().substring(0, 10);
        const holidayToday = (holidays || []).find((h) => h.date === todayIso);
        setTodayHoliday(holidayToday || null);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadHolidays', 'Gagal memuat data hari libur', false);
      }

      // 4. Monthly Attendance History
      setIsLoadingHistory(true);
      try {
        const history = await provider.getMonthlyAttendance(
          effectiveUser.id,
          String(selectedMonth),
          String(selectedYear),
          authToken
        );
        setAttendanceHistory(history || []);
      } catch (err) {
        handleAppError(err, 'GuruDashboard.loadMonthlyAttendance', 'Gagal memuat riwayat bulanan', false);
      } finally {
        setIsLoadingHistory(false);
      }

      // 5. Backend-Driven Notifications
      try {
        const notifs = await provider.getNotifications(effectiveUser.id, authToken);
        setNotifications(notifs || []);
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
    };

    loadAllData();

    const handleScannedEvent = () => loadAllData();
    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_records_updated', handleScannedEvent);
    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_records_updated', handleScannedEvent);
    };
  }, [effectiveUser?.id, token, selectedMonth, selectedYear, deviceUUID]);

  // Dynamic monthly attendance statistics calculation
  const totalDays = attendanceHistory.length;
  const hadirCount = attendanceHistory.filter((h) => h.status === 'HADIR').length;
  const terlambatCount = attendanceHistory.filter((h) => h.status === 'TERLAMBAT').length;

  const attendancePercentage = totalDays > 0
    ? (Math.round(((hadirCount + terlambatCount) / totalDays) * 1000) / 10).toFixed(1)
    : '0.0';

  const terlambatPercent = totalDays > 0 ? (terlambatCount / totalDays) * 100 : 0;

  const monthNamesIndonesian = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];
  const activeMonthName = monthNamesIndonesian[selectedMonth - 1] || 'Bulan Ini';

  const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 11) return '☀️ Selamat Pagi';
    if (hour < 15) return '🌤️ Selamat Siang';
    if (hour < 18) return '🌆 Selamat Sore';
    return '🌙 Selamat Malam';
  };

  const handleOpenScannerClick = () => {
    if (isPreviewMode) {
      showToast('warning', 'Mode Preview Terdeteksi', 'Scan QR nyata tidak tersedia dalam Mode Preview simulasi Admin.');
      return;
    }
    if (onOpenScanner) onOpenScanner();
  };

  const handleOpenLeaveModal = () => {
    if (onOpenLeaveForm) {
      onOpenLeaveForm();
    } else {
      setIsLeaveModalOpen(true);
    }
  };

  const handleOpenCorrectionModal = () => {
    if (onOpenCorrectionForm) {
      onOpenCorrectionForm();
    } else {
      setIsCorrectionModalOpen(true);
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    try {
      const provider = ProviderFactory.getProvider();
      const authToken = token || '';
      for (const n of notifications) {
        if (!n.is_read) {
          await provider.markNotificationAsRead(n.id, authToken);
        }
      }
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      showToast('info', 'Notifikasi Diperbarui', 'Semua notifikasi telah ditandai dibaca.');
    } catch (err) {
      handleAppError(err, 'GuruDashboard.markRead', 'Gagal memperbarui notifikasi');
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

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-28 text-[#023246]">
      {/* ── PREVIEW MODE WARNING BANNER ───────────────────────────────────── */}
      {isPreviewMode && (
        <div className="bg-purple-900 text-purple-100 px-4 py-2 text-xs font-bold text-center border-b border-purple-700 flex items-center justify-center gap-2">
          <span>⚠️</span> MODE PREVIEW GURU (ADMIN/KEPSEK ACCESS) — Menggunakan data simulasi guru.
        </div>
      )}

      {/* ── TOP NAV BAR (HEADER) ────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-3.5 sm:px-5 py-2.5 sm:py-3 bg-white border-b border-[#D4D4CE]/20 sticky top-0 z-30 shadow-2xs max-w-md mx-auto">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white p-0.5 border border-emerald-500/20 flex items-center justify-center shrink-0 shadow-sm ring-2 ring-emerald-50">
            <img src="/school-logo.png" alt="Logo SMP Terpadu Al-Ittihadiyah" className="w-full h-full object-contain rounded-full" />
          </div>
          <div className="min-w-0">
            <h1 className="font-black text-[#023246] text-xs sm:text-sm tracking-tight leading-tight uppercase truncate">
              Smart Absensi Guru
            </h1>
            <p className="text-[9px] sm:text-[10px] font-semibold text-slate-500 mt-0.5 truncate max-w-50 sm:max-w-xs">
              {settings.institution_name}
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('NOTIFIKASI')}
          className="relative p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer shrink-0"
          aria-label="Notifikasi"
        >
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-[#0D7A5F] rounded-full ring-2 ring-white" />
          )}
          <span className="text-base sm:text-lg">🔔</span>
        </button>
      </header>

      <main className="px-3 sm:px-4 pt-3 sm:pt-4 space-y-3 sm:space-y-4 max-w-md mx-auto">
        {/* ── TAB 1: BERANDA ──────────────────────────────────────────────── */}
        {activeTab === 'BERANDA' && (
          <>
            {/* 1. Top Profile Header Card */}
            <section className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs sm:shadow-card border border-[#D4D4CE]/30 flex items-center justify-between gap-3">
              <div className="space-y-0.5 min-w-0">
                <span className="text-[11px] sm:text-xs font-bold text-[#0D7A5F] flex items-center gap-1">
                  <span>{getTimeBasedGreeting()}</span>
                </span>
                <h2 className="text-sm sm:text-base font-extrabold text-[#023246] leading-snug truncate">
                  {effectiveUser.full_name}
                </h2>
                {effectiveUser.nip ? (
                  <p className="text-[11px] sm:text-xs font-medium text-slate-500 truncate">
                    NPP/NIP. {effectiveUser.nip}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-[#C8F2E0] text-[#0D7A5F] font-black text-lg sm:text-xl flex items-center justify-center shadow-inner border border-[#0D7A5F]/20">
                  {effectiveUser.full_name ? effectiveUser.full_name.charAt(0) : 'G'}
                </div>
                <button
                  onClick={() => setActiveTab('PROFIL')}
                  className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-[#023246] text-[9px] sm:text-[10px] font-bold rounded-full border border-slate-200 transition-colors cursor-pointer"
                >
                  Profil
                </button>
              </div>
            </section>

            {/* 2. Today Attendance & Work Schedule Card */}
            <section className="bg-white rounded-2xl sm:rounded-3xl p-3.5 sm:p-4 shadow-xs sm:shadow-card border border-[#D4D4CE]/30 space-y-3 sm:space-y-3.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold text-[#0D7A5F] tracking-wider uppercase">
                    Status Presensi Hari Ini
                  </span>
                  <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-0.5">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                  </p>
                </div>

                {todayHoliday ? (
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
                  <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-[10px] sm:text-xs font-bold rounded-full border border-amber-200 shrink-0">
                    ⏳ Belum Presensi
                  </span>
                )}
              </div>

              {/* Dynamic Work Hours Display from Settings */}
              <div className="bg-[#F6F6F6] p-2.5 sm:p-3 rounded-xl sm:rounded-2xl flex items-center justify-between text-xs border border-slate-200/60">
                <div className="space-y-0.5">
                  <span className="text-slate-500 font-bold block text-[9px] sm:text-[10px] uppercase">Batas Absen Masuk</span>
                  <span className="font-black text-[#023246] text-xs sm:text-sm">{settings.work_checkin_end} WIB</span>
                </div>
                <div className="h-7 w-px bg-slate-300 mx-1" />
                <div className="space-y-0.5 text-right">
                  <span className="text-slate-500 font-bold block text-[9px] sm:text-[10px] uppercase">Mulai Absen Pulang</span>
                  <span className="font-black text-[#023246] text-xs sm:text-sm">{settings.work_checkout_start} WIB</span>
                </div>
              </div>

              {/* Check-In / Check-Out Log Details */}
              <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs">
                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-emerald-50/60 border border-emerald-200/60 space-y-0.5">
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-emerald-800 uppercase block">Jam Masuk</span>
                  <p className="font-black text-emerald-950 text-sm sm:text-base">
                    {todayAttendance?.check_in_time ? todayAttendance.check_in_time.substring(0, 5) : '--:--'}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-emerald-700 font-semibold block truncate">
                    {todayAttendance?.check_in_time ? 'Terdaftar Valid' : 'Belum Absen'}
                  </span>
                </div>

                <div className="p-2.5 sm:p-3 rounded-xl sm:rounded-2xl bg-blue-50/60 border border-blue-200/60 space-y-0.5">
                  <span className="text-[9px] sm:text-[10px] font-extrabold text-blue-800 uppercase block">Jam Pulang</span>
                  <p className="font-black text-blue-950 text-sm sm:text-base">
                    {todayAttendance?.check_out_time ? todayAttendance.check_out_time.substring(0, 5) : '--:--'}
                  </p>
                  <span className="text-[9px] sm:text-[10px] text-blue-700 font-semibold block truncate">
                    {todayAttendance?.check_out_time ? 'Absen Pulang Selesai' : 'Belum Absen'}
                  </span>
                </div>
              </div>

              {/* Pre-Scan GPS Health Status Indicator & Camera Pre-Warm Handler */}
              <div className="flex items-center justify-between bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80 text-[11px] sm:text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1">
                  <span>📍 GPS Readiness:</span>
                </span>
                <span className={`font-extrabold flex items-center gap-1.5 ${
                  gpsHealth.status === 'READY' ? 'text-emerald-700' : 'text-amber-700 animate-pulse'
                }`}>
                  <span className={`w-2 h-2 rounded-full ${
                    gpsHealth.status === 'READY' ? 'bg-emerald-500' : 'bg-amber-500 animate-ping'
                  }`} />
                  <span>{gpsHealth.text}</span>
                </span>
              </div>

              {/* Live OpenStreetMap Preview Box under GPS Readiness */}
              <div className="space-y-1 pt-0.5">
                <div className="flex items-center justify-between text-[10px] sm:text-[11px] font-extrabold text-slate-700 px-0.5">
                  <span className="flex items-center gap-1">
                    <span>🗺️</span> Peta Lokasi Real-time Anda
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono">
                    {userCoords ? `±${Math.round(userCoords.accuracy)}m` : 'Mendeteksi...'}
                  </span>
                </div>
                <LiveLocationMap
                  userLat={userCoords?.latitude}
                  userLng={userCoords?.longitude}
                  schoolLat={settings.geofence_lat || CONSTANTS.DEFAULTS.GEOFENCE_LAT}
                  schoolLng={settings.geofence_lng || CONSTANTS.DEFAULTS.GEOFENCE_LNG}
                  allowedRadius={settings.geofence_radius || CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS}
                  accuracy={userCoords?.accuracy}
                  height="165px"
                />
              </div>

              {/* Action Button: Scan QR with Camera Pre-Warm */}
              <Button
                variant="primary"
                onClick={handleOpenScannerClick}
                onMouseEnter={() => {
                  import('html5-qrcode').catch(() => {});
                }}
                onTouchStart={() => {
                  import('html5-qrcode').catch(() => {});
                }}
                className="w-full py-3 text-xs sm:text-sm font-black shadow-md flex items-center justify-center gap-2 cursor-pointer rounded-xl sm:rounded-2xl"
              >
                <span>🔲</span> PINDAI QR CODE ABSENSI (SCANNER HP)
              </Button>
            </section>

            {/* 3. Quick Action Feature Grid */}
            <section className="grid grid-cols-3 gap-2 sm:gap-3">
              <button
                onClick={handleOpenLeaveModal}
                className="p-2.5 sm:p-4 bg-white hover:bg-slate-50 rounded-2xl sm:rounded-3xl border border-[#D4D4CE]/30 shadow-xs sm:shadow-card transition-all text-left flex flex-col items-start justify-between space-y-1.5 cursor-pointer group"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-base sm:text-xl font-bold group-hover:scale-105 transition-transform shrink-0">
                  📝
                </div>
                <div>
                  <h3 className="font-black text-[#023246] text-[11px] sm:text-xs leading-tight">Izin / Cuti</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium hidden sm:block">Sakit & Cuti</p>
                </div>
              </button>

              <button
                onClick={handleOpenCorrectionModal}
                className="p-2.5 sm:p-4 bg-white hover:bg-slate-50 rounded-2xl sm:rounded-3xl border border-[#D4D4CE]/30 shadow-xs sm:shadow-card transition-all text-left flex flex-col items-start justify-between space-y-1.5 cursor-pointer group"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-base sm:text-xl font-bold group-hover:scale-105 transition-transform shrink-0">
                  ✏️
                </div>
                <div>
                  <h3 className="font-black text-[#023246] text-[11px] sm:text-xs leading-tight">Koreksi Absen</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium hidden sm:block">Ke Admin</p>
                </div>
              </button>

              <button
                onClick={() => setIsScheduleModalOpen(true)}
                className="p-2.5 sm:p-4 bg-white hover:bg-slate-50 rounded-2xl sm:rounded-3xl border border-[#D4D4CE]/30 shadow-xs sm:shadow-card transition-all text-left flex flex-col items-start justify-between space-y-1.5 cursor-pointer group"
              >
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl bg-emerald-50 text-[#0D7A5F] flex items-center justify-center text-base sm:text-xl font-bold group-hover:scale-105 transition-transform shrink-0">
                  📅
                </div>
                <div>
                  <h3 className="font-black text-[#023246] text-[11px] sm:text-xs leading-tight">Jadwal Mengajar</h3>
                  <p className="text-[9px] sm:text-[10px] text-slate-500 font-medium hidden sm:block">Jam Kelas</p>
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

                  {/* Dynamic Stats Cards */}
                  <div className="grid grid-cols-2 gap-2.5 sm:gap-3 text-xs">
                    <div className="p-3 bg-[#C8F2E0]/40 rounded-xl sm:rounded-2xl border border-[#0D7A5F]/20 space-y-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-[#0D7A5F] block uppercase truncate">Kehadiran {activeMonthName}</span>
                      <p className="text-lg sm:text-xl font-black text-[#023246]">{attendancePercentage}%</p>
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block truncate">{hadirCount + terlambatCount} dari {totalDays} Hari</span>
                    </div>

                    <div className="p-3 bg-amber-50 rounded-xl sm:rounded-2xl border border-amber-200 space-y-0.5">
                      <span className="text-[9px] sm:text-[10px] font-bold text-amber-800 block uppercase">Terlambat</span>
                      <p className="text-lg sm:text-xl font-black text-amber-950">{terlambatCount} <span className="text-xs font-bold text-amber-700">Kali</span></p>
                      <span className="text-[9px] sm:text-[10px] text-slate-500 font-semibold block truncate">{terlambatPercent.toFixed(0)}% dari presensi</span>
                    </div>
                  </div>

                  {/* Detailed Attendance Log Table / List */}
                  <div className="space-y-2 pt-1">
                    <h3 className="text-[11px] font-extrabold text-slate-700 uppercase tracking-wider">Catatan Harian {activeMonthName} {selectedYear}</h3>
                    
                    {isLoadingHistory ? (
                      <SkeletonList count={4} />
                    ) : attendanceHistory.length === 0 ? (
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
                    <div className="p-2 bg-amber-50 rounded-xl border border-amber-200">
                      <span className="text-[9px] font-bold text-amber-800 uppercase block">Menunggu</span>
                      <p className="text-sm sm:text-base font-black text-amber-950">
                        {userLeaves.filter((l) => l.approval_status === 'PENDING').length}
                      </p>
                    </div>

                    <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-200">
                      <span className="text-[9px] font-bold text-emerald-800 uppercase block">Disetujui</span>
                      <p className="text-sm sm:text-base font-black text-emerald-950">
                        {userLeaves.filter((l) => l.approval_status === 'APPROVED').length}
                      </p>
                    </div>

                    <div className="p-2 bg-red-50 rounded-xl border border-red-200">
                      <span className="text-[9px] font-bold text-red-800 uppercase block">Ditolak</span>
                      <p className="text-sm sm:text-base font-black text-red-950">
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
                      className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border text-xs space-y-1 transition-all ${
                        !n.is_read ? 'bg-[#C8F2E0]/20 border-[#0D7A5F]/30' : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-[#023246] text-xs">{n.title}</h3>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#0D7A5F]" />}
                      </div>
                      <p className="text-[10px] sm:text-[11px] text-slate-600 font-medium leading-relaxed">{n.message}</p>
                      <span className="text-[9px] text-slate-400 font-mono block pt-0.5">{n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : 'Hari ini'}</span>
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
              <div className="text-center space-y-1.5 pb-3 border-b border-slate-100">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#C8F2E0] text-[#0D7A5F] font-black text-2xl sm:text-3xl flex items-center justify-center mx-auto shadow-inner border-2 border-[#0D7A5F]/20">
                  {effectiveUser.full_name ? effectiveUser.full_name.charAt(0) : 'G'}
                </div>
                <div>
                  <h2 className="font-black text-[#023246] text-base sm:text-lg">{effectiveUser.full_name}</h2>
                  <p className="text-[11px] sm:text-xs text-slate-500 font-semibold">{effectiveUser.position || 'Guru Pengajar'}</p>
                </div>
              </div>

              {/* Device Binding Status Section */}
              <div className="p-3 sm:p-4 rounded-xl sm:rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="font-bold text-slate-700 text-xs">📱 Binding HP</span>
                  <span className={`px-2 py-0.5 text-[9px] sm:text-[10px] font-black rounded-full border shrink-0 ${
                    deviceBindingStatus.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : deviceBindingStatus.status === 'DIFFERENT_DEVICE'
                      ? 'bg-red-100 text-red-800 border-red-300'
                      : 'bg-amber-100 text-amber-800 border-amber-300'
                  }`}>
                    {deviceBindingStatus.status === 'ACTIVE'
                      ? '🔒 TERIKAT AKTIF'
                      : deviceBindingStatus.status === 'DIFFERENT_DEVICE'
                      ? '⚠️ HP BERBEDA'
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

              {/* Action Buttons */}
              <div className="space-y-2 pt-1">
                <Button
                  variant="secondary"
                  onClick={() => setIsChangePinOpen(true)}
                  className="w-full text-xs font-extrabold py-2.5 flex items-center justify-center gap-2 cursor-pointer rounded-xl"
                >
                  <span>🔑</span> UBAH PIN KEAMANAN 6-DIGIT
                </Button>

                <Button
                  variant="danger"
                  onClick={logout}
                  className="w-full text-xs font-extrabold py-2.5 flex items-center justify-center gap-2 cursor-pointer rounded-xl"
                >
                  <span>🚪</span> KELUAR DARI AKUN (LOGOUT)
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION DOCK ──────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-md border-t border-[#D4D4CE]/30 px-2 py-1 z-40 shadow-lg">
        <div className="flex items-center justify-around relative">
          <button
            onClick={() => setActiveTab('BERANDA')}
            className={`flex flex-col items-center gap-0.5 text-[9px] sm:text-[10px] w-12 sm:w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'BERANDA' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-base sm:text-lg">🏠</span>
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('RIWAYAT')}
            className={`flex flex-col items-center gap-0.5 text-[9px] sm:text-[10px] w-12 sm:w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'RIWAYAT' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-base sm:text-lg">📊</span>
            <span>Riwayat</span>
          </button>

          {/* Center FAB Scanner Button */}
          <div className="relative -top-4 sm:-top-5 flex flex-col items-center">
            <button
              onClick={handleOpenScannerClick}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center text-lg sm:text-xl shadow-lg shadow-[#0D7A5F]/30 ring-3 ring-white active:scale-95 transition-transform cursor-pointer"
              title="Pindai QR Code"
            >
              🔲
            </button>
          </div>

          <button
            onClick={() => setActiveTab('NOTIFIKASI')}
            className={`flex flex-col items-center gap-0.5 text-[9px] sm:text-[10px] w-12 sm:w-14 py-1 transition-colors cursor-pointer relative ${
              activeTab === 'NOTIFIKASI' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            {unreadCount > 0 && <span className="absolute top-1 right-2.5 w-1.5 h-1.5 rounded-full bg-[#0D7A5F]" />}
            <span className="text-base sm:text-lg">🔔</span>
            <span>Notif</span>
          </button>

          <button
            onClick={() => setActiveTab('PROFIL')}
            className={`flex flex-col items-center gap-0.5 text-[9px] sm:text-[10px] w-12 sm:w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'PROFIL' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-base sm:text-lg">👤</span>
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
        onClose={() => setIsCorrectionModalOpen(false)}
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
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Masukkan 6 angka PIN baru"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Konfirmasi PIN Baru</label>
            <Input
              type="password"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Ulangi 6 angka PIN baru"
              required
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setIsChangePinOpen(false)}>
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
    </div>
  );
};
