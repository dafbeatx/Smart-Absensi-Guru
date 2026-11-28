import React, { useState, useEffect, useRef } from 'react';
import type { Html5Qrcode } from 'html5-qrcode';
import { X } from 'lucide-react';
import { Modal } from '../../../components/ui/Modal';
import { Badge } from '../../../components/ui/Badge';
import {
  SagaAspirationIcon,
  SagaCheckBadgeIcon,
  SagaClockStatusIcon,
  SagaDeviceShieldIcon,
  SagaEditPencilIcon,
  SagaEmergencySosIcon,
  SagaInfoCircleIcon,
  SagaKeyboardIcon,
  SagaMapPinIcon,
  SagaMoodFaceIcon,
  SagaOfflineBoltIcon,
  SagaRefreshSyncIcon,
  SagaSparkAiIcon,
} from '../../../components/ui/SagaServiceIcons';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { NotificationService } from '../../../services/notification-permission.service';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { DutyScheduleRepository } from '../../../repositories/DutyScheduleRepository';
import { QRValidationService } from '../../../services/qr-validation.service';
import { GroqAIService } from '../../../services/groq-ai.service';
import type { ScanRejectionDiagnosisResult } from '../../../services/groq-ai.service';
import { ManualQRCodeModal } from './ManualQRCodeModal';
import { GuruCorrectionRequestModal } from '../../guru/components/GuruCorrectionRequestModal';
import { MoodCheckinModal } from '../../guru/components/MoodCheckinModal';
import { AnonymousComplaintModal } from '../../guru/components/AnonymousComplaintModal';
import { getEffectiveAllowedRadius, shouldReplaceWithBetterFix } from '../../../utils/geofence.utils';
import { CONSTANTS } from '../../../config/constants';
import { useAuthStore } from '../../../store/useAuthStore';
import { ProviderFactory } from '../../../providers/provider-factory';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import { logger } from '../../../utils/logger.utils';
import { LiveLocationMap } from '../../../components/ui/LiveLocationMap';
import { useReverseGeocode } from '../../../services/reverse-geocoding.service';
import { RadarLocationVerificationModal } from './RadarLocationVerificationModal';
import { WhatsAppNotificationService } from '../../../services/whatsapp-notification.service';

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
  const [isRefiningGPS, setIsRefiningGPS] = useState(false);
  const [gpsSignalNotice, setGpsSignalNotice] = useState<'COARSE_APPROXIMATE' | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [showLiveMap, setShowLiveMap] = useState(false);
  const gpsCoordsRef = useRef<GPSCoordinates | null>(null);

  const { address: physicalAddress, shortAddress: shortPhysicalAddress } = useReverseGeocode(
    gpsCoords?.latitude,
    gpsCoords?.longitude
  );
  
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [isRadarModalOpen, setIsRadarModalOpen] = useState(false);
  const pendingSuccessDataRef = useRef<{
    result: {
      timestamp: string;
      distance: number;
      status: string;
      rawStatus?: string;
      action?: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETED';
      isOffline?: boolean;
      isPiketGuru?: boolean;
    };
    teacherName: string;
    userId: string;
    isPiketGuruToday: boolean;
    returnedAction?: string;
    timestampStr: string;
    isLate: boolean;
  } | null>(null);
  const [isRejectionModalOpen, setIsRejectionModalOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [aiDiagnosis, setAiDiagnosis] = useState<ScanRejectionDiagnosisResult | null>(null);
  const [latenessReason, setLatenessReason] = useState('');

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isMoodModalOpen, setIsMoodModalOpen] = useState(false);
  const [isComplaintModalOpen, setIsComplaintModalOpen] = useState(false);
  const autoCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [scanResult, setScanResult] = useState<{
    timestamp: string;
    distance: number;
    status: string;
    rawStatus?: string;
    action?: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_COMPLETED';
    isOffline?: boolean;
    isPiketGuru?: boolean;
  } | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const isProcessingRef = useRef(false);

  const applyBestGPSFix = (candidate: GPSCoordinates) => {
    if (candidate.isApproximateLocation || candidate.accuracy > (CONSTANTS.DEFAULTS.GPS_APPROXIMATE_ACCURACY_THRESHOLD_METERS || 150)) {
      setGpsSignalNotice('COARSE_APPROXIMATE');
    } else {
      setGpsSignalNotice(null);
    }

    if (candidate.isMock) {
      gpsCoordsRef.current = candidate;
      setGpsCoords(candidate);
      return candidate;
    }

    const current = gpsCoordsRef.current;
    if (
      !current ||
      current.isMock ||
      shouldReplaceWithBetterFix(current, candidate, CONSTANTS.DEFAULTS.GPS_SAMPLE_MAX_AGE_MS || 10000)
    ) {
      gpsCoordsRef.current = candidate;
      setGpsCoords(candidate);
      return candidate;
    }

    return current;
  };

  const fetchGPSLocation = async () => {
    setIsCheckingGPS(true);
    setGpsError(null);
    logger.info('QRScannerOverlay', 'Fetching GPS location...');
    try {
      await GPSService.syncGeofenceSettings();
      const coords = await GPSService.getCurrentPosition(undefined, undefined, { mode: 'QR_SCAN' });
      const best = applyBestGPSFix(coords);
      setIsCheckingGPS(false);
      logger.info('QRScannerOverlay', 'GPS location obtained:', best);
      return best;
    } catch (err: unknown) {
      setIsCheckingGPS(false);
      if (!gpsCoordsRef.current) {
        setGpsCoords(null);
      }
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Perizinan lokasi GPS belum diberikan. Harap aktifkan izin lokasi di browser HP Anda.';
      logger.error('QRScannerOverlay', 'GPS location error:', msg);
      setGpsError(msg);
      return gpsCoordsRef.current;
    }
  };

  useEffect(() => {
    let isMounted = true;

    if (isOpen) {
      logger.info('QRScannerOverlay', 'QR Scanner Overlay opened');
      isProcessingRef.current = false;
      gpsCoordsRef.current = null;
      setGpsCoords(null);
      setGpsSignalNotice(null);
      setIsRefiningGPS(false);
      setCameraError(null);

      // Pre-warming GPS watcher sejak modal QR dibuka + pembersihan otomatis saat ditutup
      const stopLiveWatch = GPSService.subscribeLivePosition({
        mode: 'QR_SCAN',
        maxCompensationMeters: CONSTANTS.DEFAULTS.GPS_QR_MAX_COMPENSATION_METERS,
        onUpdate: (coords, meta) => {
          if (!isMounted) return;
          applyBestGPSFix(coords);
          if (meta.isApproximateLocation || coords.accuracy > (CONSTANTS.DEFAULTS.GPS_APPROXIMATE_ACCURACY_THRESHOLD_METERS || 150)) {
            setGpsSignalNotice('COARSE_APPROXIMATE');
          } else {
            setGpsSignalNotice(null);
          }
          setIsCheckingGPS(false);
        },
        onSignalAlert: (alert) => {
          if (!isMounted) return;
          if (alert.type === 'COARSE_APPROXIMATE') {
            setGpsSignalNotice('COARSE_APPROXIMATE');
          }
        },
      });

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
        stopLiveWatch();
        if (scannerRef.current && scannerRef.current.isScanning) {
          scannerRef.current.stop().catch((err) => logger.warn('QRScannerOverlay', 'Scanner stop error:', err));
        }
      };
    }
  }, [isOpen]);

  const geofenceSettings = GPSService.getGeofenceSettings();
  const isOfflineMode = typeof navigator !== 'undefined' && !navigator.onLine;
  const rawAllowed = getEffectiveAllowedRadius(geofenceSettings.radius, 500);
  // Ensure allowedRadius is at least 500m per geofence protocol to prevent false rejections
  const allowedRadius = Math.max(rawAllowed, 500);

  const handleScanSuccess = async (_qrData: string) => {
    if (isProcessingRef.current) return;
    isProcessingRef.current = true;

    logger.info('QRScannerOverlay', 'QR Code detected by camera', { rawData: _qrData });

    if (scannerRef.current && scannerRef.current.isScanning) {
      await scannerRef.current.stop().catch((err) => logger.warn('QRScannerOverlay', 'Scanner stop error:', err));
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

    // 1.5 Strict Device Binding Check (Exempting Dafa Maulana, S.Pd)
    const scanUser = useAuthStore.getState().user;
    const isExempted = scanUser && scanUser.full_name.toLowerCase().includes('dafa maulana');

    if (!isExempted && scanUser) {
      try {
        const provider = ProviderFactory.getProvider();
        const deviceUUID = useAuthStore.getState().deviceUUID || 'DEV_UUID';
        const token = useAuthStore.getState().token || 'TOKEN';
        const bindingCheck = await provider.checkDeviceBinding(scanUser.id, deviceUUID, token);

        if (bindingCheck.status === 'DIFFERENT_DEVICE') {
          logger.warn('QRScannerOverlay', 'Attendance rejected due to Strict Device Binding mismatch');
          SoundService.playError();
          setRejectionReason('Absensi Ditolak! HP Ini Tidak Terdaftar.\n\nPembatasan Strict (1 Akun = 1 HP) aktif untuk mencegah titip absen. Silakan gunakan HP pribadi yang terdaftar atau ajukan reset device ke Admin.');
          setIsRejectionModalOpen(true);
          isProcessingRef.current = false;
          return;
        }
      } catch (e) {
        console.warn('Device binding check exception during scan:', e);
      }
    }

    // Door Poster QR Mode: Sesuai protokol .agents/AGENTS.md, gunakan buffer radius 500m
    // saat memindai QR Poster resmi pintu gerbang/sekolah agar absensi langsung diterima
    const isDoorPosterQR = _qrData.trim() === CONSTANTS.DEFAULTS.OFFICIAL_ATTENDANCE_QR_SEED ||
      _qrData.includes('SMART_ABSENSI_OFFICIAL_QR') ||
      _qrData.includes('POSTER') ||
      _qrData.startsWith('SAG_SEED_VALID') ||
      _qrData.startsWith('SAG_TEST_SEED');

    const effectiveAllowedRadius = (isDoorPosterQR || isOfflineMode)
      ? Math.max(rawAllowed, 500)
      : allowedRadius;

    // 2. Fetch & Validate Geofence Radius GPS Location with Signal Quality Auto-Retry
    const qrValidateOptions = {
      mode: 'QR_SCAN' as const,
      maxAllowedAccuracy: CONSTANTS.DEFAULTS.GPS_QR_MAX_ALLOWED_ACCURACY_METERS || 90,
      maxCompensationMeters: CONSTANTS.DEFAULTS.GPS_QR_MAX_COMPENSATION_METERS || 35,
    };
    let currentCoords = gpsCoordsRef.current || gpsCoords;
    if (!currentCoords) {
      currentCoords = await fetchGPSLocation();
    }

    let validation = currentCoords
      ? GPSService.validateGeofenceRadius(currentCoords, effectiveAllowedRadius, qrValidateOptions)
      : { isValid: false };

    const retryAccuracyLimit = CONSTANTS.DEFAULTS.GPS_SIGNAL_RETRY_THRESHOLD_METERS || 80;
    const needsRefinement =
      !currentCoords ||
      (!validation.isValid && validation.error?.code !== 'GPS_003') ||
      currentCoords.accuracy > retryAccuracyLimit;

    if (needsRefinement) {
      logger.info('QRScannerOverlay', 'GPS fix requires refinement, starting calm auto-retry pipeline...');
      setIsRefiningGPS(true);
      for (let retry = 0; retry < 2; retry++) {
        try {
          const freshCoords = await GPSService.getCurrentPosition(undefined, undefined, {
            mode: 'QR_SCAN',
            minSamples: 2,
            maxSamples: 3,
            sampleWindowMs: 2500,
          });
          currentCoords = applyBestGPSFix(freshCoords);
          validation = GPSService.validateGeofenceRadius(currentCoords, effectiveAllowedRadius, qrValidateOptions);
          if (validation.isValid && currentCoords.accuracy <= retryAccuracyLimit) {
            logger.info('QRScannerOverlay', `Refined GPS fix achieved on retry ${retry + 1}:`, currentCoords);
            break;
          }
        } catch {
          // retain previous valid fix if available
        }
        await new Promise((r) => setTimeout(r, 400));
      }
      setIsRefiningGPS(false);
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
      const errorCode = validation.error?.code;
      logger.warn('QRScannerOverlay', 'Attendance rejected on GPS gate', {
        errorCode,
        distance: currentCoords.distanceMeters,
        rawDistance: currentCoords.rawDistanceMeters,
        accuracy: currentCoords.accuracy,
        allowedRadius: effectiveAllowedRadius,
      });
      SoundService.playError();

      if (errorCode === 'GPS_003') {
        setRejectionReason(
          'Absensi Ditolak! Terdeteksi penggunaan lokasi tiruan (Fake GPS). Harap matikan aplikasi pengubah lokasi terlebih dahulu lalu pindai ulang.'
        );
      } else if (errorCode === 'GPS_005' || currentCoords.isApproximateLocation || currentCoords.accuracy > 150) {
        setRejectionReason(
          `Sinyal GPS HP Anda masih memakai Lokasi Perkiraan (akurasi sekitar ${Math.round(currentCoords.accuracy)} meter).\n\nSilakan aktifkan opsi Lokasi Akurat (Precise) pada izin lokasi HP, matikan mode Hemat Daya, dan bergeser sebentar ke dekat jendela atau teras sekolah.`
        );
      } else if (errorCode === 'GPS_004') {
        setRejectionReason(
          `Sinyal GPS belum cukup akurat (sekitar ${Math.round(currentCoords.accuracy)} meter). Aktifkan Wi-Fi serta Lokasi Akurat di HP Anda, atau bergeser sebentar ke area yang lebih terbuka lalu pindai ulang.`
        );
      } else {
        const userRole = useAuthStore.getState().user?.role || 'GURU';
        GroqAIService.diagnoseScanRejection({
          rawQrData: _qrData,
          distanceMeters: currentCoords.distanceMeters,
          allowedRadius: effectiveAllowedRadius,
          gpsAccuracy: currentCoords.accuracy,
          userRole,
          errorType: 'OUT_OF_GEOFENCE',
        }).then(setAiDiagnosis).catch(console.warn);

        let hint = '';
        if (currentCoords.distanceMeters > 1000) {
          hint = '\n\nCatatan: Jarak terdeteksi di atas 1 KM dari sekolah. Pastikan koordinat lokasi sekolah di Pengaturan sudah benar.';
        }
        setRejectionReason(`Absensi Ditolak! Anda terdeteksi berada ${currentCoords.distanceMeters} meter dari lokasi sekolah. Batas maksimum radius yang diizinkan adalah ${effectiveAllowedRadius} meter.${hint}`);
      }

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
    const todayStr = getTodayDateInJakarta();
    const isAlreadyCheckedIn = (() => {
      try {
        if (typeof window === 'undefined') return false;
        const cacheKey = scanUser?.id ? `smart_absensi_today_attendance_${scanUser.id}_${todayStr}` : '';
        const raw = (cacheKey && localStorage.getItem(cacheKey)) ||
          localStorage.getItem('smart_absensi_today_record') ||
          localStorage.getItem('smart_absensi_my_today_record');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.check_in_time && !parsed?.check_out_time) return true;
        }
        // SDC-AIR: Check if there is an active morning correction for today
        if (scanUser?.id) {
          const corrKey = `smart_absensi_pending_correction_${scanUser.id}_${todayStr}`;
          const corrRaw = localStorage.getItem(corrKey);
          if (corrRaw) {
            const corrParsed = JSON.parse(corrRaw);
            if (corrParsed?.checkInTime) return true;
          }
        }
      } catch {}
      return false;
    })();

    try {
      logger.info('QRScannerOverlay', 'Sending scanAttendance payload to repository...', { isAlreadyCheckedIn });

      const res = await AttendanceRepository.scanAttendance({
        token: token,
        qr_seed: scanSeed,
        user_lat: currentCoords.latitude,
        user_lng: currentCoords.longitude,
        device_uuid: deviceUUID,
        user_id: scanUser?.id || undefined,
        distance_meters: currentCoords.rawDistanceMeters ?? currentCoords.distanceMeters,
        gps_accuracy: currentCoords.accuracy,
        attempt_action: isAlreadyCheckedIn ? 'CHECK_OUT' : 'CHECK_IN',
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
      const cleanReason = errMsg.startsWith('Absensi Ditolak!')
        ? errMsg
        : `Gagal Menyimpan Absensi!\n\n${errMsg}`;
      setRejectionReason(cleanReason);
      setIsRejectionModalOpen(true);
      isProcessingRef.current = false;
      return;
    }

    // 3. APPROVE: Data kehadiran sudah berhasil dicatat di cloud/database di awal
    // Tampilkan animasi Radar Pengecekan Lokasi terlebih dahulu (fake loading visual UX)
    const currentUser = useAuthStore.getState().user;
    const teacherName = currentUser?.full_name || 'Guru';
    const userId = currentUser?.id || '';

    let isPiketGuruToday = false;
    try {
      const token = useAuthStore.getState().token || '';
      const dutySchedules = await DutyScheduleRepository.getDutySchedules(token);
      isPiketGuruToday = DutyScheduleRepository.isTeacherDutyToday(userId || teacherName, dutySchedules);
    } catch (e) {
      console.warn('Failed to check piket guru duty:', e);
    }

    const timestampStr = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB';
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
      isPiketGuru: isPiketGuruToday,
    };

    // Simpan payload untuk transisi setelah radar status HIJAU
    pendingSuccessDataRef.current = {
      result,
      teacherName,
      userId,
      isPiketGuruToday,
      returnedAction,
      timestampStr,
      isLate,
    };

    // Buka Radar Pengecekan Lokasi Modern
    setIsRadarModalOpen(true);
  };

  const handleRadarLockGreen = () => {
    // Saat status radar berubah ke HIJAU: picu efek audio suara sukses & notifikasi
    const data = pendingSuccessDataRef.current;
    if (!data) return;

    if (data.isPiketGuruToday) {
      SoundService.playPiketGuruSuccess();
      SpeechService.speakDutyTeacherSuccess(data.teacherName);
    } else {
      SoundService.playAttendanceSuccess();
      SpeechService.speakAttendanceSuccess(
        data.teacherName,
        data.returnedAction === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN'
      );
    }

    if (data.returnedAction === 'CHECK_OUT') {
      NotificationService.notifyTeacherCheckOut(data.teacherName, data.timestampStr, data.userId);
      NotificationService.cancelScheduledCheckoutReminder();
    } else {
      NotificationService.notifyTeacherCheckIn(data.teacherName, data.timestampStr, data.userId);
      NotificationService.scheduleCheckoutReminder(data.teacherName, data.userId);
    }
  };

  const handleRadarComplete = () => {
    // Saat radar selesai (~2.3s): langsung buka popup hasil & status presensi beres
    setIsRadarModalOpen(false);
    const data = pendingSuccessDataRef.current;
    if (!data) return;

    setScanResult(data.result);
    setLatenessReason('');
    setIsSuccessModalOpen(true);

    // Auto-Close 10s Timer HANYA untuk Hadir Tepat Waktu / Pulang agar guru sempat klik tombol WhatsApp
    if (!data.isLate) {
      if (autoCloseTimerRef.current) clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = setTimeout(() => {
        handleSaveReasonAndClose('NONE');
      }, 10000);
    }
  };

  const handleSaveReasonAndClose = async (openTarget: 'NONE' | 'MOOD' | 'COMPLAINT' = 'NONE') => {
    // Clear auto-close timer if user interacted
    if (autoCloseTimerRef.current) {
      clearTimeout(autoCloseTimerRef.current);
      autoCloseTimerRef.current = null;
    }

    const currentUser = useAuthStore.getState().user;
    if (latenessReason.trim() && currentUser) {
      try {
        const provider = ProviderFactory.getProvider();
        const todayStr = getTodayDateInJakarta();
        const token = useAuthStore.getState().token || '';
        const noteText = latenessReason.trim().startsWith('[Alasan Terlambat]')
          ? latenessReason.trim()
          : `[Alasan Terlambat]: ${latenessReason.trim()}`;

        if ('updateAttendanceNote' in provider && typeof (provider as any).updateAttendanceNote === 'function') {
          await (provider as any).updateAttendanceNote(currentUser.id, todayStr, noteText, token);
        } else {
          await provider.updateUser(currentUser.id, {}, token);
        }
      } catch (e) {
        console.warn('Error saving lateness reason note:', e);
      }
    }
    setIsSuccessModalOpen(false);

    if (openTarget === 'MOOD') {
      setIsMoodModalOpen(true);
    } else if (openTarget === 'COMPLAINT') {
      setIsComplaintModalOpen(true);
    } else {
      if (scanResult) onSuccess(scanResult);
      onClose();
    }
  };

  if (!isOpen) return null;

  const isWithinRadius = gpsCoords ? gpsCoords.distanceMeters <= allowedRadius : false;

  return (
    <>
      <div
        className="fixed inset-0 bg-slate-950 z-50 flex flex-col justify-between px-4 sm:px-6 pt-[max(16px,env(safe-area-inset-top))] pb-[max(16px,env(safe-area-inset-bottom))]"
        role="dialog"
        aria-modal="true"
        aria-label="QR Code Scanner Overlay"
      >
        {/* Scanner Top Controls Bar */}
        <div className="flex justify-between items-center text-white pt-1 z-10">
          <button
            type="button"
            onClick={onClose}
            className="w-11 h-11 rounded-full bg-white/15 flex items-center justify-center hover:bg-white/25 active:scale-95 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400 cursor-pointer shrink-0"
            aria-label="Tutup Pemindai"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-center px-2">
            <h3 className="font-bold text-base tracking-tight">Pindai QR Code Absensi</h3>
            <p className="text-xs font-medium text-emerald-300">Pintu Kantor Utama Sekolah</p>
          </div>
          <button
            type="button"
            onClick={() => setIsManualModalOpen(true)}
            className="min-h-11 px-3 py-2 bg-white/15 hover:bg-white/25 text-white border border-white/25 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
            title="Input Kode Barcode Manual"
          >
            <SagaKeyboardIcon tone="dark" className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Manual</span>
          </button>
        </div>

        {/* Camera Scanner Viewfinder Box */}
        <div className="relative w-72 h-72 mx-auto rounded-3xl border-2 border-emerald-400/50 overflow-hidden shadow-2xl bg-black">
          <div id="reader" className="w-full h-full object-cover"></div>

          {/* Static Scanner Guide Line */}
          <div className="absolute left-4 right-4 h-0.5 bg-emerald-400/80 top-1/2 -translate-y-1/2 pointer-events-none" />

          {/* Camera Frame Corners Overlay */}
          <div className="absolute top-4 left-4 w-8 h-8 border-t-4 border-l-4 border-emerald-400 rounded-tl-xl pointer-events-none" />
          <div className="absolute top-4 right-4 w-8 h-8 border-t-4 border-r-4 border-emerald-400 rounded-tr-xl pointer-events-none" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-b-4 border-l-4 border-emerald-400 rounded-bl-xl pointer-events-none" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-b-4 border-r-4 border-emerald-400 rounded-br-xl pointer-events-none" />
        </div>

        {/* Error handling for GPS permissions */}
        {gpsError && (
          <div className="bg-rose-950/80 border border-rose-400/40 text-rose-100 text-xs p-4 rounded-2xl text-center space-y-2 z-10 max-w-xs mx-auto">
            <p className="font-bold text-rose-200 inline-flex items-center justify-center gap-1.5">
              <SagaMapPinIcon tone="dark" className="w-4 h-4 shrink-0" />
              <span>Perizinan Lokasi Diperlukan</span>
            </p>
            <p>{gpsError}</p>
            <button
              type="button"
              onClick={fetchGPSLocation}
              className="w-full min-h-11 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold rounded-xl text-xs mt-1 transition-colors cursor-pointer inline-flex items-center justify-center gap-1.5"
            >
              <SagaMapPinIcon className="w-4 h-4 shrink-0" />
              <span>Aktifkan &amp; Izinkan Lokasi GPS</span>
            </button>
          </div>
        )}

        {/* Error handling for camera permissions */}
        {cameraError && (
          <div className="bg-rose-950/80 border border-rose-400/40 text-rose-100 text-xs p-4 rounded-2xl text-center space-y-2 max-w-xs mx-auto">
            <p className="font-bold inline-flex items-center justify-center gap-1.5">
              <SagaEmergencySosIcon tone="dark" className="w-4 h-4 shrink-0" />
              <span>Kendala Akses Kamera</span>
            </p>
            <p>{cameraError}</p>
            {import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => handleScanSuccess('MOCK_QR')}
                className="min-h-11 px-4 py-2 bg-[#0D5C46] text-white rounded-xl text-xs font-bold mt-2 cursor-pointer"
              >
                Simulasi Absen (Dev Mode)
              </button>
            )}
          </div>
        )}

        {/* Status Geofence Indicators Badges & Fallback Buttons */}
        <div className="space-y-2.5 max-w-xs mx-auto text-center pb-2 z-10">
          {(gpsSignalNotice === 'COARSE_APPROXIMATE' || (gpsCoords && gpsCoords.accuracy > 150)) && (
            <div className="bg-amber-950/90 border border-amber-400/50 text-amber-100 text-xs p-3 rounded-2xl text-left flex items-start gap-2">
              <SagaDeviceShieldIcon tone="dark" className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold text-amber-200">Lokasi Perkiraan Terdeteksi</p>
                <p className="text-[11px] leading-snug text-amber-100">
                  Aktifkan <strong>Lokasi Akurat (Precise)</strong> di HP, matikan Hemat Daya, dan bergeser sebentar ke dekat jendela atau teras.
                </p>
              </div>
            </div>
          )}

          {isRefiningGPS || isCheckingGPS ? (
            <div className="bg-amber-500/20 border border-amber-400/40 text-amber-200 text-xs px-4 py-2 rounded-full inline-flex items-center gap-2 font-bold">
              <SagaMapPinIcon tone="dark" className="w-4 h-4 shrink-0" />
              <span>
                {isRefiningGPS
                  ? 'Sinyal GPS belum akurat (sedang mencari ulang...)'
                  : 'Memastikan Anda berada di area sekolah...'}
              </span>
            </div>
          ) : gpsCoords ? (
            <div className="space-y-2.5">
              {(() => {
                const liveAccuracyLow = gpsCoords.accuracy > (CONSTANTS.DEFAULTS.GPS_QR_MAX_ALLOWED_ACCURACY_METERS || 90);
                const badgeStyle = gpsCoords.isMock
                  ? 'bg-rose-500/20 border-rose-400/40 text-rose-200'
                  : liveAccuracyLow
                  ? 'bg-amber-500/20 border-amber-400/40 text-amber-200'
                  : isWithinRadius
                  ? 'bg-emerald-500/20 border-emerald-400/40 text-emerald-200'
                  : 'bg-rose-500/20 border-rose-400/40 text-rose-200';
                const dotStyle = gpsCoords.isMock
                  ? 'bg-rose-400'
                  : liveAccuracyLow
                  ? 'bg-amber-400'
                  : isWithinRadius
                  ? 'bg-emerald-400'
                  : 'bg-rose-400';

                return (
                  <div className={`border text-xs px-3.5 py-1.5 rounded-full inline-flex items-center gap-2 font-bold ${badgeStyle}`}>
                    <span className={`w-2 h-2 rounded-full ${dotStyle}`} />
                    <span>
                      {gpsCoords.isMock
                        ? 'Lokasi Tiruan Terdeteksi'
                        : liveAccuracyLow
                        ? `Sinyal GPS belum akurat (±${Math.round(gpsCoords.accuracy)}m)`
                        : isWithinRadius
                        ? `GPS Aman: ${gpsCoords.distanceMeters}m dari Sekolah`
                        : `Di Luar Radius: ${gpsCoords.distanceMeters}m (maks. ${allowedRadius}m)`}
                    </span>
                  </div>
                );
              })()}
              
              <div className="flex justify-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowLiveMap(true)}
                  className="min-h-11 px-3 py-2 bg-[#0D5C46] hover:bg-[#094736] text-white border border-white/20 text-xs font-bold rounded-xl transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <SagaMapPinIcon tone="dark" className="w-4 h-4 shrink-0" />
                  <span>Peta Live</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsManualModalOpen(true)}
                  className="min-h-11 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold rounded-xl transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <SagaKeyboardIcon tone="dark" className="w-4 h-4 shrink-0" />
                  <span>Manual</span>
                </button>
                <button
                  type="button"
                  onClick={fetchGPSLocation}
                  className="min-h-11 px-3 py-2 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/40 text-xs font-bold rounded-xl transition-colors active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <SagaRefreshSyncIcon tone="dark" className="w-4 h-4 shrink-0" />
                  <span>Ukur GPS</span>
                </button>
              </div>
            </div>
          ) : null}
          <p className="text-xs text-slate-300 font-medium">Arahkan kamera HP Anda ke QR Code resmi di pintu sekolah</p>
        </div>

      </div>

      {/* Live Location OpenStreetMap Modal */}
      <Modal
        isOpen={showLiveMap}
        onClose={() => setShowLiveMap(false)}
        title="Peta Geofence Presensi Real-Time"
        mobileFullscreen
      >
        <div className="space-y-3">
          {isOfflineMode && (
            <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center justify-center gap-1.5">
              <SagaOfflineBoltIcon className="w-4 h-4 shrink-0" />
              <span>Mode Offline: Radius toleransi sementara {allowedRadius}m</span>
            </div>
          )}

          <div className="flex items-center justify-between text-xs font-semibold text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-1.5">
              <span>Status: </span>
              <span
                className={`w-2 h-2 rounded-full inline-block ${
                  isWithinRadius ? 'bg-[#0D5C46]' : 'bg-rose-600'
                }`}
              />
              <strong className={isWithinRadius ? 'text-[#0D5C46]' : 'text-rose-700'}>
                {isWithinRadius ? 'Dalam Radius Safe-Zone' : 'Di Luar Radius Sekolah'}
              </strong>
            </div>
            <span className="font-mono text-xs text-slate-500">
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

          <p className="text-xs text-slate-500 text-center font-medium">
            Peta presensi berbasis OpenStreetMap &amp; Leaflet (Bebas kuota API). Pin hijau menandakan posisi fisik HP Anda.
          </p>
        </div>
      </Modal>

      {/* Auto-Submit Success Modal Overlay */}
      <Modal isOpen={isSuccessModalOpen} onClose={() => {}} mobileFullscreen>
        <div className="text-center space-y-3.5 py-2">
          
          {/* Hero Icon */}
          <div className="relative inline-flex items-center justify-center">
            <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto shadow-sm ${
              scanResult?.action === 'CHECK_OUT'
                ? 'bg-[#0D5C46] text-white'
                : scanResult?.rawStatus === 'TERLAMBAT'
                ? 'bg-amber-600 text-white'
                : scanResult?.action === 'ALREADY_COMPLETED'
                ? 'bg-amber-600 text-white'
                : 'bg-[#0D5C46] text-white'
            }`}>
              {scanResult?.action === 'CHECK_OUT' ? (
                <SagaClockStatusIcon tone="dark" className="w-9 h-9" />
              ) : scanResult?.rawStatus === 'TERLAMBAT' ? (
                <SagaEmergencySosIcon tone="dark" className="w-9 h-9" />
              ) : scanResult?.action === 'ALREADY_COMPLETED' ? (
                <SagaInfoCircleIcon tone="dark" className="w-9 h-9" />
              ) : (
                <SagaCheckBadgeIcon tone="dark" className="w-9 h-9" />
              )}
            </div>
          </div>

          {/* Title & Subtitle */}
          <div className="space-y-1">
            <h3 className="font-bold text-slate-900 text-lg sm:text-xl tracking-tight">
              {scanResult?.action === 'CHECK_OUT'
                ? 'Absen Pulang Berhasil!'
                : scanResult?.rawStatus === 'TERLAMBAT'
                ? 'Absen Masuk (Terlambat)'
                : scanResult?.action === 'ALREADY_COMPLETED'
                ? 'Presensi Hari Ini Lengkap!'
                : 'Absen Masuk Berhasil!'}
            </h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium max-w-xs mx-auto">
              {scanResult?.action === 'CHECK_OUT'
                ? 'Terima kasih atas pengabdian Anda hari ini.'
                : scanResult?.rawStatus === 'TERLAMBAT'
                ? 'Tercatat melewati batas jam masuk sekolah (07:30 WIB).'
                : scanResult?.action === 'ALREADY_COMPLETED'
                ? 'Anda sudah melakukan presensi masuk & pulang hari ini.'
                : 'Selamat bertugas! Data presensi otomatis tersimpan.'}
            </p>
          </div>

          {/* Compact Guru Piket Badge */}
          {scanResult?.isPiketGuru && (
            <div className="bg-amber-50 text-amber-950 p-3 rounded-2xl text-left border border-amber-300 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center shrink-0">
                <SagaDeviceShieldIcon tone="dark" className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <span className="font-bold text-amber-950 text-xs block truncate">Guru Piket Hari Ini</span>
                <p className="text-xs text-amber-800 font-medium truncate">Selamat bertugas menjaga ketertiban sekolah.</p>
              </div>
            </div>
          )}

          {/* Unified Compact Info Card */}
          <div className="bg-[#F8FAFC] border border-slate-200 rounded-2xl p-3.5 space-y-2.5 text-xs text-slate-700 text-left">
            <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Status Presensi</span>
              <Badge status={scanResult?.rawStatus === 'TERLAMBAT' ? 'TERLAMBAT' : 'HADIR'}>
                {scanResult?.status || (scanResult?.rawStatus === 'TERLAMBAT' ? 'Terlambat' : 'Hadir Tepat Waktu')}
              </Badge>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Waktu Presensi:</span>
              <span className="font-bold text-slate-900 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 font-mono text-xs">
                {scanResult?.timestamp}
              </span>
            </div>

            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600 font-medium">Verifikasi GPS:</span>
              <span className="font-semibold text-[#0D5C46] inline-flex items-center gap-1.5 text-xs">
                <span className="w-2 h-2 rounded-full bg-[#0D5C46]" />
                <span>Safe-Zone</span>
                <span className="text-slate-500">({scanResult?.distance}m)</span>
              </span>
            </div>

            {physicalAddress && (
              <div className="flex items-start justify-between gap-2 text-xs pt-0.5">
                <span className="text-slate-600 font-medium shrink-0">Alamat GPS:</span>
                <span className="font-semibold text-slate-800 text-xs text-right truncate max-w-52 inline-flex items-center gap-1" title={physicalAddress}>
                  <SagaMapPinIcon className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{shortPhysicalAddress || physicalAddress}</span>
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-0.5">
              <span className="text-slate-600 font-medium">Status Koneksi:</span>
              <span className={`font-semibold text-xs inline-flex items-center gap-1 ${
                scanResult?.isOffline ? 'text-amber-700' : 'text-[#0D5C46]'
              }`}>
                {scanResult?.isOffline ? (
                  <>
                    <SagaOfflineBoltIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Sync Offline (Tersimpan di HP)</span>
                  </>
                ) : (
                  <>
                    <SagaDeviceShieldIcon className="w-3.5 h-3.5 shrink-0" />
                    <span>Realtime Server</span>
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Lateness Note Input (Only if TERLAMBAT) */}
          {scanResult?.rawStatus === 'TERLAMBAT' && (
            <div className="space-y-1.5 text-left bg-amber-50 p-3.5 rounded-2xl border border-amber-200">
              <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5">
                <SagaEditPencilIcon className="w-4 h-4 shrink-0" />
                <span>Catatan Alasan Terlambat:</span>
              </label>
              <input
                type="text"
                value={latenessReason}
                onChange={(e) => setLatenessReason(e.target.value)}
                placeholder="Contoh: Hujan deras / Macet di jalan utama"
                className="w-full px-3 py-2.5 bg-white border border-amber-300 rounded-xl text-base sm:text-xs text-slate-900 font-medium focus:outline-none focus:ring-2 focus:ring-[#0D5C46] min-h-11"
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-1 space-y-2.5">
            {/* Tombol Utama: Kirim Laporan ke WhatsApp Grup */}
            <button
              type="button"
              onClick={() => {
                if (autoCloseTimerRef.current) {
                  clearTimeout(autoCloseTimerRef.current);
                  autoCloseTimerRef.current = null;
                }
                const currentUser = useAuthStore.getState().user;
                WhatsAppNotificationService.openWhatsAppShare({
                  teacherName: currentUser?.full_name || 'Guru',
                  nip: currentUser?.nip || undefined,
                  role: currentUser?.role || 'GURU',
                  type: scanResult?.action === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN',
                  timeStr: scanResult?.timestamp,
                  dateStr: getTodayDateInJakarta(),
                  method: 'Scan Barcode / QR Poster',
                  distanceMeters: scanResult?.distance,
                  status: scanResult?.status,
                  isOffline: scanResult?.isOffline,
                });
              }}
              className="w-full min-h-12 py-3 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm tracking-wide rounded-2xl transition-colors cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <SagaAspirationIcon tone="dark" className="w-5 h-5 shrink-0" />
              <span>Kirim Laporan ke WhatsApp Grup</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase">
                1-Klik
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveReasonAndClose('MOOD')}
              className="w-full min-h-12 py-3 bg-[#0D5C46] hover:bg-[#094736] text-white font-bold text-xs tracking-wide rounded-xl transition-colors cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <SagaMoodFaceIcon mood="VERY_HAPPY" tone="dark" className="w-5 h-5 shrink-0" />
              <span>
                {scanResult?.rawStatus === 'TERLAMBAT'
                  ? 'Simpan Alasan & Isi Mood Harian'
                  : 'Isi Mood Harian (Check-in)'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveReasonAndClose('COMPLAINT')}
              className="w-full min-h-11 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-950 border border-amber-300 font-bold text-xs rounded-xl transition-colors cursor-pointer active:scale-[0.99] flex items-center justify-center gap-1.5"
            >
              <SagaDeviceShieldIcon className="w-4 h-4 shrink-0" />
              <span>Tulis Catatan / Keluhan Anonim</span>
            </button>

            <button
              type="button"
              onClick={() => handleSaveReasonAndClose('NONE')}
              className="w-full min-h-11 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors cursor-pointer border border-slate-200 active:scale-[0.99]"
            >
              {scanResult?.rawStatus === 'TERLAMBAT'
                ? 'Simpan Alasan & Masuk Dashboard'
                : 'Masuk Dashboard'}
            </button>
          </div>

          {scanResult?.rawStatus !== 'TERLAMBAT' && (
            <p className="text-xs text-slate-500 font-medium">
              Mengalihkan ke Dashboard secara otomatis...
            </p>
          )}
        </div>
      </Modal>

      {/* Rejection Modal Overlay with AI Diagnostic Engine & Timing Policy Guidance */}
      <Modal
        isOpen={isRejectionModalOpen}
        onClose={() => setIsRejectionModalOpen(false)}
        maxWidth="lg"
        mobileFullscreen
      >
        {(() => {
          const reasonText = rejectionReason || '';
          const isTimingRejection = reasonText.includes('absensi pulang') ||
            reasonText.includes('06.00') ||
            reasonText.includes('absensi ganda') ||
            reasonText.includes('harus nanti') ||
            reasonText.includes('belum dibuka');

          return (
            <div className="space-y-4 py-1">
              {/* Header */}
              <div className="flex items-center gap-3 pb-2.5 border-b border-slate-100">
                <div className={`w-11 h-11 ${isTimingRejection ? 'bg-amber-100' : 'bg-rose-100'} rounded-2xl flex shrink-0 items-center justify-center`}>
                  {isTimingRejection ? (
                    <SagaClockStatusIcon className="w-6 h-6" />
                  ) : (
                    <SagaEmergencySosIcon className="w-6 h-6" />
                  )}
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className={`font-bold ${isTimingRejection ? 'text-amber-900' : 'text-rose-700'} text-base tracking-tight`}>
                      {isTimingRejection ? 'Jadwal Presensi Belum Sesuai' : 'Absensi Ditolak'}
                    </h3>
                    <span className={`px-2.5 py-0.5 ${isTimingRejection ? 'bg-amber-600' : 'bg-rose-600'} text-white font-bold text-[10px] rounded-full shrink-0`}>
                      {isTimingRejection ? 'WAKTU BELUM TIBA' : 'DITOLAK'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 font-medium truncate">
                    {isTimingRejection
                      ? 'Ketentuan waktu presensi masuk & pulang resmi (GMT+7 Jakarta / WIB)'
                      : 'Kendala verifikasi lokasi GPS atau pembacaan barcode fisik'}
                  </p>
                </div>
              </div>

              {/* Unified AI & System Diagnostic Card */}
              <div className="bg-[#F8FAFC] rounded-2xl border border-slate-200 p-3.5 space-y-2.5 text-xs">
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block">Keterangan Sistem:</span>
                  <p className="font-medium text-slate-800 bg-white p-3 rounded-xl border border-slate-200 text-xs leading-relaxed whitespace-pre-line">
                    {rejectionReason}
                  </p>
                </div>

                {/* Info Card Waktu Resmi Presensi Sekolah */}
                {isTimingRejection && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5 text-slate-700">
                    <span className="text-[11px] font-bold text-amber-900 uppercase tracking-wider flex items-center gap-1.5">
                      <SagaClockStatusIcon className="w-4 h-4 shrink-0" />
                      <span>Ketentuan Jam Presensi Sekolah (GMT+7 Jakarta)</span>
                    </span>
                    <div className="grid grid-cols-2 gap-2 pt-0.5 text-xs">
                      <div className="bg-white p-2 rounded-lg border border-amber-200">
                        <span className="text-slate-500 block font-medium">Presensi Masuk:</span>
                        <strong className="text-[#0D5C46] font-bold">Mulai 06.00 WIB</strong>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-amber-200">
                        <span className="text-slate-500 block font-medium">Presensi Pulang:</span>
                        <strong className="text-slate-900 font-bold">Mulai 12.00 WIB</strong>
                        <span className="text-[11px] text-amber-800 block">(Jum'at: 10.00 WIB)</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Groq AI Smart Diagnosis & Action Suggestion */}
                {!isTimingRejection && aiDiagnosis && (
                  <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-200 space-y-2 mt-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-[#0D5C46] text-xs flex items-center gap-1.5">
                        <SagaSparkAiIcon className="w-4 h-4 shrink-0" />
                        <span>{aiDiagnosis.diagnosisTitle}</span>
                      </span>
                      <span className="px-2 py-0.5 bg-[#0D5C46] text-white text-[10px] font-bold rounded-full shrink-0">
                        Groq AI
                      </span>
                    </div>
                    <p className="text-xs text-slate-700 font-medium bg-white p-2.5 rounded-lg border border-emerald-200 leading-relaxed">
                      <strong>Saran AI:</strong> {aiDiagnosis.actionSuggestion}
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              {isTimingRejection ? (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsRejectionModalOpen(false);
                      onClose();
                    }}
                    className="w-full min-h-12 py-3 bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.98] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-2"
                  >
                    <SagaCheckBadgeIcon tone="dark" className="w-4 h-4 shrink-0" />
                    <span>Mengerti, Saya Akan Absen Pulang Nanti</span>
                  </button>
                </div>
              ) : (
                <div className="pt-1">
                  <span className="text-xs font-bold text-slate-600 block mb-2 text-left">Pilihan Pemulihan Instan:</span>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejectionModalOpen(false);
                        fetchGPSLocation();
                      }}
                      className="min-h-11 py-2.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-900 font-bold text-xs rounded-xl border border-slate-300 transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <SagaRefreshSyncIcon className="w-4 h-4 shrink-0" />
                      <span>Pindai Ulang</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejectionModalOpen(false);
                        setIsManualModalOpen(true);
                      }}
                      className="min-h-11 py-2.5 px-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <SagaKeyboardIcon className="w-4 h-4 shrink-0" />
                      <span>Kode Manual</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejectionModalOpen(false);
                        fetchGPSLocation();
                      }}
                      className="min-h-11 py-2.5 px-2 bg-[#0D5C46] hover:bg-[#094736] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <SagaMapPinIcon tone="dark" className="w-4 h-4 shrink-0" />
                      <span>Ukur Ulang GPS</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsRejectionModalOpen(false);
                        setIsCorrectionModalOpen(true);
                      }}
                      className="min-h-11 py-2.5 px-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 active:scale-95"
                    >
                      <SagaSparkAiIcon tone="dark" className="w-4 h-4 shrink-0" />
                      <span>Koreksi AI</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })()}
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

      {/* Guru Daily Mood Check-in Modal */}
      <MoodCheckinModal
        isOpen={isMoodModalOpen}
        onClose={() => {
          setIsMoodModalOpen(false);
          if (scanResult) onSuccess(scanResult);
          onClose();
        }}
        onSaved={() => {
          setIsMoodModalOpen(false);
          if (scanResult) onSuccess(scanResult);
          onClose();
        }}
      />

      {/* Anonymous Teacher Complaint & Feedback Modal */}
      <AnonymousComplaintModal
        isOpen={isComplaintModalOpen}
        onClose={() => {
          setIsComplaintModalOpen(false);
          if (scanResult) onSuccess(scanResult);
          onClose();
        }}
        onSuccess={() => {
          setIsComplaintModalOpen(false);
          if (scanResult) onSuccess(scanResult);
          onClose();
        }}
      />

      {/* Modern High-Tech Radar Location Verification Modal */}
      <RadarLocationVerificationModal
        isOpen={isRadarModalOpen}
        onLockGreen={handleRadarLockGreen}
        onComplete={handleRadarComplete}
        latitude={gpsCoords?.latitude}
        longitude={gpsCoords?.longitude}
        accuracy={gpsCoords?.accuracy}
        distanceMeters={gpsCoords?.distanceMeters}
        allowedRadiusMeters={allowedRadius}
        teacherName={pendingSuccessDataRef.current?.teacherName}
        action={pendingSuccessDataRef.current?.returnedAction === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN'}
      />
    </>
  );
};

