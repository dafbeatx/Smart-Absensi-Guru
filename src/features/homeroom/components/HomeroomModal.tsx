import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { UserProfile } from '../../../types/database.types';
import type {
  HomeroomOverview,
  HomeroomStudentItem,
  PlanStatus,
} from '../../../types/homeroom.types';
import { HomeroomRepository } from '../../../repositories/HomeroomRepository';
import { StudentPlanDetailDrawer } from './StudentPlanDetailDrawer';

interface HomeroomModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  token: string;
}

type FilterStatus = 'ALL' | PlanStatus;

export const HomeroomModal: React.FC<HomeroomModalProps> = ({
  isOpen,
  onClose,
  user,
  token,
}) => {
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<HomeroomOverview | null>(null);
  const [students, setStudents] = useState<HomeroomStudentItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ALL');
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const loadData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [overviewData, studentsData] = await Promise.all([
        HomeroomRepository.getOverview(token),
        HomeroomRepository.getStudents(token),
      ]);
      setOverview(overviewData);
      setStudents(studentsData);
    } catch (err: any) {
      setError(err?.message || 'Gagal memuat data Ruang Wali Kelas.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (isOpen && token) {
      loadData();
    } else {
      setOverview(null);
      setStudents([]);
      setError(null);
      setSearchQuery('');
      setStatusFilter('ALL');
    }
  }, [isOpen, token, loadData]);

  const filteredStudents = useMemo(() => {
    return students.filter((s) => {
      const q = searchQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        s.fullName.toLowerCase().includes(q) ||
        (s.nisn && s.nisn.includes(q)) ||
        (s.nis && s.nis.includes(q));

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

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'verified':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
            Verified
          </span>
        );
      case 'needs_revision':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-amber-800 bg-amber-100 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
            Perlu Revisi
          </span>
        );
      case 'submitted':
      case 'pending_verification':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-sky-800 bg-sky-100 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-600" />
            Menunggu
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-slate-600 bg-slate-100 rounded-full shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Draft
          </span>
        );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-labelledby="homeroom-modal-title"
    >
      {/* Mobile-First Fullscreen Container (Target: Infinix Note 8 / 360px-412px, responsive on tablet/desktop) */}
      <div className="bg-slate-50 w-full h-full sm:max-w-4xl sm:h-[92vh] sm:max-h-[860px] sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden border-0 sm:border sm:border-slate-200">
        {/* Top App Bar Header */}
        <header className="px-4 py-3 sm:px-5 sm:py-3.5 bg-white border-b border-slate-200 shrink-0 flex items-center justify-between gap-3 safe-top">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={onClose}
              type="button"
              className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center text-lg font-bold shrink-0 transition-colors cursor-pointer"
              aria-label="Kembali"
            >
              ←
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60 shrink-0">
                  SAGA
                </span>
                <h1
                  id="homeroom-modal-title"
                  className="text-sm sm:text-base font-bold text-slate-900 truncate tracking-tight"
                >
                  Ruang Wali Kelas
                </h1>
              </div>
              <p className="text-[11px] sm:text-xs text-slate-500 font-medium truncate mt-0.5">
                {overview
                  ? `Kelas ${overview.assignedClass} • Angkatan ${overview.targetGraduationYear} • ${overview.teacherName}`
                  : `Wali Kelas: ${user.full_name}`}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            type="button"
            className="hidden sm:flex px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            ✕ Tutup
          </button>
        </header>

        {/* Compact Mobile KPI Banner */}
        {overview && (
          <div className="px-4 py-2.5 bg-white border-b border-slate-100 shrink-0">
            <div className="flex items-center justify-between mb-1.5 text-[11px] font-medium text-slate-500">
              <span>Progres Verifikasi Rombel:</span>
              <span className="font-bold text-emerald-700">
                {overview.stats.verified}/{overview.totalStudents} Selesai ({overview.completionRate}%)
              </span>
            </div>
            {/* Progress Bar */}
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mb-2.5">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, Math.max(0, overview.completionRate))}%` }}
              />
            </div>

            {/* Metric Pills Grid (Responsive for 360px) */}
            <div className="grid grid-cols-4 gap-1.5 sm:gap-2">
              <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-1.5 sm:p-2 text-center">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-slate-400 block leading-tight">Total</span>
                <span className="text-xs sm:text-sm font-extrabold text-slate-800">{overview.totalStudents}</span>
              </div>
              <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-1.5 sm:p-2 text-center">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-emerald-600 block leading-tight">Selesai</span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700">{overview.stats.verified}</span>
              </div>
              <div className="bg-sky-50/60 border border-sky-100 rounded-xl p-1.5 sm:p-2 text-center">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-sky-600 block leading-tight">Menunggu</span>
                <span className="text-xs sm:text-sm font-extrabold text-sky-700">
                  {overview.stats.submitted + overview.stats.pendingVerification}
                </span>
              </div>
              <div className="bg-amber-50/60 border border-amber-100 rounded-xl p-1.5 sm:p-2 text-center">
                <span className="text-[9px] sm:text-[10px] uppercase font-bold text-amber-600 block leading-tight">Revisi</span>
                <span className="text-xs sm:text-sm font-extrabold text-amber-700">{overview.stats.needsRevision}</span>
              </div>
            </div>
          </div>
        )}

        {/* Search Input Bar (Touch Target Height 46px) */}
        <div className="px-4 py-2.5 bg-white border-b border-slate-200 shrink-0">
          <div className="relative w-full">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="🔍 Cari nama siswa atau NISN..."
              className="w-full h-11 text-xs sm:text-sm pl-4 pr-10 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 transition-all placeholder:text-slate-400 bg-slate-50/80 text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700 text-sm font-bold w-6 h-6 flex items-center justify-center rounded-full bg-slate-200/60"
                aria-label="Bersihkan pencarian"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Filter Pills (Finger-Friendly Horizontal Scrolling) */}
        <div className="px-4 py-2 bg-slate-100/80 border-b border-slate-200/80 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0 text-xs">
          <button
            type="button"
            onClick={() => setStatusFilter('ALL')}
            className={`h-9 px-3.5 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Semua ({students.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('pending_verification')}
            className={`h-9 px-3.5 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'pending_verification'
                ? 'bg-sky-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            ⏳ Menunggu ({overview?.stats.pendingVerification || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('verified')}
            className={`h-9 px-3.5 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'verified'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            ✓ Verified ({overview?.stats.verified || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('needs_revision')}
            className={`h-9 px-3.5 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'needs_revision'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            ⚠️ Revisi ({overview?.stats.needsRevision || 0})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter('draft')}
            className={`h-9 px-3.5 rounded-lg font-bold shrink-0 transition-all flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'draft'
                ? 'bg-slate-700 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
            }`}
          >
            Draft ({overview?.stats.draft || 0})
          </button>
        </div>

        {/* Student Cards List (Optimized for Infinix Note 8 / One-Handed Scrolling) */}
        <main className="flex-1 overflow-y-auto px-3.5 py-3 sm:px-5 sm:py-4 space-y-2.5 overscroll-contain">
          {loading && (
            <div className="flex flex-col items-center justify-center py-24 text-slate-400 gap-3">
              <div className="w-8 h-8 border-3 border-emerald-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs font-semibold text-slate-500">Memuat data siswa rombel...</span>
            </div>
          )}

          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 leading-relaxed text-center font-medium">
              ⚠️ {error}
            </div>
          )}

          {!loading && !error && filteredStudents.length === 0 && (
            <div className="text-center py-20 px-4">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-xl mx-auto mb-2 text-slate-400">
                🔍
              </div>
              <p className="text-xs font-bold text-slate-700">Tidak ada data siswa ditemukan</p>
              <p className="text-[11px] text-slate-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter status.</p>
            </div>
          )}

          {!loading &&
            !error &&
            filteredStudents.map((s) => (
              <article
                key={s.id}
                onClick={() => handleOpenStudentDetail(s.id)}
                className="w-full bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs hover:border-emerald-300 hover:shadow-xs active:bg-slate-50 transition-all cursor-pointer flex flex-col gap-2.5 touch-manipulation"
                aria-label={`Pilih siswa ${s.fullName}`}
              >
                {/* Top Row: Avatar + Name + Class & NISN */}
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-11 h-11 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                    {s.fullName.substring(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h2 className="text-xs sm:text-sm font-bold text-slate-900 leading-snug break-words">
                        {s.fullName}
                      </h2>
                      <span className="text-[10px] font-semibold text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded shrink-0">
                        {s.gender === 'L' ? 'Laki-laki' : s.gender === 'P' ? 'Perempuan' : '-'}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium mt-0.5">
                      Kelas {s.className} • NISN: {s.nisn || '-'}
                    </p>
                  </div>
                </div>

                {/* Middle Row: School Choice Preview (if any) */}
                {s.plan.firstChoice && (
                  <div className="bg-slate-50 border border-slate-100 rounded-lg px-2.5 py-1.5 text-[11px] text-slate-700 flex items-center gap-1.5 truncate">
                    <span className="shrink-0 text-emerald-600 font-bold">🏫 Pilihan 1:</span>
                    <span className="font-semibold text-slate-900 truncate">
                      {s.plan.firstChoice.schoolName}
                    </span>
                    {s.plan.firstChoice.majorName && (
                      <span className="text-slate-500 truncate">({s.plan.firstChoice.majorName})</span>
                    )}
                  </div>
                )}

                {/* Bottom Row: Status Badge & 'Lihat ›' Touch Target */}
                <div className="flex items-center justify-between pt-1 border-t border-slate-100 mt-0.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-slate-400 font-medium">Status:</span>
                    {getStatusBadge(s.plan.status)}
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenStudentDetail(s.id);
                    }}
                    className="h-10 px-3.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer shrink-0"
                  >
                    Lihat ›
                  </button>
                </div>
              </article>
            ))}
        </main>

        {/* Bottom Safe Bar */}
        <footer className="px-4 py-2.5 bg-white border-t border-slate-200 shrink-0 flex items-center justify-between text-[11px] sm:text-xs text-slate-500 safe-bottom">
          <span>Menampilkan {filteredStudents.length} dari {students.length} siswa</span>
          <button
            type="button"
            onClick={onClose}
            className="sm:hidden px-3 py-1.5 rounded-lg bg-slate-100 font-semibold text-slate-700"
          >
            Tutup
          </button>
        </footer>
      </div>

      {/* Slide-over Detail & Edit Drawer (Mobile-First Sheet) */}
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
