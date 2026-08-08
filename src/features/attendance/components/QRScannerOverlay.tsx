import React, { useState, useEffect, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { NotificationService } from '../../../services/notification-permission.service';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { QRValidationService } from '../../../services/qr-validation.service';
import { GroqAIService } from '../../../services/groq-ai.service';
import type { ScanRejectionDiagnosisResult } from '../../../services/groq-ai.service';
import { ManualQRCodeModal } from './ManualQRCodeModal';
import { GuruCorrectionRequestModal } from '../../guru/components/GuruCorrectionRequestModal';
import { getEffectiveAllowedRadius } from '../../../utils/geofence.utils';
import { CONSTANTS } from '../../../config/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import { logger } from '../../../utils/logger.utils';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';

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
  const [showLiveMap, setShowLiveMap] = useState(false);
  
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<ScanRejectionDiagnosisResult | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  const [scanResult, setScanResult] = useState<{
    timestamp: string;
    distance: number;
    status: string;
    rawStatus?: string;
    action?: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETED';
    isOffline?: boolean;
  } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  const fetchGPSLocation = async () => {
    setIsCheckingGPS(true);
    setGpsError(null);
    logger.info('QRScannerOverlay', 'Fetching GPS location...');
    try {
      await GPSService.syncGeofenceSettings();
      const coords = await GPSService.getCurrentPosition();
      setGpsCoords(coords);
      setIsCheckingGPS(false);
      logger.info('QRScannerOverlay', 'GPS location obtained:', coords);
      return coords;
    } catch (err: unknown) {
      setIsCheckingGPS(false);
      setGpsCoords(null);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Perizinan lokasi GPS belum diberikan. Harap aktifkan izin lokasi di browser HP Anda.';
      logger.error('QRScannerOverlay', 'GPS location error:', msg);
      setGpsError(msg);
      return null;
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      logger.info('QRScannerOverlay', 'QR Scanner Overlay opened');
      isProcessingRef.current = false;
      setCameraError(null);
      fetchGPSLocation();

      // Dynamic import of html5-qrcode engine on demand
      import('html5-qrcode').then(({ Html5Qrcode }) => {
        if (!isMounted) return;

        logger.info('QRScannerOverlay', 'Starting camera scanner engine...');
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
          logger.error('QRScannerOverlay', 'Camera access error:', err);
          setCameraError("Kamera tidak dapat diakses. Pastikan Anda telah memberikan izin kamera di browser HP.");
        });
      }).catch((err) => {
        logger.error('QRScannerOverlay', 'Failed to load QR engine chunk:', err);
        setCameraError("Gagal memuat engine QR scanner. Periksa koneksi internet Anda.");
      });

      return () => {
        isMounted = false;
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch((err) => logger.warn('QRScannerOverlay', 'Scanner stop error:', err));
        }
      };
    }
  }, [isOpen]);

  const geofenceSettings = GPSService.getGeofenceSettings();
  const isOfflineMode = typeof navigator !== 'undefined' && !navigator.onLine;
  const rawAllowed = getEffectiveAllowedRadius(geofenceSettings.radius);
  // Ensure allowedRadius is at least 500m in offline mode to prevent mobile AGPS drift false-rejections
  const allowedRadius = isOfflineMode ? Math.max(rawAllowed, 500) : Math.max(rawAllowed, 100);

  const handleScanSuccess = async (_qrData: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    logger.info('QRScannerOverlay', 'QR Code detected by camera', { rawData: _qrData });

    if (scannerRef.current && scannerRef.current.isScanning) {
      scannerRef.current.stop().catch((err) => logger.warn('QRScannerOverlay', 'Scanner stop error:', err));
    }

    // 1. Validate QR Code payload freshness and official poster seed
    const qrValidation = QRValidationService.validateQRFreshness(_qrData);
    logger.info('QRScannerOverlay', 'QR Validation result:', qrValidation);

    if (!qrValidation.isValid) {
      logger.warn('QRScannerOverlay', 'QR Code validation failed / invalid payload');
      SoundService.playError();
      const userRole = useAuthStore.getState().user?.role || 'GURU';
      GroqAIService.diagnoseScanRejection({
        rawQrData: _qrData,
        userRole,
        errorType: 'INVALID_QR',
      }).then(setAiDiagnosis).catch(console.warn);

      setRejectionReason('Absensi Ditolak! QR Code tidak valid / bukan QR resmi absensi.');
      setIsRejectionModalOpen(true);
      isProcessingRef.current = false;
      return;
    }

    // 2. Fetch & Validate Geofence Radius GPS Location with Auto-Retry Pipeline (up to 3x)
    let currentCoords = gpsCoords;
    if (!currentCoords) {
      currentCoords = await fetchGPSLocation();
    }

    let validation = currentCoords ? GPSService.validateGeofenceRadius(currentCoords, allowedRadius) : { isValid: false };

    // Auto-retry up to 3 times if initial coords are missing, inaccurate (>40m), or out-of-bounds
    if (!currentCoords || !validation.isValid || currentCoords.accuracy > CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS) {
      logger.info('QRScannerOverlay', 'GPS fix requires refinement, starting Auto-Retry pipeline (up to 3x)...');
      for (let retry = 0; retry < CONSTANTS.DEFAULTS.GPS_AUTO_RETRY_COUNT; retry++) {
        const freshCoords = await fetchGPSLocation();
        if (freshCoords) {
          currentCoords = freshCoords;
          validation = GPSService.validateGeofenceRadius(currentCoords, allowedRadius);
          if (validation.isValid && currentCoords.accuracy <= CONSTANTS.DEFAULTS.GPS_CACHE_MIN_ACCURACY_METERS) {
            logger.info('QRScannerOverlay', `High accuracy GPS fix achieved on retry ${retry + 1}:`, currentCoords);
            break;
          }
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    if (!currentCoords) {
      logger.warn('QRScannerOverlay', 'Attendance rejected due to missing GPS coords');
      SoundService.playError();
      const userRole = useAuthStore.getState().user?.role || 'GURU';
      GroqAIService.diagnoseScanRejection({
        userRole,
        errorType: 'MISSING_GPS',
      }).then(setAiDiagnosis).catch(console.warn);

      setRejectionReason('Absensi Ditolak! Perizinan lokasi GPS tidak diizinkan atau lokasi HP Anda tidak dapat terdeteksi. Silakan aktifkan izin lokasi di HP Anda.');
      setIsRejectionModalOpen(true);
      isProcessingRef.current = false;
      return;
    }

    if (!validation.isValid) {
      logger.warn('QRScannerOverlay', 'Attendance rejected: Out of allowed radius', {
        distance: currentCoords.distanceMeters,
        allowedRadius,
      });
      SoundService.playError();
      const userRole = useAuthStore.getState().user?.role || 'GURU';
      GroqAIService.diagnoseScanRejection({
        rawQrData: _qrData,
        distanceMeters: currentCoords.distanceMeters,
        allowedRadius,
        gpsAccuracy: currentCoords.accuracy,
        userRole,
        errorType: 'OUT_OF_GEOFENCE',
      }).then(setAiDiagnosis).catch(console.warn);

      let hint = '';
      if (currentCoords.distanceMeters > 1000) {
        hint = '\n\n💡 Catatan: Jarak terdeteksi di atas 1 KM dari sekolah. Pastikan koordinat lokasi sekolah di Pengaturan sudah benar.';
      }
      setRejectionReason(`Absensi Ditolak! Anda terdeteksi berada ${currentCoords.distanceMeters} meter dari lokasi sekolah. Batas maksimum radius yang diizinkan adalah ${allowedRadius} meter.${hint}`);
      setIsRejectionModalOpen(true);
      isProcessingRef.current = false;
      return;
    }

    // 3. SAVE ATTENDANCE RECORD (Must succeed BEFORE showing success UI)
    const token = useAuthStore.getState().token || 'MOCK_TOKEN';
    const deviceUUID = useAuthStore.getState().deviceUUID || 'DEV_UUID';
    let returnedStatus = 'HADIR';
    let returnedAction: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETED' = 'CHECK_IN';
    let isOfflineRecord = false;

    const scanSeed = _qrData || CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED;

    try {
      logger.info('QRScannerOverlay', 'Sending scanAttendance payload to repository...');
      const res = await AttendanceRepository.scanAttendance({
        token: token,
        qr_seed: scanSeed,
        user_lat: currentCoords.latitude,
        user_lng: currentCoords.longitude,
        device_uuid: deviceUUID,
        distance_meters: currentCoords.distanceMeters,
        gps_accuracy: currentCoords.accuracy,
      });

      logger.info('QRScannerOverlay', 'Attendance saved successfully:', res);

      if (res) {
        if (res.status) returnedStatus = res.status;
        if (res.attendance_action) returnedAction = res.attendance_action;
        if (res.is_offline) isOfflineRecord = true;
      }

      window.dispatchEvent(new Event('smart_absensi_scanned'));
    } catch (err: unknown) {
      logger.error('QRScannerOverlay', 'Failed to save attendance record:', err);
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
    const currentUser = useAuthStore.getState().user;
    const teacherName = currentUser?.full_name || 'Guru';
    const userId = currentUser?.id;

    if (returnedAction === 'CHECK_OUT') {
      NotificationService.notifyTeacherCheckOut(teacherName, timestampStr, userId);
    } else {
      NotificationService.notifyTeacherCheckIn(teacherName, timestampStr, userId);
    }

    // 🔉 Trigger Indonesian Voice Announcement for Attendance Confirmation
    SpeechService.speakAttendanceSuccess(teacherName, returnedAction === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN');

    const isLate = returnedStatus === 'TERLAMBAT';
    const statusText = isLate
      ? 'Terlambat'
      : isOfflineRecord
      ? 'Hadir (Mode Offline)'
      : 'Hadir Tepat Waktu';

    const result = {
      timestamp: timestampStr,
      distance: currentCoords.distanceMeters,
      status: statusText,
      rawStatus: returnedStatus,
      action: returnedAction,
      isOffline: isOfflineRecord,
    };

    setScanResult(result);
    setIsSuccessModalOpen(true);

    // Auto-Submit 3.5s Timer to give teachers enough time to read reassurance popup
    setTimeout(() => {
      setIsSuccessModalOpen(false);
      onSuccess(result);
      onClose();
    }, 3500);
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
            className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md flex items-center justify-center text-lg hover:bg-white/20 active:scale-95 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer"
            aria-label="Tutup Pemindai"
          >
            ✕
          </button>
          <div className="text-center">
            <h3 className="font-extrabold text-base tracking-tight">Pindai QR Code Absensi</h3>
            <p className="text-[11px] font-medium text-emerald-400">Pintu Kantor Utama Sekolah</p>
          </div>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1"
            title="Input Kode Barcode Manual"
          >
            <span>⌨️</span>
            <span className="hidden sm:inline">Manual</span>
          </button>
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

        {/* Status Geofence Indicators Badges & Fallback Buttons */}
        <div className="space-y-3 max-w-xs mx-auto text-center pb-6 z-10">
          {isCheckingGPS ? (
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs px-4 py-2 rounded-full inline-flex items-center gap-2 backdrop-blur-md font-bold">
              <span className="w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping" />
              <span>📍 Memastikan Anda berada di area sekolah...</span>
            </div>
          ) : gpsCoords ? (
            <div className="space-y-2">
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
                    ? `🟢 GPS OK: ${gpsCoords.distanceMeters}m dari Sekolah`
                    : `🔴 Di Luar Radius: ${gpsCoords.distanceMeters}m (maks. ${allowedRadius}m)`}
                </span>
              </div>
              
              <div className="flex justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLiveMap(true)}
                  className="px-3 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 text-xs font-bold rounded-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>🗺️ Peta Live GPS</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>⌨️ Manual</span>
                </button>
                <button
                  type="button"
                  onClick={fetchGPSLocation}
                  className="px-3 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold rounded-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>🔄 Ukur GPS</span>
                </button>
              </div>
            </div>
          ) : null}
          <p className="text-[11px] text-slate-400">Arahkan kamera HP Anda ke QR Code yang dipajang di sekolah</p>
        </div>

      </div>

      {/* Live Location OpenStreetMap Modal */}
      <Modal isOpen={showLiveMap} onClose={() => setShowLiveMap(false)} title="🗺️ Live Map Posisi Real-time (OpenStreetMap)">
        <div className="space-y-3">
          {isOfflineMode && (
            <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold text-center">
              ⚡ Mode Offline: radius toleransi sementara {allowedRadius}m
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-medium text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
            <span>
              Status: <b className={isWithinRadius ? 'text-emerald-600' : 'text-red-600'}>{isWithinRadius ? '🟢 Dalam Radius Safe-Zone' : '🔴 Di Luar Radius Sekolah'}</b>
            </span>
            <span className="font-mono text-[11px] text-slate-500">
              Akurasi: ±{gpsCoords?.accuracy ? Math.round(gpsCoords.accuracy) : 0}m
            </span>
          </div>

          <LiveLocationMap
            userLat={gpsCoords?.latitude}
            userLng={gpsCoords?.longitude}
            schoolLat={geofenceSettings.lat}
            schoolLng={geofenceSettings.lng}
            allowedRadius={allowedRadius}
            accuracy={gpsCoords?.accuracy}
            height="320px"
          />

          <p className="text-[11px] text-slate-500 text-center">
            Peta berbasis <b>OpenStreetMap & Leaflet.js</b> (100% Bebas Kuota API & Gratis). Pin biru menandakan posisi HP Anda secara realtime.
          </p>
        </div>
      </Modal>

      {/* Auto-Submit Success Modal Overlay (2.2s Duration) */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => {}}>
        <div className="text-center space-y-4 py-2">
          
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto ring-8 animate-bounce ${
            scanResult?.action === 'CHECK_OUT'
              ? 'bg-blue-100 text-blue-600 ring-blue-50'
              : scanResult?.rawStatus === 'TERLAMBAT'
              ? 'bg-amber-100 text-amber-600 ring-amber-50'
              : scanResult?.action === 'ALREADY_COMPLETED'
              ? 'bg-amber-100 text-amber-600 ring-amber-50'
              : 'bg-emerald-100 text-emerald-600 ring-emerald-50'
          }`}>
            {scanResult?.action === 'CHECK_OUT' ? '🌇' : scanResult?.rawStatus === 'TERLAMBAT' ? '⚠️' : scanResult?.action === 'ALREADY_COMPLETED' ? 'ℹ️' : '✓'}
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-xl">
              {scanResult?.action === 'CHECK_OUT'
                ? 'ABSEN PULANG BERHASIL!'
                : scanResult?.rawStatus === 'TERLAMBAT'
                ? 'ABSEN MASUK (TERLAMBAT)'
                : scanResult?.action === 'ALREADY_COMPLETED'
                ? 'PRESENSI HARI INI LENGKAP!'
                : 'ABSEN MASUK BERHASIL!'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {scanResult?.action === 'CHECK_OUT'
                ? 'Terima kasih atas pengabdian Anda hari ini!'
                : scanResult?.rawStatus === 'TERLAMBAT'
                ? 'Presensi Anda tercatat, namun melewati batas jam masuk (07:30 WIB).'
                : scanResult?.action === 'ALREADY_COMPLETED'
                ? 'Anda sudah melakukan presensi masuk dan pulang hari ini.'
                : 'Selamat bertugas! Data presensi otomatis tersimpan.'}
            </p>
          </div>

          {scanResult?.isOffline ? (
            <div className="bg-amber-50/90 border-2 border-amber-300 p-3.5 rounded-2xl text-left text-xs text-amber-950 space-y-1.5 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">📶</span>
                <h4 className="font-extrabold text-amber-950 text-xs uppercase tracking-tight">
                  PRESENSI TERSIMPAN LOKAL (SINYAL LEMAH / OFFLINE)
                </h4>
              </div>
              <p className="text-[11px] text-amber-900 leading-relaxed font-medium">
                <strong>Jangan Khawatir!</strong> Jam <strong>{scanResult?.timestamp}</strong> &amp; lokasi GPS Anda sudah <strong>resmi dikunci &amp; tersimpan aman di HP</strong>. Anda <strong>TIDAK PERLU scan ulang!</strong>
              </p>
              <div className="text-[10px] text-amber-900 bg-white/80 p-2 rounded-xl border border-amber-200/80 font-medium">
                ⚡ Data tersimpan di HP &amp; akan otomatis terunggah ke server begitu internet / Wi-Fi terhubung kembali.
              </div>
            </div>
          ) : (
            <div className="bg-emerald-50/90 border border-emerald-300 p-3.5 rounded-2xl text-left text-xs text-emerald-950 space-y-1 shadow-sm">
              <div className="flex items-center gap-2">
                <span className="text-xl">🌐</span>
                <h4 className="font-extrabold text-emerald-950 text-xs uppercase tracking-tight">
                  TERHUBUNG REALTIME KE SERVER
                </h4>
              </div>
              <p className="text-[11px] text-emerald-800 leading-relaxed font-medium">
                Presensi Anda pada jam <strong>{scanResult?.timestamp}</strong> telah berhasil terunggah &amp; terverifikasi langsung ke server sekolah.
              </p>
            </div>
          )}

          <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-left text-xs text-slate-600 border border-slate-100">
            <div className="flex justify-between">
              <span className="text-slate-400">Status Absen</span>
              <Badge status={scanResult?.rawStatus === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR'}>
                {scanResult?.status || (scanResult?.rawStatus === 'TERLAMBAT' ? 'Terlambat' : 'Hadir Tepat Waktu')}
              </Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Waktu Presensi</span>
              <span className="font-bold text-emerald-600">{scanResult?.timestamp}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">Lokasi GPS Verified</span>
              <span className="font-medium text-emerald-600">🟢 Area Sekolah ({scanResult?.distance}m)</span>
            </div>
          </div>

          <div className="pt-1">
            <button
              type="button"
              onClick={() => {
                setIsSuccessModalOpen(false);
                if (scanResult) onSuccess(scanResult);
                onClose();
              }}
              className="w-full py-3 bg-[#023246] hover:bg-[#022535] text-white font-extrabold text-xs tracking-wider rounded-xl transition-all cursor-pointer shadow-md active:scale-98"
            >
              ✓ SIAP, SAYA MENGERTI
            </button>
          </div>

          <p className="text-[10px] text-slate-400 animate-pulse font-medium">
            Mengalihkan ke Dashboard dalam beberapa detik...
          </p>
        </div>
      </Modal>

      {/* Rejection Modal Overlay with AI Diagnostic Engine & 4 Recovery Actions */}
      <Modal isOpen={isRejectionModalOpen} onClose={() => setIsRejectionModalOpen(false)} maxWidth="lg">
        <div className="space-y-3.5 py-1">
          {/* Sleek Horizontal Header */}
          <div className="flex items-center gap-3 pb-2 border-b border-slate-100">
            <div className="w-10 h-10 bg-red-100 text-red-600 rounded-2xl flex shrink-0 items-center justify-center text-xl font-black ring-4 ring-red-50">
              ✕
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-black text-red-600 text-base tracking-tight">ABSENSI DITOLAK!</h3>
                <span className="px-2.5 py-0.5 bg-red-600 text-white font-extrabold text-[10px] rounded-full shrink-0">
                  REJECTED
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-medium truncate">Kendala verifikasi lokasi GPS atau pembacaan barcode fisik</p>
            </div>
          </div>

          {/* Unified AI & System Diagnostic Card */}
          <div className="bg-slate-50 rounded-2xl border border-slate-200/80 p-3.5 space-y-2 text-xs">
            {/* System Error Message */}
            <div className="space-y-1">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Keterangan Sistem:</span>
              <p className="font-semibold text-slate-800 bg-white p-2.5 rounded-xl border border-slate-200/80 text-[11px] leading-relaxed">
                {rejectionReason}
              </p>
            </div>

            {/* Groq AI Smart Diagnosis & Action Suggestion */}
            {aiDiagnosis && (
              <div className="bg-linear-to-r from-emerald-50/90 to-teal-50/90 p-3 rounded-xl border border-emerald-200 space-y-1.5 mt-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-emerald-950 text-[11px] flex items-center gap-1.5">
                    <span>🤖</span>
                    <span>{aiDiagnosis.diagnosisTitle}</span>
                  </span>
                  <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded-full">
                    Groq AI
                  </span>
                </div>
                <p className="text-[11px] text-slate-700 font-medium bg-white/90 p-2 rounded-lg border border-emerald-200/60 leading-relaxed">
                  💡 <strong>Saran AI:</strong> {aiDiagnosis.actionSuggestion}
                </p>
              </div>
            )}
          </div>

          {/* 4 Action Recovery Palette */}
          <div className="pt-1">
            <span className="text-[11px] font-bold text-slate-500 block mb-1.5 text-left">Pilihan Pemulihan Instan:</span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejectionModalOpen(false);
                  fetchGPSLocation();
                }}
                className="py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95"
              >
                <span>🔄</span>
                <span>Pindai Ulang</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRejectionModalOpen(false);
                  setIsManualModalOpen(true);
                }}
                className="py-2.5 px-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-xs"
              >
                <span>⌨️</span>
                <span>Kode Manual</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRejectionModalOpen(false);
                  fetchGPSLocation();
                }}
                className="py-2.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-xs"
              >
                <span>📍</span>
                <span>Ukur Ulang GPS</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRejectionModalOpen(false);
                  setIsCorrectionModalOpen(true);
                }}
                className="py-2.5 px-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1 active:scale-95 shadow-xs"
              >
                <span>⚡</span>
                <span>Koreksi AI</span>
              </button>
            </div>
          </div>
        </div>
      </Modal>

      {/* Manual QR Code Input Modal */}
      <ManualQRCodeModal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        onSubmitCode={(code) => {
          handleScanSuccess(code);
        }}
      />

      {/* Guru Correction Request Modal for AI Auto-Correction */}
      <GuruCorrectionRequestModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        onSuccess={() => {
          onClose();
        }}
      />
    </>
  );
};

