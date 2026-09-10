import React, { useState, useEffect } from 'react';
import { ProviderFactory } from '../../providers/provider-factory';
import { SoundService } from '../../services/audio.service';
import { NotificationService, type DetailedPermissionStatus } from '../../services/notification-permission.service';
import { useAuthStore } from '../../store/useAuthStore';
import { useToastStore } from '../../store/useToastStore';
import { formatTimeForInput } from '../../utils/time.utils';
import type { NotificationPreferences } from '../../types/database.types';

export interface NotificationPreferencesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationPreferencesModal: React.FC<NotificationPreferencesModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { user, token } = useAuthStore();
  const { showToast } = useToastStore();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [detailedStatus, setDetailedStatus] = useState<DetailedPermissionStatus>('default');

  const [prefs, setPrefs] = useState<NotificationPreferences>({
    user_id: user?.id || '',
    push_enabled: true,
    attendance_enabled: true,
    leave_enabled: true,
    schedule_enabled: true,
    announcement_enabled: true,
    critical_enabled: true,
    voice_enabled: true,
    sound_enabled: true,
    attendance_sound_enabled: true,
    chime_enabled: true,
    auto_greeting_enabled: false,
    attendance_alerts: true,
    leave_alerts: true,
    event_alerts: true,
    quiet_hours_enabled: false,
    quiet_hours_start: '21:00',
    quiet_hours_end: '05:00',
  });

  const [chimeMuted, setChimeMuted] = useState<boolean>(() => SoundService.getIsChimeMuted());
  const [attendanceSoundMuted, setAttendanceSoundMuted] = useState<boolean>(() => SoundService.getIsAttendanceSoundMuted());

  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;

    NotificationService.getDetailedStatus(user.id).then(async (status) => {
      setDetailedStatus(status);
      if (status === 'granted') {
        // Auto attempt to subscribe to push so device is connected to cloud
        const subscribed = await NotificationService.subscribeUserToPush(user.id);
        if (subscribed) {
          const updated = await NotificationService.getDetailedStatus(user.id);
          setDetailedStatus(updated);
        }
      }
    });

    setChimeMuted(SoundService.getIsChimeMuted());
    setAttendanceSoundMuted(SoundService.getIsAttendanceSoundMuted());

    const fetchPrefs = async () => {
      setLoading(true);
      try {
        const provider = ProviderFactory.getProvider();
        const existing = await provider.getNotificationPreferences(user.id, token || 'MOCK_TOKEN');
        if (existing) {
          setPrefs(existing);
        }
      } catch (err) {
        console.warn('Failed to load notification preferences:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchPrefs();
  }, [isOpen, user, token]);

  if (!isOpen) return null;

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // 1. Save sound preferences to SoundService
      SoundService.setChimeMuted(chimeMuted);
      SoundService.setAttendanceSoundMuted(attendanceSoundMuted);

      // 2. Save notification preferences to Database via ProviderFactory
      const provider = ProviderFactory.getProvider();
      await provider.saveNotificationPreferences(user.id, prefs, token || 'MOCK_TOKEN');

      showToast('success', 'Preferensi Disimpan', 'Pengaturan notifikasi & suara berhasil diperbarui.');
      onClose();
    } catch (err) {
      console.error('Failed to save notification preferences:', err);
      showToast('error', 'Gagal Menyimpan', 'Terjadi kesalahan saat menyimpan pengaturan notifikasi.');
    } finally {
      setSaving(false);
    }
  };

  const handleRequestPush = async () => {
    if (!user) return;
    const granted = await NotificationService.requestPermission(user.id);
    const newStatus = await NotificationService.getDetailedStatus(user.id);
    setDetailedStatus(newStatus);
    if (granted) {
      setPrefs((prev) => ({ ...prev, push_enabled: true }));
      showToast('success', 'Web Push Aktif', 'Notifikasi browser diizinkan untuk akun ini.');
    } else {
      showToast('warning', 'Izin Ditolak', 'Periksa pengaturan izin notifikasi peramban Anda.');
    }
  };

  const handleTestNotification = () => {
    if (!user) return;
    setTesting(true);
    try {
      NotificationService.sendNativeNotification({
        title: '🔔 Uji Notifikasi Berhasil!',
        body: `Halo ${user.full_name || 'Guru'}, notifikasi Smart Absensi aktif & siap berdering di perangkat ini.`,
        type: 'SYSTEM',
        userId: user.id,
        roleTarget: 'ALL',
        actionUrl: '/?tab=BERANDA',
      });
      showToast('success', 'Uji Notifikasi Terkirim', 'Periksa bilah notifikasi atas HP Anda sekarang.');
    } catch {
      showToast('error', 'Gagal Mengirim', 'Pastikan izin notifikasi browser sudah diizinkan.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="notif-pref-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in"
    >
      <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 sm:p-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center font-bold text-lg border border-white/20">
              ⚙️
            </div>
            <div>
              <h3 id="notif-pref-title" className="font-extrabold text-sm sm:text-base tracking-tight">
                Pengaturan Notifikasi &amp; Suara
              </h3>
              <p className="text-[11px] text-slate-300">Sesuaikan peringatan, nada dering, dan jam istirahat</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-10 h-10 rounded-xl text-slate-300 hover:text-white hover:bg-white/10 flex items-center justify-center cursor-pointer transition-colors"
            aria-label="Tutup modal"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {loading ? (
            <div className="py-12 text-center text-slate-500 font-medium animate-pulse">
              Memuat preferensi notifikasi...
            </div>
          ) : (
            <>
              {/* Push Permission Status Card */}
              <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-[#023246] flex items-center gap-1.5">
                    <span>📡 Status Izin Browser:</span>
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full font-black text-[10px] ${
                      detailedStatus === 'subscribed'
                        ? 'bg-emerald-100 text-emerald-800'
                        : detailedStatus === 'denied'
                        ? 'bg-rose-100 text-rose-800'
                        : 'bg-amber-100 text-amber-800'
                    }`}
                  >
                    {detailedStatus === 'subscribed'
                      ? '✓ Terhubung Push Cloud'
                      : detailedStatus === 'granted'
                      ? 'Izin Diberikan'
                      : detailedStatus === 'denied'
                      ? 'Diblokir Browser'
                      : 'Belum Aktif'}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  {detailedStatus !== 'subscribed' && (
                    <button
                      type="button"
                      onClick={handleRequestPush}
                      className="flex-1 min-h-11 px-3.5 py-2 bg-[#0D7A5F] hover:bg-[#0b654f] text-white font-extrabold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 shadow-xs active:scale-95"
                    >
                      🔔 Sambungkan Web Push Cloud
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleTestNotification}
                    disabled={testing}
                    className="min-h-11 px-3.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                  >
                    <span>🧪</span>
                    <span>Uji Bunyi Notifikasi</span>
                  </button>
                </div>
              </div>

              {/* Infinix & Android OS Optimization Tips Card */}
              <div className="p-3.5 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-1.5">
                <div className="flex items-center gap-1.5 text-amber-900 font-extrabold text-[11px]">
                  <span>💡</span>
                  <span>Tips HP Infinix &amp; Android (Saat Web Ditutup):</span>
                </div>
                <ul className="text-[10.5px] text-amber-950/80 space-y-1 list-disc list-inside leading-relaxed">
                  <li>
                    <strong>Pasang ke Layar Utama:</strong> Ketuk menu titik 3 browser Chrome → <em>Tambahkan ke Layar Utama</em> (PWA).
                  </li>
                  <li>
                    <strong>Hemat Daya XOS Infinix:</strong> Buka <em>Pengaturan HP → Manajemen Aplikasi → Chrome/Web Absensi → Baterai → Izinkan Aktivitas Latar Belakang</em> agar OS tidak membekukan notifikasi saat layar mati.
                  </li>
                </ul>
              </div>

              {/* Notification Toggles */}
              <div className="space-y-2.5">
                <h4 className="font-extrabold text-[#023246] text-xs uppercase tracking-wider">
                  Kategori Notifikasi
                </h4>

                <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="font-bold text-slate-800 block">Peringatan Presensi Masuk &amp; Pulang</span>
                    <span className="text-[11px] text-slate-500 block">
                      Notifikasi presensi berhasil, guru terlambat, dan pengingat waktu pulang.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.attendance_alerts}
                    onChange={() => handleToggle('attendance_alerts')}
                    className="w-5 h-5 accent-[#0D7A5F] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="font-bold text-slate-800 block">Pengajuan Izin &amp; Cuti Guru</span>
                    <span className="text-[11px] text-slate-500 block">
                      Pemberitahuan permohonan baru, persetujuan, atau penolakan cuti.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.leave_alerts}
                    onChange={() => handleToggle('leave_alerts')}
                    className="w-5 h-5 accent-[#0D7A5F] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="font-bold text-slate-800 block">Agenda Sekolah &amp; Peringatan Gajian</span>
                    <span className="text-[11px] text-slate-500 block">
                      Pengumuman agenda penting sekolah dan pengingat gajian H-3 s.d Hari H (Tanggal 10).
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.event_alerts}
                    onChange={() => handleToggle('event_alerts')}
                    className="w-5 h-5 accent-[#0D7A5F] cursor-pointer"
                  />
                </label>
              </div>

              {/* Sound Effect Toggles */}
              <div className="space-y-2.5 pt-1">
                <h4 className="font-extrabold text-[#023246] text-xs uppercase tracking-wider">
                  Efek Suara Perangkat
                </h4>

                <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="font-bold text-slate-800 block">Nada Dering Notifikasi (Chime)</span>
                    <span className="text-[11px] text-slate-500 block">
                      Bunyi chime ding-dong halus saat pemberitahuan baru masuk.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!chimeMuted}
                    onChange={() => setChimeMuted(!chimeMuted)}
                    className="w-5 h-5 accent-[#0D7A5F] cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between p-3 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-slate-200 cursor-pointer transition-colors">
                  <div className="space-y-0.5 pr-2">
                    <span className="font-bold text-slate-800 block">Efek Suara Presensi Berhasil</span>
                    <span className="text-[11px] text-slate-500 block">
                      Bunyi nada konfirmasi sukses saat Anda selesai scan presensi masuk/pulang.
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    checked={!attendanceSoundMuted}
                    onChange={() => setAttendanceSoundMuted(!attendanceSoundMuted)}
                    className="w-5 h-5 accent-[#0D7A5F] cursor-pointer"
                  />
                </label>
              </div>

              {/* Quiet Hours */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-extrabold text-[#023246] text-xs uppercase tracking-wider">
                      Jam Hening (Quiet Hours)
                    </h4>
                    <p className="text-[11px] text-slate-500">Membisukan dering dan suara saat jam istirahat</p>
                  </div>
                  <input
                    type="checkbox"
                    checked={prefs.quiet_hours_enabled}
                    onChange={() => handleToggle('quiet_hours_enabled')}
                    className="w-5 h-5 accent-[#0D7A5F] cursor-pointer"
                  />
                </div>

                {prefs.quiet_hours_enabled && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-200">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Mulai Hening:</label>
                      <input
                        type="time"
                        value={formatTimeForInput(prefs.quiet_hours_start, '21:00')}
                        onChange={(e) => setPrefs((prev) => ({ ...prev, quiet_hours_start: e.target.value }))}
                        className="w-full min-h-11 px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">Selesai Hening:</label>
                      <input
                        type="time"
                        value={formatTimeForInput(prefs.quiet_hours_end, '05:00')}
                        onChange={(e) => setPrefs((prev) => ({ ...prev, quiet_hours_end: e.target.value }))}
                        className="w-full min-h-11 px-3 py-2 bg-white border border-slate-300 rounded-xl font-bold text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="min-h-11 px-4 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="min-h-11 px-5 py-2.5 text-xs font-extrabold text-white bg-[#0D7A5F] hover:bg-[#0b654f] rounded-xl shadow-xs transition-all cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {saving ? 'Menyimpan...' : 'Simpan Preferensi'}
          </button>
        </div>
      </div>
    </div>
  );
};
