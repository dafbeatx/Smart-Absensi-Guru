import React, { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { FeatureGate } from '../../../components/ui/FeatureGate';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { LeaveRequest, UserProfile, HolidayRecord } from '../../../types/database.types';

export interface KepsekDashboardPageProps {
  onOpenScanner?: () => void;
  onSwitchToGuruView?: () => void;
}

export const KepsekDashboardPage: React.FC<KepsekDashboardPageProps> = ({ onOpenScanner, onSwitchToGuruView }) => {
  const { user, token, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'APPROVALS' | 'UNABSENTED'>('OVERVIEW');
  const [todayHoliday, setTodayHoliday] = useState<HolidayRecord | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isNavVisible, setIsNavVisible] = useState(true);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close hamburger menu on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    if (isMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

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
    totalTeachers: 12,
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

  const menuItems = [
    ...(onSwitchToGuruView ? [{
      icon: '📱',
      label: 'Mode Tampilan Guru',
      onClick: () => { onSwitchToGuruView(); setIsMenuOpen(false); },
      color: 'text-purple-300 hover:bg-purple-600/20',
    }] : []),
    {
      icon: '📷',
      label: 'Scan Absensi Saya',
      onClick: () => { onOpenScanner?.(); setIsMenuOpen(false); },
      color: 'text-emerald-300 hover:bg-emerald-600/20',
    },
    {
      icon: '🚪',
      label: 'Keluar',
      onClick: () => { logout(); setIsMenuOpen(false); },
      color: 'text-red-300 hover:bg-red-600/20',
    },
  ];

  const navTabs = [
    { id: 'OVERVIEW', label: '📊 Ringkasan' },
    { id: 'APPROVALS', label: `📝 Approval (${mockPendingApprovals.length})` },
    { id: 'UNABSENTED', label: `⚠️ Belum Absen (${mockUnabsented.length})` },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-900">
      {/* Executive Header */}
      <header className="bg-slate-900 text-white pt-8 pb-16 px-5 rounded-b-[2.5rem] shadow-xl">
        <div className="max-w-xl mx-auto space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 bg-emerald-500/20 text-emerald-300 font-bold text-xs rounded-full border border-emerald-500/30">
                👑 Executive Principal Access
              </span>
              <h1 className="text-xl font-black text-white">{user?.full_name || 'Kepala Sekolah'}</h1>
              <p className="text-xs text-slate-400">SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam</p>
            </div>

            {/* Hamburger Menu */}
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl transition-all border border-slate-700 group"
                aria-label="Menu"
              >
                <div className="w-5 h-4 flex flex-col justify-between">
                  <span className={`block h-0.5 bg-slate-300 rounded-full transition-all duration-300 group-hover:bg-white ${isMenuOpen ? 'rotate-45 translate-y-[7px]' : ''}`} />
                  <span className={`block h-0.5 bg-slate-300 rounded-full transition-all duration-300 group-hover:bg-white ${isMenuOpen ? 'opacity-0 scale-0' : ''}`} />
                  <span className={`block h-0.5 bg-slate-300 rounded-full transition-all duration-300 group-hover:bg-white ${isMenuOpen ? '-rotate-45 -translate-y-[7px]' : ''}`} />
                </div>
              </button>

              {/* Dropdown Menu */}
              {isMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl shadow-black/40 z-50 overflow-hidden">
                  <div className="p-2 space-y-0.5">
                    {menuItems.map((item, i) => (
                      <button
                        key={i}
                        onClick={item.onClick}
                        className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${item.color}`}
                      >
                        <span className="text-sm">{item.icon}</span>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Tab Selector with Hide/Show Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={() => setIsNavVisible(!isNavVisible)}
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white text-xs font-bold rounded-lg transition-all border border-slate-700 flex items-center gap-1.5 shrink-0"
              title={isNavVisible ? 'Sembunyikan navigasi' : 'Tampilkan navigasi'}
            >
              {isNavVisible ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" /></svg>
                  Hide
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  Show
                </>
              )}
            </button>

            {isNavVisible && (
              <div className="flex gap-2 transition-all">
                {navTabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all ${
                      activeTab === tab.id
                        ? 'bg-emerald-500 text-slate-950 font-black shadow-lg shadow-emerald-500/25'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
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
