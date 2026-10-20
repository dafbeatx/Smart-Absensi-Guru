import React, { useState, useEffect, useMemo } from 'react';
import type { UserProfile, NotificationSeverity, NotificationAudience, AppNotification } from '../../../types/database.types';
import { AnnouncementRepository } from '../../../repositories/AnnouncementRepository';
import { ProviderFactory } from '../../../providers/provider-factory';
import { Button } from '../../../components/ui/Button';
import { Modal } from '../../../components/ui/Modal';
import { notifySuccess, notifyError, notifyWarning } from '../../../utils/error.utils';
import { logger } from '../../../utils/logger.utils';

export type TargetScope = 'GURU' | 'ADMIN' | 'KEPSEK' | 'ALL' | 'SPECIFIC_USER';

interface BroadcastAnnouncementViewProps {
  user: UserProfile | null;
  token?: string | null;
  role: 'ADMIN' | 'KEPSEK' | 'OPERATOR';
  onBackToDashboard?: () => void;
}

export const BroadcastAnnouncementView: React.FC<BroadcastAnnouncementViewProps> = ({
  user,
  token,
  role: _role,
  onBackToDashboard,
}) => {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [severity, setSeverity] = useState<NotificationSeverity>('INFO');
  const [targetScope, setTargetScope] = useState<TargetScope>('GURU');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [actionUrl, setActionUrl] = useState('/?tab=BERANDA');
  const [customActionUrl, setCustomActionUrl] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isAntiSpamConfirmed, setIsAntiSpamConfirmed] = useState(false);

  // Users Directory State (Guru, Admin, Kepsek)
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);

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

  // Fetch users directory on mount
  useEffect(() => {
    loadUsers();
  }, [token]);

  // Fetch history on mount
  useEffect(() => {
    loadHistory();
  }, [token]);

  const loadUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const provider = ProviderFactory.getProvider();
      let users: UserProfile[] = [];
      if (typeof (provider as any).getAllUsers === 'function') {
        users = await provider.getAllUsers(token || '');
      } else if (typeof (provider as any).getRegisteredTeachers === 'function') {
        users = await (provider as any).getRegisteredTeachers(token);
      }

      if (!users || users.length === 0) {
        try {
          const cached = localStorage.getItem('smart_absensi_teachers');
          if (cached) users = JSON.parse(cached);
        } catch (_) {}
      }

      // Sort users: KEPSEK first, then ADMIN/OPERATOR, then GURU, and alphabetical by full_name
      const roleWeight: Record<string, number> = { KEPSEK: 1, ADMIN: 2, OPERATOR: 3, GURU: 4 };
      const sorted = [...(users || [])].sort((a, b) => {
        const weightA = roleWeight[a.role] || 99;
        const weightB = roleWeight[b.role] || 99;
        if (weightA !== weightB) return weightA - weightB;
        return a.full_name.localeCompare(b.full_name, 'id');
      });

      setUsersList(sorted);
    } catch (err) {
      logger.warn('BroadcastAnnouncementView', 'Failed to load users list:', err);
    } finally {
      setIsLoadingUsers(false);
    }
  };

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

  // Filtered users for specific recipient dropdown
  const filteredUsers = useMemo(() => {
    if (!userSearchQuery.trim()) return usersList;
    const q = userSearchQuery.trim().toLowerCase();
    return usersList.filter(
      (u) =>
        u.full_name.toLowerCase().includes(q) ||
        (u.npp && u.npp.toLowerCase().includes(q)) ||
        (u.nip && u.nip.toLowerCase().includes(q)) ||
        u.role.toLowerCase().includes(q)
    );
  }, [usersList, userSearchQuery]);

  const guruUsers = useMemo(() => filteredUsers.filter((u) => u.role === 'GURU'), [filteredUsers]);
  const kepsekUsers = useMemo(() => filteredUsers.filter((u) => u.role === 'KEPSEK'), [filteredUsers]);
  const adminUsers = useMemo(
    () => filteredUsers.filter((u) => u.role === 'ADMIN' || u.role === 'OPERATOR'),
    [filteredUsers]
  );

  const selectedUser = useMemo(() => {
    return usersList.find((u) => u.id === selectedUserId) || null;
  }, [usersList, selectedUserId]);

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

    if (targetScope === 'SPECIFIC_USER' && !selectedUserId) {
      notifyWarning('Penerima Belum Dipilih', 'Silakan pilih satu nama guru, admin, atau kepsek dari dropdown penerima.');
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

    if (targetScope === 'SPECIFIC_USER' && !selectedUserId) {
      notifyWarning('Penerima Belum Dipilih', 'Silakan tentukan pegawai penerima notifikasi.');
      return;
    }

    setIsPublishing(true);
    try {
      const isSpecific = targetScope === 'SPECIFIC_USER';
      const audience_role = isSpecific ? undefined : (targetScope as NotificationAudience);
      const target_user_id = isSpecific ? selectedUserId : null;
      const target_user_name = isSpecific && selectedUser ? selectedUser.full_name : null;

      const res = await AnnouncementRepository.publishAnnouncement({
        title: title.trim(),
        message: message.trim(),
        severity,
        audience_role,
        target_user_id,
        target_user_name,
        action_url: effectiveActionUrl,
        user,
        token: token || undefined,
      });

      if (res.success) {
        let recipientFeedback = 'semua HP guru yang aktif';
        if (isSpecific && selectedUser) {
          recipientFeedback = `HP ${selectedUser.full_name} (${selectedUser.role})`;
        } else if (targetScope === 'ADMIN') {
          recipientFeedback = 'seluruh Administrator sekolah';
        } else if (targetScope === 'KEPSEK') {
          recipientFeedback = 'Kepala Sekolah';
        } else if (targetScope === 'ALL') {
          recipientFeedback = 'seluruh civitas sekolah (Guru, Admin, & Kepsek)';
        }

        notifySuccess(
          'Pengumuman Berhasil Dipublikasikan!',
          res.pushSent
            ? `Notifikasi push terkirim ke ${recipientFeedback}.`
            : `Tersimpan ke database dan diarahkan ke ${recipientFeedback}.`
        );

        // Reset form
        setTitle('');
        setMessage('');
        if (targetScope === 'SPECIFIC_USER') {
          setSelectedUserId('');
        }
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

    if (item.recipient_user_id) {
      setTargetScope('SPECIFIC_USER');
      setSelectedUserId(item.recipient_user_id);
    } else if (item.audience_role) {
      setTargetScope(item.audience_role as TargetScope);
      setSelectedUserId('');
    } else {
      setTargetScope('GURU');
      setSelectedUserId('');
    }

    if (item.action_url) {
      setActionUrl(item.action_url);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
    notifySuccess('Draft Dimuat', 'Pengumuman disalin ke formulir. Anda dapat mengedit sebelum mengirim.');
  };

  const getTargetScopeLabel = (scope: TargetScope, specificUser?: UserProfile | null) => {
    switch (scope) {
      case 'SPECIFIC_USER':
        return specificUser
          ? `👤 1 Orang: ${specificUser.full_name} (${specificUser.role})`
          : '👤 1 Orang Tertentu (Pilih Nama Pegawai)';
      case 'GURU':
        return '👥 Dewan Guru & Staf (GURU Saja)';
      case 'ADMIN':
        return '🛡️ Administrator Saja (ADMIN)';
      case 'KEPSEK':
        return '🏛️ Kepala Sekolah (KEPSEK Saja)';
      case 'ALL':
        return '🌐 Semua Pengguna (Guru, Admin, Kepsek)';
      default:
        return '👥 Seluruh Guru';
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top Banner Header */}
      <div className="bg-linear-to-r from-[#023246] via-[#0A4158] to-[#18536B] p-5 sm:p-6 rounded-3xl text-white shadow-lg border border-[#0A4158]/40 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-2xl">📢</span>
            <h2 className="text-lg sm:text-xl font-black text-white">
              Pengumuman &amp; Notifikasi Siaran
            </h2>
            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              Web Push Multi-Target
            </span>
          </div>
          <p className="text-xs text-slate-300 font-medium max-w-2xl leading-relaxed">
            Kirimkan pengumuman resmi ke seluruh guru, admin saja, kepala sekolah saja, atau khusus ke 1 guru/pegawai tertentu langsung ke layar kunci (lockscreen) smartphone.
          </p>
        </div>

        {onBackToDashboard && (
          <Button
            variant="outline"
            onClick={onBackToDashboard}
            className="text-xs font-bold border-white/20 text-white hover:bg-white/10 shrink-0 self-start sm:self-auto"
          >
            ← Kembali ke Dashboard
          </Button>
        )}
      </div>

      {/* Main Grid: Form (7 cols) + Mobile Preview (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Form Editor (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-5">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
                <span>✍️</span> Tulis Pesan Pengumuman
              </h3>
              <p className="text-xs text-slate-400">
                Pesan akan langsung diproses oleh server notifikasi push.
              </p>
            </div>

            {/* Anti-spam Cooldown Badge */}
            {remainingCooldown > 0 ? (
              <span className="px-3 py-1 bg-amber-50 border border-amber-300 text-amber-800 text-xs font-black rounded-xl animate-pulse flex items-center gap-1.5 shadow-2xs">
                <span>⏱️</span>
                <span>Cooldown: {remainingCooldown}s</span>
              </span>
            ) : (
              <span className="px-3 py-1 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-1 shadow-2xs">
                <span>✅</span>
                <span>Siap Kirim</span>
              </span>
            )}
          </div>

          <form onSubmit={handleOpenConfirm} className="space-y-4">
            {/* Field 1: Judul Pengumuman */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Judul Pengumuman <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    title.length > 80 ? 'text-rose-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {title.length}/80 karakter
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Contoh: Rapat Evaluasi Bulanan &amp; Penyerahan Rapor"
                maxLength={80}
                required
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 font-semibold"
              />
            </div>

            {/* Field 2: Isi Pesan */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-700">
                  Isi Pesan Pengumuman <span className="text-rose-500">*</span>
                </label>
                <span
                  className={`text-[10px] font-mono ${
                    message.length > 350 ? 'text-rose-600 font-bold' : 'text-slate-400'
                  }`}
                >
                  {message.length}/350 karakter
                </span>
              </div>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Tuliskan isi pengumuman dengan jelas dan ringkas agar mudah dibaca pada notifikasi layar kunci smartphone..."
                maxLength={350}
                rows={4}
                required
                className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-900 leading-relaxed"
              />
            </div>

            {/* Field 3: Tingkat Urgensi & Target Scope */}
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
                  value={targetScope}
                  onChange={(e) => {
                    const nextScope = e.target.value as TargetScope;
                    setTargetScope(nextScope);
                    if (nextScope !== 'SPECIFIC_USER') {
                      setSelectedUserId('');
                    }
                  }}
                  className="w-full text-xs px-3 py-2 bg-white border border-slate-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-emerald-500 text-slate-800 font-bold"
                >
                  <option value="GURU">👥 Seluruh Guru Saja (GURU)</option>
                  <option value="ADMIN">🛡️ Administrator Saja (ADMIN)</option>
                  <option value="KEPSEK">🏛️ Kepala Sekolah Saja (KEPSEK)</option>
                  <option value="ALL">🌐 Semua Pengguna (Guru, Admin, Kepsek)</option>
                  <option value="SPECIFIC_USER">👤 1 Orang Tertentu (Pilih Nama Pegawai)</option>
                </select>
              </div>
            </div>

            {/* Conditional Field: Specific User Picker Dropdown */}
            {targetScope === 'SPECIFIC_USER' && (
              <div className="p-4 bg-sky-50/70 border border-sky-200 rounded-2xl space-y-2.5 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-black text-sky-950 flex items-center gap-1.5">
                    <span>👤</span>
                    <span>Pilih Nama Guru / Pegawai Penerima</span>
                  </label>
                  <span className="text-[10px] text-sky-800 font-bold bg-sky-100 px-2 py-0.5 rounded-full">
                    {usersList.length} Pegawai Terdaftar
                  </span>
                </div>

                {/* Filter Search Input */}
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="🔍 Cari nama guru, admin, kepsek, atau NPP..."
                  className="w-full text-xs px-3 py-1.5 bg-white border border-sky-200 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900"
                />

                {/* Main Dropdown Select */}
                <select
                  value={selectedUserId}
                  onChange={(e) => setSelectedUserId(e.target.value)}
                  disabled={isLoadingUsers}
                  required
                  className="w-full text-xs px-3 py-2.5 bg-white border border-sky-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-sky-500 text-slate-900 font-semibold shadow-2xs"
                >
                  <option value="">-- Klik untuk memilih nama penerima --</option>

                  {/* Group: Dewan Guru */}
                  {guruUsers.length > 0 && (
                    <optgroup label="🎓 Dewan Guru &amp; Tenaga Pendidik">
                      {guruUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} — GURU (NPP: {u.npp || u.nip || '-'})
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Group: Kepala Sekolah */}
                  {kepsekUsers.length > 0 && (
                    <optgroup label="🏛️ Kepala Sekolah &amp; Pimpinan">
                      {kepsekUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} — KEPSEK (NPP: {u.npp || u.nip || '-'})
                        </option>
                      ))}
                    </optgroup>
                  )}

                  {/* Group: Administrator & Operator */}
                  {adminUsers.length > 0 && (
                    <optgroup label="🛡️ Administrator &amp; Operator">
                      {adminUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.full_name} — {u.role} (NPP: {u.npp || u.nip || '-'})
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>

                {/* Selected User Info Card */}
                {selectedUser ? (
                  <div className="flex items-center gap-3 p-2.5 bg-white border border-sky-200 rounded-xl text-xs shadow-2xs">
                    <div className="w-8 h-8 rounded-full bg-sky-600 text-white flex items-center justify-center font-black text-xs shrink-0 shadow-2xs">
                      {selectedUser.avatar_url ? (
                        <img
                          src={selectedUser.avatar_url}
                          alt=""
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        selectedUser.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-slate-900 truncate">{selectedUser.full_name}</p>
                      <p className="text-[10px] text-slate-500 font-medium">
                        Peran: <strong className="text-sky-800">{selectedUser.role}</strong> • NPP:{' '}
                        <strong>{selectedUser.npp || selectedUser.nip || '-'}</strong>
                      </p>
                    </div>
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[10px] font-black shrink-0">
                      🎯 Terpilih
                    </span>
                  </div>
                ) : (
                  <p className="text-[10px] text-amber-800 font-bold flex items-center gap-1">
                    <span>⚠️</span> Wajib memilih satu nama dari daftar di atas sebelum mengirim pesan.
                  </p>
                )}
              </div>
            )}

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
                <option value="/?tab=REKAP">📊 Riwayat &amp; Rekap Presensi</option>
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
                disabled={
                  remainingCooldown > 0 ||
                  isDuplicate ||
                  !title.trim() ||
                  !message.trim() ||
                  (targetScope === 'SPECIFIC_USER' && !selectedUserId)
                }
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs shadow-md active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>🚀</span>
                <span>
                  {targetScope === 'SPECIFIC_USER' && selectedUser
                    ? `Kirim Pesan ke ${selectedUser.full_name}`
                    : targetScope === 'ADMIN'
                    ? 'Publikasikan ke HP Seluruh Administrator'
                    : targetScope === 'KEPSEK'
                    ? 'Publikasikan ke HP Kepala Sekolah'
                    : targetScope === 'ALL'
                    ? 'Publikasikan ke Semua Pengguna Sekolah'
                    : 'Publikasikan ke Seluruh HP Guru'}
                </span>
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
                  Simulasi Tampilan di Layar HP
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
                    {message.trim() ||
                      'Isi pesan pengumuman resmi sekolah akan langsung terbaca oleh penerima tanpa perlu membuka aplikasi terlebih dahulu.'}
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
                <span>Perangkat: Infinix Note 8 / Smartphone Android &amp; iOS</span>
              </div>
            </div>

            {/* Audience Scope Card */}
            <div className="bg-slate-800/60 p-3.5 rounded-2xl border border-slate-700/50 space-y-1.5 text-xs">
              <div className="flex items-center justify-between text-slate-300 font-bold">
                <span>Target Penerima:</span>
                <span className="text-emerald-400 text-right truncate max-w-50">
                  {getTargetScopeLabel(targetScope, selectedUser)}
                </span>
              </div>
              <p className="text-[10px] text-slate-400 leading-relaxed">
                {targetScope === 'SPECIFIC_USER'
                  ? 'Notifikasi personal hanya akan dikirimkan dan terbaca di HP pengguna yang dipilih secara eksklusif.'
                  : 'Pesan akan disimpan di database dan memicu Service Worker Web Push ke perangkat yang online.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Broadcast History Table / List */}
      <div className="bg-white p-5 sm:p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
          <div className="space-y-0.5">
            <h3 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <span>📋</span> Riwayat Pengumuman yang Pernah Dipublikasikan
            </h3>
            <p className="text-xs text-slate-400">
              Daftar siaran dan pesan langsung yang telah dikirim oleh Admin &amp; Kepala Sekolah.
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
            {history.map((item, idx) => {
              const isPersonal = Boolean(item.recipient_user_id || item.target_user_name);
              return (
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

                      {/* Target Audience Badge */}
                      {isPersonal ? (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-blue-100 text-blue-900 border border-blue-200 flex items-center gap-1">
                          <span>👤</span>
                          <span>{item.target_user_name ? `Untuk: ${item.target_user_name}` : '1 Orang Tertentu'}</span>
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[9px] font-black bg-slate-200 text-slate-800">
                          {item.audience_role === 'ADMIN'
                            ? '🛡️ Admin Saja'
                            : item.audience_role === 'KEPSEK'
                            ? '🏛️ Kepsek Saja'
                            : item.audience_role === 'ALL'
                            ? '🌐 Semua Pengguna'
                            : '👥 Guru Saja'}
                        </span>
                      )}

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
              );
            })}
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={isConfirmModalOpen}
        onClose={() => !isPublishing && setIsConfirmModalOpen(false)}
        title="📢 Konfirmasi Publikasi Pengumuman ke HP"
      >
        <div className="space-y-4 text-xs text-slate-700">
          <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-2xl text-amber-900 space-y-1.5">
            <h5 className="font-extrabold text-sm flex items-center gap-1.5 text-amber-950">
              <span>⚠️</span> Peringatan Siaran Langsung (Live Web Push)
            </h5>
            <p className="text-xs leading-relaxed">
              Notifikasi ini akan <strong>langsung dibunyikan dan dimunculkan di layar kunci (lockscreen) smartphone penerima</strong> yang mengizinkan notifikasi aplikasi.
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
                <span className="text-slate-400">Target Penerima:</span>{' '}
                <strong className="text-slate-900 block truncate">
                  {getTargetScopeLabel(targetScope, selectedUser)}
                </strong>
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black px-5 shadow-sm cursor-pointer"
            >
              {isPublishing ? '⏳ Mempublikasikan...' : '🚀 Ya, Publikasikan Sekarang'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
