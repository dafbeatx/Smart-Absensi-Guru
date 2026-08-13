import React, { useState, useEffect } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { AuditLogger } from '../../../services/audit-logger.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import type { UserProfile } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { getTodayDateInJakarta } from '../../../utils/time.utils';

export interface AttendanceResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: UserProfile[];
  selectedTeacherId?: string;
  selectedDate?: string;
  onSuccess?: () => void;
}

export const AttendanceResetModal: React.FC<AttendanceResetModalProps> = ({
  isOpen,
  onClose,
  teachers,
  selectedTeacherId,
  selectedDate,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const todayStr = getTodayDateInJakarta();

  const [selectedUserId, setSelectedUserId] = useState(selectedTeacherId || teachers[0]?.id || '');
  const [date, setDate] = useState(selectedDate || todayStr);
  const [adminPassword, setAdminPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [hasConfiguredResetPassword, setHasConfiguredResetPassword] = useState<boolean | null>(null);

  // Sync state when modal opens or props change
  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      setAdminPassword('');
      setReason('');
      setDate(selectedDate || todayStr);
      if (selectedTeacherId) {
        setSelectedUserId(selectedTeacherId);
      } else if (teachers.length > 0) {
        setSelectedUserId(teachers[0].id);
      }

      // Check if Admin Reset Password is already set in system settings
      ProviderFactory.getProvider()
        .getSettings()
        .then((st) => {
          if (st && st.admin_reset_password && st.admin_reset_password.trim().length > 0) {
            setHasConfiguredResetPassword(true);
          } else {
            setHasConfiguredResetPassword(false);
          }
        })
        .catch(() => {
          setHasConfiguredResetPassword(false);
        });
    }
  }, [isOpen, selectedTeacherId, selectedDate, teachers, todayStr]);

  const selectedTeacher = teachers.find((t) => t.id === selectedUserId);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!selectedUserId) {
      setErrorMsg('Pilih personel guru/staf yang akan di-reset absensinya.');
      return;
    }

    if (date > todayStr) {
      setErrorMsg(`Tanggal reset (${date}) tidak boleh melebihi tanggal hari ini (${todayStr}).`);
      return;
    }

    if (hasConfiguredResetPassword === false) {
      setErrorMsg('Password Reset Absensi Admin belum diatur di Pengaturan Sistem. Silakan atur terlebih dahulu di menu Pengaturan Sistem.');
      return;
    }

    if (!adminPassword || adminPassword.trim() === '') {
      setErrorMsg('Password Reset Admin wajib diisi untuk konfirmasi keamanan!');
      return;
    }

    if (!reason || reason.trim().length < 5) {
      setErrorMsg('Alasan reset presensi harian wajib diisi minimal 5 karakter untuk audit log.');
      return;
    }

    setIsLoading(true);

    try {
      const token = useAuthStore.getState().token || 'MOCK_TOKEN';

      await AttendanceRepository.resetAttendance({
        token,
        target_user_id: selectedUserId,
        date,
        admin_password: adminPassword,
        reason,
      });

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'RESET_ATTENDANCE',
        targetEntity: 'Attendance',
        oldValue: JSON.stringify({ user_id: selectedUserId, date }),
        newValue: null,
        reason: `Reset Absensi Harian oleh Admin untuk ${selectedTeacher?.full_name || selectedUserId} tanggal ${date}: ${reason}`,
      });

      showToast(
        'success',
        'Reset Presensi Harian Berhasil!',
        `Data presensi ${selectedTeacher?.full_name || 'personel'} tanggal ${date} telah di-reset. Status kembali menjadi Belum Absen.`
      );

      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal melakukan reset presensi harian';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="🔄 Reset Presensi Harian Personel" maxWidth="lg">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2">
            <span className="text-base shrink-0">⚠️</span>
            <div className="flex-1">{errorMsg}</div>
          </div>
        )}

        {hasConfiguredResetPassword === false && (
          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-300 text-amber-900 text-xs space-y-1.5">
            <div className="font-extrabold flex items-center gap-1.5 text-amber-900">
              <span>🔐</span> Password Reset Admin Belum Dibuat!
            </div>
            <p className="text-[11px] leading-relaxed text-amber-800">
              Sistem membutuhkan <strong>Password Reset Khusus Admin</strong> untuk mengamankan tindakan reset presensi harian. 
              Silakan atur password reset terlebih dahulu melalui menu <strong>Pengaturan Sistem</strong>.
            </p>
          </div>
        )}

        <div className="p-3.5 rounded-2xl bg-blue-50/80 border border-blue-200 text-blue-900 text-xs space-y-1">
          <div className="font-bold flex items-center gap-1.5">
            <span>ℹ️</span> Informasi Reset Presensi Harian
          </div>
          <p className="text-[11px] leading-relaxed text-blue-800 font-medium">
            Tindakan ini <strong>hanya menghapus status presensi pada hari ini / tanggal yang dipilih</strong> untuk personel yang bersangkutan. 
            Data historis hari lain <strong>TIDAK akan terhapus</strong>. Setelah di-reset, personel dapat melakukan scan masukan presensi ulang secara bersih.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">Pilih Personel Guru / Kepsek / Admin</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.nip && !t.nip.startsWith('NIP_') ? `NPP: ${t.nip}` : 'No NPP'}) - {t.position || t.role}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1">
          <Input
            label="Tanggal Presensi Yang Di-reset"
            type="date"
            value={date}
            max={todayStr}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            Password Reset Admin <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={adminPassword}
              onChange={(e) => setAdminPassword(e.target.value)}
              placeholder="Masukkan Password Reset buatan Admin..."
              className="w-full bg-white border border-slate-200 rounded-xl p-2.5 pr-10 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-medium">
            Gunakan Password Reset buatan Anda yang telah didaftarkan pada menu Pengaturan Sistem.
          </p>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">Alasan Reset Presensi (Wajib Audit Log)</label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan koreksi/reset (contoh: Salah scan presensi pulang, perbaikan data oleh admin)..."
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-red-500 focus:outline-none"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button
            type="submit"
            variant="danger"
            isLoading={isLoading}
            disabled={hasConfiguredResetPassword === false}
          >
            🔄 Konfirmasi & Reset Absensi
          </Button>
        </div>
      </form>
    </Modal>
  );
};
