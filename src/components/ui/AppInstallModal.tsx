import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export interface AppInstallModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export const AppInstallModal: React.FC<AppInstallModalProps> = ({
  isOpen: propsIsOpen,
  onClose: propsOnClose,
}) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState<boolean>(false);
  const [internalIsOpen, setInternalIsOpen] = useState<boolean>(false);
  const [isIos, setIsIos] = useState<boolean>(false);

  useEffect(() => {
    // 1. Detect if app is already running as installed PWA (Standalone mode)
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true;
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // 2. Detect iOS device
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isIosDevice);

    // 3. Listen for native PWA install prompt on Android/Chrome/Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // 4. Auto-trigger modal popup on first visit if not dismissed in session
    const hasSeenPrompt = sessionStorage.getItem('smart_absensi_install_prompt_seen');
    if (!hasSeenPrompt && !isStandalone) {
      const timer = setTimeout(() => {
        setInternalIsOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, [isStandalone]);

  // Determine actual open state (either controlled by props or internal state)
  const isOpen = propsIsOpen !== undefined ? propsIsOpen : internalIsOpen;

  const handleClose = () => {
    sessionStorage.setItem('smart_absensi_install_prompt_seen', 'true');
    setInternalIsOpen(false);
    if (propsOnClose) propsOnClose();
  };

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA install prompt');
        }
        setDeferredPrompt(null);
      } catch (err) {
        console.warn('Install prompt error:', err);
      }
    }
    handleClose();
  };

  if (isStandalone) {
    return null; // Hide if already installed as PWA app
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="📲 Install Aplikasi Smart Absensi">
        <div className="text-center space-y-4 py-2">
          {/* Official School Logo Header */}
          <div className="relative inline-block">
            <div className="w-24 h-24 mx-auto rounded-3xl bg-white p-2.5 shadow-md border-2 border-emerald-500/30 flex items-center justify-center ring-4 ring-emerald-50">
              <img
                src="/school-logo.png"
                alt="Logo SMP Terpadu Al-Ittihadiyah Ciampea-Bogor"
                className="w-full h-full object-contain drop-shadow-sm"
              />
            </div>
            <span className="absolute -bottom-1 -right-1 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow-xs border border-white">
              OFFICIAL
            </span>
          </div>

          <div className="space-y-1 max-w-sm mx-auto">
            <h3 className="font-extrabold text-slate-900 text-base">
              Download & Install di HP Anda
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dapatkan akses cepat <strong>Smart Absensi Guru</strong> langsung dari layar utama HP Anda (*Guru, Admin & Kepsek*).
            </p>
          </div>

          {/* Feature Highlights */}
          <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 text-left text-[11px]">
            <div className="space-y-0.5">
              <div className="font-bold text-emerald-700 flex items-center gap-1">
                <span>⚡</span> Cepat
              </div>
              <p className="text-slate-500 text-[10px] leading-tight">Tanpa perlu ketik URL lagi</p>
            </div>
            <div className="space-y-0.5 border-x border-slate-200 px-2">
              <div className="font-bold text-emerald-700 flex items-center gap-1">
                <span>📷</span> Scan QR
              </div>
              <p className="text-slate-500 text-[10px] leading-tight">Kamera HP lebih responsif</p>
            </div>
            <div className="space-y-0.5 pl-1">
              <div className="font-bold text-emerald-700 flex items-center gap-1">
                <span>🔔</span> Notif
              </div>
              <p className="text-slate-500 text-[10px] leading-tight">Update absensi real-time</p>
            </div>
          </div>

          {/* Installation Instructions */}
          {deferredPrompt ? (
            <div className="pt-2">
              <Button
                variant="primary"
                className="w-full py-3 text-sm font-extrabold flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 cursor-pointer"
                onClick={handleInstallClick}
              >
                <span>📲</span> Install Aplikasi Sekarang
              </Button>
            </div>
          ) : isIos ? (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-left text-xs space-y-1.5 text-slate-700">
              <p className="font-bold text-emerald-900 flex items-center gap-1">
                <span>🍎</span> Cara Pasang di iPhone / iPad (Safari):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                <li>Klik tombol <strong>Bagikan (Share ⎋)</strong> di bagian bawah browser Safari.</li>
                <li>Geser ke bawah lalu pilih <strong>"Tambah ke Layar Utama"</strong> (*Add to Home Screen*).</li>
                <li>Klik <strong>Tambah</strong> di pojok kanan atas.</li>
              </ol>
            </div>
          ) : (
            <div className="bg-emerald-50 border border-emerald-200 p-3.5 rounded-2xl text-left text-xs space-y-1.5 text-slate-700">
              <p className="font-bold text-emerald-900 flex items-center gap-1">
                <span>🤖</span> Cara Pasang di HP Android (Chrome):
              </p>
              <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                <li>Klik tombol <strong>⋮ (Tiga Titik)</strong> di pojok kanan atas Chrome HP.</li>
                <li>Pilih opsi <strong>"Install Aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.</li>
                <li>Konfirmasi pemasangan ikon di layar HP Anda.</li>
              </ol>
            </div>
          )}

          <div className="pt-1 flex justify-center gap-2">
            <Button variant="secondary" size="sm" className="w-full text-xs cursor-pointer" onClick={handleClose}>
              Nanti Saja
            </Button>
          </div>
        </div>
      </Modal>

      {/* Floating Trigger Badge on Screen Bottom-Right for Manual Open */}
      {!isOpen && !isStandalone && (
        <button
          onClick={() => setInternalIsOpen(true)}
          className="fixed bottom-36 right-4 sm:bottom-20 sm:right-28 z-40 bg-[#023246] hover:bg-[#03445e] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xl border-2 border-emerald-400 flex items-center gap-1.5 transition-all active:scale-95 animate-bounce"
          title="Install Aplikasi Smart Absensi Guru ke HP"
        >
          <img src="/school-logo.png" alt="Icon" className="w-4 h-4 object-contain rounded-full bg-white p-0.5" />
          <span className="text-[11px]">📲 Install App</span>
        </button>
      )}
    </>
  );
};
