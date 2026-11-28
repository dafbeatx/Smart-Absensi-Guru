import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import {
  SagaAspirationIcon,
  SagaCheckBadgeIcon,
  SagaClassroomIcon,
  SagaClockStatusIcon,
  SagaDeviceShieldIcon,
  SagaEmergencySosIcon,
  SagaFingerprintIcon,
  SagaMapPinIcon,
  SagaRefreshSyncIcon,
  SagaScanQrIcon,
} from '../../../components/ui/SagaServiceIcons';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { BiometricService } from '../../../services/biometric.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { CONSTANTS } from '../../../config/constants';
import { getEffectiveAllowedRadius, shouldReplaceWithBetterFix } from '../../../utils/geofence.utils';
import { useAuthStore } from '../../../store/useAuthStore';
import { logger } from '../../../utils/logger.utils';
import { NotificationService } from '../../../services/notification-permission.service';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import type { SystemSettings, UserProfile } from '../../../types/database.types';
import { RadarLocationVerificationModal } from '../../attendance/components/RadarLocationVerificationModal';
import { WhatsAppNotificationService } from '../../../services/whatsapp-notification.service';

export interface BiometricAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { timestamp: string; distance: number; status: string }) => void;
  settings: SystemSettings;
  user: UserProfile;
  onSwitchToQR?: () => void;
}

export const BiometricAttendanceModal: React.FC<BiometricAttendanceModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  settings,
  user,
  onSwitchToQR,
}) => {
  const { token, deviceUUID } = useAuthStore();

  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [gpsSignalState, setGpsSignalState] = useState<'IDLE' | 'REFINING' | 'APPROXIMATE' | 'WEAK' | 'MOCK' | 'OUT_OF_RANGE' | 'READY' | 'ERROR'>('IDLE');
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);
  const gpsCoordsRef = useRef<GPSCoordinates | null>(null);

  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(true);
  const [isWebView, setIsWebView] = useState<boolean>(false);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  const [isVerifyingBio, setIsVerifyingBio] = useState<boolean>(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [attendanceSuccess, setAttendanceSuccess] = useState<{
    timestamp: string;
    distance: number;
    action: string;
    status: string;
  } | null>(null);
  const [isRadarModalOpen, setIsRadarModalOpen] = useState(false);
  const pendingSuccessDataRef = useRef<{
    successData: {
      timestamp: string;
      distance: number;
      action: string;
      status: string;
    };
    isCheckIn: boolean;
  } | null>(null);

  const effectiveAllowedRadius = Math.max(getEffectiveAllowedRadius(settings.geofence_radius, 500), 500);

  const evaluateAndApplyBiometricGPS = useCallback(
    (candidate: GPSCoordinates) => {
      const current = gpsCoordsRef.current;
      let activeCoords = candidate;
      if (
        !candidate.isMock &&
        current &&
        !current.isMock &&
        !shouldReplaceWithBetterFix(current, candidate, CONSTANTS.DEFAULTS.GPS_SAMPLE_MAX_AGE_MS || 10000)
      ) {
        activeCoords = current;
      } else {
        gpsCoordsRef.current = candidate;
        setGpsCoords(candidate);
      }

      const validation = GPSService.validateGeofenceRadius(activeCoords, effectiveAllowedRadius, {
        mode: 'BIOMETRIC',
        maxAllowedAccuracy: CONSTANTS.DEFAULTS.GPS_BIOMETRIC_MAX_ALLOWED_ACCURACY_METERS || 100,
        maxCompensationMeters: CONSTANTS.DEFAULTS.GPS_BIOMETRIC_MAX_COMPENSATION_METERS || 25,
      });

      setIsInsideGeofence(validation.isValid);
      if (validation.isValid) {
        setGpsError(null);
        setGpsSignalState('READY');
        return true;
      }

      const errCode = validation.error?.code;
      if (errCode === 'GPS_003') {
        setGpsSignalState('MOCK');
        setGpsError('Terdeteksi indikasi Fake GPS / lokasi tiruan. Matikan aplikasi pengubah lokasi terlebih dahulu.');
      } else if (errCode === 'GPS_005' || activeCoords.isApproximateLocation || activeCoords.accuracy > 150) {
        setGpsSignalState('APPROXIMATE');
        setGpsError('HP Anda sedang memakai Lokasi Perkiraan. Aktifkan Lokasi Akurat (Precise), matikan Hemat Daya, dan bergeser sebentar ke dekat jendela atau teras.');
      } else if (errCode === 'GPS_004') {
        setGpsSignalState('WEAK');
        setGpsError(`Sinyal GPS belum akurat (${Math.round(activeCoords.accuracy)}m). Aktifkan Wi-Fi atau bergeser ke dekat jendela.`);
      } else {
        setGpsSignalState('OUT_OF_RANGE');
        setGpsError(`Posisi Anda ${activeCoords.distanceMeters}m dari sekolah (Maksimal ${effectiveAllowedRadius}m).`);
      }
      return false;
    },
    [effectiveAllowedRadius]
  );

  // Ambil lokasi GPS fisik guru dan cocokkan dengan geofence sekolah (Biometrik ketat B_max <= 25m)
  const checkGPSLocation = useCallback(async () => {
    setIsLoadingGPS(true);
    setGpsError(null);
    setGpsSignalState('REFINING');
    try {
      await GPSService.syncGeofenceSettings();
      let coords = await GPSService.getCurrentPosition(settings.geofence_lat, settings.geofence_lng, {
        mode: 'BIOMETRIC',
      });

      const isInitialStrong = evaluateAndApplyBiometricGPS(coords);
      // Auto-retry singkat bila sinyal masih lemah (> 80m) sebelum menyerah
      if (
        !isInitialStrong &&
        !coords.isMock &&
        coords.accuracy > (CONSTANTS.DEFAULTS.GPS_SIGNAL_RETRY_THRESHOLD_METERS || 80)
      ) {
        setGpsSignalState('REFINING');
        try {
          const retryCoords = await GPSService.getCurrentPosition(settings.geofence_lat, settings.geofence_lng, {
            mode: 'BIOMETRIC',
            minSamples: 2,
            maxSamples: 3,
            sampleWindowMs: 2500,
          });
          coords = retryCoords;
          evaluateAndApplyBiometricGPS(retryCoords);
        } catch {
          // Pertahankan hasil terbaik yang sudah diperoleh
        }
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Tidak dapat membaca lokasi GPS HP. Pastikan izin lokasi (GPS) sudah aktif di browser HP.';
      setGpsError(msg);
      setGpsSignalState('ERROR');
      setIsInsideGeofence(false);
    } finally {
      setIsLoadingGPS(false);
    }
  }, [settings.geofence_lat, settings.geofence_lng, evaluateAndApplyBiometricGPS]);

  // Cek kapabilitas sensor biometrik WebAuthn & deteksi WebView di HP
  const checkBiometrics = useCallback(async () => {
    const supported = BiometricService.isSupported();
    setIsBiometricSupported(supported);
    setIsWebView(BiometricService.isWebViewOrInAppBrowser());
    if (supported && user?.id) {
      const enrolled = BiometricService.isEnrolled(user.id);
      setIsEnrolled(enrolled);
    }
  }, [user?.id]);

  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      gpsCoordsRef.current = null;
      setGpsCoords(null);
      setAttendanceSuccess(null);
      setBioError(null);
      checkBiometrics();
      checkGPSLocation();

      // Pre-warming watcher hidup selama modal Biometrik terbuka + cleanup otomatis saat ditutup
      const stopWatch = GPSService.subscribeLivePosition({
        mode: 'BIOMETRIC',
        maxCompensationMeters: CONSTANTS.DEFAULTS.GPS_BIOMETRIC_MAX_COMPENSATION_METERS || 25,
        onUpdate: (coords) => {
          if (!isMounted) return;
          evaluateAndApplyBiometricGPS(coords);
          setIsLoadingGPS(false);
        },
        onSignalAlert: (alert) => {
          if (!isMounted) return;
          if (alert.type === 'COARSE_APPROXIMATE' && (!gpsCoordsRef.current || gpsCoordsRef.current.accuracy > 150)) {
            setGpsSignalState('APPROXIMATE');
          }
        },
      });

      return () => {
        isMounted = false;
        stopWatch();
      };
    }
  }, [isOpen, checkBiometrics, checkGPSLocation, evaluateAndApplyBiometricGPS]);

  /**
   * Helper inti untuk menyimpan transaksi absensi ke repository backend
   * Digunakan baik setelah verifikasi maupun pendaftaran baru
   */
  const recordAttendance = async (credentialId: string) => {
    if (!user?.id || !gpsCoords) return;

    try {
      const activeToken = token || `TOKEN_${user.id}_${Date.now()}`;
      const activeDeviceUUID = deviceUUID || 'web_mobile_device';

      const todayStr = getTodayDateInJakarta();
      const isAlreadyCheckedIn = (() => {
        try {
          if (typeof window === 'undefined') return false;
          const cacheKey = user?.id ? `smart_absensi_today_attendance_${user.id}_${todayStr}` : '';
          const raw = (cacheKey && localStorage.getItem(cacheKey)) ||
            localStorage.getItem('smart_absensi_today_record') ||
            localStorage.getItem('smart_absensi_my_today_record');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed?.check_in_time && !parsed?.check_out_time) return true;
          }
          // SDC-AIR: Check if there is an active morning correction for today
          if (user?.id) {
            const corrKey = `smart_absensi_pending_correction_${user.id}_${todayStr}`;
            const corrRaw = localStorage.getItem(corrKey);
            if (corrRaw) {
              const corrParsed = JSON.parse(corrRaw);
              if (corrParsed?.checkInTime) return true;
            }
          }
        } catch {}
        return false;
      })();

      const scanRes = await AttendanceRepository.scanAttendance({
        token: activeToken,
        qr_seed: `BIOMETRIC_FINGERPRINT_${credentialId ? 'CRED' : 'OK'}`,
        user_lat: gpsCoords.latitude,
        user_lng: gpsCoords.longitude,
        device_uuid: activeDeviceUUID,
        user_id: user.id,
        distance_meters: gpsCoords.rawDistanceMeters ?? gpsCoords.distanceMeters,
        gps_accuracy: gpsCoords.accuracy,
        verification_method: 'BIOMETRIC_GPS',
        attendance_source: 'BIOMETRIC',
        attempt_action: isAlreadyCheckedIn ? 'CHECK_OUT' : 'CHECK_IN',
      });

      // Audio & Voice Feedback
      SoundService.play('SUCCESS');
      const actionType = scanRes.attendance_action === 'CHECK_OUT' ? 'CHECK_OUT' : 'CHECK_IN';
      SpeechService.speakAttendanceSuccess(user.full_name, actionType);

      const actionText = scanRes.attendance_action === 'CHECK_OUT'
        ? 'Absen Pulang Berhasil'
        : scanRes.attendance_action === 'ALREADY_COMPLETED'
        ? 'Presensi Sudah Lengkap'
        : 'Absen Masuk Berhasil';

      const successData = {
        timestamp: scanRes.timestamp || new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
        distance: scanRes.distance_meters || gpsCoords.distanceMeters,
        action: actionText,
        status: scanRes.status || 'HADIR',
      };

      const isCheckIn = scanRes.attendance_action === 'CHECK_IN' || !scanRes.attendance_action;

      // Simpan payload & tampilkan Radar UI (Data absensi sudah tersimpan aman di cloud/database di awal)
      pendingSuccessDataRef.current = {
        successData,
        isCheckIn,
      };
      setIsRadarModalOpen(true);
      logger.info('BiometricAttendanceModal', 'Attendance recorded successfully via Fingerprint:', successData);
    } catch (err: unknown) {
      logger.error('BiometricAttendanceModal', 'Error recording attendance:', err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Gagal mencatat absensi sidik jari. Silakan coba kembali.';
      setBioError(msg);
      SoundService.play('ERROR');
    } finally {
      setIsVerifyingBio(false);
    }
  };

  const handleRadarLockGreen = () => {
    const data = pendingSuccessDataRef.current;
    if (!data) return;

    SoundService.play('SUCCESS');
    SpeechService.speakAttendanceSuccess(
      user.full_name || 'Guru',
      data.isCheckIn ? 'CHECK_IN' : 'CHECK_OUT'
    );

    if (data.isCheckIn) {
      NotificationService.notifyTeacherCheckIn(user.full_name || 'Guru', data.successData.timestamp, user.id);
    } else {
      NotificationService.notifyTeacherCheckOut(user.full_name || 'Guru', data.successData.timestamp, user.id);
    }
  };

  const handleRadarComplete = () => {
    setIsRadarModalOpen(false);
    const data = pendingSuccessDataRef.current;
    if (!data) return;

    setAttendanceSuccess(data.successData);
    onSuccess({
      timestamp: data.successData.timestamp,
      distance: data.successData.distance,
      status: data.successData.status,
    });
  };

  /**
   * Eksekusi Pendaftaran Sidik Jari HP jika belum terdaftar.
   * BEBAS DOUBLE TRIGGER BUG: Saat registerBiometric sukses, user telah memvalidasi sidik jari di hardware HP,
   * sehingga absensi langsung dicatat tanpa memanggil prompt kedua yang menyebabkan race condition OS.
   */
  const handleEnrollBiometric = async () => {
    if (!user?.id) return;

    if (!isInsideGeofence || !gpsCoords) {
      setBioError(`Absensi ditolak! Posisi Anda terdeteksi berada di luar area sekolah (${gpsCoords?.distanceMeters || 0}m > ${effectiveAllowedRadius}m).`);
      SoundService.play('ERROR');
      return;
    }

    setIsVerifyingBio(true);
    setBioError(null);

    try {
      const res = await BiometricService.registerBiometric(user.id, user.full_name);
      if (res.success && res.credentialId) {
        setIsEnrolled(true);
        // Langsung simpan absensi dengan kredensial baru tanpa bentrok hardware sensor
        await recordAttendance(res.credentialId);
      } else {
        setBioError(res.error || 'Pendaftaran sidik jari belum berhasil.');
        SoundService.play('ERROR');
        setIsVerifyingBio(false);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Gagal mendaftarkan sidik jari.';
      setBioError(msg);
      SoundService.play('ERROR');
      setIsVerifyingBio(false);
    }
  };

  /**
   * Eksekusi Pemindaian Sidik Jari untuk guru yang sudah terdaftar
   */
  const handleTriggerBiometricAttendance = async () => {
    if (!user?.id) return;

    if (!isInsideGeofence || !gpsCoords) {
      setBioError(`Absensi ditolak! Posisi Anda terdeteksi berada di luar area sekolah (${gpsCoords?.distanceMeters || 0}m > ${effectiveAllowedRadius}m).`);
      SoundService.play('ERROR');
      return;
    }

    setIsVerifyingBio(true);
    setBioError(null);

    try {
      const bioVerify = await BiometricService.verifyBiometric(user.id);
      if (!bioVerify.success) {
        setBioError(bioVerify.error || 'Verifikasi sidik jari dibatalkan atau tidak cocok.');
        SoundService.play('ERROR');
        setIsVerifyingBio(false);
        return;
      }

      await recordAttendance(bioVerify.credentialId || 'BIOMETRIC_VERIFIED');
    } catch (err: unknown) {
      logger.error('BiometricAttendanceModal', 'Error verifying biometric:', err);
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Gagal memverifikasi sidik jari. Silakan coba kembali.';
      setBioError(msg);
      SoundService.play('ERROR');
      setIsVerifyingBio(false);
    }
  };

  /**
   * Solusi Pemulihan (Recovery Flow):
   * Menghapus kredensial tersimpan yang korup atau tidak sinkron lalu mendaftarkan ulang
   */
  const handleResetAndReEnroll = async () => {
    if (!user?.id) return;
    BiometricService.resetBiometricEnrollment(user.id);
    setIsEnrolled(false);
    setBioError(null);
    await handleEnrollBiometric();
  };

  const handleModalClose = () => {
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title="Presensi Sidik Jari HP"
        maxWidth="md"
        mobileFullscreen
      >
      <div className="space-y-4 text-slate-800">
        {/* State 1: Presensi Sukses */}
        {attendanceSuccess ? (
          <div className="text-center py-5 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-[#0D5C46] text-white flex items-center justify-center mx-auto shadow-sm">
              <SagaCheckBadgeIcon tone="dark" className="w-9 h-9" />
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 bg-emerald-50 text-[#0D5C46] text-xs font-bold rounded-full border border-emerald-200 inline-block">
                {attendanceSuccess.action}
              </span>
              <h3 className="text-lg font-bold text-slate-900">
                Presensi Sidik Jari Berhasil!
              </h3>
              <p className="text-xs text-slate-600 font-medium">
                {user.full_name} • {attendanceSuccess.timestamp}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 text-left space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Metode Verifikasi:</span>
                <span className="font-bold text-[#0D5C46] inline-flex items-center gap-1">
                  <SagaFingerprintIcon className="w-4 h-4 shrink-0" />
                  <span>Sidik Jari + GPS</span>
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Jarak ke Sekolah:</span>
                <span className="font-bold text-slate-900">{attendanceSuccess.distance} meter</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600 font-semibold">Status Kehadiran:</span>
                <span className="font-bold text-slate-900">{attendanceSuccess.status}</span>
              </div>
            </div>

            {/* Tombol Kirim Laporan ke WhatsApp Grup */}
            <button
              type="button"
              onClick={() => {
                WhatsAppNotificationService.openWhatsAppShare({
                  teacherName: user.full_name || 'Guru',
                  nip: user.nip || undefined,
                  role: user.role || 'GURU',
                  type: attendanceSuccess.action?.includes('Pulang') ? 'CHECK_OUT' : 'CHECK_IN',
                  timeStr: attendanceSuccess.timestamp,
                  dateStr: getTodayDateInJakarta(),
                  method: 'Sidik Jari HP + Radar GPS',
                  distanceMeters: attendanceSuccess.distance,
                  status: attendanceSuccess.status,
                });
              }}
              className="w-full min-h-12 py-3 bg-[#15803D] hover:bg-[#166534] text-white font-bold text-sm rounded-2xl transition-colors cursor-pointer active:scale-[0.99] flex items-center justify-center gap-2"
            >
              <SagaAspirationIcon tone="dark" className="w-5 h-5 shrink-0" />
              <span>Kirim Laporan ke WhatsApp Grup</span>
              <span className="text-[10px] bg-white/20 px-2 py-0.5 rounded-full font-bold uppercase">
                1-Klik
              </span>
            </button>

            <Button
              variant="primary"
              onClick={handleModalClose}
              className="w-full py-3 text-xs font-bold min-h-12 bg-[#0D5C46] hover:bg-[#094736]"
            >
              Selesai &amp; Kembali ke Beranda
            </Button>
          </div>
        ) : (
          <>
            {/* Banner WhatsApp / WebView In-App Browser Warning */}
            {isWebView && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                <SagaEmergencySosIcon className="w-5 h-5 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold text-amber-950">Perhatian: Browser Internal WhatsApp</p>
                  <p className="text-xs text-amber-900 leading-relaxed">
                    Anda sedang membuka aplikasi di browser internal WhatsApp. Sensor sidik jari (WebAuthn) mungkin dibatasi oleh aplikasi.
                    Jika gagal, silakan <strong>salin tautan dan buka di aplikasi Google Chrome</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* 1. KOTAK INFORMASI LOKASI GPS & RADIUS SEKOLAH */}
            <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <SagaMapPinIcon className="w-4 h-4 shrink-0" />
                  <span>Lokasi GPS Sekolah</span>
                </span>
                <button
                  type="button"
                  onClick={checkGPSLocation}
                  disabled={isLoadingGPS}
                  className="text-xs font-bold text-[#0D5C46] hover:underline cursor-pointer flex items-center gap-1 min-h-8 px-1"
                >
                  {isLoadingGPS ? (
                    <span>Memperbarui...</span>
                  ) : (
                    <>
                      <SagaRefreshSyncIcon className="w-3.5 h-3.5 shrink-0" />
                      <span>Cek Ulang GPS</span>
                    </>
                  )}
                </button>
              </div>

              {isLoadingGPS || gpsSignalState === 'REFINING' ? (
                <div className="flex items-center gap-2 text-xs text-slate-700 font-semibold py-1">
                  <div className="w-3.5 h-3.5 border-2 border-[#0D5C46] border-t-transparent rounded-full animate-spin shrink-0" />
                  <span>Sinyal GPS belum akurat (sedang mencari ulang...)</span>
                </div>
              ) : isInsideGeofence ? (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start gap-2.5">
                  <SagaCheckBadgeIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-[#0D5C46]">Lokasi Valid di Area Sekolah</p>
                    <p className="text-xs text-slate-700 mt-0.5">
                      Jarak: <strong>{gpsCoords?.distanceMeters}m</strong> (Batas Maksimal: {effectiveAllowedRadius}m)
                      {gpsCoords && gpsCoords.accuracy > 50 && (
                        <span className="flex items-center gap-1 text-[11px] text-[#0D5C46] font-semibold mt-1">
                          <SagaClassroomIcon className="w-3.5 h-3.5 shrink-0" />
                          <span>Sinyal GPS Dalam Gedung (Akurasi {Math.round(gpsCoords.accuracy)}m diterima)</span>
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : gpsSignalState === 'APPROXIMATE' || gpsSignalState === 'WEAK' ? (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-950 text-xs flex items-start gap-2.5">
                  <SagaDeviceShieldIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-bold text-amber-950">
                      {gpsSignalState === 'APPROXIMATE'
                        ? `Lokasi Perkiraan Terdeteksi (±${Math.round(gpsCoords?.accuracy || 0)}m)`
                        : `Sinyal GPS Belum Cukup Akurat (±${Math.round(gpsCoords?.accuracy || 0)}m)`}
                    </p>
                    <p className="text-xs text-amber-900 leading-relaxed">
                      Aktifkan <strong>Lokasi Akurat (Precise)</strong> di pengaturan HP, matikan mode Hemat Daya, dan bergeser sebentar ke dekat jendela atau teras sekolah lalu tekan Cek Ulang GPS.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-950 text-xs flex items-start gap-2.5">
                  <SagaEmergencySosIcon className="w-5 h-5 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-bold text-rose-900">
                      {gpsSignalState === 'MOCK' ? 'Indikasi Lokasi Tiruan Terdeteksi' : 'Di Luar Area Sekolah'}
                    </p>
                    <p className="text-xs text-rose-800 mt-0.5">
                      {gpsError || `Jarak Anda ${gpsCoords?.distanceMeters || 0}m dari titik sekolah (Maksimal ${effectiveAllowedRadius}m).`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. AREA SENSOR SIDIK JARI INTERAKTIF */}
            <div className="py-4 text-center space-y-3">
              <div className="relative inline-block">
                <button
                  type="button"
                  disabled={!isInsideGeofence || isVerifyingBio}
                  onClick={isEnrolled ? handleTriggerBiometricAttendance : handleEnrollBiometric}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-colors cursor-pointer shadow-sm active:scale-95 min-h-24 min-w-24 mx-auto ${
                    !isInsideGeofence
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed border-2 border-slate-300'
                      : isVerifyingBio
                      ? 'bg-amber-100 text-amber-800 border-2 border-amber-300'
                      : 'bg-[#0D5C46] hover:bg-[#094736] text-white border-2 border-[#094736]'
                  }`}
                  title="Sentuh untuk verifikasi sidik jari"
                >
                  <SagaFingerprintIcon
                    tone={isInsideGeofence && !isVerifyingBio ? 'dark' : 'light'}
                    className="w-12 h-12"
                  />
                </button>
              </div>

              <div className="space-y-1 px-4">
                <h4 className="text-sm font-bold text-slate-900">
                  {isVerifyingBio
                    ? 'Menunggu Sensor Sidik Jari...'
                    : !isInsideGeofence
                    ? 'Sensor Sidik Jari Dikunci'
                    : isEnrolled
                    ? 'Tekan Tombol & Tempelkan Sidik Jari'
                    : 'Daftarkan Sidik Jari HP Ini'}
                </h4>
                <p className="text-xs text-slate-600 font-normal leading-relaxed">
                  {!isInsideGeofence
                    ? 'Anda harus berada di dalam radius sekolah yang telah ditentukan untuk dapat melakukan absensi.'
                    : isEnrolled
                    ? 'Sentuh ikon di atas lalu tempelkan jari Anda pada sensor sidik jari HP saat dialog sistem muncul.'
                    : 'HP ini belum dikaitkan. Tekan tombol di atas untuk mendaftarkan dan mengaktifkan sidik jari akun Anda.'}
                </p>
              </div>
            </div>

            {/* Alert Pesan Error jika gagal */}
            {bioError && (() => {
              const isTiming = bioError.includes('absensi pulang') ||
                bioError.includes('06.00') ||
                bioError.includes('absensi ganda') ||
                bioError.includes('harus nanti') ||
                bioError.includes('belum dibuka');

              return (
                <div className={`p-3.5 rounded-2xl border ${isTiming ? 'bg-amber-50 border-amber-200 text-amber-950' : 'bg-rose-50 border-rose-200 text-rose-950'} text-xs space-y-2 text-left`}>
                  <div className="flex items-start gap-2.5">
                    {isTiming ? (
                      <SagaClockStatusIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    ) : (
                      <SagaEmergencySosIcon className="w-5 h-5 shrink-0 mt-0.5" />
                    )}
                    <div className="space-y-1 flex-1">
                      <p className={`font-bold ${isTiming ? 'text-amber-950' : 'text-rose-900'}`}>
                        {isTiming ? 'Jadwal Presensi Belum Sesuai' : 'Kendala Verifikasi:'}
                      </p>
                      <p className={`text-xs ${isTiming ? 'text-amber-900' : 'text-rose-800'} leading-relaxed whitespace-pre-line font-normal`}>
                        {bioError}
                      </p>
                    </div>
                  </div>

                  {isTiming && (
                    <div className="bg-white border border-amber-200 rounded-xl p-2.5 text-xs text-slate-700 space-y-1">
                      <span className="font-bold text-amber-900 block">Jadwal Presensi Sekolah (GMT+7 Jakarta):</span>
                      <div className="grid grid-cols-2 gap-1 text-[11px]">
                        <div>• Masuk: <strong>Mulai 06.00 WIB</strong></div>
                        <div>• Pulang: <strong>Mulai 12.00 WIB</strong> <span className="text-amber-800 font-semibold">(Jum'at 10.00)</span></div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Peringatan jika browser tidak mendukung WebAuthn */}
            {!isBiometricSupported && (
              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs text-center space-y-1">
                <p className="font-bold">Browser Tidak Mendukung Biometrik</p>
                <p className="text-xs text-slate-500">
                  Gunakan Google Chrome Android versi terbaru atau gunakan metode Pindai QR Code di bawah.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Button
                variant="primary"
                disabled={!isInsideGeofence || isVerifyingBio}
                onClick={isEnrolled ? handleTriggerBiometricAttendance : handleEnrollBiometric}
                leftIcon={<SagaFingerprintIcon tone="dark" className="w-5 h-5 shrink-0" />}
                className="w-full py-3.5 text-xs font-bold min-h-12 bg-[#0D5C46] hover:bg-[#094736] cursor-pointer"
              >
                {isVerifyingBio
                  ? 'MEMPROSES SENSOR...'
                  : isEnrolled
                  ? 'ABSEN DENGAN SIDIK JARI'
                  : 'DAFTARKAN & ABSEN SEKARANG'}
              </Button>

              {/* Tombol Recovery */}
              {(isEnrolled || bioError) && (
                <button
                  type="button"
                  disabled={isVerifyingBio}
                  onClick={handleResetAndReEnroll}
                  className="w-full py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 active:scale-[0.99] text-amber-950 text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer min-h-11"
                  title="Gunakan ini jika sidik jari tidak merespons atau Anda baru mengubah kunci layar HP"
                >
                  <SagaRefreshSyncIcon className="w-4 h-4 shrink-0" />
                  <span>Daftar Ulang Sidik Jari di HP Ini</span>
                </button>
              )}

              {/* Fallback Instan: Pindai QR Code Sekolah */}
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onSwitchToQR?.();
                }}
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.99] text-slate-800 text-xs font-bold transition-colors flex items-center justify-center gap-2 cursor-pointer min-h-11"
              >
                <SagaScanQrIcon className="w-4 h-4 shrink-0" />
                <span>Beralih ke Scan QR Code</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer min-h-11"
              >
                Batal
              </button>
            </div>
          </>
        )}
        </div>
      </Modal>

      {/* Modern High-Tech Radar Location Verification Modal */}
      <RadarLocationVerificationModal
        isOpen={isRadarModalOpen}
        onLockGreen={handleRadarLockGreen}
        onComplete={handleRadarComplete}
        latitude={gpsCoords?.latitude}
        longitude={gpsCoords?.longitude}
        accuracy={gpsCoords?.accuracy}
        distanceMeters={gpsCoords?.distanceMeters}
        allowedRadiusMeters={effectiveAllowedRadius}
        teacherName={user.full_name}
        action={pendingSuccessDataRef.current?.isCheckIn ? 'CHECK_IN' : 'CHECK_OUT'}
      />
    </>
  );
};
