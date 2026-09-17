import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Cookie, ShieldCheck, Sliders, Check, Zap, Database, Activity, X } from 'lucide-react';
import { CookieConsentService, type CookieConsentPreferences } from '../../services/cookie-consent.service';

export const CookieConsentBanner: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);

  // State untuk kelola preferensi kustom
  const [prefs, setPrefs] = useState<CookieConsentPreferences>({
    essential: true,
    egressSaver: true,
    offlineSync: true,
    performance: true,
    consentedAt: '',
    version: 1,
  });

  useEffect(() => {
    // 1. Cek apakah sudah pernah consent atau di-dismiss di sesi ini
    const isDismissedThisSession =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('smart_absensi_cookie_banner_dismissed') === 'true';

    const consent = CookieConsentService.getConsent();
    if (!consent && !isDismissedThisSession) {
      // Jeda 800ms agar halaman utama selesai render dengan mulus di HP
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    } else if (consent) {
      setPrefs(consent);
    }

    // 2. Listener untuk membuka pengaturan cookie dari menu lain (misal Tentang Aplikasi)
    const handleOpenSettings = () => {
      const current = CookieConsentService.getConsent() || {
        essential: true,
        egressSaver: true,
        offlineSync: true,
        performance: true,
        consentedAt: '',
        version: 1,
      };
      setPrefs(current);
      setIsManageModalOpen(true);
    };

    window.addEventListener('smart_absensi_open_cookie_settings', handleOpenSettings);
    return () => {
      window.removeEventListener('smart_absensi_open_cookie_settings', handleOpenSettings);
    };
  }, []);

  const handleDismissBanner = () => {
    setIsVisible(false);
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('smart_absensi_cookie_banner_dismissed', 'true');
    }
  };

  const handleAcceptAll = () => {
    CookieConsentService.acceptAll();
    setIsVisible(false);
    setIsManageModalOpen(false);
  };

  const handleSavePreferences = () => {
    CookieConsentService.saveConsent(prefs);
    setIsVisible(false);
    setIsManageModalOpen(false);
  };

  const togglePref = (key: keyof Pick<CookieConsentPreferences, 'egressSaver' | 'offlineSync' | 'performance'>) => {
    setPrefs((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const content = (
    <>
      {/* ── 1. FLOATING QUICK CONSENT BANNER (Mobile-First / Infinix Note 8 Optimized) ── */}
      {isVisible && !isManageModalOpen && (
        <div className="fixed inset-x-0 bottom-[calc(var(--bottom-nav-height,72px)+16px)] sm:bottom-4 z-40 p-3 sm:p-4 pointer-events-none animate-fadeIn">
          <div className="max-w-md mx-auto pointer-events-auto bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-3xl p-4 sm:p-5 shadow-2xl space-y-3.5 text-slate-800">
            {/* Header with Icon, Title, & Close Button */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#023246]/10 text-[#023246] flex items-center justify-center shrink-0 border border-[#023246]/20">
                  <Cookie className="w-5 h-5 text-[#023246]" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-xs sm:text-sm font-black text-slate-900 leading-tight truncate">
                    Privasi &amp; Penghematan Kuota (Egress)
                  </h4>
                  <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
                    ⚡ Mode Hemat Egress Aktif
                  </span>
                </div>
              </div>

              {/* Close / Dismiss Button */}
              <button
                type="button"
                onClick={handleDismissBanner}
                className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-500 hover:text-slate-800 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                aria-label="Tutup banner cookie"
                title="Tutup banner"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Description */}
            <p className="text-[11px] sm:text-xs text-slate-600 leading-relaxed">
              SAGA menggunakan <strong>cookie mikro (&lt;50 byte)</strong> dan cache lokal HP untuk mengamankan login serta{' '}
              <strong className="text-slate-900">menghemat kuota internet Anda &amp; server hingga 85%</strong>.
            </p>

            {/* Action Buttons: 48px height touch target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-[#023246] hover:bg-[#0D7A5F] active:scale-98 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Terima &amp; Hemat Egress</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManageModalOpen(true)}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-500" />
                <span>Kelola Preferensi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. MODAL KELOLA PREFERENSI COOKIE & EGRESS SAVER ── */}
      {isManageModalOpen && (
        <div className="fixed inset-0 z-99999 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-5 sm:p-6 shadow-2xl border border-slate-200 space-y-4 text-slate-800 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#023246] text-white flex items-center justify-center shadow-xs">
                  <Sliders className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-sm font-black text-slate-900 leading-tight">
                    Kelola Preferensi Cookie
                  </h3>
                  <p className="text-[10px] text-slate-500 font-mono">
                    Ukuran Cookie: &lt; 40 Bytes • Zero Egress Inflation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List of 4 Cookie Categories */}
            <div className="space-y-2.5">
              {/* Category 1: Essential (Wajib) */}
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200/80 flex items-start justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <h5 className="text-xs font-black text-slate-900">Cookie Esensial (Wajib)</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Menyimpan token sesi login, keamanan anti-CSRF, dan otentikasi identitas guru. Tidak dapat dinonaktifkan.
                  </p>
                </div>
                <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-200/70 px-2 py-1 rounded-lg shrink-0 mt-1">
                  Selalu Aktif
                </span>
              </div>

              {/* Category 2: Egress Saver (Rekomendasi) */}
              <div
                onClick={() => togglePref('egressSaver')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  prefs.egressSaver
                    ? 'bg-emerald-50/60 border-emerald-300'
                    : 'bg-white border-slate-200 opacity-80'
                }`}
              >
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Zap className={`w-4 h-4 ${prefs.egressSaver ? 'text-emerald-700' : 'text-slate-400'}`} />
                    <h5 className="text-xs font-black text-slate-900">Mode Hemat Egress Server</h5>
                    <span className="text-[9px] font-extrabold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded">
                      Rekomendasi
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Memprioritaskan cache lokal (`localStorage`) untuk daftar guru &amp; poin, memangkas query Supabase berulang hingga 85%.
                  </p>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 mt-1 ${
                    prefs.egressSaver ? 'bg-emerald-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      prefs.egressSaver ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Category 3: Offline Storage */}
              <div
                onClick={() => togglePref('offlineSync')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  prefs.offlineSync
                    ? 'bg-teal-50/60 border-teal-300'
                    : 'bg-white border-slate-200 opacity-80'
                }`}
              >
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Database className={`w-4 h-4 ${prefs.offlineSync ? 'text-teal-700' : 'text-slate-400'}`} />
                    <h5 className="text-xs font-black text-slate-900">Penyimpanan Offline (IndexedDB)</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Menyimpan cadangan presensi lokal via Dexie DB agar guru tetap bisa scan absensi saat sinyal sekolah hilang.
                  </p>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 mt-1 ${
                    prefs.offlineSync ? 'bg-teal-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      prefs.offlineSync ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>

              {/* Category 4: Performance & Latency */}
              <div
                onClick={() => togglePref('performance')}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-start justify-between gap-3 ${
                  prefs.performance
                    ? 'bg-blue-50/60 border-blue-300'
                    : 'bg-white border-slate-200 opacity-80'
                }`}
              >
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className={`w-4 h-4 ${prefs.performance ? 'text-blue-700' : 'text-slate-400'}`} />
                    <h5 className="text-xs font-black text-slate-900">Diagnosa Performa &amp; Edge CDN</h5>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    Mengukur kecepatan jaringan Vercel Edge untuk mendeteksi kendala koneksi sebelum absensi berlangsung.
                  </p>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 mt-1 ${
                    prefs.performance ? 'bg-blue-600' : 'bg-slate-300'
                  }`}
                >
                  <div
                    className={`bg-white w-4 h-4 rounded-full shadow-md transform transition-transform ${
                      prefs.performance ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </div>
              </div>
            </div>

            {/* Bottom Actions: 48px height touch target */}
            <div className="pt-2 flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-[#023246] hover:bg-[#0D7A5F] active:scale-98 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-400" />
                <span>Simpan Preferensi</span>
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white font-extrabold text-xs transition-all flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
              >
                <span>Aktifkan Semua</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  return typeof document !== 'undefined'
    ? createPortal(content, document.body)
    : content;
};
