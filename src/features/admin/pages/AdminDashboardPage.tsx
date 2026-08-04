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
import type { UserProfile } from '../../../types/database.types';

export interface AdminDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, logout } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'ATTENDANCE_TRACKING' | 'TEACHERS' | 'CALENDAR' | 'MY_ATTENDANCE' | 'SETTINGS' | 'EXPORT' | 'AUDIT'>('ATTENDANCE_TRACKING');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [selectedCorrectionTeacher, setSelectedCorrectionTeacher] = useState<UserProfile | undefined>(undefined);
  const [isQrGeneratorOpen, setIsQrGeneratorOpen] = useState(false);
  const [isTestRunnerOpen, setIsTestRunnerOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);

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
    { id: 'ATTENDANCE_TRACKING', label: 'Live Tracking Absensi', icon: '📍' },
    { id: 'TEACHERS', label: 'Account Applications', icon: '📑', badge: teachers.length },
    { id: 'CALENDAR', label: 'Kalender Akademik', icon: '📅' },
    { id: 'MY_ATTENDANCE', label: 'Absensi Pribadi Saya', icon: '📷' },
    { id: 'SETTINGS', label: 'Jam Kerja & Geofence', icon: '⚙️' },
    { id: 'EXPORT', label: 'Export Multi-Sheet Excel', icon: '📊' },
    { id: 'AUDIT', label: 'Audit Trail Logging', icon: '📜' },
  ];

  const navTabs = [
    { id: 'ATTENDANCE_TRACKING', label: '📍 Live Tracking' },
    { id: 'TEACHERS', label: `📑 Account Applications (${teachers.length})` },
    { id: 'CALENDAR', label: '📅 Kalender' },
    { id: 'MY_ATTENDANCE', label: '📷 Absensi Saya' },
    { id: 'SETTINGS', label: '⚙️ Pengaturan' },
    { id: 'EXPORT', label: '📊 Export Excel' },
    { id: 'AUDIT', label: '📜 Audit Log' },
  ];

  return (
    <div className="min-h-screen bg-[#FAFAFA] pb-24 text-[#111827]">
      {/* Sidebar Navigation */}
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        title={user?.full_name || 'Admin Website'}
        roleBadge="🛠️ Website Admin Access"
        roleColor="bg-[#2563EB]/20 text-[#60A5FA] border-[#2563EB]/40"
        items={sidebarItems}
        activeTab={activeTab}
        onSelectTab={(id) => setActiveTab(id as typeof activeTab)}
        onSwitchToGuruView={onSwitchToGuruView}
        onOpenScanner={onOpenScanner}
        onLogout={logout}
      />

      {/* Admin Website Header */}
      <header className="bg-[#111827] text-white pt-8 pb-16 px-5 rounded-b-[2.5rem] shadow-xl border-b border-[#E5E7EB]/10">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            {/* Top-Left: Sidebar Button & Identity */}
            <div className="flex items-center gap-3.5">
              {/* 1. Sidebar Hamburger Button at Top-Left */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-3 bg-[#1F2937] hover:bg-[#374151] active:scale-95 text-[#60A5FA] font-bold rounded-2xl transition-all border border-[#374151] flex items-center gap-2 shadow-lg group shrink-0"
                aria-label="Buka Sidebar Navigasi"
                title="Buka Sidebar Navigasi"
              >
                <div className="w-5 h-4 flex flex-col justify-between">
                  <span className="block h-0.5 bg-[#60A5FA] rounded-full transition-all group-hover:w-full" />
                  <span className="block h-0.5 bg-[#60A5FA] rounded-full transition-all" />
                  <span className="block h-0.5 bg-[#60A5FA] rounded-full transition-all group-hover:w-full" />
                </div>
                <span className="text-xs hidden sm:inline font-bold">Sidebar</span>
              </button>

              <div className="space-y-0.5">
                <span className="inline-block px-2.5 py-0.5 bg-[#2563EB]/20 text-[#60A5FA] font-bold text-[11px] rounded-full border border-[#2563EB]/40">
                  🛠️ Dashboard Admin Website
                </span>
                <h1 className="text-lg font-black text-white">{user?.full_name || 'Rina Fitriani, S.Kom.'}</h1>
                <p className="text-[11px] text-[#9CA3AF]">SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam</p>
              </div>
            </div>

            {/* 4 & 5. Action Buttons Group at Top-Right with Semantic Styling */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => setIsQrGeneratorOpen(true)}
                className="px-3 py-2 bg-[#1F2937] hover:bg-[#374151] hover:border-[#2563EB] text-[#D1D5DB] hover:text-[#60A5FA] text-xs font-bold rounded-2xl border border-[#374151] transition-all flex items-center gap-1.5 shadow-xs"
                title="Cetak Poster QR Absensi"
              >
                <span className="text-[#2563EB]">🖨️</span> Poster QR
              </button>
              <button
                onClick={() => setIsCorrectionModalOpen(true)}
                className="px-3 py-2 bg-[#1F2937] hover:bg-[#374151] hover:border-[#F59E0B] text-[#D1D5DB] hover:text-[#FBBF24] text-xs font-bold rounded-2xl border border-[#374151] transition-all flex items-center gap-1.5 shadow-xs"
                title="Koreksi Absensi Manual"
              >
                <span className="text-[#F59E0B]">✏️</span> Koreksi
              </button>
              <button
                onClick={() => setIsTestRunnerOpen(true)}
                className="px-3 py-2 bg-[#1F2937] hover:bg-[#374151] hover:border-[#16A34A] text-[#D1D5DB] hover:text-[#4ADE80] text-xs font-bold rounded-2xl border border-[#374151] transition-all flex items-center gap-1.5 shadow-xs"
                title="Jalankan Unit Test Suite"
              >
                <span className="text-[#16A34A]">🧪</span> Tests
              </button>
            </div>
          </div>

          {/* 2 & 3. Secondary Navigation Bar with Hide Button on Far Right */}
          <div className="flex items-center justify-between gap-3 pt-2">
            {/* Scrollable Pill Container */}
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              {isNavVisible && (
                <div className="flex items-center gap-2">
                  {navTabs.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as typeof activeTab)}
                      className={`py-2 px-3.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                        activeTab === tab.id
                          ? 'bg-[#2563EB] text-white font-black shadow-lg shadow-blue-500/30'
                          : 'bg-[#1F2937] text-[#D1D5DB] hover:bg-[#374151] hover:text-white'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* 2. Hide/Show Toggle placed at far right end */}
            <button
              onClick={() => setIsNavVisible(!isNavVisible)}
              className="px-3 py-2 bg-[#1F2937] hover:bg-[#374151] text-[#9CA3AF] hover:text-white text-xs font-bold rounded-xl transition-all border border-[#374151] flex items-center gap-1.5 shrink-0 shadow-xs"
              title={isNavVisible ? 'Sembunyikan navigasi' : 'Tampilkan navigasi'}
            >
              {isNavVisible ? (
                <>
                  <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  <span className="hidden sm:inline">Hide</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-[#9CA3AF]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  <span className="hidden sm:inline">Show</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-5 -mt-8 space-y-5">
        <QueueMonitor />

        {/* Live Attendance Tracking Tab */}
        {activeTab === 'ATTENDANCE_TRACKING' && (
          <div className="space-y-6">
            <DailyAttendanceTracker
              teachers={teachers}
              onOpenCorrectionModal={(teacher) => {
                setSelectedCorrectionTeacher(teacher);
                setIsCorrectionModalOpen(true);
              }}
            />
            
            {/* Pending Approvals Widget for Admin */}
            <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-3">
              <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>📝 Persetujuan Pengajuan Izin / Sakit Guru</span>
              </h3>
              <PendingApprovalWidget />
            </div>
          </div>
        )}

        {/* Card Absensi Pribadi Admin */}
        {activeTab === 'MY_ATTENDANCE' && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-card space-y-5">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 font-bold text-[11px] rounded-full">
                  Kartu Absensi Pribadi Admin & Staf
                </span>
                <h3 className="font-extrabold text-slate-900 text-lg">Absensi Harian Saya</h3>
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
                <p className="font-black text-slate-900 text-base">
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

        {activeTab === 'TEACHERS' && (
          <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} />
        )}

        {activeTab === 'CALENDAR' && <AcademicCalendarManagement />}

        {activeTab === 'SETTINGS' && <SystemSettingsForm />}

        {activeTab === 'EXPORT' && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-card space-y-5 text-center">
            <span className="text-5xl">📊</span>
            <div className="space-y-1">
              <h3 className="font-extrabold text-slate-900 text-xl">Generator Laporan Excel (.xlsx) & PDF Resmi</h3>
              <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                Pilih format berkas laporan yang Anda butuhkan. Format Excel (.xlsx) disajikan dalam 5 tab sheet terpisah dengan lebar kolom yang pas, sedangkan format PDF disajikan lengkap dengan Kop Surat sekolah dan lembar tanda tangan resmi.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-2">
              <Button variant="primary" onClick={handleExportExcel} className="flex items-center justify-center gap-2">
                <span>📊</span> Download File Excel Resmi (.xlsx)
              </Button>
              <Button variant="secondary" onClick={handleExportPDF} className="flex items-center justify-center gap-2 bg-slate-900 text-white hover:bg-slate-800">
                <span>📄</span> Cetak / Simpan Laporan PDF (.pdf)
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'AUDIT' && <AuditLogTable />}
      </main>

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
    </div>
  );
};
