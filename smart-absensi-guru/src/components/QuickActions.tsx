import React from 'react';
import { FileText, Edit3, CalendarRange, BarChart2 } from 'lucide-react';

interface QuickActionsProps {
  onOpenLeaveModal: () => void;
  onOpenCorrectionModal: () => void;
  onOpenScheduleModal: () => void;
  onOpenHistoryTab: () => void;
}

export const QuickActions: React.FC<QuickActionsProps> = ({
  onOpenLeaveModal,
  onOpenCorrectionModal,
  onOpenScheduleModal,
  onOpenHistoryTab
}) => {
  return (
    <section className="px-6 mt-6 mb-28">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest ml-1">
          Layanan Mandiri Guru
        </h3>
        <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
          Integrasi Simpeg
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        <button
          onClick={onOpenLeaveModal}
          className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col items-center gap-2 active:bg-slate-50 hover:border-blue-200 transition-all text-center group"
        >
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-700 leading-tight">
            📝 Ajukan Izin / Cuti
          </span>
          <span className="text-[9px] text-slate-400 font-medium">Formulir & Dokumen</span>
        </button>

        <button
          onClick={onOpenCorrectionModal}
          className="bg-white p-4 rounded-2xl shadow-xs border border-slate-100 flex flex-col items-center gap-2 active:bg-slate-50 hover:border-orange-200 transition-all text-center group"
        >
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform">
            <Edit3 size={20} />
          </div>
          <span className="text-[11px] font-bold text-slate-700 leading-tight">
            ✏️ Ajukan Koreksi Absen
          </span>
          <span className="text-[9px] text-slate-400 font-medium">Revisi Jam & Bukti</span>
        </button>

        <button
          onClick={onOpenScheduleModal}
          className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex items-center gap-3 active:bg-slate-50 hover:border-emerald-200 transition-all text-left group"
        >
          <div className="w-9 h-9 bg-emerald-50 text-[#0D7A5F] rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <CalendarRange size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-700 block truncate">Jadwal Mengajar</span>
            <span className="text-[9px] text-slate-400 block truncate">Roster Mingguan</span>
          </div>
        </button>

        <button
          onClick={onOpenHistoryTab}
          className="bg-white p-3.5 rounded-2xl shadow-xs border border-slate-100 flex items-center gap-3 active:bg-slate-50 hover:border-purple-200 transition-all text-left group"
        >
          <div className="w-9 h-9 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-105 transition-transform">
            <BarChart2 size={18} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-bold text-slate-700 block truncate">Rekap Bulanan</span>
            <span className="text-[9px] text-slate-400 block truncate">Laporan Kehadiran</span>
          </div>
        </button>
      </div>
    </section>
  );
};
