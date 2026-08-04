import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { QueueMonitor } from '../../../components/ui/QueueMonitor';
import { Button } from '../../../components/ui/Button';
import { Sidebar } from '../../../components/ui/Sidebar';
import type { SidebarItem } from '../../../components/ui/Sidebar';
import { AcademicCalendarManagement } from '../components/AcademicCalendarManagement';
import { TeacherManagementTable } from '../components/TeacherManagementTable';
import { AttendanceCorrectionModal } from '../components/AttendanceCorrectionModal';
import { SystemSettingsForm } from '../components/SystemSettingsForm';
import { QRCodeGeneratorModal } from '../components/QRCodeGeneratorModal';
import { AuditLogTable } from '../components/AuditLogTable';
import { DailyAttendanceTracker } from '../components/DailyAttendanceTracker';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { ReportService } from '../../../services/report.service';
import { useToastStore } from '../../../store/useToastStore';
import { ProviderFactory } from '../../../providers/provider-factory';
import { TestRunnerModal } from '../../../components/dev/TestRunnerModal';
import { TopDashboardNavbar } from '../../../components/dashboard/TopDashboardNavbar';
import { ExecutiveDashboardOverview } from '../../../components/dashboard/ExecutiveDashboardOverview';
import type { UserProfile } from '../../../types/database.types';

export interface AdminDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, logout } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedCorrectionTeacher, setSelectedCorrectionTeacher] = useState<UserProfile | undefined>(undefined);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Status absensi pribadi Admin hari ini (mock/state)
  const [adminAttendance] = useState<{
    status: string;
    checkIn: string;
    checkOut: string;
  }>({
    status: 'BELUM_ABSEN',
    checkIn: '',
    checkOut: '',
  });

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
      {
        id: 'usr_1003',
        nip: '197504122003121001',
        full_name: 'Drs. H. M. Yusuf, M.Pd.',
        phone_number: '081298765432',
        role: 'KEPSEK',
        position: 'Kepala Sekolah Utama',
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
        const token = useAuthStore.getState().token || '';
        const fetched = await provider.getAllUsers(token);
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

  const handleExportExcel = async () => {
    await ReportService.generateAndDownloadMonthlyReport(
      'Juli',
      '2026',
      teachers,
      [],
      [],
      []
    );
    showToast('success', 'Export Excel Berhasil!', 'File Excel resmi Multi-Sheet (.xlsx) siap diunduh.');
  };

  const handleExportPDF = async () => {
    await ReportService.generateAndPrintPDFReport(
      'Juli',
      '2026',
      teachers,
      [],
      [],
      []
    );
    showToast('info', 'Dokumen PDF Siap!', 'Jendela cetak / simpan ke PDF telah dibuka.');
  };

  const sidebarItems: SidebarItem[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '🏠' },
    { id: 'ATTENDANCE_TRACKING', label: 'Live Tracking', icon: '👁️' },
    { id: 'TEACHERS', label: 'Account Applications', icon: '👥', badge: teachers.length },
    { id: 'CALENDAR', label: 'Kalender', icon: '📅' },
    { id: 'MY_ATTENDANCE', label: 'Absensi Saya', icon: '📷' },
    { id: 'APPROVAL', label: 'Approval', icon: '📝', hasDropdown: true },
    { id: 'CORRECTION', label: 'Koreksi Manual', icon: '✏️' },
    { id: 'EXPORT', label: 'Laporan', icon: '📊', hasDropdown: true },
    { id: 'SETTINGS', label: 'Pengaturan', icon: '⚙️', hasDropdown: true },
    { id: 'AUDIT', label: 'Audit Log', icon: '📜' },
    { id: 'QR_POSTER', label: 'Poster QR', icon: '🖨️' },
    { id: 'TESTS', label: 'Tests / Diagnostik', icon: '🧪' },
  ];

  const handleSelectSidebarTab = (id: string) => {
    if (id === 'CORRECTION') {
      setIsCorrectionModalOpen(true);
      return;
    }
    if (id === 'QR_POSTER') {
      setIsQrGeneratorOpen(true);
      return;
    }
    if (id === 'TESTS') {
      setIsTestRunnerOpen(true);
      return;
    }
    setActiveTab(id);
  };

  return (
    <div className="min-h-screen bg-[#F6F6F6] text-[#023246] flex flex-col lg:flex-row dashboard-density-scaled">
      {/* ── LEFT SIDEBAR PANEL (DESKTOP & MOBILE) ────────────────────────── */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title={user?.full_name || 'Admin Website'}
        roleBadge="🛠️ Website Admin Access"
        roleColor="bg-[#287094]/30 text-[#F6F6F6] border-[#287094]"
        items={sidebarItems}
        activeTab={activeTab}
        onSelectTab={handleSelectSidebarTab}
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
          onOpenQrGenerator={() => setIsQrGeneratorOpen(true)}
          onLogout={logout}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-7xl w-full mx-auto space-y-6">
          <QueueMonitor />

          {/* TAB 1: EXECUTIVE DASHBOARD OVERVIEW (DEFAULT) */}
          {activeTab === 'DASHBOARD' && (
            <ExecutiveDashboardOverview
              roleTitle="Admin Website"
              teachers={teachers}
              onOpenScanner={onOpenScanner}
              onSwitchToGuruView={onSwitchToGuruView}
              onOpenQrGenerator={() => setIsQrGeneratorOpen(true)}
              onOpenCorrectionModal={() => setIsCorrectionModalOpen(true)}
              onOpenTestRunner={() => setIsTestRunnerOpen(true)}
              onNavigateTab={(tab: string) => setActiveTab(tab)}
            />
          )}

          {/* TAB 2: LIVE ATTENDANCE TRACKING */}
          {activeTab === 'ATTENDANCE_TRACKING' && (
            <div className="space-y-6">
              <DailyAttendanceTracker
                teachers={teachers}
                onOpenCorrectionModal={(teacher) => {
                  setSelectedCorrectionTeacher(teacher);
                  setIsCorrectionModalOpen(true);
                }}
              />
              <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-3">
                <h3 className="font-extrabold text-[#023246] text-sm flex items-center gap-2">
                  <span>📝 Persetujuan Pengajuan Izin / Sakit Guru</span>
                </h3>
                <PendingApprovalWidget />
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT APPLICATIONS / TEACHERS */}
          {activeTab === 'TEACHERS' && (
            <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} />
          )}

          {/* TAB 4: ACADEMIC CALENDAR */}
          {activeTab === 'CALENDAR' && <AcademicCalendarManagement />}

          {/* TAB 5: ABSENSI PRIBADI SAYA */}
          {activeTab === 'MY_ATTENDANCE' && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-5">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div className="space-y-1">
                  <span className="px-2.5 py-0.5 bg-[#287094]/10 text-[#287094] font-bold text-[11px] rounded-full border border-[#287094]/30">
                    Kartu Absensi Pribadi Admin & Staf
                  </span>
                  <h3 className="font-extrabold text-[#023246] text-lg">Absensi Harian Saya</h3>
                  <p className="text-xs text-slate-500">
                    Sebagai Admin Website, Anda tetap tercatat dalam daftar kehadiran harian sekolah.
                  </p>
                </div>

                <Button variant="primary" onClick={onOpenScanner} className="flex items-center gap-2">
                  <span>📷</span> Scan QR Code Absensi (Masuk / Pulang)
                </Button>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Status Kehadiran Hari Ini</p>
                  <p className="font-black text-[#023246] text-base">
                    {adminAttendance.status === 'HADIR' ? '✅ HADIR' : adminAttendance.status === 'TERLAMBAT' ? '⚠️ TERLAMBAT' : '⏳ BELUM ABSEN'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Jam Absen Masuk</p>
                  <p className="font-mono font-bold text-slate-800 text-base">
                    {adminAttendance.checkIn || '-- : -- WIB'}
                  </p>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="text-xs font-semibold text-slate-500">Jam Absen Pulang</p>
                  <p className="font-mono font-bold text-slate-800 text-base">
                    {adminAttendance.checkOut || '-- : -- WIB'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: APPROVAL */}
          {activeTab === 'APPROVAL' && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base">📝 Approval Pengajuan Izin / Sakit</h3>
              <PendingApprovalWidget />
            </div>
          )}

          {/* TAB 7: SETTINGS */}
          {activeTab === 'SETTINGS' && <SystemSettingsForm />}

          {/* TAB 8: LAPORAN / EXPORT */}
          {activeTab === 'EXPORT' && (
            <div className="bg-white p-8 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-5 text-center">
              <span className="text-5xl">📊</span>
              <div className="space-y-1">
                <h3 className="font-extrabold text-[#023246] text-xl">Generator Laporan Excel (.xlsx) & PDF Resmi</h3>
                <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                  Pilih format berkas laporan yang Anda butuhkan. Format Excel (.xlsx) disajikan dalam 5 tab sheet terpisah dengan lebar kolom yang pas, sedangkan format PDF disajikan lengkap dengan Kop Surat sekolah dan lembar tanda tangan resmi.
                </p>
              </div>

              <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
                <Button variant="primary" onClick={handleExportExcel} className="flex items-center justify-center gap-2">
                  <span>📊</span> Download File Excel Resmi (.xlsx)
                </Button>
                <Button variant="secondary" onClick={handleExportPDF} className="flex items-center justify-center gap-2">
                  <span>📄</span> Cetak / Simpan Laporan PDF (.pdf)
                </Button>
              </div>
            </div>
          )}

          {/* TAB 9: AUDIT LOG */}
          {activeTab === 'AUDIT' && <AuditLogTable />}
        </main>
      </div>

      {/* Manual Attendance Correction Modal */}
      <AttendanceCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => {
          setIsCorrectionModalOpen(false);
          setSelectedCorrectionTeacher(undefined);
        }}
        teachers={teachers}
        selectedTeacherId={selectedCorrectionTeacher?.id}
      />

      {/* Official QR Code Poster Generator Modal */}
      <QRCodeGeneratorModal
        isOpen={isQrGeneratorOpen}
        onClose={() => setIsQrGeneratorOpen(false)}
      />

      {/* Dev Suite Unit Test Runner Modal */}
      <TestRunnerModal
        isOpen={isTestRunnerOpen}
        onClose={() => setIsTestRunnerOpen(false)}
      />

      {/* ── MOBILE BOTTOM NAVIGATION DOCK (Screen 1 Mockup) ────────────────── */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/95 backdrop-blur-lg border-t border-[#D4D4CE]/30 px-3 py-1.5 z-40 shadow-xl lg:hidden">
        <div className="flex items-center justify-around relative">
          <button
            onClick={() => setActiveTab('DASHBOARD')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'DASHBOARD' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">🏠</span>
            <span>Dashboard</span>
          </button>

          <button
            onClick={() => setActiveTab('ATTENDANCE_TRACKING')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 transition-colors cursor-pointer ${
              activeTab === 'ATTENDANCE_TRACKING' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">⬡</span>
            <span>Live Tracking</span>
          </button>

          {/* Center FAB Poster QR Button */}
          <div className="relative -top-5 flex flex-col items-center">
            <button
              onClick={() => setIsQrGeneratorOpen(true)}
              className="w-14 h-14 rounded-full bg-[#023246] text-white flex items-center justify-center text-xl shadow-xl shadow-[#023246]/30 ring-4 ring-white active:scale-95 transition-transform cursor-pointer"
              title="Cetak Poster QR"
            >
              🔲
            </button>
            <span className="text-[10px] font-extrabold text-[#023246] mt-0.5">Poster QR</span>
          </div>

          <button
            onClick={() => setActiveTab('REPORTS')}
            className={`flex flex-col items-center gap-0.5 text-[10px] w-14 py-1 relative transition-colors cursor-pointer ${
              activeTab === 'REPORTS' ? 'text-[#023246] font-black' : 'text-slate-400 font-semibold'
            }`}
          >
            <span className="text-lg">☑️</span>
            <span>Approval</span>
            <span className="absolute top-1 right-3.5 px-1 py-0.2 text-[8px] font-black bg-red-500 text-white rounded-full min-w-3 text-center">3</span>
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
