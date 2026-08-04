import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { FeatureGate } from '../../../components/ui/FeatureGate';
import { Sidebar } from '../../../components/ui/Sidebar';
import type { SidebarItem } from '../../../components/ui/Sidebar';
import { TeacherManagementTable } from '../../admin/components/TeacherManagementTable';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { LeaveRequest, UserProfile, HolidayRecord } from '../../../types/database.types';

export interface KepsekDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const KepsekDashboardPage: React.FC<KepsekDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, token, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'ACCOUNT_APPLICATIONS' | 'APPROVALS' | 'UNABSENTED'>('OVERVIEW');
  const [todayHoliday, setTodayHoliday] = useState<HolidayRecord | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);

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

  useEffect(() => {
    const checkHoliday = async () => {
      try {
        const provider = ProviderFactory.getProvider();
        const holidays = await provider.getHolidays(token || undefined);
        const todayIso = new Date().toISOString().substring(0, 10);
        const holidayToday = (holidays || []).find((h) => h.date === todayIso);
        if (holidayToday) {
          setTodayHoliday(holidayToday);
        }
      } catch (e) {
        console.warn('Error checking holiday for Kepsek:', e);
      }
    };
    checkHoliday();
  }, [token]);

  // Mock data for executive summary
  const stats = {
    totalTeachers: teachers.length || 12,
    presentCount: 9,
    lateCount: 1,
    leaveCount: 1,
    unabsentedCount: 1,
    attendanceRate: 83.3,
  };

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
    { id: 'OVERVIEW', label: 'Ringkasan Eksekutif', icon: '📊' },
    { id: 'ACCOUNT_APPLICATIONS', label: 'Account Applications', icon: '📑', badge: teachers.length },
    { id: 'APPROVALS', label: 'Persetujuan Izin/Cuti', icon: '📝', badge: mockPendingApprovals.length },
    { id: 'UNABSENTED', label: 'Daftar Belum Absen', icon: '⚠️', badge: mockUnabsented.length },
  ];

  const navTabs = [
    { id: 'OVERVIEW', label: '📊 Ringkasan' },
    { id: 'ACCOUNT_APPLICATIONS', label: `📑 Akun & Pendaftaran (${teachers.length})` },
    { id: 'APPROVALS', label: `📝 Approval (${mockPendingApprovals.length})` },
    { id: 'UNABSENTED', label: `⚠️ Belum Absen (${mockUnabsented.length})` },
  ];

  return (
    <div className="min-h-screen bg-[#F6F6F6] pb-24 text-[#023246]">
      {/* Sidebar Component */}
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
      />

      {/* Executive Header (Midnight Navy #023246) */}
      <header className="bg-[#023246] text-white pt-8 pb-16 px-5 rounded-b-[2.5rem] shadow-xl border-b border-[#D4D4CE]/20">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            {/* Top-Left: Sidebar Button & Identity */}
            <div className="flex items-center gap-3.5">
              {/* 1. Sidebar Hamburger Button at Top-Left */}
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-3 bg-[#012332] hover:bg-[#287094] active:scale-95 text-[#F6F6F6] font-bold rounded-2xl transition-all border border-[#D4D4CE]/30 flex items-center gap-2 shadow-lg group shrink-0"
                aria-label="Buka Sidebar Navigasi"
                title="Buka Sidebar Navigasi"
              >
                <div className="w-5 h-4 flex flex-col justify-between">
                  <span className="block h-0.5 bg-[#F6F6F6] rounded-full transition-all group-hover:w-full" />
                  <span className="block h-0.5 bg-[#F6F6F6] rounded-full transition-all" />
                  <span className="block h-0.5 bg-[#F6F6F6] rounded-full transition-all group-hover:w-full" />
                </div>
                <span className="text-xs hidden sm:inline font-bold">Sidebar</span>
              </button>

              <div className="space-y-0.5">
                <span className="inline-block px-2.5 py-0.5 bg-[#287094] text-[#F6F6F6] font-bold text-[11px] rounded-full border border-[#D4D4CE]/40">
                  👑 Executive Principal Access
                </span>
                <h1 className="text-lg font-black text-white">{user?.full_name || 'Kepala Sekolah'}</h1>
                <p className="text-[11px] text-[#D4D4CE]">SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam</p>
              </div>
            </div>

            {/* Quick Action Badges */}
            {onSwitchToGuruView && (
              <div className="flex items-center gap-2">
                <button
                  onClick={onSwitchToGuruView}
                  className="px-3.5 py-2 bg-[#012332] hover:bg-[#287094] text-[#F6F6F6] hover:text-white text-xs font-bold rounded-2xl border border-[#D4D4CE]/30 transition-all flex items-center gap-1.5 shadow-xs"
                  title="Switch ke Tampilan Guru"
                >
                  <span className="text-[#287094]">📱</span> Mode Guru
                </button>
              </div>
            )}
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
                          ? 'bg-[#287094] text-white font-black shadow-lg shadow-[#287094]/40 border border-[#D4D4CE]/40'
                          : 'bg-[#012332] text-[#D4D4CE] hover:bg-[#287094] hover:text-white border border-[#D4D4CE]/20'
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
              className="px-3 py-2 bg-[#012332] hover:bg-[#287094] text-[#D4D4CE] hover:text-white text-xs font-bold rounded-xl transition-all border border-[#D4D4CE]/30 flex items-center gap-1.5 shrink-0 shadow-xs"
              title={isNavVisible ? 'Sembunyikan navigasi' : 'Tampilkan navigasi'}
            >
              {isNavVisible ? (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  <span className="hidden sm:inline">Hide</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  <span className="hidden sm:inline">Show</span>
                </>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Body */}
      <main className="max-w-xl mx-auto px-5 -mt-8 space-y-5">
        {/* Holiday Banner if today is a Holiday */}
        {todayHoliday && (
          <div className="bg-purple-600 text-white rounded-3xl p-5 shadow-lg shadow-purple-600/20 border border-purple-500 flex items-start gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-md text-2xl flex items-center justify-center shrink-0">
              🎉
            </div>
            <div className="space-y-1">
              <span className="px-2 py-0.5 bg-white/20 text-white font-extrabold text-[10px] rounded-full uppercase tracking-wider">
                {todayHoliday.type === 'NATIONAL_HOLIDAY' ? 'Libur Nasional' : todayHoliday.type === 'SCHOOL_HOLIDAY' ? 'Libur Sekolah' : 'Cuti Bersama'}
              </span>
              <h3 className="font-extrabold text-base leading-snug">{todayHoliday.name}</h3>
              <p className="text-xs text-purple-100 font-medium">
                Hari ini adalah hari libur resmi pada Kalender Akademik Sekolah.
              </p>
            </div>
          </div>
        )}

        {activeTab === 'OVERVIEW' && (
          <>
            {/* Real-time Kehadiran Card */}
            <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-card space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Tingkat Kehadiran Hari Ini</h3>
                  <p className="text-xs text-slate-500">Kamis, 30 Juli 2026</p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-emerald-600">{stats.attendanceRate}%</span>
                  <p className="text-[10px] text-slate-400">Target Sekolah ≥ 95%</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div style={{ width: `${(stats.presentCount / stats.totalTeachers) * 100}%` }} className="bg-emerald-500" title="Hadir Tepat Waktu" />
                <div style={{ width: `${(stats.lateCount / stats.totalTeachers) * 100}%` }} className="bg-amber-400" title="Terlambat" />
                <div style={{ width: `${(stats.leaveCount / stats.totalTeachers) * 100}%` }} className="bg-blue-400" title="Izin / Sakit" />
                <div style={{ width: `${(stats.unabsentedCount / stats.totalTeachers) * 100}%` }} className="bg-red-400" title="Belum Absen" />
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-4 gap-2 pt-2 text-center">
                <div className="p-2.5 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <span className="text-lg font-black text-emerald-700">{stats.presentCount}</span>
                  <p className="text-[10px] font-bold text-emerald-800">Hadir</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-amber-50 border border-amber-100">
                  <span className="text-lg font-black text-amber-700">{stats.lateCount}</span>
                  <p className="text-[10px] font-bold text-amber-800">Terlambat</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-blue-50 border border-blue-100">
                  <span className="text-lg font-black text-blue-700">{stats.leaveCount}</span>
                  <p className="text-[10px] font-bold text-blue-800">Izin/Sakit</p>
                </div>
                <div className="p-2.5 rounded-2xl bg-red-50 border border-red-100">
                  <span className="text-lg font-black text-red-700">{stats.unabsentedCount}</span>
                  <p className="text-[10px] font-bold text-red-800">Belum Absen</p>
                </div>
              </div>
            </div>

            {/* Pending Approvals Widget */}
            <PendingApprovalWidget requests={mockPendingApprovals} />
          </>
        )}

        {activeTab === 'ACCOUNT_APPLICATIONS' && (
          <div className="space-y-4">
            <div className="bg-slate-900 text-white p-4 rounded-3xl border border-slate-800 shadow-md flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-sm flex items-center gap-2">
                  <span>📑 Account Applications & Kelola Pengguna</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Daftar akun terdaftar & pendaftaran akun guru/staf baru untuk Kepala Sekolah.
                </p>
              </div>
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 font-black text-xs rounded-full border border-emerald-500/30">
                {teachers.length} Akun
              </span>
            </div>
            <TeacherManagementTable teachers={teachers} onTeachersChange={handleTeachersChange} />
          </div>
        )}

        {activeTab === 'APPROVALS' && (
          <PendingApprovalWidget requests={mockPendingApprovals} />
        )}

        {activeTab === 'UNABSENTED' && (
          <div className="bg-white p-5 rounded-3xl border border-slate-100 shadow-card space-y-4">
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>⚠️ Daftar Guru Belum Absen Hari Ini</span>
              <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full font-bold">
                {mockUnabsented.length}
              </span>
            </h3>

            <div className="space-y-3">
              {mockUnabsented.map((teacher) => (
                <div
                  key={teacher.id}
                  className="p-4 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-bold text-slate-900 text-xs">{teacher.full_name}</h4>
                    <p className="text-[11px] text-slate-500">{teacher.position} • {teacher.phone_number}</p>
                  </div>

                  <FeatureGate flag="ENABLE_WHATSAPP">
                    <a
                      href={`https://wa.me/62${String(teacher.phone_number || '').replace(/^0/, '')}?text=Assalamu'alaikum%20Bapak/Ibu%20${encodeURIComponent(teacher.full_name)},%20mohon%20konfirmasi%20kehadiran%20hari%20ini.`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all"
                    >
                      💬 WA Guru
                    </a>
                  </FeatureGate>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
