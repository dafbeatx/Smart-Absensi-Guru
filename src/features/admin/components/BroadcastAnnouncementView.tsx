import React, { useState, useEffect, useMemo } from 'react';
import type { UserProfile, NotificationSeverity, NotificationAudience, AppNotification } from '../../../types/database.types';
import { AnnouncementRepository } from '../../../repositories/AnnouncementRepository';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { notifySuccess, notifyError, notifyWarning } from '../../../utils/error.utils';
import { logger } from '../../../utils/logger.utils';

interface BroadcastAnnouncementViewProps {
  user: UserProfile | null;
  token?: string | null;
  role: 'ADMIN' | 'KEPSEK' | 'OPERATOR';
  onBackToDashboard?: () => void;
}

export const BroadcastAnnouncementView: React.FC<BroadcastAnnouncementViewProps> = ({
  user,
  token,
  role,
  onBackToDashboard,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<NotificationSeverity>('INFO');
  const [audienceRole, setAudienceRole] = useState<NotificationAudience>('GURU');
  const [actionUrl, setActionUrl] = useState('/?tab=BERANDA');
  const [customActionUrl, setCustomActionUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAntiSpamConfirmed, setIsAntiSpamConfirmed] = useState(false);

  // Anti-Spam Cooldown State
  const [remainingCooldown, setRemainingCooldown] = useState(0);

  // History State
  const [history, setHistory] = useState<AppNotification[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Poll cooldown ticker every second
  useEffect(() => {
    const updateCooldown = () => {
      const res = AnnouncementRepository.checkAntiSpamCooldown();
      setRemainingCooldown(res.remainingSeconds);
    };

    updateCooldown();
    const interval = setInterval(updateCooldown, 1000);
    return () => clearInterval(interval);
  }, []);

  // Fetch history on mount
  useEffect(() => {
    loadHistory();
  }, [token]);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const items = await AnnouncementRepository.getBroadcastHistory(token || undefined, 15);
      setHistory(items);
    } catch (err) {
      logger.warn('BroadcastAnnouncementView', 'Failed to load history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const isDuplicate = useMemo(() => {
    if (!title.trim() || !message.trim()) return false;
    return AnnouncementRepository.checkDuplicateContent(title, message);
  }, [title, message]);

  const effectiveActionUrl = actionUrl === 'CUSTOM' ? customActionUrl.trim() || '/' : actionUrl;

  const handleOpenConfirm = (e: React.FormEvent) => {
    e.preventDefault();

    if (!user) {
      notifyError('Akses Ditolak', 'Sesi login tidak terdeteksi.');
      return;
    }

    if (title.trim().length < 3) {
      notifyWarning('Judul Terlalu Pendek', 'Judul pengumuman minimal 3 karakter.');
      return;
    }

    if (message.trim().length < 5) {
      notifyWarning('Pesan Terlalu Pendek', 'Isi pesan pengumuman minimal 5 karakter.');
      return;
    }

    if (remainingCooldown > 0) {
      notifyWarning(
        'Cooldown Anti-Spam Aktif',
        `Mohon tunggu ${remainingCooldown} detik sebelum mengirim pengumuman baru.`
      );
      return;
    }

    if (isDuplicate) {
      notifyWarning(
        'Pesan Duplikat Terdeteksi',
        'Pesan dengan judul dan isi yang sama persis telah dikirim dalam 1 jam terakhir.'
      );
      return;
    }

    setIsAntiSpamConfirmed(false);
    setIsConfirmModalOpen(true);
  };

  const handleExecutePublish = async () => {
    if (!user) return;
    if (!isAntiSpamConfirmed) {
      notifyWarning('Konfirmasi Wajib', 'Centang kotak pernyataan anti-spam terlebih dahulu.');
      return;
    }

    setIsPublishing(true);
    try {
      const res = await AnnouncementRepository.publishAnnouncement({
        title: title.trim(),
        message: message.trim(),
        severity,
        audience_role: audienceRole,
        action_url: effectiveActionUrl,
        user,
        token: token || undefined,
      });

      if (res.success) {
        notifySuccess(
          'Pengumuman Berhasil Dipublikasikan!',
          res.pushSent
            ? `Notifikasi push terkirim ke ${res.pushCount} HP guru yang aktif.`
            : 'Tersimpan ke database dan disiarkan ke antarmuka aplikasi guru.'
        );

        // Reset form
        setTitle('');
        setMessage('');
        setIsConfirmModalOpen(false);

        // Refresh cooldown and history
        const cooldownCheck = AnnouncementRepository.checkAntiSpamCooldown();
        setRemainingCooldown(cooldownCheck.remainingSeconds);
        loadHistory();
      } else {
        notifyError('Gagal Mengirim', res.error || 'Terjadi kesalahan sistem.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notifyError('Pengiriman Dibatalkan', msg);
    } finally {
      setIsPublishing(false);
    }
  };

  const handleUseFromHistory = (item: AppNotification) => {
    setTitle(item.title);
    setMessage(item.message);
    setSeverity(item.severity || 'INFO');
    setAudienceRole(item.audience_role || 'GURU');
    if (item.action_url) {
      setActionUrl(item.action_url);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notifySuccess('Draft Dimuat', 'Pengumuman disalin ke formulir. Anda dapat mengedit sebelum mengirim.');
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Header */}
      <div className="bg-linear-to-r from-[#023246] via-[#0A4158] to-[#18536B] p-5 sm:p-6 rounded-3xl text-white shadow-lg border border-[#0A4158]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">📢</span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              Pengumuman & Notifikasi HP Guru
            </h2>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[10px] uppercase">
              {role === 'KEPSEK' ? 'Kepala Sekolah' : 'Admin / Operator'}
            </span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xl">
            Tulis dan publikasikan pengumuman sekolah langsung ke layar HP seluruh guru yang mengizinkan notifikasi.
            Dilengkapi proteksi anti-spam cerdas untuk kenyamanan bersama.
          </p>
        </div>

        {onBackToDashboard && (
          <Button
            variant="outline"
            onClick={onBackToDashboard}
            className="shrink-0 bg-white/10 hover:bg-white/20 text-white border-white/20 text-xs font-bold"
          >
            ← Kembali ke Dashboard
          </Button>
        )}
      </div>

      {/* Anti-Spam Status Indicator */}
      <div
        className={`p-4 rounded-2xl border transition-all flex items-center justify-between gap-3 text-xs ${
          remainingCooldown > 0
            ? 'bg-amber-500/10 border-amber-500/30 text-amber-900'
            : isDuplicate
            ? 'bg-red-50 border-red-200 text-red-900'
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-900'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-base shrink-0">
            {remainingCooldown > 0 ? '⏱️' : isDuplicate ? '⚠️' : '🛡️'}
          </span>
          <div>
            <span className="font-extrabold block">
              {remainingCooldown > 0
                ? `Proteksi Anti-Spam Aktif: Tunggu ${remainingCooldown} detik`
                : isDuplicate
                ? 'Peringatan Duplikasi Konten'
                : 'Sistem Siap Kirim (Anti-Spam Siaga)'}
            </span>
            <span className="text-[11px] opacity-80">
              {remainingCooldown > 0
                ? 'Jeda waktu 3 menit diterapkan untuk melindungi konsentrasi guru dari notifikasi bertubi-tubi.'
                : isDuplicate
                ? 'Judul dan isi pesan persis sama dengan pengumuman sebelumnya dalam 1 jam terakhir.'
                : 'Maksimal 1 pengumuman per 3 menit. Notifikasi web push akan berdering di HP guru penerima.'}
            </span>
          </div>
        </div>

        {remainingCooldown > 0 && (
          <span className="px-3 py-1 bg-amber-500 text-slate-950 font-black text-xs rounded-xl font-mono shrink-0">
            {remainingCooldown}s
          </span>
        )}
      </div>

      {/* Main Grid: Composer Form & Live Smartphone Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Form (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <span>✍️</span> Tulis Pengumuman Baru
            </h3>
            <span className="text-[11px] text-slate-400 font-medium">
              Pengirim: <strong>{user?.full_name || 'Admin'}</strong>
            </span>
          </div>

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            {/* Field 1: Judul Pengumuman */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Judul Pengumuman <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                placeholder="Contoh: Rapat Dewan Guru Besok Pukul 08:00 WIB"
                className="w-full text-xs px-3.5 py-2.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-semibold"
                required
              />
              <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>Ringkas, padat, dan mencerminkan inti pesan</span>
                <span>{title.length}/80</span>
              </div>
            </div>

            {/* Field 2: Isi Pesan */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Isi Pesan Notifikasi <span className="text-red-500">*</span>
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={350}
                rows={4}
                placeholder="Tuliskan instruksi, agenda, atau informasi detail yang perlu diketahui oleh guru..."
                className="w-full text-xs p-3 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 leading-relaxed font-normal resize-none"
                required
              />
              <div className="flex justify-between text-[10px] text-slate-400 px-1">
                <span>Akan tampil di lockscreen & notification bar smartphone guru</span>
                <span className={message.length > 300 ? 'text-amber-500 font-bold' : ''}>
                  {message.length}/350
                </span>
              </div>
            </div>

            {/* Field 3: Prioritas / Severity & Target Audience */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Tingkat Urgensi
                </label>
                <select
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value as NotificationSeverity)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                >
                  <option value="INFO">ℹ️ INFO (Biasa / Rutin)</option>
                  <option value="WARNING">⚠️ PENTING (Perlu Perhatian)</option>
                  <option value="CRITICAL">🚨 DARURAT (Mendesak / Jam Tenang)</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  Target Penerima
                </label>
                <select
                  value={audienceRole}
                  onChange={(e) => setAudienceRole(e.target.value as NotificationAudience)}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
                >
                  <option value="GURU">👥 Semua Guru & Staf (GURU)</option>
                  <option value="ALL">🌐 Seluruh Pengguna (Guru, Admin, Kepsek)</option>
                </select>
              </div>
            </div>

            {/* Field 4: Tautan Aksi Aplikasi */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-slate-700">
                Menu Tujuan Saat Notifikasi Ditekan di HP
              </label>
              <select
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-medium"
              >
                <option value="/?tab=BERANDA">🏠 Halaman Beranda Guru</option>
                <option value="/?tab=JADWAL">🗓️ Jadwal Mengajar Guru</option>
                <option value="/?tab=REKAP">📊 Riwayat & Rekap Presensi</option>
                <option value="/?tab=SARPRAS">📦 Inventaris Sarpras</option>
                <option value="CUSTOM">🔗 Tautan Khusus...</option>
              </select>

              {actionUrl === 'CUSTOM' && (
                <input
                  type="text"
                  value={customActionUrl}
                  onChange={(e) => setCustomActionUrl(e.target.value)}
                  placeholder="Contoh: /?tab=KOTAK_ASPIRASI atau URL internal"
                  className="w-full text-xs px-3 py-2 mt-1.5 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              )}
            </div>

            {/* Submit Action */}
            <div className="pt-2">
              <Button
                variant="primary"
                type="submit"
                disabled={remainingCooldown > 0 || isDuplicate || !title.trim() || !message.trim()}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                <span>🚀</span> Publikasikan ke HP Guru
              </Button>
            </div>
          </form>
        </div>

        {/* Right Column: Live Smartphone Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-slate-900 p-5 rounded-3xl text-white shadow-md border border-slate-800 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">📱</span>
                <h4 className="font-bold text-xs text-slate-200">
                  Simulasi Tampilan di Layar HP Guru
                </h4>
              </div>
              <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/20 px-2 py-0.5 rounded-full">
                Live Preview
              </span>
            </div>

            {/* Phone Lockscreen Mockup Container */}
            <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800/80 space-y-3 relative overflow-hidden">
              {/* Simulated Mobile Status Bar */}
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono pb-1 border-b border-slate-900">
                <span>07:45</span>
                <div className="flex items-center gap-1.5">
                  <span>📶 4G</span>
                  <span>🔋 92%</span>
                </div>
              </div>

              {/* Simulated Notification Push Bubble */}
              <div className="bg-slate-900/90 backdrop-blur-md p-3.5 rounded-2xl border border-slate-700/60 shadow-lg space-y-2">
                {/* Notification App Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center text-[10px] font-black">
                      SA
                    </div>
                    <span className="text-[11px] font-extrabold text-slate-200">Smart Absensi</span>
                    <span className="text-[10px] text-slate-400">• sekarang</span>
                  </div>
                  <span
                    className={`px-1.5 py-0.2 rounded-sm text-[9px] font-black uppercase ${
                      severity === 'CRITICAL'
                        ? 'bg-red-500/30 text-red-300'
                        : severity === 'WARNING'
                        ? 'bg-amber-500/30 text-amber-300'
                        : 'bg-sky-500/30 text-sky-300'
                    }`}
                  >
                    {severity}
                  </span>
                </div>

                {/* Content */}
                <div className="space-y-0.5">
                  <h5 className="font-black text-xs text-white leading-snug">
                    {title.trim() || 'Judul pengumuman akan muncul di sini...'}
                  </h5>
                  <p className="text-[11px] text-slate-300 leading-relaxed font-normal line-clamp-3">
                    {message.trim() || 'Isi pesan pengumuman resmi sekolah akan langsung terbaca oleh guru tanpa perlu membuka aplikasi terlebih dahulu.'}
                  </p>
                </div>

                {/* Simulated Action Buttons */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-800/80 text-[10px]">
                  <span className="text-emerald-400 font-bold hover:underline cursor-pointer">
                    📱 Buka Aplikasi
                  </span>
                  <span className="text-slate-500">•</span>
                  <span className="text-slate-400">Tutup</span>
                </div>
              </div>

              {/* Phone Info Legend */}
              <div className="text-[10px] text-slate-400 text-center pt-1 leading-relaxed">
                <span>Perangkat: Infinix Note 8 / Smartphone Android & iOS Guru</span>
              </div>
            </div>

            {/* Audience Scope Card */}
            <div className="bg-slate-800/60 p-3 rounded-2xl border border-slate-700/50 space-y-1 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span>Jangkauan Siaran:</span>
                <span className="text-emerald-400">
                  {audienceRole === 'ALL' ? 'Semua Civitas Sekolah' : 'Seluruh Guru & Staf'}
                </span>
              </div>
              <p className="text-[10px] text-slate-400">
                Pesan akan tersimpan di database dan memicu Service Worker Web Push ke perangkat yang online.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast History Table / List */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="space-y-0.5">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <span>📋</span> Riwayat Pengumuman yang Pernah Dipublikasikan
            </h3>
            <p className="text-xs text-slate-400">
              Daftar siaran notifikasi yang telah dikirim oleh Admin & Kepala Sekolah.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={loadHistory}
            disabled={isLoadingHistory}
            className="text-xs font-bold py-1.5 px-3"
          >
            {isLoadingHistory ? '⏳ Memuat...' : '🔄 Segarkan'}
          </Button>
        </div>

        {history.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 border border-slate-200 rounded-2xl text-slate-400 space-y-1">
            <span className="text-2xl">📭</span>
            <p className="font-bold text-xs text-slate-600">Belum Ada Riwayat Pengumuman</p>
            <p className="text-[11px]">
              Tulis pengumuman pertama Anda di formulir atas untuk memulai siaran ke HP guru.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {history.map((item, idx) => (
              <div
                key={item.id || idx}
                className="p-4 bg-slate-50 border border-slate-200 rounded-2xl hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                        item.severity === 'CRITICAL'
                          ? 'bg-red-100 text-red-800'
                          : item.severity === 'WARNING'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-sky-100 text-sky-800'
                      }`}
                    >
                      {item.severity || 'INFO'}
                    </span>
                    <span className="text-[11px] font-black text-slate-800 truncate">
                      {item.title}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      • {new Date(item.created_at).toLocaleString('id-ID')}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {item.message}
                  </p>
                </div>

                <div className="shrink-0 flex items-center gap-2">
                  <button
                    onClick={() => handleUseFromHistory(item)}
                    className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-2xs"
                    title="Salin pengumuman ini ke formulir"
                  >
                    📋 Gunakan Lagi
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isPublishing && setIsConfirmModalOpen(false)}
        title="📢 Konfirmasi Publikasi Pengumuman ke HP Guru"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-amber-900 space-y-1.5">
            <h5 className="font-extrabold text-sm flex items-center gap-1.5 text-amber-950">
              <span>⚠️</span> Peringatan Siaran Langsung (Live Web Push)
            </h5>
            <p className="text-xs leading-relaxed">
              Notifikasi ini akan <strong>langsung dibunyikan dan dimunculkan di layar kunci (lockscreen) smartphone seluruh guru</strong> yang mengizinkan notifikasi aplikasi.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Judul:</span>
              <p className="font-black text-sm text-slate-900">{title}</p>
            </div>
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Isi Pesan:</span>
              <p className="text-xs text-slate-700 leading-relaxed">{message}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200 text-[11px]">
              <div>
                <span className="text-slate-400">Target:</span>{' '}
                <strong>{audienceRole === 'ALL' ? 'Semua Pengguna' : 'Seluruh Guru'}</strong>
              </div>
              <div>
                <span className="text-slate-400">Prioritas:</span>{' '}
                <strong className={severity === 'CRITICAL' ? 'text-red-600' : 'text-slate-800'}>
                  {severity}
                </strong>
              </div>
            </div>
          </div>

          {/* Anti-Spam Agreement Checkbox */}
          <label className="flex items-start gap-2.5 p-3 rounded-xl border border-slate-200 bg-white cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isAntiSpamConfirmed}
              onChange={(e) => setIsAntiSpamConfirmed(e.target.checked)}
              className="mt-0.5 rounded-sm border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4"
            />
            <span className="text-xs font-bold text-slate-800 leading-snug">
              Saya menyatakan bahwa pengumuman ini resmi, penting untuk dinotifikasikan, dan bukan merupakan spam beruntun.
            </span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsConfirmModalOpen(false)}
              disabled={isPublishing}
              className="text-xs font-bold"
            >
              Batal
            </Button>
            <Button
              variant="primary"
              onClick={handleExecutePublish}
              disabled={isPublishing || !isAntiSpamConfirmed}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 shadow-sm"
            >
              {isPublishing ? '⏳ Mempublikasikan...' : '🚀 Ya, Publikasikan Sekarang'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
