import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LeaveApplicationModal } from '../../leave/components/LeaveApplicationModal';
import { AttendanceCorrectionModal } from '../../admin/components/AttendanceCorrectionModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { AttendanceRecord, HolidayRecord } from '../../../types/database.types';

export interface GuruDashboardPageProps {
  onOpenScanner?: () => void;
  onOpenLeaveForm?: () => void;
  onOpenCorrectionForm?: () => void;
}

export const GuruDashboardPage: React.FC<GuruDashboardPageProps> = ({
  onOpenScanner,
  onOpenLeaveForm,
  onOpenCorrectionForm,
}) => {
  const { user, token, logout, deviceUUID, deviceModel } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'BERANDA' | 'RIWAYAT' | 'NOTIFIKASI' | 'PROFIL'>('BERANDA');
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isChangePinOpen, setIsChangePinOpen] = useState(false);

  // Change PIN Form State
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isChangingPin, setIsChangingPin] = useState(false);

  // Today Attendance Status, History, & Holiday Info
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [todayHoliday, setTodayHoliday] = useState<HolidayRecord | null>(null);
  const [attendanceHistory, setAttendanceHistory] = useState<AttendanceRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Notifications List State
  const [notifications, setNotifications] = useState([
    {
      id: 'n1',
      title: '☀️ Selalu Absen Masuk Tepat Waktu',
      message: 'Batas toleransi absen masuk adalah pukul 07.15 WIB. Gunakan QR Code di gerbang/ruang guru.',
      time: 'Hari ini 06.30 WIB',
      read: false,
      type: 'INFO',
    },
    {
      id: 'n2',
      title: '🔒 Keamanan Perangkat (Device Binding)',
      message: `Akun Anda terikat pada HP (${deviceModel || 'Perangkat Utama'}). Pembatasan 1 akun 1 HP aktif.`,
      time: 'Hari ini 06.00 WIB',
      read: false,
      type: 'SUCCESS',
    },
    {
      id: 'n3',
      title: '🔑 Pengingat Reset PIN',
      message: 'Apabila Anda masih menggunakan PIN default 123456, segera ubah PIN melalui tab Profil.',
      time: 'Kemarin',
      read: true,
      type: 'WARNING',
    },
  ]);

  // Load Today Attendance, Holidays & History on Mount
  useEffect(() => {
    const loadData = async () => {
      if (!user) return;
      setIsLoadingHistory(true);
      try {
        const provider = ProviderFactory.getProvider();
        const authToken = token || '';
        
        // Today Attendance
        const today = await provider.getTodayAttendance(user.id, authToken);
        setTodayAttendance(today);

        // Academic Calendar Holidays
        const holidays = await provider.getHolidays(authToken);
        const todayIso = new Date().toISOString().substring(0, 10);
        const holidayToday = (holidays || []).find((h) => h.date === todayIso);
        if (holidayToday) {
          setTodayHoliday(holidayToday);
        }

        // Monthly History
        const now = new Date();
        const currentMonthName = now.toLocaleString('id-ID', { month: 'long' });
        const currentYearStr = now.getFullYear().toString();

        const history = await provider.getMonthlyAttendance(
          user.id,
          currentMonthName,
          currentYearStr,
          authToken
        );
        setAttendanceHistory(history || []);
      } catch (err) {
        console.warn('Fallback attendance history:', err);
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadData();

    window.addEventListener('smart_absensi_scanned', loadData);
    return () => {
      window.removeEventListener('smart_absensi_scanned', loadData);
    };
  }, [user, token]);

  // Dynamic monthly attendance statistics calculation
  const totalDays = attendanceHistory.length;
  const hadirCount = attendanceHistory.filter(h => h.status === 'HADIR').length;
  const terlambatCount = attendanceHistory.filter(h => h.status === 'TERLAMBAT').length;
  const izinCount = attendanceHistory.filter(h => h.status === 'IZIN' || h.status === 'SAKIT' || h.status === 'DINAS_LUAR').length;
  const alfaCount = attendanceHistory.filter(h => h.status === 'ALFA').length;

  const attendancePercentage = totalDays > 0
    ? (Math.round(((hadirCount + terlambatCount) / totalDays) * 1000) / 10).toFixed(1)
    : '0.0';

  const hadirPercent = totalDays > 0 ? (hadirCount / totalDays) * 100 : 0;
  const terlambatPercent = totalDays > 0 ? (terlambatCount / totalDays) * 100 : 0;
  const izinPercent = totalDays > 0 ? (izinCount / totalDays) * 100 : 0;
  const alfaPercent = totalDays > 0 ? (alfaCount / totalDays) * 100 : 0;

  const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 11) return '☀️ Selamat Pagi';
    if (hour < 15) return '🌤️ Selamat Siang';
    if (hour < 18) return '🌆 Selamat Sore';
    return '🌙 Selamat Malam';
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

  const handleMarkAllNotificationsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    showToast('info', 'Notifikasi Diperbarui', 'Semua notifikasi telah ditandai dibaca.');
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
      await provider.changePin(user?.id || '', newPin, authToken);

      showToast('success', 'Ganti PIN Berhasil!', 'PIN akun Anda telah diperbarui. Gunakan PIN baru di login berikutnya.');
      setIsChangePinOpen(false);
      setNewPin('');
      setConfirmPin('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui PIN';
      showToast('error', 'Gagal Reset PIN', msg);
    } finally {
      setIsChangingPin(false);
    }
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-28 text-[#023246]">
      {/* ── TOP NAV BAR (HEADER) ────────────────────────────────────────── */}
      <header className="flex items-center justify-between px-5 pt-6 pb-3 bg-white border-b border-[#D4D4CE]/20 sticky top-0 z-30 shadow-2xs max-w-md mx-auto">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-[#0D7A5F]/10 text-[#0D7A5F] font-black text-lg flex items-center justify-center border border-[#0D7A5F]/20">
            ∆
          </div>
          <div>
            <h1 className="font-black text-[#023246] text-sm tracking-tight leading-none uppercase">
              Smart Absensi Guru
            </h1>
            <p className="text-[10px] font-semibold text-slate-500 mt-0.5">
              SMP Terpadu Al-Ittihadiyah
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
                  {user?.full_name || 'Dafa Maulana, S.Pd'}
                </h2>
                {user?.nip ? (
                  <p className="text-xs font-medium text-slate-500">
                    NIP. {user.nip}
                  </p>
                ) : null}
              </div>

              <div className="flex flex-col items-center gap-2">
                <div className="w-14 h-14 rounded-full bg-[#C8F2E0] text-[#0D7A5F] font-black text-2xl flex items-center justify-center shadow-inner border border-[#0D7A5F]/20">
                  {user?.full_name ? user.full_name.charAt(0) : 'D'}
                </div>
                <button
                  onClick={logout}
                  className="px-2.5 py-1 bg-[#FEE2E2] hover:bg-[#FCA5A5]/40 text-[#DC2626] font-bold text-[11px] rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                  title="Keluar dari Akun"
                >
                  <span>➔</span> Keluar
                </button>
              </div>
            </section>

            {/* Holiday Alert Banner if Today is Holiday */}
            {todayHoliday && (
              <section className="bg-purple-600 text-white rounded-3xl p-5 shadow-lg shadow-purple-600/20 border border-purple-500 flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-2xl flex items-center justify-center shrink-0">
                  🎉
                </div>
                <div className="space-y-1">
                  <span className="px-2 py-0.5 bg-white/20 text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                    {todayHoliday.type === 'NATIONAL_HOLIDAY' ? 'Libur Nasional' : todayHoliday.type === 'SCHOOL_HOLIDAY' ? 'Libur Sekolah' : 'Cuti Bersama'}
                  </span>
                  <h3 className="font-extrabold text-base leading-snug">{todayHoliday.name}</h3>
                  <p className="text-xs text-purple-100 font-medium">
                    Hari ini adalah hari libur resmi pada Kalender Akademik Sekolah. Tidak wajib melakukan absensi harian.
                  </p>
                </div>
              </section>
            )}

            {/* 2. Main Attendance Status Card (Dark Emerald Green #0D7A5F) */}
            <section className="bg-[#0D7A5F] rounded-3xl p-5 text-white shadow-xl shadow-[#0D7A5F]/20 relative overflow-hidden space-y-4 border border-[#0A6B56]">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs text-white font-extrabold">Status Kehadiran Hari Ini</p>
                  <p className="text-xs font-semibold text-[#C8F2E0] mt-0.5">
                    {new Date().toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>

                <div className="bg-[#FFF4DC] text-[#B45309] border border-[#FDE68A] font-extrabold text-[11px] px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-2xs shrink-0">
                  <span className="w-2 h-2 rounded-full bg-[#B45309] animate-pulse" />
                  {todayAttendance?.status === 'HADIR'
                    ? 'SUDAH ABSEN MASUK'
                    : todayAttendance?.status === 'TERLAMBAT'
                    ? 'TERLAMBAT'
                    : 'BELUM ABSEN MASUK'}
                </div>
              </div>

              {/* Inset Side-by-Side Cards */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#C8F2E0] text-[#0D7A5F] flex items-center justify-center font-bold text-sm">
                      🕒
                    </div>
                    <span className="text-xs text-white font-bold">Jam Masuk</span>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-white font-mono">
                      {todayAttendance?.check_in_time || '-- : --'}
                    </p>
                    <p className="text-[10px] text-[#C8F2E0] font-medium mt-0.5">Batas: 07.15 WIB</p>
                  </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3.5 border border-white/20 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[#C8F2E0] text-[#0D7A5F] flex items-center justify-center font-bold text-sm">
                      🕒
                    </div>
                    <span className="text-xs text-white font-bold">Jam Pulang</span>
                  </div>
                  <div>
                    <p className="text-xl font-extrabold text-white font-mono">
                      {todayAttendance?.check_out_time || '-- : --'}
                    </p>
                    <p className="text-[10px] text-[#C8F2E0] font-medium mt-0.5">Mulai: 15.30 WIB</p>
                  </div>
                </div>
              </div>
            </section>

            {/* 3. "Sudah Berada di Sekolah?" Callout Banner */}
            <section
              onClick={onOpenScanner}
              className="bg-[#E8FAF2] hover:bg-[#D1F5E5] rounded-2xl p-4 border border-[#A7F3D0] flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] group shadow-2xs"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#0D7A5F] text-white flex items-center justify-center text-xl shadow-md group-hover:scale-105 transition-transform">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
                <div>
                  <h4 className="font-extrabold text-[#023246] text-sm">Sudah Berada di Sekolah?</h4>
                  <p className="text-xs text-slate-600">Tekan tombol hijau di bawah untuk Scan QR</p>
                </div>
              </div>
              <span className="text-[#0D7A5F] font-black text-xl">›</span>
            </section>

            {/* 4. Quick Action Buttons Row */}
            <section className="grid grid-cols-2 gap-3.5">
              <button
                onClick={handleOpenLeaveModal}
                className="bg-white p-4 rounded-2xl border border-[#D4D4CE]/30 shadow-card flex items-center justify-between hover:border-[#0D7A5F]/50 transition-all active:scale-95 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#E8FAF2] text-[#0D7A5F] flex items-center justify-center text-lg">
                    📝
                  </div>
                  <div>
                    <h4 className="font-bold text-[#023246] text-xs">Ajukan Izin</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Sakit / Dinas</p>
                  </div>
                </div>
                <span className="text-slate-400 font-bold text-sm">›</span>
              </button>

              <button
                onClick={handleOpenCorrectionModal}
                className="bg-white p-4 rounded-2xl border border-[#D4D4CE]/30 shadow-card flex items-center justify-between hover:border-[#D97706]/50 transition-all active:scale-95 text-left cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#FEF3C7] text-[#D97706] flex items-center justify-center text-lg">
                    ⚠️
                  </div>
                  <div>
                    <h4 className="font-bold text-[#023246] text-xs">Koreksi Absen</h4>
                    <p className="text-[10px] text-slate-500 font-medium">Lupa scan / Kendala</p>
                  </div>
                </div>
                <span className="text-slate-400 font-bold text-sm">›</span>
              </button>
            </section>

            {/* 5. Monthly Attendance Progress Card */}
            <section className="bg-white rounded-3xl p-5 border border-[#D4D4CE]/30 shadow-card space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-[#023246] text-xs">Kehadiran Bulan Ini</h3>
                <span className="text-xs font-extrabold text-[#0D7A5F]">{attendancePercentage}%</span>
              </div>
              
              <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="bg-[#16A34A] h-full transition-all duration-500" style={{ width: `${hadirPercent}%` }} />
                <div className="bg-[#D97706] h-full transition-all duration-500" style={{ width: `${terlambatPercent}%` }} />
                <div className="bg-[#287094] h-full transition-all duration-500" style={{ width: `${izinPercent}%` }} />
                <div className="bg-[#DC2626] h-full transition-all duration-500" style={{ width: `${alfaPercent}%` }} />
              </div>

              <div className="grid grid-cols-4 gap-1 text-center divide-x divide-slate-100 pt-1">
                <div className="space-y-1">
                  <span className="flex items-center justify-center gap-1 text-[10px] text-slate-500 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#16A34A]" /> Hadir
                  </span>
                  <p className="font-black text-[#023246] text-sm">{hadirCount}</p>
                </div>
                <div className="space-y-1">
                  <span className="flex items-center justify-center gap-1 text-[10px] text-slate-500 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#D97706]" /> Terlambat
                  </span>
                  <p className="font-black text-[#023246] text-sm">{terlambatCount}</p>
                </div>
                <div className="space-y-1">
                  <span className="flex items-center justify-center gap-1 text-[10px] text-slate-500 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#287094]" /> Izin
                  </span>
                  <p className="font-black text-[#023246] text-sm">{izinCount}</p>
                </div>
                <div className="space-y-1">
                  <span className="flex items-center justify-center gap-1 text-[10px] text-slate-500 font-semibold">
                    <span className="w-2 h-2 rounded-full bg-[#DC2626]" /> Alfa
                  </span>
                  <p className="font-black text-[#023246] text-sm">{alfaCount}</p>
                </div>
              </div>
            </section>
          </>
        )}

        {/* ── TAB 2: RIWAYAT ABSENSI ─────────────────────────────────────── */}
        {activeTab === 'RIWAYAT' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">📜 Riwayat Kehadiran</h2>
                <p className="text-xs text-slate-500">Catatan absensi harian bulan Juli 2026</p>
              </div>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-xl">
                Juli 2026
              </span>
            </div>

            {isLoadingHistory ? (
              <div className="p-8 text-center bg-white rounded-3xl border border-slate-100 text-xs font-semibold text-slate-400">
                ⏳ Memuat data riwayat...
              </div>
            ) : attendanceHistory.length > 0 ? (
              <div className="space-y-2.5">
                {attendanceHistory.map((item) => (
                  <div
                    key={item.id}
                    className="bg-white p-4 rounded-2xl border border-slate-100 shadow-subtle flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-extrabold text-slate-900">{item.date}</p>
                      <p className="text-[11px] text-slate-500 font-medium">
                        Masuk: <span className="font-bold text-slate-800">{item.check_in_time || '--:--'}</span> | Pulang:{' '}
                        <span className="font-bold text-slate-800">{item.check_out_time || '--:--'}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">
                        Verifikasi: {item.verification_method} ({item.check_in_distance_meters || 0}m dari sekolah)
                      </p>
                    </div>
                    <Badge
                      status={
                        (item.status as 'HADIR' | 'TERLAMBAT' | 'SAKIT' | 'IZIN' | 'ALFA') ||
                        'HADIR'
                      }
                    >
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 text-center space-y-2">
                <span className="text-4xl">📅</span>
                <h3 className="font-bold text-slate-800 text-sm">Belum Ada Riwayat Tambahan</h3>
                <p className="text-xs text-slate-500 max-w-xs mx-auto">
                  Catatan absensi Anda akan otomatis tercatat setiap kali Anda memindai QR Code di sekolah.
                </p>
              </div>
            )}
          </section>
        )}

        {/* ── TAB 3: NOTIFIKASI ───────────────────────────────────────────── */}
        {activeTab === 'NOTIFIKASI' && (
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-extrabold text-slate-900">🔔 Pusat Notifikasi</h2>
                <p className="text-xs text-slate-500">Pemberitahuan & informasi absensi</p>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllNotificationsRead}
                  className="text-[11px] font-bold text-emerald-700 hover:underline"
                >
                  Tandai Semua Dibaca
                </button>
              )}
            </div>

            <div className="space-y-2.5">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-4 rounded-2xl border transition-all ${
                    n.read
                      ? 'bg-white border-slate-100'
                      : 'bg-emerald-50/60 border-emerald-200/80 shadow-subtle'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <h4 className="font-extrabold text-slate-900 text-xs">{n.title}</h4>
                    <span className="text-[10px] text-slate-400 font-medium">{n.time}</span>
                  </div>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{n.message}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── TAB 4: PROFIL GURU ──────────────────────────────────────────── */}
        {activeTab === 'PROFIL' && (
          <section className="space-y-4">
            {/* Main Profile Identity Card */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-card text-center space-y-3">
              <div className="w-20 h-20 rounded-full bg-emerald-100 text-emerald-700 font-black text-3xl flex items-center justify-center ring-4 ring-emerald-500/20 mx-auto shadow-inner">
                {user?.full_name ? user.full_name.charAt(0) : 'AH'}
              </div>

              <div>
                <h2 className="text-lg font-extrabold text-slate-900">{user?.full_name || 'Guru Smart Absensi'}</h2>
                <p className="text-xs font-semibold text-emerald-700 mt-0.5">{user?.position || 'Guru Utama'}</p>
                {user?.nip ? (
                  <p className="text-xs text-slate-400 mt-0.5">NIP. {user.nip}</p>
                ) : null}
              </div>

              <div className="pt-2 flex justify-center gap-2">
                <Button variant="secondary" className="text-xs py-2 px-4" onClick={() => setIsChangePinOpen(true)}>
                  🔑 Ganti PIN Akun
                </Button>
                <Button variant="danger" className="text-xs py-2 px-4" onClick={logout}>
                  🚪 Keluar
                </Button>
              </div>
            </div>

            {/* Device Binding Status Card */}
            <div className="bg-white rounded-3xl p-5 border border-slate-100 shadow-card space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-slate-100 flex items-center justify-center text-xl">
                  📱
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-xs">Status Ikatan Perangkat (Device Binding)</h3>
                  <p className="text-[11px] text-emerald-600 font-bold mt-0.5">✅ Terikat Aktif Pada HP Ini</p>
                </div>
              </div>

              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1 text-[11px]">
                <p className="text-slate-500"><strong>Model Perangkat:</strong> {deviceModel || 'Smartphone Utama'}</p>
                <p className="text-slate-500"><strong>Device UUID:</strong> <span className="font-mono text-slate-700">{deviceUUID || 'uuid-bound-active'}</span></p>
              </div>

              <p className="text-[10px] text-slate-400 italic leading-snug">
                Sistem keamanan membatasi 1 akun hanya dapat digunakan pada 1 HP terikat. Hubungi Admin Website jika perlu berpindah HP.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* 5-Item Navigation Bar with Center-Dock FAB */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-lg border-t border-[#D4D4CE]/30 px-3 py-1.5 z-40 shadow-xl">
        <div className="flex items-center justify-around relative">
          <button
            onClick={() => setActiveTab('BERANDA')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'BERANDA' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('RIWAYAT')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'RIWAYAT' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <span className="text-lg">📄</span>
            <span>Riwayat</span>
          </button>

          {/* Center FAB Scanner Button */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={onOpenScanner}
              className="w-14 h-14 rounded-full bg-[#0D7A5F] text-white flex items-center justify-center text-xl shadow-xl shadow-[#0D7A5F]/30 ring-4 ring-white active:scale-95 transition-transform cursor-pointer"
              aria-label="Scan QR Absensi"
              title="Pindai QR Code Absensi"
            >
              📷
            </button>
            <span className="text-[10px] font-extrabold text-[#0D7A5F] mt-0.5">Scan QR</span>
          </div>

          <button
            onClick={() => setActiveTab('NOTIFIKASI')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 relative transition-colors cursor-pointer ${
              activeTab === 'NOTIFIKASI' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <span className="text-lg">🔔</span>
            <span>Notifikasi</span>
            {unreadCount > 0 && <span className="absolute top-1 right-3.5 w-2 h-2 bg-[#0D7A5F] rounded-full" />}
          </button>

          <button
            onClick={() => setActiveTab('PROFIL')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'PROFIL' ? 'text-[#0D7A5F] font-black' : 'text-slate-400 font-semibold hover:text-slate-600'
            }`}
          >
            <span className="text-lg">👤</span>
            <span>Profil</span>
          </button>
        </div>
      </nav>

      {/* Internal Modals */}
      <LeaveApplicationModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
      />

      <AttendanceCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        teachers={user ? [user] : []}
      />

      {/* Change PIN Modal */}
      <Modal isOpen={isChangePinOpen} onClose={() => setIsChangePinOpen(false)} title="🔑 Ganti PIN Akun">
        <form onSubmit={handleChangePinSubmit} className="space-y-4">
          <Input
            label="PIN Baru (6 Digit Angka)"
            type="password"
            maxLength={6}
            value={newPin}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Masukkan 6 angka PIN baru"
          />
          <Input
            label="Konfirmasi PIN Baru"
            type="password"
            maxLength={6}
            value={confirmPin}
            onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ''))}
            placeholder="Ulangi 6 angka PIN baru"
          />

          <div className="pt-2 flex items-center gap-2">
            <Button type="button" variant="secondary" className="w-1/2" onClick={() => setIsChangePinOpen(false)}>
              Batal
            </Button>
            <Button type="submit" variant="primary" className="w-1/2" isLoading={isChangingPin}>
              Simpan PIN Baru
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
