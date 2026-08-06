import React, { useState } from 'react';
import { X, FileText, Upload, CheckCircle2 } from 'lucide-react';
import { LeaveType, LeaveRequest } from '../types';

interface LeaveModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitLeave: (newLeave: LeaveRequest) => void;
}

export const LeaveModal: React.FC<LeaveModalProps> = ({
  isOpen,
  onClose,
  onSubmitLeave
}) => {
  const [type, setType] = useState<LeaveType>('Izin');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFileName(e.target.files[0].name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!startDate || !reason) return;

    const newRequest: LeaveRequest = {
      id: `LV-${Date.now().toString().slice(-4)}`,
      date: new Date().toISOString().split('T')[0],
      type,
      startDate: startDate || 'Hari Ini',
      endDate: endDate || startDate || 'Hari Ini',
      reason,
      attachmentName: fileName || 'dokumen_pendukung.pdf',
      status: 'Menunggu',
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    onSubmitLeave(newRequest);
    setIsSubmitted(true);

    setTimeout(() => {
      setIsSubmitted(false);
      setReason('');
      setStartDate('');
      setEndDate('');
      setFileName(null);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[412px] rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-600 rounded-xl text-white">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Formulir Permohonan Izin / Cuti</h3>
              <p className="text-[10px] text-blue-200 font-medium">SMP Terpadu Al-Ittihadiyah</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        {isSubmitted ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-[#0D7A5F] rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-base font-extrabold text-[#023246]">Pengajuan Berhasil Dikirim!</h4>
            <p className="text-xs text-slate-500">
              Permohonan {type} Anda telah terdaftar dan menunggu persetujuan Kepala Sekolah.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
            
            {/* Category Type Picker */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1.5">Jenis Pengajuan</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['Izin', 'Cuti', 'Sakit', 'Dinas Luar'] as LeaveType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setType(t)}
                    className={`py-2 px-1 rounded-xl text-[10px] font-bold border transition-all text-center ${
                      type === t
                        ? 'bg-[#0D7A5F] text-white border-[#0D7A5F] shadow-xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Mulai Tanggal</label>
                <input
                  type="date"
                  required
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0D7A5F]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">Sampai Tanggal</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0D7A5F]"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Alasan / Keterangan Lengkap</label>
              <textarea
                required
                rows={3}
                placeholder="Tuliskan alasan permohonan izin/cuti secara jelas..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0D7A5F] resize-none"
              ></textarea>
            </div>

            {/* File Upload Box */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Lampiran Dokumen (Surat Dokter / Tugas)</label>
              <label className="border-2 border-dashed border-slate-200 hover:border-emerald-500 bg-slate-50 p-3 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors">
                <Upload size={20} className="text-slate-400 mb-1" />
                <span className="text-[10px] font-bold text-slate-600">
                  {fileName ? fileName : 'Upload Surat Dokter / Berkas (PDF/JPG)'}
                </span>
                <span className="text-[9px] text-slate-400">Maksimal 5MB</span>
                <input type="file" accept="image/*,.pdf" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-3 bg-[#0D7A5F] hover:bg-[#0a634d] active:bg-[#08523f] text-white py-3.5 rounded-2xl font-extrabold text-xs tracking-wider uppercase shadow-md transition-all"
            >
              KIRIM PERMOHONAN IZIN / CUTI
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
