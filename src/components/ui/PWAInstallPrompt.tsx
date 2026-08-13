import React, { useState, useEffect } from 'react';
import { pwaService } from '../../services/pwa.service';
import { Modal } from './Modal';

export const PWAInstallPrompt: React.FC = () => {
  const [canInstall, setCanInstall] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    setIsStandalone(pwaService.isStandalone());
    setIsIOS(pwaService.isIOS());

    // Check local storage dismissal
    const dismissed = localStorage.getItem('smart_absensi_pwa_dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }

    const handleInstallable = () => {
      setCanInstall(true);
    };

    window.addEventListener('smart_absensi_pwa_installable', handleInstallable);
    if (pwaService.canPromptInstall()) {
      setCanInstall(true);
    }

    return () => {
      window.removeEventListener('smart_absensi_pwa_installable', handleInstallable);
    };
  }, []);

  if (isStandalone || isDismissed) {
    return null;
  }

  const handleInstallClick = async () => {
    if (isIOS) {
      setShowIOSModal(true);
    } else if (canInstall) {
      const success = await pwaService.promptInstall();
      if (success) {
        setCanInstall(false);
      }
    } else {
      setShowIOSModal(true);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    localStorage.setItem('smart_absensi_pwa_dismissed', 'true');
  };

  return (
    <>
      {/* Sleek Floating Install Banner for Mobile & Desktop */}
      <div className="bg-linear-to-r from-[#023246] to-[#0d5c75] text-white p-3.5 rounded-2xl shadow-xl border border-teal-500/30 flex items-center justify-between gap-3 mb-4 animate-fade-in">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/40 flex items-center justify-center text-xl shrink-0 shadow-inner">
            📱
          </div>
          <div className="min-w-0">
            <h4 className="font-extrabold text-xs text-white tracking-tight flex items-center gap-1.5">
              <span>Instal Smart Absensi Guru</span>
              <span className="px-1.5 py-0.2 bg-emerald-500 text-[9px] font-black uppercase rounded text-slate-950">PWA</span>
            </h4>
            <p className="text-[11px] text-teal-100 font-medium truncate">
              {isIOS ? 'Tambahkan ke Layar Utama HP untuk akses instan & offline' : 'Akses presensi lebih cepat langsung dari Layar Utama HP'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleInstallClick}
            className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1"
          >
            <span>⬇️</span>
            <span>Instal</span>
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

      {/* iOS Safari Step-by-Step Installation Modal */}
      <Modal isOpen={showIOSModal} onClose={() => setShowIOSModal(false)} title="📱 Petunjuk Instalasi di iPhone / iPad">
        <div className="space-y-4 text-xs text-slate-700">
          <p className="font-medium text-slate-600">
            Untuk menginstal <b>Smart Absensi Guru</b> di iPhone atau iPad Anda (Safari Browser):
          </p>

          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#023246] text-white flex items-center justify-center font-bold text-xs shrink-0">1</span>
              <div>
                <p className="font-bold text-slate-900">Tekan Tombol Berbagi (Share)</p>
                <p className="text-[11px] text-slate-500">Ketuk ikon petak dengan panah ke atas <span className="text-base">⎋</span> di bagian bawah layar Safari.</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#023246] text-white flex items-center justify-center font-bold text-xs shrink-0">2</span>
              <div>
                <p className="font-bold text-slate-900">Pilih "Tambah ke Layar Utama"</p>
                <p className="text-[11px] text-slate-500">Gulir ke bawah pada menu opsi dan pilih <b>"Add to Home Screen"</b> (atau <b>"Tambah ke Layar Utama"</b>).</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#023246] text-white flex items-center justify-center font-bold text-xs shrink-0">3</span>
              <div>
                <p className="font-bold text-slate-900">Konfirmasi "Tambah"</p>
                <p className="text-[11px] text-slate-500">Ketuk tombol <b>"Tambah"</b> di kanan atas. Ikon aplikasi akan langsung muncul di Layar Utama HP Anda.</p>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowIOSModal(false)}
            className="w-full py-2.5 bg-[#023246] hover:bg-[#03445e] text-white font-extrabold text-xs rounded-xl transition-all cursor-pointer"
          >
            Mengerti &amp; Tutup
          </button>
        </div>
      </Modal>
    </>
  );
};
