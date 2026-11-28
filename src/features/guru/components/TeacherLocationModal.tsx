import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';
import { LocationAddressBadge } from '../../../components/ui/LocationAddressBadge';
import {
  SagaDeviceShieldIcon,
  SagaMapPinIcon,
  SagaScanQrIcon,
} from '../../../components/ui/SagaServiceIcons';
import { CONSTANTS } from '../../../config/constants';
import type { SystemSettings } from '../../../types/database.types';

interface TeacherLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenScanner?: () => void;
  settings?: SystemSettings;
}

export const TeacherLocationModal: React.FC<TeacherLocationModalProps> = ({
  isOpen,
  onClose,
  onOpenScanner,
  settings,
}) => {
  const schoolLat = settings?.geofence_lat ?? CONSTANTS.DEFAULTS.GEOFENCE_LAT;
  const schoolLng = settings?.geofence_lng ?? CONSTANTS.DEFAULTS.GEOFENCE_LNG;
  const maxRadiusMeters = settings?.geofence_radius ?? CONSTANTS.DEFAULTS.GEOFENCE_RADIUS_METERS;
  const schoolName = settings?.institution_name || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam';

  useEffect(() => {
    if (!isOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/75 flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Peta Lokasi dan Geofence GPS"
    >
      <div className="bg-white w-full sm:max-w-120 h-dvh sm:h-auto sm:max-h-[90dvh] rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 overflow-hidden flex flex-col">
        {/* Sticky Header */}
        <div className="bg-[#0D5C46] text-white pt-[max(14px,env(safe-area-inset-top))] pb-3.5 px-4 sm:px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center shrink-0 border border-white/15">
              <SagaMapPinIcon tone="dark" className="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-bold leading-tight truncate">Peta Lokasi &amp; Geofence GPS</h3>
              <p className="text-xs text-emerald-100 font-medium truncate">{schoolName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup peta lokasi"
            className="w-11 h-11 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors cursor-pointer shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content with Interactive Map */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1 bg-[#F8FAFC]">
          {/* Interactive Map Box */}
          <div className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-200 bg-white relative">
            <LiveLocationMap
              schoolLat={schoolLat}
              schoolLng={schoolLng}
              allowedRadius={maxRadiusMeters}
              className="w-full h-full"
            />
          </div>

          {/* School Physical Geocoded Address */}
          <div className="p-3.5 bg-white rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Titik Koordinat Resmi Sekolah
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-[#0D5C46] text-[11px] font-bold rounded-lg shrink-0">
                Radius {maxRadiusMeters}m
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-bold text-slate-900">
                  {schoolLat.toFixed(6)}, {schoolLng.toFixed(6)}
                </span>
              </div>
              <LocationAddressBadge
                lat={schoolLat}
                lng={schoolLng}
                className="text-xs font-medium text-slate-700"
              />
            </div>
          </div>

          {/* Safety Geofence Info Notice */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-950">
            <SagaDeviceShieldIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <div className="text-xs leading-relaxed">
              <strong className="block font-bold text-[#0D5C46]">Pemeriksaan Radius GPS Aktif</strong>
              Presensi otomatis disetujui saat Anda berada di dalam radius {maxRadiusMeters} meter dari gerbang sekolah. Koordinat fisik Anda akan tervalidasi secara real-time.
            </div>
          </div>
        </div>

        {/* Sticky Footer */}
        <div className="p-3.5 px-4 pb-[max(14px,env(safe-area-inset-bottom))] bg-white border-t border-slate-200 flex gap-2 shrink-0">
          {onOpenScanner && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenScanner();
              }}
              className="flex-1 min-h-12 py-2.5 px-3 bg-[#0D5C46] hover:bg-[#094736] text-white text-xs font-bold rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5"
            >
              <SagaScanQrIcon tone="dark" className="w-4 h-4 shrink-0" />
              <span>Pindai QR Sekarang</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 min-h-12 py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 text-xs font-bold rounded-xl transition-colors cursor-pointer text-center"
          >
            Tutup Peta
          </button>
        </div>
      </div>
    </div>
  );
};
