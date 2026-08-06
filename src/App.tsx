import React, { Suspense, useState, useEffect } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ForceChangePinModal } from './features/auth/components/ForceChangePinModal';
import { ToastContainer } from './components/ui/Toast';
import { TestRunnerModal } from './components/dev/TestRunnerModal';
import { AIAssistantDrawer } from './components/ui/AIAssistantDrawer';
import { AppInstallModal } from './components/ui/AppInstallModal';
import { GPSService } from './services/gps.service';
import { AuthRepository } from './repositories/AuthRepository';

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


export const App: React.FC = () => {
  const { isAuthenticated, user, token } = useAuthStore();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPreviewGuruMode, setIsPreviewGuruMode] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isPreviewScannerBlocked, setIsPreviewScannerBlocked] = useState(false);

  useEffect(() => {
    if (isAuthenticated && token) {
      AuthRepository.verifySession(token)
        .then((latestUser) => {
          const isSameUser = latestUser && (latestUser.id === user?.id || latestUser.phone_number === user?.phone_number || (user?.nip && latestUser.nip === user?.nip));
          if (isSameUser && latestUser.role !== user?.role) {
            useAuthStore.getState().updateUserProfile({
              role: latestUser.role,
              full_name: latestUser.full_name,
              position: latestUser.position,
            });
          }
        })
        .catch(console.warn);

      GPSService.syncGeofenceSettings().catch(console.warn);
      GPSService.startBackgroundWarmUp();
    }
    return () => {
      GPSService.stopBackgroundWarmUp();
    };
  }, [isAuthenticated, token, user?.role]);

  if (!isAuthenticated || !user) {
    return (
      <>
        <LoginPage />
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
          {/* Sticky Floating Developer Switch Bar */}
          <div className="bg-slate-900 text-white text-xs font-bold px-4 py-2.5 flex items-center justify-between shadow-lg sticky top-0 z-50 border-b border-slate-700">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>📱 Mode Preview Tampilan Guru ({user.role === 'ADMIN' ? 'Admin Access' : 'Kepsek Access'})</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsTestRunnerOpen(true)}
                className="px-3.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <span>🧪</span> Run Unit Tests
              </button>
              <button
                onClick={() => setIsPreviewGuruMode(false)}
                className="px-3.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-extrabold rounded-lg text-[11px] transition-all flex items-center gap-1.5 shadow-md active:scale-95"
              >
                <span>🔄</span> Kembali ke Dashboard {user.role === 'ADMIN' ? 'Admin' : 'Kepsek'}
              </button>
            </div>
          </div>
          <GuruDashboardPage
            onOpenScanner={() => {
              // Blokir scan nyata di mode preview — user preview tidak ada di DB
              setIsPreviewScannerBlocked(true);
            }}
            isPreviewMode={true}
            previewUser={{
              id: 'usr_guru_preview_001',
              nip: '198905202014021003',
              full_name: 'Dafa Maulana, S.Pd (Simulasi)',
              phone_number: '081234567890',
              role: 'GURU',
              position: 'Guru Utama / Pendidik (Preview)',
              avatar_url: null,
              is_active: true,
              created_at: new Date().toISOString(),
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
      <TestRunnerModal
        isOpen={isTestRunnerOpen}
        onClose={() => setIsTestRunnerOpen(false)}
      />

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

      <AIAssistantDrawer />
      <AppInstallModal />
      <ToastContainer />
    </>
  );
};

export default App;
