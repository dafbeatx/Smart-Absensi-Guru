import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { AuditLogger } from '../../../services/audit-logger.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import type { AttendanceStatus, UserProfile } from '../../../types/database.types';

export interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: UserProfile[];
  onSuccess?: () => void;
}

export const AttendanceCorrectionModal: React.FC<AttendanceCorrectionModalProps> = ({
  isOpen,
  onClose,
  teachers,
  onSuccess,
}) => {
  const { user } = useAuthStore();
  const { showToast } = useToastStore();

  const [selectedUserId, setSelectedUserId] = useState(teachers[0]?.id || '');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [newStatus, setNewStatus] = useState<AttendanceStatus>('HADIR');
  const [checkInTime, setCheckInTime] = useState('07:00');
  const [reason, setReason] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setErrorMsg('Alasan koreksi absensi wajib diisi minimal 5 karakter.');
      return;
    }

    const teacher = teachers.find((t) => t.id === selectedUserId);

    await AuditLogger.log({
      actorId: user?.id || 'op_1',
      actorRole: 'OPERATOR',
      actionType: 'EDIT_ATTENDANCE',
      targetEntity: 'Attendance',
      newValue: JSON.stringify({
        user_id: selectedUserId,
        date,
        status: newStatus,
        check_in_time: checkInTime,
      }),
      reason: `Koreksi Absensi Manual oleh Operator untuk ${teacher?.full_name}: ${reason}`,
    });

    showToast('success', 'Koreksi Berhasil Disimpan!', `Absensi ${teacher?.full_name} diubah menjadi ${newStatus}.`);
    if (onSuccess) onSuccess();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✏️ Koreksi & Input Absensi Manual">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Pilih Guru</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            {teachers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.full_name} ({t.nip || 'No NIP'})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input label="Tanggal Absensi" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Jam Masuk" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Status Kehadiran Baru</label>
          <div className="grid grid-cols-3 gap-2">
            {(['HADIR', 'TERLAMBAT', 'IZIN', 'SAKIT', 'DINAS_LUAR', 'ALFA'] as AttendanceStatus[]).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setNewStatus(st)}
                className={`py-2 px-2.5 rounded-xl text-[11px] font-bold border transition-all ${
                  newStatus === st
                    ? 'bg-slate-900 text-white border-slate-900 shadow-md'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Alasan Perubahan / Koreksi (Wajib Audit Log)</label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan audit koreksi (contoh: HP Guru mati, verifikasi fisik hadir)..."
            className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="pt-2 flex gap-2">
          <Button type="button" variant="secondary" className="w-1/2" onClick={onClose}>Batal</Button>
          <Button type="submit" variant="primary" className="w-1/2">Simpan Koreksi</Button>
        </div>
      </form>
    </Modal>
  );
};
