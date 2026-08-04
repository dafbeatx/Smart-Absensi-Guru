import React, { useState, useEffect } from 'react';
import { NotificationService } from '../../services/notification-permission.service';
import { useToastStore } from '../../store/useToastStore';

export const NotificationPermissionBanner: React.FC = () => {
  const [permissionStatus, setPermissionStatus] = useState<NotificationPermission>('default');
  const [isDismissed, setIsDismissed] = useState(false);
  const { showToast } = useToastStore();

  useEffect(() => {
    setPermissionStatus(NotificationService.getPermissionStatus());
  }, []);

  if (permissionStatus === 'granted' || isDismissed) {
    return null; // Do not show banner if permission is already granted or dismissed
  }

  const handleRequestPermission = async () => {
    const granted = await NotificationService.requestPermission();
    setPermissionStatus(NotificationService.getPermissionStatus());

    if (granted) {
      showToast(
        'success',
        'Notifikasi Real-time Aktif!',
        'Anda akan menerima pemberitahuan otomatis saat guru absen masuk, keluar, atau mengajukan izin.'
      );
    } else {
      showToast(
        'warning',
        'Notifikasi Ditolak / Dibatasi',
        'Izin notifikasi dibatasi oleh browser Anda. Aktifkan izin pada pengaturan browser untuk notifikasi otomatis.'
      );
    }
  };

  return (
    <div className="bg-[#023246] text-white p-3.5 px-4 rounded-2xl shadow-md border border-[#287094]/40 flex flex-col sm:flex-row items-center justify-between gap-3 animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-white/10 text-amber-300 flex items-center justify-center font-bold text-lg shrink-0 border border-white/20">
          🔔
        </div>
        <div>
          <h4 className="font-extrabold text-xs text-white">
            Aktifkan Notifikasi Real-time Presensi & Izin Guru
          </h4>
          <p className="text-[11px] text-[#D4D4CE]">
            Terima pemberitahuan otomatis di HP/Laptop saat guru absen masuk, keluar, atau mengajukan izin.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
        <button
          onClick={handleRequestPermission}
          className="flex-1 sm:flex-none px-4 py-2 bg-[#287094] hover:bg-emerald-600 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all cursor-pointer border border-white/20 active:scale-95"
        >
          🔔 Aktifkan Notifikasi
        </button>
        <button
          onClick={() => setIsDismissed(true)}
          className="p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer text-xs"
          title="Tutup Banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
