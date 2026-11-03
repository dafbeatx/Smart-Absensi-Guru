import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  HeartHandshake,
  Plus,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Download,
  RefreshCw,
  Globe,
  ExternalLink,
  ChevronRight,
  Filter,
  Calendar,
  Sparkles,
} from 'lucide-react';
import type {
  CounselingRecord,
  CounselingType,
  CounselingStatus,
  CounselingUrgency,
  CreateCounselingDTO,
  UpdateCounselingDTO,
} from '../../../types/counseling.types';
import {
  COUNSELING_TYPE_LABELS,
  COUNSELING_STATUS_LABELS,
  COUNSELING_URGENCY_LABELS,
} from '../../../types/counseling.types';
import { CounselingRepository, COUNSELING_CHANGED_EVENT } from '../../../repositories/CounselingRepository';
import { StudentBehaviorRepository } from '../../../repositories/StudentBehaviorRepository';
import { CounselingRecordModal } from './CounselingRecordModal';
import { CounselingDetailModal } from './CounselingDetailModal';
import { logger } from '../../../utils/logger.utils';

export interface CounselingManagementViewProps {
  currentUser: {
    id: string;
    full_name?: string;
    nip?: string | null;
    role?: string;
    position?: string;
    avatar_url?: string | null;
  };
  onBack?: () => void;
}

const CLASS_OPTIONS = ['ALL', '7A', '7B', '7C', '7D', '8A', '8B', '8C', '8D', '9A', '9B', '9C', '9D', '9E'];

export const CounselingManagementView: React.FC<CounselingManagementViewProps> = ({
  currentUser,
  onBack,
}) => {
  const [records, setRecords] = useState<CounselingRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<CounselingType | 'ALL'>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<CounselingStatus | 'ALL'>('ALL');
  const [selectedUrgency, setSelectedUrgency] = useState<CounselingUrgency | 'ALL'>('ALL');
  const [activeTab, setActiveTab] = useState<'ALL_RECORDS' | 'MY_RECORDS'>('ALL_RECORDS');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<CounselingRecord | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<CounselingRecord | null>(null);

  // Student Presets for Quick Pick
  const [studentPresets, setStudentPresets] = useState<
    Array<{ id: string; name: string; class_name: string; nisn?: string | null }>
  >([]);

  const counselorName = currentUser.full_name || 'Guru Bimbingan Konseling';
  const counselorId = currentUser.id;
  const counselorNpp = currentUser.nip || null;

  // Load Records
  const loadRecords = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await CounselingRepository.getAll();
      setRecords(data);
    } catch (err: any) {
      logger.error('CounselingManagementView', 'Failed to load counseling records:', err);
      setError('Gagal memuat catatan BK. Silakan coba beberapa saat lagi.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load Student Presets from StudentBehaviorRepository
  useEffect(() => {
    StudentBehaviorRepository.getBehaviors('ALL', '2026/2027')
      .then((students) => {
        if (students && students.length > 0) {
          setStudentPresets(
            students.map((s) => ({
              id: s.id,
              name: s.student_name,
              class_name: s.class_name,
              nisn: (s as any).student_nisn || null,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Initial Load & Listen for Broadcast Events
  useEffect(() => {
    loadRecords();

    const handleUpdate = () => {
      loadRecords();
    };

    window.addEventListener(COUNSELING_CHANGED_EVENT, handleUpdate);
    return () => {
      window.removeEventListener(COUNSELING_CHANGED_EVENT, handleUpdate);
    };
  }, [loadRecords]);

  // Handle Form Submission (Create or Update)
  const handleRecordSubmit = async (dto: CreateCounselingDTO | UpdateCounselingDTO) => {
    if (editingRecord) {
      await CounselingRepository.update(editingRecord.id, dto as UpdateCounselingDTO);
    } else {
      await CounselingRepository.create(dto as CreateCounselingDTO);
    }
    await loadRecords();
  };

  // Handle Delete
  const handleDelete = async (id: string) => {
    await CounselingRepository.delete(id);
    await loadRecords();
  };

  // KPI Statistics
  const stats = useMemo(() => {
    return CounselingRepository.calculateStatistics(records);
  }, [records]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      // Tab filter
      if (activeTab === 'MY_RECORDS' && r.counselor_id !== counselorId) {
        return false;
      }
      // Class filter
      if (selectedClass !== 'ALL' && r.class_name !== selectedClass) {
        return false;
      }
      // Type filter
      if (selectedType !== 'ALL' && r.counseling_type !== selectedType) {
        return false;
      }
      // Status filter
      if (selectedStatus !== 'ALL' && r.status !== selectedStatus) {
        return false;
      }
      // Urgency filter
      if (selectedUrgency !== 'ALL' && r.urgency !== selectedUrgency) {
        return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = r.student_name.toLowerCase().includes(q);
        const matchTopic = r.topic.toLowerCase().includes(q);
        const matchCounselor = r.counselor_name.toLowerCase().includes(q);
        const matchNisn = r.student_nisn ? r.student_nisn.includes(q) : false;
        if (!matchName && !matchTopic && !matchCounselor && !matchNisn) {
          return false;
        }
      }
      return true;
    });
  }, [records, activeTab, selectedClass, selectedType, selectedStatus, selectedUrgency, searchQuery, counselorId]);

  return (
    <div className="min-h-screen bg-slate-50 pb-20 sm:pb-12 text-slate-900 font-sans">
      {/* ── 1. HEADER SECTION ─────────────────────────────────────────── */}
      <div className="bg-linear-to-r from-emerald-800 via-teal-900 to-[#023246] text-white pt-6 pb-8 px-4 sm:px-6 shadow-md">
        <div className="max-w-6xl mx-auto space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  ← Kembali
                </button>
              )}
              <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 border border-white/20 shadow-xs">
                <HeartHandshake className="w-6 h-6 text-emerald-300" />
              </div>
              <div>
                <h1 className="text-lg sm:text-xl font-black tracking-tight flex items-center gap-2">
                  <span>Catatan Bimbingan Konseling (BK)</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/25 border border-emerald-400/30 text-emerald-200 font-bold hidden sm:inline-flex items-center gap-1">
                    <Sparkles className="w-2.5 h-2.5" />
                    Terpadu
                  </span>
                </h1>
                <p className="text-xs text-emerald-100/90 font-medium">
                  Layanan konseling, pembinaan karakter, dan pendampingan belajar siswa SMP Terpadu Al-Ittihadiyah
                </p>
              </div>
            </div>

            {/* BUTTONS: LINK NAWASENA SISWA & TAMBAH CATATAN */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end flex-wrap">
              <a
                href="https://nawasena-platform-siswa.vercel.app/"
                target="_blank"
                rel="noopener noreferrer"
                className="h-10 px-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center gap-1.5 border border-white/20 cursor-pointer shadow-2xs"
                title="Buka portal aplikasi siswa Nawasena"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-300" />
                <span>Nawasena Siswa</span>
                <ExternalLink className="w-3 h-3 text-white/70" />
              </a>

              <button
                type="button"
                onClick={() => {
                  setEditingRecord(null);
                  setIsRecordModalOpen(true);
                }}
                className="h-10 px-4 rounded-xl bg-linear-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 text-slate-950 text-xs sm:text-sm font-black shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>Catat Bimbingan</span>
              </button>
            </div>
          </div>

          {/* SINKRONISASI NAWASENA CALLOUT BAR */}
          <div className="p-3 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-xs flex items-center justify-between gap-3 text-xs flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shrink-0" />
              <span className="font-semibold text-emerald-100 truncate">
                Terkoneksi real-time dengan <strong>Nawasena Platform Siswa</strong> (Supabase Dual-Database Toren 1 & Toren 2).
              </span>
            </div>
            <span className="text-[11px] font-bold text-emerald-200 bg-white/10 px-2.5 py-0.5 rounded-lg shrink-0">
              {stats.publicToNawasenaCount} Catatan Terbuka untuk Siswa
            </span>
          </div>

          {/* ── KPI METRICS ROW ────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3.5 pt-1">
            <div className="bg-white/10 border border-white/15 rounded-2xl p-3 backdrop-blur-xs">
              <div className="flex items-center justify-between text-emerald-200 text-xs font-bold">
                <span>Total Layanan</span>
                <HeartHandshake className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-white">{stats.totalRecords}</div>
              <span className="text-[10px] text-emerald-100/80 font-medium">Semua jenis bimbingan</span>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl p-3 backdrop-blur-xs">
              <div className="flex items-center justify-between text-emerald-200 text-xs font-bold">
                <span>Selesai / Tuntas</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-300" />
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-white">{stats.resolvedCount}</div>
              <span className="text-[10px] text-emerald-100/80 font-medium">Kasus berhasil diselesaikan</span>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl p-3 backdrop-blur-xs">
              <div className="flex items-center justify-between text-amber-200 text-xs font-bold">
                <span>Sedang Proses</span>
                <Clock className="w-4 h-4 text-amber-300" />
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-white">{stats.inProgressCount}</div>
              <span className="text-[10px] text-emerald-100/80 font-medium">Pembinaan aktif / jadwal</span>
            </div>

            <div className="bg-white/10 border border-white/15 rounded-2xl p-3 backdrop-blur-xs">
              <div className="flex items-center justify-between text-rose-200 text-xs font-bold">
                <span>Prioritas Tinggi</span>
                <AlertTriangle className="w-4 h-4 text-rose-300" />
              </div>
              <div className="text-xl sm:text-2xl font-black mt-1 text-white">{stats.highUrgencyCount}</div>
              <span className="text-[10px] text-emerald-100/80 font-medium">
                {stats.parentInvolvedCount} melibatkan orang tua
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. CONTENT WRAPPER ────────────────────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-3 space-y-4">
        {/* TABS & CSV EXPORT */}
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 shadow-2xs flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/90 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('ALL_RECORDS')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'ALL_RECORDS'
                  ? 'bg-white text-emerald-950 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Catatan BK ({records.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('MY_RECORDS')}
              className={`px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === 'MY_RECORDS'
                  ? 'bg-white text-emerald-950 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bimbingan Saya ({records.filter((r) => r.counselor_id === counselorId).length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => CounselingRepository.exportToCsv(filteredRecords)}
              disabled={filteredRecords.length === 0}
              className="h-9 px-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5 text-slate-500" />
              <span>Ekspor CSV</span>
            </button>
            <button
              type="button"
              onClick={loadRecords}
              className="h-9 w-9 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-all cursor-pointer"
              title="Segarkan data"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* SEARCH & FILTERS CONTROLS */}
        <div className="bg-white border border-slate-200 rounded-2xl p-3 sm:p-4 space-y-3 shadow-2xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama siswa, topik bimbingan, konselor, atau NISN..."
              className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 mr-1">
              <Filter className="w-3.5 h-3.5" />
              <span>Filter:</span>
            </div>

            {/* Filter Kelas */}
            <select
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              className="h-8.5 px-2.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
            >
              {CLASS_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'Semua Kelas' : `Kelas ${c}`}
                </option>
              ))}
            </select>

            {/* Filter Jenis Layanan */}
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
              className="h-8.5 px-2.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Jenis Layanan</option>
              {Object.entries(COUNSELING_TYPE_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="h-8.5 px-2.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status</option>
              {Object.entries(COUNSELING_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            {/* Filter Urgensi */}
            <select
              value={selectedUrgency}
              onChange={(e) => setSelectedUrgency(e.target.value as any)}
              className="h-8.5 px-2.5 text-xs font-bold bg-white border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Urgensi</option>
              {Object.entries(COUNSELING_URGENCY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </select>

            {(selectedClass !== 'ALL' ||
              selectedType !== 'ALL' ||
              selectedStatus !== 'ALL' ||
              selectedUrgency !== 'ALL' ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedClass('ALL');
                  setSelectedType('ALL');
                  setSelectedStatus('ALL');
                  setSelectedUrgency('ALL');
                  setSearchQuery('');
                }}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 ml-auto cursor-pointer"
              >
                Reset Filter
              </button>
            )}
          </div>
        </div>

        {/* ── 3. LIST OF COUNSELING RECORDS ────────────────────────────── */}
        {error && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center justify-between gap-3 text-xs sm:text-sm">
            <span>{error}</span>
            <button
              type="button"
              onClick={loadRecords}
              className="px-3 py-1 bg-rose-600 text-white font-bold rounded-lg hover:bg-rose-700"
            >
              Coba Lagi
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 rounded-2xl bg-white border border-slate-200 animate-pulse space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="w-36 h-4 bg-slate-200 rounded" />
                  <div className="w-20 h-4 bg-slate-200 rounded" />
                </div>
                <div className="w-3/4 h-5 bg-slate-200 rounded" />
                <div className="w-1/2 h-4 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : filteredRecords.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-2xl bg-white border border-slate-200 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 mx-auto flex items-center justify-center">
              <HeartHandshake className="w-6 h-6" />
            </div>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              Belum Ada Catatan Bimbingan Konseling
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || selectedClass !== 'ALL' || selectedType !== 'ALL'
                ? 'Tidak ada catatan bimbingan yang sesuai dengan filter pencarian.'
                : 'Mulai catat bimbingan konseling pertama untuk mendampingi perkembangan karakter peserta didik.'}
            </p>
            <button
              type="button"
              onClick={() => {
                setEditingRecord(null);
                setIsRecordModalOpen(true);
              }}
              className="px-4 py-2 rounded-xl bg-[#023246] hover:bg-[#03445e] text-white text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Catatan BK</span>
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredRecords.map((item) => (
              <div
                key={item.id}
                className="bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 shadow-2xs hover:border-emerald-300 hover:shadow-xs transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-[10px] font-black uppercase tracking-wider">
                        Kelas {item.class_name}
                      </span>
                      <span className="text-xs font-bold text-slate-500">•</span>
                      <span className="text-xs font-bold text-slate-700">
                        {item.student_name}
                      </span>
                      {item.student_nisn && (
                        <span className="text-[11px] text-slate-400">
                          (NISN: {item.student_nisn})
                        </span>
                      )}
                    </div>
                    <h3
                      onClick={() => {
                        setSelectedRecord(item);
                        setIsDetailModalOpen(true);
                      }}
                      className="text-sm sm:text-base font-black text-slate-900 hover:text-emerald-800 transition-colors cursor-pointer leading-snug"
                    >
                      {item.topic}
                    </h3>
                  </div>

                  {/* STATUS & VISIBILITY BADGES */}
                  <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
                    <span
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-md ${
                        item.status === 'RESOLVED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : item.status === 'IN_PROGRESS'
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {COUNSELING_STATUS_LABELS[item.status] || item.status}
                    </span>

                    {item.visibility === 'PUBLIC_STUDENT' && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-md bg-blue-50 text-blue-700 border border-blue-200/80 flex items-center gap-1">
                        <Globe className="w-2.5 h-2.5" />
                        Nawasena
                      </span>
                    )}
                  </div>
                </div>

                {/* ARAHAN / TINDAKAN SINGKAT */}
                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50/80 p-2.5 rounded-xl border border-slate-100">
                  {item.action_taken}
                </p>

                {/* METADATA FOOTER & ACTION BUTTONS */}
                <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 pt-2 border-t border-slate-100 flex-wrap">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="flex items-center gap-1 text-slate-700 font-semibold">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      <span>{item.counseling_date}</span>
                      {item.counseling_time && <span>({item.counseling_time} WIB)</span>}
                    </span>
                    <span className="text-slate-400">
                      Konselor: <strong className="text-slate-800">{item.counselor_name}</strong>
                    </span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[10px]">
                      {COUNSELING_TYPE_LABELS[item.counseling_type] || item.counseling_type}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 ml-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedRecord(item);
                        setIsDetailModalOpen(true);
                      }}
                      className="px-3 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer"
                    >
                      <span>Rincian</span>
                      <ChevronRight className="w-3 h-3" />
                    </button>
                    {(currentUser.role === 'ADMIN' || currentUser.role === 'KEPSEK' || item.counselor_id === counselorId) && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingRecord(item);
                          setIsRecordModalOpen(true);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 4. RECORD MODAL (CREATE / EDIT) ───────────────────────────── */}
      <CounselingRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => {
          setIsRecordModalOpen(false);
          setEditingRecord(null);
        }}
        onSubmit={handleRecordSubmit}
        editRecord={editingRecord}
        counselorName={counselorName}
        counselorId={counselorId}
        counselorNpp={counselorNpp}
        studentPresets={studentPresets}
      />

      {/* ── 5. DETAIL MODAL ───────────────────────────────────────────── */}
      <CounselingDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedRecord(null);
        }}
        record={selectedRecord}
        onEdit={(rec) => {
          setEditingRecord(rec);
          setIsRecordModalOpen(true);
        }}
        onDelete={handleDelete}
        canManage={
          currentUser.role === 'ADMIN' ||
          currentUser.role === 'KEPSEK' ||
          selectedRecord?.counselor_id === counselorId
        }
      />
    </div>
  );
};

