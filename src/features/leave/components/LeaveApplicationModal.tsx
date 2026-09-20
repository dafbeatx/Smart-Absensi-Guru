import React, { useState, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { LeaveValidationService } from '../../../services/leave-validation.service';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { getTodayDateInJakarta } from '../../../services/analytics.service';
import type { LeaveType } from '../../../types/database.types';
import { convertToWebP } from '../../../utils/image.utils';
import {
  WhatsAppNotificationService,
  type WhatsAppLeaveParams,
} from '../../../services/whatsapp-notification.service';

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
  const { token, user } = useAuthStore();
  const { showToast } = useToastStore();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [leaveType, setLeaveType] = useState<LeaveType>('SAKIT');
  const [startDate, setStartDate] = useState(() => getTodayDateInJakarta());
  const [endDate, setEndDate] = useState(() => getTodayDateInJakarta());
  const [reason, setReason] = useState('');
  const [dutyTeacherNotes, setDutyTeacherNotes] = useState('');
  const [attachmentBase64, setAttachmentBase64] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedLeave, setSubmittedLeave] = useState<WhatsAppLeaveParams | null>(null);
  const [isCopied, setIsCopied] = useState(false);

  // Auto-reset form dates to today in Jakarta time when modal opens
  React.useEffect(() => {
    if (isOpen) {
      const todayStr = getTodayDateInJakarta();
      setStartDate(todayStr);
      setEndDate(todayStr);
      setLeaveType('SAKIT');
      setReason('');
      setDutyTeacherNotes('');
      setAttachmentBase64('');
      setFileName('');
      setErrorMsg(null);
      setSubmittedLeave(null);
      setIsCopied(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }, [isOpen]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'application/pdf'];
      const maxSize = 10 * 1024 * 1024; // 10MB input limit since we compress to <100KB

      if (!allowedTypes.includes(file.type)) {
        showToast('error', 'Format File Tidak Didukung', 'Gunakan format PNG, JPG, JPEG, WEBP, atau PDF.');
        handleRemoveFile();
        return;
      }

      if (file.size > maxSize) {
        showToast('error', 'Ukuran File Melebihi Batas', 'Ukuran file lampiran maksimal adalah 10 MB.');
        handleRemoveFile();
        return;
      }

      try {
        if (file.type.startsWith('image/')) {
          // Auto convert to WebP (max 800x800, 70% quality) to reduce size to ~30-60KB
          const webpFile = await convertToWebP(file, 800, 800, 0.7);
          const baseName = file.name.substring(0, file.name.lastIndexOf('.')) || 'lampiran';
          setFileName(`${baseName}.webp`);
          const reader = new FileReader();
          reader.onloadend = () => {
            setAttachmentBase64(reader.result as string);
          };
          reader.readAsDataURL(webpFile);
        } else {
          // PDF document
          setFileName(file.name);
          const reader = new FileReader();
          reader.onloadend = () => {
            setAttachmentBase64(reader.result as string);
          };
          reader.readAsDataURL(file);
        }
      } catch (err) {
        console.warn('Failed to compress leave attachment, falling back to original:', err);
        setFileName(file.name);
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentBase64(reader.result as string);
        };
        reader.readAsDataURL(file);
      }
    } else {
      setAttachmentBase64('');
      setFileName('');
    }
  };

  const handleRemoveFile = () => {
    setAttachmentBase64('');
    setFileName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

    if (!dutyTeacherNotes || dutyTeacherNotes.trim().length < 5) {
      setErrorMsg('Wajib memberikan instruksi / tugas kelas untuk Guru Piket (minimal 5 karakter).');
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
        attachment_url: attachmentBase64 || undefined,
        attachment_base64: attachmentBase64,
        duty_teacher_notes: dutyTeacherNotes.trim(),
      });

      showToast('success', 'Pengajuan Berhasil!', 'Pengajuan izin & tugas piket telah dicatat di sistem.');

      const leaveParams: WhatsAppLeaveParams = {
        teacherName: user?.full_name || 'Guru',
        npp: user?.npp || user?.nip || undefined,
        role: user?.role || 'GURU',
        leaveType,
        startDate,
        endDate,
        reason,
        dutyTeacherNotes: dutyTeacherNotes.trim(),
      };

      // Auto-trigger WhatsApp universal share dialog in 1 click
      WhatsAppNotificationService.openWhatsAppLeaveShare(leaveParams);

      setSubmittedLeave(leaveParams);
      setIsLoading(false);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Gagal mengirim pengajuan izin';
      setErrorMsg(msg);
    }
  };

  const handleCopyLeaveText = () => {
    if (!submittedLeave) return;
    const text = WhatsAppNotificationService.generateWhatsAppLeaveShareText(submittedLeave);
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard
        .writeText(text)
        .then(() => {
          setIsCopied(true);
          showToast('success', 'Teks Disalin!', 'Laporan izin & tugas piket disalin ke clipboard.');
          setTimeout(() => setIsCopied(false), 2500);
        })
        .catch(() => {
          showToast('info', 'Format Pesan', text);
        });
    } else {
      showToast('info', 'Format Pesan', text);
    }
  };

  const handleFinishAndClose = () => {
    setSubmittedLeave(null);
    onClose();
  };

  const modalTitle = submittedLeave
    ? '📢 Teruskan ke Grup WhatsApp Sekolah'
    : '📝 Form Pengajuan Izin / Sakit';

  return (
    <Modal isOpen={isOpen} onClose={handleFinishAndClose} title={modalTitle}>
      {submittedLeave ? (
        <div className="space-y-4 animate-fadeIn">
          {/* Status Header Notification */}
          <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200/90 text-center space-y-1.5 shadow-2xs">
            <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center text-xl mx-auto shadow-sm ring-2 ring-emerald-100">
              ✓
            </div>
            <h3 className="text-sm font-black text-emerald-950">
              Pengajuan Izin Berhasil Dicatat!
            </h3>
            <p className="text-xs text-emerald-800 leading-relaxed max-w-sm mx-auto">
              Data absensi & pesan tugas untuk Guru Piket telah tersimpan. Silakan teruskan laporan ini langsung ke <strong>Grup WhatsApp Sekolah</strong>.
            </p>
          </div>

          {/* Structured Message Preview */}
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5 text-xs text-slate-800">
            <div className="flex items-center justify-between pb-1.5 border-b border-slate-200">
              <span className="font-extrabold text-slate-500 uppercase tracking-wider text-[10px]">
                Pratinjau Pesan Grup WhatsApp
              </span>
              <span
                className={`px-2 py-0.5 rounded-md text-[9.5px] font-black border ${
                  submittedLeave.leaveType === 'SAKIT'
                    ? 'bg-rose-50 text-rose-800 border-rose-200'
                    : submittedLeave.leaveType === 'DINAS_LUAR'
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-amber-50 text-amber-900 border-amber-200'
                }`}
              >
                {submittedLeave.leaveType === 'SAKIT'
                  ? '🤒 Sakit'
                  : submittedLeave.leaveType === 'DINAS_LUAR'
                  ? '💼 Dinas Luar'
                  : submittedLeave.leaveType === 'CUTI'
                  ? '🏖️ Cuti'
                  : '📝 Izin'}
              </span>
            </div>

            <div className="space-y-1.5 text-slate-700 leading-relaxed text-[11.5px]">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Nama Guru:</span>
                <span className="font-extrabold text-slate-900">{submittedLeave.teacherName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">NPP:</span>
                <span className="font-mono font-semibold text-slate-800">{submittedLeave.npp || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Tanggal Izin:</span>
                <span className="font-bold text-slate-800">
                  {submittedLeave.startDate === submittedLeave.endDate
                    ? submittedLeave.startDate
                    : `${submittedLeave.startDate} s.d. ${submittedLeave.endDate}`}
                </span>
              </div>
              <div>
                <span className="text-slate-500 font-bold block mb-0.5">Alasan / Keterangan:</span>
                <p className="bg-white p-2 rounded-xl border border-slate-200 italic text-slate-800 text-[11px]">
                  "{submittedLeave.reason}"
                </p>
              </div>
            </div>

            {/* Prominent Duty Teacher Tasks Box */}
            <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-300 space-y-1 shadow-3xs">
              <div className="flex items-center gap-1.5 text-amber-950 font-black text-[10.5px] uppercase tracking-wider">
                <span>📋</span>
                <span>Tugas untuk Guru Piket / Pengganti:</span>
              </div>
              <p className="text-xs font-bold text-amber-900 leading-relaxed italic">
                "{submittedLeave.dutyTeacherNotes || 'Siswa belajar mandiri / tugas buku paket.'}"
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-2 pt-1">
            <button
              type="button"
              onClick={() => WhatsAppNotificationService.openWhatsAppLeaveShare(submittedLeave)}
              className="w-full py-3.5 bg-[#25D366] hover:bg-[#20bd5a] text-white font-black text-xs sm:text-sm rounded-2xl transition-all cursor-pointer shadow-lg hover:shadow-xl active:scale-98 flex items-center justify-center gap-2 border border-emerald-400 min-h-12"
            >
              <span className="text-lg">💬</span>
              <span>Kirim ke Grup WhatsApp Sekolah</span>
              <span className="text-[10px] bg-white/25 px-2 py-0.5 rounded-full font-black uppercase">
                1-Klik
              </span>
            </button>

            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopyLeaveText}
                className="w-full text-xs font-bold min-h-11 border-slate-200 hover:bg-slate-100"
              >
                {isCopied ? '✓ Teks Disalin' : '📋 Salin Teks Pesan'}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleFinishAndClose}
                className="w-full text-xs font-black min-h-11 bg-[#023246] hover:bg-[#0D7A5F]"
              >
                Selesai &amp; Tutup
              </Button>
            </div>
          </div>
        </div>
      ) : (
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
            <label className="block text-xs font-semibold text-slate-700">Jenis Ketidakhadiran / Cuti</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(['SAKIT', 'IZIN', 'DINAS_LUAR', 'CUTI'] as LeaveType[]).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setLeaveType(type)}
                  className={`py-2.5 px-2.5 rounded-2xl text-xs font-bold border transition-all ${
                    leaveType === type
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {type === 'SAKIT'
                    ? '🤒 Sakit'
                    : type === 'IZIN'
                    ? '📝 Izin'
                    : type === 'DINAS_LUAR'
                    ? '💼 Dinas'
                    : '🏖️ Cuti'}
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
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tuliskan keterangan detail alasan ketidakhadiran Anda..."
              className="w-full bg-white border border-slate-200 rounded-2xl p-3 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
            />
          </div>

          {/* Tugas / Pesan Titipan untuk Guru Piket (Wajib) */}
          <div className="space-y-2 p-3 rounded-2xl bg-amber-50/60 border border-amber-200/90 shadow-2xs">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold text-amber-950">
                <span>📋</span>
                <span>Tugas / Pesan untuk Guru Piket</span>
              </label>
              <span className="text-[10px] font-black text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-300">
                Wajib Diisi
              </span>
            </div>
            <textarea
              rows={2}
              value={dutyTeacherNotes}
              onChange={(e) => setDutyTeacherNotes(e.target.value)}
              placeholder="Tuliskan materi/tugas kelas atau instruksi untuk guru piket/pengganti..."
              className="w-full bg-white border border-amber-200 rounded-xl p-2.5 text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all"
            />
            {/* Quick Preset Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[10px] font-bold text-slate-500">Pilihan Cepat:</span>
              {[
                'Tugas Mandiri Kelas / LKS',
                'Materi di Google Classroom',
                'Mohon Awasi Ketertiban Kelas',
                'Kuis / Latihan Harian',
              ].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() =>
                    setDutyTeacherNotes((prev) =>
                      prev.trim() ? `${prev.trim()} • ${preset}` : preset
                    )
                  }
                  className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white border border-amber-200 text-amber-900 hover:bg-amber-100 active:scale-95 transition-all cursor-pointer shadow-3xs"
                >
                  + {preset}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-amber-800 leading-tight">
              *Pesan ini akan otomatis dimunculkan pada <strong>Beranda Guru Piket</strong> yang bertugas pada hari izin Anda.
            </p>
          </div>

          {/* Custom File Upload (hidden native input + styled UI) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700">
                Unggah Bukti (Dokumen / Surat Dokter)
              </label>
              <span className="text-[10px] font-extrabold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                Opsional
              </span>
            </div>
            {/* Hidden native file input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf"
              onChange={handleFileChange}
              className="hidden"
            />
            {fileName ? (
              <div className="flex items-center gap-2 p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl">
                <span className="text-emerald-600 text-sm">📎</span>
                <span className="text-xs font-semibold text-emerald-800 truncate flex-1">{fileName}</span>
                <button
                  type="button"
                  onClick={handleRemoveFile}
                  className="text-red-500 hover:text-red-700 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-red-50 transition-all"
                >
                  ✕
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-xl text-xs text-slate-500 font-semibold hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50/50 transition-all cursor-pointer"
              >
                <span>📄</span> Pilih Berkas (Gambar / PDF)
              </button>
            )}
            <p className="text-[10px] text-slate-500 italic">
              *Pengunggahan berkas bersifat opsional. Jika tidak ada lampiran surat dokter/dinas, bidang ini dapat dikosongkan.
            </p>
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
      )}
    </Modal>
  );
};
