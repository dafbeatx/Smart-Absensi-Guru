import React, { useState, useEffect, useRef } from 'react';
import { Eye, EyeOff, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { AuthRepository } from '../../../repositories/AuthRepository';
import { Button } from '../../../components/ui/Button';

export const ForceChangePinModal: React.FC = () => {
  const { user, token, updateUserProfile, logout } = useAuthStore();
  const { showToast } = useToastStore();

  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showNewPin, setShowNewPin] = useState(false);
  const [showConfirmPin, setShowConfirmPin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const isMustChangePin = Boolean(user && user.must_change_pin);

  // Lock body scroll when mandatory PIN reset sheet is active
  useEffect(() => {
    if (!isMustChangePin) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isMustChangePin]);

  if (!isMustChangePin || !user) {
    return null;
  }

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmittingRef.current || isSubmitting) return;

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

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    try {
      await AuthRepository.changePin(user.id, cleanNewPin, token || '');

      // Re-verify against server when available so client state stays 100% synced with DB
      try {
        if (token) {
          const refreshed = await AuthRepository.verifySession(token);
          if (refreshed && !refreshed.must_change_pin) {
            updateUserProfile({ must_change_pin: false });
          } else {
            updateUserProfile({ must_change_pin: false });
          }
        } else {
          updateUserProfile({ must_change_pin: false });
        }
      } catch {
        updateUserProfile({ must_change_pin: false });
      }

      setNewPin('');
      setConfirmPin('');

      showToast(
        'success',
        'PIN Berhasil Diperbarui!',
        'PIN 6-digit baru Anda telah disimpan di server. Selamat datang di Smart Absensi Guru.'
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Gagal memperbarui PIN. Silakan coba lagi.';
      setErrorMsg(msg);
      showToast('error', 'Gagal Memperbarui PIN', msg);
    } finally {
      isSubmittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/85 md:backdrop-blur-md flex items-center justify-center md:p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="force-pin-title"
    >
      {/* Mobile Full-Screen 100dvh Sheet (Infinix Note 8 standard) / Centered Card on Desktop */}
      <div className="w-full h-dvh md:h-auto md:max-h-[90vh] md:max-w-md bg-white md:rounded-3xl shadow-2xl border-0 md:border md:border-slate-100 flex flex-col overflow-hidden">
        {/* 1. STICKY HEADER */}
        <header className="h-16 px-4 sm:px-6 bg-white/95 backdrop-blur-md border-b border-slate-100 flex items-center gap-3.5 shrink-0 sticky top-0 z-20 pt-[env(safe-area-inset-top)]">
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <KeyRound className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <h3 id="force-pin-title" className="font-extrabold text-slate-900 text-base truncate">
              Buat PIN Pribadi Anda
            </h3>
            <p className="text-xs font-medium text-slate-500 truncate">
              Cukup diatur 1 kali agar akun aman
            </p>
          </div>
        </header>

        {/* 2. SCROLLABLE WORKSPACE */}
        <main className="flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:p-6">
          <div className="w-full max-w-md mx-auto space-y-5">
            {/* Friendly Guidance Banner */}
            <div className="p-4 rounded-2xl bg-sky-50 border border-sky-200 text-slate-800 text-xs leading-relaxed space-y-1.5">
              <p className="font-bold flex items-center gap-1.5 text-[#023246]">
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600" />
                <span>Silakan Buat 6 Angka PIN Baru</span>
              </p>
              <p>
                Akun Anda masih memakai PIN bawaan (<strong>123456</strong> / hasil reset). Buat 6 angka PIN rahasia yang mudah diingat (misalnya tanggal lahir <strong>DDMMYY</strong>) lalu catat di catatan pribadi Anda.
              </p>
            </div>

            {/* Form */}
            <form id="force-change-pin-form" onSubmit={handleSavePin} className="space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="force-new-pin" className="text-xs font-bold text-slate-700">
                    PIN Baru 6-Digit <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowNewPin((prev) => !prev)}
                    className="text-[11px] font-bold text-[#023246] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showNewPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showNewPin ? 'Sembunyikan' : 'Lihat Angka'}</span>
                  </button>
                </div>
                <input
                  id="force-new-pin"
                  type={showNewPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  maxLength={6}
                  placeholder="Masukkan 6 angka PIN baru"
                  value={newPin}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  className="w-full min-h-12 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono tracking-widest text-center text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label htmlFor="force-confirm-pin" className="text-xs font-bold text-slate-700">
                    Ulangi PIN Baru <span className="text-rose-500">*</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin((prev) => !prev)}
                    className="text-[11px] font-bold text-[#023246] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    {showConfirmPin ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    <span>{showConfirmPin ? 'Sembunyikan' : 'Lihat Angka'}</span>
                  </button>
                </div>
                <input
                  id="force-confirm-pin"
                  type={showConfirmPin ? 'text' : 'password'}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="new-password"
                  maxLength={6}
                  placeholder="Ketik ulang 6 angka yang sama"
                  value={confirmPin}
                  onChange={(e) => {
                    setErrorMsg(null);
                    setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  className="w-full min-h-12 px-4 py-2.5 rounded-xl border border-slate-300 text-slate-900 font-mono tracking-widest text-center text-base sm:text-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-all"
                  required
                  disabled={isSubmitting}
                />
                {newPin.length === 6 && confirmPin.length === 6 && (
                  <p className={`text-[11px] font-bold mt-1.5 ${newPin === confirmPin ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {newPin === confirmPin
                      ? '✓ Kedua PIN sudah cocok. Tekan tombol Simpan di bawah.'
                      : 'PIN yang diulang belum sama dengan PIN pertama.'}
                  </p>
                )}
              </div>

              {errorMsg && (
                <div role="alert" className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                  {errorMsg}
                </div>
              )}
            </form>
          </div>
        </main>

        {/* 3. STICKY ACTION BAR (THUMB ZONE - Selalu terlihat di atas keyboard HP) */}
        <footer className="sticky bottom-0 bg-white/95 backdrop-blur-md border-t border-slate-100 p-4 sm:px-6 pb-[max(16px,env(safe-area-inset-bottom))] shrink-0 z-20 space-y-2">
          <Button
            type="submit"
            form="force-change-pin-form"
            variant="primary"
            className="w-full py-3 text-sm font-bold shadow-lg shadow-emerald-500/20"
            isLoading={isSubmitting}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Menyimpan PIN Baru...' : 'Simpan PIN Baru & Masuk'}
          </Button>

          <button
            type="button"
            onClick={logout}
            disabled={isSubmitting}
            className="w-full min-h-11 py-2.5 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
          >
            Batal &amp; Logout
          </button>
        </footer>
      </div>
    </div>
  );
};
