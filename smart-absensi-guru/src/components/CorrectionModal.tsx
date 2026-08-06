import React, { useState } from 'react';
import { X, Edit3, Upload, CheckCircle2, Clock } from 'lucide-react';
import { CorrectionRequest } from '../types';

interface CorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCorrection: (newCorrection: CorrectionRequest) => void;
}

export const CorrectionModal: React.FC<CorrectionModalProps> = ({
  isOpen,
  onClose,
  onSubmitCorrection
}) => {
  const [date, setDate] = useState('');
  const [proposedCheckIn, setProposedCheckIn] = useState('07:05');
  const [proposedCheckOut, setProposedCheckOut] = useState('14:05');
  const [reason, setReason] = useState('');
  const [proofName, setProofName] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setProofName(e.target.files[0].name);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !reason) return;

    const newCorrection: CorrectionRequest = {
      id: `COR-${Date.now().toString().slice(-4)}`,
      date,
      originalCheckIn: '-- : --',
      proposedCheckIn: proposedCheckIn ? `${proposedCheckIn} WIB` : '07:05 WIB',
      originalCheckOut: '-- : --',
      proposedCheckOut: proposedCheckOut ? `${proposedCheckOut} WIB` : '14:00 WIB',
      reason,
      proofName: proofName || 'foto_bukti_piket.jpg',
      status: 'Menunggu',
      createdAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
    };

    onSubmitCorrection(newCorrection);
    setIsSubmitted(true);

    setTimeout(() => {
      setIsSubmitted(false);
      setReason('');
      setDate('');
      setProofName(null);
      onClose();
    }, 1800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-[412px] rounded-t-[32px] sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-orange-500 rounded-xl text-white">
              <Edit3 size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold leading-tight">Pengajuan Koreksi Absen</h3>
              <p className="text-[10px] text-orange-200 font-medium">Revisi Jam Masuk / Pulang</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-full text-slate-300 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        {isSubmitted ? (
          <div className="p-8 text-center flex flex-col items-center justify-center space-y-3">
            <div className="w-16 h-16 bg-emerald-100 text-[#0D7A5F] rounded-full flex items-center justify-center animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <h4 className="text-base font-extrabold text-[#023246]">Koreksi Absen Berhasil Diajukan!</h4>
            <p className="text-xs text-slate-500">
              Pengajuan Anda akan diverifikasi oleh Tim Piket & Admin Simpeg Sekolah.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4">
            
            {/* Target Date */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Pilih Tanggal Presensi</label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0D7A5F]"
              />
            </div>

            {/* Proposed Check-in & Check-out */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Clock size={12} className="text-emerald-600" />
                  Koreksi Jam Masuk
                </label>
                <input
                  type="time"
                  value={proposedCheckIn}
                  onChange={(e) => setProposedCheckIn(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#0D7A5F]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Clock size={12} className="text-rose-500" />
                  Koreksi Jam Pulang
                </label>
                <input
                  type="time"
                  value={proposedCheckOut}
                  onChange={(e) => setProposedCheckOut(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono font-bold text-slate-800 focus:outline-none focus:border-[#0D7A5F]"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Alasan Koreksi / Kendala Teknis</label>
              <textarea
                required
                rows={3}
                placeholder="Contoh: GPS kendala sinyal, HP mati saat scan, atau tugas luar piket pagi..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-800 focus:outline-none focus:border-[#0D7A5F] resize-none"
              ></textarea>
            </div>

            {/* Bukti Foto Upload */}
            <div>
              <label className="block text-[11px] font-bold text-slate-600 mb-1">Bukti Foto / Absen Manual Piket</label>
              <label className="border-2 border-dashed border-slate-200 hover:border-orange-400 bg-slate-50 p-3 rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-colors">
                <Upload size={20} className="text-slate-400 mb-1" />
                <span className="text-[10px] font-bold text-slate-600">
                  {proofName ? proofName : 'Upload Foto Bukti Kehadiran (JPG/PNG)'}
                </span>
                <span className="text-[9px] text-slate-400">Catatan piket / foto selfie sekolah</span>
                <input type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full mt-3 bg-[#023246] hover:bg-[#03435e] active:bg-[#012230] text-white py-3.5 rounded-2xl font-extrabold text-xs tracking-wider uppercase shadow-md transition-all"
            >
              KIRIM PERMOHONAN KOREKSI
            </button>
          </form>
        )}

      </div>
    </div>
  );
};
