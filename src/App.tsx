import React, { Suspense, useState, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ForceChangePinModal } from './features/auth/components/ForceChangePinModal';
import { ToastContainer } from './components/ui/Toast';
import { AIAssistantDrawer } from './components/ui/AIAssistantDrawer';
import { AppInstallModal } from './components/ui/AppInstallModal';
import { QueueMonitor } from './components/ui/QueueMonitor';
import { GPSService } from './services/gps.service';
import { AuthRepository } from './repositories/AuthRepository';
import { TelegramService } from './services/telegram.service';
import { getTodayDateInJakarta } from './utils/time.utils';
import { PointRewardCelebrationOverlay } from './components/ui/PointRewardCelebrationOverlay';
import { CookieConsentBanner } from './components/ui/CookieConsentBanner';
import { usePointRewardStore } from './store/usePointRewardStore';
import { useSettingsStore } from './store/useSettingsStore';

// Helper: retry a dynamic import once by reloading the page when the chunk
// is missing (stale deployment).  Uses sessionStorage to prevent infinite loops.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  chunkName: string
): React.LazyExoticComponent<T> {
  return React.lazy(() =>
    factory().catch((err: unknown) => {
      const key = `chunk_retry_${chunkName}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        window.location.reload();
      }
      throw err; // re-throw so ErrorBoundary still catches if reload didn't help
    })
  );
}

// Code-split role dashboard pages lazily to optimize initial bundle size (~21 KB initial payload)
const GuruDashboardPage = lazyRetry(
  () =>
    import('./features/dashboard/pages/GuruDashboardPage').then((m) => ({
      default: m.GuruDashboardPage,
    })),
  'GuruDashboardPage'
);

const KepsekDashboardPage = lazyRetry(
  () =>
    import('./features/kepsek/pages/KepsekDashboardPage').then((m) => ({
      default: m.KepsekDashboardPage,
    })),
  'KepsekDashboardPage'
);

const AdminDashboardPage = lazyRetry(
  () =>
    import('./features/admin/pages/AdminDashboardPage').then((m) => ({
      default: m.AdminDashboardPage,
    })),
  'AdminDashboardPage'
);

const QRScannerOverlay = lazyRetry(
  () =>
    import('./features/attendance/components/QRScannerOverlay').then((m) => ({
      default: m.QRScannerOverlay,
    })),
  'QRScannerOverlay'
);

const TestRunnerModal = lazyRetry(
  () =>
    import('./components/dev/TestRunnerModal').then((m) => ({
      default: m.TestRunnerModal,
    })),
  'TestRunnerModal'
);

const WeeklyResearchSurveyModal = lazyRetry(
  () =>
    import('./features/survey/components/WeeklyResearchSurveyModal').then((m) => ({
      default: m.WeeklyResearchSurveyModal,
    })),
  'WeeklyResearchSurveyModal'
);

const MonthlySurveyAnalyticsModal = lazyRetry(
  () =>
    import('./features/survey/components/MonthlySurveyAnalyticsModal').then((m) => ({
      default: m.MonthlySurveyAnalyticsModal,
    })),
  'MonthlySurveyAnalyticsModal'
);

const OfficialDocumentVerificationModal = lazyRetry(
  () =>
    import('./components/ui/OfficialDocumentVerificationModal').then((m) => ({
      default: m.OfficialDocumentVerificationModal,
    })),
  'OfficialDocumentVerificationModal'
);

import {
  shouldTriggerFridaySurvey,
  shouldSendDailySurveyReminder,
  markDailySurveyReminderSent,
} from './services/research-survey.service';
import { NotificationService } from './services/notification-permission.service';

export const App: React.FC = () => {
  const { isAuthenticated, user, token } = useAuthStore();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPreviewGuruMode, setIsPreviewGuruMode] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isPreviewScannerBlocked, setIsPreviewScannerBlocked] = useState(false);
  const [isFridaySurveyOpen, setIsFridaySurveyOpen] = useState(false);
  const [isSurveyAnalyticsOpen, setIsSurveyAnalyticsOpen] = useState(false);
  const [verificationDocInfo, setVerificationDocInfo] = useState<{
    isOpen: boolean;
    docNo: string;
    type?: string;
    month?: string;
    year?: string;
    teacher?: string;
    school?: string;
    signatory?: string;
  } | null>(null);

  const userId = user?.id;
  const userPhone = user?.phone_number;
  const userNip = user?.nip;
  const userRole = user?.role;

  const isCelebrationOpen = usePointRewardStore((s) => s.isOpen);
  const celebrationData = usePointRewardStore((s) => s.data);
  const closeCelebration = usePointRewardStore((s) => s.closeCelebration);

  const appName = useSettingsStore((s) => s.settings.app_name);

  // Initialize and synchronize dynamic application settings
  useEffect(() => {
    useSettingsStore.getState().loadSettings().catch(() => {});
  }, []);

  useEffect(() => {
    if (appName && typeof document !== 'undefined') {
      document.title = appName;
    }
  }, [appName]);

  // Global listener: Deteksi verifikasi dokumen dari URL scan QR
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const isVerifyRoute =
        window.location.pathname.includes('verify-document') ||
        window.location.hash.includes('verify-document') ||
        params.has('verify-document') ||
        params.has('verify_doc') ||
        params.has('docId');

      const docNo =
        params.get('no') ||
        params.get('code') ||
        params.get('docId') ||
        params.get('verify_doc') ||
        params.get('verify-document');

      if (isVerifyRoute || docNo) {
        setVerificationDocInfo({
          isOpen: true,
          docNo: docNo || '421.3/SAG-BOGOR/9/2026',
          type: params.get('type') || 'REKAP_PRESENSI',
          month: params.get('month') || 'September',
          year: params.get('year') || '2026',
          teacher: params.get('teacher') || undefined,
          school: params.get('school') || undefined,
          signatory: params.get('signatory') || undefined,
        });
      }
    }
  }, []);

  // Global listener: Setiap kali memperoleh poin (Guru, Admin, Kepsek), selalu munculkan pop-up apresiasi cardless
  useEffect(() => {
    const handlePointsUpdated = (e: Event) => {
      const customEvt = e as CustomEvent<{
        id?: string;
        dedupeKey?: string;
        userId?: string;
        teacherName?: string;
        points?: number;
        activity_type?: string;
        title?: string;
        description?: string;
      }>;
      const detail = customEvt.detail;
      if (!detail || !detail.points || detail.points <= 0) return;

      const currentAuthUser = useAuthStore.getState().user;
      if (!currentAuthUser) return;

      // Filter hanya untuk pengguna yang sedang aktif login
      if (detail.userId && detail.userId !== currentAuthUser.id) return;

      const teacherName = detail.teacherName || currentAuthUser.full_name || 'Bapak/Ibu Guru';
      const reason = detail.title || detail.description || 'Apresiasi Poin Kedisiplinan';

      usePointRewardStore.getState().triggerCelebration({
        id: detail.id,
        dedupeKey: detail.dedupeKey || detail.id,
        points: detail.points,
        status: 'HADIR',
        reason: reason,
        breakdown: {
          attendance: detail.activity_type?.includes('CHECK_IN') ? detail.points : undefined,
          checkout: detail.activity_type === 'CHECK_OUT' ? detail.points : undefined,
          piket: detail.activity_type === 'DUTY_PIKET' ? detail.points : undefined,
        },
        teacherName: teacherName,
        timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) + ' WIB',
      });
    };

    window.addEventListener('smart_absensi_points_updated', handlePointsUpdated);
    return () => {
      window.removeEventListener('smart_absensi_points_updated', handlePointsUpdated);
    };
  }, []);

  useEffect(() => {
    // Start Telegram silent background listener for /start and admin Groq AI queries
    TelegramService.init();
    return () => {
      TelegramService.stopPolling();
    };
  }, []);

  useEffect(() => {
    const handleCheckInCompleted = () => {
      if (userId && shouldTriggerFridaySurvey({ userId, action: 'CHECK_IN' })) {
        setIsFridaySurveyOpen(true);
      }
    };

    const handleOpenSurveyAnalytics = () => {
      setIsSurveyAnalyticsOpen(true);
    };

    const handleOpenSurveyModal = () => {
      setIsFridaySurveyOpen(true);
    };

    window.addEventListener('smart_absensi_checkin_completed', handleCheckInCompleted);
    window.addEventListener('smart_absensi_open_survey_analytics', handleOpenSurveyAnalytics);
    window.addEventListener('smart_absensi_open_survey_modal', handleOpenSurveyModal);

    // Deep-link check: URL query ?openSurvey=true atau hash
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('openSurvey') === 'true' || window.location.hash.includes('openSurvey')) {
          setIsFridaySurveyOpen(true);
        }
      } catch {}
    }

    // Evaluasi pengingat harian survey lintas perangkat (Zero Egress - dievaluasi lokal)
    if (userId) {
      if (shouldSendDailySurveyReminder(userId)) {
        NotificationService.notifyPendingSurveyReminder(
          userId,
          user?.full_name || 'Bapak/Ibu Pendidik',
          user?.role || 'GURU'
        );
        markDailySurveyReminderSent(userId);
      }
    }

    // Initial check for Friday: if user already checked in today and hasn't filled the survey
    if (userId) {
      try {
        const raw =
          localStorage.getItem('smart_absensi_today_record') ||
          localStorage.getItem('smart_absensi_my_today_record');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (
            parsed?.check_in_time &&
            shouldTriggerFridaySurvey({ userId, hasCheckedInToday: true })
          ) {
            setIsFridaySurveyOpen(true);
          }
        }
      } catch {}
    }

    return () => {
      window.removeEventListener('smart_absensi_checkin_completed', handleCheckInCompleted);
      window.removeEventListener('smart_absensi_open_survey_analytics', handleOpenSurveyAnalytics);
      window.removeEventListener('smart_absensi_open_survey_modal', handleOpenSurveyModal);
    };
  }, [userId]);

  useEffect(() => {
    // Android Hardware Back Button Listener (Capacitor Native)
    import('@capacitor/app')
      .then(({ App: CapApp }) => {
        CapApp.addListener('backButton', ({ canGoBack }) => {
          if (!canGoBack) {
            CapApp.exitApp();
          } else {
            window.history.back();
          }
        }).catch(console.warn);
      })
      .catch(() => {});

    if (isAuthenticated && token) {
      AuthRepository.verifySession(token)
        .then((latestUser) => {
          const isSameUser =
            latestUser &&
            (latestUser.id === userId ||
              latestUser.phone_number === userPhone ||
              (userNip && latestUser.nip === userNip));
          if (isSameUser && latestUser.role !== userRole) {
            useAuthStore.getState().updateUserProfile({
              role: latestUser.role,
              full_name: latestUser.full_name,
              position: latestUser.position,
            });
          }

          // Send Telegram Web Login notification once per browser session
          if (latestUser && typeof sessionStorage !== 'undefined') {
            const sessionKey = `tg_web_entry_${latestUser.id}_${getTodayDateInJakarta()}`;
            if (!sessionStorage.getItem(sessionKey)) {
              sessionStorage.setItem(sessionKey, '1');
              TelegramService.sendWebLoginNotification({
                teacherName: latestUser.full_name,
                nip: latestUser.nip || undefined,
                role: latestUser.role,
                device: typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser',
              }).catch(console.warn);
            }
          }
        })
        .catch(console.warn);

      GPSService.syncGeofenceSettings().catch(console.warn);
      GPSService.startBackgroundWarmUp();
    }
    return () => {
      GPSService.stopBackgroundWarmUp();
    };
  }, [isAuthenticated, token, userId, userPhone, userNip, userRole]);

  if (!isAuthenticated || !user) {
    return (
      <>
        <LoginPage />
        {verificationDocInfo?.isOpen && (
          <Suspense fallback={null}>
            <OfficialDocumentVerificationModal
              isOpen={verificationDocInfo.isOpen}
              onClose={() => setVerificationDocInfo(null)}
              docNo={verificationDocInfo.docNo}
              docType={verificationDocInfo.type}
              month={verificationDocInfo.month}
              year={verificationDocInfo.year}
              teacherName={verificationDocInfo.teacher}
              schoolName={verificationDocInfo.school}
              signatoryName={verificationDocInfo.signatory}
            />
          </Suspense>
        )}
        <ToastContainer />
      </>
    );
  }

  // Multi-Role Dashboard Router with Lazy Suspense & Admin/Kepsek Preview Switcher
  const renderRoleDashboard = () => {
    // Mode Preview Tampilan Guru untuk Admin/Kepsek
    if (isPreviewGuruMode && (user.role === 'ADMIN' || user.role === 'OPERATOR' || user.role === 'KEPSEK')) {
      return (
        <div>
          {/* Sticky Floating Switch Bar */}
          <div className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>📱 Mode Tampilan Guru (Tersinkronisasi Real-time: {user.full_name})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTestRunnerOpen(true)}
                className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <span>🧪</span> Run Unit Tests
              </button>
              <button
                onClick={() => setIsPreviewGuruMode(false)}
                className="px-3.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1.5 shadow-md active:scale-95 cursor-pointer"
              >
                <span>🔄</span> Kembali ke Dashboard {user.role === 'ADMIN' ? 'Admin' : 'Kepsek'}
              </button>
            </div>
          </div>

          {/* Banner Peringatan Mode Preview */}
          <div className="bg-amber-500/15 border-b border-amber-500/30 px-4 py-2 text-amber-900 text-xs font-bold flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <span>Mode Preview Aktif — Pemindaian QR absensi dinonaktifkan untuk simulasi tampilan {user.role === 'ADMIN' ? 'Admin' : 'Kepsek'}.</span>
            </div>
          </div>

          <GuruDashboardPage
            onOpenScanner={() => setIsPreviewScannerBlocked(true)}
            isPreviewMode={true}
            previewUser={{
              ...user,
              avatar_url: user.avatar_url || null,
              role: 'GURU',
              position: user.position || 'Pendidik / Tenaga Kependidikan',
            }}
          />
        </div>
      );
    }

    switch (user.role) {
      case 'KEPSEK':
        return (
          <KepsekDashboardPage
            onOpenScanner={() => setIsScannerOpen(true)}
            onSwitchToGuruView={() => setIsPreviewGuruMode(true)}
          />
        );
      case 'ADMIN':
      case 'OPERATOR':
        return (
          <AdminDashboardPage
            onOpenScanner={() => setIsScannerOpen(true)}
            onSwitchToGuruView={() => setIsPreviewGuruMode(true)}
          />
        );
      case 'GURU':
      default:
        return <GuruDashboardPage onOpenScanner={() => setIsScannerOpen(true)} />;
    }
  };

  return (
    <>
      <Suspense
        fallback={
          <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
            <div className="text-center space-y-3">
              <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto" />
              <p className="text-xs font-bold text-slate-300">Memuat Dashboard...</p>
            </div>
          </div>
        }
      >
        {renderRoleDashboard()}
      </Suspense>

      {/* Lazy-loaded QR Scanner Modal */}
      {isScannerOpen && (
        <Suspense
          fallback={
            <div className="fixed inset-0 bg-slate-950/90 z-50 flex items-center justify-center text-white">
              <p className="text-xs font-bold animate-pulse">Memuat Kamera Scanner...</p>
            </div>
          }
        >
          <QRScannerOverlay
            isOpen={isScannerOpen}
            onClose={() => setIsScannerOpen(false)}
            onSuccess={() => setIsScannerOpen(false)}
          />
        </Suspense>
      )}

      {/* Mandatory PIN Reset Modal for New/Reset Users */}
      <ForceChangePinModal />

      {/* Dev Suite Unit Test Runner Modal */}
      {isTestRunnerOpen && (
        <Suspense fallback={null}>
          <TestRunnerModal
            isOpen={isTestRunnerOpen}
            onClose={() => setIsTestRunnerOpen(false)}
          />
        </Suspense>
      )}

      {/* Preview Mode QR Scanner Blocked Modal */}
      {isPreviewScannerBlocked && (
        <div
          className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          onClick={() => setIsPreviewScannerBlocked(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl p-6 max-w-xs w-full text-center space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center text-3xl mx-auto">
              📱
            </div>
            <div>
              <h3 className="font-extrabold text-slate-800 text-lg">Mode Preview Aktif</h3>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                Fitur scan QR absensi tidak dapat digunakan dalam Mode Preview Tampilan Guru.
                <br /><br />
                Ini adalah tampilan simulasi untuk Admin/Kepsek. Untuk scan absensi nyata, login menggunakan akun Guru aktif.
              </p>
            </div>
            <button
              onClick={() => setIsPreviewScannerBlocked(false)}
              className="w-full py-2.5 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-2xl text-sm transition-all active:scale-95 cursor-pointer"
            >
              🔙 Kembali ke Preview
            </button>
          </div>
        </div>
      )}

      <QueueMonitor />
      <AIAssistantDrawer />
      <AppInstallModal />
      <ToastContainer />

      {/* 🌟 Global Apresiasi Poin Kedisiplinan Guru, Admin & Kepsek (Floating Cardless Award) */}
      <PointRewardCelebrationOverlay
        isOpen={isCelebrationOpen}
        onClose={closeCelebration}
        data={celebrationData}
      />

      {/* 🍪 Banner Persetujuan & Pengelolaan Cookie Mikro (Hemat Egress Mobile) */}
      <CookieConsentBanner />

      {/* 📋 Mandatory Friday TAM Evaluation Survey Modal (100% Anonymous) */}
      {isFridaySurveyOpen && (
        <Suspense fallback={null}>
          <WeeklyResearchSurveyModal
            isOpen={isFridaySurveyOpen}
            userId={userId || ''}
            userRole={userRole || 'GURU'}
            onCompleted={() => setIsFridaySurveyOpen(false)}
          />
        </Suspense>
      )}

      {/* 📊 Monthly TAM Quantitative Research Analytics Modal (Admin, Kepsek, Guru) */}
      {isSurveyAnalyticsOpen && (
        <Suspense fallback={null}>
          <MonthlySurveyAnalyticsModal
            isOpen={isSurveyAnalyticsOpen}
            onClose={() => setIsSurveyAnalyticsOpen(false)}
          />
        </Suspense>
      )}

      {/* 🛡️ Modal Publik Verifikasi Dokumen Resmi Saat Scan QR */}
      {verificationDocInfo?.isOpen && (
        <Suspense fallback={null}>
          <OfficialDocumentVerificationModal
            isOpen={verificationDocInfo.isOpen}
            onClose={() => setVerificationDocInfo(null)}
            docNo={verificationDocInfo.docNo}
            docType={verificationDocInfo.type}
            month={verificationDocInfo.month}
            year={verificationDocInfo.year}
            teacherName={verificationDocInfo.teacher}
            schoolName={verificationDocInfo.school}
            signatoryName={verificationDocInfo.signatory}
          />
        </Suspense>
      )}
    </>
  );
};

export default App;
