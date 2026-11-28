import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { detectNativeContainer, getOrCreateDeviceUUID, getDeviceModelString } from '../../../utils/device.utils';
import { validatePIN, validateIdentity } from '../../../utils/validation.utils';
import { AuthRepository } from '../../../repositories/AuthRepository';
import { logger } from '../../../utils/logger.utils';
import { handleAppError, notifySuccess } from '../../../utils/error.utils';
import { TurnstileWidget, type TurnstileWidgetHandle } from '../../../components/ui/TurnstileWidget';
import { TelegramService } from '../../../services/telegram.service';
import { getCurrentTimeInJakarta, getTodayDateInJakarta } from '../../../utils/time.utils';

export const LoginPage: React.FC = () => {
  const [identity, setIdentity] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [pinError, setPinError] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isInAppBrowser] = useState(() => {
    if (typeof navigator === 'undefined') return false;
    const nativeInfo = detectNativeContainer();
    if (nativeInfo.isNative) return false;
    return /WhatsApp|FBAN|FBAV|Instagram|Line\/|TikTok/i.test(navigator.userAgent || '');
  });
  const turnstileRef = useRef<TurnstileWidgetHandle>(null);
  const isSubmittingRef = useRef(false);
  const isMountedRef = useRef(true);

  const { loginSuccess } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.app_name) || 'SMART ABSENSI GURU';
  const institutionName = useSettingsStore((s) => s.settings.institution_name) || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam';

  useEffect(() => {
    isMountedRef.current = true;
    useSettingsStore.getState().loadSettings().catch(() => {});
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const deviceUUID = getOrCreateDeviceUUID();
  const deviceModel = getDeviceModelString();

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleTurnstileError = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Synchronous double-submit & race condition guard (e.g. rapid Enter presses)
    if (isSubmittingRef.current || isLoading) {
      return;
    }

    setIdentityError('');
    setPinError('');
    setErrorMessage(null);

    const identityVal = validateIdentity(identity);
    if (!identityVal.isValid) {
      setIdentityError(identityVal.error?.message || 'Nomor WA atau NPP tidak valid.');
      return;
    }

    const pinVal = validatePIN(pin);
    if (!pinVal.isValid) {
      setPinError(pinVal.error?.message || 'PIN 6-digit tidak valid.');
      return;
    }

    if (!turnstileToken) {
      setErrorMessage(
        'Pengecekan keamanan otomatis belum selesai centang hijau. Tunggu 2 detik, atau klik tombol "Muat Ulang Pengecekan" di atas tombol Masuk.'
      );
      return;
    }

    isSubmittingRef.current = true;
    setIsLoading(true);
    const maskedIdentity = identity.length > 4 ? `${identity.substring(0, 4)}***` : identity;
    logger.info('LoginPage', `Attempting login for identity: ${maskedIdentity}`);

    try {
      const res = await AuthRepository.login({
        identity: identity.trim(),
        pin: pin.trim(),
        device_uuid: deviceUUID,
        device_model: deviceModel,
        turnstile_token: turnstileToken,
      });

      logger.info('LoginPage', `Login successful for user: ${res.user.full_name} (${res.user.role})`);
      notifySuccess('Login Berhasil!', `Selamat datang kembali, ${res.user.full_name}`);
      loginSuccess(res.token, res.user);

      // Dispatch Telegram web login notification (non-blocking)
      TelegramService.sendWebLoginNotification({
        teacherName: res.user.full_name,
        nip: res.user.nip || undefined,
        role: res.user.role,
        device: deviceModel || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser'),
        timeStr: getCurrentTimeInJakarta(),
        dateStr: getTodayDateInJakarta(),
      }).catch((err) => console.warn('Telegram login notification error:', err));
    } catch (err: unknown) {
      // Single-use Turnstile token lifecycle: always reset widget and clear token after failed/network-error login
      turnstileRef.current?.reset();
      if (isMountedRef.current) {
        setTurnstileToken(null);
        const cleanMsg = handleAppError(err, 'LoginPage', 'Kendala Login', false);
        setErrorMessage(cleanMsg);
      }
    } finally {
      isSubmittingRef.current = false;
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  return (
    <div className="min-h-dvh w-full bg-white sm:bg-slate-100 flex flex-col justify-start sm:justify-center items-center p-0 sm:p-4 overflow-y-auto">
      <div className="w-full min-h-dvh sm:min-h-0 sm:max-w-md bg-white px-4 py-6 sm:p-8 sm:rounded-3xl sm:border sm:border-slate-200 sm:shadow-xl flex flex-col justify-between sm:justify-start gap-6 pb-[max(24px,env(safe-area-inset-bottom))]">
        <div className="w-full max-w-md mx-auto space-y-6">
          {/* Branding Hierarchy */}
          <div className="text-center space-y-2 pt-2 sm:pt-0">
            <div className="w-16 h-16 bg-white p-1 rounded-2xl mx-auto flex items-center justify-center shadow-lg border border-slate-200 ring-4 ring-emerald-50">
              <img src="/school-logo.png" alt="Logo SMP Terpadu Al-Ittihadiyah" className="w-full h-full object-contain rounded-xl" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">{appName}</h1>
            <p className="text-xs font-semibold text-slate-600">
              {institutionName}
            </p>
            <div>
              <span className="inline-block px-2.5 py-0.5 bg-slate-100 text-slate-500 font-mono text-[10px] rounded-full border border-slate-200">
                v1.0 Release Candidate
              </span>
            </div>
          </div>

          {isInAppBrowser && (
            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 text-sky-900 text-xs leading-relaxed">
              <p className="font-bold">Membuka dari dalam WhatsApp?</p>
              <p className="mt-0.5 text-[11px] text-sky-800">
                Agar lebih lancar, ketuk tanda <strong>titik tiga (⋮)</strong> di pojok kanan atas layar lalu pilih <strong>Buka di Chrome / Browser</strong>.
              </p>
            </div>
          )}

          {errorMessage && (
            <div role="alert" className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold space-y-1">
              <div className="flex items-center gap-1.5 font-bold">
                <span>⚠️</span> Kendala Login
              </div>
              <p>{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <Input
                label="Nomor WhatsApp / NPP"
                type="tel"
                inputMode="tel"
                autoComplete="username"
                placeholder="Contoh: 081234567890 atau NPP"
                value={identity}
                onChange={(e) => setIdentity(e.target.value)}
                error={identityError}
                disabled={isLoading}
                required
              />
              <p className="text-[11px] text-slate-500">
                Bisa mengetik awalan 08..., +628..., atau NPP tanpa perlu format khusus.
              </p>
            </div>

            <div className="space-y-1">
              <Input
                label="PIN 6-Digit"
                type={showPin ? 'text' : 'password'}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="current-password"
                placeholder="••••••"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                error={pinError}
                disabled={isLoading}
                required
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPin((prev) => !prev)}
                    aria-label={showPin ? 'Sembunyikan angka PIN' : 'Lihat angka PIN'}
                    className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer transition-colors"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
              <p className="text-[11px] text-slate-500">
                Ketuk ikon mata di sebelah kanan untuk melihat angka PIN yang Anda ketik.
              </p>
            </div>

            <TurnstileWidget
              ref={turnstileRef}
              action="login"
              onVerify={handleTurnstileVerify}
              onExpire={handleTurnstileExpire}
              onError={handleTurnstileError}
            />

            <div className="pt-1 space-y-2">
              <Button
                type="submit"
                variant="primary"
                className="w-full"
                isLoading={isLoading}
                disabled={isLoading}
              >
                MASUK KE APLIKASI
              </Button>
              {!turnstileToken && !isLoading && (
                <p className="text-[11px] text-center text-slate-500 font-medium">
                  Pastikan kotak keamanan di atas sudah bertanda centang hijau sebelum menekan Masuk.
                </p>
              )}
            </div>
          </form>
        </div>

        <div className="w-full max-w-md mx-auto text-center pt-3 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Lupa PIN atau mengganti HP? <span className="font-bold text-emerald-600">Silakan hubungi Admin Website.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
