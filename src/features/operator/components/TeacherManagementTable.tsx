import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { Modal } from '../../../components/ui/Modal';
import { AuditLogger } from '../../../services/audit-logger.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { UserProfile, RoleCode } from '../../../types/database.types';

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
  const [filterRole, setFilterRole] = useState<'ALL' | RoleCode>('ALL');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isResetPinOpen, setIsResetPinOpen] = useState(false);
  const [selectedTeacher, setSelectedTeacher] = useState<UserProfile | null>(null);

  // Form states
  const [fullName, setFullName] = useState('');
  const [nip, setNip] = useState('');
  const [phone, setPhone] = useState('');
  const [position, setPosition] = useState('');
  const [role, setRole] = useState<RoleCode>('GURU');
  const [newPin, setNewPin] = useState('');

  const filteredTeachers = teachers.filter((t) => {
    const matchesSearch =
      t.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (t.nip && t.nip.includes(searchQuery)) ||
      String(t.phone_number || '').includes(searchQuery);

    const matchesRole = filterRole === 'ALL' || t.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const handleAddTeacher = async () => {
    if (!fullName || !phone) return;

    const newTeacher: UserProfile = {
      id: 'usr_' + Date.now(),
      nip: nip || '-',
      full_name: fullName,
      phone_number: phone,
      role,
      position: position || 'Tenaga Pendidik',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    };

    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      await provider.createUser(newTeacher, token);
    } catch (err) {
      console.warn('Backend create user notify:', err);
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
      actorRole: 'OPERATOR',
      actionType: 'CREATE_USER',
      targetEntity: 'Users',
      newValue: JSON.stringify(newTeacher),
      reason: `Menambahkan akun guru baru: ${fullName}`,
    });

    showToast('success', 'Guru Berhasil Ditambahkan!', `${fullName} telah terdaftar dengan PIN default 123456.`);
    setIsAddModalOpen(false);
    setFullName('');
    setNip('');
    setPhone('');
    setPosition('');
  };

  const handleOpenEditModal = (t: UserProfile) => {
    setSelectedTeacher(t);
    setFullName(t.full_name);
    setNip(t.nip || '');
    setPhone(t.phone_number || '');
    setPosition(t.position || '');
    setRole(t.role);
    setIsEditModalOpen(true);
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

    await AuditLogger.log({
      actorId: user?.id || 'op_1',
      actorRole: 'OPERATOR',
      actionType: 'EDIT_USER',
      targetEntity: 'Users',
      newValue: JSON.stringify(updates),
      reason: `Pembaruan data akun ${fullName} (${role}) oleh Operator`,
    });

    showToast('success', 'Data Guru Berhasil Diperbarui!', `Profil ${fullName} telah diperbarui di database & frontend.`);
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
      actorRole: 'OPERATOR',
      actionType: 'RESET_PIN',
      targetEntity: 'Users',
      newValue: JSON.stringify({ pin_reset: true, must_change_pin: true }),
      reason: `Reset PIN 6-digit untuk ${selectedTeacher.full_name}`,
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
      actorRole: 'OPERATOR',
      actionType: 'RESET_DEVICE',
      targetEntity: 'Device_Binding',
      newValue: JSON.stringify({ device_unbound: true }),
      reason: `Reset ikatan HP (Device Binding) untuk ${teacher.full_name}`,
    });

    showToast('success', 'Reset Perangkat Berhasil!', `Ikatan HP untuk ${teacher.full_name} telah dilepas.`);
  };

  const handleToggleStatus = async (teacher: UserProfile) => {
    const updated = teachers.map((t) =>
      t.id === teacher.id ? { ...t, is_active: !t.is_active } : t
    );
    onTeachersChange(updated);

    await AuditLogger.log({
      actorId: user?.id || 'op_1',
      actorRole: 'OPERATOR',
      actionType: 'TOGGLE_USER_STATUS',
      targetEntity: 'Users',
      oldValue: JSON.stringify({ is_active: teacher.is_active }),
      newValue: JSON.stringify({ is_active: !teacher.is_active }),
      reason: `Mengubah status keaktifan akun ${teacher.full_name}`,
    });

    showToast('info', 'Status Akun Diperbarui', `${teacher.full_name} kini ${!teacher.is_active ? 'Aktif' : 'Non-Aktif'}.`);
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
          {(['ALL', 'GURU', 'KEPSEK', 'OPERATOR'] as const).map((r) => (
            <button
              key={r}
              onClick={() => setFilterRole(r)}
              className={`py-2 px-3 rounded-xl text-xs font-bold border transition-all ${
                filterRole === r
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {r}
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
                  <p className="font-bold text-slate-900">{t.full_name}</p>
                  <p className="text-[10px] text-slate-400">NPP: {t.nip || '-'}</p>
                </td>
                <td className="p-3">
                  <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold ${
                    t.role === 'KEPSEK' ? 'bg-amber-100 text-amber-800' : t.role === 'OPERATOR' ? 'bg-blue-100 text-blue-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {t.role}
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
                      t.is_active ? 'bg-red-50 text-red-700 hover:bg-red-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                    }`}
                  >
                    {t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
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
              {(['GURU', 'KEPSEK', 'OPERATOR'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                    role === r ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {r}
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
          <Input label="Nama Lengkap & Gelar" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
          <Input label="NPP / Nomor Pegawai (Opsional)" value={nip} onChange={(e) => setNip(e.target.value)} />
          <Input label="Nomor WhatsApp" value={phone} onChange={(e) => setPhone(e.target.value)} required />
          <Input label="Jabatan / Bidang Studi" value={position} onChange={(e) => setPosition(e.target.value)} required />

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">Role Pengguna</label>
            <div className="grid grid-cols-3 gap-2">
              {(['GURU', 'KEPSEK', 'OPERATOR'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border ${
                    role === r ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-200'
                  }`}
                >
                  {r}
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
    </div>
  );
};
