import React from 'react';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';
import { LocationAddressBadge } from '../../../components/ui/LocationAddressBadge';
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-rose-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              📍
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Peta Lokasi & Geofence GPS</h3>
              <p className="text-[11px] text-rose-300 font-semibold truncate">{schoolName}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Scrollable Content with Interactive Map */}
        <div className="p-4 space-y-3.5 overflow-y-auto flex-1">
          {/* Interactive Map Box */}
          <div className="h-64 sm:h-72 w-full rounded-2xl overflow-hidden border border-slate-200 shadow-inner relative">
            <LiveLocationMap
              schoolLat={schoolLat}
              schoolLng={schoolLng}
              allowedRadius={maxRadiusMeters}
              className="w-full h-full"
            />
          </div>

          {/* School Physical Geocoded Address */}
          <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">
                Titik Koordinat Resmi Sekolah
              </span>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-extrabold rounded-lg">
                Radius {maxRadiusMeters}m
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-mono text-xs font-black text-slate-800">
                  {schoolLat.toFixed(6)}, {schoolLng.toFixed(6)}
                </span>
              </div>
              <LocationAddressBadge
                lat={schoolLat}
                lng={schoolLng}
                className="text-[11px] font-medium text-slate-700"
              />
            </div>
          </div>

          {/* Safety Geofence Info Notice */}
          <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-950">
            <span className="text-lg shrink-0">🛡️</span>
            <div className="text-[11px] leading-relaxed">
              <strong className="block font-bold">Pemeriksaan Radius GPS Aktif</strong>
              Presensi otomatis disetujui saat Anda berada di dalam radius {maxRadiusMeters} meter dari gerbang sekolah. Koordinat fisik Anda akan tervalidasi secara real-time.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex gap-2 shrink-0">
          {onOpenScanner && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenScanner();
              }}
              className="flex-1 py-2.5 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center shadow-xs"
            >
              📷 Pindai QR Sekarang
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup Peta
          </button>
        </div>
      </div>
    </div>
  );
};
