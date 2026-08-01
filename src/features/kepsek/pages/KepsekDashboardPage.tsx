import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { PendingApprovalWidget } from '../../leave/components/PendingApprovalWidget';
import { FeatureGate } from '../../../components/ui/FeatureGate';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { LeaveRequest, UserProfile, HolidayRecord } from '../../../types/database.types';

export interface KepsekDashboardPageProps {
  onOpenScanner?: () => void;
}

export const KepsekDashboardPage: React.FC<KepsekDashboardPageProps> = ({ onOpenScanner }) => {
  const { user, token, logout } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'APPROVALS' | 'UNABSENTED'>('OVERVIEW');
  const [todayHoliday, setTodayHoliday] = useState<HolidayRecord | null>(null);

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

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenScanner}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-1.5"
              >
                <span>📷</span> Scan Absensi Saya
              </button>
              <button
                onClick={logout}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>

          {/* Quick Tab Selector */}
          <div className="flex gap-2 pt-2">
            {[
              { id: 'OVERVIEW', label: '📊 Ringkasan' },
              { id: 'APPROVALS', label: `📝 Approval (${mockPendingApprovals.length})` },
              { id: 'UNABSENTED', label: `⚠️ Belum Absen (${mockUnabsented.length})` },
            ].map((tab) => (
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
