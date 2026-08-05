import React, { useState, useEffect, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import { SoundService } from '../../../services/audio.service';
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
  const [aiDiagnosis, setAiDiagnosis] = useState<ScanRejectionDiagnosisResult | null>(null);

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

  const [scanResult, setScanResult] = useState<{
    timestamp: string;
    distance: number;
    status: string;
    action?: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETED';
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
  // Use shared helper — same logic as SupabaseProvider backend
  const allowedRadius = getEffectiveAllowedRadius(geofenceSettings.radius);

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

    // 2. Fetch & Validate Geofence Radius GPS Location
    let currentCoords = gpsCoords;
    if (!currentCoords) {
      currentCoords = await fetchGPSLocation();
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

    const validation = GPSService.validateGeofenceRadius(currentCoords, allowedRadius);
    logger.info('QRScannerOverlay', 'Geofence validation result:', validation);

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

    const scanSeed = _qrData || CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED;

    try {
      logger.info('QRScannerOverlay', 'Sending scanAttendance payload to repository...');
      const res = await AttendanceRepository.scanAttendance({
        token: token,
        qr_seed: scanSeed,
        user_lat: currentCoords.latitude,
        user_lng: currentCoords.longitude,
        device_uuid: deviceUUID,
        gps_accuracy: currentCoords.accuracy,
      });

      logger.info('QRScannerOverlay', 'Attendance saved successfully:', res);

      if (res) {
        if (res.status) returnedStatus = res.status;
        if (res.attendance_action) returnedAction = res.attendance_action;
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
    const teacherName = useAuthStore.getState().user?.full_name || 'Guru';
    NotificationService.notifyTeacherCheckIn(teacherName, timestampStr);

    const statusLabel = returnedStatus === 'TERLAMBAT' ? 'TERLAMBAT (Terlambat)' : 'HADIR (Tepat Waktu)';

    const result = {
      timestamp: timestampStr,
      distance: currentCoords.distanceMeters,
      status: statusLabel,
      action: returnedAction,
    };

    setScanResult(result);
    setIsSuccessModalOpen(true);

    // Auto-Submit 2.0s Timer
    setTimeout(() => {
      setIsSuccessModalOpen(false);
      onSuccess(result);
      onClose();
    }, 2200);
  };

  const handleBypassGPSCheckIn = async () => {
    setIsRejectionModalOpen(false);
    await handleScanSuccess(CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED);
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
              <span>⏳ Mengukur Koordinat GPS (3 sampel)...</span>
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
                  onClick={() => setIsManualModalOpen(true)}
                  className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold rounded-xl backdrop-blur-md transition-all cursor-pointer flex items-center gap-1"
                >
                  <span>⌨️ Kode Manual</span>
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

      {/* Auto-Submit Success Modal Overlay (2.2s Duration) */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => {}}>
        <div className="text-center space-y-4 py-2">
          
          <div className={`w-20 h-20 rounded-full flex items-center justify-center text-4xl mx-auto ring-8 animate-bounce ${
            scanResult?.action === 'CHECK_OUT'
              ? 'bg-blue-100 text-blue-600 ring-blue-50'
              : scanResult?.action === 'ALREADY_COMPLETED'
              ? 'bg-amber-100 text-amber-600 ring-amber-50'
              : 'bg-emerald-100 text-emerald-600 ring-emerald-50'
          }`}>
            {scanResult?.action === 'CHECK_OUT' ? '🌇' : scanResult?.action === 'ALREADY_COMPLETED' ? 'ℹ️' : '✓'}
          </div>

          <div>
            <h3 className="font-extrabold text-slate-900 text-xl">
              {scanResult?.action === 'CHECK_OUT'
                ? 'ABSEN PULANG BERHASIL!'
                : scanResult?.action === 'ALREADY_COMPLETED'
                ? 'PRESENSI HARI INI LENGKAP!'
                : 'ABSEN MASUK BERHASIL!'}
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              {scanResult?.action === 'CHECK_OUT'
                ? 'Terima kasih atas pengabdian Anda hari ini!'
                : scanResult?.action === 'ALREADY_COMPLETED'
                ? 'Anda sudah melakukan presensi masuk dan pulang hari ini.'
                : 'Selamat bertugas! Data presensi otomatis tersimpan.'}
            </p>
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

      {/* Rejection Modal Overlay with AI Diagnostic Engine & 4 Recovery Actions */}
      <Modal isOpen={isRejectionModalOpen} onClose={() => setIsRejectionModalOpen(false)}>
        <div className="text-center space-y-4 py-2">
          
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center text-3xl mx-auto ring-8 ring-red-50 animate-bounce">
            ✕
          </div>

          <div>
            <h3 className="font-extrabold text-red-600 text-lg">ABSENSI DITOLAK!</h3>
            <p className="text-xs text-slate-500 mt-1">Terdeteksi kendala verifikasi barcode / lokasi</p>
          </div>

          {/* Standard Error Details */}
          <div className="bg-red-50/70 p-3.5 rounded-2xl space-y-2 text-left text-xs text-slate-700 border border-red-200">
            <div className="flex justify-between items-center pb-2 border-b border-red-200/60">
              <span className="text-slate-500 font-semibold">Status Presensi</span>
              <span className="px-2.5 py-0.5 bg-red-600 text-white font-extrabold text-[10px] rounded-full">
                REJECTED (DITOLAK)
              </span>
            </div>
            <div className="space-y-1 pt-1">
              <span className="text-slate-500 font-bold block">Alasan Penolakan:</span>
              <p className="font-semibold text-red-950 leading-relaxed bg-white p-2 rounded-xl border border-red-200 text-[11px]">
                {rejectionReason}
              </p>
            </div>
          </div>

          {/* Groq AI Diagnostic Card */}
          {aiDiagnosis && (
            <div className="bg-linear-to-br from-emerald-50 to-teal-50 p-3.5 rounded-2xl border border-emerald-200 text-left text-xs space-y-2">
              <div className="flex items-center gap-2 border-b border-emerald-200/80 pb-2">
                <span className="text-lg">🤖</span>
                <div>
                  <h4 className="font-extrabold text-emerald-950 text-xs flex items-center gap-1.5">
                    {aiDiagnosis.diagnosisTitle}
                    <span className="px-1.5 py-0.2 bg-emerald-600 text-white text-[9px] font-bold rounded-full">Groq AI</span>
                  </h4>
                  <p className="text-[10px] text-emerald-700 font-medium">{aiDiagnosis.diagnosisDetail}</p>
                </div>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-emerald-900 block">💡 Solusi Rekomendasi AI:</span>
                <p className="text-[11px] text-slate-700 font-medium bg-white p-2 rounded-xl border border-emerald-200/60 leading-relaxed">
                  {aiDiagnosis.actionSuggestion}
                </p>
              </div>
            </div>
          )}

          {/* 4 Action Recovery Buttons */}
          <div className="pt-2 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsRejectionModalOpen(false);
                  fetchGPSLocation();
                }}
                className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl border border-slate-300 transition-all cursor-pointer"
              >
                🔄 Pindai Ulang
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRejectionModalOpen(false);
                  setIsManualModalOpen(true);
                }}
                className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                ⌨️ Kode Manual
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleBypassGPSCheckIn}
                className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                📍 Absen via GPS
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsRejectionModalOpen(false);
                  setIsCorrectionModalOpen(true);
                }}
                className="w-full py-2 bg-purple-600 hover:bg-purple-700 text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                ⚡ Auto-Koreksi AI
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

