import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import { CONSTANTS } from '../../../config/constants';

export interface ManualQRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmitCode: (code: string) => void;
}

export const ManualQRCodeModal: React.FC<ManualQRCodeModalProps> = ({
  isOpen,
  onClose,
  onSubmitCode,
}) => {
  const [manualCode, setManualCode] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!manualCode.trim()) {
      setError('Harap masukkan kode barcode / QR yang tertera di bawah poster sekolah.');
      return;
    }
    onSubmitCode(manualCode.trim());
    onClose();
  };

  const handleUsePreset = (code: string) => {
    setManualCode(code);
    onSubmitCode(code);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⌨️ Input Kode Barcode / QR Manual">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 p-3.5 rounded-2xl text-xs text-amber-900 space-y-1">
          <p className="font-bold flex items-center gap-1.5">
            <span>💡</span> Kapan Harus Menggunakan Fitur Ini?
          </p>
          <p className="leading-relaxed">
            Gunakan fitur ini jika pemindaian kamera HP bermasalah, poster buram/rusak, atau terjadi <strong>penolakan barcode (`REJECTED`)</strong> saat di-scan.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
            ⚠️ {error}
          </div>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-semibold text-slate-700">
            Kode Teks Barcode (Tertera di bawah poster fisik)
          </label>
          <input
            type="text"
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Misal: SMART_ABSENSI_OFFICIAL_QR_2026 atau SAG-2026-ATT"
            className="w-full bg-white border border-slate-200 text-slate-900 text-xs font-mono font-bold rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-emerald-500 uppercase tracking-wide"
            required
          />
        </div>

        {/* Quick Preset Buttons */}
        <div className="space-y-1.5 pt-1">
          <span className="text-[11px] text-slate-500 font-semibold block">Rekomendasi Kode Resmi Sekolah:</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => handleUsePreset(CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED)}
              className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 text-emerald-800 text-[11px] font-mono font-bold rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
            >
              <span>🔑</span>
              <span>Kode Resmi Utama (Pintu Sekolah)</span>
            </button>
          </div>
        </div>

        <div className="pt-3 flex justify-end gap-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" type="submit">
            Verifikasi & Process Absen
          </Button>
        </div>
      </form>
    </Modal>
  );
};
