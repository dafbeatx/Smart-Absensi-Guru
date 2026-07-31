import React, { Suspense, useState } from 'react';
import { useAuthStore } from './store/useAuthStore';
import { LoginPage } from './features/auth/pages/LoginPage';
import { ForceChangePinModal } from './features/auth/components/ForceChangePinModal';
import { ToastContainer } from './components/ui/Toast';

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

  if (!isAuthenticated || !user) {
    return (
      <>
        <LoginPage />
        <ToastContainer />
      </>
    );
  }

  // Multi-Role Dashboard Router with Lazy Suspense
  const renderRoleDashboard = () => {
    switch (user.role) {
      case 'KEPSEK':
        return <KepsekDashboardPage onOpenScanner={() => setIsScannerOpen(true)} />;
      case 'ADMIN':
      case 'OPERATOR':
        return <AdminDashboardPage onOpenScanner={() => setIsScannerOpen(true)} />;
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

      <ToastContainer />
    </>
  );
};

export default App;
