import React, { useState } from 'react';
import { Modal } from '../../../components/ui/Modal';
import { BiometricService } from '../../../services/biometric.service';
import { SoundService } from '../../../services/audio.service';
import { useToastStore } from '../../../store/useToastStore';
import { Fingerprint, Zap, ShieldCheck, CheckCircle2, AlertCircle, RefreshCw, Sparkles } from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';

export interface BiometricEnrollmentPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  user: UserProfile;
}

export const BiometricEnrollmentPromptModal: React.FC<BiometricEnrollmentPromptModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  user,
}) => {
  const { showToast } = useToastStore();
  const [isRegistering, setIsRegistering] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);
  const isWebView = BiometricService.isWebViewOrInAppBrowser();

  const handleRegisterBiometric = async () => {
    if (!user?.id) return;
    setIsRegistering(true);
    setErrorMsg(null);

    try {
      // Bersihkan credential lama jika ada agar registrasi bersih
      BiometricService.resetBiometricEnrollment(user.id);

      const res = await BiometricService.registerBiometric(user.id, user.full_name);
      if (res.success) {
        setIsSuccess(true);
        SoundService.play('SUCCESS');
        showToast(
          'success',
          'Sidik Jari Berhasil Didaftarkan!',
          'Mulai sekarang Anda dapat melakukan presensi instan hanya dengan 1 sentuhan jari.'
        );
        onSuccess();
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setErrorMsg(res.error || 'Pendaftaran sidik jari belum berhasil. Pastikan sensor sidik jari HP Anda aktif.');
        SoundService.play('ERROR');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(`Gagal mendaftarkan sidik jari: ${msg}`);
      SoundService.play('ERROR');
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Daftarkan Sidik Jari HP"
      maxWidth="md"
    >
      <div className="space-y-4 py-1">
        {/* Banner WebView jika terdeteksi */}
        {isWebView && (
          <div className="p-3 rounded-2xl bg-amber-50 border border-amber-300 text-amber-950 text-xs flex items-start gap-2.5">
            <span className="text-base shrink-0 mt-0.5">⚠️</span>
            <div className="space-y-1">
              <p className="font-bold text-amber-900">Perhatian: Browser Internal WhatsApp</p>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Anda membuka aplikasi melalui WhatsApp. Jika sensor sidik jari tidak merespons,
                silakan buka tautan di aplikasi <strong>Google Chrome</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Banner Ilustrasi Sensor Sidik Jari */}
        <div className="text-center space-y-2.5 p-4 rounded-3xl bg-linear-to-b from-[#18536B]/10 to-[#023246]/5 border border-cyan-200/60">
          <div className="relative w-16 h-16 mx-auto rounded-3xl bg-linear-to-b from-[#18536B] to-[#023246] text-white flex items-center justify-center shadow-md ring-4 ring-cyan-50">
            <Fingerprint className="w-9 h-9 stroke-[1.8] text-cyan-300" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] ring-2 ring-white font-black">
              <Sparkles className="w-3 h-3" />
            </span>
          </div>

          <div>
            <h3 className="text-base font-black text-[#023246] tracking-tight">
              HP Anda Mendukung Sidik Jari!
            </h3>
            <p className="text-xs text-slate-600 font-medium mt-0.5">
              Halo Bapak/Ibu <b>{user.full_name}</b>, aktifkan verifikasi biometrik untuk pengalaman presensi sekolah yang lebih cepat dan nyaman.
            </p>
          </div>
        </div>

        {/* Keunggulan Fitur Sidik Jari */}
        <div className="space-y-2.5">
          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200 mt-0.5">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#023246]">Absensi Instan 1 Sentuhan</h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Tidak perlu antre atau membuka kamera untuk scan poster QR code. Cukup tempelkan jari pada sensor HP Anda di sekolah.
              </p>
            </div>
          </div>

          <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs flex items-start gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0 border border-emerald-200 mt-0.5">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-[#023246]">Privasi Terjaga di Hardware HP (FIDO2)</h4>
              <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                Data fisik sidik jari Anda disimpan secara terenkripsi di Secure Enclave HP Anda dan <b>tidak pernah dikirim ke server</b>.
              </p>
            </div>
          </div>
        </div>

        {/* Pesan Kesalahan Jika Terjadi Kendala */}
        {errorMsg && (
          <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200/80 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-bold block">Pendaftaran Belum Selesai:</span>
              <p className="text-[11px] font-mono leading-relaxed">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Status Berhasil */}
        {isSuccess && (
          <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2.5 font-bold animate-fadeIn">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>Pendaftaran Berhasil! Menutup jendela...</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <button
            type="button"
            disabled={isRegistering}
            onClick={onClose}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 text-xs font-bold transition-all cursor-pointer min-h-11 border border-slate-200"
          >
            Nanti Saja
          </button>

          <button
            type="button"
            disabled={isRegistering || isSuccess}
            onClick={handleRegisterBiometric}
            className={`w-full sm:flex-1 py-2.5 px-4 rounded-xl text-xs font-extrabold transition-all flex items-center justify-center gap-2 min-h-11 shadow-xs ${
              isRegistering || isSuccess
                ? 'bg-slate-200 text-slate-400 border border-slate-300 cursor-not-allowed'
                : 'bg-[#023246] hover:bg-[#034560] text-white active:scale-98 cursor-pointer'
            }`}
          >
            {isRegistering ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Menghubungkan ke Sensor HP...</span>
              </>
            ) : isSuccess ? (
              <>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>Terdaftar!</span>
              </>
            ) : (
              <>
                <Fingerprint className="w-4 h-4 text-cyan-300" />
                <span>Daftarkan Sidik Jari Sekarang</span>
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
};
