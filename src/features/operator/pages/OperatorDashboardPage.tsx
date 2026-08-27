import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../../../store/useAuthStore';
import { QueueMonitor } from '../../../components/ui/QueueMonitor';
import { Button } from '../../../components/ui/Button';
import { TeacherManagementTable } from '../components/TeacherManagementTable';
import { TeachingScheduleManagement } from '../../admin/components/TeachingScheduleManagement';
import { StudentManagement } from '../../admin/components/StudentManagement';
import { AttendanceCorrectionModal } from '../components/AttendanceCorrectionModal';
import { ExportReportModal } from '../../../components/dashboard/ExportReportModal';
import { SystemSettingsForm } from '../components/SystemSettingsForm';
import { AuditLogTable } from '../components/AuditLogTable';
import { ProviderFactory } from '../../../providers/provider-factory';
import type { UserProfile, AttendanceRecord } from '../../../types/database.types';

export const OperatorDashboardPage: React.FC = () => {
  const { user, logout } = useAuthStore();

  const [activeTab, setActiveTab] = useState<'TEACHERS' | 'STUDENTS' | 'SCHEDULE' | 'SETTINGS' | 'EXPORT' | 'AUDIT'>('TEACHERS');
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [teachers, setTeachers] = useState<UserProfile[]>([
    {
      id: 'usr_1001',
      nip: null,
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
      nip: null,
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
      nip: null,
      full_name: 'Farhan Sopian Sahid, S.Pd.I',
      phone_number: '081298765432',
      role: 'KEPSEK',
      position: 'Kepala Sekolah Utama',
      avatar_url: null,
      is_active: true,
      created_at: new Date().toISOString(),
    },
  ]);

  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);

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
      console.warn('Gagal memuat rekap absensi bulanan di operator:', err);
    }
  };

  useEffect(() => {
    fetchAttendanceRecords();
    const handleScannedEvent = () => fetchAttendanceRecords();
    window.addEventListener('smart_absensi_scanned', handleScannedEvent);
    window.addEventListener('smart_absensi_records_updated', handleScannedEvent);
    return () => {
      window.removeEventListener('smart_absensi_scanned', handleScannedEvent);
      window.removeEventListener('smart_absensi_records_updated', handleScannedEvent);
    };
  }, [teachers.length]);

  const handleExportExcel = async () => {
    setIsExportModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100 pb-24 text-slate-900">
      {/* Operator Admin Control Center Header */}
      <header className="bg-slate-900 text-white pt-8 pb-16 px-5 rounded-b-[2.5rem] shadow-xl">
        <div className="max-w-5xl mx-auto space-y-4">
          <div className="flex justify-between items-start">
            <div className="space-y-1">
              <span className="inline-block px-3 py-1 bg-blue-500/20 text-blue-300 font-bold text-xs rounded-full border border-blue-500/30">
                🛠️ Admin Website Console
              </span>
              <h1 className="text-xl font-black text-white">{user?.full_name || 'Mira Nurdianti, S.Pd'}</h1>
              <p className="text-xs text-slate-400">SMP Terpadu Al-Ittihadiyah & SMA Terpadu As Salaam</p>
            </div>

            <div className="flex items-center gap-2">
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
              { id: 'STUDENTS', label: '🎓 Direktori Siswa & Wali' },
              { id: 'SCHEDULE', label: '🗓️ Jadwal Mengajar' },
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

        {activeTab === 'TEACHERS' && (
          <TeacherManagementTable teachers={teachers} onTeachersChange={setTeachers} />
        )}

        {activeTab === 'STUDENTS' && <StudentManagement />}

        {activeTab === 'SCHEDULE' && (
          <TeachingScheduleManagement teachers={teachers} />
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

      {/* Export Report Selector Modal */}
      <ExportReportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        teachers={teachers}
        attendanceRecords={attendanceRecords}
      />
    </div>
  );
};
