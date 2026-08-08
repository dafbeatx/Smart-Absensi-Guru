import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { FeatureGate } from '../../../components/ui/FeatureGate';
import { Sidebar } from '../../../components/ui/Sidebar';
import type { SidebarItem } from '../../../components/ui/Sidebar';
import { TeacherManagementTable } from '../../admin/components/TeacherManagementTable';
import { ProviderFactory } from '../../../providers/provider-factory';
import { TopDashboardNavbar } from '../../../components/dashboard/TopDashboardNavbar';
import { ExecutiveDashboardOverview } from '../../../components/dashboard/ExecutiveDashboardOverview';
import { DevTestPage } from '../../admin/pages/DevTestPage';
import { getTodayDateInJakarta, isDateOffDay } from '../../../utils/time.utils';
import { isDevTestModeEnabled } from '../../../utils/dev-test.utils';
import type { LeaveRequest, UserProfile, AttendanceRecord } from '../../../types/database.types';

export interface KepsekDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const KepsekDashboardPage: React.FC<KepsekDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);

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
        const fetched = await LeaveRepository.getPendingLeaves(tkn);
        setPendingRequests(fetched || []);
      }
    } catch (err) {
      console.warn('Gagal memuat pengajuan izin:', err);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      const provider = ProviderFactory.getProvider();
      const tkn = useAuthStore.getState().token || '';
      if (tkn) {
        const todayStr = getTodayDateInJakarta();
        const records = await provider.getDailyAttendance(todayStr, tkn);
        setAttendanceRecords(records || []);
      }
    } catch (err) {
      console.warn('Kepsek fetch attendance records error:', err);
    }
  };

  useEffect(() => {
    const fetchUsersFromBackend = async () => {
      try {
        const provider = ProviderFactory.getProvider();
        const tkn = useAuthStore.getState().token || '';
        const fetched = await provider.getAllUsers(tkn);
        if (fetched && fetched.length > 0) {
          setTeachers(fetched);
          localStorage.setItem('smart_absensi_teachers', JSON.stringify(fetched));
        }
      } catch (err) {
        console.warn('Backend fetch users fallback:', err);
      }
    };
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

    fetchUsersFromBackend();
    fetchPendingRequests();
    fetchAttendanceRecords();

    const handleScannedEvent = () => {
      fetchAttendanceRecords();
    };

    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_teachers_updated', handleSyncTeachers);
    window.addEventListener('storage', handleSyncTeachers);

    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_teachers_updated', handleSyncTeachers);
      window.removeEventListener('storage', handleSyncTeachers);
    };
  }, []);

  const todayStr = getTodayDateInJakarta();
  const offCheck = isDateOffDay(todayStr);

  // Dynamic calculation of teachers who haven't absented today (Returns [] on Weekends / Holidays)
  const unabsentedTeachers = offCheck.isOff
    ? []
    : teachers.filter((t) => {
        const hasAttended = attendanceRecords.some(
          (r) => r.user_id === t.id && (r.status === 'HADIR' || r.status === 'TERLAMBAT' || r.status === 'IZIN' || r.status === 'SAKIT' || r.status === 'DINAS_LUAR')
        );
        return !hasAttended;
      });

  const sidebarItems: SidebarItem[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '🏠' },
    { id: 'ACCOUNT_APPLICATIONS', label: 'Account Applications', icon: '👥' },
    { id: 'APPROVALS', label: 'Persetujuan Izin/Cuti', icon: '📝', badge: pendingRequests.length, hasDropdown: true },
    { id: 'UNABSENTED', label: 'Daftar Belum Absen', icon: '⚠️', badge: unabsentedTeachers.length },
    ...(isDevTestModeEnabled() ? [{ id: 'DEV_TEST', label: 'Mode Tes Developer', icon: '🧪' }] : []),
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#023246] flex flex-col lg:flex-row dashboard-density-scaled">
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
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          {/* TAB 1: EXECUTIVE DASHBOARD OVERVIEW (DEFAULT) */}
          {(activeTab === 'DASHBOARD' || activeTab === 'OVERVIEW') && (
            <ExecutiveDashboardOverview
              roleTitle="Kepala Sekolah"
              teachers={teachers}
              pendingRequests={pendingRequests}
              attendanceRecords={attendanceRecords}
              onOpenScanner={onOpenScanner}
              onSwitchToGuruView={onSwitchToGuruView}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          )}

          {/* TAB 2: ACCOUNT APPLICATIONS */}
          {(activeTab === 'ACCOUNT_APPLICATIONS' || activeTab === 'TEACHERS') && (
            <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} />
          )}

          {/* TAB 3: APPROVALS */}
          {(activeTab === 'APPROVALS' || activeTab === 'APPROVAL') && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base">📝 Approval Pengajuan Izin / Cuti Guru</h3>
              <PendingApprovalWidget requests={pendingRequests} teachers={teachers} onRefresh={fetchPendingRequests} />
            </div>
          )}

          {/* TAB 4: UNABSENTED */}
          {activeTab === 'UNABSENTED' && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base flex items-center justify-between">
                <span>⚠️ Daftar Guru & Staf Belum Absen</span>
                <span className="text-xs font-semibold text-slate-500">{unabsentedTeachers.length} Orang</span>
              </h3>

              {isDateOffDay(getTodayDateInJakarta()).isOff && (
                <div className="p-4 bg-sky-50 border border-sky-200 rounded-2xl text-sky-900 text-xs space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <span>🏖️</span> Hari Ini Libur Sekolah ({isDateOffDay(getTodayDateInJakarta()).reason})
                  </div>
                  <p className="text-[11px] text-sky-700 font-medium">Tidak ada jadwal / kewajiban presensi bagi guru dan staf hari ini.</p>
                </div>
              )}

              {unabsentedTeachers.length === 0 ? (
                <div className="p-6 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-medium space-y-1">
                  <span className="text-xl block">✅</span>
                  <p className="font-bold text-[#023246]">Semua Guru & Staf Telah Absen Hari Ini</p>
                  <p className="text-[11px] text-slate-400">Seluruh personil sekolah yang terdaftar telah memiliki catatan absensi.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {unabsentedTeachers.map((t) => (
                    <div key={t.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                      <div className="space-y-0.5">
                        <p className="font-extrabold text-[#023246] text-sm">{t.full_name}</p>
                        <p className="text-xs text-slate-500 font-medium">{t.position || 'Guru / Staf'} • {t.phone_number || '-'}</p>
                      </div>
                      <FeatureGate flag="ENABLE_WHATSAPP">
                        <a
                          href={`https://wa.me/62${String(t.phone_number || '').replace(/^0/, '')}?text=Assalamu'alaikum%20Bapak/Ibu%20${encodeURIComponent(t.full_name)},%20mohon%20konfirmasi%20kehadiran%20hari%20ini.`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-xs"
                        >
                          💬 Hubungi WA
                        </a>
                      </FeatureGate>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: DEVELOPER TEST MODE */}
          {activeTab === 'DEV_TEST' && (
            <DevTestPage onBackToDashboard={() => setActiveTab('DASHBOARD')} />
          )}
        </main>
      </div>

      {/* ── MOBILE BOTTOM NAVIGATION DOCK (Screen 1 Mockup) ────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-lg border-t border-[#D4D4CE]/30 px-3 py-1.5 z-40 shadow-xl lg:hidden">
        <div className="flex items-center justify-around relative">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'DASHBOARD' || activeTab === 'OVERVIEW' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('UNABSENTED')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'UNABSENTED' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">⬡</span>
            <span>Live Tracking</span>
          </button>

          {/* Center FAB Poster QR Button */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={() => onOpenScanner && onOpenScanner()}
              className="w-14 h-14 rounded-full bg-[#023246] text-white flex items-center justify-center text-xl shadow-xl shadow-[#023246]/30 ring-4 ring-white active:scale-95 transition-transform cursor-pointer"
              title="Poster QR"
            >
              🔲
            </button>
            <span className="text-[10px] font-extrabold text-[#023246] mt-0.5">Poster QR</span>
          </div>

          <button
            onClick={() => setActiveTab('APPROVALS')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 relative transition-colors cursor-pointer ${
              activeTab === 'APPROVALS' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">☑️</span>
            <span>Approval</span>
            {pendingRequests.length > 0 ? (
              <span className="absolute top-1 right-3.5 px-1 py-0.2 text-[8px] font-black bg-red-500 text-white rounded-full min-w-3 text-center animate-pulse">
                {pendingRequests.length}
              </span>
            ) : null}
          </button>

          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 text-slate-400 font-semibold cursor-pointer"
          >
            <span className="text-lg">🎛️</span>
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </div>
  );
};
