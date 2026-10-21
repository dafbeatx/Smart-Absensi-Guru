import React, { useState, useEffect } from 'react';
import { pwaService } from '../../services/pwa.service';

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
    <div className="bg-linear-to-r from-[#023246] to-[#0d5c75] text-white p-3.5 rounded-2xl shadow-xl border border-teal-500/30 flex items-center justify-between gap-3 mb-4 animate-fade-in">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
          📱
        </div>
        <div className="min-w-0">
          <h4 className="font-extrabold text-xs text-white tracking-tight flex items-center gap-1.5 flex-wrap">
            <span>Unduh Smart Absensi Guru</span>
            <span className="px-1.5 py-0.2 bg-emerald-500 text-[9px] font-black uppercase rounded text-slate-950">
              APK &amp; WINDOWS EXE
            </span>
          </h4>
          <p className="text-[11px] text-teal-100 font-medium truncate">
            {isIOS
              ? 'Unduh atau pasang ke Layar Utama iPhone / iPad Anda'
              : 'Tersedia Aplikasi Windows PC (.exe), Android APK Resmi &amp; Web PWA'}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
        >
          <span>⬇️</span>
          <span>Unduh / Pasang</span>
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-teal-200 flex items-center justify-center text-xs transition-all cursor-pointer"
          title="Tutup banner"
        >
          ✕
        </button>
      </div>
    </div>
  );
};
