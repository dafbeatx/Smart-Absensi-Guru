import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Award,
  Plus,
  Search,
  Download,
  Calendar,
  Clock,
  Building2,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  ChevronRight,
  ArrowLeft,
  X,
  RefreshCw,
  Users,
} from 'lucide-react';
import type { UserProfile } from '../../../types/database.types';
import type {
  BimtekRecord,
  CreateBimtekDTO,
  UpdateBimtekDTO,
  VerifyBimtekDTO,
} from '../../../types/bimtek.types';
import {
  BIMTEK_ACTIVITY_LABELS,
  BIMTEK_SCOPE_LABELS,
  BIMTEK_STATUS_LABELS,
} from '../../../types/bimtek.types';
import {
  BimtekRepository,
  BIMTEK_CHANGED_EVENT,
} from '../../../repositories/BimtekRepository';
import { BimtekRecordModal } from './BimtekRecordModal';
import { BimtekDetailModal } from './BimtekDetailModal';

export interface BimtekManagementViewProps {
  currentUser?: UserProfile | null;
  onBack?: () => void;
  initialTab?: 'MY_BIMTEK' | 'ALL_TEACHERS';
  academicYear?: string;
}

export const BimtekManagementView: React.FC<BimtekManagementViewProps> = ({
  currentUser,
  onBack,
  initialTab = 'MY_BIMTEK',
  academicYear = '2026/2027',
}) => {
  const isLeader = currentUser?.role === 'ADMIN' || currentUser?.role === 'KEPSEK';

  // Tab State
  const [activeTab, setActiveTab] = useState<'MY_BIMTEK' | 'ALL_TEACHERS'>(
    isLeader && initialTab === 'ALL_TEACHERS' ? 'ALL_TEACHERS' : 'MY_BIMTEK'
  );

  // Data & Loading States
  const [records, setRecords] = useState<BimtekRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedActivityType, setSelectedActivityType] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('ALL');

  // Modals
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<BimtekRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<BimtekRecord | null>(null);

  // Fetch Data
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setIsError(false);
      setErrorMessage(null);

      let data: BimtekRecord[] = [];
      if (activeTab === 'MY_BIMTEK') {
        if (currentUser?.id) {
          data = await BimtekRepository.getByUserId(currentUser.id);
        } else {
          data = await BimtekRepository.getAll();
        }
      } else {
        data = await BimtekRepository.getAll();
      }
      setRecords(data);
    } catch (err: any) {
      setIsError(true);
      setErrorMessage(err?.message || 'Gagal memuat catatan kegiatan bimtek.');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, currentUser?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Real-time synchronization
  useEffect(() => {
    const handleSync = () => {
      loadData();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener(BIMTEK_CHANGED_EVENT, handleSync);
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener(BIMTEK_CHANGED_EVENT, handleSync);
      }
    };
  }, [loadData]);

  // List of unique teachers for filter (in ALL_TEACHERS tab)
  const teacherOptions = useMemo(() => {
    const map = new Map<string, string>();
    records.forEach((r) => {
      if (r.user_id && r.teacher_name) {
        map.set(r.user_id, r.teacher_name);
      }
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [records]);

  // Filtered Records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      const matchSearch =
        !searchQuery ||
        r.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.organizer.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.teacher_name && r.teacher_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (r.location_or_platform && r.location_or_platform.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchType =
        selectedActivityType === 'ALL' || r.activity_type === selectedActivityType;

      const matchStatus =
        selectedStatus === 'ALL' || r.status === selectedStatus;

      const matchTeacher =
        selectedTeacherId === 'ALL' || r.user_id === selectedTeacherId;

      return matchSearch && matchType && matchStatus && matchTeacher;
    });
  }, [records, searchQuery, selectedActivityType, selectedStatus, selectedTeacherId]);

  // Calculated Statistics
  const stats = useMemo(() => {
    return BimtekRepository.calculateStatistics(records);
  }, [records]);

  // Handlers
  const handleCreateNew = () => {
    setEditingRecord(null);
    setIsRecordModalOpen(true);
  };

  const handleEdit = (record: BimtekRecord) => {
    setEditingRecord(record);
    setIsRecordModalOpen(true);
  };

  const handleSave = async (dto: CreateBimtekDTO | UpdateBimtekDTO) => {
    if (editingRecord) {
      await BimtekRepository.update(editingRecord.id, dto as UpdateBimtekDTO);
    } else {
      await BimtekRepository.create(dto as CreateBimtekDTO);
    }
    await loadData();
  };

  const handleVerify = async (id: string, dto: VerifyBimtekDTO) => {
    await BimtekRepository.verify(id, dto);
    await loadData();
  };

  const handleDelete = async (id: string) => {
    await BimtekRepository.delete(id);
    await loadData();
  };

  const handleExportCsv = () => {
    BimtekRepository.exportToCsv(filteredRecords, academicYear);
  };

  return (
    <div className="w-full min-h-dvh bg-slate-50 flex flex-col antialiased">
      
      {/* 1. STICKY HEADER (56px) - Safe Area Mobile */}
      <header className="h-14 sm:h-16 px-4 bg-white border-b border-slate-200/90 flex items-center justify-between shrink-0 sticky top-0 z-30 pt-[env(safe-area-inset-top)] backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              aria-label="Kembali"
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}

          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-700 shrink-0">
            <Award className="w-5 h-5" />
          </div>

          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-black text-slate-900 truncate leading-snug">
              Pencatatan Bimtek & Diklat Guru
            </h1>
            <p className="text-[11px] text-slate-500 font-semibold truncate">
              SMP Terpadu Al-Ittihadiyah • TP {academicYear}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={loadData}
            title="Segarkan Data"
            disabled={isLoading}
            className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 active:scale-95 transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          {isLeader && (
            <button
              type="button"
              onClick={handleExportCsv}
              title="Unduh Rekap CSV / Excel"
              disabled={records.length === 0}
              className="hidden sm:inline-flex items-center gap-1.5 h-9 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold active:scale-95 transition-all cursor-pointer disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCreateNew}
            className="h-9 sm:h-10 px-3 sm:px-4 rounded-xl bg-[#023246] hover:bg-[#03445e] text-white text-xs font-black flex items-center gap-1.5 shadow-2xs active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span className="hidden sm:inline">Catat Bimtek</span>
            <span className="sm:hidden">Tambah</span>
          </button>
        </div>
      </header>

      {/* 2. SCROLLABLE WORKSPACE */}
      <main className="flex-1 overflow-y-auto px-4 py-4 max-w-5xl mx-auto w-full space-y-4">
        
        {/* TAB TOGGLE: Jika Pimpinan / Admin Sekolah */}
        {isLeader && (
          <div className="flex p-1 bg-slate-200/80 rounded-xl max-w-sm">
            <button
              type="button"
              onClick={() => setActiveTab('MY_BIMTEK')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'MY_BIMTEK'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bimtek Saya
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('ALL_TEACHERS')}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                activeTab === 'ALL_TEACHERS'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>Rekap Dewan Guru</span>
            </button>
          </div>
        )}

        {/* STATISTIK CARDS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3">
          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between gap-1 text-slate-500 text-[10px] sm:text-xs font-bold uppercase">
              <span>Total Beban JP</span>
              <Clock className="w-3.5 h-3.5 text-indigo-600" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-1">
              {stats.totalDurationHours} <span className="text-xs font-bold text-slate-500">JP</span>
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Akumulasi Jam Pelatihan</p>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between gap-1 text-slate-500 text-[10px] sm:text-xs font-bold uppercase">
              <span>Kegiatan Valid</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-emerald-700 mt-1">
              {stats.approvedCount}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Disetujui Pimpinan</p>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between gap-1 text-slate-500 text-[10px] sm:text-xs font-bold uppercase">
              <span>Menunggu Validasi</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-amber-700 mt-1">
              {stats.submittedCount}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Perlu Peninjauan</p>
          </div>

          <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-2xs">
            <div className="flex items-center justify-between gap-1 text-slate-500 text-[10px] sm:text-xs font-bold uppercase">
              <span>Sertifikat Ada</span>
              <FileCheck className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <p className="text-lg sm:text-2xl font-black text-blue-700 mt-1">
              {stats.totalCertificates}
            </p>
            <p className="text-[10px] text-slate-500 mt-0.5">Bukti Terlampir</p>
          </div>
        </div>

        {/* SEARCH & FILTER CONTROLS */}
        <div className="bg-white border border-slate-200 rounded-xl p-3 space-y-2.5 shadow-2xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari nama bimtek, penyelenggara, atau lokasi..."
              className="w-full h-10 pl-9 pr-3 text-xs sm:text-sm bg-slate-50 border border-slate-200 rounded-lg focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-none text-slate-900 transition-all placeholder:text-slate-400"
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Filter Jenis Kegiatan */}
            <select
              value={selectedActivityType}
              onChange={(e) => setSelectedActivityType(e.target.value)}
              className="h-8 px-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Jenis Kegiatan</option>
              {Object.entries(BIMTEK_ACTIVITY_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {String(label)}
                </option>
              ))}
            </select>

            {/* Filter Status */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="h-8 px-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
            >
              <option value="ALL">Semua Status Validasi</option>
              {Object.entries(BIMTEK_STATUS_LABELS).map(([k, label]) => (
                <option key={k} value={k}>
                  {String(label)}
                </option>
              ))}
            </select>

            {/* Filter Guru (Khusus Mode Rekap Dewan Guru) */}
            {activeTab === 'ALL_TEACHERS' && teacherOptions.length > 0 && (
              <select
                value={selectedTeacherId}
                onChange={(e) => setSelectedTeacherId(e.target.value)}
                className="h-8 px-2 text-xs font-bold bg-slate-50 border border-slate-200 rounded-lg text-slate-700 outline-none cursor-pointer"
              >
                <option value="ALL">Semua Guru ({teacherOptions.length} Orang)</option>
                {teacherOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            )}

            {(searchQuery || selectedActivityType !== 'ALL' || selectedStatus !== 'ALL' || selectedTeacherId !== 'ALL') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedActivityType('ALL');
                  setSelectedStatus('ALL');
                  setSelectedTeacherId('ALL');
                }}
                className="h-8 px-2 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>Reset Filter</span>
              </button>
            )}
          </div>
        </div>

        {/* 3. LIST VIEW & STATUS STATES */}
        {isLoading ? (
          // SKELETON LOADING STATE
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 bg-white border border-slate-200 rounded-xl animate-pulse space-y-3">
                <div className="flex items-center justify-between">
                  <div className="h-4 bg-slate-200 rounded w-24" />
                  <div className="h-4 bg-slate-200 rounded w-16" />
                </div>
                <div className="h-5 bg-slate-200 rounded w-3/4" />
                <div className="h-3 bg-slate-200 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : isError ? (
          // ERROR STATE
          <div className="p-6 bg-rose-50 border border-rose-200 rounded-2xl text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-600 mx-auto" />
            <h3 className="text-sm font-bold text-rose-900">Kendala Memuat Data</h3>
            <p className="text-xs text-rose-700 max-w-md mx-auto">{errorMessage}</p>
            <button
              type="button"
              onClick={loadData}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Coba Lagi
            </button>
          </div>
        ) : filteredRecords.length === 0 ? (
          // EMPTY STATE
          <div className="p-8 sm:p-12 bg-white border border-slate-200 rounded-2xl text-center space-y-3.5 shadow-2xs">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200/80 text-indigo-700 flex items-center justify-center mx-auto">
              <Award className="w-7 h-7" />
            </div>
            <h3 className="text-sm sm:text-base font-black text-slate-900">
              {searchQuery || selectedActivityType !== 'ALL' || selectedStatus !== 'ALL'
                ? 'Tidak Ada Data Sesuai Filter'
                : 'Belum Ada Catatan Kegiatan Bimtek'}
            </h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
              {searchQuery || selectedActivityType !== 'ALL' || selectedStatus !== 'ALL'
                ? 'Silakan sesuaikan kata kunci pencarian atau reset filter untuk menampilkan catatan lainnya.'
                : 'Catat kegiatan pelatihan, bimbingan teknis, workshop, atau webinar yang Anda ikuti untuk mendokumentasikan JP dan sertifikat resmi.'}
            </p>
            <button
              type="button"
              onClick={handleCreateNew}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#023246] hover:bg-[#03445e] text-white text-xs font-black shadow-md active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Catat Bimtek Sekarang</span>
            </button>
          </div>
        ) : (
          // NORMAL LIST VIEW
          <div className="space-y-2.5">
            <div className="flex items-center justify-between px-1 text-xs font-bold text-slate-500">
              <span>Menampilkan {filteredRecords.length} Kegiatan</span>
              <span>Tahun Ajaran {academicYear}</span>
            </div>

            {filteredRecords.map((item) => {
              const statusColor =
                item.status === 'APPROVED'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  : item.status === 'REVISION'
                  ? 'bg-rose-50 text-rose-800 border-rose-200'
                  : 'bg-amber-50 text-amber-800 border-amber-200';

              return (
                <div
                  key={item.id}
                  onClick={() => {
                    setSelectedRecord(item);
                    setIsDetailModalOpen(true);
                  }}
                  className="p-3.5 sm:p-4 bg-white border border-slate-200 hover:border-indigo-300 rounded-xl shadow-2xs hover:shadow-xs transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-black border ${statusColor}`}>
                        {BIMTEK_STATUS_LABELS[item.status] || item.status}
                      </span>
                      <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-[10px] font-bold">
                        {BIMTEK_ACTIVITY_LABELS[item.activity_type] || item.activity_type}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">
                        • {BIMTEK_SCOPE_LABELS[item.scope]}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <span className="px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-800 font-black text-xs border border-emerald-200">
                        {item.duration_hours} JP
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-700 group-hover:translate-x-0.5 transition-all" />
                    </div>
                  </div>

                  <h3 className="text-xs sm:text-sm font-black text-slate-900 group-hover:text-indigo-950 leading-snug line-clamp-2">
                    {item.title}
                  </h3>

                  <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 flex-wrap pt-1 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-700 flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                        <span className="truncate max-w-[160px] sm:max-w-xs">{item.organizer}</span>
                      </span>
                      {activeTab === 'ALL_TEACHERS' && (
                        <span className="text-slate-400">
                          | Guru: <strong className="text-slate-800">{item.teacher_name}</strong>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        <span>{item.start_date}</span>
                      </span>
                      {item.certificate_url && (
                        <span className="text-indigo-600 font-bold flex items-center gap-0.5">
                          <FileCheck className="w-3 h-3" />
                          <span>Sertifikat Ada</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* 4. MODALS */}
      <BimtekRecordModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSave={handleSave}
        editRecord={editingRecord}
        currentUser={currentUser}
        academicYear={academicYear}
      />

      <BimtekDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        record={selectedRecord}
        currentUser={currentUser}
        onVerify={handleVerify}
        onEdit={(rec) => {
          setIsDetailModalOpen(false);
          handleEdit(rec);
        }}
        onDelete={handleDelete}
      />
    </div>
  );
};
