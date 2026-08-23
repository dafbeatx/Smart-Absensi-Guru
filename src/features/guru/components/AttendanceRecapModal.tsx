import React, { useState, useMemo } from 'react';
import type { AttendanceRecord, UserProfile } from '../../../types/database.types';
import { Badge } from '../../../components/ui/Badge';
import { LocationAddressBadge } from '../../../components/ui/LocationAddressBadge';

interface AttendanceRecapModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendanceRecords: AttendanceRecord[];
  user: UserProfile;
  onOpenExportModal?: () => void;
  onOpenCorrectionModal?: (targetDate?: string) => void;
}

export const AttendanceRecapModal: React.FC<AttendanceRecapModalProps> = ({
  isOpen,
  onClose,
  attendanceRecords,
  user,
  onOpenExportModal,
  onOpenCorrectionModal,
}) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;

  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [filterStatus, setFilterStatus] = useState<string>('ALL');

  const monthNames = [
    'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
    'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
  ];

  // Filter records for selected month & year
  const monthlyRecords = useMemo(() => {
    return attendanceRecords.filter((rec) => {
      if (!rec.date) return false;
      const [yearStr, monthStr] = rec.date.split('-');
      const y = parseInt(yearStr, 10);
      const m = parseInt(monthStr, 10);
      if (y !== selectedYear || m !== selectedMonth) return false;
      if (filterStatus !== 'ALL' && rec.status !== filterStatus) return false;
      return true;
    }).sort((a, b) => (b.date > a.date ? 1 : -1));
  }, [attendanceRecords, selectedMonth, selectedYear, filterStatus]);

  // Monthly stats calculation
  const stats = useMemo(() => {
    const rawMonthRecords = attendanceRecords.filter((rec) => {
      if (!rec.date) return false;
      const [yearStr, monthStr] = rec.date.split('-');
      return parseInt(yearStr, 10) === selectedYear && parseInt(monthStr, 10) === selectedMonth;
    });

    const hadir = rawMonthRecords.filter((r) => r.status === 'HADIR').length;
    const terlambat = rawMonthRecords.filter((r) => r.status === 'TERLAMBAT').length;
    const izin = rawMonthRecords.filter((r) => r.status === 'DINAS_LUAR').length;
    const alfa = rawMonthRecords.filter((r) => r.status === 'ALFA').length;
    const totalPresensi = hadir + terlambat;
    const totalHariKerja = Math.max(rawMonthRecords.length, 20);
    const persentase = totalHariKerja > 0 ? Math.round((totalPresensi / totalHariKerja) * 100) : 0;

    return { hadir, terlambat, izin, alfa, totalPresensi, persentase };
  }, [attendanceRecords, selectedMonth, selectedYear]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div className="bg-white w-full max-w-120 rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-[#023246] text-white p-4 px-5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0">
              📊
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-extrabold leading-tight truncate">Rekap & Statistik Presensi</h3>
              <p className="text-[11px] text-emerald-300 font-semibold truncate">{user.full_name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-slate-200 transition-colors cursor-pointer text-sm font-bold shrink-0"
          >
            ✕
          </button>
        </div>

        {/* Month Selector & Quick Export Bar */}
        <div className="p-3 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer shadow-2xs"
            >
              {monthNames.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>
                  {name}
                </option>
              ))}
            </select>

            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
              className="text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-xl px-2.5 py-1.5 outline-none cursor-pointer shadow-2xs"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {onOpenExportModal && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenExportModal();
              }}
              className="px-3 py-1.5 bg-[#0D7A5F] hover:bg-[#095744] text-white text-xs font-bold rounded-xl transition-all shadow-xs flex items-center gap-1 cursor-pointer active:scale-95 shrink-0"
            >
              <span>📥</span>
              <span>Unduh PDF/XLS</span>
            </button>
          )}
        </div>

        {/* Scrollable Content */}
        <div className="p-4 space-y-4 overflow-y-auto flex-1">
          {/* Summary Stat Cards Grid */}
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="bg-emerald-50 border border-emerald-200/80 p-2.5 rounded-2xl">
              <span className="text-lg font-black text-emerald-800 font-mono leading-none block">{stats.hadir}</span>
              <span className="text-[10px] font-bold text-emerald-700 mt-0.5 block">Hadir Tepat</span>
            </div>
            <div className="bg-amber-50 border border-amber-200/80 p-2.5 rounded-2xl">
              <span className="text-lg font-black text-amber-800 font-mono leading-none block">{stats.terlambat}</span>
              <span className="text-[10px] font-bold text-amber-700 mt-0.5 block">Terlambat</span>
            </div>
            <div className="bg-blue-50 border border-blue-200/80 p-2.5 rounded-2xl">
              <span className="text-lg font-black text-blue-800 font-mono leading-none block">{stats.izin}</span>
              <span className="text-[10px] font-bold text-blue-700 mt-0.5 block">Izin/Sakit</span>
            </div>
            <div className="bg-purple-50 border border-purple-200/80 p-2.5 rounded-2xl">
              <span className="text-lg font-black text-purple-800 font-mono leading-none block">{stats.persentase}%</span>
              <span className="text-[10px] font-bold text-purple-700 mt-0.5 block">Kehadiran</span>
            </div>
          </div>

          {/* Status Filter Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl gap-1 border border-slate-200 text-[10px] font-bold">
            {['ALL', 'HADIR', 'TERLAMBAT', 'IZIN', 'ALFA'].map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setFilterStatus(status)}
                className={`flex-1 py-1.5 rounded-lg transition-all cursor-pointer truncate ${
                  filterStatus === status
                    ? 'bg-white text-[#023246] shadow-xs font-black'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {status === 'ALL' ? 'Semua' : status}
              </button>
            ))}
          </div>

          {/* Daily Logs List */}
          <div className="space-y-2">
            <h4 className="text-xs font-black text-[#023246] uppercase tracking-wider px-1">
              Daftar Riwayat ({monthlyRecords.length} Hari)
            </h4>

            {monthlyRecords.length === 0 ? (
              <div className="p-6 text-center bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
                <span className="text-2xl">📋</span>
                <p className="text-xs font-bold text-slate-700">Belum Ada Rekaman Presensi</p>
                <p className="text-[11px] text-slate-400">Tidak ada data presensi pada filter bulan {monthNames[selectedMonth - 1]} {selectedYear}.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {monthlyRecords.map((rec) => {
                  const checkIn = rec.check_in_time ? rec.check_in_time.substring(0, 5) : '--:--';
                  const checkOut = rec.check_out_time ? rec.check_out_time.substring(0, 5) : '--:--';

                  return (
                    <div
                      key={rec.id}
                      className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-2xs hover:border-slate-300 transition-all space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black text-[#023246]">
                            📅 {rec.date}
                          </span>
                        </div>
                        <Badge status={rec.status}>
                          {rec.status === 'HADIR' ? '✓ Hadir Tepat' : rec.status === 'TERLAMBAT' ? '⚠️ Terlambat' : rec.status}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">Jam Masuk</span>
                          <span className="font-mono font-black text-slate-900">{checkIn} WIB</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-500 block">Jam Pulang</span>
                          <span className="font-mono font-black text-slate-900">{checkOut} WIB</span>
                        </div>
                      </div>

                      {/* GPS & Address Badge */}
                      {rec.check_in_lat && rec.check_in_lng && (
                        <div className="pt-1 flex items-center justify-between text-slate-500 text-[10px]">
                          <LocationAddressBadge
                            lat={rec.check_in_lat}
                            lng={rec.check_in_lng}
                            distanceMeters={rec.check_in_distance_meters || undefined}
                            shortOnly
                          />
                          {onOpenCorrectionModal && (
                            <button
                              type="button"
                              onClick={() => {
                                onClose();
                                onOpenCorrectionModal(rec.date);
                              }}
                              className="text-[10px] font-bold text-[#0D7A5F] hover:underline cursor-pointer ml-auto"
                            >
                              Koreksi →
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 bg-slate-800 hover:bg-slate-900 text-white text-xs font-black rounded-xl transition-all cursor-pointer text-center"
          >
            Tutup Rekap
          </button>
        </div>
      </div>
    </div>
  );
};
