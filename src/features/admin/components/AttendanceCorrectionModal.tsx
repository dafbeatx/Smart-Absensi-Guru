import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { AuditLogger } from '../../../services/audit-logger.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import type { AttendanceStatus, UserProfile } from '../../../types/database.types';

import { getTodayDateInJakarta } from '../../../utils/time.utils';

export interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: UserProfile[];
  selectedTeacherId?: string;
  onSuccess?: () => void;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  teachers,
  selectedTeacherId,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();
  const todayStr = getTodayDateInJakarta();

  const [selectedUserId, setSelectedUserId] = useState(selectedTeacherId || teachers[0]?.id || '');
  const [date, setDate] = useState(todayStr);

  // Sync selectedUserId when selectedTeacherId prop changes or modal opens
  React.useEffect(() => {
    if (selectedTeacherId) {
      setSelectedUserId(selectedTeacherId);
    } else if (teachers.length > 0) {
      setSelectedUserId(teachers[0].id);
    }
  }, [selectedTeacherId, teachers]);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('HADIR');
  const [checkInTime, setCheckInTime] = useState('07:00');
  const [checkOutTime, setCheckOutTime] = useState('14:00');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (date > todayStr) {
      setErrorMsg(`Tanggal absensi (${date}) tidak boleh melebihi tanggal hari ini (${todayStr}). Pengisian tanggal mendatang tidak diizinkan!`);
      return;
    }

    if (!reason || reason.trim().length < 5) {
      setErrorMsg('Alasan koreksi absensi wajib diisi minimal 5 karakter.');
      return;
    }

    setIsLoading(true);

    try {
      const teacher = teachers.find((t) => t.id === selectedUserId);
      const token = useAuthStore.getState().token || 'MOCK_TOKEN';

      await AttendanceRepository.correctAttendance({
        token,
        target_user_id: selectedUserId,
        date,
        status: newStatus,
        check_in_time: checkInTime.length === 5 ? `${checkInTime}:00` : checkInTime,
        check_out_time: checkOutTime ? (checkOutTime.length === 5 ? `${checkOutTime}:00` : checkOutTime) : undefined,
        reason,
      });

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'EDIT_ATTENDANCE',
        targetEntity: 'Attendance',
        newValue: JSON.stringify({
          user_id: selectedUserId,
          date,
          status: newStatus,
          check_in_time: checkInTime,
          check_out_time: checkOutTime,
        }),
        reason: `Koreksi Absensi Manual oleh Admin Website untuk ${teacher?.full_name}: ${reason}`,
      });

      showToast('success', 'Koreksi Berhasil Disimpan!', `Absensi ${teacher?.full_name} tanggal ${date} diubah menjadi ${newStatus}.`);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal menyimpan koreksi absensi';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✏️ Koreksi & Input Absensi Manual" maxWidth="xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">Pilih Guru</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.nip || 'No NPP'})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Input label="Tanggal Absensi" type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)} />
          <Input label="Jam Masuk" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
          <Input label="Jam Pulang" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">Status Kehadiran Baru</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
            {(['HADIR', 'IZIN', 'SAKIT', 'DINAS_LUAR', 'ALFA'] as AttendanceStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setNewStatus(st)}
                className={`py-2 px-2 rounded-xl text-[11px] font-bold border transition-all cursor-pointer ${
                  newStatus === st
                    ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st === 'HADIR' ? 'HADIR / MASUK' : st}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl text-[11px] text-amber-900 leading-relaxed font-medium">
          💡 <strong>Catatan:</strong> Pengisian tanggal lampau diizinkan (maksimal hari ini). Status <strong>TERLAMBAT</strong> dievaluasi otomatis oleh sistem jika Jam Masuk di atas pukul 07:15 WIB.
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">Alasan Perubahan / Koreksi (Wajib Audit Log)</label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan audit koreksi (contoh: HP Guru mati, verifikasi fisik hadir)..."
            className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={isLoading}>Batal</Button>
          <Button type="submit" variant="primary" isLoading={isLoading}>Simpan Koreksi</Button>
        </div>
      </form>
    </Modal>
  );
};
