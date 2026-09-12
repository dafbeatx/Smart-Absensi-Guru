import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useSettingsStore } from '../../../store/useSettingsStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { getOrCreateDeviceUUID, getDeviceModelString } from '../../../utils/device.utils';
import { validatePIN, validateIdentity } from '../../../utils/validation.utils';
import { AuthRepository } from '../../../repositories/AuthRepository';
import { logger } from '../../../utils/logger.utils';
import { handleAppError, notifySuccess } from '../../../utils/error.utils';
import { TurnstileWidget } from '../../../components/ui/TurnstileWidget';
import { TelegramService } from '../../../services/telegram.service';
import { getCurrentTimeInJakarta, getTodayDateInJakarta } from '../../../utils/time.utils';

export const LoginPage: React.FC = () => {
  const [identity, setIdentity] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);

  const { loginSuccess } = useAuthStore();
  const appName = useSettingsStore((s) => s.settings.app_name) || 'SMART ABSENSI GURU';
  const institutionName = useSettingsStore((s) => s.settings.institution_name) || 'SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam';

  useEffect(() => {
    useSettingsStore.getState().loadSettings().catch(() => {});
  }, []);
  const deviceUUID = getOrCreateDeviceUUID();
  const deviceModel = getDeviceModelString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

    setIsLoading(true);
    const maskedIdentity = identity.length > 4 ? `${identity.substring(0, 4)}***` : identity;
    logger.info('LoginPage', `Attempting login for identity: ${maskedIdentity}`);
    if (turnstileToken) {
      logger.info('LoginPage', 'Turnstile token present for bot verification.');
    }

    try {
      const res = await AuthRepository.login({
        identity,
        pin,
        device_uuid: deviceUUID,
        device_model: deviceModel,
      });

      logger.info('LoginPage', `Login successful for user: ${res.user.full_name} (${res.user.role})`);
      notifySuccess('Login Berhasil!', `Selamat datang kembali, ${res.user.full_name}`);
      loginSuccess(res.token, res.user);

      // Dispatch Telegram web login notification
      TelegramService.sendWebLoginNotification({
        teacherName: res.user.full_name,
        nip: res.user.nip || undefined,
        role: res.user.role,
        device: deviceModel || (typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser'),
        timeStr: getCurrentTimeInJakarta(),
        dateStr: getTodayDateInJakarta(),
      }).catch((e) => console.warn('Telegram login notification error:', e));
    } catch (err: unknown) {
      setIsLoading(false);
      const cleanMsg = handleAppError(err, 'LoginPage', 'Kendala Login', false);
      setErrorMessage(cleanMsg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
        {/* Branding Hierarchy */}
        <div className="text-center space-y-2">
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

        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold space-y-1">
            <div className="flex items-center gap-1.5 font-bold">
              <span>⚠️</span> Kendala Login
            </div>
            <p>{errorMessage}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nomor WhatsApp / NPP"
            type="tel"
            inputMode="tel"
            pattern="[0-9]*"
            autoComplete="tel"
            placeholder="Masukkan Nomor WA (Contoh: 081234567890)"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            error={identityError}
            required
          />

          <Input
            label="PIN 6-Digit"
            type="password"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="current-password"
            placeholder="••••••"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            error={pinError}
            required
          />

          <TurnstileWidget
            onVerify={(token) => setTurnstileToken(token)}
            onExpire={() => setTurnstileToken(null)}
            onError={() => setTurnstileToken(null)}
          />

          <div className="pt-2">
            <Button type="submit" variant="primary" className="w-full" isLoading={isLoading}>
              MASUK KE APLIKASI
            </Button>
          </div>
        </form>

        <div className="text-center pt-2 border-t border-slate-100">
          <p className="text-xs text-slate-500">
            Lupa PIN atau mengganti HP? <span className="font-bold text-emerald-600 cursor-pointer">Silakan hubungi Admin Website.</span>
          </p>
        </div>
      </div>
    </div>
  );
};
