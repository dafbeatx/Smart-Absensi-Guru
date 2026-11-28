import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Sliders, Check, Database, Activity, X } from 'lucide-react';
import { CookieConsentService, type CookieConsentPreferences } from '../../services/cookie-consent.service';
import { useAuthStore } from '../../store/useAuthStore';
import { getTodayDateInJakarta, isAutoCheckInRecord } from '../../utils/time.utils';
import {
  SagaCookieShieldIcon,
  SagaDeviceShieldIcon,
  SagaOfflineBoltIcon,
} from './SagaServiceIcons';

function hasCompletedCheckInForCookie(userId?: string): boolean {
  if (typeof window === 'undefined' || !userId) return false;
  try {
    const todayStr = getTodayDateInJakarta();
    const candidateKeys = [
      `smart_absensi_today_attendance_${userId}_${todayStr}`,
      'smart_absensi_today_record',
      'smart_absensi_my_today_record',
    ];
    for (const key of candidateKeys) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed = JSON.parse(raw) as {
        user_id?: string;
        date?: string;
        check_in_time?: string | null;
        check_out_time?: string | null;
        notes?: string | null;
        qr_seed?: string | null;
      };
      if (parsed.user_id && parsed.user_id !== userId) continue;
      if (parsed.date && parsed.date !== todayStr) continue;
      if (parsed.check_in_time && (!isAutoCheckInRecord(parsed) || Boolean(parsed.check_out_time))) {
        return true;
      }
    }
  } catch {
    return false;
  }
  return false;
}

export const CookieConsentBanner: React.FC = () => {
  const { user } = useAuthStore();
  const [isVisible, setIsVisible] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isTeacherCheckedIn, setIsTeacherCheckedIn] = useState<boolean>(() =>
    hasCompletedCheckInForCookie(user?.id)
  );

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
    setIsTeacherCheckedIn(hasCompletedCheckInForCookie(user?.id));

    const refreshCheckInState = (event?: Event) => {
      if (event instanceof CustomEvent && event.detail && typeof event.detail.checkedIn === 'boolean') {
        if (!event.detail.userId || event.detail.userId === user?.id) {
          setIsTeacherCheckedIn(event.detail.checkedIn || hasCompletedCheckInForCookie(user?.id));
          return;
        }
      }
      setIsTeacherCheckedIn(hasCompletedCheckInForCookie(user?.id));
    };

    window.addEventListener('smart_absensi_checkin_completed', refreshCheckInState);
    window.addEventListener('smart_absensi_scanned', refreshCheckInState);
    window.addEventListener('smart_absensi_records_updated', refreshCheckInState);
    window.addEventListener('smart_absensi_teacher_checkin_state', refreshCheckInState);
    window.addEventListener('storage', refreshCheckInState);
    return () => {
      window.removeEventListener('smart_absensi_checkin_completed', refreshCheckInState);
      window.removeEventListener('smart_absensi_scanned', refreshCheckInState);
      window.removeEventListener('smart_absensi_records_updated', refreshCheckInState);
      window.removeEventListener('smart_absensi_teacher_checkin_state', refreshCheckInState);
      window.removeEventListener('storage', refreshCheckInState);
    };
  }, [user?.id]);

  useEffect(() => {
    const isDismissedThisSession =
      typeof sessionStorage !== 'undefined' &&
      sessionStorage.getItem('smart_absensi_cookie_banner_dismissed') === 'true';

    const consent = CookieConsentService.getConsent();
    if (consent) {
      setPrefs(consent);
      setIsVisible(false);
    } else if (!isDismissedThisSession && user && (user.role !== 'GURU' || isTeacherCheckedIn)) {
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 800);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }

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
  }, [user, isTeacherCheckedIn]);

  useEffect(() => {
    if (!isManageModalOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [isManageModalOpen]);

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
      {/* ── 1. FLOATING QUICK CONSENT BANNER (Clear of Bottom Center Scan Button) ── */}
      {isVisible && !isManageModalOpen && (
        <div className="fixed inset-x-0 bottom-[calc(88px+env(safe-area-inset-bottom))] md:bottom-4 z-35 p-3 sm:p-4 pointer-events-none">
          <div className="max-w-md mx-auto pointer-events-auto bg-white border border-slate-200 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3 text-slate-800">
            {/* Header with Icon, Title, & Close Button */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-center justify-center shrink-0">
                  <SagaCookieShieldIcon className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <h4 className="text-sm font-bold text-slate-900 leading-tight truncate">
                    Privasi &amp; Penghematan Kuota (Egress)
                  </h4>
                  <span className="text-[11px] font-bold text-[#0D5C46] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 inline-block mt-0.5">
                    Mode Hemat Egress Aktif
                  </span>
                </div>
              </div>

              {/* Close / Dismiss Button */}
              <button
                type="button"
                onClick={handleDismissBanner}
                className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-600 hover:text-slate-900 flex items-center justify-center cursor-pointer transition-colors shrink-0"
                aria-label="Tutup banner cookie"
                title="Tutup banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Description */}
            <p className="text-xs text-slate-600 leading-relaxed">
              SAGA menggunakan <strong>cookie mikro (&lt;50 byte)</strong> dan cache lokal HP untuk mengamankan login serta{' '}
              <strong className="text-slate-900">menghemat kuota internet Anda &amp; server hingga 85%</strong>.
            </p>

            {/* Action Buttons: 48px height touch target */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={handleAcceptAll}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.98] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Terima &amp; Hemat Egress</span>
              </button>

              <button
                type="button"
                onClick={() => setIsManageModalOpen(true)}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-800 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 border border-slate-200 cursor-pointer"
              >
                <Sliders className="w-3.5 h-3.5 text-slate-600" />
                <span>Kelola Preferensi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── 2. MODAL KELOLA PREFERENSI COOKIE & EGRESS SAVER (100dvh Infinix Note 8) ── */}
      {isManageModalOpen && (
        <div
          className="fixed inset-0 z-99999 flex items-center justify-center p-0 sm:p-4 bg-slate-950/70"
          role="dialog"
          aria-modal="true"
          aria-label="Kelola Preferensi Cookie"
        >
          <div className="w-full h-dvh sm:h-auto sm:max-h-[90dvh] sm:max-w-md bg-white rounded-none sm:rounded-3xl shadow-2xl border-0 sm:border border-slate-200 flex flex-col overflow-hidden text-slate-800">
            {/* Sticky Header */}
            <div className="shrink-0 bg-white border-b border-slate-100 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-[#0D5C46] text-white flex items-center justify-center shrink-0">
                  <Sliders className="w-4 h-4 text-emerald-200" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 leading-tight truncate">
                    Kelola Preferensi Cookie
                  </h3>
                  <p className="text-[11px] text-slate-500 font-mono truncate">
                    Ukuran Cookie: &lt; 40 Bytes • Zero Egress Inflation
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsManageModalOpen(false)}
                aria-label="Tutup preferensi cookie"
                className="w-11 h-11 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer transition-colors shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Scrollable Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {/* Category 1: Essential (Wajib) */}
              <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-slate-200 flex items-start justify-between gap-3">
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <SagaDeviceShieldIcon className="w-4 h-4 shrink-0" />
                    <h5 className="text-xs font-bold text-slate-900">Cookie Esensial (Wajib)</h5>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Menyimpan token sesi login, keamanan anti-CSRF, dan otentikasi identitas guru. Tidak dapat dinonaktifkan.
                  </p>
                </div>
                <span className="text-[10px] font-bold uppercase text-slate-600 bg-slate-200 px-2 py-1 rounded-lg shrink-0 mt-1">
                  Selalu Aktif
                </span>
              </div>

              {/* Category 2: Egress Saver (Rekomendasi) */}
              <div
                onClick={() => togglePref('egressSaver')}
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  prefs.egressSaver
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <SagaOfflineBoltIcon className="w-4 h-4 shrink-0" />
                    <h5 className="text-xs font-bold text-slate-900">Mode Hemat Egress Server</h5>
                    <span className="text-[10px] font-bold text-[#0D5C46] bg-emerald-100 px-1.5 py-0.5 rounded">
                      Rekomendasi
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Memprioritaskan cache lokal (localStorage) untuk daftar guru &amp; poin, memangkas query Supabase berulang hingga 85%.
                  </p>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 mt-1 ${
                    prefs.egressSaver ? 'bg-[#0D5C46]' : 'bg-slate-300'
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
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  prefs.offlineSync
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Database className={`w-4 h-4 ${prefs.offlineSync ? 'text-[#0D5C46]' : 'text-slate-400'}`} />
                    <h5 className="text-xs font-bold text-slate-900">Penyimpanan Offline (IndexedDB)</h5>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Menyimpan cadangan presensi lokal via Dexie DB agar guru tetap bisa scan absensi saat sinyal sekolah hilang.
                  </p>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 mt-1 ${
                    prefs.offlineSync ? 'bg-[#0D5C46]' : 'bg-slate-300'
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
                className={`p-3.5 rounded-2xl border transition-colors cursor-pointer flex items-start justify-between gap-3 ${
                  prefs.performance
                    ? 'bg-emerald-50 border-emerald-300'
                    : 'bg-white border-slate-200'
                }`}
              >
                <div className="space-y-0.5 flex-1">
                  <div className="flex items-center gap-1.5">
                    <Activity className={`w-4 h-4 ${prefs.performance ? 'text-[#0D5C46]' : 'text-slate-400'}`} />
                    <h5 className="text-xs font-bold text-slate-900">Diagnosa Performa &amp; Edge CDN</h5>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Mengukur kecepatan jaringan Vercel Edge untuk mendeteksi kendala koneksi sebelum absensi berlangsung.
                  </p>
                </div>
                <div
                  className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors shrink-0 mt-1 ${
                    prefs.performance ? 'bg-[#0D5C46]' : 'bg-slate-300'
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

            {/* Sticky Bottom Actions */}
            <div className="shrink-0 bg-white border-t border-slate-100 px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] flex flex-col sm:flex-row gap-2">
              <button
                type="button"
                onClick={handleSavePreferences}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-[#0D5C46] hover:bg-[#094736] active:scale-[0.98] text-white font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Check className="w-4 h-4 text-emerald-300" />
                <span>Simpan Preferensi</span>
              </button>
              <button
                type="button"
                onClick={handleAcceptAll}
                className="w-full min-h-12 py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-900 border border-slate-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
