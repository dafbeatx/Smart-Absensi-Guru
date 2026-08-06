import React, { useState } from 'react';
import { Calendar, Clock, MapPin, Search, Filter, Download, CheckCircle2, AlertCircle, FileText } from 'lucide-react';
import { AttendanceRecord } from '../types';

interface HistoryTabProps {
  historyRecords: AttendanceRecord[];
}

export const HistoryTab: React.FC<HistoryTabProps> = ({ historyRecords }) => {
  const [selectedMonth, setSelectedMonth] = useState('2026-08');
  const [statusFilter, setStatusFilter] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState('');

  // Calculate statistics
  const totalRecords = historyRecords.length;
  const hadirCount = historyRecords.filter(r => r.status === 'Hadir').length;
  const terlambatCount = historyRecords.filter(r => r.status === 'Terlambat').length;
  const izinCount = historyRecords.filter(r => r.status === 'Izin' || r.status === 'Sakit').length;

  const filteredRecords = historyRecords.filter((record) => {
    const matchesMonth = record.date.startsWith(selectedMonth);
    const matchesStatus = statusFilter === 'Semua' ? true : record.status === statusFilter;
    const matchesSearch = 
      record.dateFormatted.toLowerCase().includes(searchQuery.toLowerCase()) ||
      record.dayName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (record.locationName && record.locationName.toLowerCase().includes(searchQuery.toLowerCase()));

    return matchesMonth && matchesStatus && matchesSearch;
  });

  const handleDownloadReport = () => {
    alert("Unduh Laporan Rekap Presensi Agustus 2026 (PDF / Excel) berhasil disimulasikan.");
  };

  return (
    <div className="p-5 space-y-4 pb-28">
      
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#023246]">Riwayat Presensi Guru</h2>
          <p className="text-[10px] text-slate-400 font-medium">Log Kehadiran & Laporan Bulanan</p>
        </div>
        <button
          onClick={handleDownloadReport}
          className="bg-[#0D7A5F] hover:bg-[#0a634d] text-white px-3 py-1.5 rounded-xl text-[10px] font-bold flex items-center gap-1.5 shadow-xs transition-all active:scale-95"
        >
          <Download size={13} />
          <span>Unduh PDF</span>
        </button>
      </div>

      {/* Stats Summary Cards Grid */}
      <div className="grid grid-cols-4 gap-2">
        <div className="bg-white p-2.5 rounded-2xl border border-slate-100 shadow-2xs text-center">
          <p className="text-[9px] text-slate-400 font-bold uppercase">Total Hari</p>
          <p className="text-sm font-extrabold text-[#023246] mt-0.5">{totalRecords}</p>
        </div>
        <div className="bg-emerald-50/80 p-2.5 rounded-2xl border border-emerald-100 shadow-2xs text-center">
          <p className="text-[9px] text-emerald-800 font-bold uppercase">Hadir</p>
          <p className="text-sm font-extrabold text-[#0D7A5F] mt-0.5">{hadirCount}</p>
        </div>
        <div className="bg-amber-50/80 p-2.5 rounded-2xl border border-amber-100 shadow-2xs text-center">
          <p className="text-[9px] text-amber-800 font-bold uppercase">Terlambat</p>
          <p className="text-sm font-extrabold text-amber-700 mt-0.5">{terlambatCount}</p>
        </div>
        <div className="bg-blue-50/80 p-2.5 rounded-2xl border border-blue-100 shadow-2xs text-center">
          <p className="text-[9px] text-blue-800 font-bold uppercase">Izin/Sakit</p>
          <p className="text-sm font-extrabold text-blue-700 mt-0.5">{izinCount}</p>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-2xs space-y-2.5">
        <div className="flex items-center gap-2">
          {/* Month select */}
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="p-2 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 focus:outline-none focus:border-[#0D7A5F]"
          >
            <option value="2026-08">Agustus 2026</option>
            <option value="2026-07">Juli 2026</option>
            <option value="2026-06">Juni 2026</option>
          </select>

          {/* Search bar */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari tanggal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-[11px] font-medium text-slate-800 focus:outline-none focus:border-[#0D7A5F]"
            />
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pt-1">
          {['Semua', 'Hadir', 'Terlambat', 'Izin'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`py-1 px-3 rounded-full text-[10px] font-bold whitespace-nowrap transition-all ${
                statusFilter === s
                  ? 'bg-[#023246] text-white shadow-xs'
                  : 'bg-slate-50 text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* History List */}
      <div className="space-y-2.5">
        {filteredRecords.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center border border-slate-100 text-slate-400 text-xs">
            Tidak ditemukan riwayat presensi yang sesuai.
          </div>
        ) : (
          filteredRecords.map((record) => (
            <div
              key={record.id}
              className="bg-white rounded-2xl p-3.5 border border-slate-100 shadow-2xs hover:border-emerald-200 transition-all space-y-2"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center font-bold text-xs text-[#023246]">
                    {record.dayName.slice(0, 3)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-[#023246]">{record.dateFormatted}</h4>
                    <p className="text-[9px] text-slate-400">{record.locationName}</p>
                  </div>
                </div>

                <div>
                  {record.status === 'Hadir' && (
                    <span className="px-2.5 py-0.5 bg-emerald-50 text-[#0D7A5F] border border-emerald-200 text-[9px] font-extrabold rounded-full">
                      ✅ Hadir
                    </span>
                  )}
                  {record.status === 'Terlambat' && (
                    <span className="px-2.5 py-0.5 bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-extrabold rounded-full">
                      ⚠️ Terlambat
                    </span>
                  )}
                  {(record.status === 'Izin' || record.status === 'Sakit') && (
                    <span className="px-2.5 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 text-[9px] font-extrabold rounded-full">
                      ℹ️ {record.status}
                    </span>
                  )}
                  {record.status === 'Belum Presensi' && (
                    <span className="px-2.5 py-0.5 bg-slate-100 text-slate-500 text-[9px] font-bold rounded-full">
                      Belum Absen
                    </span>
                  )}
                </div>
              </div>

              {/* Check in / out details */}
              <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-50 text-[10px]">
                <div className="bg-slate-50 p-1.5 px-2.5 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Jam Masuk:</span>
                  <span className="font-mono font-bold text-[#0D7A5F]">
                    {record.checkIn || '-- : --'}
                  </span>
                </div>
                <div className="bg-slate-50 p-1.5 px-2.5 rounded-xl flex items-center justify-between">
                  <span className="text-slate-400 font-medium">Jam Pulang:</span>
                  <span className="font-mono font-bold text-slate-700">
                    {record.checkOut || '-- : --'}
                  </span>
                </div>
              </div>

              {record.notes && (
                <p className="text-[9px] text-amber-700 italic bg-amber-50/50 px-2 py-0.5 rounded">
                  Catatan: {record.notes}
                </p>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
};
