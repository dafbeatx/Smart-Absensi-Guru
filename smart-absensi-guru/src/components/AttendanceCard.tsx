import React from 'react';
import { Calendar, Clock, CheckCircle2, AlertCircle, QrCode, RefreshCw } from 'lucide-react';
import { AttendanceRecord, SchoolGeofence } from '../types';
import { MiniMap } from './MiniMap';

interface AttendanceCardProps {
  todayRecord: AttendanceRecord;
  currentTime: Date;
  geofence: SchoolGeofence;
  isInsideRadius: boolean;
  distanceMeter: number;
  onOpenScanner: () => void;
  onRefreshLocation: () => void;
}

export const AttendanceCard: React.FC<AttendanceCardProps> = ({
  todayRecord,
  currentTime,
  geofence,
  isInsideRadius,
  distanceMeter,
  onOpenScanner,
  onRefreshLocation
}) => {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(date);
  };

  const getStatusBadge = () => {
    switch (todayRecord.status) {
      case 'Hadir':
        return (
          <span className="px-3 py-1 bg-emerald-100 text-[#0D7A5F] border border-emerald-200 text-[10px] font-extrabold rounded-full flex items-center gap-1 shadow-2xs">
            ✅ Hadir tepat waktu
          </span>
        );
      case 'Terlambat':
        return (
          <span className="px-3 py-1 bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-extrabold rounded-full flex items-center gap-1 shadow-2xs">
            ⚠️ Terlambat
          </span>
        );
      case 'Izin':
      case 'Sakit':
        return (
          <span className="px-3 py-1 bg-blue-100 text-blue-800 border border-blue-200 text-[10px] font-extrabold rounded-full flex items-center gap-1 shadow-2xs">
            ℹ️ {todayRecord.status}
          </span>
        );
      default:
        return (
          <span className="px-3 py-1 bg-yellow-100 text-yellow-800 border border-yellow-200 text-[10px] font-extrabold rounded-full flex items-center gap-1 shadow-2xs animate-pulse">
            ⏳ Belum Presensi
          </span>
        );
    }
  };

  return (
    <section className="px-6 mt-6">
      <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100 relative overflow-hidden">
        
        {/* Date & Server Time */}
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-1.5 text-slate-500 mb-1">
              <Calendar size={13} className="text-[#0D7A5F]" />
              <span className="text-[11px] font-semibold tracking-wide uppercase">
                {formatDate(currentTime)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              {getStatusBadge()}
            </div>
          </div>
          
          <div className="text-right bg-slate-50 px-3 py-1.5 rounded-2xl border border-slate-100">
            <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Waktu Server</p>
            <p className="text-base font-bold text-[#023246] font-mono leading-none mt-0.5">
              {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          </div>
        </div>

        {/* Time Logs Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className={`p-3 rounded-2xl border transition-all ${
            todayRecord.checkIn 
              ? 'bg-emerald-50/60 border-emerald-200' 
              : 'bg-slate-50 border-dashed border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-[#0D7A5F]" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">JAM MASUK</span>
              </div>
              {todayRecord.checkIn && <CheckCircle2 size={13} className="text-[#0D7A5F]" />}
            </div>
            <p className={`text-base font-extrabold font-mono ${todayRecord.checkIn ? 'text-[#0D7A5F]' : 'text-slate-400'}`}>
              {todayRecord.checkIn ? todayRecord.checkIn : '-- : --'}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 italic">Batas: 07:15 WIB</p>
          </div>

          <div className={`p-3 rounded-2xl border transition-all ${
            todayRecord.checkOut 
              ? 'bg-emerald-50/60 border-emerald-200' 
              : 'bg-slate-50 border-dashed border-slate-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Clock size={13} className="text-rose-500" />
                <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wide">JAM PULANG</span>
              </div>
              {todayRecord.checkOut && <CheckCircle2 size={13} className="text-[#0D7A5F]" />}
            </div>
            <p className={`text-base font-extrabold font-mono ${todayRecord.checkOut ? 'text-[#0D7A5F]' : 'text-slate-400'}`}>
              {todayRecord.checkOut ? todayRecord.checkOut : '-- : --'}
            </p>
            <p className="text-[9px] text-slate-400 mt-0.5 italic">Jadwal: 14:00 WIB</p>
          </div>
        </div>

        {/* GPS Readiness Status & Reload */}
        <div className="space-y-3">
          <div className={`flex items-center justify-between p-2.5 rounded-xl border transition-all ${
            isInsideRadius 
              ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-800' 
              : 'bg-rose-50/80 border-rose-200 text-rose-800'
          }`}>
            <div className="flex items-center gap-2">
              <div className="relative flex items-center justify-center">
                <div className={`w-2.5 h-2.5 rounded-full animate-ping absolute opacity-75 ${
                  isInsideRadius ? 'bg-emerald-500' : 'bg-rose-500'
                }`}></div>
                <div className={`relative w-2.5 h-2.5 rounded-full ${
                  isInsideRadius ? 'bg-emerald-600' : 'bg-rose-600'
                }`}></div>
              </div>
              <span className="text-[11px] font-bold tracking-tight">
                📍 GPS Readiness: {isInsideRadius ? `Dalam Radius (${distanceMeter}m)` : `Di Luar Radius (${distanceMeter}m)`}
              </span>
            </div>

            <button 
              onClick={onRefreshLocation}
              title="Refresh Koordinat GPS"
              className="p-1 hover:bg-white/50 rounded-lg active:scale-90 transition-transform text-slate-600"
            >
              <RefreshCw size={13} />
            </button>
          </div>

          {/* OpenStreetMap Mini Preview */}
          <MiniMap 
            geofence={geofence} 
            isInsideRadius={isInsideRadius} 
            distanceMeter={distanceMeter} 
          />
        </div>

        {/* MAIN SCANNER BUTTON */}
        <button
          onClick={onOpenScanner}
          className="w-full mt-5 bg-[#0D7A5F] hover:bg-[#0a664f] active:opacity-90 text-white py-4 rounded-2xl flex items-center justify-center gap-2.5 shadow-lg shadow-emerald-900/10 active:scale-[0.98] transition-all group border border-emerald-400/20"
        >
          <QrCode size={22} className="group-hover:rotate-12 transition-transform text-white" />
          <span className="font-extrabold tracking-wide text-xs uppercase">
            🔲 PINDAI QR CODE ABSENSI (SCANNER HP)
          </span>
        </button>

      </div>
    </section>
  );
};
