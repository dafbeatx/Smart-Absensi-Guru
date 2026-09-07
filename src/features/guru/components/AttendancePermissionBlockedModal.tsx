import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../../components/ui/Modal';
import {
  PermissionGuardService,
  type AttendancePermissionsReport,
} from '../../../services/permission-guard.service';
import { Bell, MapPin, Camera, AlertTriangle, CheckCircle2, XCircle, RefreshCw, ArrowRight, ShieldAlert } from 'lucide-react';

export interface AttendancePermissionBlockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPermissionsSatisfied: () => void;
  requiresCamera?: boolean;
}

export const AttendancePermissionBlockedModal: React.FC<AttendancePermissionBlockedModalProps> = ({
  isOpen,
  onClose,
  onPermissionsSatisfied,
  requiresCamera = false,
}) => {
  const [report, setReport] = useState<AttendancePermissionsReport | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [activeRequestingId, setActiveRequestingId] = useState<string | null>(null);
  const [lastActionError, setLastActionError] = useState<string | null>(null);

  const refreshPermissions = useCallback(async () => {
    setIsChecking(true);
    setLastActionError(null);
    try {
      const rep = await PermissionGuardService.evaluatePermissions(requiresCamera);
      setReport(rep);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setLastActionError(`Gagal mengecek perizinan: ${msg}`);
    } finally {
      setIsChecking(false);
    }
  }, [requiresCamera]);

  useEffect(() => {
    if (isOpen) {
      refreshPermissions();
    }
  }, [isOpen, refreshPermissions]);

  const handleRequestNotification = async () => {
    setActiveRequestingId('notifications');
    setLastActionError(null);
    try {
      const res = await PermissionGuardService.requestNotificationPermission();
      if (!res.success && res.error) {
        setLastActionError(res.error);
      }
      await refreshPermissions();
    } finally {
      setActiveRequestingId(null);
    }
  };

  const handleRequestGeolocation = async () => {
    setActiveRequestingId('geolocation');
    setLastActionError(null);
    try {
      const res = await PermissionGuardService.requestGeolocationPermission();
      if (!res.success && res.error) {
        setLastActionError(res.error);
      }
      await refreshPermissions();
    } finally {
      setActiveRequestingId(null);
    }
  };

  const handleRequestCamera = async () => {
    setActiveRequestingId('camera');
    setLastActionError(null);
    try {
      const res = await PermissionGuardService.requestCameraPermission();
      if (!res.success && res.error) {
        setLastActionError(res.error);
      }
      await refreshPermissions();
    } finally {
      setActiveRequestingId(null);
    }
  };

  const handleProceed = () => {
    if (report?.isReadyForAttendance) {
      onClose();
      onPermissionsSatisfied();
    }
  };

  const notifItem = report?.permissions.notifications;
  const geoItem = report?.permissions.geolocation;
  const camItem = report?.permissions.camera;

  const isReady = report?.isReadyForAttendance === true;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Izin Perangkat Diperlukan"
      maxWidth="md"
    >
      <div className="space-y-4 py-1">
        {/* Banner Peringatan Pemblokiran */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/90 text-amber-950 space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-700 shrink-0" />
            <h4 className="text-xs font-black uppercase tracking-wide text-amber-900">
              Presensi Diblokir Sementara
            </h4>
          </div>
          <p className="text-[11px] leading-relaxed font-medium text-amber-800">
            Aplikasi mewajibkan izin perangkat aktif untuk menjamin keabsahan data presensi, validasi geofence sekolah, dan penerimaan notifikasi penting. Mohon izinkan akses di bawah ini:
          </p>
        </div>

        {/* Daftar Izin 1: Notifikasi */}
        <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-white space-y-2.5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                notifItem?.isGranted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-[#023246]'
              }`}>
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-black text-[#023246]">1. Izin Notifikasi Browser</h5>
                <p className="text-[10px] text-slate-400 font-semibold">Komunikasi, alarm &amp; warta sekolah</p>
              </div>
            </div>

            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider shrink-0 ${
              notifItem?.isGranted
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : notifItem?.status === 'denied'
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {notifItem?.isGranted
                ? 'DIIZINKAN'
                : notifItem?.status === 'denied'
                ? 'DITOLAK / DIBLOKIR'
                : 'BELUM DIIZINKAN'}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            {notifItem?.description}
          </p>

          {!notifItem?.isGranted && (
            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                disabled={activeRequestingId === 'notifications' || isChecking}
                onClick={handleRequestNotification}
                className="px-3.5 py-2 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {activeRequestingId === 'notifications' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                )}
                <span>Izinkan Notifikasi Sekarang</span>
              </button>

              {notifItem?.status === 'denied' && (
                <span className="text-[10px] text-rose-600 font-bold">
                  ⚠️ Izin diblokir. Ubah di Pengaturan Browser.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Daftar Izin 2: Lokasi GPS */}
        <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-white space-y-2.5 shadow-2xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                geoItem?.isGranted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-[#023246]'
              }`}>
                <MapPin className="w-4 h-4" />
              </div>
              <div>
                <h5 className="text-xs font-black text-[#023246]">2. Izin Lokasi GPS &amp; Geofence</h5>
                <p className="text-[10px] text-slate-400 font-semibold">Validasi posisi fisik di radius sekolah</p>
              </div>
            </div>

            <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider shrink-0 ${
              geoItem?.isGranted
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : geoItem?.status === 'denied'
                ? 'bg-rose-50 text-rose-800 border-rose-300'
                : 'bg-amber-50 text-amber-800 border-amber-300'
            }`}>
              {geoItem?.isGranted
                ? 'DIIZINKAN'
                : geoItem?.status === 'denied'
                ? 'DITOLAK / DIBLOKIR'
                : 'BELUM DIIZINKAN'}
            </span>
          </div>

          <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
            {geoItem?.description}
          </p>

          {!geoItem?.isGranted && (
            <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                type="button"
                disabled={activeRequestingId === 'geolocation' || isChecking}
                onClick={handleRequestGeolocation}
                className="px-3.5 py-2 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                {activeRequestingId === 'geolocation' ? (
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <MapPin className="w-3.5 h-3.5" />
                )}
                <span>Izinkan Akses Lokasi GPS</span>
              </button>

              {geoItem?.status === 'denied' && (
                <span className="text-[10px] text-rose-600 font-bold">
                  ⚠️ Lokasi diblokir browser.
                </span>
              )}
            </div>
          )}
        </div>

        {/* Daftar Izin 3: Kamera Scanner (Jika requiresCamera atau jika kamera belum diizinkan) */}
        {requiresCamera && (
          <div className="p-3.5 rounded-2xl border border-slate-200/90 bg-white space-y-2.5 shadow-2xs">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  camItem?.isGranted ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-[#023246]'
                }`}>
                  <Camera className="w-4 h-4" />
                </div>
                <div>
                  <h5 className="text-xs font-black text-[#023246]">3. Izin Kamera Scanner QR</h5>
                  <p className="text-[10px] text-slate-400 font-semibold">Pemindaian poster QR Code</p>
                </div>
              </div>

              <span className={`px-2 py-0.5 rounded-full text-[9px] font-black border uppercase tracking-wider shrink-0 ${
                camItem?.isGranted
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                  : camItem?.status === 'denied'
                  ? 'bg-rose-50 text-rose-800 border-rose-300'
                  : 'bg-amber-50 text-amber-800 border-amber-300'
              }`}>
                {camItem?.isGranted
                  ? 'DIIZINKAN'
                  : camItem?.status === 'denied'
                  ? 'DITOLAK / DIBLOKIR'
                  : 'BELUM DIIZINKAN'}
              </span>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed font-medium">
              {camItem?.description}
            </p>

            {!camItem?.isGranted && (
              <div className="pt-1 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <button
                  type="button"
                  disabled={activeRequestingId === 'camera' || isChecking}
                  onClick={handleRequestCamera}
                  className="px-3.5 py-2 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  {activeRequestingId === 'camera' ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Camera className="w-3.5 h-3.5" />
                  )}
                  <span>Izinkan Kamera Scanner</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* 🌟 KOTAK DETAIL ERROR & TRANSPARANSI TEKNIS ("JANGAN HIDE ERROR") ─── */}
        <div className="p-3.5 rounded-2xl bg-rose-50/90 border border-rose-200/90 text-rose-950 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-black text-rose-900">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Log Detail Kesalahan &amp; Status Perizinan Browser (Transparan)</span>
            </div>
          </div>

          <div className="space-y-1.5 text-[11px] font-mono bg-white p-2.5 rounded-xl border border-rose-200/60 leading-relaxed text-slate-800">
            {report?.rawErrors && report.rawErrors.length > 0 ? (
              report.rawErrors.map((errStr, idx) => (
                <div key={idx} className="flex items-start gap-1.5 text-rose-700">
                  <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0 mt-0.5" />
                  <span className="break-all font-semibold">{errStr}</span>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-700 font-semibold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>Seluruh izin perangkat terverifikasi normal tanpa kendala teknis.</span>
              </div>
            )}

            {lastActionError && (
              <div className="flex items-start gap-1.5 text-rose-800 pt-1 border-t border-rose-100 font-bold">
                <span>⚠️ Kesalahan Terakhir:</span>
                <span className="break-all">{lastActionError}</span>
              </div>
            )}
          </div>

          {/* Panduan Membuka Blokir Browser */}
          <div className="text-[10px] text-slate-600 leading-relaxed pt-0.5 space-y-1">
            <p className="font-bold text-slate-800">
              💡 Cara Membuka Izin yang Terlanjur Diblokir Browser / HP:
            </p>
            <ol className="list-decimal list-inside space-y-0.5 text-slate-600">
              <li>Ketuk ikon <b>Gembok 🔒</b> atau <b>Pengaturan Situs</b> di samping bilah alamat URL browser Anda.</li>
              <li>Pilih menu <b>Izin (Permissions)</b> lalu ubah status <b>Notifikasi</b> dan <b>Lokasi</b> menjadi <b>Izinkan (Allow)</b>.</li>
              <li>Setelah itu, klik tombol <b>Periksa Ulang Izin</b> di bawah ini.</li>
            </ol>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={refreshPermissions}
            disabled={isChecking}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-700 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 min-h-11 border border-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin' : ''}`} />
            <span>Periksa Ulang Izin</span>
          </button>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-600 text-xs font-bold transition-all cursor-pointer min-h-11 border border-slate-200"
            >
              Batal / Tutup
            </button>

            <button
              type="button"
              disabled={!isReady}
              onClick={handleProceed}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-1.5 min-h-11 shadow-xs ${
                isReady
                  ? 'bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer active:scale-95'
                  : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
              }`}
            >
              <span>Lanjutkan Presensi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
};
