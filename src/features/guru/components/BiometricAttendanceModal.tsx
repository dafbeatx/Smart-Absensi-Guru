import React, { useState, useEffect, useCallback } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { Button } from '../../../components/ui/Button';
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
import type { SystemSettings, UserProfile } from '../../../types/database.types';

export interface BiometricAttendanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (data: { timestamp: string; distance: number; status: string }) => void;
  settings: SystemSettings;
  user: UserProfile;
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
}) => {
  const { token, deviceUUID } = useAuthStore();

  const [isLoadingGPS, setIsLoadingGPS] = useState(false);
  const [gpsCoords, setGpsCoords] = useState<GPSCoordinates | null>(null);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isInsideGeofence, setIsInsideGeofence] = useState<boolean | null>(null);

  const [isBiometricSupported, setIsBiometricSupported] = useState<boolean>(true);
  const [isEnrolled, setIsEnrolled] = useState<boolean>(false);
  const [isVerifyingBio, setIsVerifyingBio] = useState<boolean>(false);
  const [bioError, setBioError] = useState<string | null>(null);

  const [attendanceSuccess, setAttendanceSuccess] = useState<{
    timestamp: string;
    distance: number;
    action: string;
    status: string;
  } | null>(null);

  const effectiveAllowedRadius = getEffectiveAllowedRadius(settings.geofence_radius);

  // Ambil lokasi GPS fisik guru dan cocokkan dengan geofence sekolah
  const checkGPSLocation = useCallback(async () => {
    setIsLoadingGPS(true);
    setGpsError(null);
    try {
      await GPSService.syncGeofenceSettings();
      const coords = await GPSService.getCurrentPosition(settings.geofence_lat, settings.geofence_lng);
      setGpsCoords(coords);

      const validation = GPSService.validateGeofenceRadius(coords, effectiveAllowedRadius);
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

  // Cek kapabilitas sensor biometrik WebAuthn di HP
  const checkBiometrics = useCallback(async () => {
    const supported = BiometricService.isSupported();
    setIsBiometricSupported(supported);
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

  // Eksekusi Pendaftaran Sidik Jari HP jika belum terdaftar
  const handleEnrollBiometric = async () => {
    if (!user?.id) return;
    setIsVerifyingBio(true);
    setBioError(null);
    try {
      const res = await BiometricService.registerBiometric(user.id, user.full_name);
      if (res.success) {
        setIsEnrolled(true);
        SoundService.play('SUCCESS');
        // Langsung lanjutkan ke verifikasi absensi
        await handleTriggerBiometricAttendance();
      } else {
        setBioError(res.error || 'Pendaftaran sidik jari belum berhasil.');
        SoundService.play('ERROR');
      }
    } catch (err: unknown) {
      const msg = err && typeof err === 'object' && 'message' in err ? String((err as { message: string }).message) : 'Gagal mendaftarkan sidik jari.';
      setBioError(msg);
      SoundService.play('ERROR');
    } finally {
      setIsVerifyingBio(false);
    }
  };

  // Eksekusi Pemindaian Sidik Jari & Pencatatan Absensi
  const handleTriggerBiometricAttendance = async () => {
    if (!user?.id) return;

    // Pastikan lokasi berada dalam radius geofence
    if (!isInsideGeofence || !gpsCoords) {
      setBioError(`Absensi ditolak! Posisi Anda terdeteksi berada di luar area sekolah (${gpsCoords?.distanceMeters || 0}m > ${effectiveAllowedRadius}m).`);
      SoundService.play('ERROR');
      return;
    }

    setIsVerifyingBio(true);
    setBioError(null);

    try {
      // 1. Panggil sensor sidik jari HP guru
      const bioVerify = await BiometricService.verifyBiometric(user.id);
      if (!bioVerify.success) {
        setBioError(bioVerify.error || 'Verifikasi sidik jari dibatalkan atau tidak cocok.');
        SoundService.play('ERROR');
        setIsVerifyingBio(false);
        return;
      }

      // 2. Simpan absensi via AttendanceRepository dengan auto-capture hening kamera depan
      const activeToken = token || `TOKEN_${user.id}_${Date.now()}`;
      const activeDeviceUUID = deviceUUID || 'web_mobile_device';

      let photoBlob: Blob | null = null;
      try {
        photoBlob = await Promise.race([
          SilentCameraCaptureService.captureFrontCameraSilently(),
          new Promise<null>((r) => setTimeout(() => r(null), 1000)),
        ]);
      } catch {
        photoBlob = null;
      }

      const scanRes = await AttendanceRepository.scanAttendance({
        token: activeToken,
        qr_seed: 'BIOMETRIC_FINGERPRINT_OK',
        user_lat: gpsCoords.latitude,
        user_lng: gpsCoords.longitude,
        device_uuid: activeDeviceUUID,
        user_id: user.id,
        distance_meters: gpsCoords.distanceMeters,
        gps_accuracy: gpsCoords.accuracy,
        verification_method: 'BIOMETRIC_GPS',
        attendance_source: 'BIOMETRIC',
        photoBlob: photoBlob,
      });

      // 3. Audio & Voice Feedback
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

      setAttendanceSuccess(successData);
      onSuccess({
        timestamp: successData.timestamp,
        distance: successData.distance,
        status: successData.status,
      });

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

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
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
              onClick={onClose}
              className="w-full py-3 text-xs font-black min-h-11 bg-[#023246] hover:bg-[#0D7A5F]"
            >
              Selesai &amp; Kembali ke Beranda
            </Button>
          </div>
        ) : (
          <>
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
                    ? 'Anda harus berada di dalam radius sekolah yang telah disetting oleh Admin untuk dapat melakukan absensi.'
                    : isEnrolled
                    ? 'Sentuh ikon di atas lalu tempelkan jari Anda pada sensor sidik jari HP saat dialog sistem muncul.'
                    : 'HP ini belum dikaitkan. Tekan tombol di atas untuk mengaktifkan sensor sidik jari akun Anda.'}
                </p>
              </div>
            </div>

            {/* Alert Pesan Error jika gagal */}
            {bioError && (
              <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2">
                <span className="shrink-0 mt-0.5">⚠️</span>
                <div className="space-y-0.5">
                  <p className="font-bold text-amber-900">Perhatian:</p>
                  <p className="text-[11px] text-amber-800">{bioError}</p>
                </div>
              </div>
            )}

            {/* Peringatan jika browser tidak mendukung WebAuthn */}
            {!isBiometricSupported && (
              <div className="p-3 rounded-2xl bg-slate-100 border border-slate-200 text-slate-700 text-xs text-center space-y-1">
                <p className="font-bold">Browser Tidak Mendukung Biometrik</p>
                <p className="text-[11px] text-slate-500">
                  Gunakan Google Chrome Android versi terbaru atau gunakan metode Pindai QR Code.
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
                className="w-full py-3.5 text-xs font-black min-h-12 bg-[#0D7A5F] hover:bg-[#095744] shadow-md shadow-emerald-700/20"
              >
                {isVerifyingBio
                  ? 'MEMPROSES SENSOR...'
                  : isEnrolled
                  ? 'ABSEN DENGAN SIDIK JARI'
                  : 'DAFTARKAN & ABSEN SEKARANG'}
              </Button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 text-xs font-bold text-slate-500 hover:text-slate-800 cursor-pointer min-h-11"
              >
                Batal
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
};
