import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AttendanceRecord, UserProfile, LeaveRequest } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { getTodayDateInJakarta } from '../../../utils/time.utils';

interface TeacherDailyBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export type BoardCategory =
  | 'HADIR'
  | 'PULANG'
  | 'IZIN'
  | 'TUGAS'
  | 'SAKIT'
  | 'CUTI'
  | 'BELUM';

export type BoardTab = 'SEMUA' | BoardCategory;

export interface TeacherBoardEntry {
  user: UserProfile;
  record: AttendanceRecord | null;
  leave: LeaveRequest | null;
  category: BoardCategory;
}

// Tentukan kategori spesifik: memisahkan izin, tugas, sakit, cuti secara presisi
function resolveCategory(
  record: AttendanceRecord | null,
  activeLeave: LeaveRequest | null
): BoardCategory {
  // 1. Prioritaskan permohonan izin/tugas/sakit/cuti resmi yang sudah disetujui
  if (activeLeave) {
    const lType = String(activeLeave.leave_type || '').toUpperCase();
    if (lType === 'SAKIT') return 'SAKIT';
    if (lType === 'DINAS_LUAR') return 'TUGAS';
    if (lType === 'CUTI') return 'CUTI';
    if (lType === 'IZIN') return 'IZIN';
  }

  // 2. Periksa status dan catatan di record absensi
  if (record) {
    const st = String(record.status || '').toUpperCase();
    const notes = String(record.notes || '').toUpperCase();

    // Deteksi cuti
    if (notes.includes('CUTI')) return 'CUTI';

    // Deteksi sakit
    if (st === 'SAKIT' || notes.includes('SAKIT')) return 'SAKIT';

    // Deteksi tugas luar / dinas luar
    if (st === 'DINAS_LUAR' || notes.includes('DINAS_LUAR') || notes.includes('TUGAS')) {
      return 'TUGAS';
    }

    // Deteksi izin
    if (st === 'IZIN' || notes.includes('IZIN')) return 'IZIN';

    // Deteksi kehadiran masuk atau sudah pulang
    if (st === 'HADIR' || st === 'TERLAMBAT') {
      return record.check_out_time ? 'PULANG' : 'HADIR';
    }

    if (st === 'ALFA' || st === 'BELUM_ABSEN') {
      return 'BELUM';
    }
  }

  return 'BELUM';
}

const CATEGORY_DOT: Record<BoardCategory, string> = {
  HADIR: 'bg-emerald-500',
  PULANG: 'bg-teal-500',
  IZIN: 'bg-amber-400',
  TUGAS: 'bg-blue-500',
  SAKIT: 'bg-rose-500',
  CUTI: 'bg-purple-500',
  BELUM: 'bg-slate-400',
};

const CATEGORY_BADGE: Record<BoardCategory, string> = {
  HADIR: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  PULANG: 'bg-teal-50 text-teal-800 border-teal-200',
  IZIN: 'bg-amber-50 text-amber-800 border-amber-200',
  TUGAS: 'bg-blue-50 text-blue-800 border-blue-200',
  SAKIT: 'bg-rose-50 text-rose-800 border-rose-200',
  CUTI: 'bg-purple-50 text-purple-800 border-purple-200',
  BELUM: 'bg-slate-100 text-slate-600 border-slate-200',
};

const CATEGORY_LABEL: Record<BoardCategory, string> = {
  HADIR: 'Hadir',
  PULANG: 'Sudah Pulang',
  IZIN: 'Izin',
  TUGAS: 'Tugas Luar',
  SAKIT: 'Sakit',
  CUTI: 'Cuti',
  BELUM: 'Belum Absen',
};

const TAB_LIST: { key: BoardTab; label: string }[] = [
  { key: 'SEMUA', label: 'Semua' },
  { key: 'HADIR', label: 'Hadir' },
  { key: 'PULANG', label: 'Pulang' },
  { key: 'IZIN', label: 'Izin' },
  { key: 'TUGAS', label: 'Tugas' },
  { key: 'SAKIT', label: 'Sakit' },
  { key: 'CUTI', label: 'Cuti' },
  { key: 'BELUM', label: 'Belum' },
];

// Skeleton satu baris saat loading
const RowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3.5 animate-pulse">
    <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 w-2/3 bg-slate-200 rounded" />
      <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
    </div>
    <div className="h-6 w-16 bg-slate-100 rounded-full shrink-0" />
  </div>
);

export const TeacherDailyBoardModal: React.FC<TeacherDailyBoardModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<BoardTab>('SEMUA');
  const [entries, setEntries] = useState<TeacherBoardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastSync, setLastSync] = useState<string | null>(null);

  const todayStr = getTodayDateInJakarta();

  const fetchData = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    setError(null);
    try {
      const provider = ProviderFactory.getProvider();
      const [records, users, allLeaves] = await Promise.all([
        provider.getDailyAttendance(todayStr, token),
        provider.getAllUsers(token),
        provider.getAllLeaves ? provider.getAllLeaves(token).catch(() => []) : Promise.resolve([]),
      ]);

      const activeTeachers = (users || []).filter(
        (u) => u.is_active && (u.role === 'GURU' || u.role === 'KEPSEK' || u.role === 'ADMIN' || u.role === 'OPERATOR')
      );

      const recordByUserId = new Map<string, AttendanceRecord>();
      (records || []).forEach((r) => recordByUserId.set(r.user_id, r));

      // Peta leave aktif yang disetujui untuk hari ini
      const activeLeavesMap = new Map<string, LeaveRequest>();
      (allLeaves || []).forEach((l) => {
        const isApproved = l.approval_status === 'APPROVED' || l.status === 'APPROVED';
        if (isApproved && l.start_date <= todayStr && l.end_date >= todayStr) {
          activeLeavesMap.set(l.user_id, l);
        }
      });

      // Lengkapi dengan leaves dari localStorage cache
      try {
        const savedRaw = localStorage.getItem('smart_absensi_leaves');
        if (savedRaw) {
          const localList: LeaveRequest[] = JSON.parse(savedRaw);
          if (Array.isArray(localList)) {
            localList.forEach((l) => {
              const isApproved = l.approval_status === 'APPROVED' || l.status === 'APPROVED';
              if (isApproved && l.start_date <= todayStr && l.end_date >= todayStr) {
                if (!activeLeavesMap.has(l.user_id)) {
                  activeLeavesMap.set(l.user_id, l);
                }
              }
            });
          }
        }
      } catch (err) {
        console.warn('TeacherDailyBoardModal: failed to parse local leaves', err);
      }

      const merged: TeacherBoardEntry[] = activeTeachers.map((user) => {
        const record = recordByUserId.get(user.id) ?? null;
        const leave = activeLeavesMap.get(user.id) ?? null;
        const category = resolveCategory(record, leave);
        return { user, record, leave, category };
      });

      // Urutkan: HADIR → PULANG → TUGAS → IZIN → SAKIT → CUTI → BELUM, lalu nama A-Z
      const order: Record<BoardCategory, number> = {
        HADIR: 0,
        PULANG: 1,
        TUGAS: 2,
        IZIN: 3,
        SAKIT: 4,
        CUTI: 5,
        BELUM: 6,
      };
      merged.sort((a, b) => {
        const diff = order[a.category] - order[b.category];
        if (diff !== 0) return diff;
        return a.user.full_name.localeCompare(b.user.full_name, 'id');
      });

      setEntries(merged);
      setLastSync(
        new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data presensi.');
    } finally {
      setIsLoading(false);
    }
  }, [token, todayStr]);

  // Initial fetch & auto-refresh setiap 5 menit
  useEffect(() => {
    if (!isOpen) return;
    fetchData();
    const interval = setInterval(fetchData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isOpen, fetchData]);

  // Reset tab saat buka ulang
  useEffect(() => {
    if (isOpen) setActiveTab('SEMUA');
  }, [isOpen]);

  const counts = useMemo(() => {
    return {
      SEMUA: entries.length,
      HADIR: entries.filter((e) => e.category === 'HADIR').length,
      PULANG: entries.filter((e) => e.category === 'PULANG').length,
      IZIN: entries.filter((e) => e.category === 'IZIN').length,
      TUGAS: entries.filter((e) => e.category === 'TUGAS').length,
      SAKIT: entries.filter((e) => e.category === 'SAKIT').length,
      CUTI: entries.filter((e) => e.category === 'CUTI').length,
      BELUM: entries.filter((e) => e.category === 'BELUM').length,
    };
  }, [entries]);

  const filtered = useMemo(() => {
    if (activeTab === 'SEMUA') return entries;
    return entries.filter((e) => e.category === activeTab);
  }, [entries, activeTab]);

  const dateLabel = useMemo(() => {
    return new Date().toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }, []);

  if (!isOpen) return null;

  const emptyMessages: Record<BoardTab, string> = {
    SEMUA: 'Belum ada data presensi hari ini.',
    HADIR: 'Belum ada guru yang hadir.',
    PULANG: 'Belum ada guru yang pulang.',
    IZIN: 'Tidak ada guru yang izin hari ini.',
    TUGAS: 'Tidak ada guru yang bertugas luar hari ini.',
    SAKIT: 'Tidak ada guru yang sakit hari ini.',
    CUTI: 'Tidak ada guru yang cuti hari ini.',
    BELUM: 'Semua guru sudah presensi! 🎉',
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
        style={{ maxHeight: '90dvh' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="bg-[#023246] text-white shrink-0">
          <div className="flex items-center justify-between px-5 pt-4 pb-3">
            <div className="min-w-0">
              <h2 className="text-sm font-extrabold leading-tight">Papan Kehadiran Hari Ini</h2>
              <p className="text-[11px] text-slate-300 font-medium mt-0.5">{dateLabel}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={fetchData}
                disabled={isLoading}
                title="Perbarui data"
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-all cursor-pointer disabled:opacity-50"
                aria-label="Refresh data presensi"
              >
                <svg
                  className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 rounded-full transition-all cursor-pointer text-sm font-bold"
                aria-label="Tutup"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Sync timestamp */}
          {lastSync && (
            <p className="text-[10px] text-slate-400 px-5 pb-2.5 font-medium">
              Diperbarui pukul {lastSync} WIB
            </p>
          )}

          {/* ── Tab Bar (Termasuk Izin, Tugas, Sakit, Cuti) ── */}
          <div className="flex px-4 pb-0 gap-1 overflow-x-auto scrollbar-none">
            {TAB_LIST.map((tab) => {
              const isActive = activeTab === tab.key;
              const count = counts[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-bold rounded-t-xl transition-all cursor-pointer shrink-0 border-b-2 ${
                    isActive
                      ? 'bg-white text-[#023246] border-white'
                      : 'bg-white/10 text-slate-300 border-transparent hover:bg-white/15'
                  }`}
                  aria-pressed={isActive}
                >
                  {tab.label}
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[9px] font-black ${
                      isActive ? 'bg-[#023246] text-white' : 'bg-white/20 text-white'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Content ── */}
        <div className="overflow-y-auto flex-1 bg-slate-50">
          {isLoading && entries.length === 0 ? (
            <div className="divide-y divide-slate-100 bg-white">
              {Array.from({ length: 6 }).map((_, i) => (
                <RowSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-700 mb-1">Gagal Memuat Data</p>
              <p className="text-[11px] text-slate-500 mb-4 leading-relaxed">{error}</p>
              <button
                type="button"
                onClick={fetchData}
                className="px-5 py-2 bg-[#023246] text-white text-xs font-bold rounded-xl active:scale-95 transition-all cursor-pointer"
              >
                Coba Lagi
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-xs font-bold text-slate-600 mb-1">Tidak Ada Data</p>
              <p className="text-[11px] text-slate-400">{emptyMessages[activeTab]}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 bg-white">
              {filtered.map((entry, idx) => (
                <TeacherRow key={entry.user.id} entry={entry} index={idx} />
              ))}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-4 py-3 bg-white border-t border-slate-100 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full h-10 bg-[#023246] hover:bg-[#034560] active:scale-98 text-white text-xs font-bold rounded-xl transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Sub-komponen: satu baris guru ──
const TeacherRow: React.FC<{ entry: TeacherBoardEntry; index: number }> = ({ entry }) => {
  const { user, record, leave, category } = entry;
  const initial = user.full_name.trim().charAt(0).toUpperCase();
  const [imgError, setImgError] = useState(false);

  const checkInLabel = record?.check_in_time
    ? record.check_in_time.slice(0, 5) + ' WIB'
    : null;

  const checkOutLabel = record?.check_out_time
    ? record.check_out_time.slice(0, 5) + ' WIB'
    : null;

  const cleanReason = (rawReason?: string | null) => {
    if (!rawReason) return '';
    return rawReason
      .replace(/^(Izin|Koreksi|Pengajuan)\s*Disetujui[^:]*:\s*/i, '')
      .trim();
  };

  const reasonSnippet = cleanReason(leave?.reason) || cleanReason(record?.notes);

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-white text-sm font-black shadow-2xs">
          {user.avatar_url && !imgError ? (
            <img
              src={user.avatar_url}
              alt={user.full_name}
              className="w-full h-full object-cover"
              onError={() => setImgError(true)}
            />
          ) : (
            <span>{initial}</span>
          )}
        </div>
        {/* Status dot spesifik */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white shadow-2xs ${CATEGORY_DOT[category]}`}
        />
      </div>

      {/* Info Guru */}
      <div className="flex-1 min-w-0">
        <p className="text-xs sm:text-[13px] font-bold text-slate-900 truncate leading-tight">
          {user.full_name}
        </p>
        <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
          {user.position || 'Pendidik'}
        </p>

        {/* Keterangan Status Presisi */}
        {category === 'HADIR' && (
          <p className="text-[10px] text-emerald-700 font-semibold mt-0.5">
            Masuk {checkInLabel || '--:--'}
          </p>
        )}

        {category === 'PULANG' && (
          <p className="text-[10px] text-teal-700 font-semibold mt-0.5">
            Masuk {checkInLabel || '--:--'} · Pulang {checkOutLabel || '--:--'}
          </p>
        )}

        {category === 'IZIN' && (
          <p className="text-[10px] text-amber-700 font-semibold mt-0.5 truncate">
            📝 Izin{reasonSnippet ? ` • ${reasonSnippet}` : ''}
          </p>
        )}

        {category === 'TUGAS' && (
          <p className="text-[10px] text-blue-700 font-semibold mt-0.5 truncate">
            💼 Tugas Luar{reasonSnippet ? ` • ${reasonSnippet}` : ''}
          </p>
        )}

        {category === 'SAKIT' && (
          <p className="text-[10px] text-rose-700 font-semibold mt-0.5 truncate">
            🤒 Sakit{reasonSnippet ? ` • ${reasonSnippet}` : ''}
          </p>
        )}

        {category === 'CUTI' && (
          <p className="text-[10px] text-purple-700 font-semibold mt-0.5 truncate">
            🏖️ Cuti{reasonSnippet ? ` • ${reasonSnippet}` : ''}
          </p>
        )}

        {category === 'BELUM' && (
          <p className="text-[10px] text-slate-400 font-medium mt-0.5">
            Belum presensi hari ini
          </p>
        )}
      </div>

      {/* Status badge spesifik: memisahkan Izin, Tugas Luar, Sakit, Cuti */}
      <span
        className={`shrink-0 text-[10px] font-extrabold px-2.5 py-1 rounded-full border shadow-2xs ${CATEGORY_BADGE[category]}`}
      >
        {CATEGORY_LABEL[category]}
      </span>
    </div>
  );
};
