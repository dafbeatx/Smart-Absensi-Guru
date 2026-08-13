import React, { useState, useEffect } from 'react';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';
import { Modal } from '../../../components/ui/Modal';
import { getEffectiveAllowedRadius } from '../../../utils/geofence.utils';
import { logger } from '../../../utils/logger.utils';

export interface TeacherLocationCardProps {
  className?: string;
  onOpenScanner?: () => void;
}

export const TeacherLocationCard: React.FC<TeacherLocationCardProps> = ({ className = '', onOpenScanner }) => {
  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showMapModal, setShowMapModal] = useState(false);

  const geofenceSettings = GPSService.getGeofenceSettings();
  const allowedRadius = getEffectiveAllowedRadius(geofenceSettings.radius);

  const fetchLocation = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await GPSService.syncGeofenceSettings();
      const coords = await GPSService.getCurrentPosition();
      setGpsCoords(coords);
      setIsLoading(false);
      logger.info('TeacherLocationCard', 'GPS location obtained successfully:', coords);
    } catch (err: any) {
      setIsLoading(false);
      const msg = err?.message || 'Akses lokasi GPS belum diaktifkan pada browser HP Anda.';
      setErrorMsg(msg);
      logger.error('TeacherLocationCard', 'GPS fetch error:', msg);
    }
  };

  useEffect(() => {
    fetchLocation();
  }, []);

  const isWithinRadius = gpsCoords ? gpsCoords.distanceMeters <= allowedRadius : false;

  return (
    <>
      <div className={`bg-white rounded-2xl border border-[#DDD9D0] p-4 shadow-xs space-y-3 ${className}`}>
        {/* Card Header */}
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#DDD9D0]/60">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-[#023246]/5 text-[#023246] border border-[#023246]/10 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="min-w-0">
              <h3 className="text-xs font-black text-[#023246] uppercase tracking-wider truncate">
                Lokasi Real-Time &amp; Geofence
              </h3>
              <p className="text-[11px] text-slate-500 font-medium truncate">
                Status GPS &amp; Jarak Fisik Presensi Sekolah
              </p>
            </div>
          </div>

          <div className="shrink-0">
            {isLoading ? (
              <span className="px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-extrabold rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                Mengukur...
              </span>
            ) : errorMsg ? (
              <span className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 text-[10px] font-extrabold rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                Izin GPS Mati
              </span>
            ) : isWithinRadius ? (
              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-extrabold rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Dalam Radius (Aman)
              </span>
            ) : (
              <span className="px-2.5 py-1 bg-red-50 text-red-800 border border-red-200 text-[10px] font-extrabold rounded-lg flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                Di Luar Radius
              </span>
            )}
          </div>
        </div>

        {/* Details Metrics Grid */}
        {errorMsg ? (
          <div className="bg-red-50/80 border border-red-200 rounded-xl p-3 text-xs text-red-900 space-y-2">
            <p className="font-semibold">{errorMsg}</p>
            <button
              type="button"
              onClick={fetchLocation}
              className="w-full py-2 bg-red-600 hover:bg-red-700 text-white font-extrabold text-xs rounded-lg transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span>Aktifkan &amp; Muat Ulang GPS</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-50 border border-[#DDD9D0]/70 rounded-xl p-2.5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Jarak ke Pintu Sekolah</span>
              <p className="text-sm font-black text-[#023246] font-mono">
                {gpsCoords ? `${gpsCoords.distanceMeters} m` : '—'}
              </p>
              <span className="text-[10px] font-medium text-slate-500 block">
                Batas Aman: ≤ {allowedRadius}m
              </span>
            </div>

            <div className="bg-slate-50 border border-[#DDD9D0]/70 rounded-xl p-2.5 space-y-0.5">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Akurasi Sinyal GPS</span>
              <p className="text-sm font-black text-[#023246] font-mono">
                {gpsCoords?.accuracy ? `±${Math.round(gpsCoords.accuracy)} m` : '—'}
              </p>
              <span className="text-[10px] font-medium text-slate-500 block">
                {gpsCoords?.accuracy && gpsCoords.accuracy <= 25 ? 'Presisi Sangat Baik' : 'Akurasi Standar'}
              </span>
            </div>
          </div>
        )}

        {/* Action Controls Row */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 pt-1">
          {onOpenScanner && (
            <button
              type="button"
              onClick={onOpenScanner}
              className="w-full sm:w-auto py-2.5 px-3 bg-[#287A52] hover:bg-[#1f5f40] text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5"
            >
              <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
              </svg>
              <span>Scan QR Code Absen</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowMapModal(true)}
            className="flex-1 py-2.5 px-3 bg-[#023246] hover:bg-[#03445e] text-white font-extrabold text-xs rounded-xl shadow-2xs transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1.5 min-w-32"
          >
            <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span>Peta Live</span>
          </button>

          <button
            type="button"
            onClick={fetchLocation}
            disabled={isLoading}
            className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-extrabold text-xs rounded-xl border border-[#DDD9D0] transition-all active:scale-98 cursor-pointer flex items-center justify-center gap-1 shrink-0"
            title="Ukur ulang posisi GPS"
          >
            <svg className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span className="hidden sm:inline">Ukur GPS</span>
          </button>
        </div>
      </div>

      {/* Interactive Map Modal */}
      <Modal isOpen={showMapModal} onClose={() => setShowMapModal(false)} title="📍 Peta Geofence Presensi Real-Time">
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border border-[#DDD9D0]">
            <div>
              <span>Status: </span>
              <strong className={isWithinRadius ? 'text-emerald-700' : 'text-red-700'}>
                {isWithinRadius ? '🟢 Dalam Radius Safe-Zone' : '🔴 Di Luar Radius Sekolah'}
              </strong>
            </div>
            <span className="font-mono text-[11px] text-slate-500">
              Jarak: {gpsCoords ? `${gpsCoords.distanceMeters}m` : '—'}
            </span>
          </div>

          <LiveLocationMap
            userLat={gpsCoords?.latitude}
            userLng={gpsCoords?.longitude}
            schoolLat={geofenceSettings.lat}
            schoolLng={geofenceSettings.lng}
            allowedRadius={allowedRadius}
            accuracy={gpsCoords?.accuracy}
            height="340px"
          />

          <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
            <span>Peta berbasis OpenStreetMap &amp; Leaflet</span>
            <button
              type="button"
              onClick={fetchLocation}
              className="text-[#023246] font-bold hover:underline cursor-pointer"
            >
              🔄 Refresh Koordinat
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
