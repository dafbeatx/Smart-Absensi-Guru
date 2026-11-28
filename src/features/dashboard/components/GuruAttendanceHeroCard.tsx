import React from 'react';
import {
  SagaAttendanceStatusIcon,
  type SagaAttendanceStatusVariant,
  SagaFingerprintIcon,
  SagaLeavePermitIcon,
  SagaMapPinIcon,
  SagaScanQrIcon,
} from '../../../components/ui/SagaServiceIcons';

export interface GuruAttendanceHeroCardProps {
  statusVariant: SagaAttendanceStatusVariant;
  statusHeadline: string;
  scheduleHint: string;
  currentTimeLabel: string;
  isOnline: boolean;
  gpsStatus: 'READY' | 'REFINING' | 'OFF' | 'INVALID';
  gpsText: string;
  onScanQr: () => void;
  onBiometric: () => void;
  onLeave: () => void;
  onOpenLocation: () => void;
  onOpenTeacherBoard: () => void;
}

export const GuruAttendanceHeroCard: React.FC<GuruAttendanceHeroCardProps> = ({
  statusVariant,
  statusHeadline,
  scheduleHint,
  currentTimeLabel,
  isOnline,
  gpsStatus,
  gpsText,
  onScanQr,
  onBiometric,
  onLeave,
  onOpenLocation,
  onOpenTeacherBoard,
}) => {
  return (
    <section
      aria-label="Ringkasan dan Aksi Presensi Hari Ini"
      className="bg-[#0D5C46] text-white rounded-2xl p-4 sm:p-5 border border-[#094736] shadow-xs space-y-3.5"
    >
      {/* Baris Status Kehadiran & Jam WIB */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <SagaAttendanceStatusIcon
            variant={statusVariant}
            className="w-7 h-7 text-emerald-200 shrink-0 mt-0.5"
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-base sm:text-lg font-bold text-white leading-snug">
              {statusHeadline}
            </h2>
            <p className="text-xs text-emerald-100 leading-relaxed mt-0.5">
              {scheduleHint}
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <p className="text-base sm:text-lg font-bold text-white tabular-nums leading-snug">
            {currentTimeLabel}
          </p>
          <p className="text-[11px] font-medium text-emerald-100 mt-0.5 flex items-center justify-end gap-1.5">
            <span
              aria-hidden="true"
              className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-300' : 'bg-amber-300'}`}
            />
            <span>{isOnline ? 'Online' : 'Offline'}</span>
          </p>
        </div>
      </div>

      {/* Baris GPS & Papan Guru */}
      <div className="bg-[#094736] rounded-xl px-3 py-1.5 flex items-center justify-between gap-2 text-xs text-emerald-50">
        <button
          type="button"
          onClick={onOpenLocation}
          className="min-h-9 min-w-0 flex-1 text-left flex items-center gap-1.5 hover:underline cursor-pointer"
          title="Lihat lokasi dan radius GPS sekolah"
        >
          <SagaMapPinIcon
            tone="dark"
            className="w-4.5 h-4.5 shrink-0"
          />
          <span className="truncate font-medium">
            {gpsStatus === 'READY' || gpsStatus === 'INVALID' || gpsStatus === 'OFF' ? gpsText : gpsText}
          </span>
        </button>

        <button
          type="button"
          onClick={onOpenTeacherBoard}
          className="min-h-9 px-1.5 shrink-0 font-semibold text-emerald-100 hover:text-white hover:underline cursor-pointer"
        >
          Papan Guru
        </button>
      </div>

      {/* Baris 3 Aksi Cepat Sejajar (Tinta Putih + Aksen Doodle Cerah di Latar #094736) */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={onScanQr}
          className="min-h-13 rounded-xl px-2 py-2.5 saga-btn-hero-action border border-white/15 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          <SagaScanQrIcon tone="dark" className="w-6.5 h-6.5 shrink-0" />
          <span className="whitespace-nowrap">Scan QR</span>
        </button>

        <button
          type="button"
          onClick={onBiometric}
          className="min-h-13 rounded-xl px-2 py-2.5 saga-btn-hero-action border border-white/15 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          <SagaFingerprintIcon tone="dark" className="w-6.5 h-6.5 shrink-0" />
          <span className="whitespace-nowrap">Sidik Jari</span>
        </button>

        <button
          type="button"
          onClick={onLeave}
          className="min-h-13 rounded-xl px-2 py-2.5 saga-btn-hero-action border border-white/15 flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 font-bold text-xs sm:text-sm transition-colors cursor-pointer"
        >
          <SagaLeavePermitIcon tone="dark" className="w-6.5 h-6.5 shrink-0" />
          <span className="whitespace-nowrap">Izin / Sakit</span>
        </button>
      </div>
    </section>
  );
};
