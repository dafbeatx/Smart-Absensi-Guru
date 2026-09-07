import React from 'react';
import { Modal } from '../../../components/ui/Modal';

export interface AttendanceMethodChoiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectBiometric: () => void;
  onSelectQrScan: () => void;
}

export const AttendanceMethodChoiceModal: React.FC<AttendanceMethodChoiceModalProps> = ({
  isOpen,
  onClose,
  onSelectBiometric,
  onSelectQrScan,
}) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Pilih Metode Presensi"
      maxWidth="md"
    >
      <div className="space-y-4 py-1">
        <p className="text-xs text-slate-600 font-medium leading-relaxed">
          Silakan pilih cara verifikasi kehadiran Anda hari ini. Seluruh metode terlindungi oleh validasi radius GPS sekolah:
        </p>

        <div className="space-y-3">
          {/* Opsi 1: Sidik Jari HP (Biometrik) */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectBiometric();
            }}
            className="w-full text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-[#023246] bg-white hover:bg-slate-50/70 shadow-2xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group flex items-start gap-3.5 focus:outline-none focus:ring-2 focus:ring-[#023246]"
          >
            <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center text-2xl shrink-0 group-hover:bg-[#023246] group-hover:text-white transition-colors shadow-2xs">
              👆
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm font-black text-[#023246] tracking-tight group-hover:text-teal-900 transition-colors">
                  Absen Sidik Jari HP
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                  ⚡ Cepat &amp; Instan
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-snug">
                Verifikasi instan dengan menempelkan jari pada sensor sidik jari smartphone Anda dalam radius geofence sekolah.
              </p>
              <div className="pt-1 flex items-center gap-1 text-xs font-black text-teal-700 group-hover:text-[#023246] transition-colors">
                <span>Pilih Sidik Jari</span>
                <span className="group-hover:translate-x-0.5 transition-transform">➔</span>
              </div>
            </div>
          </button>

          {/* Opsi 2: Scan Barcode / QR Code Sekolah */}
          <button
            type="button"
            onClick={() => {
              onClose();
              onSelectQrScan();
            }}
            className="w-full text-left p-4 rounded-2xl border-2 border-slate-200 hover:border-[#023246] bg-white hover:bg-slate-50/70 shadow-2xs hover:shadow-md transition-all active:scale-[0.98] cursor-pointer group flex items-start gap-3.5 focus:outline-none focus:ring-2 focus:ring-[#023246]"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-200 text-blue-700 flex items-center justify-center text-2xl shrink-0 group-hover:bg-[#023246] group-hover:text-white transition-colors shadow-2xs">
              📷
            </div>
            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <h4 className="text-sm font-black text-[#023246] tracking-tight group-hover:text-blue-900 transition-colors">
                  Scan Barcode / QR Code
                </h4>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-blue-50 text-blue-800 border border-blue-200 shrink-0">
                  📷 Kamera HP
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium leading-snug">
                Pindai poster Barcode / QR Code resmi yang terpasang di gerbang masuk atau papan informasi absensi sekolah.
              </p>
              <div className="pt-1 flex items-center gap-1 text-xs font-black text-blue-700 group-hover:text-[#023246] transition-colors">
                <span>Buka Kamera Scanner</span>
                <span className="group-hover:translate-x-0.5 transition-transform">➔</span>
              </div>
            </div>
          </button>
        </div>

        {/* Security / Geofence Info Footer */}
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center gap-2 text-[11px] text-slate-500 font-medium">
          <span className="text-base shrink-0">🛡️</span>
          <span>
            Kedua metode absensi otomatis memeriksa koordinat GPS fisik asli smartphone Anda untuk memastikan kehadiran sah di area sekolah.
          </span>
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-all cursor-pointer min-h-11"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
};
