import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { GroqAIService } from '../../../services/groq-ai.service';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { logger } from '../../../utils/logger.utils';
import type { AttendanceRecord } from '../../../types/database.types';
import { CONSTANTS } from '../../../config/constants';
import { ProviderFactory } from '../../../providers/provider-factory';

import { getTodayDateInJakarta } from '../../../utils/time.utils';

export interface GuruCorrectionRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialDate?: string;
  onSuccess?: () => void;
}

export type CorrectionScope = 'MASUK' | 'PULANG' | 'KEDUANYA';

export const GuruCorrectionRequestModal: React.FC<GuruCorrectionRequestModalProps> = ({
  isOpen,
  onClose,
  initialDate,
  onSuccess,
}) => {
  const { token, user } = useAuthStore();
  const { showToast } = useToastStore();
  const todayStr = getTodayDateInJakarta();

  const [date, setDate] = useState(initialDate || todayStr);
  const [checkInTime, setCheckInTime] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
  const [checkOutTime, setCheckOutTime] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
  const [targetStatus, setTargetStatus] = useState<'HADIR' | 'IZIN' | 'SAKIT'>('HADIR');
  const [correctionScope, setCorrectionScope] = useState<CorrectionScope>('MASUK');
  const [existingRecord, setExistingRecord] = useState<AttendanceRecord | null>(null);

  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAiPolishing, setIsAiPolishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [checkinEnd, setCheckinEnd] = useState<string>(CONSTANTS.DEFAULTS.WORK_CHECKIN_END);

  React.useEffect(() => {
    if (isOpen) {
      ProviderFactory.getProvider().getSettings().then((st) => {
        if (st?.work_checkin_end) setCheckinEnd(st.work_checkin_end.slice(0, 5));
      }).catch(() => {});

      if (initialDate) {
        setDate(initialDate);
      } else {
        setDate(todayStr);
      }
    }
  }, [isOpen, initialDate, todayStr]);

  // Fetch existing attendance data for current teacher on selected date
  React.useEffect(() => {
    if (isOpen && user?.id && date) {
      const userToken = token || 'MOCK_TOKEN';
      ProviderFactory.getProvider()
        .getDailyAttendance(date, userToken)
        .then((records) => {
          const rec = records.find((r) => r.user_id === user.id);
          if (rec) {
            setExistingRecord(rec);
            if (rec.status === 'HADIR' || rec.status === 'IZIN' || rec.status === 'SAKIT') {
              setTargetStatus(rec.status);
            }
            if (rec.check_in_time) setCheckInTime(rec.check_in_time.slice(0, 5));
            if (rec.check_out_time) setCheckOutTime(rec.check_out_time.slice(0, 5));
          } else {
            setExistingRecord(null);
            setTargetStatus('HADIR');
            setCheckInTime(CONSTANTS.DEFAULTS.WORK_CHECKIN_START);
            setCheckOutTime(CONSTANTS.DEFAULTS.WORK_CHECKOUT_START);
          }
        })
        .catch(() => {
          setExistingRecord(null);
        });
    }
  }, [isOpen, user?.id, date, token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (date > todayStr) {
      setErrorMsg(`Tanggal absensi (${date}) tidak boleh melebihi tanggal hari ini (${todayStr}). Pengajuan tanggal mendatang tidak diizinkan!`);
      return;
    }

    if (!reason || reason.trim().length < 10) {
      setErrorMsg('Alasan pengajuan koreksi wajib diisi minimal 10 karakter (misal: "Kendala sinyal HP saat scan QR").');
      return;
    }

    setIsLoading(true);

    try {
      let scopeText = '';
      if (targetStatus === 'HADIR') {
        if (correctionScope === 'MASUK') {
          scopeText = ` [Target Koreksi: Jam Masuk (${checkInTime} WIB)]`;
        } else if (correctionScope === 'PULANG') {
          scopeText = ` [Target Koreksi: Jam Pulang (${checkOutTime} WIB)]`;
        } else {
          scopeText = ` [Target Koreksi: Masuk (${checkInTime} WIB) & Pulang (${checkOutTime} WIB)]`;
        }
      }

      const fullReason = `[Pengajuan Koreksi Absen ${date}${scopeText} menjadi ${targetStatus}]: ${reason.trim()}`;

      await LeaveRepository.submitLeave({
        token: token || 'MOCK_TOKEN',
        leave_type: 'KOREKSI_ABSEN',
        start_date: date,
        end_date: date,
        reason: fullReason,
      });

      logger.info('GuruCorrectionRequestModal', 'Correction request submitted as pending leave request for date:', date);
      showToast('success', 'Pengajuan Koreksi Terkirim!', 'Pengajuan koreksi Anda telah masuk ke daftar persetujuan Admin/Kepsek.');

      setIsLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Gagal mengirimkan pengajuan koreksi absen';
      setErrorMsg(msg);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="✏️ Ajukan Koreksi Absensi Guru" maxWidth="xl">
      <form onSubmit={handleSubmit} className="space-y-3">
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-red-50 text-red-700 text-xs font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Nama Guru</label>
            <input
              type="text"
              disabled
              value={user?.full_name || 'Guru Pengajar'}
              className="w-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold rounded-xl p-2.5"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">Status yang Diharapkan</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as 'HADIR' | 'IZIN' | 'SAKIT')}
              className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="HADIR">✅ HADIR / MASUK</option>
              <option value="IZIN">📝 Izin Resmi</option>
              <option value="SAKIT">🏥 Sakit</option>
            </select>
          </div>
        </div>

        {targetStatus === 'HADIR' ? (
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
                  ℹ️ Pengajuan ini <strong>hanya mengoreksi Jam Masuk</strong>. Jam Pulang Anda tidak diubah.
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
                  ℹ️ Pengajuan ini <strong>hanya mengoreksi Jam Pulang</strong>. Jam Masuk Anda tidak diubah.
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
              <span>Untuk pengajuan status <strong>{targetStatus}</strong>, jam masuk & jam pulang tidak diperlukan.</span>
            </div>
          </div>
        )}

        <div className="bg-amber-50/80 border border-amber-200/80 p-2.5 rounded-xl text-[11px] text-amber-900 leading-relaxed font-medium">
          💡 <strong>Catatan:</strong> Pengajuan akan dikirim sebagai <i>Request Pending</i> ke Admin/Kepsek. Tanggal lampau diizinkan (maksimal hari ini). {targetStatus === 'HADIR' ? `Jam masuk > ${checkinEnd} WIB otomatis dievaluasi TERLAMBAT.` : `Status ${targetStatus} akan diajukan tanpa mencatat jam presensi fisik.`}
        </div>

        <div className="space-y-1">
          <div className="flex justify-between items-center">
            <label className="block text-xs font-semibold text-slate-700">Alasan Lengkap Koreksi</label>
            <button
              type="button"
              onClick={async () => {
                if (!reason.trim()) return;
                setIsAiPolishing(true);
                const res = await GroqAIService.analyzeLeaveReason(reason, 'KOREKSI_ABSEN');
                setReason(res.polishedReason);
                setIsAiPolishing(false);
                showToast('info', '✨ Kalimat Disempurnakan oleh Groq AI!', res.summary);
              }}
              disabled={isAiPolishing || !reason.trim()}
              className="text-[11px] text-emerald-600 hover:text-emerald-700 font-extrabold flex items-center gap-1 disabled:opacity-50 cursor-pointer"
            >
              <span>✨</span>
              <span>{isAiPolishing ? 'Menyempurnakan...' : 'Sempurnakan dengan AI'}</span>
            </button>
          </div>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan alasan jelas mengapa perlu dilakukan koreksi absensi (misal: kendala barcode direject)..."
            rows={2}
            required
            className="w-full bg-white border border-slate-200 text-slate-800 text-xs font-medium rounded-xl p-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>

        <div className="pt-2 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose} disabled={isLoading}>
            Batal
          </Button>
          <Button variant="primary" type="submit" isLoading={isLoading}>
            Kirim Pengajuan Koreksi
          </Button>
        </div>
      </form>
    </Modal>
  );
};

