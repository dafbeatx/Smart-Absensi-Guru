import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { pwaService } from '../../services/pwa.service';
import { SagaAppDownloadIcon } from './SagaServiceIcons';

export const PWAInstallPrompt: React.FC = () => {
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsStandalone(pwaService.isStandalone());
    setIsIOS(pwaService.isIOS());

    // Check local storage dismissal
    const dismissed = localStorage.getItem('smart_absensi_pwa_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  if (isStandalone || isDismissed) {
    return null;
  }

  const handleInstallClick = () => {
    // Open unified APK & PWA download modal
    window.dispatchEvent(new CustomEvent('smart_absensi_open_app_install'));
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('smart_absensi_pwa_dismissed', 'true');
  };

  return (
    <div className="bg-[#0D5C46] text-white p-3.5 rounded-2xl shadow-sm border border-[#094736] flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
          <SagaAppDownloadIcon tone="dark" className="w-6 h-6" />
        </div>
        <div className="min-w-0">
          <h4 className="font-bold text-xs sm:text-sm text-white tracking-tight flex items-center gap-1.5 flex-wrap">
            <span>Unduh Smart Absensi Guru</span>
            <span className="px-1.5 py-0.5 bg-amber-300 text-[9.5px] font-bold uppercase rounded text-slate-950">
              APK &amp; WINDOWS EXE
            </span>
          </h4>
          <p className="text-xs text-emerald-100 font-normal truncate">
            {isIOS
              ? 'Unduh atau pasang ke Layar Utama iPhone / iPad Anda'
              : 'Tersedia Aplikasi Windows PC (.exe), Android APK Resmi & Web PWA'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          className="min-h-11 px-3.5 py-2 bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs rounded-xl transition-colors active:scale-[0.98] cursor-pointer flex items-center gap-1.5"
        >
          <span>Unduh / Pasang</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="min-w-11 min-h-11 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
          aria-label="Tutup banner aplikasi"
          title="Tutup banner"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
