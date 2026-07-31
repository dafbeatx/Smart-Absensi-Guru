import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LeaveValidationService } from '../../../services/leave-validation.service';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import type { LeaveType } from '../../../types/database.types';

export interface LeaveApplicationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const LeaveApplicationModal: React.FC<LeaveApplicationModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { token } = useAuthStore();
  const { showToast } = useToastStore();

  const [leaveType, setLeaveType] = useState<LeaveType>('SAKIT');
  const [startDate, setStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    // Business rule validation
    const valResult = LeaveValidationService.validateLeaveRequest(startDate, endDate, reason);
    if (!valResult.isValid && valResult.error) {
      setErrorMsg(`${valResult.error.message} ${valResult.error.solution}`);
      return;
    }

    setIsLoading(true);

    try {
      await LeaveRepository.submitLeave({
        token: token || 'MOCK_TOKEN',
        leave_type: leaveType,
        start_date: startDate,
        end_date: endDate,
        reason,
        attachment_base64: attachmentBase64,
      });

      showToast('success', 'Pengajuan Berhasil!', 'Pengajuan izin Anda telah dikirim ke Kepala Sekolah.');
      setIsLoading(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pengajuan izin';
      setErrorMsg(msg);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📝 Form Pengajuan Izin / Sakit">
      <form onSubmit={handleSubmit} className="space-y-4">
        {errorMsg && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span>⚠️</span> Kendala Pengajuan
            </div>
            <p>{errorMsg}</p>
          </div>
        )}

        {/* Jenis Pengajuan Radio Selector */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Jenis Ketidakhadiran</label>
          <div className="grid grid-cols-3 gap-2">
            {(['SAKIT', 'IZIN', 'DINAS_LUAR'] as LeaveType[]).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => setLeaveType(type)}
                className={`py-2.5 px-3 rounded-2xl text-xs font-bold border transition-all ${
                  leaveType === type
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {type === 'SAKIT' ? '🤒 Sakit' : type === 'IZIN' ? '📝 Izin' : '💼 Dinas'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range Selection Grid */}
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Tanggal Mulai"
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />
          <Input
            label="Tanggal Selesai"
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>

        {/* Reason Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Keterangan / Alasan (Min 10 Karakter)</label>
          <textarea
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Tuliskan keterangan detail alasan ketidakhadiran Anda..."
            className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
          />
        </div>

        {/* Photo Attachment Input */}
        <div className="space-y-1.5">
          <label className="block text-xs font-semibold text-slate-700">Unggah Bukti (Dokumen / Surat Dokter)</label>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileChange}
            className="w-full text-xs text-slate-600 border border-slate-200 rounded-2xl p-2 cursor-pointer bg-white file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-none file:font-bold file:bg-emerald-50 file:text-emerald-700"
          />
        </div>

        <div className="pt-2 flex items-center gap-2">
          <Button type="button" variant="secondary" className="w-1/2" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" variant="primary" className="w-1/2" isLoading={isLoading}>
            Kirim Pengajuan
          </Button>
        </div>
      </form>
    </Modal>
  );
};
