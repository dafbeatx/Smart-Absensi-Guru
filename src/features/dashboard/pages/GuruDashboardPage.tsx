import React from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { Badge } from '../../../components/ui/Badge';

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
  const { user, logout } = useAuthStore();

  const getTimeBasedGreeting = (): string => {
    const hour = new Date().getHours();
    if (hour < 11) return '☀️ Selamat Pagi';
    if (hour < 15) return '🌤️ Selamat Siang';
    if (hour < 18) return '🌆 Selamat Sore';
    return '🌙 Selamat Malam';
  };

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
          onClick={() => alert('Notification Center (Akan tersedia di Sprint 3)')}
          className="relative p-2.5 text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          aria-label="Notifikasi"
        >
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-emerald-500 rounded-full ring-2 ring-white" />
          🔔
        </button>
      </header>

      <main className="px-5 pt-5 space-y-5 max-w-md mx-auto">
        
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
                {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>
            <Badge status="BELUM_ABSEN" pulse>Belum Absen Masuk</Badge>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15">
              <p className="text-[11px] text-emerald-100">Jam Masuk</p>
              <p className="text-xl font-extrabold text-white mt-0.5">-- : --</p>
              <span className="text-[10px] text-emerald-200">Batas: 07.15 WIB</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md rounded-2xl p-3 border border-white/15">
              <p className="text-[11px] text-emerald-100">Jam Pulang</p>
              <p className="text-xl font-extrabold text-white mt-0.5">-- : --</p>
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
            onClick={onOpenLeaveForm || (() => alert('Form Izin akan aktif di Sprint 3'))}
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
            onClick={onOpenCorrectionForm || (() => alert('Form Koreksi akan aktif di Sprint 3'))}
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
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Hadir: 18</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Terlambat: 1</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Izin: 1</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Alfa: 0</span>
          </div>
        </section>

      </main>

      {/* 5-Item Navigation Bar with Center-Dock FAB */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/90 backdrop-blur-lg border-t border-slate-200 px-4 py-2 z-40">
        <div className="flex items-center justify-between relative">
          
          <button className="flex flex-col items-center gap-1 text-emerald-600 font-bold text-[11px] w-14 py-1">
            <span className="text-xl">🏠</span>
            <span>Beranda</span>
          </button>

          <button
            onClick={() => alert('Riwayat Absensi akan aktif di Sprint 3')}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 font-medium text-[11px] w-14 py-1"
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
            onClick={() => alert('Notifikasi akan aktif di Sprint 3')}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 font-medium text-[11px] w-14 py-1 relative"
          >
            <span className="text-xl">🔔</span>
            <span>Notifikasi</span>
            <span className="absolute top-1 right-3 w-2 h-2 bg-red-500 rounded-full" />
          </button>

          <button
            onClick={() => alert('Halaman Profil akan aktif di Sprint 3')}
            className="flex flex-col items-center gap-1 text-slate-400 hover:text-slate-600 font-medium text-[11px] w-14 py-1"
          >
            <span className="text-xl">👤</span>
            <span>Profil</span>
          </button>

        </div>
      </nav>

    </div>
  );
};
