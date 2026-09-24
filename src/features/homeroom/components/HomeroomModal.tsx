import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { UserProfile } from '../../../types/database.types';
import type {
  HomeroomOverview,
  HomeroomStudentItem,
  PlanStatus,
} from '../../../types/homeroom.types';
import { HomeroomRepository } from '../../../repositories/HomeroomRepository';
import { StudentPlanDetailDrawer } from './StudentPlanDetailDrawer';
import { Button } from '../../../components/ui/Button';

interface HomeroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  user?: UserProfile | null;
  token?: string;
  defaultClassName?: string;
}

type FilterStatus = 'ALL' | PlanStatus;

export const HomeroomModal: React.FC<HomeroomModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
  defaultClassName = '9A',
}) => {
  const isPrivileged = user?.role === 'ADMIN' || user?.role === 'OPERATOR' || user?.role === 'KEPSEK';
  const [selectedClass, setSelectedClass] = useState<string>(defaultClassName);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<HomeroomOverview | null>(null);
  const [students, setStudents] = useState<HomeroomStudentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadData = useCallback(async (cls?: string) => {
    const effectiveToken =
      token ||
      (typeof window !== 'undefined' ? localStorage.getItem('smart_absensi_token') : null) ||
      'mock_token';
    const targetClass = cls || (isPrivileged ? selectedClass : undefined);
    setLoading(true);
    setError(null);
    try {
      const [overviewData, studentsData] = await Promise.all([
        HomeroomRepository.getOverview(effectiveToken, targetClass),
        HomeroomRepository.getStudents(effectiveToken, targetClass),
      ]);
      setOverview(overviewData);
      setStudents(studentsData);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data Ruang Wali Kelas.');
    } finally {
      setLoading(false);
    }
  }, [token, isPrivileged, selectedClass]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    } else {
      setOverview(null);
      setStudents([]);
      setError(null);
      setSearchQuery('');
      setStatusFilter('ALL');
    }
  }, [isOpen, loadData]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const matchQuery =
        !searchQuery.trim() ||
        s.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (s.nisn && s.nisn.includes(searchQuery)) ||
        (s.nis && s.nis.includes(searchQuery));

      const matchStatus =
        statusFilter === 'ALL' || (s.plan && s.plan.status === statusFilter);

      return matchQuery && matchStatus;
    });
  }, [students, searchQuery, statusFilter]);

  const handleOpenStudentDetail = (id: string) => {
    setSelectedStudentId(id);
    setIsDrawerOpen(true);
  };

  const handlePlanUpdated = () => {
    loadData();
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="homeroom-modal-title"
    >
      <div className="bg-slate-50 w-full max-w-4xl h-[92vh] max-h-[840px] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-xl shrink-0">
              🎓
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 id="homeroom-modal-title" className="text-base font-bold text-slate-800 tracking-tight truncate">
                  Ruang Wali Kelas: Rencana Studi Siswa
                </h1>
                {isPrivileged && (
                  <span className="px-2 py-0.5 text-[10px] font-extrabold bg-purple-100 text-purple-700 rounded-md border border-purple-200 shrink-0">
                    Mode Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5 font-medium truncate">
                {overview
                  ? `Rombel ${overview.assignedClass} • Angkatan ${overview.targetGraduationYear} • ${overview.teacherName}`
                  : `Wali Kelas: ${user?.full_name || 'Administrator'}`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isPrivileged && (
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
                {['9A', '9B'].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setSelectedClass(c);
                      loadData(c);
                    }}
                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                      selectedClass === c
                        ? 'bg-white text-emerald-800 shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Kelas {c}
                  </button>
                ))}
              </div>
            )}
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              aria-label="Tutup Ruang Wali Kelas"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Modal Subheader: KPI Strip */}
        {overview && (
          <div className="px-5 py-3.5 bg-white/80 border-b border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-2.5 shrink-0">
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Siswa</span>
              <p className="text-lg font-bold text-slate-800 mt-0.5">{overview.totalStudents}</p>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-50/60 border border-emerald-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Terverifikasi</span>
              <p className="text-lg font-bold text-emerald-700 mt-0.5">
                {overview.stats.verified}{' '}
                <span className="text-xs font-medium text-emerald-600">({overview.completionRate}%)</span>
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-sky-50/60 border border-sky-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-600">Menunggu</span>
              <p className="text-lg font-bold text-sky-700 mt-0.5">
                {overview.stats.submitted + overview.stats.pendingVerification}
              </p>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-100">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600">Perlu Revisi</span>
              <p className="text-lg font-bold text-amber-700 mt-0.5">{overview.stats.needsRevision}</p>
            </div>
          </div>
        )}

        {/* Filter & Search Bar */}
        <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between shrink-0">
          {/* Status Filter Chips */}
          <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('ALL')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                statusFilter === 'ALL'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Semua ({students.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('pending_verification')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                statusFilter === 'pending_verification'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Menunggu ({overview?.stats.pendingVerification || 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('verified')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                statusFilter === 'verified'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Terverifikasi ({overview?.stats.verified || 0})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('needs_revision')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-colors shrink-0 ${
                statusFilter === 'needs_revision'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Revisi ({overview?.stats.needsRevision || 0})
            </button>
          </div>

          {/* Search Input */}
          <div className="relative min-w-[200px] sm:w-64">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama atau NISN..."
              className="w-full text-xs pl-8 pr-3 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all placeholder:text-slate-400 bg-slate-50"
            />
            <span className="absolute left-2.5 top-2.5 text-xs text-slate-400">🔍</span>
          </div>
        </div>

        {/* Scrollable Student Cards Roster */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
              <div className="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Memuat data siswa kelas 9...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-relaxed text-center flex flex-col items-center gap-2">
              <span>⚠️ {error}</span>
              <button
                type="button"
                onClick={() => loadData()}
                className="px-3 py-1 bg-rose-100 hover:bg-rose-200 text-rose-800 font-bold rounded-lg transition-colors cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          )}

          {!loading && !error && filteredStudents.length === 0 && (
            <div className="text-center py-16 text-slate-400 text-xs">
              Tidak ada siswa yang sesuai dengan filter pencarian.
            </div>
          )}

          {!loading &&
            !error &&
            filteredStudents.map((s) => (
              <div
                key={s.id}
                className="p-4 bg-white rounded-xl border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3"
              >
                {/* Student Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-xs font-bold text-slate-700 shrink-0">
                    {s.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className="text-xs font-bold text-slate-800 truncate">{s.fullName}</h4>
                      <span className="text-[10px] text-slate-400 font-medium">({s.gender || '-'})</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      NISN: {s.nisn || '-'} • Rombel: {s.className}
                    </p>
                    {s.plan.firstChoice && (
                      <p className="text-[11px] text-emerald-700 font-medium truncate mt-0.5">
                        🏫 {s.plan.firstChoice.schoolName}{' '}
                        {s.plan.firstChoice.majorName ? `(${s.plan.firstChoice.majorName})` : ''}
                      </p>
                    )}
                  </div>
                </div>

                {/* Status Badges & Action */}
                <div className="flex items-center gap-2.5 self-end sm:self-center shrink-0">
                  <div className="text-right hidden sm:block">
                    {s.plan.status === 'verified' && (
                      <span className="px-2.5 py-1 text-[11px] font-semibold text-emerald-800 bg-emerald-100 rounded-lg">
                        ✓ Terverifikasi
                      </span>
                    )}
                    {s.plan.status === 'needs_revision' && (
                      <span className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100 rounded-lg">
                        ⚠️ Perlu Revisi
                      </span>
                    )}
                    {(s.plan.status === 'submitted' || s.plan.status === 'pending_verification') && (
                      <span className="px-2.5 py-1 text-[11px] font-semibold text-sky-800 bg-sky-100 rounded-lg">
                        ⏳ Menunggu
                      </span>
                    )}
                    {s.plan.status === 'draft' && (
                      <span className="px-2.5 py-1 text-[11px] font-semibold text-slate-500 bg-slate-100 rounded-lg">
                        Draft
                      </span>
                    )}
                  </div>

                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => handleOpenStudentDetail(s.id)}
                    className="text-xs h-10 px-3.5 rounded-xl font-semibold border-slate-200 hover:bg-slate-100"
                  >
                    Tinjau Rencana ➔
                  </Button>
                </div>
              </div>
            ))}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>Menampilkan {filteredStudents.length} dari {students.length} siswa</span>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            className="text-xs h-9 px-4 rounded-lg"
          >
            Tutup
          </Button>
        </div>
      </div>

      {/* Slide-over Detail Drawer */}
      <StudentPlanDetailDrawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        studentId={selectedStudentId}
        token={token}
        onPlanUpdated={handlePlanUpdated}
      />
    </div>
  );
};
