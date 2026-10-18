import React, { useState, useEffect, useMemo, useCallback } from 'react';
import type { AttendanceRecord, UserProfile } from '../../../types/database.types';
import { ProviderFactory } from '../../../providers/provider-factory';
import { useAuthStore } from '../../../store/useAuthStore';
import { getTodayDateInJakarta } from '../../../utils/time.utils';

interface TeacherDailyBoardModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type BoardTab = 'SEMUA' | 'HADIR' | 'PULANG' | 'IZIN' | 'BELUM';

interface TeacherBoardEntry {
  user: UserProfile;
  record: AttendanceRecord | null;
  bucket: 'HADIR' | 'PULANG' | 'IZIN' | 'BELUM';
}

// Tentukan bucket berdasarkan status absensi
function resolveBucket(record: AttendanceRecord | null): TeacherBoardEntry['bucket'] {
  if (!record) return 'BELUM';
  if (record.status === 'IZIN' || record.status === 'SAKIT' || record.status === 'DINAS_LUAR') return 'IZIN';
  if (record.status === 'HADIR' || record.status === 'TERLAMBAT') {
    return record.check_out_time ? 'PULANG' : 'HADIR';
  }
  if (record.status === 'ALFA' || record.status === 'BELUM_ABSEN') return 'BELUM';
  return 'BELUM';
}

const STATUS_DOT: Record<TeacherBoardEntry['bucket'], string> = {
  HADIR: 'bg-emerald-500',
  PULANG: 'bg-blue-500',
  IZIN: 'bg-amber-400',
  BELUM: 'bg-rose-400',
};

const STATUS_BADGE: Record<TeacherBoardEntry['bucket'], string> = {
  HADIR: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  PULANG: 'bg-blue-50 text-blue-700 border-blue-200',
  IZIN: 'bg-amber-50 text-amber-700 border-amber-200',
  BELUM: 'bg-rose-50 text-rose-600 border-rose-200',
};

const STATUS_LABEL: Record<TeacherBoardEntry['bucket'], string> = {
  HADIR: 'Hadir',
  PULANG: 'Sudah Pulang',
  IZIN: 'Izin / Sakit',
  BELUM: 'Belum Absen',
};

const TAB_LIST: { key: BoardTab; label: string }[] = [
  { key: 'SEMUA', label: 'Semua' },
  { key: 'HADIR', label: 'Hadir' },
  { key: 'PULANG', label: 'Pulang' },
  { key: 'IZIN', label: 'Izin' },
  { key: 'BELUM', label: 'Belum' },
];

// Skeleton satu baris
const RowSkeleton: React.FC = () => (
  <div className="flex items-center gap-3 p-3.5 animate-pulse">
    <div className="w-9 h-9 rounded-full bg-slate-200 shrink-0" />
    <div className="flex-1 space-y-2">
      <div className="h-3 w-2/3 bg-slate-200 rounded" />
      <div className="h-2.5 w-1/2 bg-slate-100 rounded" />
    </div>
    <div className="h-5 w-16 bg-slate-100 rounded-full shrink-0" />
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
      const [records, users] = await Promise.all([
        provider.getDailyAttendance(todayStr, token),
        provider.getAllUsers(token),
      ]);

      const activeTeachers = (users || []).filter(
        (u) => u.is_active && (u.role === 'GURU' || u.role === 'KEPSEK' || u.role === 'ADMIN' || u.role === 'OPERATOR')
      );

      const recordByUserId = new Map<string, AttendanceRecord>();
      (records || []).forEach((r) => recordByUserId.set(r.user_id, r));

      const merged: TeacherBoardEntry[] = activeTeachers.map((user) => {
        const record = recordByUserId.get(user.id) ?? null;
        return { user, record, bucket: resolveBucket(record) };
      });

      // Urutkan: HADIR → PULANG → IZIN → BELUM, lalu nama A-Z
      const order: Record<TeacherBoardEntry['bucket'], number> = { HADIR: 0, PULANG: 1, IZIN: 2, BELUM: 3 };
      merged.sort((a, b) => {
        const diff = order[a.bucket] - order[b.bucket];
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
      HADIR: entries.filter((e) => e.bucket === 'HADIR').length,
      PULANG: entries.filter((e) => e.bucket === 'PULANG').length,
      IZIN: entries.filter((e) => e.bucket === 'IZIN').length,
      BELUM: entries.filter((e) => e.bucket === 'BELUM').length,
    };
  }, [entries]);

  const filtered = useMemo(() => {
    if (activeTab === 'SEMUA') return entries;
    return entries.filter((e) => e.bucket === activeTab);
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

          {/* ── Tab Bar ── */}
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
  const { user, record, bucket } = entry;
  const initial = user.full_name.trim().charAt(0).toUpperCase();

  const [imgError, setImgError] = useState(false);

  const checkInLabel = record?.check_in_time
    ? record.check_in_time.slice(0, 5) + ' WIB'
    : null;

  const checkOutLabel = record?.check_out_time
    ? record.check_out_time.slice(0, 5) + ' WIB'
    : null;

  const leaveTypeLabel: Record<string, string> = {
    IZIN: 'Izin',
    SAKIT: 'Sakit',
    DINAS_LUAR: 'Dinas Luar',
  };

  const izinLabel = record?.status ? (leaveTypeLabel[record.status] ?? null) : null;

  return (
    <div className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-9 h-9 rounded-full overflow-hidden bg-slate-800 flex items-center justify-center text-white text-sm font-black">
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
        {/* Status dot */}
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${STATUS_DOT[bucket]}`}
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-slate-800 truncate leading-tight">{user.full_name}</p>
        <p className="text-[10.5px] text-slate-500 truncate mt-0.5 font-medium">{user.position || 'Pendidik'}</p>
        {/* Jam masuk / keluar */}
        {bucket !== 'IZIN' && bucket !== 'BELUM' && (
          <div className="flex items-center gap-1.5 mt-1">
            {checkInLabel && (
              <span className="text-[9.5px] text-slate-400 font-semibold">
                Masuk {checkInLabel}
              </span>
            )}
            {checkOutLabel && (
              <>
                <span className="text-[9px] text-slate-300">·</span>
                <span className="text-[9.5px] text-slate-400 font-semibold">
                  Pulang {checkOutLabel}
                </span>
              </>
            )}
          </div>
        )}
        {bucket === 'IZIN' && izinLabel && (
          <p className="text-[9.5px] text-amber-600 font-semibold mt-1">{izinLabel}</p>
        )}
      </div>

      {/* Status badge */}
      <span
        className={`shrink-0 text-[9.5px] font-bold px-2 py-1 rounded-full border ${STATUS_BADGE[bucket]}`}
      >
        {STATUS_LABEL[bucket]}
      </span>
    </div>
  );
};
