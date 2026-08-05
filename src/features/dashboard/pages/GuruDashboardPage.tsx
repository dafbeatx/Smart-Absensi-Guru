import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LeaveApplicationModal } from '../../leave/components/LeaveApplicationModal';
import { GuruCorrectionRequestModal } from '../../guru/components/GuruCorrectionRequestModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import { CONSTANTS } from '../../../config/constants';
import { handleAppError } from '../../../utils/error.utils';
import type {
  AttendanceRecord,
  HolidayRecord,
  UserProfile,
  SystemSettings,
  AppNotification,
  DeviceBindingCheckResult,
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

  // Notifications List State (Backend-Driven)
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [deviceBindingStatus, setDeviceBindingStatus] = useState<DeviceBindingCheckResult>({
    status: 'ACTIVE',
    message: 'Memeriksa status perangkat...',
  });

  // Pre-scan GPS Health Status State
  const [gpsHealth, setGpsHealth] = useState<{ status: 'READY' | 'REFINING' | 'OFF'; text: string; accuracy?: number }>({
    status: 'REFINING',
    text: '📍 Mengukur lokasi GPS...',
  });

  useEffect(() => {
    GPSService.startBackgroundWarmUp();
    setGpsHealth(GPSService.getGPSHealthStatus());

    const interval = setInterval(() => {
      setGpsHealth(GPSService.getGPSHealthStatus());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

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
    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
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
      <header className="flex items-center justify-between px-5 pt-5 pb-3 bg-white border-b border-[#D4D4CE]/20 sticky top-0 z-30 shadow-2xs max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#0D7A5F]/10 text-[#0D7A5F] font-black text-lg flex items-center justify-center border border-[#0D7A5F]/20">
            ∆
          </div>
          <div>
            <h1 className="font-black text-[#023246] text-sm tracking-tight leading-none uppercase">
              Smart Absensi Guru
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
              {settings.institution_name}
            </p>
          </div>
        </div>

        <button
          onClick={() => setActiveTab('NOTIFIKASI')}
          className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
          aria-label="Notifikasi"
        >
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-[#0D7A5F] rounded-full ring-2 ring-white" />
          )}
          <span className="text-lg">🔔</span>
        </button>
      </header>

      <main className="px-4 pt-4 space-y-4 max-w-md mx-auto">
        {/* ── TAB 1: BERANDA ──────────────────────────────────────────────── */}
        {activeTab === 'BERANDA' && (
          <>
            {/* 1. Top Profile Header Card */}
            <section className="bg-white rounded-3xl p-5 shadow-card border border-[#D4D4CE]/30 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-xs font-bold text-[#0D7A5F] flex items-center gap-1">
                  <span>{getTimeBasedGreeting()}</span>
                </span>
                <h2 className="text-xl font-extrabold text-[#023246] leading-snug">
                  {effectiveUser.full_name}
                </h2>
                {effectiveUser.nip ? (
                  <p className="text-xs font-medium text-slate-500">
                    NPP/NIP. {effectiveUser.nip}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-[#C8F2E0] text-[#0D7A5F] font-black text-2xl flex items-center justify-center shadow-inner border border-[#0D7A5F]/20">
                  {effectiveUser.full_name ? effectiveUser.full_name.charAt(0) : 'G'}
                </div>
                <button
                  onClick={() => setActiveTab('PROFIL')}
                  className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-[#023246] text-[10px] font-bold rounded-full border border-slate-200 transition-colors cursor-pointer"
                >
                  Profil Guru
                </button>
              </div>
            </section>

            {/* 2. Today Attendance & Work Schedule Card */}
            <section className="bg-white rounded-3xl p-5 shadow-card border border-[#D4D4CE]/30 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-extrabold text-[#0D7A5F] tracking-wider uppercase">
                    Status Presensi Hari Ini
                  </span>
                  <p className="text-xs text-slate-400 font-medium mt-0.5">
                    {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                </div>

                {todayHoliday ? (
                  <Badge status="SAKIT">🎉 {todayHoliday.name}</Badge>
                ) : todayAttendance ? (
                  <Badge status={todayAttendance.status}>
                    {todayAttendance.status === 'HADIR'
                      ? '✅ Hadir Tepat Waktu'
                      : todayAttendance.status === 'TERLAMBAT'
                      ? '⚠️ Terlambat'
                      : todayAttendance.status}
                  </Badge>
                ) : (
                  <span className="px-2.5 py-1 bg-amber-50 text-amber-700 text-xs font-bold rounded-full border border-amber-200">
                    ⏳ Belum Presensi
                  </span>
                )}
              </div>

              {/* Dynamic Work Hours Display from Settings */}
              <div className="bg-[#F6F6F6] p-3.5 rounded-2xl flex items-center justify-between text-xs border border-slate-200/60">
                <div className="space-y-0.5">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Batas Absen Masuk</span>
                  <span className="font-black text-[#023246] text-sm">{settings.work_checkin_end} WIB</span>
                </div>
                <div className="h-8 w-px bg-slate-300" />
                <div className="space-y-0.5 text-right">
                  <span className="text-slate-500 font-bold block text-[10px] uppercase">Mulai Absen Pulang</span>
                  <span className="font-black text-[#023246] text-sm">{settings.work_checkout_start} WIB</span>
                </div>
              </div>

              {/* Check-In / Check-Out Log Details */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200/60 space-y-1">
                  <span className="text-[10px] font-extrabold text-emerald-800 uppercase block">Jam Masuk</span>
                  <p className="font-black text-emerald-950 text-base">
                    {todayAttendance?.check_in_time ? todayAttendance.check_in_time.substring(0, 5) : '--:--'}
                  </p>
                  <span className="text-[10px] text-emerald-700 font-semibold block">
                    {todayAttendance?.check_in_time ? 'Terdaftar Valid' : 'Belum Absen Masuk'}
                  </span>
                </div>

                <div className="p-3 rounded-2xl bg-blue-50/60 border border-blue-200/60 space-y-1">
                  <span className="text-[10px] font-extrabold text-blue-800 uppercase block">Jam Pulang</span>
                  <p className="font-black text-blue-950 text-base">
                    {todayAttendance?.check_out_time ? todayAttendance.check_out_time.substring(0, 5) : '--:--'}
                  </p>
                  <span className="text-[10px] text-blue-700 font-semibold block">
                    {todayAttendance?.check_out_time ? 'Absen Pulang Selesai' : 'Belum Absen Pulang'}
                  </span>
                </div>
              </div>

              {/* Pre-Scan GPS Health Status Indicator & Camera Pre-Warm Handler */}
              <div className="flex items-center justify-between bg-slate-50 px-3.5 py-2 rounded-2xl border border-slate-200/80 text-xs">
                <span className="font-semibold text-slate-600 flex items-center gap-1.5">
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
                className="w-full py-3.5 text-xs font-black shadow-lg flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🔲</span> PINDAI QR CODE ABSENSI (SCANNER HP)
              </Button>
            </section>

            {/* 3. Quick Action Feature Grid */}
            <section className="grid grid-cols-2 gap-3">
              <button
                onClick={handleOpenLeaveModal}
                className="p-4 bg-white hover:bg-slate-50 rounded-3xl border border-[#D4D4CE]/30 shadow-card transition-all text-left space-y-2 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform">
                  📝
                </div>
                <div>
                  <h3 className="font-black text-[#023246] text-xs">Ajukan Izin / Cuti</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Sakit, Izin, Dinas & Cuti</p>
                </div>
              </button>

              <button
                onClick={handleOpenCorrectionModal}
                className="p-4 bg-white hover:bg-slate-50 rounded-3xl border border-[#D4D4CE]/30 shadow-card transition-all text-left space-y-2 cursor-pointer group"
              >
                <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl font-bold group-hover:scale-105 transition-transform">
                  ✏️
                </div>
                <div>
                  <h3 className="font-black text-[#023246] text-xs">Ajukan Koreksi Absen</h3>
                  <p className="text-[10px] text-slate-500 font-medium">Permohonan ke Admin</p>
                </div>
              </button>
            </section>
          </>
        )}

        {/* ── TAB 2: RIWAYAT BULANAN ──────────────────────────────────────── */}
        {activeTab === 'RIWAYAT' && (
          <section className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/30 shadow-card space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-black text-[#023246] text-base">Presensi & Statistik Bulanan</h2>
                  <p className="text-xs text-slate-400 font-semibold">Tampilkan data presensi per bulan</p>
                </div>

                {/* Dynamic Month / Year Filter Controls */}
                <div className="flex items-center gap-2">
                  <select
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-none"
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
                    className="text-xs font-bold bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-slate-700 outline-none"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                  </select>
                </div>
              </div>

              {/* Dynamic Stats Cards */}
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3.5 bg-[#C8F2E0]/40 rounded-2xl border border-[#0D7A5F]/20 space-y-1">
                  <span className="text-[10px] font-bold text-[#0D7A5F] block uppercase">Kehadiran {activeMonthName}</span>
                  <p className="text-xl font-black text-[#023246]">{attendancePercentage}%</p>
                  <span className="text-[10px] text-slate-500 font-semibold block">{hadirCount + terlambatCount} dari {totalDays} Hari Presensi</span>
                </div>

                <div className="p-3.5 bg-amber-50 rounded-2xl border border-amber-200 space-y-1">
                  <span className="text-[10px] font-bold text-amber-800 block uppercase">Terlambat</span>
                  <p className="text-xl font-black text-amber-950">{terlambatCount} <span className="text-xs font-bold text-amber-700">Kali</span></p>
                  <span className="text-[10px] text-slate-500 font-semibold block">{terlambatPercent.toFixed(0)}% dari presensi</span>
                </div>
              </div>

              {/* Detailed Attendance Log Table / List */}
              <div className="space-y-2 pt-2">
                <h3 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">Catatan Harian {activeMonthName} {selectedYear}</h3>
                
                {isLoadingHistory ? (
                  <div className="py-8 text-center text-slate-400 text-xs font-semibold animate-pulse">
                    Memuat riwayat bulanan...
                  </div>
                ) : attendanceHistory.length === 0 ? (
                  <div className="py-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400 text-xs font-semibold space-y-1">
                    <p className="text-lg">📭</p>
                    <p>Belum ada rekaman presensi pada {activeMonthName} {selectedYear}.</p>
                  </div>
                ) : (
                  attendanceHistory.map((rec) => (
                    <div key={rec.id} className="p-3.5 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200 flex items-center justify-between text-xs transition-colors">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-[#023246]">{rec.date}</p>
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
          </section>
        )}

        {/* ── TAB 3: NOTIFIKASI ───────────────────────────────────────────── */}
        {activeTab === 'NOTIFIKASI' && (
          <section className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/30 shadow-card space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h2 className="font-black text-[#023246] text-base">Notifikasi Sistem & Pengumuman</h2>
                  <p className="text-xs text-slate-400 font-semibold">{unreadCount} belum dibaca</p>
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

              <div className="space-y-2.5">
                {notifications.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-6">Tidak ada notifikasi baru.</p>
                ) : (
                  notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`p-4 rounded-2xl border text-xs space-y-1 transition-all ${
                        !n.is_read ? 'bg-[#C8F2E0]/20 border-[#0D7A5F]/30' : 'bg-slate-50 border-slate-200 opacity-80'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-extrabold text-[#023246] text-xs">{n.title}</h3>
                        {!n.is_read && <span className="w-2 h-2 rounded-full bg-[#0D7A5F]" />}
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium leading-relaxed">{n.message}</p>
                      <span className="text-[9px] text-slate-400 font-mono block pt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString('id-ID') : 'Hari ini'}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── TAB 4: PROFIL ───────────────────────────────────────────────── */}
        {activeTab === 'PROFIL' && (
          <section className="space-y-4">
            <div className="bg-white p-5 rounded-3xl border border-[#D4D4CE]/30 shadow-card space-y-5">
              <div className="text-center space-y-2 pb-4 border-b border-slate-100">
                <div className="w-20 h-20 rounded-full bg-[#C8F2E0] text-[#0D7A5F] font-black text-3xl flex items-center justify-center mx-auto shadow-inner border-2 border-[#0D7A5F]/20">
                  {effectiveUser.full_name ? effectiveUser.full_name.charAt(0) : 'G'}
                </div>
                <div>
                  <h2 className="font-black text-[#023246] text-lg">{effectiveUser.full_name}</h2>
                  <p className="text-xs text-slate-500 font-semibold">{effectiveUser.position || 'Guru Pengajar'}</p>
                </div>
              </div>

              {/* Device Binding Status Section */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-slate-700">Status Binding Perangkat HP</span>
                  <span className={`px-2.5 py-0.5 text-[10px] font-extrabold rounded-full border ${
                    deviceBindingStatus.status === 'ACTIVE'
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border-amber-200'
                  }`}>
                    {deviceBindingStatus.status === 'ACTIVE' ? '🔒 TERIKAT AKTIF' : '⚠️ PERLU PERHATIAN'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {deviceBindingStatus.message}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2.5 pt-2">
                <Button
                  variant="secondary"
                  onClick={() => setIsChangePinOpen(true)}
                  className="w-full text-xs font-bold py-3 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🔑</span> UBAH PIN KEAMANAN 6-DIGIT
                </Button>

                <Button
                  variant="danger"
                  onClick={logout}
                  className="w-full text-xs font-bold py-3 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>🚪</span> KELUAR DARI AKUN (LOGOUT)
                </Button>
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── MOBILE BOTTOM NAVIGATION DOCK ──────────────────────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-lg border-t border-[#D4D4CE]/30 px-3 py-1.5 z-40 shadow-xl">
        <div className="flex items-center justify-around relative">
          <button
            onClick={() => setActiveTab('BERANDA')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'BERANDA' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('RIWAYAT')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'RIWAYAT' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">📊</span>
            <span>Riwayat</span>
          </button>

          {/* Center FAB Scanner Button */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={handleOpenScannerClick}
              className="w-14 h-14 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center text-xl shadow-xl shadow-[#0D7A5F]/30 ring-4 ring-white active:scale-95 transition-transform cursor-pointer"
              title="Pindai QR Code"
            >
              🔲
            </button>
          </div>

          <button
            onClick={() => setActiveTab('NOTIFIKASI')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer relative ${
              activeTab === 'NOTIFIKASI' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            {unreadCount > 0 && <span className="absolute top-1 right-3 w-2 h-2 rounded-full bg-[#0D7A5F]" />}
            <span className="text-lg">🔔</span>
            <span>Notif</span>
          </button>

          <button
            onClick={() => setActiveTab('PROFIL')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'PROFIL' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">👤</span>
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
    </div>
  );
};
