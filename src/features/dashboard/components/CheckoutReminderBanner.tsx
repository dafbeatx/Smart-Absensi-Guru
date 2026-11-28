import React from 'react';
import { ArrowRight } from 'lucide-react';
import {
  SagaClockStatusIcon,
  SagaDeviceShieldIcon,
  SagaEmergencySosIcon,
  SagaFingerprintIcon,
  SagaNotulenIcon,
  SagaScanQrIcon,
} from '../../../components/ui/SagaServiceIcons';
import { getCurrentTimeInJakarta, getJakartaDayOfWeek } from '../../../utils/time.utils';
import { CONSTANTS } from '../../../config/constants';
import { AttendancePolicyService } from '../../../services/attendance-policy.service';
import type { AttendanceRecord, SystemSettings } from '../../../types/database.types';

export interface CheckoutReminderBannerProps {
  todayAttendance: AttendanceRecord | null;
  settings: SystemSettings | null;
  isTodayOff: boolean;
  userId?: string;
  onOpenBiometric: () => void;
  onOpenScanner: () => void;
  onOpenPolicyModal: () => void;
}

export const CheckoutReminderBanner: React.FC<CheckoutReminderBannerProps> = ({
  todayAttendance,
  settings,
  isTodayOff,
  userId,
  onOpenBiometric,
  onOpenScanner,
  onOpenPolicyModal,
}) => {
  // Hanya tampil jika: bukan hari libur, sudah absen masuk, dan BELUM absen pulang
  if (isTodayOff || !todayAttendance?.check_in_time || todayAttendance?.check_out_time) {
    return null;
  }

  const dayOfWeek = getJakartaDayOfWeek();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return null; // Akhir pekan
  }

  const isFriday = dayOfWeek === 5;
  const currentTime = getCurrentTimeInJakarta().slice(0, 5); // Format "HH:mm"

  // Jam Target Pulang Resmi (Dinamis: Senin-Kamis default 13:00 WIB, Jumat default 11:00 WIB)
  const targetCheckoutTime = (isFriday
    ? settings?.reminder_friday_checkout_time || settings?.friday_checkout_start || CONSTANTS.DEFAULTS.REMINDER_FRIDAY_CHECKOUT_TIME || '11:00'
    : settings?.reminder_checkout_time || settings?.work_checkout_start || CONSTANTS.DEFAULTS.REMINDER_CHECKOUT_TIME || '13:00').slice(0, 5);

  // Jam Peringatan 1 Jam Sebelumnya (Dihitung presisi 1 jam sebelum jam kepulangan resmi)
  const [targetH, targetM] = targetCheckoutTime.split(':').map((n) => parseInt(n, 10));
  const earlyH = (targetH - 1 + 24) % 24;
  const earlyWarningThreshold = `${String(earlyH).padStart(2, '0')}:${String(isNaN(targetM) ? 0 : targetM).padStart(2, '0')}`;

  // Periksa apakah waktu saat ini sudah memasuki window peringatan (>= threshold)
  if (currentTime < earlyWarningThreshold) {
    return null;
  }

  const isOverdue = currentTime >= targetCheckoutTime;
  const isAgreed = AttendancePolicyService.isPolicyAgreed(userId);

  return (
    <div
      className={`rounded-2xl p-4 border shadow-xs relative overflow-hidden ${
        isOverdue
          ? 'bg-rose-50 border-rose-200 text-rose-950'
          : 'bg-amber-50 border-amber-200 text-amber-950'
      }`}
    >
      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        {/* Left: Icon & Message */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
              isOverdue ? 'bg-rose-600' : 'bg-amber-600'
            }`}
          >
            {isOverdue ? (
              <SagaEmergencySosIcon tone="dark" className="w-5 h-5" />
            ) : (
              <SagaClockStatusIcon tone="dark" className="w-5 h-5" />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${
                  isOverdue ? 'bg-rose-700 text-white' : 'bg-amber-700 text-white'
                }`}
              >
                {isOverdue ? 'Wajib Pulang Sekarang' : 'Peringatan 1 Jam Pulang'}
              </span>

              <span className="text-xs font-semibold text-slate-600">
                Kepulangan Resmi: {targetCheckoutTime} WIB
              </span>
            </div>

            <h4 className="text-sm font-bold text-slate-900 tracking-tight mt-1 leading-snug">
              {isOverdue
                ? 'Anda Belum Melakukan Absen Pulang'
                : `Waktu Pulang Segera Tiba (Pukul ${targetCheckoutTime} WIB)`}
            </h4>

            <p className="text-xs text-slate-700 leading-relaxed mt-0.5">
              {isOverdue
                ? 'Waktu kepulangan resmi telah lewat. Segera lakukan presensi pulang agar tidak terkena pemotongan 10 poin disiplin.'
                : 'Pastikan Anda melakukan Presensi Pulang sebelum meninggalkan area sekolah agar kehadiran hari ini diakui utuh.'}
            </p>

            {/* Syarat & Ketentuan Status */}
            <div className="pt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenPolicyModal}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0D5C46] hover:underline cursor-pointer min-h-8"
              >
                {isAgreed ? (
                  <>
                    <SagaDeviceShieldIcon className="w-4 h-4 shrink-0" />
                    <span className="text-[#0D5C46]">Pakta Integritas Disiplin Aktif</span>
                  </>
                ) : (
                  <>
                    <SagaNotulenIcon className="w-4 h-4 shrink-0" />
                    <span className="text-amber-900 underline decoration-amber-400">
                      Baca &amp; Setujui Syarat &amp; Ketentuan Presensi
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 shrink-0" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Right: Quick Attendance Buttons */}
        <div className="flex items-center gap-2 shrink-0 pt-1 sm:pt-0">
          <button
            type="button"
            onClick={onOpenBiometric}
            className="flex-1 sm:flex-initial min-h-11 px-4 rounded-xl bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.98] text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Presensi Pulang Cepat via Sidik Jari HP"
          >
            <SagaFingerprintIcon tone="dark" className="w-4 h-4 shrink-0" />
            <span>Sidik Jari</span>
          </button>

          <button
            type="button"
            onClick={onOpenScanner}
            className="flex-1 sm:flex-initial min-h-11 px-3.5 rounded-xl bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            title="Presensi Pulang via Scan QR Kamera"
          >
            <SagaScanQrIcon className="w-4 h-4 shrink-0" />
            <span>Scan QR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
