import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { AuditLogger } from '../../../services/audit-logger.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import type { AttendanceRecord, AttendanceStatus, UserProfile } from '../../../types/database.types';
import { CONSTANTS } from '../../../config/constants';
import { ProviderFactory } from '../../../providers/provider-factory';

import { getTodayDateInJakarta } from '../../../utils/time.utils';

export interface AttendanceCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  teachers: UserProfile[];
  selectedTeacherId?: string;
  onSuccess?: () => void;
}

export type CorrectionScope = 'MASUK' | 'PULANG' | 'KEDUANYA';

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
  const [checkinEnd, setCheckinEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);
  const [correctionScope, setCorrectionScope] = useState<CorrectionScope>('MASUK');
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null);

  // Sync selectedUserId when selectedTeacherId prop changes or modal opens
  React.useEffect(() => {
    if (isOpen) {
      ProviderFactory.getProvider().getSettings().then((st) => {
        if (st?.work_checkin_end) setCheckinEnd(st.work_checkin_end.slice(0, 5));
      }).catch(() => {});
    }
    if (selectedTeacherId) {
      setSelectedUserId(selectedTeacherId);
    } else if (teachers.length > 0) {
      setSelectedUserId(teachers[0].id);
    }
  }, [isOpen, selectedTeacherId, teachers]);

  // Fetch existing attendance data when selectedUserId or date changes
  React.useEffect(() => {
    if (isOpen && selectedUserId && date) {
      const token = useAuthStore.getState().token || 'MOCK_TOKEN';
      ProviderFactory.getProvider()
        .getDailyAttendance(date, token)
        .then((records) => {
          const rec = records.find((r) => r.user_id === selectedUserId);
          if (rec) {
            setExistingRecord(rec);
            if (rec.check_in_time) setCheckInTime(rec.check_in_time.slice(0, 5));
            if (rec.check_out_time) setCheckOutTime(rec.check_out_time.slice(0, 5));
          } else {
            setExistingRecord(null);
          }
        })
        .catch(() => {
          setExistingRecord(null);
        });
    }
  }, [isOpen, selectedUserId, date]);

  const [newStatus, setNewStatus] = useState<AttendanceStatus>('HADIR');
  const [checkInTime, setCheckInTime] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
  const [checkOutTime, setCheckOutTime] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
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

      let finalCheckIn = '';
      let finalCheckOut: string | undefined = undefined;

      if (newStatus === 'HADIR') {
        if (correctionScope === 'MASUK') {
          finalCheckIn = checkInTime.length === 5 ? `${checkInTime}:00` : checkInTime;
          finalCheckOut = existingRecord?.check_out_time || undefined;
        } else if (correctionScope === 'PULANG') {
          finalCheckIn = existingRecord?.check_in_time || '07:00:00';
          finalCheckOut = checkOutTime.length === 5 ? `${checkOutTime}:00` : checkOutTime;
        } else {
          finalCheckIn = checkInTime.length === 5 ? `${checkInTime}:00` : checkInTime;
          finalCheckOut = checkOutTime ? (checkOutTime.length === 5 ? `${checkOutTime}:00` : checkOutTime) : undefined;
        }
      }

      await AttendanceRepository.correctAttendance({
        token,
        target_user_id: selectedUserId,
        date,
        status: newStatus,
        check_in_time: finalCheckIn,
        check_out_time: finalCheckOut,
        reason,
      });

      const scopeTag = newStatus === 'HADIR' ? ` [Mode: Koreksi ${correctionScope}]` : '';

      await AuditLogger.log({
        actorId: user?.id || 'op_1',
        actorRole: user?.role || 'ADMIN',
        actionType: 'EDIT_ATTENDANCE',
        targetEntity: 'Attendance',
        newValue: JSON.stringify({
          user_id: selectedUserId,
          date,
          status: newStatus,
          correction_scope: correctionScope,
          check_in_time: finalCheckIn || null,
          check_out_time: finalCheckOut || null,
        }),
        reason: `Koreksi Absensi Manual oleh Admin Website untuk ${teacher?.full_name}${scopeTag}: ${reason}`,
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

        {newStatus === 'HADIR' ? (
          <div className="space-y-3 pt-1">
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-700">Pilih Target Koreksi Presensi</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setCorrectionScope('MASUK')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                    correctionScope === 'MASUK'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>🌅</span> Koreksi Jam Masuk
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectionScope('PULANG')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                    correctionScope === 'PULANG'
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>🌆</span> Koreksi Jam Pulang
                </button>
                <button
                  type="button"
                  onClick={() => setCorrectionScope('KEDUANYA')}
                  className={`py-2 px-2.5 rounded-xl text-[11px] font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5 ${
                    correctionScope === 'KEDUANYA'
                      ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <span>🌓</span> Masuk & Pulang
                </button>
              </div>
            </div>

            {correctionScope === 'MASUK' && (
              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                    <span>🌅</span> Form Khusus Koreksi Presensi Masuk
                  </span>
                  {existingRecord?.check_out_time && (
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-lg">
                      Pulang: {existingRecord.check_out_time.slice(0, 5)} WIB
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Tanggal Absensi" type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)} />
                  <Input label="Jam Masuk Baru" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
                </div>
                <div className="text-[11px] text-emerald-800 font-medium leading-tight">
                  ℹ️ Koreksi ini <strong>hanya akan mengubah Jam Masuk</strong>. Data Jam Pulang tidak akan diubah atau terganggu.
                </div>
              </div>
            )}

            {correctionScope === 'PULANG' && (
              <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-indigo-900 flex items-center gap-1.5">
                    <span>🌆</span> Form Khusus Koreksi Presensi Pulang
                  </span>
                  {existingRecord?.check_in_time && (
                    <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-lg">
                      Masuk: {existingRecord.check_in_time.slice(0, 5)} WIB
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input label="Tanggal Absensi" type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)} />
                  <Input label="Jam Pulang Baru" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
                </div>
                <div className="text-[11px] text-indigo-800 font-medium leading-tight">
                  ℹ️ Koreksi ini <strong>hanya akan mengubah Jam Pulang</strong>. Data Jam Masuk tidak akan diubah atau terganggu.
                </div>
              </div>
            )}

            {correctionScope === 'KEDUANYA' && (
              <div className="space-y-3">
                <Input label="Tanggal Absensi" type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-2xl space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-emerald-900">
                      <span>🌅</span> Sesi Presensi Masuk
                    </label>
                    <Input label="Jam Masuk Baru" type="time" value={checkInTime} onChange={(e) => setCheckInTime(e.target.value)} />
                  </div>
                  <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-2xl space-y-2">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-indigo-900">
                      <span>🌆</span> Sesi Presensi Pulang
                    </label>
                    <Input label="Jam Pulang Baru" type="time" value={checkOutTime} onChange={(e) => setCheckOutTime(e.target.value)} />
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Input label="Tanggal Absensi" type="date" value={date} max={todayStr} onChange={(e) => setDate(e.target.value)} />
            <div className="p-2.5 rounded-xl bg-blue-50/80 border border-blue-200/80 text-[11px] text-blue-900 flex items-center gap-2">
              <span>ℹ️</span>
              <span>Untuk status <strong>{newStatus}</strong>, jam masuk & jam pulang tidak diperlukan (dikoreksi tanpa jam presensi).</span>
            </div>
          </div>
        )}

        <div className="bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl text-[11px] text-amber-900 leading-relaxed font-medium">
          💡 <strong>Catatan:</strong> Pengisian tanggal lampau diizinkan (maksimal hari ini). {newStatus === 'HADIR' ? `Status TERLAMBAT dievaluasi otomatis oleh sistem jika Jam Masuk di atas pukul ${checkinEnd} WIB.` : `Status ${newStatus} akan dicatat secara resmi tanpa mencatat jam absensi fisik.`}
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

