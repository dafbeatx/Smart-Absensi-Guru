import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import {
  SagaDeviceShieldIcon,
  SagaFingerprintIcon,
  SagaScanQrIcon,
} from '../../../components/ui/SagaServiceIcons';

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
      mobileFullscreen
    >
      <div className="flex flex-col justify-between min-h-full gap-4 py-1">
        <div className="space-y-4">
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
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
              className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-[#0D5C46] bg-white hover:bg-slate-50 shadow-2xs transition-colors active:scale-[0.99] cursor-pointer group flex items-start gap-3.5 focus:outline-none focus:ring-2 focus:ring-[#0D5C46]"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center shrink-0">
                <SagaFingerprintIcon className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-[#0D5C46] transition-colors">
                    Absen Sidik Jari HP
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-[#0D5C46] border border-emerald-200 shrink-0">
                    Cepat &amp; Instan
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-normal leading-snug">
                  Verifikasi instan dengan menempelkan jari pada sensor sidik jari smartphone Anda dalam radius geofence sekolah.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-sm font-bold text-[#0D5C46]">
                  <span>Pilih Sidik Jari</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
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
              className="w-full text-left p-4 rounded-2xl border border-slate-200 hover:border-[#0D5C46] bg-white hover:bg-slate-50 shadow-2xs transition-colors active:scale-[0.99] cursor-pointer group flex items-start gap-3.5 focus:outline-none focus:ring-2 focus:ring-[#0D5C46]"
            >
              <div className="w-12 h-12 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center shrink-0">
                <SagaScanQrIcon className="w-8 h-8" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-slate-900 tracking-tight group-hover:text-[#0D5C46] transition-colors">
                    Scan Barcode / QR Code
                  </h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                    Kamera HP
                  </span>
                </div>
                <p className="text-sm text-slate-600 font-normal leading-snug">
                  Pindai poster Barcode / QR Code resmi yang terpasang di gerbang masuk atau papan informasi absensi sekolah.
                </p>
                <div className="pt-1 flex items-center gap-1.5 text-sm font-bold text-[#0D5C46]">
                  <span>Buka Kamera Scanner</span>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </button>
          </div>

          {/* Security / Geofence Info Footer */}
          <div className="p-3.5 bg-[#F8FAFC] rounded-xl border border-slate-200 flex items-start gap-2.5 text-xs text-slate-600 font-medium leading-relaxed">
            <SagaDeviceShieldIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <span>
              Kedua metode absensi otomatis memeriksa koordinat GPS fisik asli smartphone Anda untuk memastikan kehadiran sah di area sekolah.
            </span>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white pt-3 pb-[max(4px,env(safe-area-inset-bottom))] border-t border-slate-100 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 text-sm font-bold rounded-xl transition-colors cursor-pointer min-h-12"
          >
            Tutup
          </button>
        </div>
      </div>
    </Modal>
  );
};
