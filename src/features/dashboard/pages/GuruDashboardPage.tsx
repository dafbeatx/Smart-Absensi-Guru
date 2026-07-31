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
import type { AttendanceRecord } from '../../../types/database.types';

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

  // Today Attendance Status & History
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
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

  // Load Today Attendance & History on Mount
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

        // Monthly History
        const history = await provider.getMonthlyAttendance(
          user.id,
          'Juli',
          '2026',
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
  }, [user, token]);

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
    <div className="min-h-screen bg-slate-50 pb-28">
      {/* Top Branding Header */}
      <header className="flex items-center justify-between px-5 pt-6 pb-4 bg-white border-b border-slate-100 sticky top-0 z-30 shadow-subtle">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 font-bold text-xl shadow-sm border border-emerald-500/20">
            📱
          </div>
          <div>
            <h1 className="font-extrabold text-slate-900 text-base tracking-tight leading-none">
              Smart Absensi Guru
            </h1>
            <p className="text-[11px] font-semibold text-slate-500 mt-1 tracking-wide">
              SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam
            </p>
          </div>
        </div>
        <button
          onClick={() => setActiveTab('NOTIFIKASI')}
          className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          aria-label="Notifikasi"
        >
          {unreadCount > 0 && (
            <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
          )}
          🔔
        </button>
      </header>

      <main className="px-5 pt-5 space-y-5 max-w-md mx-auto">
        {/* ── TAB 1: BERANDA ──────────────────────────────────────────────── */}
        {activeTab === 'BERANDA' && (
          <>
            {/* Hero Profile Card */}
            <section className="bg-white rounded-3xl p-5 shadow-card border border-slate-100 flex items-center justify-between">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full inline-block">
                  {getTimeBasedGreeting()}
                </span>
                <h2 className="text-lg font-extrabold text-slate-900 leading-snug">
                  {user?.full_name || 'Ahmad Hidayat, S.Pd.'}
                </h2>
                <p className="text-xs font-medium text-slate-500">
                  {user?.nip ? `NIP. ${user.nip}` : user?.position || 'Guru Utama'}
                </p>
              </div>

              <div className="relative flex flex-col items-center">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 font-bold text-xl flex items-center justify-center ring-4 ring-emerald-500/20 shadow-inner">
                  {user?.full_name ? user.full_name.charAt(0) : 'AH'}
                </div>
                <button
                  onClick={logout}
                  className="text-[10px] font-bold text-red-600 hover:underline mt-1.5"
                >
                  🚪 Keluar
                </button>
              </div>
            </section>

            {/* Today Attendance Status Card */}
            <section className="bg-linear-to-br from-emerald-600 to-teal-700 rounded-3xl p-5 text-white shadow-lg shadow-emerald-600/20 relative overflow-hidden space-y-4">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-xs text-emerald-100 font-medium">Status Kehadiran Hari Ini</p>
                  <p className="text-xs font-semibold text-emerald-200 mt-0.5">
                    {new Date().toLocaleDateString('id-ID', {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <Badge
                  status={
                    (todayAttendance?.status as 'HADIR' | 'TERLAMBAT' | 'BELUM_ABSEN') ||
                    'BELUM_ABSEN'
                  }
                  pulse
                >
                  {todayAttendance?.status === 'HADIR'
                    ? 'Sudah Absen Masuk'
                    : todayAttendance?.status === 'TERLAMBAT'
                    ? 'Terlambat'
                    : 'Belum Absen Masuk'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15">
                  <p className="text-[11px] text-emerald-100">Jam Masuk</p>
                  <p className="text-xl font-extrabold text-white mt-0.5">
                    {todayAttendance?.check_in_time || '-- : --'}
                  </p>
                  <span className="text-[10px] text-emerald-200">Batas: 07.15 WIB</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15">
                  <p className="text-[11px] text-emerald-100">Jam Pulang</p>
                  <p className="text-xl font-extrabold text-white mt-0.5">
                    {todayAttendance?.check_out_time || '-- : --'}
                  </p>
                  <span className="text-[10px] text-emerald-200">Mulai: 15.30 WIB</span>
                </div>
              </div>
            </section>

            {/* Primary Action Callout Banner */}
            <section
              onClick={onOpenScanner}
              className="bg-emerald-50 hover:bg-emerald-100/80 rounded-2xl p-4 border border-emerald-200 flex items-center justify-between cursor-pointer transition-all active:scale-[0.99] group shadow-subtle"
            >
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-emerald-600 text-white flex items-center justify-center text-2xl shadow-md group-hover:scale-110 transition-transform">
                  📷
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-900 text-sm">Sudah Berada di Sekolah?</h4>
                  <p className="text-xs text-slate-600">Tekan tombol hijau di bawah untuk Scan QR</p>
                </div>
              </div>
              <span className="text-emerald-700 font-bold text-lg">➔</span>
            </section>

            {/* Quick Action Shortcuts */}
            <section className="grid grid-cols-2 gap-3.5">
              <button
                onClick={handleOpenLeaveModal}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card flex items-center gap-3 text-left hover:border-emerald-500/50 transition-all active:scale-95 group"
              >
                <div className="w-11 h-11 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                  📝
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Ajukan Izin</h4>
                  <p className="text-[11px] text-slate-500">Sakit / Dinas</p>
                </div>
              </button>

              <button
                onClick={handleOpenCorrectionModal}
                className="bg-white p-4 rounded-2xl border border-slate-100 shadow-card flex items-center gap-3 text-left hover:border-emerald-500/50 transition-all active:scale-95 group"
              >
                <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                  ⚠️
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 text-sm">Koreksi Absen</h4>
                  <p className="text-[11px] text-slate-500">Lupa scan / Kendala</p>
                </div>
              </button>
            </section>

            {/* Monthly Attendance Progress Card */}
            <section className="bg-white rounded-3xl p-5 border border-slate-100 shadow-card space-y-3">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-slate-900 text-xs">Kehadiran Bulan Ini</h3>
                <span className="text-xs font-extrabold text-emerald-600">95.4%</span>
              </div>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 h-full" style={{ width: '90%' }} />
                <div className="bg-amber-400 h-full" style={{ width: '5.4%' }} />
                <div className="bg-red-400 h-full" style={{ width: '0%' }} />
              </div>
              <div className="flex justify-between text-[11px] font-semibold text-slate-500 pt-1">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" /> Hadir: 18
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" /> Terlambat: 1
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-blue-400" /> Izin: 1
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-red-400" /> Alfa: 0
                </span>
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
                <p className="text-xs text-slate-400 mt-0.5">NIP. {user?.nip || '-'}</p>
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
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-lg border-t border-slate-200 px-4 py-2 z-40">
        <div className="flex items-center justify-between relative">
          <button
            onClick={() => setActiveTab('BERANDA')}
            className={`flex flex-col items-center gap-1 text-[11px] w-14 py-1 transition-colors ${
              activeTab === 'BERANDA' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <span className="text-xl">🏠</span>
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('RIWAYAT')}
            className={`flex flex-col items-center gap-1 text-[11px] w-14 py-1 transition-colors ${
              activeTab === 'RIWAYAT' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <span className="text-xl">📜</span>
            <span>Riwayat</span>
          </button>

          {/* Center FAB Scanner Button */}
          <div className="relative -top-6 flex flex-col items-center">
            <button
              onClick={onOpenScanner}
              className="w-16 h-16 rounded-full bg-linear-to-tr from-emerald-600 to-emerald-400 text-white flex items-center justify-center text-2xl shadow-fab ring-4 ring-slate-50 active:scale-95 transition-transform"
              aria-label="Scan QR Absensi"
            >
              📷
            </button>
            <span className="text-[10px] font-bold text-emerald-700 mt-1">Scan QR</span>
          </div>

          <button
            onClick={() => setActiveTab('NOTIFIKASI')}
            className={`flex flex-col items-center gap-1 text-[11px] w-14 py-1 relative transition-colors ${
              activeTab === 'NOTIFIKASI' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <span className="text-xl">🔔</span>
            <span>Notifikasi</span>
            {unreadCount > 0 && <span className="absolute top-1 right-3 w-2 h-2 bg-emerald-500 rounded-full" />}
          </button>

          <button
            onClick={() => setActiveTab('PROFIL')}
            className={`flex flex-col items-center gap-1 text-[11px] w-14 py-1 transition-colors ${
              activeTab === 'PROFIL' ? 'text-emerald-600 font-bold' : 'text-slate-400 font-medium hover:text-slate-600'
            }`}
          >
            <span className="text-xl">👤</span>
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
