import React, { useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { Button } from '../../../components/ui/Button';
import { Input } from '../../../components/ui/Input';
import { getOrCreateDeviceUUID, getDeviceModelString } from '../../../utils/device.utils';
import { validatePIN, validateIdentity } from '../../../utils/validation.utils';
import { AuthRepository } from '../../../repositories/AuthRepository';

export const LoginPage: React.FC = () => {
  const [identity, setIdentity] = useState('');
  const [pin, setPin] = useState('');
  const [pinError, setPinError] = useState('');
  const [identityError, setIdentityError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { loginSuccess } = useAuthStore();
  const deviceUUID = getOrCreateDeviceUUID();
  const deviceModel = getDeviceModelString();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIdentityError('');
    setPinError('');
    setErrorMessage(null);

    const identityVal = validateIdentity(identity);
    if (!identityVal.isValid) {
      setIdentityError(identityVal.error?.message || 'Nomor WA atau NIP tidak valid.');
      return;
    }

    const pinVal = validatePIN(pin);
    if (!pinVal.isValid) {
      setPinError(pinVal.error?.message || 'PIN 6-digit tidak valid.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await AuthRepository.login({
        identity,
        pin,
        device_uuid: deviceUUID,
        device_model: deviceModel,
      });

      loginSuccess(res.token, res.user);
    } catch (err: unknown) {
      setIsLoading(false);
      const msg = err instanceof Error ? err.message : 'Login gagal. Periksa kembali NIP/WA dan PIN Anda.';
      console.error('⛔ [LoginPage Submit Error]:', err);
      setErrorMessage(msg);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center items-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl border border-slate-200 shadow-xl space-y-6">
        {/* Branding Hierarchy */}
        <div className="text-center space-y-2">
          <div className="w-14 h-14 bg-emerald-500 rounded-2xl mx-auto flex items-center justify-center text-white text-2xl font-black shadow-lg shadow-emerald-500/30">
            📱
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">SMART ABSENSI GURU</h1>
          <p className="text-xs font-semibold text-slate-600">
            SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam
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
            label="Nomor WA / NIP"
            placeholder="Contoh: 081234567890 atau NIP / ADMIN / KEPSEK"
            value={identity}
            onChange={(e) => setIdentity(e.target.value)}
            error={identityError}
            required
          />

          <Input
            label="PIN 6-Digit"
            type="password"
            placeholder="••••••"
            maxLength={6}
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            error={pinError}
            required
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
