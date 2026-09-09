import React, { useState, useEffect } from 'react';
import { NotificationService, type DetailedPermissionStatus } from '../../services/notification-permission.service';
import { useToastStore } from '../../store/useToastStore';
import type { UserProfile } from '../../types/database.types';

export interface NotificationPermissionBannerProps {
  user?: UserProfile;
  onOpenPreferences?: () => void;
}

export const NotificationPermissionBanner: React.FC<NotificationPermissionBannerProps> = ({
  user,
  onOpenPreferences,
}) => {
  const [detailedStatus, setDetailedStatus] = useState<DetailedPermissionStatus>('default');
  const [isDismissed, setIsDismissed] = useState(false);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const { showToast } = useToastStore();

  const dismissKey = `smart_absensi_notif_banner_dismissed_${user?.id || 'guest'}`;

  useEffect(() => {
    NotificationService.getDetailedStatus(user?.id).then((status) => {
      setDetailedStatus(status);
    });

    if (typeof window !== 'undefined') {
      const dismissed = localStorage.getItem(dismissKey);
      if (dismissed === 'true') {
        setIsDismissed(true);
      }
    }
  }, [user?.id, dismissKey]);

  // Don't show if already fully subscribed or unsupported or user dismissed
  if (detailedStatus === 'subscribed' || detailedStatus === 'unsupported' || isDismissed) {
    return null;
  }

  const handleRequestPermission = async () => {
    setIsSubscribing(true);
    try {
      const granted = await NotificationService.requestPermission(user?.id);
      const newStatus = await NotificationService.getDetailedStatus(user?.id);
      setDetailedStatus(newStatus);

      if (granted) {
        showToast(
          'success',
          'Notifikasi Real-time Aktif!',
          'Anda akan menerima pemberitahuan otomatis di HP dan peramban ini.'
        );
      } else {
        showToast(
          'warning',
          'Notifikasi Dibatasi Browser',
          'Izin notifikasi diblokir pada browser ini. Ketuk ikon gembok di sebelah alamat web untuk mengizinkan.'
        );
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem(dismissKey, 'true');
    }
  };

  // Role tailored copy
  const isLeader = user?.role === 'ADMIN' || user?.role === 'KEPSEK' || user?.role === 'OPERATOR';
  const bannerTitle = isLeader
    ? 'Aktifkan Notifikasi Real-time Pengajuan Izin & Presensi Guru'
    : 'Aktifkan Notifikasi Pengingat Presensi Masuk & Pulang';
  const bannerDesc = isLeader
    ? 'Terima pemberitahuan instan di HP/Laptop saat guru presensi atau mengajukan izin yang memerlukan persetujuan.'
    : 'Dapatkan pengingat otomatis sebelum batas jam masuk, waktu pulang sekolah, dan status pengajuan izin Anda.';

  return (
    <aside
      aria-label="Pemberitahuan Izin Notifikasi"
      className="bg-[#023246] text-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-md border border-[#287094]/40 flex flex-col md:flex-row items-center justify-between gap-3 animate-fade-in"
    >
      <div className="flex items-center gap-3 w-full md:w-auto min-w-0">
        <div
          aria-hidden="true"
          className="w-10 h-10 rounded-2xl bg-white/10 text-amber-300 flex items-center justify-center font-bold text-xl shrink-0 border border-white/15"
        >
          🔔
        </div>
        <div className="space-y-0.5 min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h4 className="font-extrabold text-xs sm:text-sm text-white tracking-tight leading-tight">
              {bannerTitle}
            </h4>
            {detailedStatus === 'denied' && (
              <span className="px-2 py-0.5 text-[9px] font-black bg-rose-500/20 text-rose-300 border border-rose-400/30 rounded-md">
                Diblokir di Browser
              </span>
            )}
          </div>
          <p className="text-[11px] sm:text-xs text-slate-300 leading-relaxed">
            {detailedStatus === 'denied'
              ? 'Izin notifikasi saat ini diblokir. Ketuk ikon gembok pada address bar browser Anda, lalu pilih "Izinkan Notifikasi".'
              : bannerDesc}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full md:w-auto">
        {detailedStatus !== 'denied' ? (
          <button
            type="button"
            onClick={handleRequestPermission}
            disabled={isSubscribing}
            className="flex-1 md:flex-none min-h-[44px] px-4 py-2.5 bg-[#0D7A5F] hover:bg-[#0b654f] text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer border border-emerald-400/30 active:scale-95 flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <span>{isSubscribing ? 'Mengaktifkan...' : '🔔 Aktifkan Sekarang'}</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={handleRequestPermission}
            className="flex-1 md:flex-none min-h-[44px] px-3.5 py-2.5 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold text-xs rounded-xl transition-all cursor-pointer border border-slate-600"
          >
            Coba Cek Ulang
          </button>
        )}

        {onOpenPreferences && (
          <button
            type="button"
            onClick={onOpenPreferences}
            className="min-h-[44px] px-3 py-2 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer border border-white/10"
            title="Pengaturan Notifikasi"
          >
            ⚙️ Atur
          </button>
        )}

        <button
          type="button"
          onClick={handleDismiss}
          className="min-h-[44px] min-w-[44px] p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer text-xs flex items-center justify-center shrink-0"
          aria-label="Tutup banner notifikasi"
          title="Tutup banner"
        >
          ✕
        </button>
      </div>
    </aside>
  );
};
