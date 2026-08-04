import React, { Suspense, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ForceChangePinModal } from './features/auth/components/ForceChangePinModal';
import { ToastContainer } from './components/ui/Toast';
import { TestRunnerModal } from './components/dev/TestRunnerModal';

// Code-split role dashboard pages lazily to optimize initial bundle size (~21 KB initial payload)
const GuruDashboardPage = React.lazy(() =>
  import('./features/dashboard/pages/GuruDashboardPage').then((m) => ({
    default: m.GuruDashboardPage,
  }))
);

const KepsekDashboardPage = React.lazy(() =>
  import('./features/kepsek/pages/KepsekDashboardPage').then((m) => ({
    default: m.KepsekDashboardPage,
  }))
);

const AdminDashboardPage = React.lazy(() =>
  import('./features/admin/pages/AdminDashboardPage').then((m) => ({
    default: m.AdminDashboardPage,
  }))
);

const QRScannerOverlay = React.lazy(() =>
  import('./features/attendance/components/QRScannerOverlay').then((m) => ({
    default: m.QRScannerOverlay,
  }))
);

export const App: React.FC = () => {
  const { isAuthenticated, user } = useAuthStore();
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isPreviewGuruMode, setIsPreviewGuruMode] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);

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
          <GuruDashboardPage onOpenScanner={() => setIsScannerOpen(true)} />
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

      <ToastContainer />
    </>
  );
};

export default App;
