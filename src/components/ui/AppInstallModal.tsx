import React, { useState, useEffect } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { Download, Smartphone, ShieldCheck, Volume2, Globe, CheckCircle2, ExternalLink, Monitor } from 'lucide-react';

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
  const [activeDownloadTab, setActiveDownloadTab] = useState<'APK' | 'WINDOWS' | 'PWA'>('APK');

  const APK_DOWNLOAD_URL =
    'https://github.com/dafbeatx/Smart-Absensi-Guru/releases/download/v1.0-apk/Smart-Absensi-Guru-v1.0-release.apk';
  const WIN_SETUP_DOWNLOAD_URL =
    'https://github.com/dafbeatx/Smart-Absensi-Guru/releases/download/v1.0-exe/Smart-Absensi-Guru-Setup-1.0.0.exe';
  const WIN_PORTABLE_DOWNLOAD_URL =
    'https://github.com/dafbeatx/Smart-Absensi-Guru/releases/download/v1.0-exe/Smart-Absensi-Guru-Portable-1.0.0.exe';
  const GITHUB_RELEASES_URL =
    'https://github.com/dafbeatx/Smart-Absensi-Guru/releases';

  useEffect(() => {
    // 1. Detect if app is already running as installed PWA or Native standalone
    const checkStandalone = () => {
      const isStandaloneMode =
        window.matchMedia('(display-mode: standalone)').matches ||
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (navigator as any).standalone === true ||
        window.location.protocol === 'capacitor:' ||
        window.location.protocol === 'file:';
      setIsStandalone(Boolean(isStandaloneMode));
    };

    checkStandalone();

    // 2. Detect platform to open appropriate default tab
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    const isWindowsDevice = /windows|win32|win64/.test(userAgent);

    setIsIos(isIosDevice);
    if (isWindowsDevice) {
      setActiveDownloadTab('WINDOWS');
    } else if (isIosDevice) {
      setActiveDownloadTab('PWA');
    }

    // 3. Listen for native PWA install prompt on Android/Chrome/Edge
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    // 4. Global Event to open download modal from Guru, Admin, or Kepsek dashboards
    const handleOpenModal = () => {
      setInternalIsOpen(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('smart_absensi_open_app_install', handleOpenModal);

    // 5. Auto-trigger modal popup on first visit if not dismissed in session
    const hasSeenPrompt = sessionStorage.getItem('smart_absensi_install_prompt_seen');
    if (!hasSeenPrompt && !isStandalone) {
      const timer = setTimeout(() => {
        setInternalIsOpen(true);
      }, 1500);
      return () => clearTimeout(timer);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('smart_absensi_open_app_install', handleOpenModal);
    };
  }, [isStandalone]);

  const [downloadNotice, setDownloadNotice] = useState<string | null>(null);

  const isOpen = propsIsOpen !== undefined ? propsIsOpen : internalIsOpen;

  const handleClose = () => {
    sessionStorage.setItem('smart_absensi_install_prompt_seen', 'true');
    setInternalIsOpen(false);
    setDownloadNotice(null);
    if (propsOnClose) propsOnClose();
  };

  const handleDownloadFile = (url: string, label: string) => {
    setDownloadNotice(`Sedang membuka tautan unduhan ${label}. Periksa panel unduhan peramban Anda.`);
    // Trigger download cleanly
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePwaInstallClick = async () => {
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
    return null;
  }

  return (
    <>
      <Modal isOpen={isOpen} onClose={handleClose} title="📱 Unduh Aplikasi Smart Absensi Guru">
        <div className="space-y-4 py-1 text-slate-800">
          {/* Header Banner */}
          <div className="flex items-center gap-3 p-3 bg-linear-to-r from-[#023246] to-[#0a485e] rounded-2xl text-white shadow-md">
            <div className="w-12 h-12 rounded-xl bg-white p-1.5 shrink-0 shadow-sm border border-emerald-400/40 flex items-center justify-center">
              <img
                src="/school-logo.png"
                alt="Logo Sekolah"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-extrabold text-sm text-white">Smart Absensi Guru</span>
                <span className="px-1.5 py-0.2 bg-emerald-500 text-slate-950 text-[9px] font-black rounded-md tracking-wider uppercase">
                  OFFICIAL v1.0
                </span>
              </div>
              <p className="text-[11px] text-teal-100 font-medium">
                Tersedia untuk Akun Guru, Admin &amp; Kepala Sekolah
              </p>
            </div>
          </div>

          {/* Download Status Notification */}
          {downloadNotice && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center justify-between gap-2 animate-fade-in shadow-xs">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{downloadNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setDownloadNotice(null)}
                className="text-emerald-700 hover:text-emerald-950 text-xs font-bold px-1.5 py-0.5 rounded cursor-pointer"
              >
                ✕
              </button>
            </div>
          )}

          {/* Platform Tab Switcher: 3 Platforms */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveDownloadTab('APK')}
              className={`py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                activeDownloadTab === 'APK'
                  ? 'bg-white text-[#023246] shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span className="truncate">Android APK</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDownloadTab('WINDOWS')}
              className={`py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                activeDownloadTab === 'WINDOWS'
                  ? 'bg-white text-[#023246] shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-blue-600 shrink-0" />
              <span className="truncate">Windows PC</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveDownloadTab('PWA')}
              className={`py-2 px-1.5 rounded-lg flex items-center justify-center gap-1 transition-all cursor-pointer text-center ${
                activeDownloadTab === 'PWA'
                  ? 'bg-white text-[#023246] shadow-xs border border-slate-200'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <Globe className="w-3.5 h-3.5 text-cyan-600 shrink-0" />
              <span className="truncate">PWA / Web</span>
            </button>
          </div>

          {/* TAB 1: ANDROID APK DOWNLOAD (RECOMMENDED FOR PHONES) */}
          {activeDownloadTab === 'APK' && (
            <div className="space-y-3 animate-fade-in">
              <div className="p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-2xl space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-emerald-950 flex items-center gap-1.5">
                    <span>🤖</span> Format File APK Asli (Android)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-emerald-200 text-emerald-900 rounded-full">
                    Disarankan di HP
                  </span>
                </div>
                <p className="text-[11px] text-emerald-900 leading-relaxed">
                  Pasang langsung di HP Android Anda untuk pengalaman presensi tercepat dan terintegrasi penuh.
                </p>

                {/* Badges / Keunggulan */}
                <div className="grid grid-cols-1 gap-1.5 pt-1 text-[11px] text-slate-700">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><b>Signed Release Certificate:</b> 100% Bebas peringatan virus &amp; Play Protect</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span><b>Suara Notifikasi Custom:</b> Bunyi alarm presensi khas langsung di HP</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><b>Geofencing &amp; Kamera Cepat:</b> Pindai QR poster sekolah tanpa jeda</span>
                  </div>
                </div>
              </div>

              {/* Direct Download Button */}
              <button
                type="button"
                onClick={() => handleDownloadFile(APK_DOWNLOAD_URL, 'APK Android (v1.0-release.apk)')}
                className="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs rounded-xl shadow-lg shadow-emerald-600/25 transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Unduh File APK Android (v1.0-release.apk)</span>
              </button>

              {/* PWA Fast Install Button (Instant Home Screen Shortcut) */}
              {deferredPrompt && (
                <button
                  type="button"
                  onClick={handlePwaInstallClick}
                  className="w-full py-2.5 px-3 bg-teal-50 hover:bg-teal-100 border border-teal-300 text-teal-900 font-bold text-xs rounded-xl transition-all active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Smartphone className="w-3.5 h-3.5 text-teal-700" />
                  <span>⚡ Pasang Cepat Tanpa Unduh (Layar Utama HP)</span>
                </button>
              )}

              {/* Step by step install note */}
              <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1 text-left">
                <p className="font-bold text-slate-800">💡 Cara Pasang di HP:</p>
                <ol className="list-decimal list-inside space-y-0.5 text-[10.5px]">
                  <li>Klik tombol unduh di atas untuk mendownload file APK.</li>
                  <li>Buka file <code className="bg-slate-200 px-1 rounded text-slate-900">.apk</code> yang selesai diunduh.</li>
                  <li>Pilih <b>"Install / Pasang"</b> saat diminta oleh sistem Android.</li>
                  <li>Buka aplikasi lalu login dengan No HP / NPP dan PIN Anda.</li>
                </ol>
              </div>

              <div className="text-center">
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-slate-500 hover:text-emerald-700 font-medium inline-flex items-center gap-1"
                >
                  <span>Lihat Riwayat Rilis di GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: WINDOWS PC & LAPTOP DESKTOP APP */}
          {activeDownloadTab === 'WINDOWS' && (
            <div className="space-y-3 animate-fade-in text-left">
              <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-2xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-xs text-blue-950 flex items-center gap-1.5">
                    <span>💻</span> Aplikasi Desktop Windows (Laptop &amp; PC)
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-200 text-blue-900 rounded-full">
                    v1.0 Native
                  </span>
                </div>
                <p className="text-[11px] text-blue-900 leading-relaxed">
                  Pilihan utama untuk Admin, Kepala Sekolah, dan Guru saat input jadwal, cetak kartu &amp; laporan, serta presensi via Laptop/PC.
                </p>

                {/* Badges / Keunggulan */}
                <div className="grid grid-cols-1 gap-1.5 pt-1 text-[11px] text-slate-700">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span><b>Aman &amp; Bersih:</b> Tanpa virus/adware, konfigurasi hak akses aman <code>asInvoker</code></span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                    <span><b>Kamera Webcam &amp; Lokasi:</b> Mendukung pemindaian QR absensi dan barcode kartu</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Volume2 className="w-4 h-4 text-teal-600 shrink-0" />
                    <span><b>Notifikasi Desktop Windows:</b> Peringatan jadwal &amp; status absensi langsung di layar</span>
                  </div>
                </div>
              </div>

              {/* Dua Pilihan Download: Installer & Portable */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleDownloadFile(WIN_SETUP_DOWNLOAD_URL, 'Installer Windows Setup (.exe)')}
                  className="p-3 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    <span>Installer Setup (.exe)</span>
                  </div>
                  <span className="text-[9.5px] font-normal text-blue-100">Pasang di Desktop &amp; Start Menu</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDownloadFile(WIN_PORTABLE_DOWNLOAD_URL, 'Windows Portable (.exe)')}
                  className="p-3 bg-slate-800 hover:bg-slate-700 text-white font-extrabold text-xs rounded-xl shadow-md transition-all active:scale-95 flex flex-col items-center justify-center gap-1 text-center cursor-pointer"
                >
                  <div className="flex items-center gap-1.5">
                    <Download className="w-4 h-4" />
                    <span>Versi Portable (.exe)</span>
                  </div>
                  <span className="text-[9.5px] font-normal text-slate-300">Langsung klik tanpa install</span>
                </button>
              </div>

              {/* Panduan SmartScreen */}
              <div className="p-2.5 bg-amber-50/80 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
                <p className="font-bold text-amber-950 flex items-center gap-1">
                  <span>🛡️</span> Tips Jika Muncul Peringatan Windows SmartScreen:
                </p>
                <p className="text-[10.5px] leading-relaxed text-amber-900">
                  Karena aplikasi baru diterbitkan, jika Windows menampilkan <i>"Windows protected your PC"</i>, cukup klik <b>"More info" (Informasi selengkapnya)</b> lalu klik tombol <b>"Run anyway" (Tetap jalankan)</b>.
                </p>
              </div>

              <div className="text-center">
                <a
                  href={GITHUB_RELEASES_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-slate-500 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  <span>Lihat Rilis Windows di GitHub</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          )}

          {/* TAB 2: PWA WEB INSTALLATION (iOS & CHROME) */}
          {activeDownloadTab === 'PWA' && (
            <div className="space-y-3 animate-fade-in text-left">
              {deferredPrompt ? (
                <div className="space-y-2">
                  <div className="p-3 bg-cyan-50 border border-cyan-200 rounded-2xl text-xs text-cyan-900">
                    <p className="font-bold flex items-center gap-1.5">
                      <span>⚡</span> Pemasangan Instan Web PWA Didukung
                    </p>
                    <p className="text-[11px] mt-1 text-cyan-800">
                      Browser Anda mendukung instalasi langsung tanpa unduh file besar.
                    </p>
                  </div>
                  <Button
                    variant="primary"
                    className="w-full py-3 text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer"
                    onClick={handlePwaInstallClick}
                  >
                    <span>📲</span> Tambahkan ke Layar Utama Sekarang
                  </Button>
                </div>
              ) : isIos ? (
                <div className="bg-cyan-50/70 border border-cyan-200 p-3.5 rounded-2xl text-xs space-y-2 text-slate-700">
                  <p className="font-bold text-cyan-950 flex items-center gap-1.5">
                    <span>🍎</span> Cara Pasang di iPhone / iPad (Safari):
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5 text-[11px] leading-relaxed text-slate-600">
                    <li>
                      Tekan tombol <b>Bagikan (Share)</b> <span className="font-mono text-xs">⎋</span> di bilah bawah Safari.
                    </li>
                    <li>
                      Gulir ke bawah dan ketuk <b>"Tambah ke Layar Utama"</b> (<i>Add to Home Screen</i>).
                    </li>
                    <li>
                      Ketuk <b>"Tambah"</b> di pojok kanan atas. Ikon aplikasi akan langsung terpasang di HP Anda.
                    </li>
                  </ol>
                </div>
              ) : (
                <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-2xl text-xs space-y-2 text-slate-700">
                  <p className="font-bold text-slate-900 flex items-center gap-1.5">
                    <span>🌐</span> Cara Tambahkan ke Layar Utama (Chrome):
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed text-slate-600">
                    <li>Ketuk ikon <b>⋮ (Tiga Titik)</b> di sudut kanan atas Chrome.</li>
                    <li>Pilih menu <b>"Install Aplikasi"</b> atau <b>"Tambahkan ke Layar Utama"</b>.</li>
                    <li>Konfirmasi pemasangan untuk menambahkan shortcut di layar HP Anda.</li>
                  </ol>
                </div>
              )}
            </div>
          )}

          {/* Footer Dismiss Button */}
          <div className="pt-2">
            <Button
              variant="secondary"
              size="sm"
              className="w-full text-xs cursor-pointer py-2"
              onClick={handleClose}
            >
              Tutup
            </Button>
          </div>
        </div>
      </Modal>

      {/* Floating Trigger Badge on Screen Bottom-Right for Manual Open */}
      {!isOpen && !isStandalone && (
        <button
          onClick={() => setInternalIsOpen(true)}
          className="fixed bottom-36 right-4 sm:bottom-20 sm:right-28 z-40 bg-[#023246] hover:bg-[#03445e] text-white text-xs font-bold px-3 py-1.5 rounded-full shadow-xl border-2 border-emerald-400 flex items-center gap-1.5 transition-all active:scale-95 animate-bounce cursor-pointer"
          title="Unduh APK Android / Pasang Smart Absensi Guru"
        >
          <img
            src="/school-logo.png"
            alt="Icon"
            className="w-4 h-4 object-contain rounded-full bg-white p-0.5"
          />
          <span className="text-[11px]">📱 Unduh APK</span>
        </button>
      )}
    </>
  );
};
