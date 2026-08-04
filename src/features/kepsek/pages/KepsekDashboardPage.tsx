import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { FeatureGate } from '../../../components/ui/FeatureGate';
import { Sidebar } from '../../../components/ui/Sidebar';
import type { SidebarItem } from '../../../components/ui/Sidebar';
import { TeacherManagementTable } from '../../admin/components/TeacherManagementTable';
import { ProviderFactory } from '../../../providers/provider-factory';
import { TopDashboardNavbar } from '../../../components/dashboard/TopDashboardNavbar';
import { ExecutiveDashboardOverview } from '../../../components/dashboard/ExecutiveDashboardOverview';
import type { LeaveRequest, UserProfile } from '../../../types/database.types';

export interface KepsekDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const KepsekDashboardPage: React.FC<KepsekDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

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
    fetchUsersFromBackend();
  }, []);

  const mockPendingApprovals: LeaveRequest[] = [
    {
      id: 'leave_101',
      user_id: 'usr_1002',
      leave_type: 'SAKIT',
      start_date: '2026-07-30',
      end_date: '2026-07-31',
      reason: 'Demam tinggi dan istirahat dokter',
      attachment_url: 'https://drive.google.com/mock-surat-dokter.pdf',
      approval_status: 'PENDING',
      approval_deadline: '2026-08-01T00:00:00Z',
      created_at: new Date().toISOString(),
    },
  ];

  const mockUnabsented: UserProfile[] = [
    {
      id: 'usr_1003',
      nip: '198803152015032004',
      full_name: 'Dra. Siti Rahmawati',
      phone_number: '081298765432',
      role: 'GURU',
      position: 'Guru Bahasa Indonesia',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ];

  const sidebarItems: SidebarItem[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '🏠' },
    { id: 'ACCOUNT_APPLICATIONS', label: 'Account Applications', icon: '👥', badge: teachers.length },
    { id: 'APPROVALS', label: 'Persetujuan Izin/Cuti', icon: '📝', badge: mockPendingApprovals.length, hasDropdown: true },
    { id: 'UNABSENTED', label: 'Daftar Belum Absen', icon: '⚠️', badge: mockUnabsented.length },
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#023246] flex flex-col lg:flex-row">
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
      <div className="flex-1 flex flex-col min-w-0 lg:ml-64">
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
              onOpenScanner={onOpenScanner}
              onSwitchToGuruView={onSwitchToGuruView}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          )}

          {/* TAB 2: ACCOUNT APPLICATIONS */}
          {activeTab === 'ACCOUNT_APPLICATIONS' && (
            <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} />
          )}

          {/* TAB 3: APPROVALS */}
          {activeTab === 'APPROVALS' && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base">📝 Approval Pengajuan Izin / Cuti Guru</h3>
              <PendingApprovalWidget />
            </div>
          )}

          {/* TAB 4: UNABSENTED */}
          {activeTab === 'UNABSENTED' && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base">⚠️ Daftar Guru & Staf Belum Absen</h3>
              <div className="space-y-2">
                {mockUnabsented.map((t) => (
                  <div key={t.id} className="flex items-center justify-between p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                    <div className="space-y-0.5">
                      <p className="font-extrabold text-[#023246] text-sm">{t.full_name}</p>
                      <p className="text-xs text-slate-500 font-medium">{t.position} • {t.phone_number}</p>
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
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
