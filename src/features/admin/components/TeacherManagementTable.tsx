import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { AuditLogger } from '../../../services/audit-logger.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { UserProfile, RoleCode } from '../../../types/database.types';
import { convertToWebP } from '../../../utils/image.utils';
import { handleAppError } from '../../../utils/error.utils';

export interface TeacherManagementTableProps {
  teachers: UserProfile[];
  onTeachersChange: (updatedTeachers: UserProfile[]) => void;
  isReadOnly?: boolean;
  syncStatus?: 'LIVE_SERVER' | 'OFFLINE_CACHE' | 'ERROR_FALLBACK';
}

export const TeacherManagementTable: React.FC<TeacherManagementTableProps> = ({
  teachers,
  onTeachersChange,
  isReadOnly = false,
  syncStatus = 'LIVE_SERVER',
}) => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const effectiveReadOnly = isReadOnly || user?.role === 'KEPSEK';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'GURU' | 'KEPSEK' | 'ADMIN'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [nip, setNip] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<RoleCode>('GURU');
  const [newPin, setNewPin] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.nip && t.nip.includes(searchQuery)) ||
      String(t.phone_number || '').includes(searchQuery);

    const matchesRole =
      filterRole === 'ALL' ||
      t.role === filterRole ||
      (filterRole === 'ADMIN' && (t.role === 'ADMIN' || t.role === 'OPERATOR'));
    return matchesSearch && matchesRole;
  });

  const handleAddTeacher = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveReadOnly) {
      showToast('warning', 'Akses Ditolak', 'Peran Kepala Sekolah / Mode Lihat Saja tidak dapat menambah akun guru.');
      return;
    }
    const newTeacher: UserProfile = {
      id: 'usr_' + Date.now(),
      nip: nip.trim() ? nip.trim() : null,
      full_name: fullName,
      phone_number: phone,
      role,
      position,
      avatar_url: avatarUrl,
      is_active: true,
      must_change_pin: true,
      created_at: new Date().toISOString(),
    };

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      const createdUser = await provider.createUser(newTeacher, token);
      const savedUser = createdUser || newTeacher;

      const updated = [...teachers, savedUser];
      onTeachersChange(updated);
      try {
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to cache teachers to localStorage:', e);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_teachers_updated'));

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'ADD_USER',
        targetEntity: 'Users',
        newValue: JSON.stringify(savedUser),
        reason: `Pendaftaran akun ${role} baru oleh Admin Website: ${fullName}`,
      });

      showToast(
        'success',
        'Pengguna Berhasil Ditambahkan!',
        `${fullName} (${role}) telah terdaftar dengan PIN awal default: 123456.`
      );
      setIsAddModalOpen(false);
      setFullName('');
      setNip('');
      setPhone('');
      setPosition('');
      setAvatarUrl(null);
    } catch (err: unknown) {
      handleAppError(err, 'TeacherManagementTable.handleAddTeacher', 'Gagal Menambahkan Pengguna Baru');
    }
  };

  const handleOpenEditModal = (t: UserProfile) => {
    if (effectiveReadOnly) {
      showToast('warning', 'Akses Ditolak', 'Peran Kepala Sekolah / Mode Lihat Saja tidak dapat mengubah data akun guru.');
      return;
    }
    setSelectedTeacher(t);
    setFullName(t.full_name);
    setNip(t.nip && !t.nip.startsWith('NIP_') ? t.nip : '');
    setPhone(t.phone_number || '');
    setPosition(t.position || '');
    setRole(t.role);
    setAvatarUrl(t.avatar_url || null);
    setIsEditModalOpen(true);
  };

  const handleOpenPhotoModal = (t: UserProfile) => {
    if (effectiveReadOnly) {
      showToast('warning', 'Akses Ditolak', 'Peran Kepala Sekolah / Mode Lihat Saja tidak dapat mengubah foto profil.');
      return;
    }
    setSelectedTeacher(t);
    setAvatarUrl(t.avatar_url || null);
    setIsPhotoModalOpen(true);
  };

  const handleSavePhotoDirectly = async () => {
    if (effectiveReadOnly || !selectedTeacher) return;

    const updates: Partial<UserProfile> = {
      avatar_url: avatarUrl,
    };

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.updateUser(selectedTeacher.id, updates, token);

      const updated = teachers.map((t) =>
        t.id === selectedTeacher.id ? { ...t, avatar_url: avatarUrl } : t
      );
      onTeachersChange(updated);
      try {
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to cache teachers to localStorage:', e);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_teachers_updated'));

      if (user && selectedTeacher && (user.id === selectedTeacher.id || user.nip === selectedTeacher.nip)) {
        useAuthStore.getState().updateUserProfile(updates);
      }

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'EDIT_USER_PHOTO',
        targetEntity: 'Users',
        newValue: JSON.stringify({ user_id: selectedTeacher.id, avatar_url: avatarUrl }),
        reason: `Pembaruan foto profil guru ${selectedTeacher.full_name} oleh Admin Website`,
      });

      showToast('success', 'Foto Profil Berhasil Disimpan!', `Foto profil ${selectedTeacher.full_name} telah tersinkronisasi ke seluruh perangkat.`);
      setIsPhotoModalOpen(false);
    } catch (err: unknown) {
      handleAppError(err, 'TeacherManagementTable.handleSavePhotoDirectly', 'Gagal Menyimpan Foto Profil');
    }
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (effectiveReadOnly) return;
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      showToast('error', 'File Terlalu Besar', 'Maksimal ukuran foto profile adalah 10MB.');
      return;
    }

    setIsUploadingAvatar(true);
    try {
      // Auto convert to WebP (max 400x400px, 80% quality)
      const webpFile = await convertToWebP(file, 400, 400, 0.8);
      const originalKb = (file.size / 1024).toFixed(1);
      const compressedKb = (webpFile.size / 1024).toFixed(1);

      const provider = ProviderFactory.getProvider();
      let uploadedUrl = '';
      if (selectedTeacher && 'uploadAvatar' in provider && typeof (provider as any).uploadAvatar === 'function') {
        uploadedUrl = await (provider as any).uploadAvatar(selectedTeacher.id, webpFile);
      } else {
        uploadedUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = (err) => reject(err);
          reader.readAsDataURL(webpFile);
        });
      }
      setAvatarUrl(uploadedUrl);
      showToast(
        'success',
        'Foto Berhasil Dikompresi (WebP)!',
        `Ukuran foto diperkecil dari ${originalKb} KB menjadi ${compressedKb} KB (Hemat Storage Supabase).`
      );
    } catch (err) {
      console.warn('Failed to upload avatar:', err);
      showToast('error', 'Gagal Unggah Foto', 'Gagal memproses & mengompresi foto profil.');
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleEditTeacherSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (effectiveReadOnly || !selectedTeacher) return;

    const updates: Partial<UserProfile> = {
      full_name: fullName,
      nip: nip.trim() ? nip.trim() : null,
      phone_number: phone,
      position: position,
      role: role,
      avatar_url: avatarUrl,
    };

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.updateUser(selectedTeacher.id, updates, token);

      const updated = teachers.map((t) =>
        t.id === selectedTeacher.id ? { ...t, ...updates } : t
      );
      onTeachersChange(updated);
      try {
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to cache teachers to localStorage:', e);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_teachers_updated'));

      if (user && selectedTeacher && (user.id === selectedTeacher.id || (Boolean(user.nip) && user.nip === selectedTeacher.nip))) {
        useAuthStore.getState().updateUserProfile(updates);
      }

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'EDIT_USER',
        targetEntity: 'Users',
        newValue: JSON.stringify(updates),
        reason: `Pembaruan data akun ${fullName} (${role}) oleh Admin Website`,
      });

      showToast('success', 'Data Pengguna Berhasil Diperbarui!', `Profil ${fullName} telah diperbarui di database & frontend.`);
      setIsEditModalOpen(false);
    } catch (err: unknown) {
      handleAppError(err, 'TeacherManagementTable.handleEditTeacherSubmit', 'Gagal Memperbarui Data Pengguna');
    }
  };

  const handleResetPin = async () => {
    if (effectiveReadOnly || !selectedTeacher || newPin.length !== 6) return;

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.resetPin(selectedTeacher.id, newPin, token);

      const updated = teachers.map((t) =>
        t.id === selectedTeacher.id ? { ...t, must_change_pin: true } : t
      );
      onTeachersChange(updated);
      try {
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to cache teachers to localStorage:', e);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_teachers_updated'));

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'RESET_PIN',
        targetEntity: 'Users',
        newValue: JSON.stringify({ pin_reset: true, must_change_pin: true }),
        reason: `Reset PIN 6-digit oleh Admin Website untuk ${selectedTeacher.full_name}`,
      });

      showToast('success', 'Reset PIN Berhasil!', `PIN sementara untuk ${selectedTeacher.full_name} adalah ${newPin} (Wajib reset di login berikutnya).`);
      setIsResetPinOpen(false);
      setSelectedTeacher(null);
      setNewPin('');
    } catch (err: unknown) {
      handleAppError(err, 'TeacherManagementTable.handleResetPin', 'Gagal Melakukan Reset PIN');
    }
  };

  const handleResetDevice = async (teacher: UserProfile) => {
    if (effectiveReadOnly) {
      showToast('warning', 'Akses Ditolak', 'Mode Lihat Saja (Read-Only) tidak dapat melepaskan ikatan HP.');
      return;
    }
    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.resetDevice(teacher.id, token);

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'RESET_DEVICE',
        targetEntity: 'Device_Binding',
        newValue: JSON.stringify({ device_unbound: true }),
        reason: `Reset ikatan HP oleh Admin Website untuk ${teacher.full_name}`,
      });

      showToast('success', 'Reset Perangkat Berhasil!', `Ikatan HP untuk ${teacher.full_name} telah dilepas.`);
    } catch (err: unknown) {
      handleAppError(err, 'TeacherManagementTable.handleResetDevice', 'Gagal Melepas Ikatan Perangkat');
    }
  };

  const handleToggleStatus = async (teacher: UserProfile) => {
    if (effectiveReadOnly) {
      showToast('warning', 'Akses Ditolak', 'Mode Lihat Saja (Read-Only) tidak dapat menguji/mengubah status akun.');
      return;
    }
    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.toggleUserStatus(teacher.id, token);

      const updated = teachers.map((t) =>
        t.id === teacher.id ? { ...t, is_active: !t.is_active } : t
      );
      onTeachersChange(updated);
      try {
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to cache teachers to localStorage:', e);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_teachers_updated'));

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'TOGGLE_USER_STATUS',
        targetEntity: 'Users',
        oldValue: JSON.stringify({ is_active: teacher.is_active }),
        newValue: JSON.stringify({ is_active: !teacher.is_active }),
        reason: `Mengubah status keaktifan akun ${teacher.full_name}`,
      });

      showToast('info', 'Status Akun Diperbarui', `${teacher.full_name} kini ${!teacher.is_active ? 'Aktif' : 'Non-Aktif'}.`);
    } catch (err: unknown) {
      handleAppError(err, 'TeacherManagementTable.handleToggleStatus', 'Gagal Mengubah Status Keaktifan Akun');
    }
  };

  const handleDeleteTeacher = async () => {
    if (effectiveReadOnly || !selectedTeacher) return;

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.deleteUser(selectedTeacher.id, token);

      const updated = teachers.filter((t) => t.id !== selectedTeacher.id);
      onTeachersChange(updated);
      try {
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
      } catch (e) {
        console.warn('Failed to cache teachers to localStorage:', e);
      }
      window.dispatchEvent(new CustomEvent('smart_absensi_teachers_updated'));

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'DELETE_USER',
        targetEntity: 'Users',
        oldValue: JSON.stringify(selectedTeacher),
        reason: `Penghapusan akun ${selectedTeacher.role} oleh Admin Website: ${selectedTeacher.full_name}`,
      });

      showToast('success', 'Pengguna Berhasil Dihapus!', `Akun ${selectedTeacher.full_name} telah dihapus.`);
      setIsDeleteModalOpen(false);
      setSelectedTeacher(null);
    } catch (err: unknown) {
      handleAppError(err, 'TeacherManagementTable.handleDeleteTeacher', 'Gagal Menghapus Pengguna');
    }
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-card space-y-4">
      {/* Data Sync Status Badge & Warning Banner */}
      {syncStatus === 'ERROR_FALLBACK' && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-2xl flex items-center justify-between text-xs text-red-800 font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping shrink-0" />
            <span>⚠️ <strong>ERROR_FALLBACK</strong>: Gagal terhubung ke database Supabase Cloud. Menampilkan data simulasi lokal (offline fallback).</span>
          </div>
          <span className="px-2 py-0.5 bg-red-200/80 text-red-900 rounded-full font-mono text-[10px] shrink-0">DATA_DUMMY_FALLBACK</span>
        </div>
      )}

      {syncStatus === 'OFFLINE_CACHE' && (
        <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-between text-xs text-amber-900 font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
            <span>📦 <strong>OFFLINE_CACHE</strong>: Menampilkan data pengguna dari cache lokal browser (localStorage). Menyambungkan ke Supabase...</span>
          </div>
          <span className="px-2 py-0.5 bg-amber-200/80 text-amber-950 rounded-full font-mono text-[10px] shrink-0">OFFLINE_CACHE</span>
        </div>
      )}

      {syncStatus === 'LIVE_SERVER' && (
        <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-bold">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
            <span>🟢 <strong>LIVE_SERVER</strong>: Data pengguna tersinkronisasi 100% secara real-time dari Supabase Cloud PostgreSQL.</span>
          </div>
          <span className="px-2 py-0.5 bg-emerald-200/80 text-emerald-950 rounded-full font-mono text-[10px] shrink-0">ONLINE_CLOUD</span>
        </div>
      )}

      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-slate-900 text-sm">Direktori Master Data Pengguna & Guru</h3>
            {effectiveReadOnly && (
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                👁️ Mode Lihat (Kepala Sekolah)
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500">{filteredTeachers.length} pengguna terdaftar</p>
        </div>

        {!effectiveReadOnly && (
          <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
            + Tambah Pengguna Baru
          </Button>
        )}
      </div>

      {/* Filter & Search Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Input
          placeholder="Cari Nama, NPP, atau WA..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        <div className="flex gap-1.5 items-center">
          {(['ALL', 'GURU', 'KEPSEK', 'ADMIN'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                filterRole === r
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r === 'ADMIN' ? 'ADMIN WEBSITE' : r}
            </button>
          ))}
        </div>
      </div>

      {/* ── MOBILE CARD VIEW (<640px) for Infinix Note 8 & Smartphone Viewports ── */}
      <div className="block sm:hidden space-y-3">
        {filteredTeachers.length === 0 ? (
          <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-bold">
            Tidak ada pengguna terdaftar yang sesuai pencarian.
          </div>
        ) : (
          filteredTeachers.map((t) => (
            <div key={t.id} className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
              {/* Header: Avatar, Name, NPP & Active Badge */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-sm shrink-0 overflow-hidden border border-slate-200 shadow-2xs">
                    {t.avatar_url ? (
                      <img src={t.avatar_url} alt={t.full_name} className="w-full h-full object-cover" />
                    ) : (
                      t.full_name.charAt(0)
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="font-extrabold text-slate-900 text-xs sm:text-sm truncate">{t.full_name}</p>
                    <p className="text-[10px] font-mono text-slate-500">NPP: {t.nip || '-'}</p>
                  </div>
                </div>

                <span className={`px-2 py-0.5 rounded-full text-[9px] font-black shrink-0 ${
                  t.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {t.is_active ? 'Aktif' : 'Non-Aktif'}
                </span>
              </div>

              {/* Body: Role & Position */}
              <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1 border-t border-slate-100 text-xs">
                <div className="space-y-0.5 min-w-0">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[9px] font-black ${
                    t.role === 'KEPSEK' ? 'bg-amber-100 text-amber-800' : t.role === 'ADMIN' || t.role === 'OPERATOR' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {t.role === 'ADMIN' || t.role === 'OPERATOR' ? 'ADMIN WEBSITE' : t.role}
                  </span>
                  <p className="text-[11px] font-semibold text-slate-600 truncate">{t.position || 'Tenaga Pendidik'}</p>
                </div>
                <span className="text-[11px] font-mono font-medium text-slate-500">💬 {t.phone_number || '-'}</span>
              </div>

              {/* Action Buttons Grid (Touch-friendly 44px min-target) */}
              {!effectiveReadOnly ? (
                <div className="grid grid-cols-4 gap-1.5 pt-1">
                  <button
                    onClick={() => handleOpenEditModal(t)}
                    className="py-1.5 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-extrabold text-[10px] rounded-xl border border-emerald-200 transition-colors text-center active:scale-95"
                  >
                    ✏️ Edit
                  </button>
                  <button
                    onClick={() => handleOpenPhotoModal(t)}
                    className="py-1.5 px-2 bg-purple-50 hover:bg-purple-100 text-purple-700 font-extrabold text-[10px] rounded-xl border border-purple-200 transition-colors text-center active:scale-95"
                  >
                    📷 Foto
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTeacher(t);
                      setIsResetPinOpen(true);
                    }}
                    className="py-1.5 px-2 bg-amber-50 hover:bg-amber-100 text-amber-700 font-extrabold text-[10px] rounded-xl border border-amber-200 transition-colors text-center active:scale-95"
                  >
                    🔑 PIN
                  </button>
                  <button
                    onClick={() => handleResetDevice(t)}
                    className="py-1.5 px-2 bg-blue-50 hover:bg-blue-100 text-blue-700 font-extrabold text-[10px] rounded-xl border border-blue-200 transition-colors text-center active:scale-95"
                  >
                    📱 Device
                  </button>
                  <button
                    onClick={() => handleToggleStatus(t)}
                    className={`py-1.5 px-2 font-extrabold text-[10px] rounded-xl border transition-colors text-center active:scale-95 col-span-3 ${
                      t.is_active ? 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200' : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}
                  >
                    {t.is_active ? '🔒 Nonaktifkan Akun' : '🔓 Aktifkan Akun'}
                  </button>
                  <button
                    onClick={() => {
                      setSelectedTeacher(t);
                      setIsDeleteModalOpen(true);
                    }}
                    className="py-1.5 px-2 bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-[10px] rounded-xl border border-red-200 transition-colors text-center active:scale-95"
                  >
                    🗑️ Hapus
                  </button>
                </div>
              ) : (
                <div className="pt-1.5 border-t border-slate-100 flex justify-end">
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                    👁️ Akses Lihat (Read-Only)
                  </span>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* ── DESKTOP DATA TABLE (>=640px) ────────────────────────────────── */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">Nama & NPP</th>
              <th className="p-3">Role & Jabatan</th>
              <th className="p-3">Kontak WA</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">{effectiveReadOnly ? 'Akses' : 'Aksi Admin Website'}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredTeachers.map((t) => (
              <tr key={t.id} className="hover:bg-slate-50/50">
                <td className="p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold text-xs shrink-0 overflow-hidden border border-slate-200 shadow-2xs">
                      {t.avatar_url ? (
                        <img src={t.avatar_url} alt={t.full_name} className="w-full h-full object-cover" />
                      ) : (
                        t.full_name.charAt(0)
                      )}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{t.full_name}</p>
                      <p className="text-[10px] text-slate-400">NPP: {t.nip || '-'}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    t.role === 'KEPSEK' ? 'bg-amber-100 text-amber-800' : t.role === 'ADMIN' || t.role === 'OPERATOR' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {t.role === 'ADMIN' || t.role === 'OPERATOR' ? 'ADMIN WEBSITE' : t.role}
                  </span>
                  <p className="text-[11px] text-slate-500 font-medium">{t.position}</p>
                </td>
                <td className="p-3 text-slate-600 font-medium">{t.phone_number}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    t.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'
                  }`}>
                    {t.is_active ? 'Aktif' : 'Non-Aktif'}
                  </span>
                </td>
                <td className="p-3 text-right">
                  {!effectiveReadOnly ? (
                    <div className="space-x-1.5 inline-block">
                      <button
                        onClick={() => handleOpenEditModal(t)}
                        className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg transition-colors"
                      >
                        ✏️ Edit
                      </button>
                      <button
                        onClick={() => handleOpenPhotoModal(t)}
                        className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 font-bold rounded-lg transition-colors"
                      >
                        📷 Foto
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTeacher(t);
                          setIsResetPinOpen(true);
                        }}
                        className="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 font-bold rounded-lg transition-colors"
                      >
                        🔑 PIN
                      </button>
                      <button
                        onClick={() => handleResetDevice(t)}
                        className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-lg transition-colors"
                      >
                        📱 Device
                      </button>
                      <button
                        onClick={() => handleToggleStatus(t)}
                        className={`px-2.5 py-1 font-bold rounded-lg transition-colors ${
                          t.is_active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                        }`}
                      >
                        {t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedTeacher(t);
                          setIsDeleteModalOpen(true);
                        }}
                        className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 font-bold rounded-lg transition-colors"
                      >
                        🗑️ Hapus
                      </button>
                    </div>
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200">
                      👁️ Read-Only
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add User Modal */}
      <Modal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)} title="➕ Pendaftaran Pengguna / Guru Baru">
        <form onSubmit={handleAddTeacher} className="space-y-3">
          <div className="p-3 rounded-2xl bg-blue-50 border border-blue-200 text-blue-900 text-xs space-y-1">
            <p className="font-bold flex items-center gap-1">
              <span>🔑</span> PIN Awal Pengguna: <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-blue-800 font-extrabold">123456</code>
            </p>
            <p className="text-[11px] text-blue-700">
              Pengguna baru akan secara otomatis diminta membuat PIN 6-digit rahasia mereka sendiri saat pertama kali login.
            </p>
          </div>

          {/* Avatar Upload Section for New User */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden border-2 border-emerald-500 shadow-xs">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Foto Profil Guru" className="w-full h-full object-cover" />
                ) : (
                  fullName.charAt(0) || '📷'
                )}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">Foto Profil Guru (Opsional)</p>
                <p className="text-[10px] text-slate-500">Auto Crop 1:1 WebP (Max 10MB)</p>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-[10px] text-red-600 hover:underline font-bold mt-0.5 cursor-pointer"
                  >
                    Hapus Foto
                  </button>
                )}
              </div>
            </div>

            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-2xs shrink-0">
              {isUploadingAvatar ? 'Memproses...' : '📷 Unggah Foto'}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
                disabled={isUploadingAvatar}
              />
            </label>
          </div>

          <Input label="Nama Lengkap & Gelar" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="NPP / Nomor Pegawai (Opsional)" value={nip} onChange={(e) => setNip(e.target.value)} />
          <Input label="Nomor WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label="Jabatan / Bidang Studi" value={position} onChange={(e) => setPosition(e.target.value)} required />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Role Pengguna</label>
            <div className="grid grid-cols-3 gap-2">
              {(['GURU', 'KEPSEK', 'ADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                    role === r ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {r === 'ADMIN' ? 'ADMIN WEBSITE' : r}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <Button type="button" variant="secondary" className="w-1/2" onClick={() => setIsAddModalOpen(false)}>Batal</Button>
            <Button type="submit" variant="primary" className="w-1/2">Simpan Akun</Button>
          </div>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} title="✏️ Edit Data Master Pengguna / Guru">
        <form onSubmit={handleEditTeacherSubmit} className="space-y-3">
          {/* Avatar Upload Section */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-sm shrink-0 overflow-hidden border-2 border-emerald-500 shadow-xs">
                {avatarUrl ? (
                  <img src={avatarUrl} alt="Foto Profil Guru" className="w-full h-full object-cover" />
                ) : (
                  fullName.charAt(0) || '📷'
                )}
              </div>
              <div>
                <p className="font-bold text-xs text-slate-900">Foto Profil Guru</p>
                <p className="text-[10px] text-slate-500">Format: JPG, PNG, WebP (Max 5MB)</p>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={() => setAvatarUrl(null)}
                    className="text-[10px] text-red-600 hover:underline font-bold mt-0.5 cursor-pointer"
                  >
                    Hapus Foto Profil
                  </button>
                )}
              </div>
            </div>

            <label className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl cursor-pointer transition-all shadow-2xs shrink-0">
              {isUploadingAvatar ? 'Memproses...' : '📷 Ganti Foto'}
              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                className="hidden"
                disabled={isUploadingAvatar}
              />
            </label>
          </div>

          <Input label="Nama Lengkap & Gelar" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="NPP / Nomor Pegawai (Opsional)" value={nip} onChange={(e) => setNip(e.target.value)} />
          <Input label="Nomor WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label="Jabatan / Bidang Studi" value={position} onChange={(e) => setPosition(e.target.value)} required />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Role Pengguna</label>
            <div className="grid grid-cols-3 gap-2">
              {(['GURU', 'KEPSEK', 'ADMIN'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                    role === r ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {r === 'ADMIN' ? 'ADMIN WEBSITE' : r}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-2 flex gap-2">
            <Button type="button" variant="secondary" className="w-1/2" onClick={() => setIsEditModalOpen(false)}>Batal</Button>
            <Button type="submit" variant="primary" className="w-1/2">Simpan Perubahan</Button>
          </div>
        </form>
      </Modal>

      {/* Reset PIN Modal */}
      <Modal isOpen={isResetPinOpen} onClose={() => setIsResetPinOpen(false)} title="🔑 Reset PIN 6-Digit">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Masukkan PIN 6-digit baru untuk <span className="font-bold text-slate-900">{selectedTeacher?.full_name}</span>.
          </p>
          <Input label="PIN 6-Digit Baru" type="password" maxLength={6} value={newPin} onChange={(e) => setNewPin(e.target.value)} placeholder="Contoh: 654321" />
          <div className="flex gap-2">
            <Button variant="secondary" className="w-1/2" onClick={() => setIsResetPinOpen(false)}>Batal</Button>
            <Button variant="primary" className="w-1/2" onClick={handleResetPin}>Simpan PIN Baru</Button>
          </div>
        </div>
      </Modal>

      {/* Delete User Confirmation Modal */}
      <Modal isOpen={isDeleteModalOpen} onClose={() => setIsDeleteModalOpen(false)} title="🗑️ Konfirmasi Hapus Pengguna">
        {selectedTeacher && (
          <div className="space-y-4">
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-800 space-y-2">
              <p className="font-bold text-sm">Apakah Anda yakin ingin menghapus akun ini?</p>
              <div className="text-xs space-y-1 bg-white p-3 rounded-xl border border-red-100 font-medium text-slate-700">
                <p><span className="font-bold">Nama:</span> {selectedTeacher.full_name}</p>
                <p><span className="font-bold">NPP:</span> {selectedTeacher.nip && !selectedTeacher.nip.startsWith('NIP_') ? selectedTeacher.nip : '-'}</p>
                <p><span className="font-bold">Role:</span> {selectedTeacher.role === 'ADMIN' ? 'ADMIN WEBSITE' : selectedTeacher.role}</p>
                <p><span className="font-bold">Jabatan:</span> {selectedTeacher.position}</p>
              </div>
              <p className="text-[11px] text-red-600 font-semibold pt-1">
                ⚠️ Pengguna ini akan dihapus dari daftar master dan tidak dapat melakukan absensi lagi.
              </p>
            </div>

            <div className="flex gap-2">
              <Button variant="secondary" className="w-1/2" onClick={() => setIsDeleteModalOpen(false)}>
                Batal
              </Button>
              <Button variant="danger" className="w-1/2" onClick={handleDeleteTeacher}>
                Ya, Hapus Pengguna
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Quick Teacher Photo Management Modal */}
      <Modal isOpen={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} title="📷 Kelola Foto Profil Guru">
        {selectedTeacher && (
          <div className="space-y-4 text-xs text-slate-700">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
              <div className="w-24 h-24 rounded-full bg-slate-900 text-white flex items-center justify-center font-black text-2xl shrink-0 overflow-hidden border-4 border-emerald-500 shadow-md">
                {avatarUrl ? (
                  <img src={avatarUrl} alt={selectedTeacher.full_name} className="w-full h-full object-cover" />
                ) : (
                  selectedTeacher.full_name.charAt(0) || '👤'
                )}
              </div>

              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="font-extrabold text-slate-900 text-sm truncate">{selectedTeacher.full_name}</h4>
                <p className="text-[11px] font-mono text-slate-500">NPP: {selectedTeacher.nip || '-'}</p>
                <p className="text-[11px] font-semibold text-slate-600">{selectedTeacher.position || 'Tenaga Pendidik'}</p>

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5 pt-1">
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                    ✨ WebP 1:1 Auto-Crop (400x400)
                  </span>
                  <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-bold rounded-md">
                    ⚡ Auto Sync All Devices
                  </span>
                </div>
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl space-y-1 text-blue-900">
              <p className="font-bold flex items-center gap-1">
                <span>💡</span> Pengubahan Foto Profil Real-Time:
              </p>
              <p className="text-[11px] leading-relaxed text-blue-800">
                Foto profil yang diunggah akan otomatis dikompresi menjadi format WebP hemat kuota (~20-30KB) dan langsung tersinkronisasi di tampilan HP Guru, Dashboard Kepsek, dan Laporan PDF.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <label className="flex-1 py-2.5 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs rounded-xl cursor-pointer transition-all shadow-2xs text-center flex items-center justify-center gap-1.5">
                <span>{isUploadingAvatar ? '⏳ Memproses...' : '📷 Pilih & Kompresi Foto'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarFileChange}
                  className="hidden"
                  disabled={isUploadingAvatar}
                />
              </label>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={() => setAvatarUrl(null)}
                  className="py-2.5 px-3 bg-red-50 hover:bg-red-100 text-red-700 font-extrabold text-xs rounded-xl border border-red-200 transition-all text-center active:scale-95"
                >
                  🗑️ Hapus Foto
                </button>
              )}
            </div>

            <div className="flex gap-2 pt-2 border-t border-slate-100">
              <Button variant="secondary" className="w-1/2" onClick={() => setIsPhotoModalOpen(false)}>
                Batal
              </Button>
              <Button variant="primary" className="w-1/2 bg-emerald-600 hover:bg-emerald-700 font-bold" onClick={handleSavePhotoDirectly}>
                💾 Simpan Foto Profil
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
