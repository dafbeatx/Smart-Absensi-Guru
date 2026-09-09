import React, { useState } from 'react';
import {
  FileText,
  Clock,
  BellRing,
  AlertTriangle,
  CheckCircle2,
  X,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { AttendancePolicyService } from '../../../services/attendance-policy.service';
import { SoundService } from '../../../services/audio.service';
import type { UserProfile } from '../../../types/database.types';

export interface AttendancePolicyAgreementModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  onAgreed?: () => void;
}

export const AttendancePolicyAgreementModal: React.FC<AttendancePolicyAgreementModalProps> = ({
  isOpen,
  onClose,
  user,
  onAgreed,
}) => {
  const isAlreadyAgreed = AttendancePolicyService.isPolicyAgreed(user?.id);
  const [isChecked, setIsChecked] = useState(isAlreadyAgreed);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirmAgreement = async () => {
    if (!isChecked || !user?.id) return;
    setIsSubmitting(true);
    try {
      await AttendancePolicyService.savePolicyAgreement(user.id, true);
      SoundService.play('SUCCESS');
      onAgreed?.();
      onClose();
    } catch {
      SoundService.play('ERROR');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/70 backdrop-blur-xs transition-opacity duration-200 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="policy-modal-title"
    >
      {/* Backdrop Click Dismiss */}
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      {/* Modal Container */}
      <div className="relative w-full max-w-125 bg-white rounded-t-[28px] sm:rounded-[28px] shadow-2xl border border-slate-200/90 flex flex-col max-h-[92vh] sm:max-h-[88vh] z-10 overflow-hidden">
        {/* Mobile Pull Handle */}
        <div className="pt-2.5 pb-1 flex justify-center sm:hidden shrink-0 bg-white">
          <div className="w-12 h-1.5 rounded-full bg-slate-300" />
        </div>

        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-3.5 bg-white border-b border-slate-200/80 shrink-0">
          <div className="flex items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-2xl bg-linear-to-br from-[#023246] to-[#18536B] text-white flex items-center justify-center shadow-xs shrink-0 ring-2 ring-slate-100">
                <ShieldAlert className="w-5 h-5 text-amber-300" />
              </div>
              <div className="min-w-0 flex-1">
                <h3
                  id="policy-modal-title"
                  className="text-sm sm:text-base font-black text-[#023246] tracking-tight truncate leading-tight"
                >
                  Pakta Integritas Presensi
                </h3>
                <p className="text-[11px] text-slate-500 font-medium truncate">
                  Kebijakan Wajib Presensi Datang &amp; Pulang Sekolah
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center transition-all cursor-pointer shrink-0"
              aria-label="Tutup"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Policy Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3.5 overscroll-contain text-xs text-slate-700 leading-relaxed">
          {/* Official Callout */}
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/90 text-amber-950 space-y-1">
            <div className="flex items-center gap-1.5 font-bold text-amber-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Pemberitahuan Manajemen Disiplin Sekolah</span>
            </div>
            <p className="text-[11.5px] text-amber-900/90 leading-relaxed">
              Banyak tenaga pendidik yang hadir mengajar di pagi hari namun mengabaikan presensi kepulangan. Kebijakan ini diberlakukan demi menjamin akuntabilitas jam kerja efektif dan keadilan poin apresiasi.
            </p>
          </div>

          {/* Clauses List */}
          <div className="space-y-3">
            {/* Poin 1 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-[#023246] font-extrabold text-xs">
                <FileText className="w-4 h-4 text-cyan-800 shrink-0" />
                <span>1. Kewajiban Presensi Dua Arah</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Kehadiran dinas harian hanya diakui <strong>100% sah</strong> jika guru memiliki catatan <strong>Presensi Masuk (Check-in)</strong> dan <strong>Presensi Pulang (Check-out)</strong> pada hari yang sama.
              </p>
            </div>

            {/* Poin 2 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-[#023246] font-extrabold text-xs">
                <Clock className="w-4 h-4 text-emerald-700 shrink-0" />
                <span>2. Jam Kepulangan Resmi Sekolah</span>
              </div>
              <ul className="text-[11px] text-slate-600 space-y-1 list-disc pl-4">
                <li>
                  <strong>Senin s/d Kamis:</strong> Jam pulang resmi pukul <strong>13:00 WIB</strong>.
                </li>
                <li>
                  <strong>Jum&apos;at:</strong> Jam pulang resmi pukul <strong>11:00 WIB</strong>.
                </li>
              </ul>
            </div>

            {/* Poin 3 */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-1.5">
              <div className="flex items-center gap-2 text-[#023246] font-extrabold text-xs">
                <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
                <span>3. Pengingat Otomatis 1 Jam Sebelumnya (Peringatan 1x)</span>
              </div>
              <p className="text-[11px] text-slate-600">
                Sistem mengirimkan alarm dan notifikasi ke HP Anda tepat 1 jam sebelum kepulangan (pukul <strong>12:00 WIB</strong> di hari Senin–Kamis dan pukul <strong>10:00 WIB</strong> di hari Jum&apos;at) agar tidak lupa sebelum meninggalkan area sekolah.
              </p>
            </div>

            {/* Poin 4 */}
            <div className="p-3.5 rounded-2xl bg-red-50/70 border border-red-200 space-y-1.5">
              <div className="flex items-center gap-2 text-red-900 font-extrabold text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
                <span>4. Konsekuensi Pengurangan Poin Kedisiplinan</span>
              </div>
              <p className="text-[11px] text-red-950 leading-relaxed">
                Apabila guru telah hadir namun <strong>tidak melakukan presensi pulang</strong> hingga hari dinas berganti, sistem otomatis mengenakan <strong>Pengurangan 10 Poin Kedisiplinan (-10 PTS)</strong>. Penalti ini akan menurunkan posisi Anda pada <em>Leaderboard Pendidik Teladan Bulanan</em>.
              </p>
            </div>
          </div>

          {/* Interactive Checkbox Agreement */}
          <div className="pt-2 border-t border-slate-200/80">
            <label
              htmlFor="agree-policy-checkbox"
              className={`flex items-start gap-3 p-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                isChecked
                  ? 'bg-emerald-50/70 border-emerald-500/80 text-emerald-950'
                  : 'bg-white border-slate-300 hover:border-slate-400 text-slate-800'
              }`}
            >
              <input
                id="agree-policy-checkbox"
                type="checkbox"
                checked={isChecked}
                onChange={(e) => setIsChecked(e.target.checked)}
                className="mt-0.5 w-5 h-5 rounded-md text-[#023246] focus:ring-[#023246] border-slate-300 cursor-pointer shrink-0"
              />
              <div className="min-w-0 flex-1 text-[11.5px] font-semibold leading-relaxed">
                <span>Saya telah membaca, memahami, dan <strong>MENYETUJUI</strong> Kebijakan Disiplin Absensi Datang &amp; Pulang ini, serta bersedia menerima konsekuensi <strong>pengurangan 10 poin</strong> jika mengabaikan jam kepulangan sekolah.</span>
              </div>
            </label>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200/80 shrink-0 space-y-2">
          <button
            type="button"
            disabled={!isChecked || isSubmitting}
            onClick={handleConfirmAgreement}
            className={`w-full h-12 rounded-2xl text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 transition-all shadow-md ${
              isChecked && !isSubmitting
                ? 'bg-[#023246] hover:bg-[#034560] text-white active:scale-98 cursor-pointer'
                : 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <span>Menyimpan Persetujuan...</span>
            ) : isAlreadyAgreed ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Persetujuan Sudah Aktif</span>
              </>
            ) : (
              <>
                <span>Setujui &amp; Terapkan Komitmen Kedisiplinan</span>
                <ArrowRight className="w-4 h-4 text-cyan-300" />
              </>
            )}
          </button>

          <p className="text-[10px] text-center text-slate-400 font-medium">
            Pakta integritas terverifikasi secara resmi oleh Sistem Keamanan Absensi Sekolah
          </p>
        </div>
      </div>
    </div>
  );
};
