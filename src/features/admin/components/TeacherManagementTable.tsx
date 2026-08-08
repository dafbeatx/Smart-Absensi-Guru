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

export interface TeacherManagementTableProps {
  teachers: UserProfile[];
  onTeachersChange: (updatedTeachers: UserProfile[]) => void;
}

export const TeacherManagementTable: React.FC<TeacherManagementTableProps> = ({
  teachers,
  onTeachersChange,
}) => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterRole, setFilterRole] = useState<'ALL' | 'GURU' | 'KEPSEK' | 'ADMIN'>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
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
    const newTeacher: UserProfile = {
      id: 'usr_' + Date.now(),
      nip: nip || '',
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
      await provider.createUser(newTeacher, token);
    } catch (err) {
      console.warn('Backend GAS create user notify:', err);
    }

    const updated = [...teachers, newTeacher];
    onTeachersChange(updated);
    try {
      localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to cache teachers to localStorage:', e);
    }

    await AuditLogger.log({
      actorId: user?.id || 'op_1',
      actorRole: user?.role || 'ADMIN',
      actionType: 'ADD_USER',
      targetEntity: 'Users',
      newValue: JSON.stringify(newTeacher),
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
  };

  const handleOpenEditModal = (t: UserProfile) => {
    setSelectedTeacher(t);
    setFullName(t.full_name);
    setNip(t.nip || '');
    setPhone(t.phone_number || '');
    setPosition(t.position || '');
    setRole(t.role);
    setAvatarUrl(t.avatar_url || null);
    setIsEditModalOpen(true);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
    if (!selectedTeacher) return;

    const updates: Partial<UserProfile> = {
      full_name: fullName,
      nip: nip,
      phone_number: phone,
      position: position,
      role: role,
      avatar_url: avatarUrl,
    };

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.updateUser(selectedTeacher.id, updates, token);
    } catch (err) {
      console.warn('Backend update user warning:', err);
    }

    const updated = teachers.map((t) =>
      t.id === selectedTeacher.id ? { ...t, ...updates } : t
    );
    onTeachersChange(updated);
    try {
      localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to cache teachers to localStorage:', e);
    }

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
  };

  const handleResetPin = async () => {
    if (!selectedTeacher || newPin.length !== 6) return;

    try {
      await ProviderFactory.getProvider().resetPin(selectedTeacher.id, newPin, useAuthStore.getState().token || '');
    } catch (e) {
      console.warn('API resetPin warning:', e);
    }

    const updated = teachers.map((t) =>
      t.id === selectedTeacher.id ? { ...t, must_change_pin: true } : t
    );
    onTeachersChange(updated);

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
  };

  const handleResetDevice = async (teacher: UserProfile) => {
    try {
      await ProviderFactory.getProvider().resetDevice(teacher.id, useAuthStore.getState().token || '');
    } catch (e) {
      console.warn('API resetDevice warning:', e);
    }

    await AuditLogger.log({
      actorId: user?.id || 'op_1',
      actorRole: user?.role || 'ADMIN',
      actionType: 'RESET_DEVICE',
      targetEntity: 'Device_Binding',
      newValue: JSON.stringify({ device_unbound: true }),
      reason: `Reset ikatan HP oleh Admin Website untuk ${teacher.full_name}`,
    });

    showToast('success', 'Reset Perangkat Berhasil!', `Ikatan HP untuk ${teacher.full_name} telah dilepas.`);
  };

  const handleToggleStatus = async (teacher: UserProfile) => {
    const updated = teachers.map((t) =>
      t.id === teacher.id ? { ...t, is_active: !t.is_active } : t
    );
    onTeachersChange(updated);

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.toggleUserStatus(teacher.id, token);
    } catch (err) {
      console.warn('Failed to sync toggleUserStatus to backend:', err);
    }

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
  };

  const handleDeleteTeacher = async () => {
    if (!selectedTeacher) return;

    const updated = teachers.filter((t) => t.id !== selectedTeacher.id);
    onTeachersChange(updated);

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.deleteUser(selectedTeacher.id, token);
    } catch (e) {
      console.warn('Backend GAS delete notify:', e);
    }

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
  };

  return (
    <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-card space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900 text-sm">Manajemen Master Data Pengguna & Guru</h3>
          <p className="text-xs text-slate-500">{filteredTeachers.length} pengguna terdaftar</p>
        </div>

        <Button variant="primary" onClick={() => setIsAddModalOpen(true)}>
          + Tambah Pengguna Baru
        </Button>
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

      {/* Data Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
            <tr>
              <th className="p-3">Nama & NPP</th>
              <th className="p-3">Role & Jabatan</th>
              <th className="p-3">Kontak WA</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi Admin Website</th>
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
                <td className="p-3 text-right space-x-1.5">
                  <button
                    onClick={() => handleOpenEditModal(t)}
                    className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-bold rounded-lg transition-colors"
                  >
                    ✏️ Edit
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
                <p><span className="font-bold">NPP:</span> {selectedTeacher.nip || '-'}</p>
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
    </div>
  );
};
