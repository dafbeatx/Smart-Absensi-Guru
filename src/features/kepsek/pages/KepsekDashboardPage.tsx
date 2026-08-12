import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { useToastStore } from '../../../store/useToastStore';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { Sidebar } from '../../../components/ui/Sidebar';
import type { SidebarItem } from '../../../components/ui/Sidebar';
import { TeacherManagementTable } from '../../admin/components/TeacherManagementTable';
import { QRCodeGeneratorModal } from '../../admin/components/QRCodeGeneratorModal';
import { ProviderFactory } from '../../../providers/provider-factory';
import { TopDashboardNavbar } from '../../../components/dashboard/TopDashboardNavbar';
import { ExecutiveDashboardOverview } from '../../../components/dashboard/ExecutiveDashboardOverview';
import { DevTestPage } from '../../admin/pages/DevTestPage';
import { getTodayDateInJakarta } from '../../../utils/time.utils';
import { isDevTestModeEnabled } from '../../../utils/dev-test.utils';
import { AnalyticsService } from '../../../services/analytics.service';
import type { LeaveRequest, UserProfile, AttendanceRecord } from '../../../types/database.types';

export interface KepsekDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const KepsekDashboardPage: React.FC<KepsekDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, logout } = useAuthStore();
  const { showToast } = useToastStore();
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);

  // Data Source Sync Status States
  const [dataSyncStatus, setDataSyncStatus] = useState<'LIVE' | 'OFFLINE_CACHED' | 'ERROR_FALLBACK'>(() => {
    const saved = localStorage.getItem('smart_absensi_teachers');
    return saved ? 'OFFLINE_CACHED' : 'ERROR_FALLBACK';
  });
  const [lastSyncedTime, setLastSyncedTime] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  // Attendance Records Sync Status States
  const [attendanceSyncStatus, setAttendanceSyncStatus] = useState<'SYNCED' | 'ERROR' | 'SYNCING'>('SYNCED');
  const [attendanceErrorMsg, setAttendanceErrorMsg] = useState<string | null>(null);
  const [attendanceLastSynced, setAttendanceLastSynced] = useState<string | null>(null);

  const [teachers, setTeachers] = useState<UserProfile[]>(() => {
    const saved = localStorage.getItem('smart_absensi_teachers');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {
        console.error('Failed to parse saved teachers:', e);
      }
    }
    return [
      {
        id: 'usr_1001',
        nip: '198507122010011008',
        full_name: 'Ahmad Hidayat, S.Pd.',
        phone_number: '081234567890',
        role: 'GURU',
        position: 'Guru Matematika Utama',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
      {
        id: 'usr_1002',
        nip: '199002142018021002',
        full_name: 'Budi Santoso, M.Pd.',
        phone_number: '081398765432',
        role: 'GURU',
        position: 'Guru Fisika',
        avatar_url: null,
        is_active: true,
        created_at: new Date().toISOString(),
      },
    ];
  });

  const handleTeachersChange = (updated: UserProfile[]) => {
    setTeachers(updated);
    localStorage.setItem('smart_absensi_teachers', JSON.stringify(updated));
    window.dispatchEvent(new Event('smart_absensi_teachers_updated'));
  };

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

  const fetchPendingRequests = async () => {
    try {
      const tkn = useAuthStore.getState().token || '';
      if (tkn) {
        const fetched = await LeaveRepository.getAllLeaves(tkn);
        setAllLeaves(fetched || []);
        setPendingRequests(
          (fetched || []).filter(
            (r) => r.approval_status === 'PENDING' || r.approval_status === 'SUBMITTED' || r.approval_status === 'UNDER_REVIEW' || !r.approval_status
          )
        );
      }
    } catch (err) {
      console.warn('Gagal memuat pengajuan izin:', err);
    }
  };

  const fetchAttendanceRecords = async () => {
    setAttendanceSyncStatus('SYNCING');
    try {
      const provider = ProviderFactory.getProvider();
      const tkn = useAuthStore.getState().token || '';
      if (tkn) {
        const todayStr = getTodayDateInJakarta();
        const records = await provider.getDailyAttendance(todayStr, tkn);
        setAttendanceRecords(records || []);
        setAttendanceSyncStatus('SYNCED');
        setAttendanceErrorMsg(null);
        setAttendanceLastSynced(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (err: unknown) {
      console.warn('Kepsek fetch attendance records error:', err);
      setAttendanceSyncStatus('ERROR');
      const friendlyMsg = err instanceof Error ? err.message : 'Koneksi database presensi terganggu.';
      setAttendanceErrorMsg(friendlyMsg);
      showToast(
        'error',
        'Gagal Memuat Presensi Hari Ini',
        'Data presensi harian gagal diperbarui dari server database.'
      );
    }
  };

  const fetchUsersFromBackend = async () => {
    setIsSyncing(true);
    try {
      const provider = ProviderFactory.getProvider();
      const tkn = useAuthStore.getState().token || '';
      const fetched = await provider.getAllUsers(tkn);
      if (fetched && fetched.length > 0) {
        setTeachers(fetched);
        localStorage.setItem('smart_absensi_teachers', JSON.stringify(fetched));
        setDataSyncStatus('LIVE');
        setLastSyncedTime(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
      } else {
        const saved = localStorage.getItem('smart_absensi_teachers');
        setDataSyncStatus(saved ? 'OFFLINE_CACHED' : 'ERROR_FALLBACK');
      }
    } catch (err: unknown) {
      console.warn('Backend fetch users fallback:', err);
      const saved = localStorage.getItem('smart_absensi_teachers');
      setDataSyncStatus(saved ? 'OFFLINE_CACHED' : 'ERROR_FALLBACK');
      showToast(
        'warning',
        'Gagal Memuat Data Server Terupdate',
        'Sistem beralih ke data offline/cache lokal. Data mungkin tidak 100% realtime.'
      );
    } finally {
      setIsSyncing(false);
    }
  };

  const handleManualRefresh = () => {
    fetchUsersFromBackend();
    fetchPendingRequests();
    fetchAttendanceRecords();
  };

  useEffect(() => {
    const handleSyncTeachers = () => {
      const saved = localStorage.getItem('smart_absensi_teachers');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) setTeachers(parsed);
        } catch (e) {
          console.error('Failed to parse teachers:', e);
        }
      } else {
        fetchUsersFromBackend();
      }
    };

    const handleLeaveUpdated = () => {
      fetchPendingRequests();
    };

    fetchUsersFromBackend();
    fetchPendingRequests();
    fetchAttendanceRecords();

    const handleScannedEvent = () => {
      fetchAttendanceRecords();
    };

    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_leave_updated', handleLeaveUpdated);
    window.addEventListener('smart_absensi_teachers_updated', handleSyncTeachers);
    window.addEventListener('storage', handleSyncTeachers);
    window.addEventListener('storage', handleLeaveUpdated);

    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_leave_updated', handleLeaveUpdated);
      window.removeEventListener('smart_absensi_teachers_updated', handleSyncTeachers);
      window.removeEventListener('storage', handleSyncTeachers);
      window.removeEventListener('storage', handleLeaveUpdated);
    };
  }, []);

  const todayStr = getTodayDateInJakarta();

  // Dynamic calculation of active GURU teachers who haven't absented today (Returns [] on Weekends / Holidays)
  const unabsentedTeachers = AnalyticsService.getUnabsentedTeachers(
    todayStr,
    teachers,
    attendanceRecords,
    allLeaves
  );

  const sidebarItems: SidebarItem[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '🏠' },
    { id: 'ACCOUNT_APPLICATIONS', label: 'Manajemen Guru & Staf', icon: '👥' },
    { id: 'APPROVALS', label: 'Persetujuan Izin/Cuti', icon: '📝', badge: pendingRequests.length, hasDropdown: true },
    { id: 'UNABSENTED', label: 'Daftar Belum Absen', icon: '⚠️', badge: unabsentedTeachers.length },
    ...(isDevTestModeEnabled() ? [{ id: 'DEV_TEST', label: 'Mode Tes Developer', icon: '🧪' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#023246] flex flex-col lg:flex-row dashboard-density-scaled overflow-x-hidden">
      {/* ── LEFT SIDEBAR PANEL (DESKTOP & MOBILE) ────────────────────────── */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title={user?.full_name || 'Kepala Sekolah'}
        roleBadge="👑 Executive Principal Access"
        roleColor="bg-[#287094]/30 text-[#F6F6F6] border-[#287094]"
        items={sidebarItems}
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as typeof activeTab)}
        onSwitchToGuruView={onSwitchToGuruView}
        onOpenScanner={onOpenScanner}
        onLogout={logout}
        isDesktopFixed={true}
      />

      {/* ── RIGHT MAIN CONTAINER ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 lg:ml-56">
        {/* Top Header Navbar */}
        <TopDashboardNavbar
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onLogout={logout}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-3.5 sm:p-6 pb-28 sm:pb-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
          {/* Data Source Sync Status Indicator Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2.5 p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="text-xs font-bold text-slate-700">Sumber Data:</span>
              {dataSyncStatus === 'LIVE' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 font-extrabold text-[11px]">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                  Live dari Server Database
                </span>
              )}
              {dataSyncStatus === 'OFFLINE_CACHED' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 font-extrabold text-[11px]">
                  <span>⚠️</span> Mode Offline / Cache Lokal
                </span>
              )}
              {dataSyncStatus === 'ERROR_FALLBACK' && (
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 text-red-800 border border-red-200 font-extrabold text-[11px]">
                  <span>🚫</span> Gagal Terhubung Server (Data Stub)
                </span>
              )}
              {lastSyncedTime && (
                <span className="text-[11px] text-slate-500 font-mono font-medium">
                  Terakhir diperbarui: {lastSyncedTime} WIB
                </span>
              )}
            </div>

            <button
              onClick={handleManualRefresh}
              disabled={isSyncing || attendanceSyncStatus === 'SYNCING'}
              className="px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 active:scale-95 text-white text-xs font-extrabold transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              <span className={isSyncing || attendanceSyncStatus === 'SYNCING' ? 'animate-spin' : ''}>🔄</span>
              {isSyncing || attendanceSyncStatus === 'SYNCING' ? 'Menyinkronkan...' : 'Sinkronkan Data Server'}
            </button>
          </div>

          {/* ATTENDANCE FETCH ERROR BANNER */}
          {attendanceSyncStatus === 'ERROR' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-red-900 flex flex-wrap items-center justify-between gap-3 shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-red-100 border border-red-200 flex items-center justify-center text-lg shrink-0">
                  ⚠️
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-red-950">Gagal Memuat Data Presensi Server</h4>
                  <p className="text-xs text-red-700 font-medium mt-0.5">
                    {attendanceErrorMsg || 'Koneksi ke database presensi terganggu. Data presensi yang ditampilkan mungkin tidak terbaru.'}
                    {attendanceLastSynced && ` (Pembaruan terakhir: ${attendanceLastSynced} WIB)`}
                  </p>
                </div>
              </div>
              <button
                onClick={handleManualRefresh}
                disabled={isSyncing}
                className="px-3.5 py-1.5 rounded-xl bg-red-600 hover:bg-red-700 active:scale-95 text-white text-xs font-bold transition-all shrink-0"
              >
                🔄 Muat Ulang Presensi
              </button>
            </div>
          )}

          {/* TAB 1: EXECUTIVE DASHBOARD OVERVIEW (DEFAULT) */}
          {(activeTab === 'DASHBOARD' || activeTab === 'OVERVIEW') && (
            <ExecutiveDashboardOverview
              roleTitle="Kepala Sekolah"
              teachers={teachers}
              pendingRequests={pendingRequests}
              allLeaves={allLeaves}
              attendanceRecords={attendanceRecords}
              onOpenScanner={onOpenScanner}
              onOpenQrGenerator={() => setIsQrGeneratorOpen(true)}
              onSwitchToGuruView={onSwitchToGuruView}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          )}

          {/* TAB 2: ACCOUNT APPLICATIONS */}
          {(activeTab === 'ACCOUNT_APPLICATIONS' || activeTab === 'TEACHERS') && (
            <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} isReadOnly={true} />
          )}

          {/* TAB 3: APPROVALS */}
          {(activeTab === 'APPROVALS' || activeTab === 'APPROVAL') && (
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base">📝 Approval Pengajuan Izin / Cuti Guru</h3>
              <PendingApprovalWidget requests={allLeaves.length > 0 ? allLeaves : pendingRequests} teachers={teachers} onRefresh={fetchPendingRequests} />
            </div>
          )}

          {/* TAB 4: UNABSENTED */}
          {activeTab === 'UNABSENTED' && (
            <div className="bg-white p-4 sm:p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-extrabold text-[#023246] text-base">⚠️ Daftar Guru Belum Absen Masuk Hari Ini</h3>
                  <p className="text-xs text-slate-500 font-medium">Monitoring kehadiran guru secara real-time</p>
                </div>
                <span className="px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full font-bold text-xs">
                  {unabsentedTeachers.length} Guru
                </span>
              </div>

              {unabsentedTeachers.length === 0 ? (
                <div className="p-8 text-center bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-2">
                  <span className="text-3xl">🎉</span>
                  <p className="font-bold text-emerald-900 text-sm">Semua Guru Sudah Melakukan Absensi</p>
                  <p className="text-xs text-emerald-700">Seluruh staf pengajar yang aktif telah terdata masuk atau izin hari ini.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {unabsentedTeachers.map((t) => (
                    <div key={t.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-[#023246] text-white flex items-center justify-center font-black text-sm shrink-0 shadow-2xs">
                        {t.full_name.charAt(0)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 text-xs truncate">{t.full_name}</p>
                        <p className="text-[10px] text-slate-500 truncate">{t.position || 'Guru Pengajar'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DEV TEST MODE */}
          {activeTab === 'DEV_TEST' && <DevTestPage onBackToDashboard={() => setActiveTab('DASHBOARD')} />}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION BAR ───────────────────────────────────── */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 z-40 px-3 py-1 shadow-lg">
        <div className="flex items-center justify-around max-w-md mx-auto relative">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-all cursor-pointer active:scale-95 ${
              activeTab === 'DASHBOARD' || activeTab === 'OVERVIEW' ? 'text-[#023246] font-black scale-105' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span>Beranda</span>
          </button>

          <button
            onClick={() => setActiveTab('UNABSENTED')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-all cursor-pointer active:scale-95 ${
              activeTab === 'UNABSENTED' ? 'text-[#023246] font-black scale-105' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">⬡</span>
            <span>Live Tracking</span>
          </button>

          {/* Center FAB Scan QR Button */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={() => onOpenScanner && onOpenScanner()}
              className="w-13 h-13 sm:w-14 sm:h-14 rounded-2xl bg-linear-to-tr from-[#023246] to-[#287094] text-white flex items-center justify-center text-xl shadow-lg shadow-[#023246]/30 ring-4 ring-white active:scale-95 transition-transform cursor-pointer"
              title="Scan QR Absensi"
            >
              📷
            </button>
            <span className="text-[9px] font-extrabold text-[#023246] mt-0.5">Scan QR</span>
          </div>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 relative transition-all cursor-pointer active:scale-95 ${
              activeTab === 'APPROVALS' || activeTab === 'APPROVAL' ? 'text-[#023246] font-black scale-105' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">☑️</span>
            <span>Approval</span>
            {pendingRequests.length > 0 ? (
              <span className="absolute top-0.5 right-2 px-1.5 py-0.2 text-[8px] font-black bg-red-500 text-white rounded-full min-w-4 text-center animate-pulse shadow-2xs">
                {pendingRequests.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 text-slate-400 font-semibold cursor-pointer active:scale-95 hover:text-[#023246]"
          >
            <span className="text-lg">🎛️</span>
            <span>Menu</span>
          </button>
        </div>
      </nav>

      {/* Official QR Code Poster Generator Modal */}
      <QRCodeGeneratorModal
        isOpen={isQrGeneratorOpen}
        onClose={() => setIsQrGeneratorOpen(false)}
      />
    </div>
  );
};
