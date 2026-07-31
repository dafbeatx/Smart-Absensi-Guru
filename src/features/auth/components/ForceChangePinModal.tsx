import React, { useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { AuthRepository } from '../../../repositories/AuthRepository';
import { Button } from '../../../components/ui/Button';

export const ForceChangePinModal: React.FC = () => {
  const { user, token, updateUserProfile, logout } = useAuthStore();
  const { showToast } = useToastStore();

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!user || !user.must_change_pin) {
    return null;
  }

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanNewPin = newPin.trim();
    const cleanConfirmPin = confirmPin.trim();

    if (!/^\d{6}$/.test(cleanNewPin)) {
      setErrorMsg('PIN baru harus terdiri dari 6 digit angka.');
      return;
    }

    if (cleanNewPin === '123456') {
      setErrorMsg('PIN baru tidak boleh menggunakan PIN default (123456).');
      return;
    }

    if (cleanNewPin !== cleanConfirmPin) {
      setErrorMsg('Konfirmasi PIN baru tidak cocok.');
      return;
    }

    setIsSubmitting(true);

    try {
      await AuthRepository.changePin(user.id, cleanNewPin, token || '');

      // Update state local store
      updateUserProfile({ must_change_pin: false });

      showToast(
        'success',
        'PIN Berhasil Diperbarui!',
        'PIN 6-digit baru Anda telah disimpan. Selamat datang di Smart Absensi Guru.'
      );
    } catch (err: any) {
      const msg = err?.message || 'Gagal memperbarui PIN. Silakan coba lagi.';
      setErrorMsg(msg);
      showToast('error', 'Gagal Memperbarui PIN', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in fade-in zoom-in duration-200">
        {/* Header Badge */}
        <div className="flex items-center gap-3.5 border-b border-slate-100 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600 text-xl font-bold">
            🔑
          </div>
          <div>
            <h3 className="font-extrabold text-slate-900 text-base">Buat PIN Baru Pertama Kali</h3>
            <p className="text-xs font-medium text-slate-500">Pengaturan Keamanan Akun Guru</p>
          </div>
        </div>

        {/* Warning Banner */}
        <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200/60 text-amber-900 text-xs leading-relaxed space-y-1">
          <p className="font-bold flex items-center gap-1.5 text-amber-800">
            <span>ℹ️</span> Peringatan Keamanan
          </p>
          <p>
            Akun Anda saat ini menggunakan PIN awal sementara (<strong>123456</strong>). Untuk keamanan akun Anda, silakan tentukan 6-digit PIN rahasia baru Anda sebelum melanjutkan.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSavePin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              PIN Baru 6-Digit <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Masukkan 6 angka PIN baru"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono tracking-widest text-center text-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Konfirmasi PIN Baru <span className="text-rose-500">*</span>
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              placeholder="Ulangi 6 angka PIN baru"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono tracking-widest text-center text-lg focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
              required
              disabled={isSubmitting}
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
              {errorMsg}
            </div>
          )}

          <div className="pt-2 space-y-2">
            <Button
              type="submit"
              variant="primary"
              className="w-full py-3 text-sm font-bold shadow-lg shadow-emerald-500/20"
              isLoading={isSubmitting}
              disabled={isSubmitting || newPin.length !== 6 || confirmPin.length !== 6}
            >
              {isSubmitting ? 'Menyimpan PIN Baru...' : 'Simpan PIN Baru & Lanjutkan'}
            </Button>

            <button
              type="button"
              onClick={logout}
              className="w-full py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
            >
              Batal & Logout
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
