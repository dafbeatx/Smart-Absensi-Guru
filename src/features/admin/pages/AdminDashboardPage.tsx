import React, { useState } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { QueueMonitor } from '../../../components/ui/QueueMonitor';
import { Button } from '../../../components/ui/Button';
import { TeacherManagementTable } from '../components/TeacherManagementTable';
import { AttendanceCorrectionModal } from '../components/AttendanceCorrectionModal';
import { SystemSettingsForm } from '../components/SystemSettingsForm';
import { AuditLogTable } from '../components/AuditLogTable';
import { ReportService } from '../../../services/report.service';
import { useToastStore } from '../../../store/useToastStore';
import type { UserProfile } from '../../../types/database.types';

export interface AdminDashboardPageProps {
  onOpenScanner?: () => void;
}

export const AdminDashboardPage: React.FC<AdminDashboardPageProps> = ({ onOpenScanner }) => {
  const { user, logout } = useAuthStore();
  const { showToast } = useToastStore();

  const [activeTab, setActiveTab] = useState<'MY_ATTENDANCE' | 'TEACHERS' | 'SETTINGS' | 'EXPORT' | 'AUDIT'>('TEACHERS');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);

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

  const handleExportExcel = async () => {
    await ReportService.generateAndDownloadMonthlyReport(
      'Juli',
      '2026',
      teachers,
      [],
      [],
      []
    );
    showToast('success', 'Export Excel Berhasil!', 'Laporan multi-sheet 5-Sheet siap diunduh.');
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-24 text-slate-900">
      {/* Admin Website Header */}
      <header className="bg-slate-900 text-white pt-8 pb-16 px-5 rounded-b-[2.5rem] shadow-xl">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 font-bold text-xs rounded-full border border-blue-500/30">
                🛠️ Dashboard Admin Website
              </span>
              <h1 className="text-xl font-black text-white">{user?.full_name || 'Rina Fitriani, S.Kom.'}</h1>
              <p className="text-xs text-slate-400">SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Absensi Pribadi Admin */}
              <button
                onClick={onOpenScanner}
                className="px-3.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-black rounded-xl transition-all shadow-lg shadow-emerald-500/30 flex items-center gap-1.5"
              >
                <span>📷</span> Scan Absensi Saya
              </button>

              <button
                onClick={() => setIsCorrectionModalOpen(true)}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-xs font-extrabold rounded-xl transition-all shadow-md shadow-amber-500/20"
              >
                ✏️ Koreksi Manual
              </button>

              <button
                onClick={logout}
                className="px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl transition-colors"
              >
                Keluar
              </button>
            </div>
          </div>

          {/* Navigation Bar */}
          <div className="flex flex-wrap gap-2 pt-2">
            {[
              { id: 'TEACHERS', label: '👥 Kelola Master Pengguna' },
              { id: 'MY_ATTENDANCE', label: '📷 Absensi Pribadi Saya' },
              { id: 'SETTINGS', label: '⚙️ Jam Kerja & Geofence' },
              { id: 'EXPORT', label: '📊 Export Multi-Sheet Excel' },
              { id: 'AUDIT', label: '📜 Audit Trail Logging' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`py-2 px-4 rounded-xl text-xs font-bold transition-all ${
                  activeTab === tab.id
                    ? 'bg-blue-500 text-white font-black shadow-lg shadow-blue-500/25'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-5xl mx-auto px-5 -mt-8 space-y-5">
        <QueueMonitor />

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

        {activeTab === 'SETTINGS' && <SystemSettingsForm />}

        {activeTab === 'EXPORT' && (
          <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-card space-y-4 text-center">
            <span className="text-5xl">📊</span>
            <h3 className="font-extrabold text-slate-900 text-xl">Generator Laporan Excel Multi-Sheet</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              Unduh berkas laporan bulanan terintegrasi 5-Sheet (Sheet 1: Dashboard Ringkasan, Sheet 2: Rekap Guru, Sheet 3: Detail Harian, Sheet 4: Pengajuan Izin, Sheet 5: Audit Log).
            </p>
            <div className="pt-2">
              <Button variant="primary" onClick={handleExportExcel}>
                ⚡ Download File Excel Multi-Sheet (.csv/.xlsx)
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'AUDIT' && <AuditLogTable />}
      </main>

      {/* Manual Attendance Correction Modal */}
      <AttendanceCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => setIsCorrectionModalOpen(false)}
        teachers={teachers}
      />
    </div>
  );
};
