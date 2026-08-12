import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { QueueMonitor } from '../../../components/ui/QueueMonitor';
import { Button } from '../../../components/ui/Button';
import { Sidebar } from '../../../components/ui/Sidebar';
import type { SidebarItem } from '../../../components/ui/Sidebar';
import { QrCodeScanIcon } from '../../../components/ui/QrCodeScanIcon';
import { AcademicCalendarManagement } from '../components/AcademicCalendarManagement';
import { TeacherManagementTable } from '../components/TeacherManagementTable';
import { TeachingScheduleManagement } from '../components/TeachingScheduleManagement';
import { DutyScheduleManagement } from '../components/DutyScheduleManagement';
import { AttendanceCorrectionModal } from '../components/AttendanceCorrectionModal';
import { SystemSettingsForm } from '../components/SystemSettingsForm';
import { QRCodeGeneratorModal } from '../components/QRCodeGeneratorModal';
import { ExportReportModal } from '../../../components/dashboard/ExportReportModal';
import { AuditLogTable } from '../components/AuditLogTable';
import { DailyAttendanceTracker } from '../components/DailyAttendanceTracker';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { LeaveApplicationModal } from '../../leave/components/LeaveApplicationModal';
import { LeaveRepository } from '../../../repositories/LeaveRepository';
import { ProviderFactory } from '../../../providers/provider-factory';
import { TestRunnerModal } from '../../../components/dev/TestRunnerModal';
import { TopDashboardNavbar } from '../../../components/dashboard/TopDashboardNavbar';
import { ExecutiveDashboardOverview } from '../../../components/dashboard/ExecutiveDashboardOverview';
import { AdminCommandPaletteModal } from '../../../components/dashboard/AdminCommandPaletteModal';
import { DevTestPage } from './DevTestPage';
import { isDevTestModeEnabled } from '../../../utils/dev-test.utils';
import { isDateOffDay } from '../../../utils/time.utils';
import type { UserProfile, LeaveRequest, AttendanceRecord } from '../../../types/database.types';

export interface AdminDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<string>('DASHBOARD');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedCorrectionTeacher, setSelectedCorrectionTeacher] = useState<UserProfile | undefined>(undefined);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);

  // Status absensi pribadi Admin hari ini (real data from DB)
  const [todayAttendance, setTodayAttendance] = useState<AttendanceRecord | null>(null);
  const [isLoadingMyAttendance, setIsLoadingMyAttendance] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [allLeaves, setAllLeaves] = useState<LeaveRequest[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

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
    window.dispatchEvent(new Event('smart_absensi_teachers_updated'));
  };

  const fetchPendingRequests = async () => {
    try {
      const token = useAuthStore.getState().token || '';
      if (token) {
        const fetched = await LeaveRepository.getAllLeaves(token);
        setAllLeaves(fetched || []);
        setPendingRequests((fetched || []).filter((r) => r.approval_status === 'PENDING'));
      }
    } catch (err) {
      console.warn('Gagal memuat pengajuan izin:', err);
    }
  };

  const fetchAttendanceRecords = async () => {
    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      const yearStr = new Date().getFullYear().toString();
      const monthStr = String(new Date().getMonth() + 1).padStart(2, '0');
      const allRecs: AttendanceRecord[] = [];

      for (const t of teachers) {
        const recs = await provider.getMonthlyAttendance(t.id, monthStr, yearStr, token);
        allRecs.push(...recs);
      }
      setAttendanceRecords(allRecs);
    } catch (err) {
      console.warn('Gagal memuat rekap absensi bulanan:', err);
    }
  };

  // Fetch admin's own today attendance from DB
  const fetchMyAttendance = async () => {
    if (!user) return;
    setIsLoadingMyAttendance(true);
    try {
      const provider = ProviderFactory.getProvider();
      const token = useAuthStore.getState().token || '';
      const record = await provider.getTodayAttendance(user.id, token);
      setTodayAttendance(record);
    } catch (err) {
      console.warn('Gagal memuat absensi pribadi admin:', err);
    } finally {
      setIsLoadingMyAttendance(false);
    }
  };

  useEffect(() => {
    // 1. Instantly populate from local storage cache for instant UI rendering
    const cachedTeachers = localStorage.getItem('smart_absensi_teachers');
    if (cachedTeachers) {
      try {
        const parsed = JSON.parse(cachedTeachers);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTeachers(parsed);
        }
      } catch (e) {
        console.warn('Failed to parse cached teachers:', e);
      }
    }

    // 2. Sequentially sync from backend with controlled delays to prevent GAS request queueing
    const syncBackendDataSequentially = async () => {
      try {
        const provider = ProviderFactory.getProvider();
        const token = useAuthStore.getState().token || '';
        if (!token) return;

        // Step 1: Sync Users List
        try {
          const fetched = await provider.getAllUsers(token);
          if (fetched && fetched.length > 0) {
            setTeachers(fetched);
            localStorage.setItem('smart_absensi_teachers', JSON.stringify(fetched));
          }
        } catch (err) {
          console.warn('Backend fetch users fallback:', err);
        }

        await new Promise((r) => setTimeout(r, 300));

        // Step 2: Sync Pending Leave Requests
        await fetchPendingRequests();

        await new Promise((r) => setTimeout(r, 300));

        // Step 3: Sync Daily Attendance Records
        await fetchAttendanceRecords();

        await new Promise((r) => setTimeout(r, 300));

        // Step 4: Sync Admin's Own Today Attendance
        await fetchMyAttendance();
      } catch (err) {
        console.warn('Backend sync sequence error:', err);
      }
    };

    syncBackendDataSequentially();

    const handleScannedEvent = () => {
      fetchAttendanceRecords();
      fetchMyAttendance();
    };

    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_records_updated', handleScannedEvent);

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_records_updated', handleScannedEvent);
      window.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [user?.id, teachers.length]);

  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const handleExportExcel = () => {
    setIsExportModalOpen(true);
  };

  const handleExportPDF = () => {
    setIsExportModalOpen(true);
  };

  const sidebarItems: SidebarItem[] = [
    { id: 'DASHBOARD', label: 'Dashboard', icon: '🏠' },
    { id: 'ATTENDANCE_TRACKING', label: 'Live Tracking', icon: '👁️' },
    { id: 'TEACHERS', label: 'Account Applications', icon: '👥' },
    { id: 'SCHEDULE', label: 'Jadwal Mengajar', icon: '🗓️' },
    { id: 'DUTY_SCHEDULE', label: 'Jadwal Piket Guru', icon: '🛡️' },
    { id: 'CALENDAR', label: 'Kalender', icon: '📅' },
    { id: 'MY_ATTENDANCE', label: 'Absensi Saya', icon: '📷' },
    { id: 'APPLY_LEAVE', label: 'Pengajuan Izin / Cuti', icon: '📄' },
    { id: 'APPROVAL', label: 'Approval Cuti Guru', icon: '📝', hasDropdown: true },
    { id: 'CORRECTION', label: 'Koreksi Manual', icon: '✏️' },
    { id: 'EXPORT', label: 'Laporan', icon: '📊', hasDropdown: true },
    { id: 'SETTINGS', label: 'Pengaturan', icon: '⚙️', hasDropdown: true },
    { id: 'AUDIT', label: 'Audit Log', icon: '📜' },
    { id: 'QR_POSTER', label: 'Poster QR', icon: '🖨️' },
    { id: 'TESTS', label: 'Tests / Diagnostik', icon: '🧪' },
    ...(isDevTestModeEnabled() ? [{ id: 'DEV_TEST', label: 'Mode Tes Developer', icon: '🧪' }] : []),
  ];

  const handleSelectSidebarTab = (id: string) => {
    if (id === 'APPLY_LEAVE') {
      setIsLeaveModalOpen(true);
      return;
    }
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
    <div className="min-h-screen bg-[#F6F6F6] text-[#023246] flex flex-col lg:flex-row dashboard-density-scaled overflow-x-hidden">
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
          onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
          onLogout={logout}
        />

        {/* Main Content Viewport */}
        <main className="flex-1 p-3.5 sm:p-6 pb-6 sm:pb-8 max-w-7xl w-full mx-auto space-y-4 sm:space-y-6">
          <QueueMonitor />

          {/* TAB 1: EXECUTIVE DASHBOARD OVERVIEW (DEFAULT) */}
          {activeTab === 'DASHBOARD' && (
            <ExecutiveDashboardOverview
              roleTitle="Admin Website"
              teachers={teachers}
              pendingRequests={pendingRequests}
              allLeaves={allLeaves}
              attendanceRecords={attendanceRecords}
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
                attendanceRecords={attendanceRecords}
                leaveRequests={allLeaves.length > 0 ? allLeaves : pendingRequests}
                onOpenCorrectionModal={(teacher) => {
                  setSelectedCorrectionTeacher(teacher);
                  setIsCorrectionModalOpen(true);
                }}
              />
              <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-3">
                <h3 className="font-extrabold text-[#023246] text-sm flex items-center gap-2">
                  <span>📝 Persetujuan Pengajuan Izin / Sakit Guru</span>
                </h3>
                <PendingApprovalWidget requests={allLeaves.length > 0 ? allLeaves : pendingRequests} teachers={teachers} onRefresh={fetchPendingRequests} />
              </div>
            </div>
          )}

          {/* TAB 3: ACCOUNT APPLICATIONS / TEACHERS */}
          {(activeTab === 'TEACHERS' || activeTab === 'ACCOUNT_APPLICATIONS') && (
            <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} />
          )}

          {/* TAB 4: ACADEMIC CALENDAR */}
          {activeTab === 'CALENDAR' && <AcademicCalendarManagement />}

          {/* TAB: TEACHING SCHEDULE MANAGEMENT */}
          {activeTab === 'SCHEDULE' && <TeachingScheduleManagement teachers={teachers} />}

          {/* TAB: DUTY SCHEDULE MANAGEMENT (Jadwal Piket Guru) */}
          {activeTab === 'DUTY_SCHEDULE' && <DutyScheduleManagement />}

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
                  <QrCodeScanIcon className="w-5 h-5 text-white" />
                  <span>Scan QR Code Absensi (Masuk / Pulang)</span>
                </Button>
              </div>

              {isLoadingMyAttendance ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-8 h-8 border-4 border-[#287094] border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <>
                  {/* Status Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Status Kehadiran Hari Ini</p>
                      <p className="font-black text-[#023246] text-base">
                        {todayAttendance
                          ? todayAttendance.status === 'HADIR'
                            ? '✅ HADIR'
                            : todayAttendance.status === 'TERLAMBAT'
                              ? '⚠️ TERLAMBAT'
                              : `📋 ${todayAttendance.status}`
                          : isDateOffDay(new Date()).isOff
                            ? '🏖️ LIBUR SEKOLAH'
                            : '⏳ BELUM ABSEN'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Jam Absen Masuk</p>
                      <p className="font-mono font-bold text-slate-800 text-base">
                        {todayAttendance?.check_in_time
                          ? `${todayAttendance.check_in_time} WIB`
                          : '-- : -- WIB'}
                      </p>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
                      <p className="text-xs font-semibold text-slate-500">Jam Absen Pulang</p>
                      <p className="font-mono font-bold text-slate-800 text-base">
                        {todayAttendance?.check_out_time
                          ? `${todayAttendance.check_out_time} WIB`
                          : '-- : -- WIB'}
                      </p>
                    </div>
                  </div>

                  {/* Extra info: distance & verification */}
                  {todayAttendance && (
                    <div className="flex flex-wrap gap-3 pt-2">
                      {todayAttendance.check_in_distance_meters != null && (
                        <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-[11px] font-bold rounded-full border border-emerald-200">
                          📍 Jarak: {todayAttendance.check_in_distance_meters.toFixed(0)}m dari sekolah
                        </span>
                      )}
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 text-[11px] font-bold rounded-full border border-blue-200">
                        🔐 Verifikasi: {todayAttendance.verification_method === 'QR_GPS' ? 'QR + GPS' : todayAttendance.verification_method}
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 6: APPROVAL */}
          {(activeTab === 'APPROVAL' || activeTab === 'APPROVALS') && (
            <div className="bg-white p-6 rounded-3xl border border-[#D4D4CE]/40 shadow-card space-y-4">
              <h3 className="font-extrabold text-[#023246] text-base">📝 Approval Pengajuan Izin / Sakit</h3>
              <PendingApprovalWidget requests={allLeaves.length > 0 ? allLeaves : pendingRequests} teachers={teachers} onRefresh={fetchPendingRequests} />
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

          {/* TAB 10: DEVELOPER TEST MODE */}
          {activeTab === 'DEV_TEST' && <DevTestPage onBackToDashboard={() => setActiveTab('DASHBOARD')} />}
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
        onSuccess={() => fetchAttendanceRecords()}
      />

      {/* Official QR Code Poster Generator Modal */}
      <QRCodeGeneratorModal
        isOpen={isQrGeneratorOpen}
        onClose={() => setIsQrGeneratorOpen(false)}
      />

      {/* Export Report Selector Modal (Master & Individual Teacher) */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        teachers={teachers}
        attendanceRecords={attendanceRecords}
      />

      {/* Dev Suite Unit Test Runner Modal */}
      <TestRunnerModal
        isOpen={isTestRunnerOpen}
        onClose={() => setIsTestRunnerOpen(false)}
      />

      {/* Admin / Staff Leave Application Modal */}
      <LeaveApplicationModal
        isOpen={isLeaveModalOpen}
        onClose={() => setIsLeaveModalOpen(false)}
        onSuccess={() => {
          fetchPendingRequests();
        }}
      />

      {/* ── COMMAND PALETTE (CTRL + K) SEARCH & NAV MODAL ── */}
      <AdminCommandPaletteModal
        isOpen={isCommandPaletteOpen}
        onClose={() => setIsCommandPaletteOpen(false)}
        teachers={teachers}
        onSelectTab={handleSelectSidebarTab}
        onOpenQrGenerator={() => setIsQrGeneratorOpen(true)}
        onOpenCorrectionModal={() => setIsCorrectionModalOpen(true)}
        onOpenTestRunner={() => setIsTestRunnerOpen(true)}
        onSwitchToGuruView={onSwitchToGuruView}
      />
    </div>
  );
};
