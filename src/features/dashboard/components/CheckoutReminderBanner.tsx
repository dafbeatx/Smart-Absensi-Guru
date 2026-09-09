import React from 'react';
import { Clock, AlertTriangle, Fingerprint, QrCode, ShieldCheck, FileText } from 'lucide-react';
import { getCurrentTimeInJakarta } from '../../../utils/time.utils';
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

  const now = new Date();
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return null; // Akhir pekan
  }

  const isFriday = dayOfWeek === 5;
  const currentTime = getCurrentTimeInJakarta(); // Format "HH:mm"

  // Jam Target Pulang Resmi
  const targetCheckoutTime = isFriday
    ? settings?.friday_checkout_start || '11:00'
    : settings?.work_checkout_start || '13:00';

  // Jam Peringatan 1 Jam Sebelumnya (Jumat: 10:00, Senin-Kamis: 12:00)
  const earlyWarningThreshold = isFriday ? '10:00' : '12:00';

  // Periksa apakah waktu saat ini sudah memasuki window peringatan (>= threshold)
  if (currentTime < earlyWarningThreshold) {
    return null;
  }

  const isOverdue = currentTime >= targetCheckoutTime;
  const isAgreed = AttendancePolicyService.isPolicyAgreed(userId);

  return (
    <div
      className={`rounded-2xl sm:rounded-3xl p-4 sm:p-4.5 border transition-all duration-300 shadow-sm relative overflow-hidden ${
        isOverdue
          ? 'bg-linear-to-r from-red-500/10 via-white to-amber-500/10 border-red-300/90 text-red-950'
          : 'bg-linear-to-r from-amber-500/10 via-white to-yellow-500/10 border-amber-300/90 text-amber-950'
      }`}
    >
      {/* Background Accent Lines */}
      <div className="absolute -right-8 -top-8 w-28 h-28 rounded-full bg-amber-400/10 blur-xl pointer-events-none" />

      <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
        {/* Left: Icon & Message */}
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div
            className={`w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-xs ring-2 ${
              isOverdue
                ? 'bg-red-600 text-white ring-red-100 animate-pulse'
                : 'bg-amber-500 text-white ring-amber-100'
            }`}
          >
            {isOverdue ? <AlertTriangle className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  isOverdue
                    ? 'bg-red-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {isOverdue ? 'Wajib Pulang Sekarang' : 'Peringatan 1 Jam Pulang'}
              </span>

              <span className="text-[11px] font-bold text-slate-500">
                Kepulangan Resmi: {targetCheckoutTime} WIB
              </span>
            </div>

            <h4 className="text-xs sm:text-sm font-black text-[#023246] tracking-tight mt-1 leading-snug">
              {isOverdue
                ? '⚠️ Anda Belum Melakukan Absen Pulang!'
                : `⏰ Waktu Pulang Segera Tiba (Pukul ${targetCheckoutTime} WIB)`}
            </h4>

            <p className="text-[11px] text-slate-600 leading-relaxed mt-0.5">
              {isOverdue
                ? 'Waktu kepulangan resmi telah lewat. Segera lakukan presensi pulang agar tidak terkena pemotongan 10 poin disiplin.'
                : 'Pastikan Anda melakukan Presensi Pulang sebelum meninggalkan area sekolah agar kehadiran hari ini diakui utuh.'}
            </p>

            {/* Syarat & Ketentuan Status */}
            <div className="pt-1.5 flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenPolicyModal}
                className="inline-flex items-center gap-1 text-[10.5px] font-extrabold text-[#023246] hover:underline cursor-pointer"
              >
                {isAgreed ? (
                  <>
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span className="text-emerald-800">Pakta Integritas Disiplin Aktif</span>
                  </>
                ) : (
                  <>
                    <FileText className="w-3.5 h-3.5 text-amber-700" />
                    <span className="text-amber-900 underline decoration-amber-400">
                      Baca &amp; Setujui Syarat &amp; Ketentuan Presensi →
                    </span>
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
            className="flex-1 sm:flex-initial h-10 px-3.5 rounded-xl bg-[#023246] hover:bg-[#034560] active:scale-95 text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-xs cursor-pointer"
            title="Presensi Pulang Cepat via Sidik Jari HP"
          >
            <Fingerprint className="w-4 h-4 text-cyan-300" />
            <span>Sidik Jari</span>
          </button>

          <button
            type="button"
            onClick={onOpenScanner}
            className="flex-1 sm:flex-initial h-10 px-3 rounded-xl bg-white hover:bg-slate-50 active:scale-95 text-slate-700 hover:text-[#023246] border border-slate-300 text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-2xs cursor-pointer"
            title="Presensi Pulang via Scan QR Kamera"
          >
            <QrCode className="w-4 h-4 text-slate-500" />
            <span>Scan QR</span>
          </button>
        </div>
      </div>
    </div>
  );
};
