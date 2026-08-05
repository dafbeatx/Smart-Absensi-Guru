import React, { useState, useEffect, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import { SoundService } from '../../../services/audio.service';
import { NotificationService } from '../../../services/notification-permission.service';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { useAuthStore } from '../../../store/useAuthStore';

export interface QRScannerOverlayProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { timestamp: string; distance: number; status: string }) => void;
}

export const QRScannerOverlay: React.FC<QRScannerOverlayProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isCheckingGPS, setIsCheckingGPS] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  const [scanResult, setScanResult] = useState<{ timestamp: string; distance: number; status: string } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  const fetchGPSLocation = async () => {
    setIsCheckingGPS(true);
    setGpsError(null);
    try {
      await GPSService.syncGeofenceSettings();
      const coords = await GPSService.getCurrentPosition();
      setGpsCoords(coords);
      setIsCheckingGPS(false);
      return coords;
    } catch (err: unknown) {
      setIsCheckingGPS(false);
      setGpsCoords(null);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Perizinan lokasi GPS belum diberikan. Harap aktifkan izin lokasi di browser HP Anda.';
      setGpsError(msg);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      isProcessingRef.current = false;
      setCameraError(null);
      fetchGPSLocation();

      // Dynamic import of html5-qrcode engine on demand
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        if (!isMounted) return;

        const html5QrCode = new Html5Qrcode("reader");
        scannerRef.current = html5QrCode;

        const config = { fps: 10, qrbox: { width: 250, height: 250 } };

        html5QrCode.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            handleScanSuccess(decodedText);
          },
          () => {}
        ).catch((err) => {
          console.error("Camera access error:", err);
          setCameraError("Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin kamera di browser HP.");
        });
      }).catch((err) => {
        console.error("Failed to load QR engine chunk:", err);
        setCameraError("Gagal memuat engine QR scanner. Periksa koneksi internet Anda.");
      });

      return () => {
        isMounted = false;
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch(console.error);
        }
      };
    }
  }, [isOpen]);

  const geofenceSettings = GPSService.getGeofenceSettings();
  const allowedRadius = Math.max(geofenceSettings.radius || 50, 500);

  const handleScanSuccess = async (_qrData: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch(console.error);
    }

    // 1. Fetch & Validate Geofence Radius GPS Location
    let currentCoords = gpsCoords;
    if (!currentCoords) {
      currentCoords = await fetchGPSLocation();
    }

    if (!currentCoords) {
      // REJECT: Perizinan lokasi GPS ditolak/tidak aktif
      SoundService.playError();
      setRejectionReason('Absensi Ditolak! Perizinan lokasi GPS tidak diizinkan atau lokasi HP Anda tidak dapat terdeteksi. Silakan aktifkan izin lokasi di HP Anda.');
      setIsRejectionModalOpen(true);
      isProcessingRef.current = false;
      return;
    }

    const validation = GPSService.validateGeofenceRadius(currentCoords, allowedRadius);

    if (!validation.isValid) {
      // REJECT: Absensi diluar lokasi radius yang diizinkan
      SoundService.playError();
      let hint = '';
      if (currentCoords.distanceMeters > 1000) {
        hint = '\n\n💡 Catatan: Jarak terdeteksi di atas 1 KM dari sekolah. Pastikan koordinat lokasi sekolah di Pengaturan sudah benar.';
      }
      setRejectionReason(`Absensi Ditolak! Anda terdeteksi berada ${currentCoords.distanceMeters} meter dari lokasi sekolah. Batas maksimum radius yang diizinkan adalah ${allowedRadius} meter.${hint}`);
      setIsRejectionModalOpen(true);
      isProcessingRef.current = false;
      return;
    }

    // 2. SAVE ATTENDANCE RECORD (Must succeed BEFORE showing success UI)
    const token = useAuthStore.getState().token || 'MOCK_TOKEN';
    const deviceUUID = useAuthStore.getState().deviceUUID || 'DEV_UUID';
    let returnedStatus = 'HADIR';

    try {
      const res = await AttendanceRepository.scanAttendance({
        token: token,
        qr_seed: _qrData || 'SEED_SMP_TERPADU',
        user_lat: currentCoords.latitude,
        user_lng: currentCoords.longitude,
        device_uuid: deviceUUID,
      });

      if (res && res.status) {
        returnedStatus = res.status;
      }

      window.dispatchEvent(new Event('smart_absensi_scanned'));
    } catch (err: unknown) {
      console.error('Failed to save attendance record to provider:', err);
      SoundService.playError();
      const errMsg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Gagal menyimpan data absensi ke server. Silakan coba beberapa saat lagi.';
      setRejectionReason(`Gagal Menyimpan Absensi!\n\n${errMsg}`);
      setIsRejectionModalOpen(true);
      isProcessingRef.current = false;
      return;
    }

    // 3. APPROVE: Sound, Notification & Modal
    SoundService.playAttendanceSuccess();

    const timestampStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
    const teacherName = useAuthStore.getState().user?.full_name || 'Guru';
    NotificationService.notifyTeacherCheckIn(teacherName, timestampStr);

    const statusLabel = returnedStatus === 'TERLAMBAT' ? 'TERLAMBAT (Terlambat)' : 'HADIR (Tepat Waktu)';

    const result = {
      timestamp: timestampStr,
      distance: currentCoords.distanceMeters,
      status: statusLabel
    };

    setScanResult(result);
    setIsSuccessModalOpen(true);

    // Auto-Submit 2.0s Timer
    setTimeout(() => {
      setIsSuccessModalOpen(false);
      onSuccess(result);
      onClose();
    }, 2000);
  };

  if (!isOpen) return null;

  const isWithinRadius = gpsCoords ? gpsCoords.distanceMeters <= allowedRadius : false;

  return (
    <>
      <div className="fixed inset-0 bg-slate-950 z-50 flex flex-col justify-between p-6 animate-fade-in" role="dialog" aria-modal="true" aria-label="QR Code Scanner Overlay">
        
        {/* Scanner Top Controls Bar */}
        <div className="flex justify-between items-center text-white pt-2 z-10">
          <button
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-lg hover:bg-white/20 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400"
            aria-label="Tutup Pemindai"
          >
            ✕
          </button>
          <div className="text-center">
            <h3 className="font-extrabold text-base tracking-tight">Pindai QR Code Absensi</h3>
            <p className="text-[11px] font-medium text-emerald-400">Pintu Kantor Utama Sekolah</p>
          </div>
          <div className="w-10 h-10 flex items-center justify-center text-xl" aria-hidden="true">
            💡
          </div>
        </div>

        {/* Camera Scanner Viewfinder Box */}
        <div className="relative w-72 h-72 mx-auto rounded-3xl border-2 border-emerald-500/40 overflow-hidden shadow-2xl bg-black">
          <div id="reader" className="w-full h-full object-cover"></div>

          {/* Animated Laser Beam Scanner Line */}
          <div className="absolute left-0 right-0 h-1 bg-linear-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_15px_#10B981] animate-pulse top-1/2 -translate-y-1/2 pointer-events-none" />

          {/* Camera Frame Corners Overlay */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-emerald-500 rounded-tl-xl pointer-events-none" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-emerald-500 rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-emerald-500 rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-emerald-500 rounded-br-xl pointer-events-none" />
        </div>

        {/* Error handling for GPS permissions */}
        {gpsError && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-xs p-4 rounded-2xl text-center space-y-2 z-10 max-w-xs mx-auto">
            <p className="font-bold text-red-300">📍 Perizinan Lokasi Diperlukan</p>
            <p>{gpsError}</p>
            <button
              type="button"
              onClick={fetchGPSLocation}
              className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold rounded-xl text-xs mt-1 transition-all cursor-pointer"
            >
              📍 Aktifkan & Izinkan Lokasi GPS
            </button>
          </div>
        )}

        {/* Error handling for camera permissions */}
        {cameraError && (
          <div className="bg-red-500/20 border border-red-500/40 text-red-200 text-xs p-4 rounded-2xl text-center space-y-2">
            <p className="font-bold">⚠️ Kendala Akses Kamera</p>
            <p>{cameraError}</p>
            {import.meta.env.DEV && (
              <button
                onClick={() => handleScanSuccess('MOCK_QR')}
                className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold mt-2"
              >
                Simulasi Absen (Dev Mode)
              </button>
            )}
          </div>
        )}

        {/* Status Geofence Indicators Badges */}
        <div className="space-y-3 max-w-xs mx-auto text-center pb-6 z-10">
          {isCheckingGPS ? (
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-4 py-2 rounded-full inline-flex items-center gap-2 backdrop-blur-md font-bold">
              <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
              <span>⏳ Mengukur Koordinat GPS...</span>
            </div>
          ) : gpsCoords ? (
            <div className={`border text-xs px-4 py-2 rounded-full inline-flex items-center gap-2 backdrop-blur-md font-bold ${
              isWithinRadius
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-red-500/20 border-red-500/40 text-red-300 animate-pulse'
            }`}>
              <span className={`w-2.5 h-2.5 rounded-full ${
                isWithinRadius ? 'bg-emerald-400 animate-ping' : 'bg-red-500'
              }`} />
              <span>
                {isWithinRadius
                  ? `🟢 GPS Verified: ${gpsCoords.distanceMeters}m dari Sekolah (Aman)`
                  : `🔴 GPS Out of Range: ${gpsCoords.distanceMeters}m dari Sekolah (Ditolak)`}
              </span>
            </div>
          ) : null}
          <p className="text-[11px] text-slate-400">Arahkan kamera HP Anda ke QR Code yang dipajang di sekolah</p>
        </div>

      </div>

      {/* Auto-Submit Success Modal Overlay (2.0s Duration) */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => {}}>
        <div className="text-center space-y-4 py-2">
          
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-4xl mx-auto ring-8 ring-emerald-50 animate-bounce">
            ✓
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-xl">ABSENSI BERHASIL!</h3>
            <p className="text-xs text-slate-500 mt-1">Data kehadiran otomatis tersimpan</p>
          </div>

          <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-left text-xs text-slate-600 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-400">Status</span>
              <Badge status="HADIR">Hadir Tepat Waktu</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Waktu Absen</span>
              <span className="font-bold text-emerald-600">{scanResult?.timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lokasi Verified</span>
              <span className="font-medium text-emerald-600">🟢 Area Sekolah ({scanResult?.distance}m)</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 animate-pulse font-medium">
            Mengalihkan ke Dashboard dalam 2 detik...
          </p>
        </div>
      </Modal>

      {/* Rejection Modal Overlay (Absensi Ditolak Diluar Lokasi / GPS Off) */}
      <Modal isOpen={isRejectionModalOpen} onClose={() => setIsRejectionModalOpen(false)}>
        <div className="text-center space-y-4 py-2">
          
          <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-4xl mx-auto ring-8 ring-red-50 animate-bounce">
            ✕
          </div>

          <div>
            <h3 className="font-extrabold text-red-600 text-xl">ABSENSI DITOLAK!</h3>
            <p className="text-xs text-slate-500 mt-1">Terdeteksi diluar lokasi / kendala lokasi GPS</p>
          </div>

          <div className="bg-red-50/70 p-4 rounded-2xl space-y-2 text-left text-xs text-slate-700 border border-red-200">
            <div className="flex justify-between items-center pb-2 border-b border-red-200/60">
              <span className="text-slate-500 font-semibold">Status Presensi</span>
              <span className="px-2.5 py-0.5 bg-red-600 text-white font-extrabold text-[10px] rounded-full">
                REJECTED (DITOLAK)
              </span>
            </div>
            <div className="space-y-1 pt-1">
              <span className="text-slate-500 font-bold block">Alasan Penolakan:</span>
              <p className="font-semibold text-red-950 leading-relaxed bg-white p-2.5 rounded-xl border border-red-200">
                {rejectionReason}
              </p>
            </div>
          </div>

          <div className="pt-2 flex justify-center gap-2">
            <Button
              variant="danger"
              className="w-full text-xs py-2.5 font-bold cursor-pointer"
              onClick={() => {
                setIsRejectionModalOpen(false);
                fetchGPSLocation();
              }}
            >
              🔄 Coba Pindai Ulang
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
