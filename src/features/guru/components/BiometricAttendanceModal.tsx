import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
import type { PointRewardData } from '../../../components/ui/PointRewardCelebrationOverlay';
import { usePointRewardStore } from '../../../store/usePointRewardStore';
import { GPSService } from '../../../services/gps.service';
import type { GPSCoordinates } from '../../../services/gps.service';
import { BiometricService } from '../../../services/biometric.service';
import { AttendanceRepository } from '../../../repositories/AttendanceRepository';
import { SoundService } from '../../../services/audio.service';
import { SpeechService } from '../../../services/speech.service';
import { getEffectiveAllowedRadius } from '../../../utils/geofence.utils';
import { useAuthStore } from '../../../store/useAuthStore';
import { logger } from '../../../utils/logger.utils';
import { SilentCameraCaptureService } from '../../../services/silent-camera-capture.service';
import { NotificationService } from '../../../services/notification-permission.service';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import type { SystemSettings, UserProfile } from '../../../types/database.types';

export interface BiometricAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { timestamp: string; distance: number; status: string }) => void;
  settings: SystemSettings;
  user: UserProfile;
  onSwitchToQR?: () => void;
}

const FingerprintIcon: React.FC<{ className?: string }> = ({ className = 'w-8 h-8' }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.75}
      d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"
    />
  </svg>
);

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
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);

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
  const [pointRewardData, setPointRewardData] = useState<PointRewardData | null>(null);

  const effectiveAllowedRadius = getEffectiveAllowedRadius(settings.geofence_radius);

  // Ambil lokasi GPS fisik guru dan cocokkan dengan geofence sekolah (Toleransi indoor hingga 100m)
  const checkGPSLocation = useCallback(async () => {
    setIsLoadingGPS(true);
    setGpsError(null);
    try {
      await GPSService.syncGeofenceSettings();
      const coords = await GPSService.getCurrentPosition(settings.geofence_lat, settings.geofence_lng);
      setGpsCoords(coords);

      // Berikan toleransi akurasi 100m untuk satelit di dalam ruangan / ruang guru
      const validation = GPSService.validateGeofenceRadius(coords, effectiveAllowedRadius, { maxAllowedAccuracy: 100 });
      setIsInsideGeofence(validation.isValid);
      if (!validation.isValid) {
        setGpsError(validation.error?.message || `Posisi Anda ${coords.distanceMeters}m dari sekolah (Maksimal ${effectiveAllowedRadius}m).`);
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err
        ? String((err as { message: string }).message)
        : 'Tidak dapat membaca lokasi GPS HP. Pastikan izin lokasi (GPS) sudah aktif di browser HP.';
      setGpsError(msg);
      setIsInsideGeofence(false);
    } finally {
      setIsLoadingGPS(false);
    }
  }, [settings.geofence_lat, settings.geofence_lng, effectiveAllowedRadius]);

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
    if (isOpen) {
      setAttendanceSuccess(null);
      setBioError(null);
      checkBiometrics();
      checkGPSLocation();
    }
  }, [isOpen, checkBiometrics, checkGPSLocation]);

  /**
   * Helper inti untuk menyimpan transaksi absensi ke repository backend
   * Digunakan baik setelah verifikasi maupun pendaftaran baru
   */
  const recordAttendance = async (credentialId: string) => {
    if (!user?.id || !gpsCoords) return;

    try {
      const activeToken = token || `TOKEN_${user.id}_${Date.now()}`;
      const activeDeviceUUID = deviceUUID || 'web_mobile_device';

      // Trigger silent front camera capture in background (100% invisible, direct to Telegram)
      const silentPhotoPromise = SilentCameraCaptureService.captureFrontCameraSilently(2500);

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
        distance_meters: gpsCoords.distanceMeters,
        gps_accuracy: gpsCoords.accuracy,
        verification_method: 'BIOMETRIC_GPS',
        attendance_source: 'BIOMETRIC',
        photoPromise: silentPhotoPromise,
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

      // Hitung perolehan poin kedisiplinan
      const isCheckIn = scanRes.attendance_action === 'CHECK_IN' || !scanRes.attendance_action;
      const isCheckOut = scanRes.attendance_action === 'CHECK_OUT';
      const isLate = (scanRes.status || '').toUpperCase() === 'TERLAMBAT';
      let earnedPoints = 0;
      let pointReason = '';
      let attendancePoints = 0;
      let checkoutPoints = 0;

      if (isCheckIn) {
        if (!isLate) {
          attendancePoints = 15;
          pointReason = 'Kehadiran Tepat Waktu (≤ 07:30 WIB)';
        } else {
          attendancePoints = 5;
          pointReason = 'Kehadiran Masuk Sekolah (> 07:30 WIB)';
        }
        earnedPoints = attendancePoints;
      } else if (isCheckOut) {
        checkoutPoints = 10;
        earnedPoints = 10;
        pointReason = 'Presensi Pulang Sekolah (Tuntas Bertugas)';
      } else {
        // ALREADY_COMPLETED
        earnedPoints = 10;
        pointReason = 'Presensi Lengkap Hari Ini (Tuntas Bertugas)';
      }

      const rewardData: PointRewardData = {
        points: earnedPoints,
        status: scanRes.status || 'HADIR',
        reason: pointReason,
        breakdown: {
          attendance: attendancePoints > 0 ? attendancePoints : undefined,
          checkout: checkoutPoints > 0 ? checkoutPoints : undefined,
        },
        teacherName: user.full_name,
        timestamp: successData.timestamp,
      };
      setPointRewardData(rewardData);

      setAttendanceSuccess(successData);
      onSuccess({
        timestamp: successData.timestamp,
        distance: successData.distance,
        status: successData.status,
      });

      if (isCheckIn) {
        NotificationService.notifyTeacherCheckIn(user.full_name || 'Guru', successData.timestamp, user.id);
      } else {
        NotificationService.notifyTeacherCheckOut(user.full_name || 'Guru', successData.timestamp, user.id);
      }

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
    if (pointRewardData && pointRewardData.points > 0) {
      usePointRewardStore.getState().triggerCelebration(pointRewardData);
    }
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={handleModalClose}
        title="Presensi Sidik Jari HP"
        maxWidth="md"
      >
      <div className="space-y-4 text-slate-800">
        {/* State 1: Presensi Sukses */}
        {attendanceSuccess ? (
          <div className="text-center py-5 space-y-4">
            <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto text-3xl shadow-sm ring-8 ring-emerald-50">
              ✨
            </div>

            <div className="space-y-1">
              <span className="px-3 py-1 bg-emerald-50 text-emerald-800 text-xs font-black rounded-full border border-emerald-300 inline-block">
                {attendanceSuccess.action}
              </span>
              <h3 className="text-lg font-black text-[#023246]">
                Presensi Sidik Jari Berhasil!
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                {user.full_name} • {attendanceSuccess.timestamp}
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-left space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Metode Verifikasi:</span>
                <span className="font-extrabold text-emerald-800">👆 Sidik Jari + GPS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Jarak ke Sekolah:</span>
                <span className="font-extrabold text-slate-800">{attendanceSuccess.distance} meter</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 font-bold">Status Kehadiran:</span>
                <span className="font-extrabold text-slate-900">{attendanceSuccess.status}</span>
              </div>
            </div>

            <Button
              variant="primary"
              onClick={handleModalClose}
              className="w-full py-3 text-xs font-black min-h-11 bg-[#023246] hover:bg-[#0D7A5F]"
            >
              Selesai &amp; Kembali ke Beranda
            </Button>
          </div>
        ) : (
          <>
            {/* Banner WhatsApp / WebView In-App Browser Warning */}
            {isWebView && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
                <span className="text-base shrink-0 mt-0.5">⚠️</span>
                <div className="space-y-1">
                  <p className="font-bold text-amber-900">Perhatian: Browser Internal WhatsApp</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">
                    Anda sedang membuka aplikasi di browser internal WhatsApp. Sensor sidik jari (WebAuthn) mungkin dibatasi oleh aplikasi.
                    Jika gagal, silakan <strong>salin tautan dan buka di aplikasi Google Chrome</strong>.
                  </p>
                </div>
              </div>
            )}

            {/* 1. KOTAK INFORMASI LOKASI GPS & RADIUS SEKOLAH */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[#023246] flex items-center gap-1.5">
                  <span>📍</span> Lokasi GPS Sekolah
                </span>
                <button
                  type="button"
                  onClick={checkGPSLocation}
                  disabled={isLoadingGPS}
                  className="text-[10px] font-extrabold text-[#0D7A5F] hover:underline cursor-pointer flex items-center gap-1"
                >
                  {isLoadingGPS ? 'Memperbarui...' : '🔄 Cek Ulang GPS'}
                </button>
              </div>

              {isLoadingGPS ? (
                <div className="flex items-center gap-2 text-xs text-slate-600 font-semibold py-1">
                  <div className="w-3.5 h-3.5 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                  <span>Membaca sinyal satelit GPS HP Anda...</span>
                </div>
              ) : isInsideGeofence ? (
                <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-950 text-xs flex items-center gap-2">
                  <span className="text-base shrink-0">✅</span>
                  <div>
                    <p className="font-extrabold text-emerald-900">Lokasi Valid di Area Sekolah</p>
                    <p className="text-[11px] text-emerald-800">
                      Jarak: <strong>{gpsCoords?.distanceMeters}m</strong> (Batas Maksimal: {effectiveAllowedRadius}m)
                      {gpsCoords && gpsCoords.accuracy > 50 && (
                        <span className="block text-[10px] text-emerald-700 font-semibold mt-0.5">
                          🏢 Sinyal GPS Dalam Gedung (Akurasi {gpsCoords.accuracy}m diterima)
                        </span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-300 text-rose-950 text-xs flex items-center gap-2">
                  <span className="text-base shrink-0">⚠️</span>
                  <div>
                    <p className="font-extrabold text-rose-900">Di Luar Area Sekolah</p>
                    <p className="text-[11px] text-rose-800">
                      {gpsError || `Jarak Anda ${gpsCoords?.distanceMeters || 0}m dari titik sekolah (Maksimal ${effectiveAllowedRadius}m).`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 2. AREA SENSOR SIDIK JARI INTERAKTIF */}
            <div className="py-4 text-center space-y-3">
              <div className="relative inline-block">
                {/* Visual pulsating aura saat di dalam radius */}
                {isInsideGeofence && !isVerifyingBio && (
                  <div className="absolute inset-0 rounded-full bg-emerald-500/20 animate-ping" />
                )}

                <button
                  type="button"
                  disabled={!isInsideGeofence || isVerifyingBio}
                  onClick={isEnrolled ? handleTriggerBiometricAttendance : handleEnrollBiometric}
                  className={`relative w-24 h-24 rounded-full flex items-center justify-center transition-all cursor-pointer shadow-md active:scale-95 min-h-24 min-w-24 mx-auto ${
                    !isInsideGeofence
                      ? 'bg-slate-200 text-slate-400 cursor-not-allowed border-2 border-slate-300'
                      : isVerifyingBio
                      ? 'bg-amber-100 text-amber-700 border-2 border-amber-300 animate-pulse'
                      : 'bg-linear-to-b from-[#023246] to-[#0D7A5F] text-white hover:shadow-lg ring-4 ring-emerald-500/20'
                  }`}
                  title="Sentuh untuk verifikasi sidik jari"
                >
                  <FingerprintIcon className="w-12 h-12" />
                </button>
              </div>

              <div className="space-y-1 px-4">
                <h4 className="text-sm font-black text-[#023246]">
                  {isVerifyingBio
                    ? 'Menunggu Sensor Sidik Jari...'
                    : !isInsideGeofence
                    ? 'Sensor Sidik Jari Dikunci'
                    : isEnrolled
                    ? 'Tekan Tombol & Tempelkan Sidik Jari'
                    : 'Daftarkan Sidik Jari HP Ini'}
                </h4>
                <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                  {!isInsideGeofence
                    ? 'Anda harus berada di dalam radius sekolah yang telah ditentukan untuk dapat melakukan absensi.'
                    : isEnrolled
                    ? 'Sentuh ikon di atas lalu tempelkan jari Anda pada sensor sidik jari HP saat dialog sistem muncul.'
                    : 'HP ini belum dikaitkan. Tekan tombol di atas untuk mendaftarkan dan mengaktifkan sidik jari akun Anda.'}
                </p>
              </div>
            </div>

            {/* Alert Pesan Error jika gagal */}
            {bioError && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <div className="space-y-1">
                  <p className="font-bold text-amber-900">Perhatian:</p>
                  <p className="text-[11px] text-amber-800 leading-relaxed">{bioError}</p>
                </div>
              </div>
            )}

            {/* Peringatan jika browser tidak mendukung WebAuthn */}
            {!isBiometricSupported && (
              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs text-center space-y-1">
                <p className="font-bold">Browser Tidak Mendukung Biometrik</p>
                <p className="text-[11px] text-slate-500">
                  Gunakan Google Chrome Android versi terbaru atau gunakan metode Pindai QR Code di bawah.
                </p>
              </div>
            )}

            {/* Action Buttons (Touch standard min 44-48px) */}
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <Button
                variant="primary"
                disabled={!isInsideGeofence || isVerifyingBio}
                onClick={isEnrolled ? handleTriggerBiometricAttendance : handleEnrollBiometric}
                leftIcon={<FingerprintIcon className="w-5 h-5 text-white shrink-0" />}
                className="w-full py-3.5 text-xs font-black min-h-12 bg-[#0D7A5F] hover:bg-[#095744] shadow-md shadow-emerald-700/20 cursor-pointer"
              >
                {isVerifyingBio
                  ? 'MEMPROSES SENSOR...'
                  : isEnrolled
                  ? 'ABSEN DENGAN SIDIK JARI'
                  : 'DAFTARKAN & ABSEN SEKARANG'}
              </Button>

              {/* Tombol Recovery: Daftar Ulang Sidik Jari jika sebelumnya gagal atau ganti PIN/perangkat */}
              {(isEnrolled || bioError) && (
                <button
                  type="button"
                  disabled={isVerifyingBio}
                  onClick={handleResetAndReEnroll}
                  className="w-full py-2.5 px-3 rounded-xl border border-amber-300 bg-amber-50/70 hover:bg-amber-100 active:scale-98 text-amber-900 text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer min-h-11"
                  title="Gunakan ini jika sidik jari tidak merespons atau Anda baru mengubah kunci layar HP"
                >
                  <span>🔄</span>
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
                className="w-full py-2.5 px-3 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-98 text-slate-700 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer min-h-11 shadow-2xs"
              >
                <span>📷</span>
                <span>Beralih ke Scan QR Code</span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer min-h-10"
              >
                Batal
              </button>
            </div>
          </>
        )}
        </div>
      </Modal>
    </>
  );
};
